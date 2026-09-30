-- ============================================================================
-- CreditWise AI — PostgreSQL Database Schema
-- Database Engine: PostgreSQL 15+ with pgvector extension
-- Target Database: login_db
-- ============================================================================
-- Description:
-- Complete DDL schema definition for CreditWise AI, covering:
-- 1. Extensions (pgvector)
-- 2. User Accounts & KYC Profiles
-- 3. Banks & Institutional Master Records
-- 4. Bank Manager Directory & Corporate Employer Categories
-- 5. Structured Bank Loan Policies, Versions & Rule Sets
-- 6. Master Policy Files & pgvector Semantic Embeddings (Policy RAG)
-- 7. EMI Calculations & Loan Amortization Logs
-- 8. Conversational AI Sessions, Messages & State Memory Persistence
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 2. USER MANAGEMENT & AUTHENTICATION
-- ----------------------------------------------------------------------------
-- Table: users
-- Stores end-user credentials, personal details, employment information, and role.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    mobile VARCHAR(30),
    dob DATE,
    gender VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    pincode VARCHAR(20),
    occupation VARCHAR(100),
    employment_type VARCHAR(50),
    monthly_income NUMERIC(15, 2),
    marital_status VARCHAR(30),
    residence_type VARCHAR(50),
    pan VARCHAR(20),
    aadhar VARCHAR(30),
    profile_photo_path VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- 3. BANKS & INSTITUTIONAL MASTER DATA
-- ----------------------------------------------------------------------------
-- Table: banks
-- Master catalog of participating financial institutions and lending partners.
CREATE TABLE IF NOT EXISTS banks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banks_code ON banks(code);
CREATE INDEX IF NOT EXISTS idx_banks_is_active ON banks(is_active);

-- Table: bank_uploaded_files
-- Audit log of files uploaded for bank-level data ingestion (e.g. company lists).
CREATE TABLE IF NOT EXISTS bank_uploaded_files (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_size BIGINT DEFAULT 0,
    uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: bank_managers
-- Directory of branch managers and sales managers for loan escalation and lead contact.
CREATE TABLE IF NOT EXISTS bank_managers (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Sales Manager',
    phone VARCHAR(100),
    email VARCHAR(255),
    location VARCHAR(255) NOT NULL,
    city VARCHAR(255),
    district VARCHAR(255),
    state VARCHAR(255),
    branch VARCHAR(255),
    employee_code VARCHAR(100),
    extra_info JSONB,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_managers_bank_name ON bank_managers(LOWER(bank_name));
CREATE INDEX IF NOT EXISTS idx_bank_managers_location ON bank_managers(LOWER(location));
CREATE INDEX IF NOT EXISTS idx_bank_managers_city ON bank_managers(LOWER(city));
CREATE INDEX IF NOT EXISTS idx_bank_managers_state ON bank_managers(LOWER(state));
CREATE INDEX IF NOT EXISTS idx_bank_managers_role ON bank_managers(LOWER(role));

-- Table: bank_manager_files
-- Audit tracking of spreadsheet and document uploads for bank manager directory.
CREATE TABLE IF NOT EXISTS bank_manager_files (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT DEFAULT 0,
    uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: bank_company_data
-- Bank-specific corporate company categorizations (e.g. Super CAT A, CAT A, CAT B, etc.).
CREATE TABLE IF NOT EXISTS bank_company_data (
    id SERIAL PRIMARY KEY,
    file_id INT NOT NULL REFERENCES bank_uploaded_files(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    sr_no VARCHAR(100),
    company_category VARCHAR(100),
    other_info TEXT
);

CREATE INDEX IF NOT EXISTS idx_bank_company_name ON bank_company_data(company_name);
CREATE INDEX IF NOT EXISTS idx_bank_company_bank_name ON bank_company_data(bank_name);

-- ----------------------------------------------------------------------------
-- 4. STRUCTURED BANK POLICIES, VERSIONS & RULES
-- ----------------------------------------------------------------------------
-- Table: policy_sources
-- Source documents (PDF, DOCX, TXT) used as base references for policy extraction.
CREATE TABLE IF NOT EXISTS policy_sources (
    id SERIAL PRIMARY KEY,
    bank_id INT REFERENCES banks(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_type VARCHAR(50),
    file_size_bytes BIGINT DEFAULT 0,
    uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_policy_sources_bank_id ON policy_sources(bank_id);

-- Table: policy_versions
-- Versioning for bank credit policies (draft, active, archived).
CREATE TABLE IF NOT EXISTS policy_versions (
    id SERIAL PRIMARY KEY,
    bank_id INT REFERENCES banks(id) ON DELETE CASCADE,
    source_id INT REFERENCES policy_sources(id) ON DELETE SET NULL,
    version VARCHAR(100) NOT NULL,
    effective_from DATE,
    effective_to DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    loan_type VARCHAR(50),
    notes TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policy_versions_bank_id ON policy_versions(bank_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_policy_version ON policy_versions(bank_id, loan_type) WHERE status = 'active';

-- Table: policy_rules
-- Structured eligibility and credit underwriting rules parsed from bank policies.
CREATE TABLE IF NOT EXISTS policy_rules (
    id SERIAL PRIMARY KEY,
    policy_version_id INT REFERENCES policy_versions(id) ON DELETE CASCADE,
    loan_type VARCHAR(50) NOT NULL,
    category VARCHAR(255),
    min_cibil INT,
    max_cibil INT,
    min_salary NUMERIC(15, 2),
    max_salary NUMERIC(15, 2),
    employment_type VARCHAR(100),
    min_age INT,
    max_age INT,
    min_loan_amount NUMERIC(15, 2),
    max_loan_amount NUMERIC(15, 2),
    min_tenure_months INT,
    max_tenure_months INT,
    foir_percent NUMERIC(5, 2),
    roi NUMERIC(5, 2),
    roi_min NUMERIC(5, 2),
    roi_max NUMERIC(5, 2),
    processing_fee_percent NUMERIC(5, 2),
    processing_fee_flat NUMERIC(15, 2),
    company_rules JSONB,
    location_rules JSONB,
    other_rules JSONB,
    source_references JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policy_rules_version_id ON policy_rules(policy_version_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_loan_type ON policy_rules(loan_type);

-- Table: policy_attachments
-- File attachments linked directly to specific policy rules.
CREATE TABLE IF NOT EXISTS policy_attachments (
    id SERIAL PRIMARY KEY,
    policy_rule_id INT REFERENCES policy_rules(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes BIGINT DEFAULT 0,
    extracted_text TEXT,
    uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: loan_policies
-- Simplified catalog of standard loan policy definitions.
CREATE TABLE IF NOT EXISTS loan_policies (
    id SERIAL PRIMARY KEY,
    loan_type VARCHAR(50) NOT NULL,
    policy_name VARCHAR(150) NOT NULL,
    min_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    max_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    processing_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    tenure_months INT NOT NULL DEFAULT 0,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. MASTER POLICY FILES & PGVECTOR EMBEDDINGS (POLICY RAG)
-- ----------------------------------------------------------------------------
-- Table: bank_policy_files
-- Authoritative UI-uploaded policy text files (IDs 1 through 23).
-- Source of truth for RAG chunking and semantic ingestion.
CREATE TABLE IF NOT EXISTS bank_policy_files (
    id SERIAL PRIMARY KEY,
    bank_id INT REFERENCES banks(id) ON DELETE CASCADE,
    policy_version_id INT REFERENCES policy_versions(id) ON DELETE SET NULL,
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_type VARCHAR(50),
    file_size_bytes BIGINT DEFAULT 0,
    uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    metadata JSONB,
    extracted_text TEXT,
    extraction_status VARCHAR(20) DEFAULT 'pending',
    extraction_error TEXT,
    extracted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_policy_files_bank_id ON bank_policy_files(bank_id);

-- Table: policy_embeddings
-- Vector embeddings table storing 1536-dimensional chunks for Policy RAG.
-- Uses cosine distance operator (<=>) and HNSW indexing for rapid semantic retrieval.
CREATE TABLE IF NOT EXISTS policy_embeddings (
    id BIGSERIAL PRIMARY KEY,
    policy_file_id BIGINT NOT NULL,
    bank_id BIGINT,
    file_name TEXT,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policy_embeddings_file_id ON policy_embeddings(policy_file_id);
CREATE INDEX IF NOT EXISTS idx_policy_embeddings_bank_id ON policy_embeddings(bank_id);
CREATE INDEX IF NOT EXISTS idx_policy_embeddings_chunk_index ON policy_embeddings(policy_file_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_policy_embeddings_vector ON policy_embeddings USING hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- 6. LOAN CALCULATOR & APPLICATION RECORDS
-- ----------------------------------------------------------------------------
-- Table: emi_calculations
-- Saved loan calculations and amortization schedule breakdowns.
CREATE TABLE IF NOT EXISTS emi_calculations (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    loan_type VARCHAR(100),
    loan_amount NUMERIC(15, 2),
    annual_rate NUMERIC(5, 2),
    processing_fee_percent NUMERIC(5, 2),
    term_months INT,
    months_or_years VARCHAR(10),
    monthly_emi NUMERIC(15, 2),
    total_interest NUMERIC(15, 2),
    total_payment NUMERIC(15, 2),
    processing_fee_amount NUMERIC(15, 2),
    schedule JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emi_calculations_user_id ON emi_calculations(user_id);

-- ----------------------------------------------------------------------------
-- 7. CONVERSATIONAL AI SESSIONS, MESSAGES & STATE PERSISTENCE
-- ----------------------------------------------------------------------------
-- Table: assistant_conversations
-- Conversation sessions between end users and the AI Assistant.
CREATE TABLE IF NOT EXISTS assistant_conversations (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Loan Assistant',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_id ON assistant_conversations(user_id);

-- Table: assistant_messages
-- Message history for chat threads.
CREATE TABLE IF NOT EXISTS assistant_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation_id ON assistant_messages(conversation_id);

-- Table: assistant_conversation_states
-- Active conversational memory and state machine stack (preserves multi-turn state,
-- active loan eligibility forms, interrupted policy inquiries, and resumes).
CREATE TABLE IF NOT EXISTS assistant_conversation_states (
    conversation_id VARCHAR(255) PRIMARY KEY,
    state JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversation_states_expires_at ON assistant_conversation_states(expires_at);

-- ============================================================================
-- END OF SCHEMA DEFINITION
-- ============================================================================
