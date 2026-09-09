/**
 * Multi-Role Bank Manager Extractor & Schema Normalizer
 * Extracts RM, SM, ASM, RSM, ZSM, RH, and Coordinator managers from all 21 sheets
 * Preserves all extra bank-specific columns in JSONB `extra_info`.
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
  console.log("=== STARTING MULTI-ROLE BANK MANAGERS SCHEMA RE-INITIALIZATION & DATA IMPORT ===");

  const client = await pool.connect();
  try {
    // 1. Reset / Create Schema with JSONB extra_info
    await client.query(`
      DROP TABLE IF EXISTS bank_managers CASCADE;

      CREATE TABLE bank_managers (
        id SERIAL PRIMARY KEY,
        bank_name VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(100) DEFAULT 'Sales Manager',
        phone VARCHAR(100),
        email VARCHAR(255),
        location VARCHAR(255) NOT NULL,
        city VARCHAR(255),
        district VARCHAR(255),
        state VARCHAR(255),
        branch VARCHAR(255),
        employee_code VARCHAR(100),
        extra_info JSONB,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_bank_managers_bank_name ON bank_managers (LOWER(bank_name));
      CREATE INDEX idx_bank_managers_location ON bank_managers (LOWER(location));
      CREATE INDEX idx_bank_managers_city ON bank_managers (LOWER(city));
      CREATE INDEX idx_bank_managers_state ON bank_managers (LOWER(state));
      CREATE INDEX idx_bank_managers_role ON bank_managers (LOWER(role));
    `);

    console.log("✓ Re-created bank_managers table with extra_info JSONB column & indexes.");

    // 2. Read Workbook
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
          if (s.includes("name") || s.includes("city") || s.includes("location") || s.includes("state") || s.includes("sm") || s.includes("rm") || s.includes("contact") || s.includes("mobile") || s.includes("email") || s.includes("product")) score++;
        });
        if (score > maxScore) { maxScore = score; bestHeaderIdx = i; }
      }

      const headers = (rows[bestHeaderIdx] || []).map(h => cleanStr(h));
      const headersLower = headers.map(h => h.toLowerCase());

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

        // 1. Extract shared row metadata (Location, City, District, State, Product, Extra Info)
        let location = "";
        let district = "";
        let state = "";
        const extraData = {};

        headersLower.forEach((h, colIdx) => {
          const val = cleanStr(row[colIdx]);
          if (!val) return;

          if (h.includes("state") && !state) state = val;
          else if (h.includes("district") && !district) district = val;
          else if ((h.includes("location") || h.includes("city") || h.includes("area")) && !location) location = val;
          else if (!h.includes("name") && !h.includes("mobile") && !h.includes("contact") && !h.includes("email") && !h.includes("mail") && !h.includes("phone")) {
            extraData[headers[colIdx] || `col_${colIdx}`] = val;
          }
        });

        if (!location) location = state || district || "General Branch";
        const city = location.split("-")[0].split("/")[0].trim();

        // 2. Extract Managers by Role (RM, SM, ASM, RSM, ZSM, RH, Coordinator)
        const managerCandidates = [];

        // Role prefixes to look for in headers
        const rolesToExtract = [
          { prefix: "rm", defaultRole: "Relationship Manager (RM)" },
          { prefix: "sm", defaultRole: "Sales Manager (SM)" },
          { prefix: "asm", defaultRole: "Area Sales Manager (ASM)" },
          { prefix: "rsm", defaultRole: "Regional Sales Manager (RSM)" },
          { prefix: "zsm", defaultRole: "Zonal Sales Manager (ZSM)" },
          { prefix: "rhs", defaultRole: "Regional Head Support (RHS)" },
          { prefix: "rh", defaultRole: "Regional Head (RH)" },
          { prefix: "zh", defaultRole: "Zone Head (ZH)" },
          { prefix: "co-ordinator", defaultRole: "Coordinator" },
          { prefix: "coordinator", defaultRole: "Coordinator" },
          { prefix: "spoc", defaultRole: "Loan SPOC" },
          { prefix: "abm", defaultRole: "Assistant Branch Manager (ABM)" },
          { prefix: "rbm", defaultRole: "Regional Branch Manager (RBM)" }
        ];

        rolesToExtract.forEach(({ prefix, defaultRole }) => {
          let name = "";
          let phone = "";
          let email = "";
          let code = "";

          headersLower.forEach((h, colIdx) => {
            const val = cleanStr(row[colIdx]);
            if (!val) return;

            // Check if column header belongs to this role prefix
            if (h.startsWith(prefix) || h.includes(` ${prefix} `) || h.includes(` ${prefix}`) || h.includes(`${prefix} `)) {
              if (h.includes("name") || h === prefix) {
                if (!name && !val.toLowerCase().includes("team")) name = val;
              } else if (h.includes("mobile") || h.includes("contact") || h.includes("phone") || h.includes("no")) {
                if (!phone) phone = cleanPhone(val);
              } else if (h.includes("email") || h.includes("mail")) {
                if (!email) email = cleanEmail(val);
              } else if (h.includes("code") || h.includes("id")) {
                if (!code) code = val;
              }
            }
          });

          if (name && name.length > 2 && !name.toLowerCase().includes("name") && !name.toLowerCase().includes("code")) {
            managerCandidates.push({
              name,
              phone,
              email,
              code,
              role: defaultRole
            });
          }
        });

        // Fallback: If no specific role columns matched, extract generic Manager
        if (managerCandidates.length === 0) {
          let name = "";
          let phone = "";
          let email = "";
          let code = "";

          headersLower.forEach((h, colIdx) => {
            const val = cleanStr(row[colIdx]);
            if (!val) return;

            if (h.includes("name") && !name && !val.toLowerCase().includes("team")) name = val;
            else if ((h.includes("mobile") || h.includes("contact") || h.includes("phone") || h.includes("ph no")) && !phone) phone = cleanPhone(val);
            else if ((h.includes("email") || h.includes("mail")) && !email) email = cleanEmail(val);
            else if ((h.includes("code") || h.includes("emp")) && !code) code = val;
          });

          if (!name && (phone || email)) {
            name = `${bankName} Manager`;
          }

          if (name && !name.toLowerCase().includes("name")) {
            managerCandidates.push({
              name,
              phone,
              email,
              code,
              role: "Sales Manager (SM)"
            });
          }
        }

        // Deduplicate & Save each extracted manager for this row
        const seenKeys = new Set();

        for (const mgr of managerCandidates) {
          const key = `${mgr.name.toLowerCase()}_${mgr.role.toLowerCase()}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          await client.query(
            `INSERT INTO bank_managers (bank_name, name, role, phone, email, location, city, district, state, employee_code, extra_info, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              bankName,
              mgr.name,
              mgr.role,
              mgr.phone || null,
              mgr.email || null,
              location,
              city,
              district || null,
              state || null,
              mgr.code || null,
              Object.keys(extraData).length > 0 ? JSON.stringify(extraData) : null,
              "active"
            ]
          );
          sheetInserted++;
          totalInserted++;
        }
      }

      console.log(`Sheet "${sheetName}" -> Extracted & Inserted ${sheetInserted} manager records (All Roles).`);
    }

    console.log(`\n=======================================================`);
    console.log(`🎉 MULTI-ROLE IMPORT SUCCESSFUL! TOTAL MANAGERS: ${totalInserted}`);
    console.log(`=======================================================\n`);

  } catch (err) {
    console.error("Error during multi-role import:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
