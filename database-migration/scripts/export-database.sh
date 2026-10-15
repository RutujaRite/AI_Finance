#!/usr/bin/env bash
# ==============================================================================
# CreditWise AI — Database Export Script
# Target Database: login_db
# Engine: PostgreSQL (Custom Archive + Schema-only SQL + Roles SQL)
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

DUMP_FILE="${MIGRATION_DIR}/full_database_backup.dump"
SCHEMA_FILE="${MIGRATION_DIR}/schema_only.sql"
ROLES_FILE="${MIGRATION_DIR}/roles.sql"

echo "=================================================================="
echo " Starting CreditWise AI Database Export"
echo "=================================================================="
echo "Host:     ${DB_HOST}"
echo "Port:     ${DB_PORT}"
echo "User:     ${DB_USER}"
echo "Database: ${DB_NAME}"
echo "Output:   ${MIGRATION_DIR}"
echo "=================================================================="

# Check if pg_dump and pg_dumpall are available
if ! command -v pg_dump &>/dev/null; then
  echo "Error: pg_dump utility not found in PATH." >&2
  exit 1
fi

if ! command -v pg_dumpall &>/dev/null; then
  echo "Error: pg_dumpall utility not found in PATH." >&2
  exit 1
fi

# Prompt for password if not already set in environment
if [ -z "${PGPASSWORD:-}" ]; then
  read -s -p "Enter PostgreSQL password for user '${DB_USER}': " PGPASSWORD
  echo
  export PGPASSWORD
fi

echo ""
echo "[1/3] Generating full database backup (custom archive format)..."
echo "Saving to: ${DUMP_FILE}"
pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --format=custom \
  --blobs \
  --verbose \
  --file="${DUMP_FILE}" \
  "${DB_NAME}"

echo ""
echo "[2/3] Generating schema-only SQL script (no application records)..."
echo "Saving to: ${SCHEMA_FILE}"
pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --schema-only \
  --file="${SCHEMA_FILE}" \
  "${DB_NAME}"

echo ""
echo "[3/3] Exporting cluster global roles (without password hashes)..."
echo "Saving to: ${ROLES_FILE}"
pg_dumpall \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --globals-only \
  --no-role-passwords \
  --file="${ROLES_FILE}"

echo ""
echo "=================================================================="
echo " Export Summary & File Verification"
echo "=================================================================="
ls -lh "${DUMP_FILE}" "${SCHEMA_FILE}" "${ROLES_FILE}"
echo ""
echo "Export completed successfully!"
echo "Files are located in: ${MIGRATION_DIR}"
echo "=================================================================="
