import pool from "@/lib/db";

export interface CompanyCategoryMatch {
  searchedName: string;
  matchedName: string | null;
  isFound: boolean;
  overallCategoryTier: "Tier 1 / Super A" | "Tier 2 / Cat B" | "Tier 3 / Standard" | "Tier 4 / Unlisted" | "Government" | "Self-Employed";
  overallCategoryDisplay: string;
  bankCategories: Record<string, string>; // normalized bank name -> exact category
  rawRecords: Array<{
    bank_name: string;
    company_name: string;
    company_category: string;
    other_info?: string;
  }>;
}

// Normalizes bank names for reliable mapping
export function normalizeBankKey(name: string): string {
  const s = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.includes("hdfc")) return "hdfc";
  if (s.includes("icici")) return "icici";
  if (s.includes("axisfinance") || (s.includes("axis") && s.includes("finance"))) return "axisfinance";
  if (s.includes("axis")) return "axis";
  if (s.includes("bajajfinserv") || (s.includes("bajaj") && s.includes("finserv"))) return "bajajfinserv";
  if (s.includes("bajajmarket") || (s.includes("bajaj") && s.includes("market"))) return "bajajmarkets";
  if (s.includes("bajaj")) return "bajaj";
  if (s.includes("bandhan")) return "bandhan";
  if (s.includes("chola") || s.includes("cholamandalam")) return "chola";
  if (s.includes("fibe") || s.includes("earlysalary")) return "fibe";
  if (s.includes("finnable")) return "finnable";
  if (s.includes("homeloan") || s.includes("home")) return "homeloan";
  if (s.includes("idfc")) return "idfc";
  if (s.includes("indusind")) return "indusind";
  if (s.includes("kotak")) return "kotak";
  if (s.includes("ltfinance") || s.includes("ltf")) return "ltfinance";
  if (s.includes("piramal")) return "piramal";
  if (s.includes("poonawalla")) return "poonawalla";
  if (s.includes("sbm")) return "sbm";
  if (s.includes("smfg") || s.includes("fullerton")) return "smfg";
  if (s.includes("tatacapital") || s.includes("tata")) return "tatacapital";
  if (s.includes("utkarsh")) return "utkarsh";
  if (s.includes("yes")) return "yesbank";
  if (s.includes("abfl") || s.includes("aditya")) return "abfl";
  return s;
}

// Cache in-memory to avoid redundant DB roundtrips for common companies
const companyCategoryCache = new Map<string, CompanyCategoryMatch>();

/**
 * Resolves the user's company to bank-specific categories from the company_records table (591k records).
 * Identifies the applicant's company, its exact category for mapped partner banks, and its overall category tier.
 */
export async function resolveCompanyCategories(companyQuery: string): Promise<CompanyCategoryMatch> {
  const query = String(companyQuery || "").trim();
  if (!query) {
    return {
      searchedName: "",
      matchedName: null,
      isFound: false,
      overallCategoryTier: "Tier 3 / Standard",
      overallCategoryDisplay: "Unspecified Corporate",
      bankCategories: {},
      rawRecords: [],
    };
  }

  // Handle self-employed / business applicant profile
  if (/self[\s-]*employed|business\s*owner|freelanc|proprietor/i.test(query)) {
    return {
      searchedName: query,
      matchedName: "Self-Employed / Business",
      isFound: true,
      overallCategoryTier: "Self-Employed",
      overallCategoryDisplay: "Self-Employed / Business Profile",
      bankCategories: {},
      rawRecords: [],
    };
  }

  const cacheKey = query.toLowerCase();
  if (companyCategoryCache.has(cacheKey)) {
    return companyCategoryCache.get(cacheKey)!;
  }

  const result: CompanyCategoryMatch = {
    searchedName: query,
    matchedName: null,
    isFound: false,
    overallCategoryTier: "Tier 3 / Standard",
    overallCategoryDisplay: "Standard Corporate",
    bankCategories: {},
    rawRecords: [],
  };

  if (!pool) {
    return result;
  }

  try {
    // Expand common corporate abbreviations for accurate lookup
    let target = query;
    const upperQuery = query.toUpperCase();
    if (upperQuery === "TCS") {
      target = "TATA CONSULTANCY SERVICES";
    } else if (upperQuery === "SBI") {
      target = "STATE BANK OF INDIA";
    } else if (upperQuery === "IBM") {
      target = "IBM INDIA";
    }

    // 1. Ranked search for best matching company name in company_records
    let bestName: string | null = null;
    const searchPattern = `%${target.replace(/[\s,.-]+/g, "%")}%`;

    const rankRes = await pool.query(
      `SELECT company_name
       FROM company_records
       WHERE company_name ILIKE $1
       GROUP BY company_name
       ORDER BY 
         CASE 
           WHEN UPPER(company_name) = UPPER($2) THEN 1
           WHEN UPPER(company_name) LIKE UPPER($2) || ' %' THEN 2
           WHEN UPPER(company_name) LIKE UPPER($2) || 'LIMITED%' OR UPPER(company_name) LIKE UPPER($2) || ' PRIVATE%' THEN 3
           WHEN UPPER(company_name) LIKE '% ' || UPPER($2) || ' %' THEN 4
           ELSE 5
         END,
         LENGTH(company_name) ASC
       LIMIT 1`,
      [searchPattern, target]
    );

    if (rankRes.rows.length > 0) {
      bestName = rankRes.rows[0].company_name;
    } else if (target !== query) {
      // Fallback to searching original query if alias didn't hit
      const origPattern = `%${query.replace(/[\s,.-]+/g, "%")}%`;
      const fallbackRank = await pool.query(
        `SELECT company_name
         FROM company_records
         WHERE company_name ILIKE $1
         GROUP BY company_name
         ORDER BY 
           CASE 
             WHEN UPPER(company_name) = UPPER($2) THEN 1
             WHEN UPPER(company_name) LIKE UPPER($2) || ' %' THEN 2
             WHEN UPPER(company_name) LIKE UPPER($2) || 'LIMITED%' OR UPPER(company_name) LIKE UPPER($2) || ' PRIVATE%' THEN 3
             WHEN UPPER(company_name) LIKE '% ' || UPPER($2) || ' %' THEN 4
             ELSE 5
           END,
           LENGTH(company_name) ASC
         LIMIT 1`,
        [origPattern, query]
      );
      if (fallbackRank.rows.length > 0) {
        bestName = fallbackRank.rows[0].company_name;
      }
    }

    if (!bestName) {
      companyCategoryCache.set(cacheKey, result);
      return result;
    }

    // 2. Fetch all bank category mappings for this corporate entity
    const baseCleanName = bestName.replace(/[.\s]+$/, "");
    const rowsRes = await pool.query(
      `SELECT bank_name, company_name, company_category, other_info
       FROM company_records
       WHERE company_name ILIKE $1 OR company_name ILIKE $2
       ORDER BY id ASC`,
      [baseCleanName, `${baseCleanName}%`]
    );

    const rows = rowsRes.rows;
    if (rows.length > 0) {
      result.isFound = true;
      result.matchedName = bestName;
      result.rawRecords = rows;

      let hasTier1 = false;
      let hasTier2 = false;
      let hasGovt = false;
      let hasTier4 = false;

      // Group categories by bank
      for (const r of rows) {
        const key = normalizeBankKey(r.bank_name);
        const cat = String(r.company_category || "").trim();
        if (cat && (!result.bankCategories[key] || result.bankCategories[key] === "Open Market")) {
          result.bankCategories[key] = cat;
        }

        const catLower = cat.toLowerCase();
        const isExplicitUnlisted = /\b(?:un|non)[- ]?listed\b|\bproprietor|\bpartnership\b|\bllp\b|\bopen\s*market\b/i.test(catLower);

        if (/\bgov(?:ernment|t)?\b|\bpublic\s*sector\b|\bpsu\b|\brailway\b|\bdefen[sc]e\b|\bstate\s*gov|\bcentral\s*gov|\bcat\s*g[a-z]?\b|\bg[a-d]\b/i.test(catLower)) {
          hasGovt = true;
        } else if (
          !isExplicitUnlisted &&
          (/\b(?:cat|category)\s*(?:super\s*a|aa|sa|a\+?|1)\b/i.test(catLower) ||
           /\bsuper\s*a\b/i.test(catLower) ||
           /\btier\s*1\b/i.test(catLower) ||
           /\bdiamond\b/i.test(catLower) ||
           /\belite\b/i.test(catLower) ||
           /\bsuper\s*prime\b/i.test(catLower) ||
           /\btop\s*corporate\b/i.test(catLower) ||
           /\bace(?:\s*plus)?\b/i.test(catLower) ||
           /\bpristine\b/i.test(catLower) ||
           /\blpc-[ab]\b/i.test(catLower) ||
           (!isExplicitUnlisted && /\blisted\b/i.test(catLower)) ||
           /\btge\b|\btata\s*group\b/i.test(catLower))
        ) {
          hasTier1 = true;
        } else if (
          !isExplicitUnlisted &&
          (/\b(?:cat|category)\s*(?:b\+?|2)\b/i.test(catLower) ||
           /\bplatinum\b/i.test(catLower) ||
           (!/\bsuper\s*prime\b/i.test(catLower) && /\bprime\b/i.test(catLower)) ||
           /\bgold\b/i.test(catLower) ||
           /\btier\s*2\b/i.test(catLower) ||
           /\bpreferred\b/i.test(catLower) ||
           /\blpc-b\b/i.test(catLower))
        ) {
          hasTier2 = true;
        } else if (/(?:cat|category)\s*[de]|upc-[de]|unlisted|\bnon[- ]?listed\b/i.test(catLower)) {
          hasTier4 = true;
        }
      }

      if (hasGovt) {
        result.overallCategoryTier = "Government";
        result.overallCategoryDisplay = "Government / Public Sector";
      } else if (hasTier1) {
        result.overallCategoryTier = "Tier 1 / Super A";
        result.overallCategoryDisplay = "Tier 1 / Super A (Prime Corporate)";
      } else if (hasTier2) {
        result.overallCategoryTier = "Tier 2 / Cat B";
        result.overallCategoryDisplay = "Tier 2 / Cat B (Preferred Corporate)";
      } else if (hasTier4) {
        result.overallCategoryTier = "Tier 4 / Unlisted";
        result.overallCategoryDisplay = "Tier 4 / Unlisted Corporate";
      } else {
        result.overallCategoryTier = "Tier 3 / Standard";
        result.overallCategoryDisplay = "Tier 3 / Standard Corporate";
      }
    }

    companyCategoryCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error("Error resolving company categories from DB:", err);
    return result;
  }
}
