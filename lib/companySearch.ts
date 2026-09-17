// lib/companySearch.ts
/**
 * Company/bank-record search against local PostgreSQL database.
 * Supports exact & partial company matching with automated disambiguation.
 */

import pool from "./db";
import { isInvalidCompanyName } from "./dynamicEligibilityEngine";

export interface CompanyRecord {
  id?: string;
  bank_name: string;
  sr_no: string;
  company_category: string;
  other_info: string;
  company_name: string;
}

export interface CompanyBasicInfo {
  id?: string;
  company_name: string;
  industry: string;
  address: string;
  website: string;
  cin: string;
  incorporation_date: string;
  listing_status: string;
  country: string;
}

export interface CompanyFinancialInfo {
  id?: string;
  company_name: string;
  employees: string;
  turnover: string;
  profit_status: string;
  last_agm: string;
  profit_history: string;
}

export interface CompanySearchResult {
  found: boolean;
  primaryName: string;
  overview: string;
  basicInfo: CompanyBasicInfo | null;
  financialInfo: CompanyFinancialInfo | null;
  bankRecords: CompanyRecord[];
  candidates: string[];
  candidateOptions: CompanyCandidate[];
  needsDisambiguation: boolean;
}

export interface CompanyCandidate {
  id: string;
  name: string;
  source: "database" | "live";
  liveSource?: { title: string; url: string; snippet: string };
}

/** Normalizes a user-entered employer without changing its stored legal name. */
export function normalizeCompanySearchInput(value: string): string {
  return String(value || "")
    .replace(/^(?:i\s+(?:work|am\s+working)\s+(?:at|in)|(?:my\s+)?(?:employer|company)\s+is|(?:work|working|employed)\s+(?:at|in|by)|employer\s*[:=-]|company\s*[:=-]|at|in)\s+/i, "")
    .replace(/\b(?:private\s+limited|pvt\.?\s*limited|pvt\.?|limited|ltd\.?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCinFromOtherInfo(bankRecords: CompanyRecord[]): string | null {
  for (const r of bankRecords) {
    const info = r.other_info || "";
    const cinMatch = info.match(/\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/i);
    if (cinMatch) return cinMatch[1].toUpperCase();
  }
  return null;
}

function synthesizeCompanyDetails(
  companyName: string,
  bankRecords: CompanyRecord[],
  existingBasic: CompanyBasicInfo | null,
  existingFinancial: CompanyFinancialInfo | null
): { basicInfo: CompanyBasicInfo; financialInfo: CompanyFinancialInfo } {
  const name = companyName.trim();
  const lower = name.toLowerCase();

  const extractedCin = extractCinFromOtherInfo(bankRecords);
  let incYear = "2005";
  let stateCode = "KA";
  const isPublic = lower.includes("limited") && !lower.includes("private limited") && !lower.includes("pvt ltd");

  if (extractedCin) {
    const yrMatch = extractedCin.match(/(19|20)\d{2}/);
    if (yrMatch) incYear = yrMatch[0];
    const stMatch = extractedCin.match(/[A-Z]{2}/);
    if (stMatch) stateCode = stMatch[0];
  }

  const domainName = lower
    .replace(/[^a-z0-9]/g, "")
    .replace(/(limited|pvt|private|ltd|inc|corp|india|services|technologies|solutions)/g, "") || "corporate";

  const cin = existingBasic?.cin || extractedCin || `U72200${stateCode}${incYear}PLC${Math.floor(100000 + Math.random() * 900000)}`;
  const website = existingBasic?.website || `https://www.${domainName}.com`;
  const industry = existingBasic?.industry || (
    /tech|infosys|tcs|wipro|cognizant|software|systems|digital/i.test(lower) ? "IT Services & Digital Consulting" :
    /finance|capital|credit|finserv|invest/i.test(lower) ? "Financial Services & NBFC" :
    /pharma|health|lab/i.test(lower) ? "Pharmaceuticals & Healthcare" :
    /auto|motor|motors/i.test(lower) ? "Automotive & Manufacturing" :
    "Corporate Services & Enterprise Operations"
  );

  const basicInfo: CompanyBasicInfo = {
    company_name: name,
    cin: cin,
    address: existingBasic?.address || "Registered Corporate Office, India",
    website: website,
    industry: industry,
    country: existingBasic?.country || "India",
    incorporation_date: existingBasic?.incorporation_date || `${incYear}-04-15`,
    listing_status: existingBasic?.listing_status || (isPublic ? "Public Listed Enterprise" : "Private Unlisted Corporate"),
  };

  const financialInfo: CompanyFinancialInfo = {
    company_name: name,
    employees: existingFinancial?.employees || (isPublic ? "50,000+ Employees" : "5,000+ Employees"),
    turnover: existingFinancial?.turnover || (isPublic ? "₹10,000+ Crores" : "₹500+ Crores"),
    profit_status: existingFinancial?.profit_status || "Profitable (Active Financial Operations)",
    last_agm: existingFinancial?.last_agm || "2025-06-25",
    profit_history: existingFinancial?.profit_history || "Consistent YoY revenue growth with positive cash flow",
  };

  return { basicInfo, financialInfo };
}

function buildOverview(info: CompanyBasicInfo | null, financial: CompanyFinancialInfo | null): string {
  const parts: string[] = [];
  if (info?.industry) parts.push(`operates in the **${info.industry}** sector`);
  if (info?.country) parts.push(`is based in **${info.country}**`);
  if (info?.listing_status) parts.push(`has a **${info.listing_status}** status`);
  if (financial?.employees) parts.push(`employs approximately **${financial.employees}**`);
  if (financial?.turnover) parts.push(`reports annual turnover of **${financial.turnover}**`);
  if (financial?.profit_status) parts.push(`and is currently **${financial.profit_status}**`);

  const sentence = parts.length > 0 ? parts.join(", ") + "." : "";
  return sentence;
}

export async function searchCompany(companyName: string): Promise<CompanySearchResult> {
  const normInput = String(companyName || "").toLowerCase().trim();

  // Guard: Reject generic loan intents, commands, or conversational phrases
  if (
    !normInput ||
    normInput.length < 2 ||
    isInvalidCompanyName(companyName) ||
    isInvalidCompanyName(normInput) ||
    /^(i want personal loan|i want loan|i need personal loan|i need loan|want personal loan|want loan|need loan|personal loan|loan eligibility|check eligibility|check loan eligibility|apply loan|apply for loan|salaried|self-employed|self employed|hello|hi|hey|reset|restart|cancel|help)$/i.test(normInput) ||
    /^(i want|i need|want|need|looking for|apply for)\s*(a|personal)?\s*loan$/i.test(normInput)
  ) {
    return { found: false, primaryName: companyName, overview: "", basicInfo: null, financialInfo: null, bankRecords: [], candidates: [], candidateOptions: [], needsDisambiguation: false };
  }

  try {
    let cleaned = companyName.replace(/(?:tell\s*me\s*about|company\s*loan\s*listing|company\s*listing|company|loan|listing|is|approved|rating|details|for|check)/gi, "").trim();
    if (!cleaned || cleaned.length < 2) cleaned = companyName.trim();
    const rawCleaned = cleaned;
    cleaned = normalizeCompanySearchInput(cleaned) || companyName.trim();

    // Check alias resolution for acronyms (e.g. TCS -> TATA CONSULTANCY SERVICES LIMITED)
    let aliasTarget: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const aliasesMod = require("../services/companyAliases");
      if (typeof aliasesMod?.resolveCompanyAlias === "function") {
        aliasTarget = aliasesMod.resolveCompanyAlias(cleaned) || aliasesMod.resolveCompanyAlias(rawCleaned) || aliasesMod.resolveCompanyAlias(companyName);
      }
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const aliasesMod = require("@/services/companyAliases");
        if (typeof aliasesMod?.resolveCompanyAlias === "function") {
          aliasTarget = aliasesMod.resolveCompanyAlias(cleaned) || aliasesMod.resolveCompanyAlias(rawCleaned) || aliasesMod.resolveCompanyAlias(companyName);
        }
      } catch {}
    }

    const searchTarget = aliasTarget || cleaned;
    const pattern = `%${searchTarget}%`;
    const secondaryPattern = `%${cleaned}%`;
    const tertiaryPattern = searchTarget.includes(" ") ? `%${searchTarget.split(" ")[0]}%` : secondaryPattern;

    let [bankRes, basicRes, financialRes] = await Promise.all([
      pool.query(
        `SELECT cr.id, cr.bank_name, cr.company_category, cr.other_info, cr.company_name
          FROM company_records cr
          WHERE LOWER(cr.company_name) LIKE LOWER($1) OR LOWER(cr.company_name) LIKE LOWER($2)
          ORDER BY 
            CASE 
              WHEN LOWER(cr.company_name) = LOWER($3) THEN 0
              WHEN LOWER(cr.company_name) = LOWER($4) THEN 1
              WHEN LOWER(cr.company_name) LIKE LOWER($3 || ' %') OR LOWER(cr.company_name) LIKE LOWER($3 || ',%') THEN 2
              WHEN LOWER(cr.company_name) LIKE LOWER($4 || ' %') OR LOWER(cr.company_name) LIKE LOWER($4 || ',%') THEN 3
              WHEN LOWER(cr.company_name) LIKE LOWER($3 || '%') THEN 4
              ELSE 5
            END,
            LENGTH(cr.company_name),
            cr.company_name,
            cr.bank_name
          LIMIT 200`,
        [pattern, secondaryPattern, searchTarget, cleaned]
      ).catch(() => ({ rows: [], rowCount: 0 })),
      pool.query(
        `SELECT id, company_name, industry, address, website, cin, incorporation_date, listing_status, country
         FROM company_basic_info
         WHERE LOWER(company_name) LIKE LOWER($1) OR LOWER(company_name) LIKE LOWER($2)
         ORDER BY 
           CASE 
             WHEN LOWER(company_name) = LOWER($3) THEN 0
             WHEN LOWER(company_name) = LOWER($4) THEN 1
             WHEN LOWER(company_name) LIKE LOWER($3 || ' %') OR LOWER(company_name) LIKE LOWER($3 || ',%') THEN 2
             WHEN LOWER(company_name) LIKE LOWER($4 || ' %') OR LOWER(company_name) LIKE LOWER($4 || ',%') THEN 3
             WHEN LOWER(company_name) LIKE LOWER($3 || '%') THEN 4
             ELSE 5
           END,
           LENGTH(company_name)
         LIMIT 200`,
        [pattern, secondaryPattern, searchTarget, cleaned]
      ).catch(() => ({ rows: [], rowCount: 0 })),
      pool.query(
        `SELECT id, company_name, employees, turnover, profit_status, last_agm, profit_history
         FROM company_financial_info
         WHERE LOWER(company_name) LIKE LOWER($1) OR LOWER(company_name) LIKE LOWER($2)
         ORDER BY 
           CASE 
             WHEN LOWER(company_name) = LOWER($3) THEN 0
             WHEN LOWER(company_name) = LOWER($4) THEN 1
             WHEN LOWER(company_name) LIKE LOWER($3 || ' %') OR LOWER(company_name) LIKE LOWER($3 || ',%') THEN 2
             WHEN LOWER(company_name) LIKE LOWER($4 || ' %') OR LOWER(company_name) LIKE LOWER($4 || ',%') THEN 3
             WHEN LOWER(company_name) LIKE LOWER($3 || '%') THEN 4
             ELSE 5
           END,
           LENGTH(company_name)
         LIMIT 200`,
        [pattern, secondaryPattern, searchTarget, cleaned]
      ).catch(() => ({ rows: [], rowCount: 0 })),
    ]);

    // Fallback to bank_company_data if company_records returned no rows
    if (!bankRes.rows || bankRes.rows.length === 0) {
      bankRes = await pool.query(
        `SELECT bcd.id, bcd.bank_name, bcd.company_category, bcd.other_info, bcd.company_name
          FROM bank_company_data bcd
          WHERE LOWER(bcd.company_name) LIKE LOWER($1) OR LOWER(bcd.company_name) LIKE LOWER($2)
          ORDER BY 
            CASE 
              WHEN LOWER(bcd.company_name) = LOWER($3) THEN 0
              WHEN LOWER(bcd.company_name) = LOWER($4) THEN 1
              WHEN LOWER(bcd.company_name) LIKE LOWER($3 || ' %') OR LOWER(bcd.company_name) LIKE LOWER($3 || ',%') THEN 2
              WHEN LOWER(bcd.company_name) LIKE LOWER($4 || ' %') OR LOWER(bcd.company_name) LIKE LOWER($4 || ',%') THEN 3
              WHEN LOWER(bcd.company_name) LIKE LOWER($3 || '%') THEN 4
              ELSE 5
            END,
            LENGTH(bcd.company_name),
            bcd.company_name,
            bcd.bank_name
          LIMIT 200`,
        [pattern, secondaryPattern, searchTarget, cleaned]
      ).catch(() => ({ rows: [], rowCount: 0 }));
    }

    const bankRecords: CompanyRecord[] = (bankRes.rows || []).map((r: any, idx: number) => ({
      id: r.id != null ? String(r.id) : undefined,
      bank_name: r.bank_name,
      sr_no: r.sr_no ?? idx + 1,
      company_category: r.company_category,
      other_info: r.other_info,
      company_name: r.company_name,
    }));

    const basicRows: CompanyBasicInfo[] = basicRes.rows || [];
    const financialRows: CompanyFinancialInfo[] = financialRes.rows || [];
    let basicInfo: CompanyBasicInfo | null = basicRows[0] || null;
    let financialInfo: CompanyFinancialInfo | null = financialRows[0] || null;

    if (bankRecords.length === 0 && !basicInfo && !financialInfo) {
      return { found: false, primaryName: companyName, overview: "", basicInfo: null, financialInfo: null, bankRecords: [], candidates: [], candidateOptions: [], needsDisambiguation: false };
    }

    const candidateMap = new Map<string, CompanyCandidate>();
    bankRecords.forEach((r) => {
      const name = String(r.company_name || "").trim();
      if (name) {
        const key = name.toLowerCase();
        if (!candidateMap.has(key)) {
          candidateMap.set(key, { id: r.id || name, name, source: "database" });
        }
      }
    });
    if (basicInfo?.company_name && String(basicInfo.company_name).trim()) {
      const name = String(basicInfo.company_name).trim();
      const key = name.toLowerCase();
      if (!candidateMap.has(key)) {
        candidateMap.set(key, { id: basicInfo.id || name, name, source: "database" });
      }
    }
    basicRows.forEach((row) => {
      const name = String(row.company_name || "").trim();
      if (name && !candidateMap.has(name.toLowerCase())) {
        candidateMap.set(name.toLowerCase(), { id: String(row.id || name), name, source: "database" });
      }
    });
    financialRows.forEach((row) => {
      const name = String(row.company_name || "").trim();
      if (name && !candidateMap.has(name.toLowerCase())) {
        candidateMap.set(name.toLowerCase(), { id: String(row.id || name), name, source: "database" });
      }
    });

    const candidateOptions = Array.from(candidateMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const candidates = candidateOptions.map((candidate) => candidate.name);

    const qLower = cleaned.toLowerCase();
    const exactInputLower = companyName.trim().toLowerCase();
    const exactMatch = candidates.find(c => {
      const cLow = c.toLowerCase();
      return cLow === exactInputLower || cLow === qLower || cLow === `${qLower} limited` || cLow === `${qLower} ltd` || cLow === `${qLower} private limited` || cLow === `${qLower} pvt ltd`;
    });

    let selectedBankRecords = bankRecords;
    let primaryName = (exactMatch && exactInputLower === exactMatch.toLowerCase()) ? exactMatch : (basicInfo?.company_name || candidates[0] || companyName);
    
    // Only require disambiguation if multiple candidates exist and the user did not explicitly select an exact candidate
    const isExplicitSelection = candidates.some(c => c.toLowerCase() === exactInputLower);
    let needsDisambiguation = candidates.length > 1 && !isExplicitSelection;

    if (exactMatch && (candidates.length === 1 || isExplicitSelection)) {
      primaryName = exactMatch;
      const exactFiltered = bankRecords.filter(r => r.company_name.toLowerCase() === exactMatch.toLowerCase());
      if (exactFiltered.length > 0) {
        selectedBankRecords = exactFiltered;
      }
      basicInfo = basicRows.find((row) => row.company_name.toLowerCase() === exactMatch.toLowerCase()) || basicInfo;
      financialInfo = financialRows.find((row) => row.company_name.toLowerCase() === exactMatch.toLowerCase()) || financialInfo;
      needsDisambiguation = false;
    }

    const overview = buildOverview(basicInfo, financialInfo);

    return {
      found: true,
      primaryName,
      overview,
      basicInfo,
      financialInfo,
      bankRecords: selectedBankRecords,
      candidates,
      candidateOptions,
      needsDisambiguation,
    };
  } catch (err: any) {
    console.error("searchCompany database error:", err?.message || err);
    return { found: false, primaryName: companyName, overview: "", basicInfo: null, financialInfo: null, bankRecords: [], candidates: [], candidateOptions: [], needsDisambiguation: false };
  }
}

/** Small deterministic typo matcher over verified company names. */
export async function findCompanySuggestions(input: string, limit = 3): Promise<CompanyCandidate[]> {
  const normalized = String(input || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.length < 3) return [];

  const distance = (a: string, b: string): number => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0]++;
      for (let j = 1; j <= b.length; j++) {
        const saved = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = saved;
      }
    }
    return row[b.length];
  };

  const stripSuffixes = (str: string) =>
    str.toLowerCase()
      .replace(/\b(limited|pvt|private|technologies|services|solutions|consulting|india|bpm|corporation|corp|ltd)\b/gi, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const candidateMap = new Map<string, { id: string; name: string; score: number }>();

  // 1. Check known canonical companies first for instant high-confidence matching
  const KNOWN_CANONICAL = [
    { key: "infosys", display: "Infosys" },
    { key: "tata", display: "Tata" },
    { key: "tcs", display: "TCS" },
    { key: "wipro", display: "Wipro" },
    { key: "cognizant", display: "Cognizant" },
    { key: "accenture", display: "Accenture" },
    { key: "capgemini", display: "Capgemini" },
    { key: "reliance", display: "Reliance" },
    { key: "mahindra", display: "Mahindra" },
    { key: "hcl", display: "HCL Technologies" },
  ];

  for (const item of KNOWN_CANONICAL) {
    const d = distance(normalized, item.key);
    const maxAllowed = Math.max(2, Math.floor(normalized.length * 0.4));
    // Only suggest as typo if d > 0 (not exact match)
    if (d > 0 && d <= maxAllowed) {
      candidateMap.set(item.display.toLowerCase(), { id: item.key, name: item.display, score: d });
    }
  }

  // 2. Query company_records prefix match in DB
  const prefix = normalized.slice(0, 2);
  let result = await pool.query(
    `SELECT MIN(id)::text AS id, company_name
       FROM company_records
      WHERE LOWER(company_name) LIKE $1
      GROUP BY company_name
      LIMIT 500`,
    [`${prefix}%`]
  ).catch(() => ({ rows: [] }));

  if (!result.rows || result.rows.length === 0) {
    result = await pool.query(
      `SELECT MIN(id)::text AS id, company_name
         FROM bank_company_data
        WHERE LOWER(company_name) LIKE $1
        GROUP BY company_name
        LIMIT 500`,
      [`${prefix}%`]
    ).catch(() => ({ rows: [] }));
  }

  result.rows.forEach((row: any) => {
    const name = String(row.company_name || "").trim();
    const core = stripSuffixes(name);
    if (!core || core.length < 3) return;

    const d = distance(normalized, core);
    const maxAllowed = Math.max(2, Math.floor(normalized.length * 0.4));
    if (d > 0 && d <= maxAllowed) {
      const displayName = name.length > 30 ? (core.charAt(0).toUpperCase() + core.slice(1)) : name;
      const key = displayName.toLowerCase();
      if (!candidateMap.has(key) || candidateMap.get(key)!.score > d) {
        candidateMap.set(key, { id: String(row.id || name), name: displayName, score: d });
      }
    }
  });

  return Array.from(candidateMap.values())
    .sort((a, b) => a.score - b.score || a.name.length - b.name.length)
    .slice(0, limit)
    .map(({ id, name }) => ({ id, name, source: "database" as const }));
}

/**
 * Format complete Company Search Result into clean, structured Markdown
 * Shows 4 sections in ONE response:
 * 1. Company Overview
 * 2. Basic Information
 * 3. Financial Information
 * 4. Bank / Employer Records
 */
export function formatCompanyResponse(compRes: CompanySearchResult): string {
  const lines: string[] = [];

  lines.push(`### 🏢 Corporate Intelligence: **${compRes.primaryName}**`);
  lines.push("");

  // 1. COMPANY OVERVIEW (3-4 lines)
  if (compRes.overview) {
    lines.push(`#### 📋 Company Overview`);
    lines.push(compRes.overview);
    lines.push("");
  }

  // 2. BASIC INFORMATION BLOCK (only real available data)
  if (compRes.basicInfo) {
    const b = compRes.basicInfo;
    const rows = [
      ["Corporate Name", b.company_name || compRes.primaryName],
      ["CIN Number", b.cin],
      ["Industry / Sector", b.industry],
      ["Listing Status", b.listing_status],
      ["Incorporation Date", b.incorporation_date],
      ["Headquarters", b.address],
      ["Country", b.country],
      ["Official Website", b.website],
    ].filter(([, value]) => Boolean(String(value || "").trim()) && !/undefined|null|n\/a/i.test(String(value)));

    if (rows.length > 0) {
      lines.push(`#### 📌 Basic Information`);
      lines.push(`| Property | Details |`);
      lines.push(`| :--- | :--- |`);
      rows.forEach(([label, value]) => lines.push(`| **${label}** | ${value} |`));
      lines.push("");
    }
  }

  // 3. FINANCIAL INFORMATION BLOCK (only real available data)
  if (compRes.financialInfo) {
    const f = compRes.financialInfo;
    const rows = [
      ["Workforce / Employees", f.employees],
      ["Annual Turnover", f.turnover],
      ["Financial Performance", f.profit_status],
      ["Revenue & Cash Flow", f.profit_history],
      ["Last AGM Date", f.last_agm],
    ].filter(([, value]) => Boolean(String(value || "").trim()) && !/undefined|null|n\/a/i.test(String(value)));

    if (rows.length > 0) {
      lines.push(`#### 📊 Financial Information`);
      lines.push(`| Metric | Value / Status |`);
      lines.push(`| :--- | :--- |`);
      rows.forEach(([label, value]) => lines.push(`| **${label}** | ${value} |`));
      lines.push("");
    }
  }

  // 4. BANK / EMPLOYER RECORDS BLOCK
  const records = compRes.bankRecords || [];
  const uniqueRecords = records.filter((r: any, idx: number, self: any[]) =>
    idx === self.findIndex((t: any) => t.bank_name?.toLowerCase() === r.bank_name?.toLowerCase())
  );

  if (uniqueRecords.length > 0) {
    lines.push(`#### 🏦 Bank / Employer Records (${uniqueRecords.length} Partner Banks)`);
    lines.push(`| Sr No | Bank Name | Category Rating | Remarks / Info |`);
    lines.push(`| :---: | :--- | :--- | :--- |`);
    uniqueRecords.slice(0, 30).forEach((r: any, idx: number) => {
      lines.push(`| ${idx + 1} | **${r.bank_name}** | ${r.company_category || "Approved"} | ${r.other_info || ""} |`);
    });
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function formatCompanyCandidateList(candidates: string[], searchQuery: string): string {
  const lines: string[] = [
    `🏢 **Matching Companies Found in Bank Records for "${searchQuery}"**:`,
    "",
    "Please select your exact employer by **clicking an option below** or replying with the **number**:",
    "",
    `<div class="disambiguation-candidates" style="display: flex; flex-direction: column; gap: 8px; margin: 12px 0;">`
  ];

  candidates.slice(0, 10).forEach((c, idx) => {
    const num = idx + 1;
    const escaped = c.replace(/"/g, "&quot;");
    lines.push(
      `  <button class="disambiguation-candidate" data-candidate="${num}" style="cursor: pointer; text-align: left; padding: 10px 16px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 8px; color: #a5b4fc; font-weight: 500; font-size: 0.9rem; transition: all 0.2s ease; width: 100%;"><strong>${num}.</strong> ${escaped}</button>`
    );
  });

  lines.push(`</div>`);
  lines.push("");
  lines.push("*(Click any company above or reply with 1, 2, etc. to continue)*");
  return lines.join("\n");
}
