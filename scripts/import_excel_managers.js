/**
 * High-Precision Import Script for Bank Managers Data
 * Parses all 21 sheets of `Location & Manager LIST.xlsx` and cleanly populates PostgreSQL `login_db`.
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
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined" || s === "-" || s === "n/a") return "";
  return s;
}

function cleanPhone(val) {
  if (!val) return "";
  let s = String(val).replace(/[^0-9+]/g, "");
  if (s.length >= 10) return s;
  return String(val).trim();
}

function cleanEmail(val) {
  if (!val) return "";
  let s = String(val).trim().toLowerCase();
  if (s.includes("@")) return s;
  return "";
}

async function run() {
  console.log("=== RE-INITIALIZING BANK_MANAGERS SCHEMA AND IMPORTING Excel DATA ===");

  const client = await pool.connect();
  try {
    // 1. Re-create clean bank_managers table & indexes
    await client.query(`
      DROP TABLE IF EXISTS bank_managers CASCADE;

      CREATE TABLE bank_managers (
        id SERIAL PRIMARY KEY,
        bank_name VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(100),
        email VARCHAR(255),
        location VARCHAR(255) NOT NULL,
        city VARCHAR(255),
        state VARCHAR(255),
        branch VARCHAR(255),
        role VARCHAR(100) DEFAULT 'Sales Manager',
        employee_code VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_bank_managers_bank_name ON bank_managers (LOWER(bank_name));
      CREATE INDEX idx_bank_managers_location ON bank_managers (LOWER(location));
      CREATE INDEX idx_bank_managers_city ON bank_managers (LOWER(city));
      CREATE INDEX idx_bank_managers_state ON bank_managers (LOWER(state));
    `);

    console.log("✓ Reset bank_managers schema in PostgreSQL login_db.");

    // 2. Load Workbook
    const wb = xlsx.readFile(EXCEL_PATH);
    console.log(`✓ Loaded Excel workbook with ${wb.SheetNames.length} sheets.`);

    let totalInserted = 0;

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      if (!rows || rows.length < 2) continue;

      // Detect Best Header Row
      let bestHeaderIdx = 0;
      let maxScore = -1;

      for (let i = 0; i < Math.min(6, rows.length); i++) {
        const r = rows[i] || [];
        let score = 0;
        r.forEach(cell => {
          const s = String(cell || "").toLowerCase();
          if (
            s.includes("name") || s.includes("city") || s.includes("location") || 
            s.includes("state") || s.includes("sm") || s.includes("rm") || 
            s.includes("contact") || s.includes("mobile") || s.includes("email") || 
            s.includes("product")
          ) {
            score++;
          }
        });
        if (score > maxScore) {
          maxScore = score;
          bestHeaderIdx = i;
        }
      }

      const rawHeaders = (rows[bestHeaderIdx] || []).map(h => cleanStr(h).toLowerCase());

      // Identify column indices for key fields
      let cityIdx = -1, stateIdx = -1, nameIdx = -1, phoneIdx = -1, emailIdx = -1, empCodeIdx = -1, roleIdx = -1;

      rawHeaders.forEach((h, colIdx) => {
        if (!h) return;
        if ((h.includes("location") || h.includes("city") || h.includes("area")) && cityIdx === -1) cityIdx = colIdx;
        if (h.includes("state") && stateIdx === -1) stateIdx = colIdx;
        if ((h.includes("rm name") || h.includes("sm name") || h.includes("sales manager") || h.includes("name") || h.includes("sm") || h.includes("rm") || h.includes("spoc")) && nameIdx === -1) {
          if (!h.includes("code") && !h.includes("mail") && !h.includes("mobile") && !h.includes("id")) nameIdx = colIdx;
        }
        if ((h.includes("mobile") || h.includes("contact") || h.includes("phone") || h.includes("ph no")) && phoneIdx === -1) phoneIdx = colIdx;
        if ((h.includes("email") || h.includes("mail")) && emailIdx === -1) emailIdx = colIdx;
        if ((h.includes("emp code") || h.includes("sm code") || h.includes("employee id") || h.includes("sm id")) && empCodeIdx === -1) empCodeIdx = colIdx;
        if (h.includes("designation") && roleIdx === -1) roleIdx = colIdx;
      });

      // Standardize bank name
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

      let sheetInserted = 0;

      for (let r = bestHeaderIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        let name = nameIdx !== -1 ? cleanStr(row[nameIdx]) : "";
        let location = cityIdx !== -1 ? cleanStr(row[cityIdx]) : "";
        let state = stateIdx !== -1 ? cleanStr(row[stateIdx]) : "";
        let phone = phoneIdx !== -1 ? cleanPhone(row[phoneIdx]) : "";
        let email = emailIdx !== -1 ? cleanEmail(row[emailIdx]) : "";
        let empCode = empCodeIdx !== -1 ? cleanStr(row[empCodeIdx]) : "";
        let role = roleIdx !== -1 ? cleanStr(row[roleIdx]) : "Sales Manager";

        // Fallback checks across all cells in the row if key fields missing
        if (!phone || !email || !name) {
          row.forEach(cell => {
            const strVal = cleanStr(cell);
            if (!strVal) return;
            if (strVal.includes("@") && !email) email = cleanEmail(strVal);
            else if (/^[0-9+\s-]{10,15}$/.test(strVal) && !phone) phone = cleanPhone(strVal);
          });
        }

        // Ignore header title duplicates or empty rows
        if (name.toLowerCase().includes("name") || name.toLowerCase().includes("contact") || name.toLowerCase().includes("sm code")) continue;
        if (!location) location = state || "General Branch";

        if (!name && (phone || email)) {
          name = `${bankName} Manager`;
        }

        if (name && (phone || email || location !== "General Branch")) {
          const city = location.split("-")[0].split("/")[0].trim();

          await client.query(
            `INSERT INTO bank_managers (bank_name, name, phone, email, location, city, state, role, employee_code, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              bankName,
              name,
              phone || null,
              email || null,
              location,
              city,
              state || null,
              role || "Sales Manager",
              empCode || null,
              "active"
            ]
          );
          sheetInserted++;
          totalInserted++;
        }
      }

      console.log(`Sheet "${sheetName}" -> Inserted ${sheetInserted} manager records.`);
    }

    console.log(`\n=======================================================`);
    console.log(`🎉 SUCCESS! HIGH-PRECISION IMPORT COMPLETED: ${totalInserted} MANAGERS STORED`);
    console.log(`=======================================================\n`);

  } catch (err) {
    console.error("Error during import:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
