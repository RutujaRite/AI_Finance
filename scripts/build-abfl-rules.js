const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: '127.0.0.1', database: 'login_db', password: 'Akshuu@24', port: 5432 });

const {
  extractRulesFromText,
  normalizeAndValidateRules,
  VALIDATION_CONFIG,
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
    min_tenure_months: null,
    max_tenure_months: null,
    foir_percent: null,
    roi: null,
    roi_min: null,
    roi_max: null,
    location_coverage: null,
    category: null,
  };

  const cities = new Set();
  const employmentTypes = new Set();
  const roiValues = [];

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
    if (merged.min_loan_amount !== null && merged.max_loan_amount !== null && merged.min_loan_amount > merged.max_loan_amount) {
      const temp = merged.min_loan_amount;
      merged.min_loan_amount = merged.max_loan_amount;
      merged.max_loan_amount = temp;
    }
    if (rule.min_tenure_months !== null && rule.min_tenure_months !== undefined) {
      merged.min_tenure_months = merged.min_tenure_months === null ? rule.min_tenure_months : Math.min(merged.min_tenure_months, rule.min_tenure_months);
    }
    if (rule.max_tenure_months !== null && rule.max_tenure_months !== undefined) {
      merged.max_tenure_months = merged.max_tenure_months === null ? rule.max_tenure_months : Math.max(merged.max_tenure_months, rule.max_tenure_months);
    }
    if (rule.foir_percent !== null && rule.foir_percent !== undefined) {
      merged.foir_percent = merged.foir_percent === null ? rule.foir_percent : Math.max(merged.foir_percent, rule.foir_percent);
    }
    if (rule.roi_min !== null && rule.roi_min !== undefined) {
      roiValues.push(rule.roi_min);
    }
    if (rule.roi_max !== null && rule.roi_max !== undefined) {
      roiValues.push(rule.roi_max);
    }
  if (rule.location_coverage) {
    if (rule.location_coverage.cities) {
      for (const city of rule.location_coverage.cities) {
        cities.add(city.toLowerCase());
      }
    }
    if (rule.location_coverage.conditions) {
      if (!merged.location_coverage) merged.location_coverage = { conditions: [] };
      for (const cond of rule.location_coverage.conditions) {
        if (merged.location_coverage.conditions.indexOf(cond) === -1) {
          merged.location_coverage.conditions.push(cond);
        }
      }
    }
  }
    if (rule.category) {
      merged.category = rule.category;
    }
  }

  if (employmentTypes.has('Salaried') && employmentTypes.has('Self-Employed')) {
    merged.employment_type = 'Any';
  } else if (employmentTypes.size === 1) {
    merged.employment_type = Array.from(employmentTypes)[0];
  }

  if (roiValues.length > 0) {
    merged.roi_min = Math.min(...roiValues);
    merged.roi_max = Math.max(...roiValues);
    merged.roi = merged.roi_min + '% - ' + merged.roi_max + '%';
  }

  if (cities.size > 0) {
    merged.location_coverage = {
      cities: Array.from(cities).slice(0, 50),
    };
  }

  return merged;
}

function splitPolicyTxtByCategory(text) {
  const sections = [];
  const lines = text.split('\n');
  
  const categorySections = [
    { name: 'Normal', keywords: ['1) normal cases', 'normal cases -'] },
    { name: 'BT Surrogate', keywords: ['2) bt surrogate', 'bt surrogate'] },
    { name: 'Home Loan Surrogate', keywords: ['3) home loan surrogate', 'home loan surrogate'] },
    { name: 'Auto Loan Surrogate', keywords: ['4) auto loan surrogate', 'auto loan surrogate'] },
    { name: 'Banking Surrogate', keywords: ['5) banking surrogate', 'banking surrogate'] },
    { name: '-1 CIBIL/Owned House', keywords: ['6) -1 cibil', '-1 cibil score with owned house'] },
  ];

  const sectionStarts = [];
  
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    for (const cat of categorySections) {
      if (cat.keywords.some(kw => lineLower.includes(kw))) {
        sectionStarts.push({ lineIndex: i, category: cat.name });
        break;
      }
    }
  }

  if (sectionStarts.length === 0) {
    return [{ category: null, text: text }];
  }

  const globalHeader = lines.slice(0, sectionStarts[0].lineIndex).join('\n');
  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i].lineIndex;
    const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].lineIndex : lines.length;
    let sectionText = lines.slice(start, end).join('\n');
    if (i === 0 && globalHeader.trim()) {
      sectionText = globalHeader + '\n' + sectionText;
    }
    sections.push({
      category: sectionStarts[i].category,
      text: sectionText,
    });
  }

  return sections;
}

async function buildAbflReviewRules() {
  const client = await pool.connect();
  const stats = {
    startedAt: new Date(),
    completedAt: null,
    groupsCreated: 0,
    rulesCreated: 0,
    attachmentsLinked: 0,
    oldRulesDeleted: 0,
    oldVersionsDeleted: 0,
    validationWarnings: 0,
    validationDetails: [],
  };

  try {
    const bankResult = await client.query('SELECT id, name, code FROM banks WHERE name = $1', ['Aditya Birla Finance']);
    if (bankResult.rowCount === 0) {
      console.error('Aditya Birla Finance bank not found');
      return stats;
    }
    const bank = bankResult.rows[0];

    const filesResult = await client.query(
      'SELECT id, file_name, extracted_text FROM bank_policy_files WHERE bank_id = $1 AND extracted_text IS NOT NULL',
      [bank.id]
    );

    console.log(`Processing ${filesResult.rowCount} files for ${bank.name}`);

    // Only create rules for these 6 categories
    const allowedCategories = new Set([
      'Normal',
      'BT Surrogate',
      'Home Loan Surrogate',
      'Auto Loan Surrogate',
      'Banking Surrogate',
      '-1 CIBIL/Owned House',
    ]);

    // Collect all text segments with their assigned categories
    const categorizedSegments = [];

    // Special handling for Policy.txt - split by sections
    const policyTxt = filesResult.rows.find(f => f.file_name === 'Policy.txt');
    if (policyTxt) {
      const sections = splitPolicyTxtByCategory(policyTxt.extracted_text);
      for (const section of sections) {
        if (section.category && allowedCategories.has(section.category)) {
          categorizedSegments.push({
            sourceFileId: policyTxt.id,
            sourceFileName: policyTxt.file_name,
            text: section.text,
            category: section.category,
          });
        }
      }
    }

    // For other files, use extractRulesFromText to detect category
    for (const file of filesResult.rows) {
      if (file.file_name === 'Policy.txt') continue;
      
      const extracted = extractRulesFromText(file.extracted_text, file.file_name, null);
      if (extracted && extracted.category && allowedCategories.has(extracted.category)) {
        categorizedSegments.push({
          sourceFileId: file.id,
          sourceFileName: file.file_name,
          text: file.extracted_text,
          category: extracted.category,
        });
      }
    }

    // Delete existing review rules and versions for this bank
    const oldVersions = await client.query(
      'SELECT id FROM policy_versions WHERE bank_id = $1 AND status = $2',
      [bank.id, 'review']
    );
    const oldVersionIds = oldVersions.rows.map(r => r.id);

    if (oldVersionIds.length > 0) {
      await client.query(
        'UPDATE bank_policy_files SET policy_version_id = NULL WHERE policy_version_id = ANY($1::int[])',
        [oldVersionIds]
      );
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

    // Group segments by category
    const categoryGroups = new Map();
    for (const seg of categorizedSegments) {
      if (!categoryGroups.has(seg.category)) {
        categoryGroups.set(seg.category, []);
      }
      categoryGroups.get(seg.category).push(seg);
    }

    // Create new rules for each category
    for (const [category, segments] of categoryGroups.entries()) {
      const extractedRules = [];
      for (const seg of segments) {
        const extracted = extractRulesFromText(seg.text, seg.sourceFileName, null, seg.category);
        if (extracted) {
          const validated = normalizeAndValidateRules(extracted, seg.text);
          if (validated.validationLog.length > 0) {
            console.log(`\n[Validation] ${seg.sourceFileName} (${category}):`);
            validated.validationLog.forEach(v => {
              console.log(`  - ${v.field}: ${v.reason} (value: ${v.originalValue})`);
            });
            stats.validationWarnings += validated.validationLog.length;
            validated.validationLog.forEach(v => {
              stats.validationDetails.push({
                category,
                sourceFile: seg.sourceFileName,
                field: v.field,
                reason: v.reason,
                originalValue: v.originalValue,
                sourceSnippet: v.sourceSnippet,
              });
            });
          }
          extractedRules.push({ ...validated.rules, sourceFileId: seg.sourceFileId, sourceFileName: seg.sourceFileName, sourceText: seg.text });
        }
      }

      if (extractedRules.length === 0) continue;

      const merged = aggregateGroupRules(extractedRules);
      const loanType = extractedRules[0].loan_type || 'Personal';
      
      // Validate merged rules against combined source text
      const combinedSourceText = extractedRules.map(r => r.sourceText).join('\n\n');
      const finalValidation = normalizeAndValidateRules(merged, combinedSourceText);
      if (finalValidation.validationLog.length > 0) {
        console.log(`\n[Validation] Merged ${category} rules:`);
        finalValidation.validationLog.forEach(v => {
          console.log(`  - ${v.field}: ${v.reason} (value: ${v.originalValue})`);
        });
        stats.validationWarnings += finalValidation.validationLog.length;
        finalValidation.validationLog.forEach(v => {
          stats.validationDetails.push({
            category,
            sourceFile: 'merged',
            field: v.field,
            reason: v.reason,
            originalValue: v.originalValue,
            sourceSnippet: v.sourceSnippet,
          });
        });
      }
      
      const validatedMerged = finalValidation.rules;
      const versionLabel = await getNextVersionLabel(client, bank.id, loanType);

      const versionRes = await client.query(
        `INSERT INTO policy_versions (bank_id, loan_type, version, status, notes, created_by)
         VALUES ($1, $2, $3, 'review', $4, $5) RETURNING id`,
        [bank.id, loanType, versionLabel, `${merged.category || category} policy for ${bank.name}`, null]
      );
      const policyVersionId = versionRes.rows[0].id;
      stats.groupsCreated++;

      const ruleRes = await client.query(
        `INSERT INTO policy_rules (
          policy_version_id, loan_type, category, min_cibil, max_cibil, min_salary, max_salary,
          employment_type, min_age, max_age, min_loan_amount, max_loan_amount,
          min_tenure_months, max_tenure_months, foir_percent, roi, other_rules, location_rules, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'review')
        RETURNING id`,
        [
          policyVersionId, loanType, validatedMerged.category ? String(validatedMerged.category).slice(0, 200) : null,
          validatedMerged.min_cibil, validatedMerged.max_cibil, validatedMerged.min_salary, validatedMerged.max_salary,
          validatedMerged.employment_type, validatedMerged.min_age, validatedMerged.max_age, validatedMerged.min_loan_amount, validatedMerged.max_loan_amount,
          validatedMerged.min_tenure_months, validatedMerged.max_tenure_months,
          validatedMerged.foir_percent,
          validatedMerged.roi_min || null,
          validatedMerged.roi ? JSON.stringify({ roi_range: validatedMerged.roi, roi_min: validatedMerged.roi_min, roi_max: validatedMerged.roi_max }) : null,
          validatedMerged.location_coverage ? JSON.stringify(validatedMerged.location_coverage) : null,
        ]
      );
      const policyRuleId = ruleRes.rows[0].id;
      stats.rulesCreated++;

      // Link source files as attachments and update bank_policy_files
      const linkedFileIds = new Set();
      for (const rule of extractedRules) {
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

      console.log(`Created ${category}: ${validatedMerged.category || category} (${loanType}) - ${extractedRules.length} files merged`);
    }

    stats.completedAt = new Date();
    return stats;
  } finally {
    client.release();
    await pool.end();
  }
}

buildAbflReviewRules()
  .then(stats => {
    console.log('\n=== ABFL Review Rules Summary ===');
    console.log(`Groups created:      ${stats.groupsCreated}`);
    console.log(`Rules created:       ${stats.rulesCreated}`);
    console.log(`Attachments linked:  ${stats.attachmentsLinked}`);
    console.log(`Old rules deleted:   ${stats.oldRulesDeleted}`);
    console.log(`Old versions deleted:${stats.oldVersionsDeleted}`);
    console.log(`Validation warnings: ${stats.validationWarnings}`);
    console.log(`Started at:          ${stats.startedAt}`);
    console.log(`Completed at:        ${stats.completedAt}`);
    
    if (stats.validationDetails.length > 0) {
      console.log('\n=== Validation Details ===');
      stats.validationDetails.forEach((v, i) => {
        console.log(`${i + 1}. [${v.category}] ${v.field}: ${v.reason} (value: ${v.originalValue})`);
        console.log(`   Source: ${v.sourceFile}`);
        console.log(`   Snippet: ${v.sourceSnippet.substring(0, 100)}...`);
      });
    }
  })
  .catch(err => {
    console.error('Build ABFL rules failed:', err);
    process.exit(1);
  });
