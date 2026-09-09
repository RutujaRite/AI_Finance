const { Pool } = require("pg");
const pool = new Pool({
  user: "postgres",
  host: "127.0.0.1",
  database: "login_db",
  password: "system123",
  port: 5432,
});

async function main() {
  const cols = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'policy_rules'"
  );
  console.table(cols.rows);

  const sample = await pool.query(
    "SELECT pr.*, pv.bank_id, b.name as bank_name FROM policy_rules pr JOIN policy_versions pv ON pr.policy_version_id = pv.id JOIN banks b ON pv.bank_id = b.id"
  );
  console.log("Total rows in policy_rules with bank joins:", sample.rows.length);
  for (const r of sample.rows) {
    console.log(r.bank_id, r.bank_name, {
      loan_type: r.loan_type,
      min_salary: r.min_salary,
      min_cibil: r.min_cibil,
      min_age: r.min_age,
      max_age: r.max_age,
      min_loan_amount: r.min_loan_amount,
      max_loan_amount: r.max_loan_amount,
      min_tenure_months: r.min_tenure_months,
      max_tenure_months: r.max_tenure_months,
      foir_percent: r.foir_percent,
      roi: r.roi,
      processing_fee_percent: r.processing_fee_percent
    });
  }
  await pool.end();
}

main().catch(console.error);
