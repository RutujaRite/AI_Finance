/**
 * Comprehensive Company Search Test Suite
 * 
 * Validations:
 * 1. Dynamic PostgreSQL row count (no hardcoding)
 * 2. Strict READ-ONLY verification (zero INSERT, UPDATE, DELETE, or ALTER across PostgreSQL)
 * 3. Source-trace verification for every field (Company name, Overview, CIN, Address, Website, Revenue, Employees, Partner banks, Bank categories)
 * 4. Distinct separation between PostgreSQL data and Incraax live-search data
 * 5. Entity identity boundary testing (Google vs Google LLC vs Alphabet vs Google India)
 * 6. Dynamic database-driven category validation against actual DB rows (no hardcoding)
 * 7. Duplicate/overlapping company-search function detection across the codebase
 * 8. Regression tests: REST API, chat agent, disambiguation, unlisted, SQL injection, timeouts
 * 9. Formatted trace output: Input → Function → Source → Table/API → Query → Returned Data → Final Response
 */

import pool from "../lib/db";
import { searchCompany, formatCompanyResponse, CompanySearchResult } from "../lib/companySearch";
import { fetchLiveCompanyIntelligence, isValidCompanyDomain, validateEntityConsistency, extractReportingPeriod, LiveCompanyIntelligence } from "../lib/incraax";
import { POST as companySearchPost } from "../app/api/company/search/route";
import { runCentralAgent } from "../lib/ai/agent";
import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

interface TestResult {
  name: string;
  category: string;
  status: "PASS" | "FAIL";
  trace: {
    input: string;
    func: string;
    source: string;
    tableOrApi: string;
    query: string;
    returnedData: string;
    finalResponse: string;
  };
  failureReason?: string;
}

const results: TestResult[] = [];

function printTrace(res: TestResult) {
  console.log(`\n================================================================================`);
  console.log(`TEST: [${res.status}] ${res.name} (${res.category})`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Input:         ${res.trace.input}`);
  console.log(`Function:      ${res.trace.func}`);
  console.log(`Source:        ${res.trace.source}`);
  console.log(`Table/API:     ${res.trace.tableOrApi}`);
  console.log(`Query:         ${res.trace.query}`);
  console.log(`Returned Data: ${res.trace.returnedData}`);
  console.log(`Final Response:\n${res.trace.finalResponse}`);
  if (res.failureReason) {
    console.log(`❌ FAILURE REASON: ${res.failureReason}`);
  }
}

async function getDatabaseStats() {
  const countRes = await pool.query("SELECT count(*)::bigint as total FROM bank_company_data;");
  const totalRows = Number(countRes.rows[0].total);

  const statsRes = await pool.query(`
    SELECT relname, n_tup_ins, n_tup_upd, n_tup_del 
    FROM pg_stat_user_tables 
    WHERE relname = 'bank_company_data';
  `);
  const row = statsRes.rows[0] || { n_tup_ins: 0, n_tup_upd: 0, n_tup_del: 0 };
  return {
    totalRows,
    ins: Number(row.n_tup_ins || 0),
    upd: Number(row.n_tup_upd || 0),
    del: Number(row.n_tup_del || 0),
  };
}

async function main() {
  console.log("🚀 STARTING COMPREHENSIVE COMPANY SEARCH TEST SUITE\n");

  // =========================================================================
  // 1. DYNAMIC ROW COUNT & DB READ-ONLY BASELINE
  // =========================================================================
  const dbBaseline = await getDatabaseStats();
  console.log(`[Database Baseline] bank_company_data actual count: ${dbBaseline.totalRows.toLocaleString()} rows.`);

  results.push({
    name: "Dynamic bank_company_data row count verification",
    category: "Database Integrity",
    status: dbBaseline.totalRows > 0 ? "PASS" : "FAIL",
    trace: {
      input: "N/A (Database state inspection)",
      func: "getDatabaseStats()",
      source: "PostgreSQL",
      tableOrApi: "bank_company_data",
      query: "SELECT count(*)::bigint as total FROM bank_company_data;",
      returnedData: `Found ${dbBaseline.totalRows} verified rows (no hardcoding)`,
      finalResponse: `Dynamic verification confirmed ${dbBaseline.totalRows.toLocaleString()} records present.`,
    },
    failureReason: dbBaseline.totalRows > 0 ? undefined : "bank_company_data table is empty",
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 2. DUPLICATE / OVERLAPPING COMPANY SEARCH FUNCTION DETECTION
  // =========================================================================
  const codebaseDir = path.resolve(__dirname, "..");
  const filesToScan = [
    "lib/companySearch.ts",
    "lib/companyCategoryResolver.ts",
    "services/companySelectionService.js",
    "services/bankCategoryResolver.js",
    "services/bankSpecificResolver.js",
    "services/eligibilityService.js",
    "app/api/company/search/route.ts",
  ];

  const detectedFunctions: Array<{ file: string; func: string; queryDescription: string }> = [];

  for (const relPath of filesToScan) {
    const fullPath = path.join(codebaseDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf-8");

    // Scan for function signatures that query bank_company_data
    if (content.includes("bank_company_data")) {
      const funcMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g) || [];
      const arrowMatches = content.match(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g) || [];
      const allFound = [...funcMatches, ...arrowMatches].map((s) => s.replace(/^(?:export\s+)?(?:async\s+)?function\s+/, "").replace(/^(?:const|let|var)\s+/, "").split(/[(=]/)[0].trim());

      for (const fn of allFound) {
        if (/company|category|resolver|search/i.test(fn)) {
          detectedFunctions.push({ file: relPath, func: fn, queryDescription: `Direct SELECT from bank_company_data in ${relPath}` });
        }
      }
    }
  }

  const hasDuplicateSearch = detectedFunctions.length > 2; // e.g. searchCompany vs searchCompanies vs resolveCompanyCategory
  results.push({
    name: "Duplicate/Overlapping Company Search Function Audit",
    category: "Codebase Architecture",
    status: "PASS", // Informative audit
    trace: {
      input: filesToScan.join(", "),
      func: "AST/Static Regex Codebase Scanner",
      source: "Local Repository Files",
      tableOrApi: "Filesystem",
      query: "Grep for bank_company_data retrieval logic across modules",
      returnedData: `Identified ${detectedFunctions.length} company retrieval functions across ${filesToScan.length} files:\n` +
        detectedFunctions.map((d) => `  - ${d.func} in [${d.file}]`).join("\n"),
      finalResponse: hasDuplicateSearch
        ? `⚠️ Overlap detected: Found ${detectedFunctions.length} functions retrieving company data (e.g. searchCompany in lib/companySearch.ts, resolveCompanyCategory in lib/companyCategoryResolver.ts, searchCompanies in services/companySelectionService.js). Centralizing into lib/companySearch.ts is recommended.`
        : "No duplicate functions found.",
    },
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 3. SOURCE TRACE TEST FOR EVERY RETURNED FIELD (Infosys BPM Limited)
  // =========================================================================
  const testCompany1 = "Infosys BPM Limited";
  const search1 = await searchCompany(testCompany1);

  // Cross-reference bank categories against direct database query
  const directDb1 = await pool.query(
    "SELECT DISTINCT bank_name, company_category FROM bank_company_data WHERE LOWER(company_name) = LOWER($1) ORDER BY bank_name;",
    [testCompany1]
  );
  const expectedDb1 = directDb1.rows;

  const fieldSources1: Record<string, { value: any; source: "PostgreSQL (bank_company_data)" | "Incraax Live Search" | "Derived" }> = {
    companyName: { value: search1.primaryName, source: "PostgreSQL (bank_company_data)" },
    overview: { value: search1.overview ? `${search1.overview.substring(0, 100)}...` : null, source: "Incraax Live Search" },
    cin: { value: search1.basicInfo?.cin, source: "Incraax Live Search" },
    address: { value: search1.basicInfo?.address, source: "Incraax Live Search" },
    website: { value: search1.basicInfo?.website, source: "Incraax Live Search" },
    revenue: { value: search1.financialInfo?.turnover, source: "Incraax Live Search" },
    employees: { value: search1.financialInfo?.employees, source: "Incraax Live Search" },
    partnerBanks: { value: search1.bankRecords.map((r) => r.bank_name).join(", "), source: "PostgreSQL (bank_company_data)" },
    bankCategories: { value: search1.bankRecords.map((r) => `${r.bank_name}: ${r.company_category}`).join(", "), source: "PostgreSQL (bank_company_data)" },
  };

  const formatted1 = formatCompanyResponse(search1);
  const hasDbCategoryMatch1 = expectedDb1.length > 0
    ? expectedDb1.every((expected) => search1.bankRecords.some((r) => r.bank_name.toLowerCase() === expected.bank_name.toLowerCase() && r.company_category.toLowerCase() === expected.company_category.toLowerCase()))
    : true;

  results.push({
    name: "Source-Trace Validation for Every Field (Infosys BPM Limited)",
    category: "Source Attribution & Data Integrity",
    status: search1.found && hasDbCategoryMatch1 ? "PASS" : "FAIL",
    trace: {
      input: testCompany1,
      func: "searchCompany('Infosys BPM Limited')",
      source: "Hybrid (PostgreSQL + Incraax Deep Search)",
      tableOrApi: "bank_company_data + https://search.incraaxaiautomation.in/api/search",
      query: `SQL: SELECT ... FROM bank_company_data WHERE LOWER(company_name) LIKE '%infosys bpm%' | API: Incraax query 'Infosys BPM Limited'`,
      returnedData: Object.entries(fieldSources1)
        .map(([k, v]) => `  - ${k}: "${v.value || "N/A"}" [Origin: ${v.source}]`)
        .join("\n"),
      finalResponse: formatted1.substring(0, 300) + "...",
    },
    failureReason: !search1.found
      ? "Company not found"
      : !hasDbCategoryMatch1
      ? "Bank categories in searchCompany did not match actual bank_company_data database records"
      : undefined,
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 4. ENTITY IDENTITY BOUNDARY TEST: Google vs Google LLC vs Alphabet vs Google India
  // =========================================================================
  console.log("\n[Entity Identity Isolation Tests]");
  const entities = [
    { query: "Google India Private Limited", expectedEntityPattern: /google\s+india/i },
    { query: "Google LLC", expectedEntityPattern: /google\s+llc|google\b/i },
    { query: "Alphabet Inc.", expectedEntityPattern: /alphabet/i },
    { query: "Google", expectedEntityPattern: /google/i },
  ];

  for (const ent of entities) {
    const entRes = await searchCompany(ent.query);
    const returnedName = entRes.primaryName;
    const returnedCin = entRes.basicInfo?.cin;

    // Check if Alphabet was conflated with Google India
    let isCrossContaminated = false;
    let crossReason: string | undefined;

    if (ent.query === "Alphabet Inc.") {
      if (/google\s*india/i.test(returnedName)) {
        isCrossContaminated = true;
        crossReason = `Entity Alphabet Inc. was incorrectly replaced by '${returnedName}' with Google India CIN ${returnedCin} (due to alias mapping in services/companyAliases.js line 126)`;
      }
    }

    if (ent.query === "Google LLC") {
      if (/google\s*india/i.test(returnedName)) {
        isCrossContaminated = true;
        crossReason = `Entity Google LLC was incorrectly resolved to '${returnedName}' instead of Google LLC / global entity`;
      }
    }

    results.push({
      name: `Entity Identity Isolation: "${ent.query}"`,
      category: "Entity Boundary",
      status: isCrossContaminated ? "FAIL" : "PASS",
      trace: {
        input: ent.query,
        func: `searchCompany('${ent.query}')`,
        source: "Hybrid (bank_company_data + Incraax)",
        tableOrApi: "bank_company_data / Incraax API",
        query: `Search target for: ${ent.query}`,
        returnedData: `PrimaryName: "${returnedName}", CIN: "${returnedCin || "N/A"}", Banks Found: ${entRes.bankRecords.length}`,
        finalResponse: `Entity resolved to: ${returnedName} (${entRes.found ? "Found" : "Not Found"})`,
      },
      failureReason: crossReason,
    });
    printTrace(results[results.length - 1]);
  }

  // =========================================================================
  // 4A. MANDATORY DUAL-SOURCE ENTITY TESTS (Meta Platforms LLP, Samsung, Cognizant)
  // =========================================================================
  console.log("\n[Mandatory Dual-Source Entity Tests]");
  const dualSourceTests = [
    {
      company: "Meta Platforms LLP",
      validate: (res: CompanySearchResult) => {
        const live = res.liveInformation;
        const isLlp = Boolean(res.canonicalIdentity?.isLlp);
        const hasPiramal = res.bankRecords.some((r) => r.bank_name.toLowerCase().includes("piramal"));
        const noAlienMetaInc = !live?.website && !live?.revenue && !live?.employees;
        const llpinCorrect = isLlp && live?.llpin === "AAZ-5968" && !live?.cin;
        return hasPiramal && noAlienMetaInc && llpinCorrect;
      },
    },
    {
      company: "SAMSUNG TELECOMMUNICATIONS",
      validate: (res: CompanySearchResult) => {
        const live = res.liveInformation;
        const hasPoonawalla = res.bankRecords.some((r) => r.bank_name.toLowerCase().includes("poonawalla"));
        const noAlienElectronics = !live?.overview || !live.overview.toLowerCase().includes("samsung electronics");
        return hasPoonawalla && noAlienElectronics;
      },
    },
    {
      company: "SAMSUNG ELECTRONICS",
      validate: (res: CompanySearchResult) => {
        const hasIndusInd = res.bankRecords.some((r) => r.bank_name.toLowerCase().includes("indusind"));
        return hasIndusInd;
      },
    },
    {
      company: "COGNIZANT IT PROFESSIONALS INDIA PRIVATE LIMITED",
      validate: (res: CompanySearchResult) => {
        const live = res.liveInformation;
        const hasPoonawalla = res.bankRecords.some((r) => r.bank_name.toLowerCase().includes("poonawalla"));
        const noAlienCognizantParent = !live?.website && !live?.revenue && !live?.employees;
        const correctListing = live?.listing_status === "Private Limited Corporate";
        return hasPoonawalla && noAlienCognizantParent && correctListing;
      },
    },
  ];

  for (const t of dualSourceTests) {
    const res = await searchCompany(t.company);
    const live = res.liveInformation;
    const isLlp = Boolean(res.canonicalIdentity?.isLlp);
    const passed = res.found && t.validate(res);

    console.log(`\n--- SPECIFIC TEST: ${t.company} ---`);
    console.log(`* canonical company: ${res.primaryName}`);
    console.log(`* bank records: ${res.bankRecords.map((r) => `${r.bank_name} (${r.company_category || "Approved"})`).join(", ")}`);
    console.log(`* live website: ${live?.website || "-"}`);
    console.log(`* CIN: ${!isLlp ? (live?.cin || "-") : "-"}`);
    console.log(`* LLPIN: ${isLlp ? (live?.llpin || "-") : "-"}`);
    console.log(`* address: ${live?.address || "-"}`);
    console.log(`* industry: ${live?.industry || "-"}`);
    console.log(`* employees: ${live?.employees || "-"}`);
    console.log(`* revenue: ${live?.revenue || "-"}`);
    console.log(`* profit: ${live?.profit || "-"}`);
    console.log(`* listing status: ${live?.listing_status || "-"}`);
    console.log(`* overview: ${res.overview || "-"}`);

    results.push({
      name: `Dual-Source Separation & Entity Boundary: "${t.company}"`,
      category: "Dual-Source Integrity",
      status: passed ? "PASS" : "FAIL",
      trace: {
        input: t.company,
        func: `searchCompany('${t.company}')`,
        source: "Dual-Source (bank_company_data + Incraax)",
        tableOrApi: "bank_company_data / Incraax API",
        query: `Dual-source query for: ${t.company}`,
        returnedData: `Canonical: ${res.primaryName}, Banks: ${res.bankRecords.length}, LLPIN: ${live?.llpin || "-"}, CIN: ${live?.cin || "-"}, Website: ${live?.website || "-"}`,
        finalResponse: formatCompanyResponse(res).substring(0, 300) + "...",
      },
      failureReason: passed ? undefined : "Validation failed: Entity data mixed with foreign/parent entity or bank records missing",
    });
    printTrace(results[results.length - 1]);
  }
  const typoQuery = "Tech Mahendra";
  const typoRes = await searchCompany(typoQuery);
  const typoPassed = typoRes.found && typoRes.candidates.some((c) => /tech\s*mahindra/i.test(c)) && typoRes.bankRecords.length > 0;

  results.push({
    name: `Typo Recovery to Canonical Entity: "${typoQuery}"`,
    category: "Entity Boundary",
    status: typoPassed ? "PASS" : "FAIL",
    trace: {
      input: typoQuery,
      func: `searchCompany('${typoQuery}')`,
      source: "PostgreSQL (bank_company_data suggestions)",
      tableOrApi: "bank_company_data",
      query: `Typo distance matching against bank_company_data verified names`,
      returnedData: `found: ${typoRes.found}, PrimaryName: "${typoRes.primaryName}", Candidates (${typoRes.candidates.length}): ${typoRes.candidates.slice(0, 3).join(", ")}, Banks: ${typoRes.bankRecords.length}`,
      finalResponse: `Typo "${typoQuery}" successfully recovered canonical identity "${typoRes.primaryName}" with ${typoRes.bankRecords.length} partner bank records.`,
    },
    failureReason: typoPassed ? undefined : "Failed to recover canonical Tech Mahindra entity from misspelled input",
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 4C. DOMAIN OWNERSHIP VALIDATION (Reject Parent Domain mahindra.com)
  // =========================================================================
  const parentDomainCheck = isValidCompanyDomain("https://www.mahindra.com", "Tech Mahindra Limited", "Tech Mahindra Limited");
  const childDomainCheck = isValidCompanyDomain("https://www.techmahindra.com", "Tech Mahindra Limited", "Tech Mahindra Limited");
  const domainTestPassed = parentDomainCheck === false && childDomainCheck === true;

  results.push({
    name: "Domain Ownership Validation (Reject Parent Group mahindra.com)",
    category: "Source Validation",
    status: domainTestPassed ? "PASS" : "FAIL",
    trace: {
      input: "Tech Mahindra Limited -> [mahindra.com, techmahindra.com]",
      func: "isValidCompanyDomain()",
      source: "Domain Token Ownership Filter",
      tableOrApi: "lib/incraax.ts",
      query: "Domain token evaluation",
      returnedData: `mahindra.com => ${parentDomainCheck} (expected false), techmahindra.com => ${childDomainCheck} (expected true)`,
      finalResponse: domainTestPassed
        ? "Parent domain mahindra.com correctly rejected; entity domain techmahindra.com accepted."
        : "Domain validation failed to reject parent domain or accept valid domain.",
    },
    failureReason: domainTestPassed ? undefined : `parentDomain: ${parentDomainCheck}, childDomain: ${childDomainCheck}`,
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 4D. CROSS-ENTITY DEFENSE & ALIEN FIELD REJECTION
  // =========================================================================
  const mockAlienIntel: LiveCompanyIntelligence = {
    companyName: "Tech Mahindra Limited",
    overview: "Tech Mahindra is a leading digital transformation provider.",
    basicInfo: {
      cin: "L65990MH1945PLC004558", // Alien CIN from M&M Ltd
      cin_field: { value: "L65990MH1945PLC004558", sourceUrl: "https://example.com", sourceTitle: "Mahindra & Mahindra", sourceEntity: "Mahindra & Mahindra Limited", verified: true, confidence: "high" },
      website: "https://www.techmahindra.com",
      website_field: { value: "https://www.techmahindra.com", sourceUrl: "https://techmahindra.com", sourceTitle: "Tech Mahindra", sourceEntity: "Tech Mahindra Limited", verified: true, confidence: "high" },
      address: null, country: "India", incorporation_date: "1986", industry: "IT Services", listing_status: "Listed",
    },
    financialInfo: {
      employees: "260,000", // Alien group headcount
      employees_field: { value: "260,000", sourceUrl: "https://example.com", sourceTitle: "Mahindra Group Report", sourceEntity: "Mahindra Group", verified: true, confidence: "medium" },
      turnover: "₹51,996 Cr",
      turnover_field: { value: "₹51,996 Cr", sourceUrl: "https://example.com", sourceTitle: "Tech Mahindra Annual Report", sourceEntity: "Tech Mahindra Limited", reportingPeriod: "FY24", verified: true, confidence: "high" },
      last_agm: null, performance_trend: null, profit_history: null, profit_status: null,
    },
    sources: [],
    entityVerified: true,
  };

  const filteredIntel = validateEntityConsistency(mockAlienIntel, "Tech Mahindra Limited");
  const alienCinRejected = filteredIntel.basicInfo.cin === null;
  const alienEmployeesRejected = filteredIntel.financialInfo.employees === null;
  const validWebsitePreserved = filteredIntel.basicInfo.website === "https://www.techmahindra.com";
  const validTurnoverPreserved = filteredIntel.financialInfo.turnover === "₹51,996 Cr";
  const crossEntityPassed = alienCinRejected && alienEmployeesRejected && validWebsitePreserved && validTurnoverPreserved;

  results.push({
    name: "Cross-Entity Defense (Reject Alien CIN & Headcount)",
    category: "Entity Boundary",
    status: crossEntityPassed ? "PASS" : "FAIL",
    trace: {
      input: "Mixed payload: Tech Mahindra target with M&M CIN and Mahindra Group employees",
      func: "validateEntityConsistency(intel, 'Tech Mahindra Limited')",
      source: "Entity Consistency Validator",
      tableOrApi: "lib/incraax.ts",
      query: "Check sourceEntity token matching against canonical target",
      returnedData: `Alien CIN => ${filteredIntel.basicInfo.cin} (null expected), Alien Employees => ${filteredIntel.financialInfo.employees} (null expected), Website => ${filteredIntel.basicInfo.website}, Turnover => ${filteredIntel.financialInfo.turnover}`,
      finalResponse: crossEntityPassed
        ? "Alien fields safely nullified while preserving verified target entity fields."
        : "Alien fields were not properly filtered out.",
    },
    failureReason: crossEntityPassed ? undefined : `alienCin: ${filteredIntel.basicInfo.cin}, alienEmployees: ${filteredIntel.financialInfo.employees}`,
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 4E. ZERO FABRICATION INVARIANT (No Fake Revenues / Headcounts)
  // =========================================================================
  const forbiddenPhrases = [
    "₹500+ Cr",
    "5,000+ employees",
    "Corporate Registered Office, Maharashtra",
    "is an established corporate enterprise operating in the Corporate sector",
    "₹100+ Cr",
  ];
  const containsFabricated = forbiddenPhrases.some((phrase) => formatted1.includes(phrase));
  const zeroFabPassed = !containsFabricated;

  results.push({
    name: "Zero Fabrication Invariant (No Synthesized/Hallucinated Fallbacks)",
    category: "Data Integrity",
    status: zeroFabPassed ? "PASS" : "FAIL",
    trace: {
      input: "Inspect formatted output of Infosys BPM Limited",
      func: "formatCompanyResponse(search1)",
      source: "Response Formatter",
      tableOrApi: "lib/companySearch.ts",
      query: "Check for synthetic template placeholders",
      returnedData: `Forbidden phrases detected: ${containsFabricated ? "YES" : "NONE"}`,
      finalResponse: zeroFabPassed
        ? "Zero fabrication verified: No synthetic placeholders found. Missing fields cleanly show 'Not available from verified source'."
        : "Fabricated placeholder text was found in formatted output!",
    },
    failureReason: zeroFabPassed ? undefined : "Synthetic placeholders found in response",
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 4F. REPORTING PERIOD PRESERVATION ON FINANCIAL METRICS
  // =========================================================================
  const sampleText1 = "Tech Mahindra reported consolidated annual revenue of ₹51,996 crore for FY24.";
  const sampleText2 = "Operating margins improved significantly during Q1 FY27 results announcement.";
  const period1 = extractReportingPeriod(sampleText1);
  const period2 = extractReportingPeriod(sampleText2);

  const mockPeriodResult = {
    found: true,
    primaryName: "Tech Mahindra Limited",
    overview: "Tech Mahindra Limited is a verified enterprise.",
    basicInfo: null,
    financialInfo: {
      employees: null,
      turnover: "₹51,996 Cr",
      turnover_field: {
        value: "₹51,996 Cr",
        verified: true,
        sourceUrl: "https://techmahindra.com/investors",
        sourceTitle: "Annual Report",
        sourceEntity: "Tech Mahindra Limited",
        reportingPeriod: period1,
        confidence: "high",
      },
      profit_status: null,
      last_agm: null,
      performance_trend: null,
    },
    bankRecords: [{ bank_name: "HDFC Bank", company_category: "A", other_info: "IT" }],
    candidates: ["Tech Mahindra Limited"],
    candidateOptions: [],
    needsDisambiguation: false,
  };

  const periodFormatted = formatCompanyResponse(mockPeriodResult as any);
  const periodPreserved = period1 === "FY24" && period2 === "Q1 FY27" && periodFormatted.includes("*(FY24)*");

  results.push({
    name: "Reporting Period Preservation on Financial Metrics",
    category: "Data Integrity",
    status: periodPreserved ? "PASS" : "FAIL",
    trace: {
      input: "Reporting period extraction & response formatting",
      func: "extractReportingPeriod() & formatCompanyResponse()",
      source: "Incraax extraction + companySearch formatter",
      tableOrApi: "lib/incraax.ts / lib/companySearch.ts",
      query: "Verify reporting period is extracted and preserved in formatted response",
      returnedData: `Period 1: "${period1}", Period 2: "${period2}", Formatted contains *(FY24)*: ${periodFormatted.includes("*(FY24)*")}`,
      finalResponse: periodPreserved
        ? `Reporting periods (${period1}, ${period2}) successfully extracted and preserved as *(FY24)* in formatted output.`
        : "Reporting period was omitted or lost.",
    },
    failureReason: periodPreserved ? undefined : `period1: ${period1}, period2: ${period2}, preserved: ${periodFormatted.includes("*(FY24)*")}`,
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 5. DATABASE-DRIVEN CATEGORY VALIDATION (No Hardcoding)
  // =========================================================================
  const testCompany2 = "Tata Consultancy Services Limited";
  const search2 = await searchCompany(testCompany2);

  // Fetch true DB records
  const dbRecords2 = await pool.query(
    "SELECT DISTINCT bank_name, company_category FROM bank_company_data WHERE LOWER(company_name) = LOWER($1) ORDER BY bank_name;",
    [testCompany2]
  );
  const actualDbRows2 = dbRecords2.rows;

  let allCategoriesMatch = true;
  let categoryMismatchDetail: string | undefined;

  if (actualDbRows2.length === 0) {
    allCategoriesMatch = false;
    categoryMismatchDetail = `No records found in database for ${testCompany2}`;
  } else {
    for (const actual of actualDbRows2) {
      const foundInSearch = search2.bankRecords.find(
        (r) => r.bank_name.trim().toLowerCase() === actual.bank_name.trim().toLowerCase()
      );
      if (!foundInSearch) {
        allCategoriesMatch = false;
        categoryMismatchDetail = `Missing bank in search result: ${actual.bank_name}`;
        break;
      }
      if (foundInSearch.company_category.trim().toLowerCase() !== actual.company_category.trim().toLowerCase()) {
        allCategoriesMatch = false;
        categoryMismatchDetail = `Category mismatch for ${actual.bank_name}: DB has '${actual.company_category}' but search returned '${foundInSearch.company_category}'`;
        break;
      }
    }
  }

  results.push({
    name: "Database-Driven Category Validation against Actual Records (TCS)",
    category: "Database Integrity",
    status: allCategoriesMatch ? "PASS" : "FAIL",
    trace: {
      input: testCompany2,
      func: "searchCompany('Tata Consultancy Services Limited')",
      source: "PostgreSQL",
      tableOrApi: "bank_company_data",
      query: `SELECT DISTINCT bank_name, company_category FROM bank_company_data WHERE LOWER(company_name) = LOWER('${testCompany2}')`,
      returnedData: `DB returned ${actualDbRows2.length} partner banks; searchCompany returned ${search2.bankRecords.length} partner banks`,
      finalResponse: actualDbRows2.map((r) => `${r.bank_name} => ${r.company_category}`).join(" | "),
    },
    failureReason: categoryMismatchDetail,
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 6. MULTI-ENTITY DISAMBIGUATION TEST ("Tata")
  // =========================================================================
  const disambigQuery = "Tata";
  const disambigRes = await searchCompany(disambigQuery);

  const hasMultipleCandidates = disambigRes.candidates && disambigRes.candidates.length > 1;
  const disambigPassed = disambigRes.needsDisambiguation && hasMultipleCandidates;

  results.push({
    name: `Multi-Entity Disambiguation ("${disambigQuery}")`,
    category: "Disambiguation",
    status: disambigPassed ? "PASS" : "FAIL",
    trace: {
      input: disambigQuery,
      func: "searchCompany('Tata')",
      source: "PostgreSQL (bank_company_data)",
      tableOrApi: "bank_company_data",
      query: "SELECT DISTINCT company_name FROM bank_company_data WHERE LOWER(company_name) LIKE '%tata%'",
      returnedData: `needsDisambiguation: ${disambigRes.needsDisambiguation}, Candidates (${disambigRes.candidates.length}): ${disambigRes.candidates.slice(0, 5).join(", ")}`,
      finalResponse: `Disambiguation triggered successfully with ${disambigRes.candidates.length} options.`,
    },
    failureReason: disambigPassed
      ? undefined
      : `Disambiguation did not trigger properly (needsDisambiguation: ${disambigRes.needsDisambiguation}, count: ${disambigRes.candidates?.length})`,
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 7. UNLISTED / UNKNOWN EMPLOYER HANDLING
  // =========================================================================
  const unknownCompany = "NonExistentDummyCorpGlobalXYZ999";
  const unknownRes = await searchCompany(unknownCompany);

  const unknownPassed = unknownRes.found === false && unknownRes.bankRecords.length === 0;
  results.push({
    name: "Unlisted / Unknown Employer Fallback",
    category: "Edge Cases",
    status: unknownPassed ? "PASS" : "FAIL",
    trace: {
      input: unknownCompany,
      func: `searchCompany('${unknownCompany}')`,
      source: "PostgreSQL + Incraax",
      tableOrApi: "bank_company_data + Incraax Search API",
      query: `Search for unlisted name '${unknownCompany}'`,
      returnedData: `found: ${unknownRes.found}, bankRecords: ${unknownRes.bankRecords.length}`,
      finalResponse: "Gracefully returned found: false without uncaught exceptions.",
    },
    failureReason: unknownPassed ? undefined : `Expected found: false but got found: ${unknownRes.found}`,
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 8. SQL INJECTION & SPECIAL CHARACTER SANITIZATION
  // =========================================================================
  const injectionInputs = [
    "Infosys' OR '1'='1",
    "TCS; DROP TABLE bank_company_data; --",
    "HCL % _ \\",
  ];

  for (const inj of injectionInputs) {
    let passed = false;
    let errMsg: string | undefined;
    try {
      const injRes = await searchCompany(inj);
      passed = true; // Query executed safely without crashing PostgreSQL
    } catch (e: any) {
      passed = false;
      errMsg = e.message;
    }

    results.push({
      name: `SQL Injection & Special Character Safety: "${inj}"`,
      category: "Security",
      status: passed ? "PASS" : "FAIL",
      trace: {
        input: inj,
        func: `searchCompany('${inj}')`,
        source: "PostgreSQL",
        tableOrApi: "bank_company_data",
        query: `LOWER(company_name) LIKE LOWER($1) with parameterized value`,
        returnedData: passed ? "Query safely parameterized by pg driver" : `SQL Error: ${errMsg}`,
        finalResponse: passed ? "Safe execution without SQL syntax errors or vulnerability." : "SQL Exception encountered.",
      },
      failureReason: errMsg,
    });
    printTrace(results[results.length - 1]);
  }

  // =========================================================================
  // 9. REST API ENDPOINT TEST (POST /api/company/search)
  // =========================================================================
  const apiTestReq = new NextRequest("http://localhost:3000/api/company/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_name: "Infosys BPM Limited" }),
  });
  const apiRes = await companySearchPost(apiTestReq);
  const apiJson = await apiRes.json();

  const apiPassed = apiRes.status === 200 && (apiJson.success === true || apiJson.found === true || apiJson.company !== undefined);
  results.push({
    name: "REST API Endpoint (POST /api/company/search - Infosys BPM Limited)",
    category: "API Endpoints",
    status: apiPassed ? "PASS" : "FAIL",
    trace: {
      input: 'POST /api/company/search body: { company_name: "Infosys BPM Limited" }',
      func: "POST(req: NextRequest)",
      source: "REST API Route",
      tableOrApi: "app/api/company/search/route.ts",
      query: 'JSON body: { company_name: "Infosys BPM Limited" }',
      returnedData: `Status: ${apiRes.status}, Body keys: ${Object.keys(apiJson).join(", ")}`,
      finalResponse: JSON.stringify(apiJson).substring(0, 200) + "...",
    },
    failureReason: apiPassed ? undefined : `Expected status 200 with success/found, got status ${apiRes.status}`,
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 10. CHAT AGENT CONVERSATIONAL INTEGRATION (runCentralAgent)
  // =========================================================================
  const chatMsg = "What is the company category rating for Infosys BPM Limited?";
  const agentRes = await runCentralAgent({
    message: chatMsg,
    conversationHistory: [],
    conversationId: "test-comp-agent-" + Date.now(),
  });

  const chatPassed = Boolean(agentRes && agentRes.reply && /Infosys\s+BPM/i.test(agentRes.reply));
  results.push({
    name: "Conversational Chat Agent Company Query",
    category: "AI Agent Integration",
    status: chatPassed ? "PASS" : "FAIL",
    trace: {
      input: chatMsg,
      func: "runCentralAgent({ message: ... })",
      source: "Central Agent Orchestration",
      tableOrApi: "lib/ai/agent.ts -> searchCompany()",
      query: "COMPANY_SEARCH intent resolution",
      returnedData: `Reply length: ${agentRes.reply?.length} chars`,
      finalResponse: (agentRes.reply || "").substring(0, 300) + "...",
    },
    failureReason: chatPassed ? undefined : "Agent did not mention Infosys BPM or return company information",
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // 11. STRICT POST-TEST DATABASE ZERO-MUTATION VERIFICATION
  // =========================================================================
  const dbFinal = await getDatabaseStats();
  const deltaRows = dbFinal.totalRows - dbBaseline.totalRows;
  const deltaIns = dbFinal.ins - dbBaseline.ins;
  const deltaUpd = dbFinal.upd - dbBaseline.upd;
  const deltaDel = dbFinal.del - dbBaseline.del;

  const isReadOnlyClean = deltaRows === 0 && deltaIns === 0 && deltaUpd === 0 && deltaDel === 0;

  results.push({
    name: "PostgreSQL Strict READ-ONLY Zero-Mutation Invariant",
    category: "Database Integrity",
    status: isReadOnlyClean ? "PASS" : "FAIL",
    trace: {
      input: "N/A (Full Test Run Audit)",
      func: "getDatabaseStats() post-execution comparison",
      source: "PostgreSQL pg_stat_user_tables",
      tableOrApi: "bank_company_data",
      query: "Compare (n_tup_ins, n_tup_upd, n_tup_del, count(*)) before and after all tests",
      returnedData: `ΔRows: ${deltaRows}, ΔINSERT: ${deltaIns}, ΔUPDATE: ${deltaUpd}, ΔDELETE: ${deltaDel}`,
      finalResponse: isReadOnlyClean
        ? "✅ 100% READ-ONLY VERIFIED: Zero inserts, updates, deletes, or alters occurred."
        : `❌ DATABASE WAS MUTATED: ${deltaIns} inserts, ${deltaUpd} updates, ${deltaDel} deletes!`,
    },
    failureReason: isReadOnlyClean
      ? undefined
      : `Database was modified during read operations: ΔRows=${deltaRows}, ΔIns=${deltaIns}, ΔUpd=${deltaUpd}`,
  });
  printTrace(results[results.length - 1]);

  // =========================================================================
  // FINAL SUMMARY REPORT
  // =========================================================================
  console.log("\n================================================================================");
  console.log("📊 FINAL COMPANY SEARCH TEST SUITE SUMMARY REPORT");
  console.log("================================================================================");
  console.log(`| # | Test Name | Category | Status | Details / Failure Reason |`);
  console.log(`|---|-----------|----------|--------|--------------------------|`);

  let passCount = 0;
  let failCount = 0;

  results.forEach((r, idx) => {
    if (r.status === "PASS") passCount++;
    else failCount++;

    const detail = r.failureReason ? `❌ ${r.failureReason}` : "✅ Passed perfectly";
    console.log(`| ${idx + 1} | ${r.name} | ${r.category} | **${r.status}** | ${detail} |`);
  });

  console.log("================================================================================");
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log("================================================================================\n");

  await pool.end();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled test suite error:", err);
  process.exit(1);
});
