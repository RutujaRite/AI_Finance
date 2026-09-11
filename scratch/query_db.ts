import pool from "../lib/db";

async function query() {
  const r = await pool.query(
    "SELECT id, conversation_id, role, content FROM assistant_messages ORDER BY id DESC LIMIT 20"
  );
  for (const row of r.rows.reverse()) {
    console.log(`[ID ${row.id} | Conv ${row.conversation_id} | ${row.role}]`);
    console.log(row.content);
    console.log("--------------------------------------------------------------------------------");
  }
  process.exit(0);
}

query().catch(err => {
  console.error(err);
  process.exit(1);
});
