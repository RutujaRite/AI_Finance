/**
 * Detailed Bank-Wise Row & Column Analysis Script
 * Analyzes each worksheet, headers, active data rows, and extracted role counts.
 */
require("dotenv").config();
const { Pool } = require("pg");
const xlsx = require("xlsx");
const path = require("path");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "system123",
  database: process.env.DB_NAME || "login_db",
});

const EXCEL_PATH = path.join(process.cwd(), "public", "uploads", "bank-managers", "mtkh6gvpjragbdowzng.xlsx");

function cleanStr(val) {
  if (val === null || val === undefined) return "";
  let s = String(val).trim();
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined" || s === "-" || s === "n/a" || s === "#error!") return "";
  return s;
}

async function runDetailedAnalysis() {
  const wb = xlsx.readFile(EXCEL_PATH);
  console.log("=========================================================================");
  console.log("     DETAILED BANK-BY-BANK WORKSHEET & ROLE BREAKDOWN ANALYSIS");
  console.log("=========================================================================\n");

  for (let idx = 0; idx < wb.SheetNames.length; idx++) {
    const sheetName = wb.SheetNames[idx];
    const sheet = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    if (!rows || rows.length === 0) continue;

    // Detect Header Index
    let bestHeaderIdx = 0;
    let maxScore = -1;
    for (let i = 0; i < Math.min(6, rows.length); i++) {
      const r = rows[i] || [];
      let score = 0;
      r.forEach(cell => {
        const s = String(cell || "").toLowerCase();
        if (s.includes("name") || s.includes("city") || s.includes("location") || s.includes("state") || s.includes("sm") || s.includes("rm") || s.includes("contact") || s.includes("mobile") || s.includes("email") || s.includes("product")) score++;
      });
      if (score > maxScore) { maxScore = score; bestHeaderIdx = i; }
    }

    const headers = (rows[bestHeaderIdx] || []).map(h => cleanStr(h)).filter(Boolean);

    // Map Bank Name
    let bankName = sheetName;
    if (sheetName.toLowerCase().includes("icici")) bankName = "ICICI Bank";
    else if (sheetName.toLowerCase().includes("hdfc")) bankName = "HDFC Bank";
    else if (sheetName.toLowerCase().includes("axis finance")) bankName = "Axis Finance";
    else if (sheetName.toLowerCase().includes("axis")) bankName = "Axis Bank";
    else if (sheetName.toLowerCase().includes("idfc")) bankName = "IDFC FIRST Bank";
    else if (sheetName.toLowerCase().includes("yes")) bankName = "Yes Bank";
    else if (sheetName.toLowerCase().includes("indusind")) bankName = "IndusInd Bank";
    else if (sheetName.toLowerCase().includes("utkarsh")) bankName = "Utkarsh Small Finance Bank";
    else if (sheetName.toLowerCase().includes("kotak")) bankName = "Kotak Mahindra Bank";
    else if (sheetName.toLowerCase().includes("poonawalla")) bankName = "Poonawalla Fincorp";
    else if (sheetName.toLowerCase().includes("aditya birla")) bankName = "Aditya Birla Capital";
    else if (sheetName.toLowerCase().includes("bajaj finserv")) bankName = "Bajaj Finserv";
    else if (sheetName.toLowerCase().includes("bajaj markets")) bankName = "Bajaj Markets";
    else if (sheetName.toLowerCase().includes("tata")) bankName = "TATA Capital";
    else if (sheetName.toLowerCase().includes("incred")) bankName = "InCred Finance";
    else if (sheetName.toLowerCase().includes("l&t")) bankName = "L&T Finance";
    else if (sheetName.toLowerCase().includes("piramal")) bankName = "Piramal Finance";
    else if (sheetName.toLowerCase().includes("chola")) bankName = "Cholamandalam Investment & Finance";
    else if (sheetName.toLowerCase().includes("finnable")) bankName = "Finnable Credit";
    else if (sheetName.toLowerCase().includes("smfg")) bankName = "SMFG India Credit";
    else if (sheetName.toLowerCase().includes("bandhan")) bankName = "Bandhan Bank";

    // Query DB Role breakdown for this bank
    const dbRoleRes = await pool.query(
      "SELECT role, COUNT(*) AS cnt FROM bank_managers WHERE bank_name = $1 GROUP BY role ORDER BY cnt DESC",
      [bankName]
    );

    const totalDb = dbRoleRes.rows.reduce((sum, r) => sum + parseInt(r.cnt, 10), 0);

    console.log(`[BANK ${idx + 1}/21] ${sheetName} Sheet -> Mapped To: "${bankName}"`);
    console.log(`  • Header Row Index: Row ${bestHeaderIdx + 1}`);
    console.log(`  • Columns Present in File: [ ${headers.join(", ")} ]`);
    console.log(`  • Total Sheet Rows: ${rows.length} | Active Non-Empty Rows: ${rows.length - (bestHeaderIdx + 1)}`);
    console.log(`  • Stored DB Manager Records: ${totalDb}`);
    console.log(`  • Role Breakdown Extracted:`);
    dbRoleRes.rows.forEach(r => {
      console.log(`      - ${r.role}: ${r.cnt} managers`);
    });
    console.log("-------------------------------------------------------------------------\n");
  }

  await pool.end();
}

runDetailedAnalysis();
