# CreditWise AI — Database Migration Checklist

Use this checklist to track and verify each stage of the PostgreSQL database migration from the source machine to the destination PC.

---

## Phase 1: Source Database Inspection & Health Check

- [x] **Database Name Identified**: `login_db`
- [x] **PostgreSQL Version Identified**: PostgreSQL 18.6 (Linux x86_64) — compatible with PG 15+
- [x] **Connection Configuration Checked**:
  - Host: `127.0.0.1`
  - Port: `5432`
  - User: `postgres`
  - Database: `login_db`
- [x] **Required Extensions Documented**:
  - `vector` (version 0.8.1) — pgvector with HNSW cosine distance
  - `uuid-ossp` (version 1.1)
  - `plpgsql` (version 1.0)
- [x] **Table Inventory Completed**: 37 base tables in `public` schema
- [x] **Record Count Baseline Established**: Total **552,222 rows** across all tables
- [x] **Primary Keys Audited**: 37 primary key constraints verified
- [x] **Foreign Keys Audited**: 36 referential constraints verified
- [x] **Unique Constraints Audited**: 4 unique constraints + 1 partial conditional index verified
- [x] **Indexes Audited**: 73 indexes verified (including 2 HNSW vector indexes)
- [x] **Sequences Audited**: 23 sequences verified
- [x] **Roles Audited**: Default `postgres` superuser role; no external unmanaged custom roles

---

## Phase 2: Export Generation & Verification (Source PC)

- [x] **Native PostgreSQL `pg_dump` Used**: Export performed using native tool
- [x] **Full Backup Archive Created**: `full_database_backup.dump` (PostgreSQL Custom Format `-F c`, gzip-compressed, ~15 MB)
- [x] **Schema-Only SQL File Generated**: `schema_only.sql` (~63 KB, pure DDL without records)
- [x] **Roles Dump Created**: `roles.sql` (generated via `pg_dumpall --globals-only --no-role-passwords`)
- [x] **Sensitive Passwords Excluded**: No plaintext passwords or password hashes stored in backup scripts or exports
- [x] **Git Protection Configured**: `.gitignore` updated with `*.dump`, `database-migration/*.dump`, `*.tar`
- [x] **Export Script Saved**: `scripts/export-database.sh` created and executable
- [x] **Restore Script Saved**: `scripts/restore-database.sh` created and executable
- [x] **Verification Script Saved**: `scripts/verify-migration.sh` created and executable

---

## Phase 3: File Transfer to Destination PC

- [ ] **Transfer Method Chosen**:
  - [ ] Option A: Local network (`scp` / `rsync` / `tar.gz`)
  - [ ] Option B: External USB drive / SSD
  - [ ] Option C: Secure private cloud storage
- [ ] **Files Transferred**:
  - [ ] `database-migration/full_database_backup.dump`
  - [ ] `database-migration/schema_only.sql`
  - [ ] `database-migration/roles.sql`
  - [ ] `database-migration/README.md`
  - [ ] `database-migration/migration-checklist.md`
  - [ ] `database-migration/scripts/export-database.sh`
  - [ ] `database-migration/scripts/restore-database.sh`
  - [ ] `database-migration/scripts/verify-migration.sh`
- [ ] **Archive Checksum / Size Verified**: Ensure `full_database_backup.dump` transferred completely (~15 MB)

---

## Phase 4: Destination PC Environment Setup

- [ ] **PostgreSQL Installed**: Compatible version (15, 16, 17, or 18) installed
- [ ] **Client Utilities Installed & Available**:
  - `psql --version` works in terminal
  - `pg_restore --version` works in terminal
- [ ] **PostgreSQL Service Running**: `sudo systemctl status postgresql` (Linux) or Windows Service running
- [ ] **Mandatory `pgvector` Extension Installed**:
  - Debian/Ubuntu: `sudo apt install postgresql-<version>-pgvector`
  - macOS: `brew install pgvector`
  - Windows: pgvector binaries copied to PostgreSQL `lib` and `share/extension` folders
- [ ] **Destination Database Created**:
  - Database name: `login_db`
  - Encoding: `UTF8`
  - Owner: `postgres` (or application user)
  ```sql
  CREATE DATABASE login_db WITH OWNER postgres ENCODING 'UTF8';
  ```
- [ ] **Extensions Initialized**:
  ```sql
  \c login_db
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

---

## Phase 5: Restoration on Destination PC

- [ ] **Execution Option Selected**:
  - [ ] **Option 1 (Automated)**:
    ```bash
    cd database-migration/scripts
    chmod +x restore-database.sh verify-migration.sh
    ./restore-database.sh
    ```
  - [ ] **Option 2 (Manual)**:
    ```bash
    pg_restore -h 127.0.0.1 -p 5432 -U postgres -d login_db --no-owner --no-acl -v database-migration/full_database_backup.dump
    ```
- [ ] **Ownership Flags Applied**: `--no-owner` and `--no-acl` used to prevent role mismatch errors
- [ ] **Non-Destructive Execution Verified**: Neither `--clean` nor `--create` used without explicit confirmation
- [ ] **Restore Exit Code Checked**: `0` (or `1` if non-fatal extension notice only)

---

## Phase 6: Post-Restoration Verification (Destination PC)

Run `./scripts/verify-migration.sh` and confirm every item:

- [ ] **PostgreSQL Connection**: Tested and responsive
- [ ] **Extensions Verified**:
  - [ ] `vector` (pgvector) enabled
  - [ ] `uuid-ossp` enabled
- [ ] **Table Count**: Exactly **37 tables** in `public` schema
- [ ] **Constraints Count**:
  - [ ] Primary Keys: **37**
  - [ ] Foreign Keys: **36**
  - [ ] Unique Keys: **4**
- [ ] **Indexes Count**: Exactly **73 indexes** (including 2 vector HNSW cosine indexes)
- [ ] **Sequences Count**: Exactly **23 sequences**
- [ ] **High-Volume Tables Row Counts Verified**:
  - [ ] `bank_company_data`: **533,316 rows**
  - [ ] `bank_managers`: **13,697 rows**
  - [ ] `assistant_messages`: **2,593 rows**
  - [ ] `policy_chunks`: **687 rows**
  - [ ] `assistant_conversation_states`: **531 rows**
  - [ ] `policy_embeddings`: **303 rows**
  - [ ] `policy_rules`: **122 rows**
  - [ ] `conversations`: **89 rows**
  - [ ] `policy_documents`: **45 rows**
  - [ ] `banks`: **25 rows**
- [ ] **Total Row Count**: Exactly **552,222 records**

---

## Phase 7: Application Integration & Smoke Testing

- [ ] **Environment File Configured**: `.env.local` created on destination PC:
  ```env
  DB_USER=postgres
  DB_PASSWORD=your_destination_password
  DB_HOST=127.0.0.1
  DB_PORT=5432
  DB_NAME=login_db
  ```
- [ ] **Application Started**: `npm run dev` starts without database connection errors
- [ ] **Feature Smoke Test**:
  - [ ] Bank search & company data search queries succeed (searches `bank_company_data`)
  - [ ] Multi-bank loan eligibility evaluates against stored master policies
  - [ ] Bank managers directory displays contacts from `bank_managers`
  - [ ] Conversational AI agent retrieves context and persists session states
  - [ ] EMI calculation features work and save to `emi_calculations`

---

## Sign-off & Final Status

| Item | Details |
| :--- | :--- |
| **Migration Package Version** | 1.0.0 |
| **Database** | `login_db` |
| **Source Backup Verified** | YES (tested via clean restore on test database) |
| **Data Integrity Status** | 100% matched (552,222 rows / 37 tables) |
| **Completed By** | CreditWise AI Migration Engine |
| **Date** | 2026-10-15 |
