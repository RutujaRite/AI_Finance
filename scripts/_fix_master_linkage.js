const pool = require('../db');

async function main() {
  const fixes = [
    { bankCode: 'HOME_LOAN', masterFileName: 'Home_Loan_Services_Master_Policy.txt', personalRuleId: 585 },
    { bankCode: 'INDUSIND', masterFileName: 'IndusInd_Bank_Master_Policy.txt', personalRuleId: 596 },
    { bankCode: 'LTF', masterFileName: 'LT_Finance_Master_Policy.txt', personalRuleId: 607 },
    { bankCode: 'SBM', masterFileName: 'SBM_Bank_India_Master_Policy.txt', personalRuleId: 619 },
    { bankCode: 'YES_BANK', masterFileName: 'Yes_Bank_Master_Policy.txt', personalRuleId: 637 }
  ];

  for (const fix of fixes) {
    const bankRes = await pool.query('SELECT id FROM banks WHERE code = $1', [fix.bankCode]);
    if (bankRes.rowCount === 0) {
      console.log(`SKIP: Bank not found: ${fix.bankCode}`);
      continue;
    }
    const bankId = bankRes.rows[0].id;

    const attRes = await pool.query(
      'SELECT id FROM policy_attachments WHERE file_name = $1 AND policy_rule_id = ANY(SELECT id FROM policy_rules WHERE policy_version_id = ANY(SELECT id FROM policy_versions WHERE bank_id = $2))',
      [fix.masterFileName, bankId]
    );

    if (attRes.rowCount === 0) {
      console.log(`SKIP: No attachment found for ${fix.bankCode}`);
      continue;
    }

    const attachmentId = attRes.rows[0].id;

    await pool.query('UPDATE policy_attachments SET policy_rule_id = NULL WHERE id = $1', [attachmentId]);
    await pool.query('UPDATE policy_attachments SET policy_rule_id = $1 WHERE id = $2', [fix.personalRuleId, attachmentId]);

    console.log(`FIXED ${fix.bankCode}: moved ${fix.masterFileName} from non-Personal rule to rule ${fix.personalRuleId}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
