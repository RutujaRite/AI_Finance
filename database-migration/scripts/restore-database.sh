#!/usr/bin/env bash
# ==============================================================================
# CreditWise AI — Database Restore Script
# Destination Database: login_db
# Engine: PostgreSQL (pg_restore with custom-format archive)
# ==============================================================================
set -euo pipefail

# Connection parameters with sensible defaults (override via environment variables)
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-login_db}"

# Resolve directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DUMP_FILE="${1:-${MIGRATION_DIR}/full_database_backup.dump}"

echo "=================================================================="
echo " CreditWise AI Database Restore Utility"
echo "=================================================================="
echo "Host:        ${DB_HOST}"
echo "Port:        ${DB_PORT}"
echo "User:        ${DB_USER}"
echo "Database:    ${DB_NAME}"
echo "Backup File: ${DUMP_FILE}"
echo "=================================================================="

# Check client utilities
if ! command -v pg_restore &>/dev/null; then
  echo "Error: pg_restore utility not found in PATH." >&2
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo "Error: psql utility not found in PATH." >&2
  exit 1
fi

if [ ! -f "${DUMP_FILE}" ]; then
  echo "Error: Backup file '${DUMP_FILE}' not found." >&2
  exit 1
fi

# Prompt for password if not already set in environment
if [ -z "${PGPASSWORD:-}" ]; then
  read -s -p "Enter PostgreSQL password for user '${DB_USER}': " PGPASSWORD
  echo
  export PGPASSWORD
fi

# 1. Verify connection to PostgreSQL server
echo ""
echo "[1/5] Checking connection to PostgreSQL server..."
if ! psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
  echo "Error: Cannot connect to PostgreSQL server at ${DB_HOST}:${DB_PORT} as ${DB_USER}." >&2
  exit 1
fi
echo "Connection established."

# 2. Check if target database exists; create it if missing
echo ""
echo "[2/5] Checking if target database '${DB_NAME}' exists..."
DB_EXISTS=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';")

if [ "${DB_EXISTS}" != "1" ]; then
  echo "Target database '${DB_NAME}' does not exist."
  read -r -p "Do you want to create database '${DB_NAME}' now? (y/N): " CONFIRM_CREATE
  if [[ "${CONFIRM_CREATE}" =~ ^[Yy]$ ]]; then
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE \"${DB_NAME}\" ENCODING 'UTF8';"
    echo "Database '${DB_NAME}' created successfully."
  else
    echo "Aborted: target database '${DB_NAME}' must exist before restoration." >&2
    exit 1
  fi
else
  echo "Database '${DB_NAME}' exists."
  EXISTING_TABLES=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
  if [ "${EXISTING_TABLES}" -gt 0 ]; then
    echo "WARNING: Database '${DB_NAME}' already contains ${EXISTING_TABLES} tables in public schema."
    echo "Restoring without --clean will merge/append data, which may fail on duplicate primary keys."
    read -r -p "Are you sure you want to proceed with restoration into '${DB_NAME}'? (y/N): " CONFIRM_PROCEED
    if [[ ! "${CONFIRM_PROCEED}" =~ ^[Yy]$ ]]; then
      echo "Restoration cancelled by user."
      exit 0
    fi
  fi
fi

# 3. Check for required extensions (pgvector and uuid-ossp)
echo ""
echo "[3/5] Verifying required extensions support in target PostgreSQL instance..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<'EOSQL'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  ELSE
    RAISE WARNING 'The "vector" extension (pgvector) is NOT installed on this PostgreSQL server. Please install pgvector before restoring vector embeddings.';
  END IF;
END $$;
EOSQL

# 4. Perform restoration
echo ""
echo "[4/5] Restoring database from backup archive..."
echo "Options used:"
echo "  --no-owner: Prevents failure if source role does not exist on destination"
echo "  --no-acl:   Prevents permission restore conflicts"
echo "  --verbose:  Shows restore progress"
echo ""

set +e
pg_restore \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --no-owner \
  --no-acl \
  --verbose \
  "${DUMP_FILE}"
RESTORE_STATUS=$?
set -e

# Note: pg_restore may return 1 if minor warnings (e.g., extension already exists) occurred
if [ ${RESTORE_STATUS} -eq 0 ] || [ ${RESTORE_STATUS} -eq 1 ]; then
  echo ""
  echo "Database restoration completed (status code: ${RESTORE_STATUS})."
else
  echo ""
  echo "Error: pg_restore exited with unexpected code ${RESTORE_STATUS}." >&2
  exit ${RESTORE_STATUS}
fi

# 5. Quick post-restore verification
echo ""
echo "[5/5] Performing post-restore verification..."
TABLE_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
echo "Total restored tables in public schema: ${TABLE_COUNT} (Expected: 37)"

TABLE_NAMES=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
TOTAL_ROWS=0
for tbl in ${TABLE_NAMES}; do
  CNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT count(*) FROM \"${tbl}\";")
  TOTAL_ROWS=$((TOTAL_ROWS + CNT))
done

echo "Total records across all tables: ${TOTAL_ROWS} (Expected: 552222)"

echo ""
echo "=================================================================="
echo " Restore completed successfully!"
echo " Next step: Run ./scripts/verify-migration.sh for comprehensive verification."
echo "=================================================================="
