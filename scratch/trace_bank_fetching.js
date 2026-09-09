const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  user: "postgres",
  host: "127.0.0.1",
  database: "login_db",
  password: "system123",
  port: 5432,
});

async function main() {
  console.log("=== CHECKING DATABASE TABLES FOR BANKS & POLICIES ===");
  try {
    const banksRes = await pool.query("SELECT id, name, code, is_active FROM banks ORDER BY id");
    console.log("Database banks count:", banksRes.rows.length);
    console.table(banksRes.rows);
  } catch (e) {
    console.error("Error querying banks:", e.message);
  }

  try {
    const rulesRes = await pool.query("SELECT id, bank_id, loan_type, min_salary, min_cibil, min_age, max_age, min_loan_amount, max_loan_amount, foir_percentage, interest_rate_min FROM policy_rules ORDER BY id");
    console.log("Policy rules count:", rulesRes.rows.length);
    console.table(rulesRes.rows);
  } catch (e) {
    console.error("Error querying policy_rules:", e.message);
  }

  const dir = path.join(process.cwd(), "policy-master-files");
  const txtFiles = fs.readdirSync(dir).filter(f => f.endsWith(".txt"));
  console.log("\nActive .txt files in policy-master-files count:", txtFiles.length);
  console.log(txtFiles);

  const delPath = path.join(dir, ".deleted_banks.json");
  if (fs.existsSync(delPath)) {
    console.log("Deleted bank IDs:", JSON.parse(fs.readFileSync(delPath, "utf8")));
  }
  const overridesPath = path.join(dir, ".policy_overrides.json");
  if (fs.existsSync(overridesPath)) {
    console.log("Policy overrides:", JSON.parse(fs.readFileSync(overridesPath, "utf8")));
  }

  await pool.end();
}

main();
