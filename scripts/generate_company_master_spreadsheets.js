// scripts/generate_company_master_spreadsheets.js
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "127.0.0.1",
  database: process.env.DB_NAME || "login_db",
  password: process.env.DB_PASSWORD || "system123",
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

const MASTER_DIR = path.join(__dirname, "..", "company-master-files");
const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "bank-company-data");

const BASE_COMPANIES = [
  { name: "Google (Alphabet)", category: "Super CAT-A", info: "CIN: U72900KA2003PTC033028 | Listed MNC Tech", ind: "Technology" },
  { name: "Tata Consultancy Services (TCS)", category: "Super CAT-A", info: "CIN: L22210MH1995PLC084781 | Top IT Services", ind: "IT Services" },
  { name: "Microsoft Corporation India", category: "Super CAT-A", info: "CIN: U72200DL1988PTC031853 | Enterprise Software", ind: "Technology" },
  { name: "Infosys Limited", category: "Super CAT-A", info: "CIN: L85110KA1981PLC013115 | IT Consulting & Digital", ind: "IT Services" },
  { name: "Amazon Development Centre India", category: "Super CAT-A", info: "CIN: U72200KA2004FTC034233 | E-Commerce & Cloud", ind: "E-Commerce" },
  { name: "Reliance Industries Limited", category: "Super CAT-A", info: "CIN: L17110MH1973PLC019786 | Conglomerate Bluechip", ind: "Conglomerate" },
  { name: "Accenture Solutions Private Limited", category: "Super CAT-A", info: "CIN: U72900MH2001PTC132219 | Global Consulting", ind: "Consulting" },
  { name: "Wipro Technologies Limited", category: "CAT-A", info: "CIN: L32102KA1945PLC020800 | IT & Engineering", ind: "IT Services" },
  { name: "Deloitte Shared Services India", category: "CAT-A", info: "CIN: U74140TG2004PTC044670 | Audit & Tax Advisory", ind: "Financial Advisory" },
  { name: "Central Govt / Public Sector (PSU)", category: "Govt / PSU", info: "Permanent Central / State Government Employment", ind: "Government" },
  { name: "Larsen & Toubro (L&T)", category: "CAT-A", info: "CIN: L99999MH1946PLC004768 | Engineering & Infra", ind: "Engineering" },
  { name: "Cognizant Technology Solutions", category: "CAT-A", info: "CIN: U72900TN1994FTC026590 | Systems & Cloud", ind: "IT Services" },
  { name: "HCL Technologies Limited", category: "CAT-A", info: "CIN: L74140DL1991PLC046369 | IT & R&D", ind: "IT Services" },
  { name: "Ernst & Young (EY India)", category: "CAT-A", info: "CIN: U74999MH2008PTC182745 | Global Advisory", ind: "Consulting" },
  { name: "PwC India (PricewaterhouseCoopers)", category: "CAT-A", info: "CIN: U74140WB1991PTC053330 | Professional Services", ind: "Consulting" },
  { name: "KPMG Advisory Services", category: "CAT-A", info: "CIN: U74140MH2004PTC148874 | Financial Advisory", ind: "Consulting" },
  { name: "Zomato Limited", category: "CAT-B", info: "CIN: L93030DL2010PLC198141 | Consumer Tech Listed", ind: "Consumer Tech" },
  { name: "Flipkart Internet Private Limited", category: "CAT-A", info: "CIN: U51109KA2012PTC066107 | Walmart Group", ind: "E-Commerce" },
  { name: "Swiggy (Bundl Technologies)", category: "CAT-B", info: "CIN: U74110KA2013PTC096530 | On-Demand Platform", ind: "Consumer Tech" },
  { name: "Hindustan Unilever Limited (HUL)", category: "Super CAT-A", info: "CIN: L15140MH1933PLC002030 | FMCG Leader", ind: "FMCG" },
  { name: "ITC Limited", category: "Super CAT-A", info: "CIN: L16005WB1910PLC001985 | Conglomerate Bluechip", ind: "FMCG" },
  { name: "Maruti Suzuki India Limited", category: "CAT-A", info: "CIN: L34103DL1981PLC011375 | Automotive Manufacturing", ind: "Automobile" },
  { name: "Mahindra & Mahindra Limited", category: "CAT-A", info: "CIN: L65990MH1945PLC004558 | Auto & Farm Tech", ind: "Automobile" },
  { name: "Tata Motors Limited", category: "CAT-A", info: "CIN: L28920MH1945PLC004520 | Automotive Bluechip", ind: "Automobile" },
  { name: "Bharti Airtel Limited", category: "CAT-A", info: "CIN: L74899HR1995PLC095967 | Telecom Services", ind: "Telecom" },
  { name: "Sun Pharmaceutical Industries", category: "CAT-A", info: "CIN: L24230GJ1993PLC019050 | Pharma Major", ind: "Pharmaceuticals" },
  { name: "Dr. Reddy's Laboratories", category: "CAT-A", info: "CIN: L85195TG1984PLC004507 | Global Pharmaceuticals", ind: "Pharmaceuticals" },
  { name: "Cipla Limited", category: "CAT-A", info: "CIN: L24239MH1935PLC002380 | Healthcare & Pharma", ind: "Pharmaceuticals" },
  { name: "Asian Paints Limited", category: "CAT-A", info: "CIN: L24220MH1945PLC004598 | Paints & Chemicals", ind: "Chemicals" },
  { name: "Bajaj Auto Limited", category: "CAT-A", info: "CIN: L65993PN2007PLC130076 | Auto Leader", ind: "Automobile" },
  { name: "State Bank of India (SBI Staff)", category: "Govt / PSU", info: "Public Sector Banking Major", ind: "Banking" },
  { name: "Reserve Bank of India (RBI)", category: "Govt / PSU", info: "Central Monetary Authority", ind: "Banking / Regulatory" },
  { name: "Life Insurance Corporation of India (LIC)", category: "Govt / PSU", info: "CIN: L66010MH1956GOI010619 | Public Insurance", ind: "Insurance" },
  { name: "Oil and Natural Gas Corporation (ONGC)", category: "Govt / PSU", info: "CIN: L74899DL1993GOI054155 | Maharatna PSU", ind: "Energy" },
  { name: "Indian Oil Corporation (IOCL)", category: "Govt / PSU", info: "CIN: L23201MH1959GOI011388 | Maharatna PSU", ind: "Energy" },
  { name: "NTPC Limited", category: "Govt / PSU", info: "CIN: L40101DL1975GOI007966 | Maharatna Power", ind: "Power" },
  { name: "Bharat Petroleum Corporation (BPCL)", category: "Govt / PSU", info: "CIN: L23220MH1952GOI008931 | Maharatna PSU", ind: "Energy" },
  { name: "Incraax AI Solutions", category: "CAT-B", info: "CIN: U72900MH2024PTC412345 | AI & FinTech Enterprise", ind: "FinTech" },
  { name: "PhonePe Private Limited", category: "CAT-A", info: "CIN: U67190MH2012PTC236054 | Digital Payments Leader", ind: "FinTech" },
  { name: "Paytm (One97 Communications)", category: "CAT-B", info: "CIN: L72200DL2000PLC105580 | Payments & Financial", ind: "FinTech" },
  { name: "Razorpay Software Private Limited", category: "CAT-A", info: "CIN: U72200KA2013PTC097389 | Payment Gateway Unicorn", ind: "FinTech" },
  { name: "Cred (Dreamplug Technologies)", category: "CAT-B", info: "CIN: U74999KA2018PTC112374 | Credit Card Payments", ind: "FinTech" },
  { name: "Jio Platforms Limited", category: "Super CAT-A", info: "CIN: U72900GJ2019PLC110816 | Digital Ecosystem", ind: "Telecom & Tech" },
  { name: "Adani Enterprises Limited", category: "CAT-A", info: "CIN: L51100GJ1993PLC019067 | Infrastructure Bluechip", ind: "Infrastructure" },
  { name: "Adani Ports and SEZ Limited", category: "CAT-A", info: "CIN: L63090GJ1998PLC034182 | Ports & Logistics", ind: "Logistics" },
  { name: "UltraTech Cement Limited", category: "CAT-A", info: "CIN: L26940MH2000PLC128420 | Aditya Birla Group", ind: "Cement" },
  { name: "Titan Company Limited", category: "CAT-A", info: "CIN: L74999TZ1984PLC001456 | Tata Group Consumer", ind: "Retail" },
  { name: "Nestle India Limited", category: "Super CAT-A", info: "CIN: L15202DL1959PLC003250 | Global Food FMCG", ind: "FMCG" },
  { name: "Britannia Industries Limited", category: "CAT-A", info: "CIN: L15412WB1918PLC002964 | Food & Dairy Products", ind: "FMCG" },
  { name: "Godrej Consumer Products", category: "CAT-A", info: "CIN: L24246MH2000PLC129841 | Personal & Home Care", ind: "FMCG" },
];

const LENDERS = [
  { bankName: "Multi-Bank Master", fileName: "Company_Categorization_Master.xlsx", count: 533316 },
  { bankName: "HDFC Bank", fileName: "HDFC_Bank_Company_Master.xlsx", count: 42500 },
  { bankName: "ICICI Bank", fileName: "ICICI_Bank_Company_Master.xlsx", count: 38200 },
  { bankName: "Axis Bank", fileName: "Axis_Bank_Company_Master.xlsx", count: 36400 },
  { bankName: "Kotak Mahindra Bank", fileName: "Kotak_Mahindra_Bank_Company_Master.xlsx", count: 28900 },
  { bankName: "Bajaj Finserv", fileName: "Bajaj_Finserv_Company_Master.xlsx", count: 48600 },
  { bankName: "Tata Capital", fileName: "Tata_Capital_Company_Master.xlsx", count: 31200 },
  { bankName: "IDFC FIRST Bank", fileName: "IDFC_FIRST_Bank_Company_Master.xlsx", count: 24700 },
  { bankName: "Finnable Credit", fileName: "Finnable_Credit_Company_Master.xlsx", count: 19800 },
  { bankName: "Fibe", fileName: "Fibe_EarlySalary_Company_Master.xlsx", count: 21500 },
  { bankName: "Cholamandalam", fileName: "Chola_Investment_Company_Master.xlsx", count: 18400 },
  { bankName: "Bandhan Bank", fileName: "Bandhan_Bank_Company_Master.xlsx", count: 16900 },
  { bankName: "Yes Bank", fileName: "Yes_Bank_Company_Master.xlsx", count: 22100 },
  { bankName: "IndusInd Bank", fileName: "IndusInd_Bank_Company_Master.xlsx", count: 25400 },
  { bankName: "Poonawalla Fincorp", fileName: "Poonawalla_Fincorp_Company_Master.xlsx", count: 17800 },
  { bankName: "Piramal Finance", fileName: "Piramal_Finance_Company_Master.xlsx", count: 15600 },
  { bankName: "Aditya Birla Capital", fileName: "Aditya_Birla_Capital_Company_Master.xlsx", count: 23400 },
  { bankName: "SMFG India Credit", fileName: "SMFG_India_Credit_Company_Master.xlsx", count: 14900 },
  { bankName: "L&T Finance", fileName: "LT_Finance_Company_Master.xlsx", count: 19200 },
  { bankName: "Utkarsh Small Finance Bank", fileName: "Utkarsh_Small_Finance_Bank_Company_Master.xlsx", count: 12800 },
];

function generateExcelFile(filePath, bankName) {
  const rows = BASE_COMPANIES.map((c, i) => ({
    "Sr No": i + 1,
    "Company Name": c.name,
    "Bank / Lender": bankName === "Multi-Bank Master" ? "Approved Partner Banks" : bankName,
    "Category": c.category,
    "Industry": c.ind,
    "Other Info / CIN": c.info,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Company Directory");
  XLSX.writeFile(wb, filePath);
}

async function run() {
  fs.mkdirSync(MASTER_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const client = await pool.connect();
  try {
    console.log("Generating Excel files on disk...");
    for (const lender of LENDERS) {
      const masterPath = path.join(MASTER_DIR, lender.fileName);
      const uploadPath = path.join(UPLOAD_DIR, lender.fileName);

      generateExcelFile(masterPath, lender.bankName);
      fs.copyFileSync(masterPath, uploadPath);
      console.log(`  ✓ Generated ${lender.fileName}`);
    }

    // Check if bank_uploaded_files needs seeding
    const existingFiles = await client.query("SELECT COUNT(*) FROM bank_uploaded_files");
    const count = parseInt(existingFiles.rows[0].count, 10);

    if (count === 0) {
      console.log("Seeding bank_uploaded_files and bank_company_data...");
      let defaultUserId = 1;
      const userRes = await client.query("SELECT id FROM users LIMIT 1");
      if (userRes.rows.length > 0) defaultUserId = userRes.rows[0].id;

      for (const lender of LENDERS) {
        const uploadPath = path.join(UPLOAD_DIR, lender.fileName);
        const stats = fs.statSync(uploadPath);

        const fileInsert = await client.query(
          `INSERT INTO bank_uploaded_files (file_name, file_path, file_size, uploaded_by, uploaded_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id`,
          [lender.fileName, `/uploads/bank-company-data/${lender.fileName}`, stats.size, defaultUserId]
        );
        const fileId = fileInsert.rows[0].id;

        // Ingest sample base companies for this bank
        for (let i = 0; i < BASE_COMPANIES.length; i++) {
          const c = BASE_COMPANIES[i];
          await client.query(
            `INSERT INTO bank_company_data (file_id, company_name, bank_name, sr_no, company_category, other_info)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              fileId,
              c.name,
              lender.bankName,
              String(i + 1),
              c.category,
              c.info,
            ]
          );
        }
      }
      console.log("Successfully seeded bank_uploaded_files & bank_company_data!");
    } else {
      console.log(`bank_uploaded_files already contains ${count} files.`);
    }
  } finally {
    client.release();
    pool.end();
  }
}

run().catch(console.error);
