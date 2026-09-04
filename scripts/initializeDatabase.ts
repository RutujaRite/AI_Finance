/**
 * Database Initialization Script for CreditWise AI / Next.js
 * Creates all necessary tables if they do not exist.
 * Run with: npx tsx scripts/initializeDatabase.ts
 */

import pool from "../lib/db";

const INIT_QUERIES = [
  // 1. Users table
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    mobile VARCHAR(50),
    dob DATE,
    gender VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    pincode VARCHAR(20),
    occupation VARCHAR(100),
    employment_type VARCHAR(100),
    monthly_income NUMERIC,
    marital_status VARCHAR(50),
    residence_type VARCHAR(50),
    pan VARCHAR(20),
    aadhar VARCHAR(20),
    profile_photo_path TEXT,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 2. Bank Managers table
  `CREATE TABLE IF NOT EXISTS bank_managers (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    manager_name VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(50),
    email VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    address TEXT,
    branch_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 3. Bank Manager Files table
  `CREATE TABLE IF NOT EXISTS bank_manager_files (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 4. Company Basic Info table
  `CREATE TABLE IF NOT EXISTS company_basic_info (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) UNIQUE NOT NULL,
    industry VARCHAR(255),
    address TEXT,
    website TEXT,
    cin VARCHAR(50),
    incorporation_date VARCHAR(50),
    listing_status VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 5. Company Financial Info table
  `CREATE TABLE IF NOT EXISTS company_financial_info (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) UNIQUE NOT NULL,
    employees VARCHAR(100),
    turnover VARCHAR(100),
    profit_status VARCHAR(100),
    last_agm VARCHAR(100),
    profit_history TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 6. Bank Company Data (mapping)
  `CREATE TABLE IF NOT EXISTS bank_company_data (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    sr_no VARCHAR(50),
    company_category VARCHAR(100),
    other_info TEXT,
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 7. Banks table
  `CREATE TABLE IF NOT EXISTS banks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 8. Policy Versions table
  `CREATE TABLE IF NOT EXISTS policy_versions (
    id SERIAL PRIMARY KEY,
    bank_id INT REFERENCES banks(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    effective_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 9. Policy Rules table
  `CREATE TABLE IF NOT EXISTS policy_rules (
    id SERIAL PRIMARY KEY,
    policy_version_id INT REFERENCES policy_versions(id) ON DELETE CASCADE,
    loan_type VARCHAR(100),
    category VARCHAR(100),
    min_cibil NUMERIC,
    max_cibil NUMERIC,
    min_salary NUMERIC,
    max_salary NUMERIC,
    employment_type VARCHAR(100),
    min_age INT,
    max_age INT,
    min_loan_amount NUMERIC,
    max_loan_amount NUMERIC,
    min_tenure_months INT,
    max_tenure_months INT,
    foir_percent NUMERIC,
    roi VARCHAR(100),
    processing_fee_percent NUMERIC,
    processing_fee_flat NUMERIC,
    company_rules JSONB,
    location_rules JSONB,
    other_rules JSONB,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 10. Bank Policy Files table
  `CREATE TABLE IF NOT EXISTS bank_policy_files (
    id SERIAL PRIMARY KEY,
    bank_id INT REFERENCES banks(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    extracted_text TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // 11. EMI Records table
  `CREATE TABLE IF NOT EXISTS emi_records (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    loan_amount NUMERIC NOT NULL,
    interest_rate NUMERIC NOT NULL,
    tenure_months INT NOT NULL,
    monthly_emi NUMERIC NOT NULL,
    total_interest NUMERIC NOT NULL,
    total_payment NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
];

async function initializeDatabase() {
  console.log("Starting CreditWise AI Database Initialization...");
  const client = await pool.connect();
  try {
    for (const query of INIT_QUERIES) {
      await client.query(query);
    }
    console.log("Database initialized successfully. All tables verified/created.");
  } catch (err) {
    console.error("Database initialization failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase();
