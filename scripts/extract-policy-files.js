// Extract text/tables from every registered bank_policy_files row and persist
// extraction status, content, and errors in PostgreSQL.
//
// Constraints (per task):
//  - Only EXTRACT text; do NOT create company-bank mappings or eligibility
//    criteria, and do NOT activate any policies.
//  - Do not invent data or use defaults; store exactly what was extracted.
//  - Preserve the existing bank <-> source-file relationship (bank_id).
//
// Usage:
//   node scripts/extract-policy-files.js            # skip already-successful
//   node scripts/extract-policy-files.js --force    # re-extract everything

const path = require('path');
const pool = require('../db');
const { extractTextFromFile } = require('../services/policyImporter');

const FORCE = process.argv.includes('--force');

const EXT_BUCKETS = {
  '.pdf': 'PDF',
  '.xlsx': 'XLSX', '.xls': 'XLS', '.xlsb': 'XLSB', '.csv': 'CSV',
  '.txt': 'TXT',
  '.doc': 'DOC', '.docx': 'DOCX',
  '.jpg': 'JPG', '.jpeg': 'JPEG', '.png': 'PNG', '.bmp': 'BMP', '.webp': 'WEBP', '.gif': 'GIF'
};

function bucket(ext) {
  const e = (ext || '').toLowerCase();
  return EXT_BUCKETS[e] || (e ? e.replace(/^\./, '').toUpperCase() : 'UNKNOWN');
}

async function ensureColumns(client) {
  await client.query(`ALTER TABLE bank_policy_files ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) DEFAULT 'pending';`);
  await client.query(`ALTER TABLE bank_policy_files ADD COLUMN IF NOT EXISTS extraction_error TEXT;`);
  await client.query(`ALTER TABLE bank_policy_files ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP;`);
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureColumns(client);

    const { rows } = await client.query(
      `SELECT id, bank_id, file_name, file_path, file_type, extraction_status, extracted_text
       FROM bank_policy_files
       ORDER BY id ASC`
    );

    const total = rows.length;
    const summary = {
      total,
      success: 0,
      failed: 0,
      skipped: 0,
      byType: {}
    };
    function bump(type, key) {
      if (!summary.byType[type]) summary.byType[type] = { success: 0, failed: 0, skipped: 0 };
      summary.byType[type][key] += 1;
    }

    console.log(`Found ${total} registered bank_policy_files. Force re-extract: ${FORCE ? 'yes' : 'no'}`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const type = bucket(row.file_type);
      const pct = (((i + 1) / total) * 100).toFixed(1);

      // Idempotent skip: already extracted successfully (unless forced)
      if (!FORCE && row.extraction_status === 'success' && row.extracted_text) {
        summary.skipped += 1;
        bump(type, 'skipped');
        console.log(`[${pct}%] SKIP   #${row.id} (${type}) ${row.file_name}`);
        continue;
      }

      try {
        const raw = await extractTextFromFile(row.file_path, row.file_type);
        const text = raw == null ? null : String(raw);
        if (text && text.trim().length > 0) {
          await client.query(
            `UPDATE bank_policy_files
             SET extracted_text = $1::text, extraction_status = 'success', extraction_error = NULL, extracted_at = NOW()
             WHERE id = $2`,
            [text, row.id]
          );
          summary.success += 1;
          bump(type, 'success');
          console.log(`[${pct}%] OK     #${row.id} (${type}) ${row.file_name} (${text.length} chars)`);
        } else {
          await client.query(
            `UPDATE bank_policy_files
             SET extracted_text = NULL, extraction_status = 'failed', extraction_error = 'No extractable text returned', extracted_at = NOW()
             WHERE id = $1`,
            [row.id]
          );
          summary.failed += 1;
          bump(type, 'failed');
          console.log(`[${pct}%] EMPTY  #${row.id} (${type}) ${row.file_name}`);
        }
      } catch (err) {
        const msg = (err && err.message ? err.message : String(err)).slice(0, 500);
        await client.query(
          `UPDATE bank_policy_files
           SET extraction_status = 'failed', extraction_error = $1::text, extracted_at = NOW()
           WHERE id = $2`,
          [msg, row.id]
        );
        summary.failed += 1;
        bump(type, 'failed');
        console.log(`[${pct}%] FAIL   #${row.id} (${type}) ${row.file_name} -> ${msg}`);
      }
    }

    console.log('\n================ EXTRACTION SUMMARY ================');
    console.log(`Total registered files : ${summary.total}`);
    console.log(`Successfully extracted : ${summary.success}`);
    console.log(`Failed / empty         : ${summary.failed}`);
    console.log(`Skipped (already done) : ${summary.skipped}`);
    console.log('\nBy file type:');
    for (const [type, c] of Object.entries(summary.byType)) {
      console.log(`  ${type.padEnd(6)} -> success: ${c.success}, failed: ${c.failed}, skipped: ${c.skipped}`);
    }
    console.log('===================================================');
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error('Extraction run failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
