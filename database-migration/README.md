# CreditWise AI — Complete PostgreSQL Database Migration Guide

This directory contains the complete database migration package to safely transfer the **CreditWise AI** PostgreSQL database (`login_db`) from this machine to another PC.

---

## 1. Database Architecture & Technical Profile

| Parameter | Source Database Specification | Notes |
| :--- | :--- | :--- |
| **Database Name** | `login_db` | Application primary database |
| **Default Host** | `127.0.0.1` | Local loopback interface |
| **Default Port** | `5432` | Standard PostgreSQL port |
| **Application User** | `postgres` | Superuser / database owner |
| **PostgreSQL Version** | `18.6` (Ubuntu Linux x86_64) | Compatible with PostgreSQL 15, 16, 17, 18 |
| **Encoding / Collation** | `UTF8` / `en_US.UTF-8` | Case-insensitive multi-language support |
| **Schema Name** | `public` | Application schema |
| **Required Extensions** | `vector` (pgvector 0.8.1+), `uuid-ossp`, `plpgsql` | Vector embeddings use HNSW cosine distance |
| **Total Base Tables** | **37 tables** | Relational + vector semantic tables |
| **Total Record Count** | **552,222 rows** | Preserved in full custom backup archive |
| **Primary Keys** | 37 constraints | Every table has an explicit primary key |
| **Foreign Keys** | 36 referential constraints | All relationships with cascade/delete rules |
| **Unique Constraints** | 4 constraints + 1 partial conditional index | Enforces uniqueness on emails, bank codes, etc. |
| **Indexes** | 73 total indexes | Includes 2 HNSW indexes on vector embeddings |
| **Sequences** | 23 sequences | Auto-incrementing sequences |

---

## 2. Migration Directory Structure

```
database-migration/
├── README.md                      # Comprehensive migration and restoration guide
├── full_database_backup.dump      # Native PostgreSQL custom-format archive (data + DDL)
├── schema_only.sql                # Plain-text SQL DDL schema (no records, for reference/inspection)
├── roles.sql                      # Cluster global roles export (passwords excluded)
├── migration-checklist.md         # Printable step-by-step migration checklist
└── scripts/
    ├── export-database.sh         # Idempotent script to re-export database if needed
    ├── restore-database.sh        # Automated safe database restoration script
    └── verify-migration.sh        # Audit script verifying all 37 tables, constraints, indexes & rows
```

> **Security Note**: `full_database_backup.dump` contains live application data and is automatically excluded from git tracking via `.gitignore`. No database passwords or sensitive credentials are hardcoded into scripts or documentation.

---

## 3. Preparation on Destination PC (Second Machine)

Follow these steps on the destination PC before restoring the database.

### Step 3.1: Install PostgreSQL

Ensure PostgreSQL **15, 16, 17, or 18** is installed on the destination PC.

- **Ubuntu / Debian Linux**:
  ```bash
  sudo apt update
  sudo apt install -y postgresql postgresql-contrib
  sudo systemctl enable --now postgresql
  ```
- **macOS (Homebrew)**:
  ```bash
  brew install postgresql@16
  brew services start postgresql@16
  ```
- **Windows**:
  Download and run the official PostgreSQL interactive installer from [enterprisedb.com/downloads/postgres-postgresql-downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).

### Step 3.2: Install the `pgvector` Extension (Mandatory)

The CreditWise AI database stores semantic embeddings in `policy_chunks` and `policy_embeddings` using `pgvector` with HNSW indexes.

- **Ubuntu / Debian Linux**:
  ```bash
  sudo apt update
  # Replace 16 with your installed PostgreSQL major version
  sudo apt install -y postgresql-16-pgvector
  # Or compile from source if not in default repositories:
  # git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
  # cd pgvector && make && sudo make install
  ```
- **macOS (Homebrew)**:
  ```bash
  brew install pgvector
  ```
- **Windows**:
  Follow the Windows build/install instructions from [github.com/pgvector/pgvector](https://github.com/pgvector/pgvector#windows).

### Step 3.3: Verify Client Utilities and Version

Verify that PostgreSQL client utilities are in your terminal `$PATH`:

```bash
psql --version
pg_restore --version
```

### Step 3.4: Configure User and Create the Target Database

1. Log in to PostgreSQL as superuser:
   ```bash
   sudo -u postgres psql
   ```
2. Verify or set the `postgres` user password:
   ```sql
   ALTER USER postgres WITH PASSWORD 'your_secure_password';
   ```
3. Create the `login_db` database with UTF8 encoding:
   ```sql
   CREATE DATABASE login_db WITH OWNER postgres ENCODING 'UTF8';
   ```
4. Connect to `login_db` and pre-initialize required extensions:
   ```sql
   \c login_db
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS vector;
   \q
   ```

---

## 4. Transferring Migration Files to Destination PC

Transfer the `database-migration/` folder to the destination PC using any of these methods:

### Option A: Local Network via `rsync` or `scp`
From the source PC:
```bash
# Archive the migration directory
tar -czvf database-migration.tar.gz database-migration/

# Transfer to destination PC
scp database-migration.tar.gz username@destination-ip:~/akshada-project/

# On destination PC, extract:
tar -xzvf database-migration.tar.gz
```

### Option B: USB Drive / External Storage
Copy the entire `database-migration/` directory onto an external USB drive and paste it into the project root on the destination PC.

---

## 5. Restoring the Database on Destination PC

### Method 1: Using the Automated Script (Recommended)

1. Open a terminal inside the project directory on the destination PC.
2. Run `restore-database.sh`:
   ```bash
   cd database-migration/scripts
   chmod +x restore-database.sh verify-migration.sh
   
   # Provide connection parameters via environment variables or follow the prompt
   DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=postgres DB_NAME=login_db ./restore-database.sh
   ```
3. The script will:
   - Check connection to PostgreSQL.
   - Verify that `login_db` exists (or offer to create it).
   - Verify `pgvector` and `uuid-ossp` extensions.
   - Restore using `--no-owner --no-acl` to prevent role ownership conflicts.
   - Run post-restore table and row count checks.

---

### Method 2: Manual `pg_restore` Command

If restoring manually from the command line:

```bash
# Set your password in environment or pass -W to be prompted
export PGPASSWORD="your_secure_password"

pg_restore \
  --host=127.0.0.1 \
  --port=5432 \
  --username=postgres \
  --dbname=login_db \
  --no-owner \
  --no-acl \
  --verbose \
  database-migration/full_database_backup.dump
```

#### Why `--no-owner` and `--no-acl` are used:
- `--no-owner`: Do not output commands to set ownership of objects to match the original dump. This guarantees restoration will not fail even if system roles on the destination PC have different OIDs or names.
- `--no-acl`: Prevents restoration of original access privileges, avoiding permission conflicts when restoring on different user configurations.
- **Safety**: Neither `--clean` nor `--create` is used by default. This guarantees no existing destination databases or tables are destroyed automatically.

---

## 6. Configuring Application `.env` on Destination PC

The CreditWise AI application connects to PostgreSQL via `lib/db.ts`:

```typescript
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "127.0.0.1",
  database: process.env.DB_NAME || "login_db",
  password: process.env.DB_PASSWORD || "system123",
  port: parseInt(process.env.DB_PORT || "5432", 10),
});
```

On the destination PC, create or update `.env.local` in the project root:

```bash
# -----------------------------------------------------------------------------
# CreditWise AI — Database Connection Configuration
# -----------------------------------------------------------------------------
DB_USER=postgres
DB_PASSWORD=your_destination_database_password
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=login_db

# Application environment
NODE_ENV=development
```

---

## 7. Verifying the Restored Database

Run the automated verification script on the destination PC:

```bash
cd database-migration/scripts
DB_HOST=127.0.0.1 DB_USER=postgres DB_NAME=login_db ./verify-migration.sh
```

### Expected Verification Checklist & Exact Table Counts

| Category | Expected Value | Audit Status |
| :--- | :--- | :--- |
| **PostgreSQL Connectivity** | Successful query execution | Required |
| **Extensions** | `vector` (0.8.1+), `uuid-ossp` (1.1+) | Required |
| **Public Tables** | **37 tables** | Must match |
| **Primary Keys** | **37 constraints** | Must match |
| **Foreign Keys** | **36 referential constraints** | Must match |
| **Unique Keys** | **4 constraints** | Must match |
| **Total Indexes** | **73 indexes** | Must match |
| **Vector HNSW Indexes** | **2 indexes** (`idx_policy_embeddings_vector`, `policy_chunks_embedding_hnsw`) | Must match |
| **Sequences** | **23 sequences** | Must match |
| **Total Records** | **552,222 rows** | Must match |

#### Complete Table Row Counts Breakdown

| # | Table Name | Columns | Expected Rows | Description |
| :---: | :--- | :---: | :---: | :--- |
| 1 | `agent_knowledge_bases` | 4 | 0 | Agent-knowledge mappings |
| 2 | `agents` | 20 | 6 | AI loan agent profiles |
| 3 | `ai_models` | 13 | 4 | Supported LLM models & configurations |
| 4 | `ai_token_settings` | 4 | 1 | Token limit threshold settings |
| 5 | `ai_token_usage_logs` | 9 | 49 | AI request token consumption audit |
| 6 | `assistant_conversation_states` | 3 | 531 | Multi-turn user session state memory |
| 7 | `assistant_conversations` | 5 | 316 | Conversational AI chat sessions |
| 8 | `assistant_messages` | 5 | 2,593 | Chat history messages & responses |
| 9 | `bank_company_data` | 7 | 533,316 | Master corporate employer directory & categories |
| 10 | `bank_manager_files` | 7 | 8 | Bank manager roster upload logs |
| 11 | `bank_managers` | 15 | 13,697 | Partner bank manager contact directory |
| 12 | `bank_policy_files` | 15 | 22 | Stored bank policy documents |
| 13 | `bank_uploaded_files` | 6 | 8 | Raw uploaded bank policy files |
| 14 | `banks` | 6 | 25 | Partner banks & NBFC institutions |
| 15 | `conversation_knowledge_usage` | 6 | 39 | RAG knowledge retrieval usage logs |
| 16 | `conversation_messages` | 9 | 268 | Agent studio message exchange logs |
| 17 | `conversations` | 6 | 89 | Agent studio conversations |
| 18 | `custom_agents` | 10 | 1 | Custom agent definitions |
| 19 | `decision_logs` | 15 | 4 | Loan eligibility decision logs |
| 20 | `emi_calculations` | 14 | 6 | Saved loan EMI calculations |
| 21 | `knowledge_bases` | 4 | 0 | Knowledge base root catalog |
| 22 | `knowledge_chunks` | 9 | 3 | Document knowledge text chunks |
| 23 | `knowledge_document_guardrails` | 6 | 0 | Knowledge guardrail definitions |
| 24 | `knowledge_document_instructions` | 8 | 0 | Knowledge system instructions |
| 25 | `knowledge_documents` | 17 | 1 | Knowledge source files |
| 26 | `loan_policies` | 11 | 4 | Active loan policy master definitions |
| 27 | `policy_attachments` | 9 | 22 | Policy annexures & rate sheets |
| 28 | `policy_chunks` | 12 | 687 | Segmented policy text chunks |
| 29 | `policy_documents` | 11 | 45 | Bank policy documents |
| 30 | `policy_embeddings` | 9 | 303 | 1536-dim vector embeddings |
| 31 | `policy_rules` | 40 | 122 | Dynamic lender underwriting rules |
| 32 | `policy_sources` | 10 | 23 | Policy documentation source links |
| 33 | `policy_versions` | 11 | 26 | Versioned policy rule releases |
| 34 | `products` | 5 | 1 | Loan products catalog |
| 35 | `system_api_configs` | 14 | 0 | System API credentials & endpoints |
| 36 | `user_active_agents` | 3 | 1 | User-selected active agent |
| 37 | `users` | 22 | 1 | Admin & application user accounts |
| | **TOTAL** | | **552,222** | **100% Data Preservation** |

---

## 8. Starting and Testing the Application

Once restoration and verification are complete:

```bash
# Install dependencies if not already done
npm install

# Start Next.js development server
npm run dev
```

Visit `http://localhost:3000` (or configured port) in your browser:
1. Verify loan intent detection and partner bank eligibility calculations.
2. Check that bank policies load from `login_db`.
3. Check that company search accesses the 533,316 records in `bank_company_data`.
4. Check that bank managers directory displays data from `bank_managers`.
