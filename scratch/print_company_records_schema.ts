import pool from "../lib/db";

async function main() {
  const r = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'company_records'"
  );
  console.log("Columns:", r.rows);
  const sample = await pool.query("SELECT * FROM company_records LIMIT 2");
  console.log("Sample:", sample.rows);
  await pool.end();
}
main();
