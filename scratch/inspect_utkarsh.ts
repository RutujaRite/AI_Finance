import pool from "../lib/db";

async function main() {
  const client = await pool.connect();
  try {
    const hdfcRes = await client.query("SELECT DISTINCT bank_name, branch, city, location FROM bank_managers WHERE city ILIKE '%Pune%' OR location ILIKE '%Pune%' ORDER BY bank_name, branch LIMIT 30");
    console.log("Sample Pune bank records:", JSON.stringify(hdfcRes.rows, null, 2));

    const banksWithBranches = await client.query("SELECT bank_name, COUNT(DISTINCT branch) as branch_count, COUNT(*) as total FROM bank_managers WHERE (city ILIKE '%Pune%' OR location ILIKE '%Pune%') AND branch IS NOT NULL AND branch != '' GROUP BY bank_name");
    console.log("Banks with actual branches in Pune:", JSON.stringify(banksWithBranches.rows, null, 2));

    const banksWithoutBranches = await client.query("SELECT bank_name, COUNT(*) as total FROM bank_managers WHERE (city ILIKE '%Pune%' OR location ILIKE '%Pune%') AND (branch IS NULL OR branch = '') GROUP BY bank_name");
    console.log("Banks with NULL/empty branch in Pune:", JSON.stringify(banksWithoutBranches.rows, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

main();
