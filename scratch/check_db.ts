import pool from "../lib/db";

async function main() {
  const r = await pool.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'assistant_conversation_states'
  `);
  console.log("Columns:", r.rows);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
