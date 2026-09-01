const fs = require("fs");
const path = require("path");
const pool = require("../db");
const profilePhotoDirectory = path.join(
  __dirname,
  "..",
  "public",
  "uploads",
  "profile-photos"
);

const policyUploadDirectory = path.join(
  __dirname,
  "..",
  "public",
  "uploads",
  "policies"
);
async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await fs.promises.mkdir(profilePhotoDirectory, { recursive: true });
    await fs.promises.mkdir(policyUploadDirectory, { recursive: true });

    // Core users table (create if missing)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    // Add optional profile columns safely (won't drop any data)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS mobile VARCHAR(30),
      ADD COLUMN IF NOT EXISTS dob DATE,
      ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS pincode VARCHAR(20),
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
      ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
      ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS monthly_income NUMERIC,
      ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30),
      ADD COLUMN IF NOT EXISTS residence_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS pan VARCHAR(20),
      ADD COLUMN IF NOT EXISTS aadhar VARCHAR(30),
      ADD COLUMN IF NOT EXISTS profile_photo_path VARCHAR(255);
    `);

    // Table to save EMI calculations per user
    await client.query(`
      CREATE TABLE IF NOT EXISTS emi_calculations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        loan_type VARCHAR(100),
        loan_amount NUMERIC,
        annual_rate NUMERIC,
        processing_fee_percent NUMERIC,
        term_months INTEGER,
        months_or_years VARCHAR(10),
        monthly_emi NUMERIC,
        total_interest NUMERIC,
        total_payment NUMERIC,
        processing_fee_amount NUMERIC,
        schedule JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS assistant_conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) DEFAULT 'Loan Assistant',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS assistant_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS assistant_conversation_states (
        conversation_id INTEGER PRIMARY KEY REFERENCES assistant_conversations(id) ON DELETE CASCADE,
        state JSONB NOT NULL DEFAULT '{}'::jsonb,
        expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '30 minutes'
      );
    `);

    const existingAdmin = await client.query(
      "SELECT * FROM users WHERE email = $1",
      ["admin@gmail.com"]
    );

    if (existingAdmin.rowCount === 0) {
      await client.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ["Admin", "admin@gmail.com", "newpass123", "admin"]
      );
    } else if ((existingAdmin.rows[0].role || 'user') !== 'admin') {
      await client.query(
        "UPDATE users SET role = 'admin' WHERE email = $1",
        ["admin@gmail.com"]
      );
    }

    // Loan policies managed from the admin Policy section
    await client.query(`
      CREATE TABLE IF NOT EXISTS loan_policies (
        id SERIAL PRIMARY KEY,
        loan_type VARCHAR(50) NOT NULL,
        policy_name VARCHAR(150) NOT NULL,
        min_amount NUMERIC NOT NULL DEFAULT 0,
        max_amount NUMERIC NOT NULL DEFAULT 0,
        interest_rate NUMERIC NOT NULL DEFAULT 0,
        processing_fee_percent NUMERIC NOT NULL DEFAULT 0,
        tenure_months INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const policyCount = await client.query("SELECT COUNT(*)::int AS c FROM loan_policies");
    if (policyCount.rows[0].c === 0) {
      const seedPolicies = [
        ['Personal', 'Personal Loan Policy', 10000, 4000000, 10.5, 2.0, 60, 'Unsecured personal loans for salaried and self-employed applicants.', true],
        ['Home', 'Home Loan Policy', 500000, 100000000, 8.5, 0.5, 360, 'Long-tenure housing finance with competitive fixed and floating rates.', true],
        ['Auto', 'Auto Loan Policy', 50000, 20000000, 9.0, 1.0, 84, 'New and used vehicle financing across major manufacturers.', true],
        ['Education', 'Education Loan Policy', 50000, 10000000, 7.5, 1.0, 180, 'Domestic and overseas education financing with moratorium options.', true]
      ];
      for (const p of seedPolicies) {
        await client.query(
          `INSERT INTO loan_policies (loan_type, policy_name, min_amount, max_amount, interest_rate, processing_fee_percent, tenure_months, description, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          p
        );
      }
    }
    // Bank Policy Management tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS banks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS policy_sources (
        id SERIAL PRIMARY KEY,
        bank_id INTEGER REFERENCES banks(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000),
        file_type VARCHAR(50),
        file_size_bytes BIGINT DEFAULT 0,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT NOW(),
        description TEXT,
        metadata JSONB
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS policy_versions (
        id SERIAL PRIMARY KEY,
        bank_id INTEGER REFERENCES banks(id) ON DELETE CASCADE,
        source_id INTEGER REFERENCES policy_sources(id),
        version VARCHAR(100) NOT NULL,
        effective_from DATE,
        effective_to DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE policy_versions ADD COLUMN IF NOT EXISTS loan_type VARCHAR(50);
    `);

    // Migrate any legacy version formats (e.g. '1.0', '1.1') to 'V1', 'V2', 'V3...'
    const legacyVersions = await client.query(`SELECT id, version FROM policy_versions ORDER BY id ASC`);
    for (const row of legacyVersions.rows) {
      const v = String(row.version || '').trim();
      if (!/^V\d+$/i.test(v)) {
        const numMatch = v.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0], 10) : 1;
        const normalized = `V${num || 1}`;
        await client.query(`UPDATE policy_versions SET version = $1 WHERE id = $2`, [normalized, row.id]);
      }
    }

    // Ensure only one ACTIVE version per bank + loan_type by archiving duplicates
    await client.query(`
      WITH ranked_active AS (
        SELECT id, bank_id, loan_type,
               ROW_NUMBER() OVER (PARTITION BY bank_id, loan_type ORDER BY id DESC) as rn
        FROM policy_versions
        WHERE status = 'active'
      )
      UPDATE policy_versions
      SET status = 'archived'
      WHERE id IN (
        SELECT id FROM ranked_active WHERE rn > 1
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_active_policy_version 
      ON policy_versions(bank_id, loan_type) 
      WHERE status = 'active';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS policy_rules (
        id SERIAL PRIMARY KEY,
        policy_version_id INTEGER REFERENCES policy_versions(id) ON DELETE CASCADE,
        loan_type VARCHAR(50) NOT NULL,
        min_cibil INTEGER,
        max_cibil INTEGER,
        min_salary NUMERIC,
        max_salary NUMERIC,
        employment_type VARCHAR(100),
        min_age INTEGER,
        max_age INTEGER,
        min_loan_amount NUMERIC,
        max_loan_amount NUMERIC,
        min_tenure_months INTEGER,
        max_tenure_months INTEGER,
        foir_percent NUMERIC,
        roi NUMERIC,
        processing_fee_percent NUMERIC,
        processing_fee_flat NUMERIC,
        company_rules JSONB,
        location_rules JSONB,
        other_rules JSONB,
        source_references JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
    `);

    await client.query(`
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS source_references JSONB;
    `);

    await client.query(`
      ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS category VARCHAR(255);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_policy_files (
        id SERIAL PRIMARY KEY,
        bank_id INTEGER REFERENCES banks(id) ON DELETE CASCADE,
        policy_version_id INTEGER REFERENCES policy_versions(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_type VARCHAR(50),
        file_size_bytes BIGINT DEFAULT 0,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT NOW(),
        description TEXT,
        metadata JSONB,
        extracted_text TEXT,
        extraction_status VARCHAR(20) DEFAULT 'pending',
        extraction_error TEXT,
        extracted_at TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE bank_policy_files ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) DEFAULT 'pending';
    `);

    await client.query(`
      ALTER TABLE bank_policy_files ADD COLUMN IF NOT EXISTS extraction_error TEXT;
    `);

    await client.query(`
      ALTER TABLE bank_policy_files ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP;
    `);

    await client.query(`
      ALTER TABLE bank_policy_files ADD COLUMN IF NOT EXISTS extracted_text TEXT;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS policy_attachments (
        id SERIAL PRIMARY KEY,
        policy_rule_id INTEGER REFERENCES policy_rules(id) ON DELETE CASCADE,
        file_name VARCHAR(500) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_type VARCHAR(50),
        file_size_bytes BIGINT DEFAULT 0,
        extracted_text TEXT,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}
module.exports = initializeDatabase;