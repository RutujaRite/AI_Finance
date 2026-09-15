import pool from "../lib/db";

async function main() {
  try {
    const res = await pool.query(
      `INSERT INTO assistant_conversation_states (conversation_id, state, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '45 minutes')
       ON CONFLICT (conversation_id) DO UPDATE SET state = $2, expires_at = NOW() + INTERVAL '45 minutes'`,
      [223, {
        applicant: { loanType: "Personal Loan" },
        expectedField: "companyName",
        missingFields: ["companyName"],
        in_eligibility_flow: true,
        updatedAt: Date.now(),
      }]
    );
    console.log("Insert SUCCESS, rowCount:", res.rowCount);
    const read = await pool.query(`SELECT * FROM assistant_conversation_states WHERE conversation_id = 223`);
    console.log("Read back:", read.rows);
  } catch (e) {
    console.error("Insert FAILED:", e);
  }
  process.exit(0);
}

main();
