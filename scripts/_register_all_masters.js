/**
 * PURPOSE: Registers and links all master policy text rulebooks to bank records in PostgreSQL.
 * USAGE: node scripts/_register_all_masters.js
 */
const pool = require('../db');
const fs = require('fs');
const path = require('path');

const BANK_MASTER_FILES = {
  'ABFL': 'ABFL_Master_Policy.txt',
  'AXIS': 'AXIS_Master_Policy.txt',
  'AFL': 'Axis_Finance_Master_Policy.txt',
  'BAJAJ_FINSERV': 'Bajaj_Finserv_Master_Policy.txt',
  'BAJAJ_MARKETS': 'Bajaj_Markets_Master_Policy.txt',
  'BANDHAN': 'Bandhan_Bank_Master_Policy.txt',
  'CHOLA': 'Chola_Master_Policy.txt',
  'FIBE': 'Fibe_Master_Policy.txt',
  'FINNABLE': 'Finnable_Credit_Master_Policy.txt',
  'HDFC': 'HDFC_Bank_Master_Policy.txt',
  'HOME_LOAN': 'Home_Loan_Services_Master_Policy.txt',
  'ICICI': 'ICICI_Bank_Master_Policy.txt',
  'IDFC': 'IDFC_FIRST_Bank_Master_Policy.txt',
  'INDUSIND': 'IndusInd_Bank_Master_Policy.txt',
  'KOTAK': 'Kotak_Mahindra_Bank_Master_Policy.txt',
  'LTF': 'LT_Finance_Master_Policy.txt',
  'PIRAMAL': 'Piramal_Capital__Housing_Finance_Master_Policy.txt',
  'POONAWALLA': 'Poonawalla_Fincorp_Master_Policy.txt',
  'SBM': 'SBM_Bank_India_Master_Policy.txt',
  'SMFG': 'SMFG_India_Credit_Fullerton_Master_Policy.txt',
  'TATA_CAPITAL': 'Tata_Capital_Master_Policy.txt',
  'UTKARSH': 'Utkarsh_Small_Finance_Bank_Master_Policy.txt',
  'YES_BANK': 'Yes_Bank_Master_Policy.txt'
};

async function registerBank(bankCode, bankName, masterFileName) {
  const sourceFilePath = path.join(__dirname, '..', 'policy-master-files', masterFileName);
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'policies');
  const destFilePath = path.join(uploadDir, masterFileName);

  if (!fs.existsSync(sourceFilePath)) {
    console.log(`  SKIP: Master file not found: ${masterFileName}`);
    return false;
  }

  await fs.promises.mkdir(uploadDir, { recursive: true });
  await fs.promises.copyFile(sourceFilePath, destFilePath);

  const bankRes = await pool.query('SELECT id FROM banks WHERE code = $1 OR name ILIKE $2', [bankCode, bankName]);
  if (bankRes.rowCount === 0) {
    console.log(`  SKIP: Bank not found: ${bankCode}`);
    return false;
  }
  const bankId = bankRes.rows[0].id;

  const rulesRes = await pool.query(`
    SELECT pr.id, pv.id AS policy_version_id, pv.version, pv.loan_type
    FROM policy_rules pr
    JOIN policy_versions pv ON pv.id = pr.policy_version_id
    WHERE pv.bank_id = $1
    ORDER BY pv.id DESC, pr.id DESC
  `, [bankId]);

  for (const rule of rulesRes.rows) {
    await pool.query('UPDATE policy_attachments SET policy_rule_id = NULL WHERE policy_rule_id = $1', [rule.id]);
  }

  const versionIds = rulesRes.rows.map(r => r.policy_version_id);
  if (versionIds.length > 0) {
    await pool.query(
      'UPDATE bank_policy_files SET policy_version_id = NULL WHERE bank_id = $1 AND policy_version_id = ANY($2::int[])',
      [bankId, versionIds]
    );
  }

  const masterText = fs.readFileSync(destFilePath, 'utf8');
  const fileStats = fs.statSync(destFilePath);
  const relativePath = 'uploads/policies/' + masterFileName;

  const attachmentRes = await pool.query(`
    INSERT INTO policy_attachments (file_name, file_path, file_type, file_size_bytes, extracted_text, uploaded_by, policy_rule_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, file_name
  `, [
    masterFileName,
    relativePath,
    'text/plain',
    fileStats.size,
    masterText,
    1,
    rulesRes.rows[0]?.id || null
  ]);

  const existingBpf = await pool.query(
    'SELECT id FROM bank_policy_files WHERE bank_id = $1 AND file_name = $2',
    [bankId, masterFileName]
  );

  if (existingBpf.rowCount > 0) {
    await pool.query(
      `UPDATE bank_policy_files 
       SET extracted_text = $1, metadata = $2, file_path = $3, file_type = $4, file_size_bytes = $5
       WHERE id = $6`,
      [
        masterText,
        JSON.stringify({ is_master_policy: true, is_unified_text: true, document_type: 'Main Eligibility Policy', is_active: true }),
        relativePath,
        'text/plain',
        fileStats.size,
        existingBpf.rows[0].id
      ]
    );
  } else {
    await pool.query(`
      INSERT INTO bank_policy_files 
        (bank_id, file_name, file_path, file_type, file_size_bytes, uploaded_by, description, extracted_text, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      bankId,
      masterFileName,
      relativePath,
      'text/plain',
      fileStats.size,
      1,
      `Master policy rulebook for ${bankName}`,
      masterText,
      JSON.stringify({ is_master_policy: true, is_unified_text: true, document_type: 'Main Eligibility Policy', is_active: true })
    ]);
  }

  const deactivateRes = await pool.query(
    `UPDATE bank_policy_files 
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb 
     WHERE bank_id = $2 AND file_name != $3`,
    [JSON.stringify({ is_active: false }), bankId, masterFileName]
  );

  console.log(`  ${bankName}: attachment=${attachmentRes.rows[0].id}, deactivated=${deactivateRes.rowCount}`);
  return true;
}

async function main() {
  console.log('Registering master policy files for all banks...\n');

  const banks = await pool.query('SELECT id, code, name FROM banks ORDER BY id');

  for (const bank of banks.rows) {
    const masterFileName = BANK_MASTER_FILES[bank.code];
    if (!masterFileName) {
      console.log(`\n${bank.code}: SKIP - no master file mapping`);
      continue;
    }
    console.log(`\n${bank.code} (${bank.name}):`);
    await registerBank(bank.code, bank.name, masterFileName);
  }

  console.log('\n=== Verification ===');
  for (const bank of banks.rows) {
    const masterFileName = BANK_MASTER_FILES[bank.code];
    if (!masterFileName) continue;

    const verifyRes = await pool.query(`
      SELECT pr.id, b.code AS bank_code, pa.id AS attachment_id, pa.file_name, pv.loan_type
      FROM policy_rules pr
      JOIN policy_versions pv ON pv.id = pr.policy_version_id
      JOIN banks b ON b.id = pv.bank_id
      LEFT JOIN policy_attachments pa ON pa.policy_rule_id = pr.id
      WHERE pv.bank_id = $1
      ORDER BY pr.id, pa.id
    `, [bank.id]);

    const attachments = verifyRes.rows.filter(r => r.attachment_id);
    const status = attachments.length === 1 && attachments[0].file_name === masterFileName ? '✅' : '⚠️';
    console.log(`${status} ${bank.code}: ${attachments.length} attachment(s) - ${attachments[0]?.file_name || 'NONE'}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
