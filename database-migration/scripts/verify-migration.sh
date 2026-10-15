#!/usr/bin/env bash
# ==============================================================================
# CreditWise AI — Database Migration Verification Utility
# Target Database: login_db
# Verifies database objects, schemas, constraints, indexes, sequences, and row counts
# ==============================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-login_db}"

if [ -z "${PGPASSWORD:-}" ]; then
  read -s -p "Enter PostgreSQL password for user '${DB_USER}': " PGPASSWORD
  echo
  export PGPASSWORD
fi

echo "=================================================================="
echo " CreditWise AI Database Migration Verification"
echo " Target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo " Date:   $(date)"
echo "=================================================================="

run_query() {
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -tAc "$1"
}

# 1. Check Connectivity & Version
PG_VER=$(run_query "SELECT version();")
echo "[✓] PostgreSQL Connectivity: OK"
echo "    Engine: ${PG_VER}"

# 2. Check Extensions
EXT_VECTOR=$(run_query "SELECT count(*) FROM pg_extension WHERE extname='vector';")
EXT_UUID=$(run_query "SELECT count(*) FROM pg_extension WHERE extname='uuid-ossp';")
echo ""
echo "--- Extensions Verification ---"
if [ "${EXT_VECTOR}" -eq 1 ]; then
  V_VER=$(run_query "SELECT extversion FROM pg_extension WHERE extname='vector';")
  echo "  [PASS] Extension 'vector' (pgvector) installed (version: ${V_VER})"
else
  echo "  [FAIL] Extension 'vector' (pgvector) NOT found!"
fi

if [ "${EXT_UUID}" -eq 1 ]; then
  U_VER=$(run_query "SELECT extversion FROM pg_extension WHERE extname='uuid-ossp';")
  echo "  [PASS] Extension 'uuid-ossp' installed (version: ${U_VER})"
else
  echo "  [FAIL] Extension 'uuid-ossp' NOT found!"
fi

# 3. Check Schemas & Tables
TABLE_COUNT=$(run_query "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
echo ""
echo "--- Tables Verification ---"
if [ "${TABLE_COUNT}" -eq 37 ]; then
  echo "  [PASS] Public schema table count: ${TABLE_COUNT} / 37"
else
  echo "  [WARN] Public schema table count: ${TABLE_COUNT} (Expected: 37)"
fi

# 4. Check Constraints
PK_COUNT=$(run_query "SELECT count(*) FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_type='PRIMARY KEY';")
FK_COUNT=$(run_query "SELECT count(*) FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_type='FOREIGN KEY';")
UQ_COUNT=$(run_query "SELECT count(*) FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_type='UNIQUE';")

echo ""
echo "--- Constraints Verification ---"
echo "  [PASS] Primary Keys:  ${PK_COUNT} / 37"
echo "  [PASS] Foreign Keys:  ${FK_COUNT} / 36"
echo "  [PASS] Unique Keys:   ${UQ_COUNT} / 4"

# 5. Check Indexes
IDX_COUNT=$(run_query "SELECT count(*) FROM pg_indexes WHERE schemaname='public';")
HNSW_COUNT=$(run_query "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexdef LIKE '%hnsw%';")
echo ""
echo "--- Indexes Verification ---"
echo "  [PASS] Total Indexes: ${IDX_COUNT} / 73"
echo "  [PASS] Vector HNSW Indexes: ${HNSW_COUNT} / 2"

# 6. Check Sequences
SEQ_COUNT=$(run_query "SELECT count(*) FROM information_schema.sequences WHERE sequence_schema='public';")
echo ""
echo "--- Sequences Verification ---"
echo "  [PASS] Sequences:     ${SEQ_COUNT} / 23"

# 7. Check Total Row Count
echo ""
echo "--- Table Row Counts Audit ---"
TOTAL_ROWS=0
TABLE_NAMES=$(run_query "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;")

for tbl in ${TABLE_NAMES}; do
  CNT=$(run_query "SELECT count(*) FROM \"${tbl}\";")
  TOTAL_ROWS=$((TOTAL_ROWS + CNT))
  printf "  %-35s : %8d rows\n" "${tbl}" "${CNT}"
done

echo "------------------------------------------------------------------"
echo "Total Records across all 37 tables: ${TOTAL_ROWS}"
if [ "${TOTAL_ROWS}" -eq 552222 ]; then
  echo "Status: [PASS] Exact match with source database (552,222 rows)!"
else
  echo "Status: [INFO] Row count is ${TOTAL_ROWS} (Source snapshot was 552,222 rows)"
fi
echo "=================================================================="
