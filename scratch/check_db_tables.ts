import pool from "../lib/db";

async function check() {
  try {
    const res = await pool.query("SELECT COUNT(*) FROM bank_company_data");
    console.log("bank_company_data count:", res.rows[0].count);
  } catch (e: any) {
    console.error("bank_company_data error:", e.message);
  }

  try {
    const res2 = await pool.query("SELECT COUNT(*) FROM company_records");
    console.log("company_records count:", res2.rows[0].count);
  } catch (e: any) {
    console.error("company_records error:", e.message);
  }

  try {
    const res3 = await pool.query("SELECT COUNT(*) FROM company_basic_info");
    console.log("company_basic_info count:", res3.rows[0].count);
  } catch (e: any) {
    console.error("company_basic_info error:", e.message);
  }

  try {
    const res4 = await pool.query("SELECT COUNT(*) FROM company_financial_info");
    console.log("company_financial_info count:", res4.rows[0].count);
  } catch (e: any) {
    console.error("company_financial_info error:", e.message);
  }

  await pool.end();
}
check();
