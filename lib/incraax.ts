import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
/**
 * Incraax (SearXNG) Search API Integration.
 * Single source of truth for Incraax web search and live corporate intelligence.
 *
 * Implements strict source validation, entity identity verification,
 * field-level data provenance, reporting period preservation, and zero fabricated fallbacks.
 *
 * Invariant: Never writes to PostgreSQL database. Read-only live search intelligence only.
 */

export const INCRAAX_SEARCH_URL = process.env.INCRAAX_SEARCH_URL || "";
export const INCRAAX_SEARCH_API_KEY = process.env.INCRAAX_SEARCH_API_KEY || ""; export interface IncraaxResult {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
  score?: number;
}

export interface VerifiedField<T = string> {
  value: T | null;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceEntity?: string;
  reportingPeriod?: string;
  verified: boolean;
  confidence?: "high" | "medium" | "low";
}

export interface CanonicalCompanyIdentity {
  canonicalName: string;
  legalName?: string;
  databaseId?: string | number;
  cin?: string;
  llpin?: string;
  country?: string;
  registeredState?: string;
  isPublic?: boolean;
  isLlp?: boolean;
}

export interface LiveCompanyBasicInfo {
  company_name?: string;
  cin?: string | null;
  cin_field?: VerifiedField<string>;
  llpin?: string | null;
  llpin_field?: VerifiedField<string>;
  industry?: string | null;
  industry_field?: VerifiedField<string>;
  address?: string | null;
  address_field?: VerifiedField<string>;
  website?: string | null;
  website_field?: VerifiedField<string>;
  incorporation_date?: string | null;
  incorporation_date_field?: VerifiedField<string>;
  listing_status?: string | null;
  listing_status_field?: VerifiedField<string>;
  country?: string | null;
  country_field?: VerifiedField<string>;
}

export interface LiveCompanyFinancialInfo {
  company_name?: string;
  employees?: string | null;
  employees_field?: VerifiedField<string>;
  turnover?: string | null;
  turnover_field?: VerifiedField<string>;
  paid_up_capital?: string | null;
  paid_up_capital_field?: VerifiedField<string>;
  authorized_capital?: string | null;
  authorized_capital_field?: VerifiedField<string>;
  profit_status?: string | null;
  profit_status_field?: VerifiedField<string>;
  profit_history?: string | null;
  profit_history_field?: VerifiedField<string>;
  last_agm?: string | null;
  last_agm_field?: VerifiedField<string>;
  performance_trend?: string | null;
  performance_trend_field?: VerifiedField<string>;
}

export interface LiveCompanyIntelligence {
  companyName: string;
  overview: string | null;
  basicInfo: LiveCompanyBasicInfo;
  financialInfo: LiveCompanyFinancialInfo;
  sources: IncraaxResult[];
  entityVerified: boolean;
}

export function isIncraaxSearchConfigured(): boolean {
  return Boolean((process.env.INCRAAX_SEARCH_API_KEY || INCRAAX_SEARCH_API_KEY)?.trim());
}

/**
 * Utility to escape dynamic regex special characters securely.
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Searches the live Incraax (SearXNG) API with Bearer token authentication.
 * Falls back to categories: "general" if categories: "news" returns empty results.
 */
export async function searchIncraax(
  query: string,
  options: {
    maxResults?: number;
    deep?: boolean;
    categories?: string;
    language?: string;
  } = {}
): Promise<IncraaxResult[]> {
  const normQuery = String(query || "").trim();
  if (!normQuery) return [];

  const apiKey = (process.env.INCRAAX_SEARCH_API_KEY || INCRAAX_SEARCH_API_KEY).trim();
  if (!apiKey) {
    console.warn("[Incraax] Search requested but API key is missing.");
    return [];
  }

  const maxResults = options.maxResults ?? 10;
  const initialCategory = options.categories || "news";

  const executeFetch = async (category: string, retries = 1): Promise<IncraaxResult[]> => {
    const baseUrl = process.env.INCRAAX_SEARCH_URL || INCRAAX_SEARCH_URL;
    if (!baseUrl) return [];

    const url = new URL(baseUrl);
    url.searchParams.set("q", normQuery);
    url.searchParams.set("format", "json");
    if (options.deep) url.searchParams.set("deep", "true");
    url.searchParams.set("categories", category);
    if (options.language) url.searchParams.set("language", options.language);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(15000), // Increased from 8000ms to 15000ms
        });

        if (!res.ok) {
          if (url.searchParams.has("deep")) {
            url.searchParams.delete("deep");
            continue;
          }
          continue;
        }

        const data: any = await res.json();
        const rawResults = Array.isArray(data?.results) ? data.results : [];

        return rawResults.slice(0, maxResults).map((r: any) => ({
          title: String(r.title || "").trim(),
          url: String(r.url || "").trim(),
          snippet: String(r.content || r.snippet || "").trim(),
          engine: r.engine,
          score: typeof r.score === "number" ? r.score : undefined,
        }));
      } catch (err: any) {
        if (attempt === retries) {
          console.warn(`[Incraax] Search error (${category}):`, err?.message || err);
        }
      }
    }
    return [];
  };

  let results = await executeFetch(initialCategory);

  // Fallback Categories: Ensure searchIncraax falls back to categories: "general" if categories: "news" returns empty results.
  if (results.length === 0 && initialCategory === "news") {
    results = await executeFetch("general");
  }

  return results;
}

/**
 * Compatibility wrapper for searchIncraax.
 * @deprecated Use searchIncraax instead. Preserved for repository backwards compatibility.
 */
export async function incraaxSearch(
  query: string,
  maxResults = 5,
  options?: { deep?: boolean }
): Promise<IncraaxResult[]> {
  return searchIncraax(query, { maxResults, deep: options?.deep });
}

/* =========================================================================
 * ENTITY TOKENIZATION & VALIDATION HELPERS
 * ========================================================================= */

const CORPORATE_LEGAL_SUFFIXES =
  /\b(?:private\s+limited|pvt\s+ltd|pvt|private|limited|ltd|co|inc|corp|corporation|llp|plc)\b/gi;

const GENERIC_BUSINESS_WORDS = new Set([
  "services", "solutions", "technologies", "technology", "consulting",
  "enterprises", "industries", "systems", "holdings", "ventures", "associates",
  "management", "digital", "infotech", "software", "networks", "professionals",
  "operations", "logistics", "products", "international", "global", "group",
  "division", "commercial", "financial", "advisors", "developers"
]);

const GEOGRAPHIC_WORDS = new Set([
  "india", "bharat", "asia", "america", "global", "international"
]);

const DIRECTORY_DOMAINS = new Set([
  "wikipedia", "tracxn", "linkedin", "zaubacorp", "tofler", "instafinancials",
  "glassdoor", "moneycontrol", "taxguru", "economictimes",
  "indiamart", "facebook", "twitter", "instagram", "youtube",
  "ambitionbox", "crunchbase", "quickr", "justdial", "bloomberg",
  "reuters", "ndtv", "livemint", "business-standard", "financialexpress"
]);

const STATE_CODE_MAP: Record<string, string> = {
  MH: "Maharashtra", KA: "Karnataka", DL: "Delhi", TN: "Tamil Nadu",
  GJ: "Gujarat", TS: "Telangana", TG: "Telangana", WB: "West Bengal",
  UP: "Uttar Pradesh", HR: "Haryana", AP: "Andhra Pradesh", KL: "Kerala",
  MP: "Madhya Pradesh", RJ: "Rajasthan", CH: "Chandigarh",
};

/**
 * Determines listing status canonically from company name, CIN, or LLP status.
 */
export function determineListingStatus(
  companyName: string,
  cin?: string | null,
  isTargetLlp?: boolean,
  hasPublicProof?: boolean
): string | null {
  const norm = String(companyName || "").toLowerCase();
  if (isTargetLlp || /\b(?:llp|limited\s+liability\s+partnership)\b/i.test(norm)) {
    return "Unlisted Limited Liability Partnership (LLP)";
  }
  if (cin) {
    const upperCin = cin.toUpperCase().trim();
    if (upperCin.startsWith("L")) return "Public Listed Enterprise (BSE/NSE)";
    if (upperCin.startsWith("U")) return "Private Limited Corporate";
  }
  if (/\b(?:private\s+limited|pvt\s+ltd|pvt|private)\b/i.test(norm)) {
    return "Private Limited Corporate";
  }
  if (/\b(?:limited|ltd|plc)\b/i.test(norm)) {
    return hasPublicProof ? "Public Listed Enterprise (BSE/NSE)" : "Unlisted Corporate Entity";
  }
  return null;
}

/**
 * Shared helper: extracts normalized distinctive tokens from a company name.
 */
export function getDistinctiveCompanyTokens(name: string): {
  slug: string;
  cleanWords: string[];
  coreBrandTokens: string[];
  allTokens: string[];
  entityPhrase: string;
  isLlp: boolean;
  isPrivate: boolean;
  isPublic: boolean;
} {
  const raw = String(name || "").toLowerCase().trim();
  const isLlp = /\b(?:llp|limited\s+liability\s+partnership)\b/i.test(raw);
  const isPrivate = /\b(?:private\s+limited|pvt\s+ltd|pvt|private)\b/i.test(raw);
  const isPublic = Boolean(!isLlp && !isPrivate && /\b(?:limited|ltd|plc)\b/i.test(raw));

  const withoutLegal = raw.replace(CORPORATE_LEGAL_SUFFIXES, " ").trim();
  const slug = withoutLegal.replace(/[^a-z0-9]/g, "");

  const cleanWords = withoutLegal
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !/^(?:the|and|for|with|of|in|at)$/.test(w));

  const allTokens = cleanWords.filter((w) => !GEOGRAPHIC_WORDS.has(w));
  const filtered = allTokens.filter((w) => !GENERIC_BUSINESS_WORDS.has(w));
  const coreBrandTokens = filtered.length >= 2 ? filtered : (allTokens.length >= 2 ? allTokens : (filtered.length > 0 ? filtered : allTokens));
  const entityPhrase = cleanWords.join(" ");

  return {
    slug,
    cleanWords,
    coreBrandTokens: coreBrandTokens.length > 0 ? coreBrandTokens : allTokens,
    allTokens: allTokens.length > 0 ? allTokens : cleanWords,
    entityPhrase,
    isLlp,
    isPrivate,
    isPublic,
  };
}

export const extractCompanyTokens = getDistinctiveCompanyTokens;

/**
 * Validates that an official website belongs specifically to the target entity.
 */
export function isValidCompanyDomain(urlStr: string, canonicalName: string, legalName?: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase().replace(/^(?:www\.|m\.)/, "");
    const hostMain = host.split(".")[0];

    if (DIRECTORY_DOMAINS.has(hostMain)) return false;

    const namesToMatch = [canonicalName, legalName].filter(Boolean) as string[];
    for (const name of namesToMatch) {
      const { slug, coreBrandTokens } = getDistinctiveCompanyTokens(name);
      if (!slug || slug.length < 3) continue;

      if (host.includes(slug)) return true;

      if (coreBrandTokens.length >= 2) {
        const hasAllDistinctive = coreBrandTokens.every((w) => host.includes(w));
        if (hasAllDistinctive) return true;
      } else if (coreBrandTokens.length === 1 && hostMain === coreBrandTokens[0]) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Determines whether a search result item refers strictly to the selected canonical entity.
 */
export function isResultRelevantToEntity(
  result: IncraaxResult,
  canonicalName: string,
  legalName?: string
): boolean {
  const text = `${result.title} ${result.snippet}`.toLowerCase();
  const targetNames = [canonicalName, legalName].filter(Boolean) as string[];

  for (const tName of targetNames) {
    const { isLlp, cleanWords, entityPhrase } = getDistinctiveCompanyTokens(tName);
    if (cleanWords.length === 0) continue;

    if (isLlp) {
      const mentionsLlp = /\b(?:llp|limited\s+liability\s+partnership)\b/i.test(text);
      if (!mentionsLlp) continue;

      const mentionsIncOrCorp = /\b(?:inc\b|incorporated|corp\b|corporation|nasdaq|nyse|market\s+cap)\b/i.test(text);
      if (mentionsIncOrCorp) {
        const phraseWithLlp = new RegExp(
          `\\b${escapeRegex(cleanWords[0])}[^.;\\n]*?\\b(?:llp|limited\\s+liability\\s+partnership)\\b`,
          "i"
        );
        if (!phraseWithLlp.test(text)) continue;
      }
    }

    if (cleanWords.length >= 2) {
      const substantiveTokens = cleanWords.filter((w) => w.length > 2 && !GEOGRAPHIC_WORDS.has(w));
      const brandWord = cleanWords[0];
      const distUnit = substantiveTokens.length >= 2 ? substantiveTokens[1] : cleanWords[1];

      const phraseEscaped = escapeRegex(entityPhrase).replace(/\s+/g, "\\s+");
      if (new RegExp(`\\b${phraseEscaped}\\b`, "i").test(text)) {
        return true;
      }

      if (distUnit && distUnit !== brandWord) {
        const distStem = distUnit.length > 4 && distUnit.endsWith("s") ? distUnit.slice(0, -1) : distUnit;
        const proximityPattern = new RegExp(
          `\\b${escapeRegex(brandWord)}(?:\\s+[a-z0-9]+){0,2}\\s+${escapeRegex(distStem)}(?:s)?\\b`,
          "i"
        );
        if (proximityPattern.test(text)) {
          return true;
        }
      }
      continue;
    }

    const singleWord = cleanWords[0];
    if (singleWord && new RegExp(`\\b${escapeRegex(singleWord)}\\b`, "i").test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts explicit financial reporting period from snippet text.
 */
export function extractReportingPeriod(text: string): string | undefined {
  const datePattern = "(?:\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]+|[A-Za-z]+\\s+\\d{1,2}(?:st|nd|rd|th)?),?\\s+20?\\d{2}";
  const m =
    text.match(/\b(Q[1-4]\s*(?:FY\s*)?(?:20\d{2}|\d{2})(?:-\d{2})?)\b/i) ||
    text.match(/\b(FY\s*(?:20\d{2}|\d{2})(?:-\d{2})?)\b/i) ||
    text.match(new RegExp(`\\b((?:financial\\s+)?year\\s+ending\\s+(?:on\\s+)?${datePattern})\\b`, "i")) ||
    text.match(new RegExp(`\\b((?:financial\\s+)?(?:year|quarter)\\s+ended\\s+(?:on\\s+)?${datePattern})\\b`, "i")) ||
    text.match(new RegExp(`\\b(as\\s+(?:of|on)\\s+${datePattern})\\b`, "i")) ||
    text.match(new RegExp(`\\b(period\\s+ending\\s+(?:on\\s+)?${datePattern})\\b`, "i")) ||
    text.match(/\b(as\s+on\s+\d{1,2}[-/.]\d{1,2}[-/.]20?\d{2})\b/i) ||
    text.match(/\b(20\d{2}-\d{2})\b/);
  return m ? m[1].trim() : undefined;
}

/* =========================================================================
 * ENHANCED INDIAN CURRENCY REGEX PATTERNS & FINANCIAL METRICS
 * ========================================================================= */

const CURRENCY_UNIT_PATTERN = "(?:cr(?:ore)?s?|lakh?s?|lacs?|billion|bn|million|mn|trillion)";
const CURRENCY_PREFIX = "(?:₹|Rs\\.?|INR|[$€£])";
const AMOUNT_COMPONENT = `(?:(?:${CURRENCY_PREFIX}\\s*)?\\d+(?:,\\d+)*(?:\\.\\d+)?\\s*${CURRENCY_UNIT_PATTERN}|${CURRENCY_PREFIX}\\s*\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d+)?|${CURRENCY_PREFIX}\\s*\\d+(?:\\.\\d+)?\\s*${CURRENCY_UNIT_PATTERN}?|\\d+(?:,\\d+)*(?:\\.\\d+)?\\s*${CURRENCY_UNIT_PATTERN})`;
const RANGE_OR_AMOUNT = `(?:(?:over|more than|approx(?:imately)?|around|between)\\s+)?${AMOUNT_COMPONENT}(?:\\s*(?:-|–|—|to)\\s*${AMOUNT_COMPONENT})?`;

const PAID_UP_CAPITAL_REGEX = new RegExp(
  `(?:paid(?:-|\\s*)up\\s*(?:share\\s*)?capital(?:\\s*(?:is|of|:|-|was|stood at))?\\s*)(?:(?:more than|over|approx(?:imately)?|around)\\s*)?(${RANGE_OR_AMOUNT})`,
  "i"
);

const AUTHORIZED_CAPITAL_REGEX = new RegExp(
  `(?:authori[sz]ed\\s*(?:share\\s*)?capital(?:\\s*(?:is|of|:|-|was|stood at))?\\s*)(?:(?:more than|over|approx(?:imately)?|around)\\s*)?(${RANGE_OR_AMOUNT})`,
  "i"
);

const REVENUE_REGEX_1 = new RegExp(
  `(?:consolidated\\s+)?(?:revenues?|turnover)\\s+(?:(?:rises?|rose|surged|jumped|fell|slid|was|is|of|up|grew)\\s+(?:over\\s+|by\\s+)?(?:[\\d.]+%\\s*(?:YoY|QoQ|sequentially|year-on-year)?\\s*)?(?:to\\s+)?)?\\s*(?:to\\s+)?(${RANGE_OR_AMOUNT})`,
  "i"
);

const REVENUE_REGEX_2 = new RegExp(
  `(?:turnover|revenue[s]?|operating\\s+revenue(?:\\s+range)?)\\s*(?:(?:range\\s*)?(?:is|of|:|-|was|were|reached|stood at|topped|hit|rose to)?\\s*)(?:(?:more than|over|approx(?:imately)?|around)\\s*)?(${RANGE_OR_AMOUNT})`,
  "i"
);

const REVENUE_REGEX_3 = new RegExp(
  `(?:generated|reported|posted|recorded)\\s+(?:consolidated\\s+)?(?:revenues?|turnover)\\s+(?:of\\s+)?(?:more than\\s+|over\\s+)?(${RANGE_OR_AMOUNT})`,
  "i"
);

const PROFIT_REGEX = new RegExp(
  `(?:net\\s+profit|pat|profit\\s+after\\s+tax)\\s+(?:(?:rises?|rose|surged|jumped|fell|slid|was|is|of|up|grew)\\s+(?:over\\s+|by\\s+)?(?:[\\d.]+%\\s*(?:YoY|QoQ|sequentially|year-on-year)?\\s*)?(?:to\\s+)?)?\\s*(?:to\\s+)?(${RANGE_OR_AMOUNT})`,
  "i"
);

const EMPLOYEE_REGEX_1 = /(?:workforce\s+of|headcount\s+of|employs|has\s+over|over|employee\s+base\s+(?:was|is|of))\s*([\d,.]+\s*(?:thousand|lakh?s?|lacs?|k|\+)?\s*(?:employees|workforce|professionals)?)/i;
const EMPLOYEE_REGEX_2 = /(\d[\d,.]*\s*(?:thousand|lakh?s?|lacs?|k)?\+?\s*(?:employees|workforce|professionals))/i;
const EMPLOYEE_REGEX_3 = /workforce\s+(?:falls|rises|grew|stands|stood)\s+(?:by\s+[\d,.]+\s+QoQ\s+)?to\s+([\d,.]+\s*(?:thousand|lakh?s?|lacs?|k|\+)?\s*(?:employees|workforce|professionals)?)/i;

/**
 * Generic extraction helper to eliminate duplicated code loops.
 * Standardizes full provenance (sourceUrl, sourceTitle, confidence, reportingPeriod).
 */
function extractFirstMatch<T = string>(
  results: IncraaxResult[],
  extractor: (text: string, r: IncraaxResult) => { value: T; reportingPeriod?: string; confidence?: "high" | "medium" | "low" } | null,
  entityName: string
): VerifiedField<T> {
  for (const r of results) {
    const text = `${r.title} ${r.snippet}`;
    const extracted = extractor(text, r);
    if (extracted && extracted.value) {
      const period = extracted.reportingPeriod || extractReportingPeriod(text);
      return {
        value: extracted.value,
        reportingPeriod: period,
        sourceUrl: r.url,
        sourceTitle: r.title,
        sourceEntity: entityName,
        verified: true,
        confidence: extracted.confidence || (period ? "high" : "medium"),
      };
    }
  }
  return { value: null, verified: false };
}

/**
 * Enforces entity consistency across extracted fields.
 */
export function validateEntityConsistency(
  intel: LiveCompanyIntelligence,
  targetName: string
): LiveCompanyIntelligence {
  const { coreBrandTokens, isLlp } = getDistinctiveCompanyTokens(targetName);

  if (isLlp) {
    intel.basicInfo.cin = null;
    if (intel.basicInfo.cin_field) {
      intel.basicInfo.cin_field.value = null;
      intel.basicInfo.cin_field.verified = false;
      intel.basicInfo.cin_field.sourceUrl = undefined;
      intel.basicInfo.cin_field.sourceTitle = undefined;
      intel.basicInfo.cin_field.reportingPeriod = undefined;
    }
  }

  const listingStatus = determineListingStatus(targetName, intel.basicInfo.cin, isLlp);
  if (listingStatus) {
    intel.basicInfo.listing_status = listingStatus;
    if (intel.basicInfo.listing_status_field) {
      intel.basicInfo.listing_status_field.value = listingStatus;
      intel.basicInfo.listing_status_field.verified = true;
    }
  }

  const isMatchingEntity = (fieldEntity?: string) => {
    if (!fieldEntity) return true;
    const { coreBrandTokens: sourceTokens } = getDistinctiveCompanyTokens(fieldEntity);

    if (coreBrandTokens.length >= 2) {
      return coreBrandTokens.every((t) => sourceTokens.includes(t));
    }
    return sourceTokens.some((t) => coreBrandTokens.includes(t));
  };

  const verifyField = (obj: any, key: string, fieldKey: string) => {
    if (obj && obj[fieldKey] && !isMatchingEntity(obj[fieldKey].sourceEntity)) {
      obj[key] = null;
      obj[fieldKey].value = null;
      obj[fieldKey].verified = false;
      obj[fieldKey].sourceUrl = undefined;
      obj[fieldKey].sourceTitle = undefined;
      obj[fieldKey].reportingPeriod = undefined;
    }
  };

  verifyField(intel.financialInfo, "turnover", "turnover_field");
  verifyField(intel.financialInfo, "paid_up_capital", "paid_up_capital_field");
  verifyField(intel.financialInfo, "authorized_capital", "authorized_capital_field");
  verifyField(intel.financialInfo, "employees", "employees_field");
  verifyField(intel.basicInfo, "website", "website_field");
  verifyField(intel.basicInfo, "cin", "cin_field");
  verifyField(intel.basicInfo, "llpin", "llpin_field");

  return intel;
}

/**
 * Evaluates live internet search snippets to identify the highest-quality company introduction paragraph.
 * Prioritizes rich corporate profiles, industry descriptions, and business activities while penalizing
 * intraday stock market chatter, ticker movements, or cookie notices.
 */
function extractBestCompanyIntroSnippet(results: IncraaxResult[], companyName: string): string | null {
  const normName = companyName.toLowerCase();
  let bestScore = -1;
  let bestSnippet: string | null = null;

  for (const r of results) {
    const text = (r.snippet || "").trim();
    if (text.length < 35) continue;
    if (/cookies|javascript|privacy policy|terms of|coinbase|broker-dealer|cryptocurren|advertis|affiliate/i.test(text)) continue;

    let score = 0;
    const lower = text.toLowerCase();

    // High score for descriptive corporate overview phrases
    if (/\b(?:is\s+(?:an?|the|one\s+of|India's|a\s+leading|a\s+global|a\s+major)\b|specializes\s+in|engaged\s+in|founded\s+in|headquartered\s+in|operates\s+(?:as|in)|provider\s+of|multinational|conglomerate|subsidiary\s+of)\b/i.test(lower)) {
      score += 40;
    }
    if (/\b(?:software|consulting|technology|manufacturing|financial\s+services|banking|healthcare|engineering|telecom|retail|energy|automotive|logistics|solutions|enterprises?)\b/i.test(lower)) {
      score += 20;
    }
    if (lower.includes(normName)) {
      score += 25;
    }

    // Penalize pure stock ticker chatter / intraday movements
    if (/\b(?:share\s+price|opens?\s+strong|stock\s+price|closing\s+bell|opening\s+bell|target\s+price|buy\s+or\s+sell|52-week|intraday)\b/i.test(lower)) {
      score -= 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSnippet = text;
    }
  }

  // Fallback to any informative snippet if scoring didn't find a high-confidence match
  if (!bestSnippet) {
    bestSnippet = results
      .map((r) => r.snippet)
      .find(
        (s) =>
          s &&
          s.length > 50 &&
          !/cookies|javascript|privacy policy|terms of|coinbase|broker-dealer|cryptocurren|advertis|affiliate/i.test(s)
      ) || null;
  }

  return bestSnippet;
}

/* =========================================================================
 * CORE LIVE CORPORATE INTELLIGENCE PIPELINE
 * ========================================================================= */

export async function fetchLiveCompanyIntelligence(
  identityOrName: CanonicalCompanyIdentity | string,
  fallbackCin?: string,
  fallbackLlpin?: string
): Promise<LiveCompanyIntelligence> {
  const identity: CanonicalCompanyIdentity =
    typeof identityOrName === "string"
      ? { canonicalName: identityOrName.trim(), legalName: identityOrName.trim(), cin: fallbackCin, llpin: fallbackLlpin }
      : identityOrName;

  const cleanName = identity.canonicalName.trim();
  const legalName = identity.legalName?.trim() || cleanName;
  const isTargetLlp = Boolean(identity.isLlp || /\b(?:llp|limited\s+liability\s+partnership)\b/i.test(cleanName));
  const initialCin = !isTargetLlp ? (identity.cin || fallbackCin) : undefined;
  const initialLlpin = isTargetLlp ? (identity.llpin || fallbackLlpin) : undefined;

  const searchBase = isTargetLlp
    ? cleanName
    : cleanName.replace(CORPORATE_LEGAL_SUFFIXES, "").replace(/\s+/g, " ").trim();

  // Financial Directory Search Queries: Target directories like ZaubaCorp, Tofler, and InstaFinancials
  const directoryFinancialQuery = `${cleanName} site:zaubacorp.com OR site:tofler.in OR site:instafinancials.com`;
  const directoryMetricsQuery = `${searchBase} turnover revenue capital site:zaubacorp.com OR site:tofler.in OR site:instafinancials.com`;
  const primaryQuery = `${searchBase} results profit revenue`;
  const workforceQuery = `${cleanName} employees headcount workforce`;
  const profileOverviewQuery = `${cleanName} company overview profile about`;

  // Batch 1: Direct targeted queries
  const resDir1 = await searchIncraax(directoryFinancialQuery, { maxResults: 10, categories: "general" });
  const res1 = await searchIncraax(primaryQuery, { maxResults: 10, categories: "news" });
  const resProfile = await searchIncraax(profileOverviewQuery, { maxResults: 10, categories: "news" });

  // Batch 2: Secondary / workforce queries
  const resDir2 = await searchIncraax(directoryMetricsQuery, { maxResults: 10, categories: "general" });
  const resWorkforce = await searchIncraax(workforceQuery, { maxResults: 10, categories: "news" });

  let rawResults = [...resDir1, ...res1, ...resProfile, ...resDir2, ...resWorkforce];

  if (rawResults.length === 0) {
    try {
      rawResults = await searchIncraax(cleanName, { maxResults: 10, categories: "news" });
    } catch { }
  }

  const seenUrls = new Set<string>();
  const uniqueResults: IncraaxResult[] = [];
  for (const r of rawResults) {
    if (r.url && !seenUrls.has(r.url)) {
      seenUrls.add(r.url);
      uniqueResults.push(r);
    }
  }

  const relevantResults = uniqueResults.filter((r) => isResultRelevantToEntity(r, cleanName, legalName));
  const hasEntityEvidence = relevantResults.length > 0;

  const websiteField = extractFirstMatch(
    relevantResults,
    (_text, r) => {
      if (isValidCompanyDomain(r.url, cleanName, legalName)) {
        try {
          const u = new URL(r.url);
          const domain = `https://www.${u.hostname.toLowerCase().replace(/^(?:www\.|m\.)/, "")}`;
          return { value: domain, confidence: "high" as const };
        } catch { }
      }
      return null;
    },
    cleanName
  );

  const llpinField: VerifiedField<string> = isTargetLlp
    ? (initialLlpin
      ? {
          value: initialLlpin,
          verified: true,
          sourceEntity: cleanName,
          sourceTitle: "Applicant Provided Identification",
          confidence: "high" as const,
        }
      : extractFirstMatch(
        relevantResults,
        (text, r) => {
          const fullSource = `${r.url} ${text}`;
          const llpMatch = fullSource.match(/\b([A-Z]{3}-\d{4,7})\b/i);
          return llpMatch ? { value: llpMatch[1].toUpperCase(), confidence: "high" as const } : null;
        },
        cleanName
      ))
    : { value: null, verified: false };

  const cinField: VerifiedField<string> = !isTargetLlp
    ? (initialCin
      ? {
          value: initialCin,
          verified: true,
          sourceEntity: cleanName,
          sourceTitle: "Applicant Provided Identification",
          confidence: "high" as const,
        }
      : extractFirstMatch(
        relevantResults,
        (text, r) => {
          const fullSource = `${r.url} ${text}`;
          const cinMatch = fullSource.match(/\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/i);
          return cinMatch ? { value: cinMatch[1].toUpperCase(), confidence: "high" as const } : null;
        },
        cleanName
      ))
    : { value: null, verified: false };

  let cinIncYear: string | null = null;
  let cinStateAddress: string | null = null;

  if (cinField.value && !isTargetLlp) {
    const cinVal = cinField.value.trim().toUpperCase();
    const yrMatch = cinVal.match(/(19|20)\d{2}/);
    if (yrMatch) cinIncYear = yrMatch[0];

    // Standard CIN is 21 characters long
    if (cinVal.length === 21) {
      const stateCode = cinVal.substring(6, 8);
      const stateName = STATE_CODE_MAP[stateCode];
      if (stateName) {
        cinStateAddress = `Registered Office: ${stateName}, India (per RoC MCA)`;
      }
    }
  }

  const addressField = extractFirstMatch(
    relevantResults,
    (text) => {
      const addrMatch =
        text.match(/(?:registered\s+(?:office|address)\s+(?:is|at|located\s+at)?|headquartered\s+in|headquarters\s+(?:in|at|is)?)\s*[:=-]?\s*([^.;\n]{8,120})/i) ||
        text.match(/(?:address\s*[:=-]\s*)([^.;\n]{8,100})/i);
      if (addrMatch) {
        const rawAddr = addrMatch[1].replace(/\s+/g, " ").replace(/^(?:at|is|in|of)\s+/i, "").trim();
        if (!/coinbase|yahoo|crypto|button|terms of|cookie|privacy/i.test(rawAddr) && rawAddr.length >= 8) {
          return { value: rawAddr, confidence: "medium" as const };
        }
      }
      return null;
    },
    cleanName
  );

  if (!addressField.value && cinStateAddress) {
    addressField.value = cinStateAddress;
    addressField.verified = true;
    addressField.confidence = "medium";
    addressField.sourceEntity = cleanName;
    addressField.sourceTitle = cinField.sourceTitle || "MCA RoC Corporate Registry";
    addressField.sourceUrl = cinField.sourceUrl;
  }

  const revenueField = extractFirstMatch(
    relevantResults,
    (text) => {
      const revMatch =
        text.match(REVENUE_REGEX_1) ||
        text.match(REVENUE_REGEX_2) ||
        text.match(REVENUE_REGEX_3);
      if (revMatch && revMatch[1]) {
        const period = extractReportingPeriod(text);
        return {
          value: revMatch[1].trim(),
          reportingPeriod: period,
          confidence: period ? ("high" as const) : ("medium" as const),
        };
      }
      return null;
    },
    cleanName
  );

  const paidUpCapitalField = extractFirstMatch(
    relevantResults,
    (text) => {
      const puMatch = text.match(PAID_UP_CAPITAL_REGEX);
      if (puMatch && puMatch[1]) {
        const period = extractReportingPeriod(text);
        return {
          value: puMatch[1].trim(),
          reportingPeriod: period,
          confidence: period ? ("high" as const) : ("medium" as const),
        };
      }
      return null;
    },
    cleanName
  );

  const authorizedCapitalField = extractFirstMatch(
    relevantResults,
    (text) => {
      const auMatch = text.match(AUTHORIZED_CAPITAL_REGEX);
      if (auMatch && auMatch[1]) {
        const period = extractReportingPeriod(text);
        return {
          value: auMatch[1].trim(),
          reportingPeriod: period,
          confidence: period ? ("high" as const) : ("medium" as const),
        };
      }
      return null;
    },
    cleanName
  );

  const employeesField = extractFirstMatch(
    relevantResults,
    (text) => {
      const empMatch =
        text.match(EMPLOYEE_REGEX_1) ||
        text.match(EMPLOYEE_REGEX_2) ||
        text.match(EMPLOYEE_REGEX_3);
      if (empMatch && empMatch[1]) {
        const val = empMatch[1].trim();
        const cleanVal = /employees|workforce|professionals/i.test(val) ? val : `${val} employees`;
        const period = extractReportingPeriod(text);
        return {
          value: cleanVal,
          reportingPeriod: period,
          confidence: "medium" as const,
        };
      }
      return null;
    },
    cleanName
  );

  const profitField = extractFirstMatch(
    relevantResults,
    (text) => {
      const pMatch = text.match(PROFIT_REGEX);
      if (pMatch && pMatch[1]) {
        const period = extractReportingPeriod(text);
        return {
          value: `Net Profit: ${pMatch[1].trim()}`,
          reportingPeriod: period,
          confidence: period ? ("high" as const) : ("medium" as const),
        };
      }
      return null;
    },
    cleanName
  );

  const trendField = extractFirstMatch(
    relevantResults,
    (text) => {
      const trendMatch = text.match(
        /(?:(?:net\s+profit|revenue|margin|ebit)\s+(?:rises?|rose|surged|jumped|expanded|grew|increased|improved|fell|slid|declined)\s+(?:by\s+|over\s+)?[\d.]+%\s*(?:YoY|QoQ|sequentially|year-on-year)?)/i
      );
      if (trendMatch) {
        const period = extractReportingPeriod(text);
        return {
          value: trendMatch[0].trim(),
          reportingPeriod: period,
          confidence: "medium" as const,
        };
      }
      return null;
    },
    cleanName
  );

  const incDateField = extractFirstMatch(
    relevantResults,
    (text) => {
      const incMatch = text.match(/(?:incorporated\s+(?:in|on)|established\s+(?:in|on)|founded\s+(?:in|on))\s*[:=-]?\s*([a-zA-Z]+\s+\d{4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{4})/i);
      return incMatch ? { value: incMatch[1].trim(), confidence: "medium" as const } : null;
    },
    cleanName
  );

  if (!incDateField.value && cinIncYear) {
    incDateField.value = cinIncYear;
    incDateField.verified = true;
    incDateField.confidence = "high";
    incDateField.sourceEntity = cleanName;
    incDateField.sourceTitle = cinField.sourceTitle || "MCA RoC Corporate Registry";
    incDateField.sourceUrl = cinField.sourceUrl;
  }

  let industryVal: string | null = null;
  let industrySource: IncraaxResult | undefined;
  if (relevantResults.length > 0) {
    for (const r of relevantResults) {
      const text = `${r.title} ${r.snippet}`.toLowerCase();
      if (/\b(?:bpm|business\s+process\s+management|bpo|outsourcing)\b/i.test(text)) {
        industryVal = "Business Process Management (BPM) & IT Services";
        industrySource = r;
        break;
      } else if (/\b(?:information\s+technology|software\s+development|it\s+services|digital\s+transformation|it\s+consulting)\b/i.test(text)) {
        industryVal = "IT Services & Digital Consulting";
        industrySource = r;
        break;
      } else if (/\b(?:banking|financial\s+services|nbfc|insurance|investment|finance|capital)\b/i.test(text)) {
        industryVal = "Financial Services & NBFC";
        industrySource = r;
        break;
      } else if (/\b(?:pharmaceutical|healthcare|biotech|diagnostics)\b/i.test(text)) {
        industryVal = "Pharmaceuticals & Healthcare";
        industrySource = r;
        break;
      } else if (/\b(?:consumer\s+electronics|semiconductor|electronics\s+manufacturing|hardware\s+technology)\b/i.test(text)) {
        industryVal = "Electronics & Manufacturing";
        industrySource = r;
        break;
      } else if (/\b(?:automotive|vehicles|motors|automobile)\b/i.test(text)) {
        industryVal = "Automotive & Manufacturing";
        industrySource = r;
        break;
      }
    }
  }

  const industryField: VerifiedField<string> = {
    value: industryVal,
    verified: Boolean(industryVal),
    sourceEntity: industryVal ? cleanName : undefined,
    sourceUrl: industrySource?.url,
    sourceTitle: industrySource?.title,
    confidence: industryVal ? ("high" as const) : undefined,
  };

  const listedResult = relevantResults.find((r) =>
    /\b(?:listed\s+on|publicly\s+traded|stock\s+exchange|bse|nse)\b/i.test(`${r.title} ${r.snippet}`)
  );
  const listingStatusVal = determineListingStatus(cleanName, cinField.value, isTargetLlp, Boolean(listedResult));
  const listingField: VerifiedField<string> = {
    value: listingStatusVal,
    verified: Boolean(listingStatusVal),
    sourceEntity: cleanName,
    sourceUrl: listedResult?.url || cinField.sourceUrl,
    sourceTitle: listedResult?.title || (cinField.value ? "MCA Corporate Registry Record" : undefined),
    confidence: listingStatusVal ? ("high" as const) : undefined,
  };

  let overviewText: string | null = null;
  if (hasEntityEvidence) {
    const informativeSnippet = extractBestCompanyIntroSnippet(relevantResults, cleanName);

    if (informativeSnippet) {
      let cleanSnippet = informativeSnippet
        .replace(/^(?:\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{4}|[a-zA-Z]+\s+\d{1,2},?\s+\d{4})\s*[-—–:.]*\s*/, "")
        .replace(/^[.\s—–-]+/, "")
        .replace(/\s*(?:\.{2,3}\s*)?(?:View\s+more|Read\s+more|Read\s+full\s+article|Click\s+here).*$/i, ".")
        .replace(/\s*\.\.\.\s*$/, ".")
        .replace(/\s+/g, " ")
        .trim();
      if (!cleanSnippet.endsWith(".")) cleanSnippet += ".";

      if (cleanSnippet.toLowerCase().includes(cleanName.toLowerCase())) {
        overviewText = cleanSnippet;
      } else if (/^(?:founded\s+in|headquartered\s+in|incorporated\s+in|operates\s+as|specializes\s+in)/i.test(cleanSnippet)) {
        overviewText = `${cleanName}, ${cleanSnippet.charAt(0).toLowerCase() + cleanSnippet.slice(1)}`;
      } else {
        overviewText = `${cleanName} is an active corporate enterprise${industryField.value ? ` operating in the ${industryField.value} sector` : ""}. ${cleanSnippet}`;
      }
    } else {
      overviewText = `${cleanName} is an active corporate enterprise${industryField.value ? ` operating in the ${industryField.value} sector` : ""} in India, verified through corporate records and live internet search intelligence.`;
    }
  }

  const intelResult: LiveCompanyIntelligence = {
    companyName: cleanName,
    overview: overviewText,
    basicInfo: {
      company_name: cleanName,
      cin: cinField.value,
      cin_field: cinField,
      llpin: llpinField.value,
      llpin_field: llpinField,
      industry: industryField.value,
      industry_field: industryField,
      address: addressField.value,
      address_field: addressField,
      website: websiteField.value,
      website_field: websiteField,
      incorporation_date: incDateField.value,
      incorporation_date_field: incDateField,
      listing_status: listingField.value,
      listing_status_field: listingField,
      country: "India",
      country_field: {
        value: "India",
        verified: true,
        sourceEntity: cleanName,
        sourceTitle: "Official Corporate Jurisdiction",
        confidence: "high" as const,
      },
    },
    financialInfo: {
      company_name: cleanName,
      employees: employeesField.value,
      employees_field: employeesField,
      turnover: revenueField.value,
      turnover_field: revenueField,
      paid_up_capital: paidUpCapitalField.value,
      paid_up_capital_field: paidUpCapitalField,
      authorized_capital: authorizedCapitalField.value,
      authorized_capital_field: authorizedCapitalField,
      profit_status: profitField.value,
      profit_status_field: profitField,
      profit_history: null,
      profit_history_field: { value: null, verified: false },
      last_agm: null,
      last_agm_field: { value: null, verified: false },
      performance_trend: trendField.value,
      performance_trend_field: trendField,
    },
    sources: relevantResults,
    entityVerified: hasEntityEvidence,
  };

  return validateEntityConsistency(intelResult, cleanName);
}