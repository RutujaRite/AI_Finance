const pool = require('../db');
const fs = require('fs');
const path = require('path');

async function main() {
  const bankCode = 'CHOLA';
  const bankName = 'Cholamandalam Investment & Finance';
  const masterFileName = 'Chola_Master_Policy.txt';
  const sourceFilePath = path.join(__dirname, '..', 'policy-master-files', masterFileName);
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'policies');
  const destFilePath = path.join(uploadDir, masterFileName);

  // Ensure upload directory exists
  await fs.promises.mkdir(uploadDir, { recursive: true });

  // Copy master policy file to uploads
  await fs.promises.copyFile(sourceFilePath, destFilePath);
  console.log('Copied master policy to uploads:', destFilePath);

  const bankRes = await pool.query('SELECT id FROM banks WHERE code = $1 OR name ILIKE $2', [bankCode, bankName]);
  if (bankRes.rowCount === 0) {
    console.error('Bank not found:', bankCode);
    process.exit(1);
  }
  const bankId = bankRes.rows[0].id;
  console.log('Bank ID:', bankId);

  // Get all policy rules for Chola (all loan types)
  const rulesRes = await pool.query(`
    SELECT pr.id, pv.id AS policy_version_id, pv.version, pv.loan_type
    FROM policy_rules pr
    JOIN policy_versions pv ON pv.id = pr.policy_version_id
    WHERE pv.bank_id = $1
    ORDER BY pv.id DESC, pr.id DESC
  `, [bankId]);

  console.log('Chola policy rules (all loan types):', rulesRes.rows.length);

  // Unlink old attachments from these rules
  for (const rule of rulesRes.rows) {
    const unlinkRes = await pool.query('UPDATE policy_attachments SET policy_rule_id = NULL WHERE policy_rule_id = $1', [rule.id]);
    if (unlinkRes.rowCount > 0) {
      console.log(`Unlinked ${unlinkRes.rowCount} old attachments from rule ${rule.id} (${rule.version} - ${rule.loan_type})`);
    }
  }

  // Also decouple old bank_policy_files from versions so importer won't auto-relink them
  const versionIds = rulesRes.rows.map(r => r.policy_version_id);
  if (versionIds.length > 0) {
    const decoupleRes = await pool.query(
      'UPDATE bank_policy_files SET policy_version_id = NULL WHERE bank_id = $1 AND policy_version_id = ANY($2::int[])',
      [bankId, versionIds]
    );
    console.log('Decoupled bank_policy_files from versions:', decoupleRes.rowCount);
  }

  // Read master policy text
  const masterText = fs.readFileSync(destFilePath, 'utf8');
  const fileStats = fs.statSync(destFilePath);
  const relativePath = 'uploads/policies/' + masterFileName;

  // Insert new master attachment linked to the latest Personal rule
  const attachmentRes = await pool.query(`
    INSERT INTO policy_attachments (file_name, file_path, file_type, file_size_bytes, extracted_text, uploaded_by, policy_rule_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, file_name, file_path
  `, [
    masterFileName,
    relativePath,
    'text/plain',
    fileStats.size,
    masterText,
    1,
    rulesRes.rows[0]?.id || null
  ]);

  console.log('Inserted master attachment:', attachmentRes.rows[0]);

  // Also register in bank_policy_files with is_master_policy metadata
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
    console.log('Updated existing bank_policy_files record:', existingBpf.rows[0].id);
  } else {
    const bpfRes = await pool.query(`
      INSERT INTO bank_policy_files 
        (bank_id, file_name, file_path, file_type, file_size_bytes, uploaded_by, description, extracted_text, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      bankId,
      masterFileName,
      relativePath,
      'text/plain',
      fileStats.size,
      1,
      'Master policy rulebook for Cholamandalam Personal Loan',
      masterText,
      JSON.stringify({ is_master_policy: true, is_unified_text: true, document_type: 'Main Eligibility Policy', is_active: true })
    ]);
    console.log('Inserted bank_policy_files record:', bpfRes.rows[0].id);
  }

  // Deactivate all old Chola source documents in bank_policy_files (do NOT delete physical files)
  const deactivateRes = await pool.query(
    `UPDATE bank_policy_files 
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb 
     WHERE bank_id = $2 AND file_name != $3`,
    [JSON.stringify({ is_active: false }), bankId, masterFileName]
  );
  console.log('Deactivated old bank_policy_files records:', deactivateRes.rowCount);

  // Verification
  const verifyRes = await pool.query(`
    SELECT pr.id, b.code AS bank_code, pa.id AS attachment_id, pa.file_name, pa.policy_rule_id, pv.loan_type
    FROM policy_rules pr
    JOIN policy_versions pv ON pv.id = pr.policy_version_id
    JOIN banks b ON b.id = pv.bank_id
    LEFT JOIN policy_attachments pa ON pa.policy_rule_id = pr.id
    WHERE pv.bank_id = $1
    ORDER BY pr.id, pa.id
  `, [bankId]);

  console.log('\n=== Verification: Chola Policy Rules (all loan types) ===');
  const attachments = verifyRes.rows.filter(r => r.attachment_id);
  console.log('Total attachments linked:', attachments.length);
  attachments.forEach(a => {
    console.log(`  Rule ${a.id} (${a.loan_type}) -> Attachment ${a.attachment_id}: ${a.file_name}`);
  });

  if (attachments.length === 1 && attachments[0].file_name === masterFileName) {
    console.log('\n✅ SUCCESS: Chola Bank has exactly one policy document:', masterFileName);
  } else {
    console.log('\n⚠️ WARNING: Expected exactly one attachment named', masterFileName);
  }

  // Verify bank_policy_files metadata
  const masterBpf = await pool.query(
    'SELECT id, file_name, metadata FROM bank_policy_files WHERE bank_id = $1 AND file_name = $2',
    [bankId, masterFileName]
  );
  if (masterBpf.rowCount > 0) {
    console.log('\nbank_policy_files master record:', masterBpf.rows[0]);
  }

  // Verify no other active documents remain for Chola
  const otherActive = await pool.query(
    `SELECT id, file_name, metadata FROM bank_policy_files WHERE bank_id = $1 AND file_name != $2 AND (metadata->>'is_active')::boolean IS DISTINCT FROM false`,
    [bankId, masterFileName]
  );
  if (otherActive.rowCount === 0) {
    console.log('\n✅ No other active documents remain for CHOLA.');
  } else {
    console.log('\n⚠️ WARNING: Other active documents found for CHOLA:', otherActive.rows);
  }
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
