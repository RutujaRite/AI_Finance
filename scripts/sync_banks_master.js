/**
 * Sync Master Banks Table with all 21 Partner Banks from Location & Manager LIST.xlsx
 */
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "system123",
  database: process.env.DB_NAME || "login_db",
});

const EXACT_21_BANKS = [
  { name: "ICICI Bank", code: "ICICI" },
  { name: "HDFC Bank", code: "HDFC" },
  { name: "Axis Finance", code: "AFL" },
  { name: "Kotak Mahindra Bank", code: "KOTAK" },
  { name: "Bajaj Finserv", code: "BAJAJ_FINSERV" },
  { name: "Axis Bank", code: "AXIS" },
  { name: "Piramal Finance", code: "PIRAMAL" },
  { name: "Bajaj Markets", code: "BAJAJ_MARKETS" },
  { name: "Cholamandalam Investment & Finance", code: "CHOLA" },
  { name: "IDFC FIRST Bank", code: "IDFC" },
  { name: "Bandhan Bank", code: "BANDHAN" },
  { name: "TATA Capital", code: "TATA_CAPITAL" },
  { name: "Finnable Credit", code: "FINNABLE" },
  { name: "SMFG India Credit", code: "SMFG" },
  { name: "Yes Bank", code: "YES_BANK" },
  { name: "IndusInd Bank", code: "INDUSIND" },
  { name: "Aditya Birla Capital", code: "ABFL" },
  { name: "InCred Finance", code: "INCRED" },
  { name: "Poonawalla Fincorp", code: "POONAWALLA" },
  { name: "L&T Finance", code: "LTF" },
  { name: "Utkarsh Small Finance Bank", code: "UTKARSH" }
];

async function run() {
  console.log("=== SYNCHRONIZING MASTER BANKS TABLE FOR ALL 21 BANKS ===");

  for (const b of EXACT_21_BANKS) {
    await pool.query(
      `INSERT INTO banks (name, code, is_active) 
       VALUES ($1, $2, true) 
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true`,
      [b.name, b.code]
    );
  }

  console.log("✓ All 21 Partner Banks synced into master banks table!");

  const res = await pool.query("SELECT id, name, code, is_active FROM banks ORDER BY name");
  console.table(res.rows);

  await pool.end();
}

run();
