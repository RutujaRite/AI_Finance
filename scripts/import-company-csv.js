/**
 * PURPOSE: Bulk imports corporate company approval lists from CSV files into bank_company_data.
 * USAGE: node scripts/import-company-csv.js
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

const SOURCE_DIRECTORY = 'C:/Users/Akshada/OneDrive/Pictures/Documents/Desktop/company list';
const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'login_db',
  password: 'Akshuu@24',
  port: 5432,
});

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildRecordKey(bankName, companyName, companyCategory, srNo) {
  return [
    normalizeValue(bankName).toLowerCase(),
    normalizeValue(companyName).toLowerCase(),
    normalizeValue(companyCategory).toLowerCase(),
    String(srNo || '').trim(),
  ].join('|');
}

async function ensureImportTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS company_import_runs (
      id SERIAL PRIMARY KEY,
      source_directory VARCHAR(500) NOT NULL,
      started_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      total_files INTEGER DEFAULT 0,
      total_rows INTEGER DEFAULT 0,
      imported_rows INTEGER DEFAULT 0,
      skipped_rows INTEGER DEFAULT 0,
      duplicates_skipped INTEGER DEFAULT 0,
      status VARCHAR(30) DEFAULT 'pending'
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS company_records (
      id SERIAL PRIMARY KEY,
      import_run_id INTEGER REFERENCES company_import_runs(id) ON DELETE CASCADE,
      bank_name VARCHAR(255) NOT NULL,
      company_name TEXT NOT NULL,
      company_category VARCHAR(255),
      other_info TEXT,
      sr_no INTEGER,
      source_file VARCHAR(255),
      record_key VARCHAR(512) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function insertRun(client, sourceDirectory) {
  const result = await client.query(
    `INSERT INTO company_import_runs (source_directory, status)
     VALUES ($1, $2)
     RETURNING id`,
    [sourceDirectory, 'running']
  );
  return result.rows[0].id;
}

async function finalizeRun(client, runId, stats) {
  await client.query(
    `UPDATE company_import_runs
     SET completed_at = NOW(),
         total_files = $2,
         total_rows = $3,
         imported_rows = $4,
         skipped_rows = $5,
         duplicates_skipped = $6,
         status = $7
     WHERE id = $1`,
    [
      runId,
      stats.totalFiles,
      stats.totalRows,
      stats.importedRows,
      stats.skippedRows,
      stats.duplicatesSkipped,
      stats.status,
    ]
  );
}

function parseCsvFile(filePath) {
  const rawData = fs.readFileSync(filePath, 'utf8');
  return parse(rawData, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });
}

async function importCsvFiles() {
  if (!fs.existsSync(SOURCE_DIRECTORY)) {
    throw new Error(`Source directory not found: ${SOURCE_DIRECTORY}`);
  }

  const files = fs.readdirSync(SOURCE_DIRECTORY)
    .filter((file) => file.toLowerCase().endsWith('.csv'))
    .sort();

  const stats = {
    totalFiles: files.length,
    totalRows: 0,
    importedRows: 0,
    skippedRows: 0,
    duplicatesSkipped: 0,
    status: 'completed',
  };

  const client = await pool.connect();

  try {
    await ensureImportTables(client);
    await client.query('BEGIN');
    const runId = await insertRun(client, SOURCE_DIRECTORY);

    const recordsToInsert = [];
    const seenRecordKeys = new Set();

    for (const file of files) {
      const filePath = path.join(SOURCE_DIRECTORY, file);
      let rows;

      try {
        rows = parseCsvFile(filePath);
      } catch (error) {
        stats.skippedRows += 1;
        console.warn(`Skipping unparseable file: ${file} (${error.message})`);
        continue;
      }

      for (const row of rows) {
        stats.totalRows += 1;

        const bankName = normalizeValue(row.BANK_NAME || row.bank_name || row.Bank_Name || row['BANK_NAME']);
        const companyName = normalizeValue(row.COMPANY_NAME || row.company_name || row.Company_Name || row['COMPANY_NAME']);
        const companyCategory = normalizeValue(row.COMPANY_CATEGORY || row.company_category || row.Company_Category || row['COMPANY_CATEGORY']);
        const otherInfo = normalizeValue(row.OTHER_INFO || row.other_info || row.Other_Info || row['OTHER_INFO']);
        const srNoValue = normalizeValue(row.SR_NO || row.sr_no || row.Sr_No || row['SR_NO']);
        const srNo = Number.parseInt(srNoValue, 10);

        if (!bankName || !companyName) {
          stats.skippedRows += 1;
          continue;
        }

        const recordKey = buildRecordKey(bankName, companyName, companyCategory, Number.isFinite(srNo) ? srNo : 0);

        if (seenRecordKeys.has(recordKey)) {
          stats.duplicatesSkipped += 1;
          continue;
        }

        seenRecordKeys.add(recordKey);
        recordsToInsert.push({
          import_run_id: runId,
          bank_name: bankName,
          company_name: companyName,
          company_category: companyCategory || null,
          other_info: otherInfo || null,
          sr_no: Number.isFinite(srNo) ? srNo : null,
          source_file: file,
          record_key: recordKey,
        });
      }
    }

    if (recordsToInsert.length > 0) {
      const existingResult = await client.query(
        'SELECT record_key FROM company_records WHERE record_key = ANY($1)',
        [recordsToInsert.map((record) => record.record_key)]
      );

      const existingKeys = new Set(existingResult.rows.map((row) => row.record_key));
      const validRecords = [];

      for (const record of recordsToInsert) {
        if (existingKeys.has(record.record_key)) {
          stats.duplicatesSkipped += 1;
          continue;
        }
        validRecords.push(record);
      }

      for (const record of validRecords) {
        await client.query(
          `INSERT INTO company_records (
            import_run_id,
            bank_name,
            company_name,
            company_category,
            other_info,
            sr_no,
            source_file,
            record_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (record_key) DO NOTHING`,
          [
            record.import_run_id,
            record.bank_name,
            record.company_name,
            record.company_category,
            record.other_info,
            record.sr_no,
            record.source_file,
            record.record_key,
          ]
        );
      }
    }

    stats.importedRows = await client.query('SELECT COUNT(*) AS count FROM company_records WHERE import_run_id = $1', [runId]).then((result) => Number(result.rows[0].count));

    await finalizeRun(client, runId, stats);
    await client.query('COMMIT');
    console.log(`Import finished. Files: ${stats.totalFiles}, Rows processed: ${stats.totalRows}, Imported: ${stats.importedRows}, Duplicates skipped: ${stats.duplicatesSkipped}, Rows skipped: ${stats.skippedRows}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

importCsvFiles()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Company CSV import failed:', error);
    process.exit(1);
  });
