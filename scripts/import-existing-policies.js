const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'login_db',
  password: 'Akshuu@24',
  port: 5432,
});

const {
  getOrCreateBank,
  getNextVersionLabel,
  extractRulesFromText,
} = require('../services/policyImporter');

async function importExistingPolicyFiles() {
  const client = await pool.connect();
  const stats = {
    startedAt: new Date(),
    completedAt: null,
    totalFilesScanned: 0,
    banksDetected: 0,
    versionsCreated: 0,
    rulesExtracted: 0,
    attachmentsLinked: 0,
    skippedFiles: 0,
    extractionFailures: 0,
    details: [],
  };

  try {
    const result = await client.query(
      `SELECT bpf.id, bpf.bank_id, bpf.file_name, bpf.file_path, bpf.file_type, bpf.file_size_bytes, bpf.extracted_text, b.name AS bank_name, b.code AS bank_code
       FROM bank_policy_files bpf
       JOIN banks b ON b.id = bpf.bank_id
       WHERE bpf.extracted_text IS NOT NULL
         AND bpf.policy_version_id IS NULL
       ORDER BY b.name, bpf.file_name`
    );

    stats.totalFilesScanned = result.rowCount;
    console.log(`Found ${stats.totalFilesScanned} already-extracted policy files without policy_version_id`);

    const bankGroups = new Map();
    for (const row of result.rows) {
      const key = row.bank_name;
      if (!bankGroups.has(key)) {
        bankGroups.set(key, { bankInfo: { name: row.bank_name, code: row.bank_code }, files: [] });
      }
      bankGroups.get(key).files.push(row);
    }
    stats.banksDetected = bankGroups.size;

    for (const [bankName, group] of bankGroups.entries()) {
      const bankRecord = await getOrCreateBank(client, group.bankInfo);
      const bankDetail = {
        bankName: bankRecord.name,
        bankCode: bankRecord.code,
        filesFound: group.files.length,
        rulesCreated: [],
      };

      for (const file of group.files) {
        const fileContent = file.extracted_text;
        if (!fileContent) {
          stats.skippedFiles++;
          continue;
        }

        const extracted = extractRulesFromText(fileContent, file.file_name, null);
        if (!extracted) {
          stats.extractionFailures++;
          continue;
        }

        const loanType = extracted.loan_type || 'Personal';

        const existingSource = await client.query(
          `SELECT id FROM policy_sources WHERE bank_id = $1 AND file_name = $2`,
          [bankRecord.id, file.file_name]
        );

        let sourceId = null;
        if (existingSource.rowCount > 0) {
          sourceId = existingSource.rows[0].id;
        } else {
          const srcRes = await client.query(
            `INSERT INTO policy_sources (bank_id, file_name, file_path, file_type, file_size_bytes, uploaded_by, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [bankRecord.id, file.file_name, file.file_path, file.file_type, file.file_size_bytes, null, `Imported from existing bank_policy_files`]
          );
          sourceId = srcRes.rows[0].id;
          stats.attachmentsLinked++;
        }

        const versionLabel = await getNextVersionLabel(client, bankRecord.id, loanType);

        const versionRes = await client.query(
          `INSERT INTO policy_versions (bank_id, source_id, loan_type, version, status, notes, created_by)
           VALUES ($1, $2, $3, $4, 'review', $5, $6) RETURNING id, version, status`,
          [bankRecord.id, sourceId, loanType, versionLabel, `Imported from policy document ${file.file_name}`, null]
        );
        const policyVersionId = versionRes.rows[0].id;
        stats.versionsCreated++;

        const ruleRes = await client.query(
          `INSERT INTO policy_rules (
            policy_version_id, loan_type, category, min_cibil, max_cibil, min_salary, max_salary,
            employment_type, min_age, max_age, min_loan_amount, max_loan_amount,
            foir_percent, location_rules, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'review')
          RETURNING id, loan_type, status`,
          [
            policyVersionId, loanType, extracted.category || null, extracted.min_cibil, extracted.max_cibil,
            extracted.min_salary, extracted.max_salary, extracted.employment_type,
            extracted.min_age, extracted.max_age, extracted.min_loan_amount, extracted.max_loan_amount,
            extracted.foir_percent,
            extracted.location_coverage ? JSON.stringify(extracted.location_coverage) : null,
          ]
        );
        const policyRuleId = ruleRes.rows[0].id;
        stats.rulesExtracted++;

        await client.query(
          `INSERT INTO policy_attachments (policy_rule_id, file_name, file_path, file_type, file_size_bytes, extracted_text, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [policyRuleId, file.file_name, file.file_path, file.file_type, file.file_size_bytes, fileContent, null]
        );

        await client.query(
          `UPDATE bank_policy_files SET policy_version_id = $1 WHERE id = $2`,
          [policyVersionId, file.id]
        );

        bankDetail.rulesCreated.push({
          ruleId: policyRuleId,
          version: versionLabel,
          loanType,
          status: 'review',
          sourceFile: file.file_name,
        });
      }

      stats.details.push(bankDetail);
    }

    stats.completedAt = new Date();
    return stats;
  } finally {
    client.release();
    await pool.end();
  }
}

importExistingPolicyFiles()
  .then(stats => {
    console.log('\n=== Import Summary ===');
    console.log(`Files scanned:         ${stats.totalFilesScanned}`);
    console.log(`Banks detected:        ${stats.banksDetected}`);
    console.log(`Versions created:      ${stats.versionsCreated}`);
    console.log(`Rules extracted:       ${stats.rulesExtracted}`);
    console.log(`Attachments linked:    ${stats.attachmentsLinked}`);
    console.log(`Skipped files:         ${stats.skippedFiles}`);
    console.log(`Extraction failures:   ${stats.extractionFailures}`);
    console.log(`Started at:            ${stats.startedAt}`);
    console.log(`Completed at:          ${stats.completedAt}`);
    console.log('\nDetails by bank:');
    for (const d of stats.details) {
      console.log(`  ${d.bankName} (${d.bankCode}): ${d.filesFound} files, ${d.rulesCreated.length} rules created`);
      for (const r of d.rulesCreated) {
        console.log(`    - ${r.sourceFile} -> ${r.version} (${r.loanType}, ${r.status})`);
      }
    }
  })
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
