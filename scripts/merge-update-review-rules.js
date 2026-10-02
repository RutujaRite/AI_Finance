const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: '127.0.0.1', database: 'login_db', password: 'Akshuu@24', port: 5432 });

const {
  extractRulesFromText,
  getNextVersionLabel,
} = require('../services/policyImporter');

function aggregateGroupRules(fileRules) {
  const merged = {
    min_cibil: null,
    max_cibil: null,
    min_salary: null,
    max_salary: null,
    employment_type: null,
    min_age: null,
    max_age: null,
    min_loan_amount: null,
    max_loan_amount: null,
    foir_percent: null,
    location_coverage: null,
  };

  const cities = new Set();
  const employmentTypes = new Set();

  for (const rule of fileRules) {
    if (rule.min_cibil !== null && rule.min_cibil !== undefined) {
      merged.min_cibil = merged.min_cibil === null ? rule.min_cibil : Math.min(merged.min_cibil, rule.min_cibil);
    }
    if (rule.max_cibil !== null && rule.max_cibil !== undefined) {
      merged.max_cibil = merged.max_cibil === null ? rule.max_cibil : Math.max(merged.max_cibil, rule.max_cibil);
    }
    if (rule.min_salary !== null && rule.min_salary !== undefined) {
      merged.min_salary = merged.min_salary === null ? rule.min_salary : Math.min(merged.min_salary, rule.min_salary);
    }
    if (rule.max_salary !== null && rule.max_salary !== undefined) {
      merged.max_salary = merged.max_salary === null ? rule.max_salary : Math.max(merged.max_salary, rule.max_salary);
    }
    if (rule.employment_type) {
      employmentTypes.add(rule.employment_type);
    }
    if (rule.min_age !== null && rule.min_age !== undefined) {
      merged.min_age = merged.min_age === null ? rule.min_age : Math.min(merged.min_age, rule.min_age);
    }
    if (rule.max_age !== null && rule.max_age !== undefined) {
      merged.max_age = merged.max_age === null ? rule.max_age : Math.max(merged.max_age, rule.max_age);
    }
    if (rule.min_loan_amount !== null && rule.min_loan_amount !== undefined) {
      merged.min_loan_amount = merged.min_loan_amount === null ? rule.min_loan_amount : Math.min(merged.min_loan_amount, rule.min_loan_amount);
    }
    if (rule.max_loan_amount !== null && rule.max_loan_amount !== undefined) {
      merged.max_loan_amount = merged.max_loan_amount === null ? rule.max_loan_amount : Math.max(merged.max_loan_amount, rule.max_loan_amount);
    }
    if (rule.foir_percent !== null && rule.foir_percent !== undefined) {
      merged.foir_percent = merged.foir_percent === null ? rule.foir_percent : Math.max(merged.foir_percent, rule.foir_percent);
    }
    if (rule.location_coverage) {
      if (rule.location_coverage.cities) {
        for (const city of rule.location_coverage.cities) {
          cities.add(city.toLowerCase());
        }
      }
    }
  }

  if (employmentTypes.has('Salaried') && employmentTypes.has('Self-Employed')) {
    merged.employment_type = 'Any';
  } else if (employmentTypes.size === 1) {
    merged.employment_type = Array.from(employmentTypes)[0];
  }

  if (cities.size > 0) {
    merged.location_coverage = {
      cities: Array.from(cities).slice(0, 50),
    };
  }

  return merged;
}

async function mergeAndUpdateReviewRules() {
  const client = await pool.connect();
  const stats = {
    startedAt: new Date(),
    completedAt: null,
    banksProcessed: 0,
    groupsCreated: 0,
    rulesCreated: 0,
    attachmentsLinked: 0,
    oldRulesDeleted: 0,
    oldVersionsDeleted: 0,
    extractionFailures: 0,
  };

  try {
    const banksResult = await client.query('SELECT id, name, code FROM banks ORDER BY name');
    console.log(`Processing ${banksResult.rowCount} banks`);

    for (const bank of banksResult.rows) {
      const filesResult = await client.query(
        'SELECT id, file_name, extracted_text FROM bank_policy_files WHERE bank_id = $1 AND extracted_text IS NOT NULL',
        [bank.id]
      );

      if (filesResult.rowCount === 0) {
        continue;
      }

      const extractedRules = [];
      for (const file of filesResult.rows) {
        const extracted = extractRulesFromText(file.extracted_text, file.file_name, null);
        if (extracted) {
          extractedRules.push({ ...extracted, sourceFileId: file.id, sourceFileName: file.file_name });
        } else {
          stats.extractionFailures++;
        }
      }

      if (extractedRules.length === 0) {
        continue;
      }

      // Group by: loan_type + employment_type + category
      const groupMap = new Map();
      for (const rule of extractedRules) {
        const groupKey = `${rule.loan_type || 'Personal'}__${rule.employment_type || 'Any'}__${rule.category || 'General'}`;
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, { key: groupKey, rules: [] });
        }
        groupMap.get(groupKey).rules.push(rule);
      }

      // Get existing review versions for this bank
      const oldVersions = await client.query(
        'SELECT id FROM policy_versions WHERE bank_id = $1 AND status = $2',
        [bank.id, 'review']
      );
      const oldVersionIds = oldVersions.rows.map(r => r.id);

      // Unlink bank_policy_files from old versions before deleting
      if (oldVersionIds.length > 0) {
        await client.query(
          'UPDATE bank_policy_files SET policy_version_id = NULL WHERE policy_version_id = ANY($1::int[])',
          [oldVersionIds]
        );
      }

      // Delete existing review rules and versions for this bank
      if (oldVersionIds.length > 0) {
        await client.query(
          'DELETE FROM policy_attachments WHERE policy_rule_id IN (SELECT id FROM policy_rules WHERE policy_version_id = ANY($1::int[]))',
          [oldVersionIds]
        );
        const deletedRules = await client.query(
          'DELETE FROM policy_rules WHERE policy_version_id = ANY($1::int[]) RETURNING id',
          [oldVersionIds]
        );
        stats.oldRulesDeleted += deletedRules.rowCount;
        await client.query(
          'DELETE FROM policy_versions WHERE id = ANY($1::int[])',
          [oldVersionIds]
        );
        stats.oldVersionsDeleted += oldVersionIds.length;
      }

      // Create new grouped rules
      for (const [groupKey, group] of groupMap.entries()) {
        const merged = aggregateGroupRules(group.rules);
        const loanType = group.rules[0].loan_type || 'Personal';
        const versionLabel = await getNextVersionLabel(client, bank.id, loanType);

        const versionRes = await client.query(
          `INSERT INTO policy_versions (bank_id, loan_type, version, status, notes, created_by)
           VALUES ($1, $2, $3, 'review', $4, $5) RETURNING id`,
          [bank.id, loanType, versionLabel, `Grouped rule for ${groupKey}`, null]
        );
        const policyVersionId = versionRes.rows[0].id;
        stats.groupsCreated++;

        const ruleRes = await client.query(
          `INSERT INTO policy_rules (
            policy_version_id, loan_type, category, min_cibil, max_cibil, min_salary, max_salary,
            employment_type, min_age, max_age, min_loan_amount, max_loan_amount,
            foir_percent, location_rules, status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'review')
          RETURNING id`,
          [
            policyVersionId, loanType, merged.category || null,
            merged.min_cibil, merged.max_cibil, merged.min_salary, merged.max_salary,
            merged.employment_type, merged.min_age, merged.max_age, merged.min_loan_amount, merged.max_loan_amount,
            merged.foir_percent,
            merged.location_coverage ? JSON.stringify(merged.location_coverage) : null,
          ]
        );
        const policyRuleId = ruleRes.rows[0].id;
        stats.rulesCreated++;

        // Link source files as attachments and update bank_policy_files
        const linkedFileIds = new Set();
        for (const rule of group.rules) {
          if (linkedFileIds.has(rule.sourceFileId)) continue;
          linkedFileIds.add(rule.sourceFileId);

          const fileResult = await client.query(
            'SELECT file_name, file_path, file_type, file_size_bytes, extracted_text FROM bank_policy_files WHERE id = $1',
            [rule.sourceFileId]
          );
          if (fileResult.rowCount > 0) {
            const file = fileResult.rows[0];
            await client.query(
              `INSERT INTO policy_attachments (policy_rule_id, file_name, file_path, file_type, file_size_bytes, extracted_text, uploaded_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [policyRuleId, file.file_name, file.file_path, file.file_type, file.file_size_bytes, file.extracted_text, null]
            );
            stats.attachmentsLinked++;

            await client.query(
              'UPDATE bank_policy_files SET policy_version_id = $1 WHERE id = $2',
              [policyVersionId, rule.sourceFileId]
            );
          }
        }
      }

      stats.banksProcessed++;
      console.log(`Bank ${bank.name}: ${groupMap.size} groups created from ${extractedRules.length} files`);
    }

    stats.completedAt = new Date();
    return stats;
  } finally {
    client.release();
    await pool.end();
  }
}

mergeAndUpdateReviewRules()
  .then(stats => {
    console.log('\n=== Merge/Update Summary ===');
    console.log(`Banks processed:     ${stats.banksProcessed}`);
    console.log(`Groups created:      ${stats.groupsCreated}`);
    console.log(`Rules created:       ${stats.rulesCreated}`);
    console.log(`Attachments linked:  ${stats.attachmentsLinked}`);
    console.log(`Old rules deleted:   ${stats.oldRulesDeleted}`);
    console.log(`Old versions deleted:${stats.oldVersionsDeleted}`);
    console.log(`Extraction failures: ${stats.extractionFailures}`);
    console.log(`Started at:          ${stats.startedAt}`);
    console.log(`Completed at:        ${stats.completedAt}`);
  })
  .catch(err => {
    console.error('Merge/update failed:', err);
    process.exit(1);
  });
