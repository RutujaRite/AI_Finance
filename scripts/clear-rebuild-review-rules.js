const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: '127.0.0.1', database: 'login_db', password: 'Akshuu@24', port: 5432 });

async function clearAndRebuild() {
  const client = await pool.connect();
  const stats = {
    startedAt: new Date(),
    completedAt: null,
    oldRulesDeleted: 0,
    oldVersionsDeleted: 0,
    oldAttachmentsDeleted: 0,
    filesUnlinked: 0,
    insertedFiles: 0,
    skippedFiles: 0,
    failedFiles: 0,
    versionsCreated: 0,
    rulesExtracted: 0,
  };

  try {
    // 1. Find auto-imported review versions
    const autoVersions = await client.query(
      "SELECT id FROM policy_versions WHERE status = 'review' AND notes LIKE $1 ORDER BY id",
      ['Imported from policy document%']
    );
    const versionIds = autoVersions.rows.map(r => r.id);
    stats.oldVersionsDeleted = versionIds.length;
    console.log(`Found ${versionIds.length} auto-imported review versions to clear`);

    if (versionIds.length === 0) {
      console.log('Nothing to clear.');
      return stats;
    }

    // 2. Delete policy_attachments for rules linked to these versions
    const attachmentRes = await client.query(
      'DELETE FROM policy_attachments WHERE policy_rule_id IN (SELECT id FROM policy_rules WHERE policy_version_id = ANY($1::int[])) RETURNING id',
      [versionIds]
    );
    stats.oldAttachmentsDeleted = attachmentRes.rowCount;

    // 3. Delete old policy_rules
    const ruleRes = await client.query(
      'DELETE FROM policy_rules WHERE policy_version_id = ANY($1::int[]) RETURNING id',
      [versionIds]
    );
    stats.oldRulesDeleted = ruleRes.rowCount;

    // 4. Delete old policy_versions
    await client.query(
      'DELETE FROM policy_versions WHERE id = ANY($1::int[])',
      [versionIds]
    );

    // 5. Unlink bank_policy_files
    const unlinkRes = await client.query(
      'UPDATE bank_policy_files SET policy_version_id = NULL WHERE policy_version_id = ANY($1::int[]) RETURNING id',
      [versionIds]
    );
    stats.filesUnlinked = unlinkRes.rowCount;

    console.log(`Cleared: ${stats.oldVersionsDeleted} versions, ${stats.oldRulesDeleted} rules, ${stats.oldAttachmentsDeleted} attachments, ${stats.filesUnlinked} files unlinked`);

    // 6. Re-import using the new parser
    const {
      getOrCreateBank,
      getNextVersionLabel,
      extractRulesFromText,
    } = require('../services/policyImporter');

    const filesResult = await client.query(
      `SELECT bpf.id, bpf.bank_id, bpf.file_name, bpf.file_path, bpf.file_type, bpf.file_size_bytes, bpf.extracted_text, b.name AS bank_name, b.code AS bank_code
       FROM bank_policy_files bpf
       JOIN banks b ON b.id = bpf.bank_id
       WHERE bpf.extracted_text IS NOT NULL
         AND bpf.policy_version_id IS NULL
       ORDER BY b.name, bpf.file_name`
    );

    stats.insertedFiles = filesResult.rowCount;
    console.log(`Re-importing ${stats.insertedFiles} files with new parser`);

    const bankGroups = new Map();
    for (const row of filesResult.rows) {
      const key = row.bank_name;
      if (!bankGroups.has(key)) {
        bankGroups.set(key, { bankInfo: { name: row.bank_name, code: row.bank_code }, files: [] });
      }
      bankGroups.get(key).files.push(row);
    }

    for (const [bankName, group] of bankGroups.entries()) {
      const bankRecord = await getOrCreateBank(client, group.bankInfo);

      for (const file of group.files) {
        const fileContent = file.extracted_text;
        if (!fileContent) {
          stats.skippedFiles++;
          continue;
        }

        const extracted = extractRulesFromText(fileContent, file.file_name, null);
        if (!extracted) {
          stats.failedFiles++;
          continue;
        }

        const loanType = extracted.loan_type || 'Personal';

        const existingSource = await client.query(
          'SELECT id FROM policy_sources WHERE bank_id = $1 AND file_name = $2',
          [bankRecord.id, file.file_name]
        );

        let sourceId = null;
        if (existingSource.rowCount > 0) {
          sourceId = existingSource.rows[0].id;
        } else {
          const srcRes = await client.query(
            `INSERT INTO policy_sources (bank_id, file_name, file_path, file_type, file_size_bytes, uploaded_by, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [bankRecord.id, file.file_name, file.file_path, file.file_type, file.file_size_bytes, null, 'Re-imported with new parser']
          );
          sourceId = srcRes.rows[0].id;
        }

        const versionLabel = await getNextVersionLabel(client, bankRecord.id, loanType);

        const versionRes = await client.query(
          `INSERT INTO policy_versions (bank_id, source_id, loan_type, version, status, notes, created_by)
           VALUES ($1, $2, $3, $4, 'review', $5, $6) RETURNING id`,
          [bankRecord.id, sourceId, loanType, versionLabel, `Re-imported with new parser from ${file.file_name}`, null]
        );
        const policyVersionId = versionRes.rows[0].id;
        stats.versionsCreated++;

        const ruleRes = await client.query(
          `INSERT INTO policy_rules (
            policy_version_id, loan_type, min_cibil, max_cibil, min_salary, max_salary,
            employment_type, min_age, max_age, min_loan_amount, max_loan_amount,
            foir_percent, location_rules, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'review')
          RETURNING id`,
          [
            policyVersionId, loanType, extracted.min_cibil, extracted.max_cibil,
            extracted.min_salary, extracted.max_salary, extracted.employment_type,
            extracted.min_age, extracted.max_age, extracted.min_loan_amount, extracted.max_loan_amount,
            extracted.foir_percent,
            extracted.location_coverage ? JSON.stringify(extracted.location_coverage) : null,
          ]
        );
        stats.rulesExtracted++;

        await client.query(
          `INSERT INTO policy_attachments (policy_rule_id, file_name, file_path, file_type, file_size_bytes, extracted_text, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [ruleRes.rows[0].id, file.file_name, file.file_path, file.file_type, file.file_size_bytes, fileContent, null]
        );

        await client.query(
          'UPDATE bank_policy_files SET policy_version_id = $1 WHERE id = $2',
          [policyVersionId, file.id]
        );
      }
    }

    stats.completedAt = new Date();
    return stats;
  } finally {
    client.release();
    await pool.end();
  }
}

clearAndRebuild()
  .then(stats => {
    console.log('\n=== Clear/Rebuild Summary ===');
    console.log(`Old versions deleted:       ${stats.oldVersionsDeleted}`);
    console.log(`Old rules deleted:          ${stats.oldRulesDeleted}`);
    console.log(`Old attachments deleted:    ${stats.oldAttachmentsDeleted}`);
    console.log(`Files unlinked:             ${stats.filesUnlinked}`);
    console.log(`Files re-imported:          ${stats.insertedFiles}`);
    console.log(`Skipped files:              ${stats.skippedFiles}`);
    console.log(`Failed files:               ${stats.failedFiles}`);
    console.log(`New versions created:       ${stats.versionsCreated}`);
    console.log(`New rules extracted:        ${stats.rulesExtracted}`);
    console.log(`Started at:                 ${stats.startedAt}`);
    console.log(`Completed at:               ${stats.completedAt}`);
  })
  .catch(err => {
    console.error('Clear/rebuild failed:', err);
    process.exit(1);
  });
