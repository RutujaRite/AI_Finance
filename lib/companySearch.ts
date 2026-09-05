// lib/companySearch.ts
/**
 * Company / bank-record search against local PostgreSQL database.
 *
 * IMPORTANT:
 * - PostgreSQL is the source of truth.
 * - This file does NOT invent company information.
 * - Missing information is returned as "Not available".
 * - Company disambiguation is handled using verified database records.
 */

import pool from "./db";

export interface CompanyRecord {
  bank_name: string;
  sr_no: string;
  company_category: string;
  other_info: string;
  company_name: string;
}

export interface CompanyBasicInfo {
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
  needsDisambiguation: boolean;
}

/**
 * Safely extract a CIN only when it is actually present
 * inside verified bank-record information.
 */
function extractCinFromOtherInfo(
  bankRecords: CompanyRecord[]
): string | null {
  for (const record of bankRecords) {
    const info = String(record.other_info || "");

    const cinMatch = info.match(
      /\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/i
    );

    if (cinMatch) {
      return cinMatch[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Do NOT invent missing company information.
 *
 * Existing database values take priority.
 * CIN may also be extracted from verified bank-record metadata.
 */
function synthesizeCompanyDetails(
  companyName: string,
  bankRecords: CompanyRecord[],
  existingBasic: CompanyBasicInfo | null,
  existingFinancial: CompanyFinancialInfo | null
): {
  basicInfo: CompanyBasicInfo;
  financialInfo: CompanyFinancialInfo;
} {
  const name =
    String(
      existingBasic?.company_name ||
        existingFinancial?.company_name ||
        companyName ||
        ""
    ).trim();

  const extractedCin =
    extractCinFromOtherInfo(bankRecords);

  const basicInfo: CompanyBasicInfo = {
    company_name:
      existingBasic?.company_name ||
      name ||
      "Not available",

    cin:
      existingBasic?.cin ||
      extractedCin ||
      "Not available",

    address:
      existingBasic?.address ||
      "Not available",

    website:
      existingBasic?.website ||
      "Not available",

    industry:
      existingBasic?.industry ||
      "Not available",

    incorporation_date:
      existingBasic?.incorporation_date ||
      "Not available",

    listing_status:
      existingBasic?.listing_status ||
      "Not available",

    country:
      existingBasic?.country ||
      "Not available",
  };

  const financialInfo: CompanyFinancialInfo = {
    company_name:
      existingFinancial?.company_name ||
      name ||
      "Not available",

    employees:
      existingFinancial?.employees ||
      "Not available",

    turnover:
      existingFinancial?.turnover ||
      "Not available",

    profit_status:
      existingFinancial?.profit_status ||
      "Not available",

    last_agm:
      existingFinancial?.last_agm ||
      "Not available",

    profit_history:
      existingFinancial?.profit_history ||
      "Not available",
  };

  return {
    basicInfo,
    financialInfo,
  };
}

/**
 * Build a short factual company overview.
 *
 * Only fields that actually exist are included.
 */
function buildOverview(
  info: CompanyBasicInfo | null,
  financial: CompanyFinancialInfo | null
): string {
  const parts: string[] = [];

  if (
    info?.industry &&
    info.industry !== "Not available"
  ) {
    parts.push(
      `operates in the **${info.industry}** sector`
    );
  }

  if (
    info?.country &&
    info.country !== "Not available"
  ) {
    parts.push(
      `is based in **${info.country}**`
    );
  }

  if (
    info?.listing_status &&
    info.listing_status !== "Not available"
  ) {
    parts.push(
      `has a **${info.listing_status}** listing status`
    );
  }

  if (
    financial?.employees &&
    financial.employees !== "Not available"
  ) {
    parts.push(
      `employs approximately **${financial.employees}**`
    );
  }

  if (
    financial?.turnover &&
    financial.turnover !== "Not available"
  ) {
    parts.push(
      `reports annual turnover of **${financial.turnover}**`
    );
  }

  if (
    financial?.profit_status &&
    financial.profit_status !== "Not available"
  ) {
    parts.push(
      `has a financial status of **${financial.profit_status}**`
    );
  }

  if (parts.length === 0) {
    return "";
  }

  return `${parts.join(", ")}.`;
}

/**
 * Remove common conversational words from a company search.
 *
 * This is NOT AI intent detection.
 * It only cleans the database search string.
 */
function cleanCompanySearchInput(
  companyName: string
): string {
  let cleaned = String(companyName || "")
    .trim()
    .replace(
      /(?:tell\s*me\s*about|company\s*loan\s*listing|company\s*listing|company|loan|listing|approved|rating|details|check)/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 2) {
    cleaned = String(companyName || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  return cleaned;
}

/**
 * Determine whether a message is clearly not a company search.
 *
 * This is only a safety guard for database searching.
 * The central AI agent remains responsible for intent understanding.
 */
function isClearlyNonCompanyInput(
  normalizedInput: string
): boolean {
  if (!normalizedInput) {
    return true;
  }

  if (normalizedInput.length < 2) {
    return true;
  }

  const exactNonCompanyInputs =
    /^(i want personal loan|i want loan|i need personal loan|i need loan|want personal loan|want loan|need loan|personal loan|loan eligibility|check eligibility|check loan eligibility|apply loan|apply for loan|salaried|self-employed|self employed|hello|hi|hey|reset|restart|cancel|help)$/i;

  if (exactNonCompanyInputs.test(normalizedInput)) {
    return true;
  }

  const genericLoanRequest =
    /^(i want|i need|want|need|looking for|apply for)\s*(a|personal)?\s*loan$/i;

  if (genericLoanRequest.test(normalizedInput)) {
    return true;
  }

  return false;
}

export async function searchCompany(
  companyName: string
): Promise<CompanySearchResult> {
  const originalInput =
    String(companyName || "").trim();

  const normInput =
    originalInput.toLowerCase();

  // ------------------------------------------------------------
  // SAFETY GUARD
  // ------------------------------------------------------------

  if (
    isClearlyNonCompanyInput(normInput)
  ) {
    return {
      found: false,
      primaryName: originalInput,
      overview: "",
      basicInfo: null,
      financialInfo: null,
      bankRecords: [],
      candidates: [],
      needsDisambiguation: false,
    };
  }

  const client = await pool.connect();

  try {
    // ----------------------------------------------------------
    // CLEAN SEARCH TERM
    // ----------------------------------------------------------

    const cleaned =
      cleanCompanySearchInput(originalInput);

    if (!cleaned || cleaned.length < 2) {
      return {
        found: false,
        primaryName: originalInput,
        overview: "",
        basicInfo: null,
        financialInfo: null,
        bankRecords: [],
        candidates: [],
        needsDisambiguation: false,
      };
    }

    const pattern = `%${cleaned}%`;

    // ----------------------------------------------------------
    // SEARCH THREE DATA SOURCES
    //
    // 1. Bank company master
    // 2. Basic company information
    // 3. Financial company information
    // ----------------------------------------------------------

    const [
      bankRes,
      basicRes,
      financialRes,
    ] = await Promise.all([
      client.query(
        `SELECT
           bcd.bank_name,
           bcd.sr_no,
           bcd.company_category,
           bcd.other_info,
           bcd.company_name
         FROM bank_company_data bcd
         WHERE LOWER(bcd.company_name) LIKE LOWER($1)
         ORDER BY
           bcd.company_name,
           bcd.bank_name,
           bcd.sr_no
         LIMIT 200`,
        [pattern]
      ),

      client.query(
        `SELECT
           company_name,
           industry,
           address,
           website,
           cin,
           incorporation_date,
           listing_status,
           country
         FROM company_basic_info
         WHERE LOWER(company_name) LIKE LOWER($1)
         ORDER BY company_name
         LIMIT 1`,
        [pattern]
      ),

      client.query(
        `SELECT
           company_name,
           employees,
           turnover,
           profit_status,
           last_agm,
           profit_history
         FROM company_financial_info
         WHERE LOWER(company_name) LIKE LOWER($1)
         ORDER BY company_name
         LIMIT 1`,
        [pattern]
      ),
    ]);

    // ----------------------------------------------------------
    // NORMALIZE BANK RECORDS
    // ----------------------------------------------------------

    const bankRecords: CompanyRecord[] =
      bankRes.rows.map((row: any) => ({
        bank_name:
          row.bank_name || "",

        sr_no:
          row.sr_no != null
            ? String(row.sr_no)
            : "",

        company_category:
          row.company_category || "",

        other_info:
          row.other_info || "",

        company_name:
          row.company_name || "",
      }));

    let basicInfo: CompanyBasicInfo | null =
      (basicRes.rowCount ?? 0) > 0
        ? basicRes.rows[0]
        : null;

    let financialInfo: CompanyFinancialInfo | null =
      (financialRes.rowCount ?? 0) > 0
        ? financialRes.rows[0]
        : null;

    // ----------------------------------------------------------
    // NOTHING FOUND
    // ----------------------------------------------------------

    if (
      bankRecords.length === 0 &&
      !basicInfo &&
      !financialInfo
    ) {
      return {
        found: false,
        primaryName: originalInput,
        overview: "",
        basicInfo: null,
        financialInfo: null,
        bankRecords: [],
        candidates: [],
        needsDisambiguation: false,
      };
    }

    // ----------------------------------------------------------
    // BUILD UNIQUE COMPANY CANDIDATES
    // ----------------------------------------------------------

    const candidateMap =
      new Map<string, string>();

    for (const record of bankRecords) {
      const name =
        String(
          record.company_name || ""
        ).trim();

      if (!name) {
        continue;
      }

      const key =
        name.toLowerCase();

      if (!candidateMap.has(key)) {
        candidateMap.set(key, name);
      }
    }

    if (
      basicInfo?.company_name &&
      String(
        basicInfo.company_name
      ).trim()
    ) {
      const name =
        String(
          basicInfo.company_name
        ).trim();

      const key =
        name.toLowerCase();

      if (!candidateMap.has(key)) {
        candidateMap.set(key, name);
      }
    }

    if (
      financialInfo?.company_name &&
      String(
        financialInfo.company_name
      ).trim()
    ) {
      const name =
        String(
          financialInfo.company_name
        ).trim();

      const key =
        name.toLowerCase();

      if (!candidateMap.has(key)) {
        candidateMap.set(key, name);
      }
    }

    const candidates =
      Array.from(
        candidateMap.values()
      ).sort(
        (a, b) =>
          a.localeCompare(b)
      );

    // ----------------------------------------------------------
    // FIND EXACT / STRONG COMPANY MATCH
    // ----------------------------------------------------------

    const qLower =
      cleaned.toLowerCase().trim();

    const exactMatch =
      candidates.find((candidate) => {
        const candidateLower =
          candidate.toLowerCase().trim();

        if (
          candidateLower === qLower
        ) {
          return true;
        }

        const variations = [
          `${qLower} limited`,
          `${qLower} ltd`,
          `${qLower} private limited`,
          `${qLower} pvt ltd`,
          `${qLower} pvt. ltd`,
          `${qLower} private ltd`,
        ];

        return variations.includes(
          candidateLower
        );
      });

    // ----------------------------------------------------------
    // SELECT PRIMARY COMPANY
    // ----------------------------------------------------------

    let primaryName =
      basicInfo?.company_name ||
      financialInfo?.company_name ||
      candidates[0] ||
      originalInput;

    let selectedBankRecords =
      bankRecords;

    let needsDisambiguation =
      candidates.length > 1;

    // ----------------------------------------------------------
    // EXACT MATCH OVERRIDES AMBIGUITY
    // ----------------------------------------------------------

    if (exactMatch) {
      primaryName =
        exactMatch;

      const exactFiltered =
        bankRecords.filter(
          (record) =>
            String(
              record.company_name || ""
            )
              .trim()
              .toLowerCase() ===
            exactMatch
              .trim()
              .toLowerCase()
        );

      if (
        exactFiltered.length > 0
      ) {
        selectedBankRecords =
          exactFiltered;
      }

      needsDisambiguation =
        false;
    }

    // ----------------------------------------------------------
    // IF MULTIPLE COMPANIES MATCH
    //
    // Don't silently select a company unless there is a
    // strong/exact match.
    // ----------------------------------------------------------

    if (
      !exactMatch &&
      candidates.length > 1
    ) {
      return {
        found: true,
        primaryName:
          candidates[0] ||
          originalInput,
        overview: "",
        basicInfo: null,
        financialInfo: null,
        bankRecords: [],
        candidates,
        needsDisambiguation: true,
      };
    }

    // ----------------------------------------------------------
    // ENRICH ONLY FROM VERIFIED DATABASE INFORMATION
    // ----------------------------------------------------------

    const synthesized =
      synthesizeCompanyDetails(
        primaryName,
        selectedBankRecords,
        basicInfo,
        financialInfo
      );

    basicInfo =
      synthesized.basicInfo;

    financialInfo =
      synthesized.financialInfo;

    const overview =
      buildOverview(
        basicInfo,
        financialInfo
      );

    // ----------------------------------------------------------
    // FINAL RESULT
    // ----------------------------------------------------------

    return {
      found: true,

      primaryName,

      overview,

      basicInfo,

      financialInfo,

      bankRecords:
        selectedBankRecords,

      candidates,

      needsDisambiguation,
    };
  } finally {
    client.release();
  }
}

/**
 * Format complete Company Search Result
 * into clean, structured Markdown.
 */
export function formatCompanyResponse(
  compRes: CompanySearchResult
): string {
  const lines: string[] = [];

  lines.push(
    `### 🏢 Corporate Intelligence: **${compRes.primaryName}**`
  );

  lines.push("");

  // ------------------------------------------------------------
  // COMPANY OVERVIEW
  // ------------------------------------------------------------

  if (compRes.overview) {
    lines.push(
      compRes.overview
    );

    lines.push("");
  }

  // ------------------------------------------------------------
  // BASIC INFORMATION
  // ------------------------------------------------------------

  if (compRes.basicInfo) {
    const b =
      compRes.basicInfo;

    lines.push(
      `#### 📌 Basic Information`
    );

    lines.push(
      `| Property | Details |`
    );

    lines.push(
      `| :--- | :--- |`
    );

    lines.push(
      `| **Corporate Name** | ${
        b.company_name ||
        "Not available"
      } |`
    );

    lines.push(
      `| **CIN Number** | \`${
        b.cin ||
        "Not available"
      }\` |`
    );

    lines.push(
      `| **Industry / Sector** | ${
        b.industry ||
        "Not available"
      } |`
    );

    lines.push(
      `| **Listing Status** | ${
        b.listing_status ||
        "Not available"
      } |`
    );

    lines.push(
      `| **Incorporation Date** | ${
        b.incorporation_date ||
        "Not available"
      } |`
    );

    lines.push(
      `| **Headquarters / Address** | ${
        b.address ||
        "Not available"
      } |`
    );

    lines.push(
      `| **Country** | ${
        b.country ||
        "Not available"
      } |`
    );

    lines.push("");
  }

  // ------------------------------------------------------------
  // FINANCIAL INFORMATION
  // ------------------------------------------------------------

  if (compRes.financialInfo) {
    const f =
      compRes.financialInfo;

    lines.push(
      `#### 📊 Financial & Operational Profile`
    );

    lines.push(
      `| Metric | Value / Status |`
    );

    lines.push(
      `| :--- | :--- |`
    );

    lines.push(
      `| **Workforce / Employees** | ${
        f.employees ||
        "Not available"
      } |`
    );

    lines.push(
      `| **Annual Turnover** | ${
        f.turnover ||
        "Not available"
      } |`
    );

    lines.push(
      `| **Financial Performance** | ${
        f.profit_status ||
        "Not available"
      } |`
    );

    lines.push(
      `| **Revenue & Cash Flow** | ${
        f.profit_history ||
        "Not available"
      } |`
    );

    lines.push(
      `| **Last AGM Date** | ${
        f.last_agm ||
        "Not available"
      } |`
    );

    lines.push("");
  }

  // ------------------------------------------------------------
  // BANK COMPANY RECORDS
  //
  // Display one record per bank.
  // ------------------------------------------------------------

  const records =
    compRes.bankRecords || [];

  const uniqueRecords =
    records.filter(
      (
        record: CompanyRecord,
        index: number,
        self: CompanyRecord[]
      ) => {
        const bankName =
          String(
            record.bank_name || ""
          )
            .trim()
            .toLowerCase();

        return (
          index ===
          self.findIndex(
            (other) =>
              String(
                other.bank_name || ""
              )
                .trim()
                .toLowerCase() ===
              bankName
          )
        );
      }
    );

  if (
    uniqueRecords.length > 0
  ) {
    lines.push(
      `#### 🏦 Master Bank Category Ratings (${uniqueRecords.length} Partner Banks)`
    );

    lines.push(
      `| Sr No | Bank Name | Category Rating | Remarks / Info |`
    );

    lines.push(
      `| :---: | :--- | :--- | :--- |`
    );

    uniqueRecords
      .slice(0, 30)
      .forEach(
        (
          record: CompanyRecord,
          index: number
        ) => {
          lines.push(
            `| ${index + 1} | **${
              record.bank_name ||
              "Not available"
            }** | \`${
              record.company_category ||
              "Not available"
            }\` | ${
              record.other_info ||
              "Not available"
            } |`
          );
        }
      );

    lines.push("");
  }

  return lines
    .join("\n")
    .trim();
}

/**
 * Format company candidates.
 *
 * Keep the response as Markdown instead of injecting HTML.
 * The frontend can use companyData.candidates to create
 * clickable buttons safely.
 */
export function formatCompanyCandidateList(
  candidates: string[],
  searchQuery: string
): string {
  const lines: string[] = [
    `### 🏢 Matching Companies`,
    "",
    `I found multiple companies matching **"${searchQuery}"**.`,
    "",
    `Please select your exact employer:`,
    "",
  ];

  candidates
    .slice(0, 10)
    .forEach(
      (
        candidate,
        index
      ) => {
        lines.push(
          `${index + 1}. **${candidate}**`
        );
      }
    );

  lines.push("");

  lines.push(
    `Reply with the **number** or the **exact company name**.`
  );

  return lines.join("\n");
}

