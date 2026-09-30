// lib/companySearch.ts
/**
 * Company/bank-record search against local PostgreSQL database (bank_company_data).
 * Queries verified partner bank records and enriches in real-time with live company intelligence
 * via Incraax Deep Search (without storing in DB tables).
 *
 * Implements canonical company identity resolution, generic typo recovery,
 * field-level data provenance, reporting period preservation, and zero fabricated fallbacks.
 */

import pool from "./db";
import { extractCleanCompanyName } from "./dynamicEligibilityEngine";
import {
  fetchLiveCompanyIntelligence,
  CanonicalCompanyIdentity,
  VerifiedField,
  LiveCompanyIntelligence,
} from "./incraax";

export type { CanonicalCompanyIdentity, VerifiedField };

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
  company_name?: string;
  industry?: string | null;
  industry_field?: VerifiedField<string>;
  address?: string | null;
  address_field?: VerifiedField<string>;
  website?: string | null;
  website_field?: VerifiedField<string>;
  cin?: string | null;
  cin_field?: VerifiedField<string>;
  llpin?: string | null;
  llpin_field?: VerifiedField<string>;
  incorporation_date?: string | null;
  incorporation_date_field?: VerifiedField<string>;
  listing_status?: string | null;
  listing_status_field?: VerifiedField<string>;
  country?: string | null;
  country_field?: VerifiedField<string>;
}

export interface CompanyFinancialInfo {
  id?: string;
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
  last_agm?: string | null;
  last_agm_field?: VerifiedField<string>;
  profit_history?: string | null;
  profit_history_field?: VerifiedField<string>;
  performance_trend?: string | null;
  performance_trend_field?: VerifiedField<string>;
}

export interface LiveCompanyData {
  overview: string | null;
  website: string | null;
  cin: string | null;
  llpin: string | null;
  address: string | null;
  industry: string | null;
  incorporation_date: string | null;
  listing_status: string | null;
  employees: string | null;
  revenue: string | null;
  profit: string | null;
  performance_trend: string | null;
  basicInfo: CompanyBasicInfo | null;
  financialInfo: CompanyFinancialInfo | null;
  entityVerified: boolean;
}

export interface CompanySearchResult {
  found: boolean;
  primaryName: string;
  canonicalIdentity?: CanonicalCompanyIdentity;
  overview: string | null;
  basicInfo: CompanyBasicInfo | null;
  financialInfo: CompanyFinancialInfo | null;
  bankRecords: CompanyRecord[];
  liveInformation?: LiveCompanyData | null;
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
    .replace(/^(?:i\s+(?:work|working|am\s+working)\s+(?:at|in)|(?:my\s+)?(?:employer|company)\s+is|(?:work|working|employed)\s+(?:at|in|by)|employer\s*[:=-]|company\s*[:=-]|at|in)\s+/i, "")
    .replace(/\b(?:private\s+limited|pvt\.?\s*limited|pvt\.?|limited|ltd\.?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCinFromOtherInfo(bankRecords: CompanyRecord[]): string | undefined {
  for (const r of bankRecords) {
    const info = r.other_info || "";
    const cinMatch = info.match(/\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/i);
    if (cinMatch) return cinMatch[1].toUpperCase();
  }
  return undefined;
}

export function extractLlpinFromOtherInfo(bankRecords: CompanyRecord[]): string | undefined {
  for (const r of bankRecords) {
    const info = (r.other_info || "").trim();
    const m = info.match(/\b([A-Z]{3}-\d{4,7})\b/i) || info.match(/\bLLPIN\s*[:=-]?\s*([A-Z0-9-]{7,10})\b/i);
    if (m) return m[1].toUpperCase();
  }
  return undefined;
}

export function isInvalidCompanySearchQuery(text: string): boolean {
  if (!text) return true;
  const raw = text.trim();
  const clean = raw.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < 2) return true;
  if (/^\d+$/.test(clean)) return true;
  if (!/[a-zA-Z]/.test(clean)) return true;

  // Bank policy / guidelines / rules queries belong to policy assistant, not company search:
  if (
    /(?:policy|policies|guideline|guidelines|rules?|criteria|cutoff|cut-off)\b/i.test(clean) &&
    /(?:bank|hdfc|icici|axis|sbi|kotak|bajaj|tata|idfc|indusind|bandhan|yes|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe)/i.test(clean)
  ) {
    return true;
  }

  // Pure bank manager / branch queries belong to manager search:
  if (/\b(?:manager|branch\s*manager|contact\s*manager|bank\s*manager)\b/i.test(clean)) {
    return true;
  }

  // Standalone conversational noise / commands / loan intents:
  if (
    /^(?:help|start|menu|info|information|options|loan|loans|apply|check|calculate|calculator|emi|test|demo|guide|about|details|query|contact|support|service|services|rate|rates|interest|feature|features|foir|score|scores|cibil|credit|bureau|yes|no|none|nil|na|n\/a|okay|ok|sure|cancel|reset|restart|exit|stop)$/i.test(clean)
  ) {
    return true;
  }

  // Greetings:
  if (
    /^(?:h(?:e+l+o+w*|e+l+l+o+w*|l+o+|l+w+|l+l+o+)|h(?:i+|e+y+|e+y+a+)|h(?:owdy|ola|iya)|bonjour|sup|wassup|yo|namaste+|namaskar(?:a|am)?|prana?am|vanakkam|sala+m|ada+b|sat\s*sri\s*akal|radhe\s*radhe|ram\s*ram|jai\s*shri\s*ram|good\s*(?:morning|afternoon|evening|day|night)|morning|evening|greetings|welcome)\b/i.test(clean)
  ) {
    return true;
  }

  // Conversational questions or acknowledgements:
  if (
    /\?$/.test(raw) ||
    /^(?:why|how|what|when|where|who|which|explain|is|can|will|do|did|does|should|would|could|are|am)\b/i.test(clean) ||
    /^(?:ok|okay|sure|yes|yep|yeah|proceed|continue|go\s*ahead|fine|understood|got\s*it|thanks|thank\s*you|bye|cancel|reset)\b/i.test(clean)
  ) {
    return true;
  }

  // Financial parameter statements:
  if (
    /\b(?:salary|take\s*home|in\s*hand|credit\s*score|existing\s*emi|no\s*emi|zero\s*emi|peti|khoka)\b/i.test(clean) ||
    /\b(?:personal\s*loan|home\s*loan|borrow|borrowing|need\s*(?:a\s*)?loan|want\s*(?:a\s*)?loan|apply\s*(?:for\s*)?(?:a\s*)?loan|get\s*(?:a\s*)?loan)\b/i.test(clean)
  ) {
    return true;
  }

  // Job status non-companies:
  if (
    /^(?:i\s+am\s+|i\s*m\s+)?(?:jobless|unemployed|no\s*job|without\s*(?:a\s*)?job|laid\s*off|not\s*working(?:\s*anywhere)?|student|freelancer?|self[\s-]*employed)$/i.test(clean)
  ) {
    return true;
  }

  return false;
}

export async function searchCompany(companyName: string, limit?: number): Promise<CompanySearchResult> {
  const normInput = String(companyName || "").toLowerCase().trim();

  // Guard: Reject generic loan intents, commands, or conversational phrases
  if (
    !normInput ||
    normInput.length < 2 ||
    isInvalidCompanySearchQuery(companyName) ||
    isInvalidCompanySearchQuery(normInput) ||
    /^(i want personal loan|i want loan|i need personal loan|i need loan|want personal loan|want loan|need loan|personal loan|loan eligibility|check eligibility|check loan eligibility|apply loan|apply for loan|salaried|self-employed|self employed|hello|hi|hey|reset|restart|cancel|help)$/i.test(normInput) ||
    /^(i want|i need|want|need|looking for|apply for)\s*(a|personal)?\s*loan$/i.test(normInput)
  ) {
    return { found: false, primaryName: companyName, overview: "", basicInfo: null, financialInfo: null, bankRecords: [], candidates: [], candidateOptions: [], needsDisambiguation: false };
  }

  try {
    let cleaned = extractCleanCompanyName(companyName) || normalizeCompanySearchInput(companyName) || companyName.trim();
    if (!cleaned || cleaned.length < 2 || isInvalidCompanySearchQuery(cleaned)) {
      return { found: false, primaryName: companyName, overview: "", basicInfo: null, financialInfo: null, bankRecords: [], candidates: [], candidateOptions: [], needsDisambiguation: false };
    }
    const rawCleaned = cleaned;
    cleaned = normalizeCompanySearchInput(cleaned) || cleaned;

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

    let bankRes = await pool.query(
      `SELECT bcd.id, bcd.bank_name, bcd.company_category, bcd.other_info, bcd.company_name
        FROM bank_company_data bcd
        WHERE LOWER(bcd.company_name) LIKE LOWER($1) OR LOWER(bcd.company_name) LIKE LOWER($2)
        ORDER BY 
          CASE 
            WHEN LOWER(bcd.company_name) = LOWER($4) THEN 0
            WHEN LOWER(bcd.company_name) = LOWER($3) THEN 1
            WHEN LOWER(bcd.company_name) LIKE LOWER($4 || ' %') OR LOWER(bcd.company_name) LIKE LOWER($4 || ',%') THEN 2
            WHEN LOWER(bcd.company_name) LIKE LOWER($3 || ' %') OR LOWER(bcd.company_name) LIKE LOWER($3 || ',%') THEN 3
            WHEN LOWER(bcd.company_name) LIKE LOWER($4 || '%') THEN 4
            WHEN LOWER(bcd.company_name) LIKE LOWER($3 || '%') THEN 5
            ELSE 6
          END,
          LENGTH(bcd.company_name),
          bcd.company_name,
          bcd.bank_name
        LIMIT 200`,
      [pattern, secondaryPattern, searchTarget, rawCleaned]
    ).catch(() => ({ rows: [], rowCount: 0 }));

    // Generic DB Typo Recovery: If direct LIKE query returned 0 rows, check findCompanySuggestions()
    // Resolves misspellings like "Tech Mahendra" -> "Tech Mahindra Limited" generically in PostgreSQL!
    if ((!bankRes.rows || bankRes.rows.length === 0) && cleaned.length >= 3) {
      const suggestions = await findCompanySuggestions(cleaned, 3);
      if (suggestions.length > 0 && suggestions[0]?.name) {
        const topSuggestion = suggestions[0].name;
        const suggRes = await pool.query(
          `SELECT bcd.id, bcd.bank_name, bcd.company_category, bcd.other_info, bcd.company_name
            FROM bank_company_data bcd
            WHERE LOWER(bcd.company_name) LIKE LOWER($1)
            ORDER BY LENGTH(bcd.company_name), bcd.company_name, bcd.bank_name
            LIMIT 200`,
          [`%${topSuggestion}%`]
        ).catch(() => ({ rows: [], rowCount: 0 }));

        if (suggRes.rows && suggRes.rows.length > 0) {
          bankRes = suggRes;
        }
      }
    }

    const bankRecords: CompanyRecord[] = (bankRes.rows || []).map((r: any, idx: number) => ({
      id: r.id != null ? String(r.id) : undefined,
      bank_name: r.bank_name,
      sr_no: r.sr_no ?? idx + 1,
      company_category: r.company_category,
      other_info: r.other_info,
      company_name: r.company_name,
    }));

    // -----------------------------------------------------------------------
    // IF NOT IN DATABASE: LIVE FALLBACK WITH STRICT EVIDENCE VALIDATION
    // -----------------------------------------------------------------------
    if (bankRecords.length === 0) {
      try {
        const liveQuery = aliasTarget || cleaned || companyName;
        const liveIntel = await fetchLiveCompanyIntelligence(liveQuery);

        // Strict: Only accept live discovery if Incraax returns validated entity evidence
        // (verified domain, verified CIN, or high-confidence overview). Fake queries are rejected!
        const hasVerifiedLiveEvidence =
          liveIntel &&
          liveIntel.entityVerified &&
          Boolean(liveIntel.overview) &&
          Boolean(liveIntel.basicInfo?.website || liveIntel.basicInfo?.cin || liveIntel.basicInfo?.llpin);

        if (hasVerifiedLiveEvidence) {
          const primaryName = liveIntel.companyName || searchTarget || companyName;
          const isLlp = Boolean(liveIntel.basicInfo?.llpin || /\b(?:llp|limited\s+liability\s+partnership)\b/i.test(primaryName));
          const canonicalIdentity: CanonicalCompanyIdentity = {
            canonicalName: primaryName,
            legalName: primaryName,
            cin: isLlp ? undefined : (liveIntel.basicInfo?.cin || undefined),
            llpin: isLlp ? (liveIntel.basicInfo?.llpin || undefined) : undefined,
            isLlp,
            country: liveIntel.basicInfo?.country || "India",
          };

          const liveInformation: LiveCompanyData = {
            overview: liveIntel.overview,
            website: liveIntel.basicInfo?.website || null,
            cin: isLlp ? null : (liveIntel.basicInfo?.cin || null),
            llpin: isLlp ? (liveIntel.basicInfo?.llpin || null) : null,
            address: liveIntel.basicInfo?.address || null,
            industry: liveIntel.basicInfo?.industry || null,
            incorporation_date: liveIntel.basicInfo?.incorporation_date || null,
            listing_status: liveIntel.basicInfo?.listing_status || (isLlp ? "Unlisted Limited Liability Partnership (LLP)" : null),
            employees: liveIntel.financialInfo?.employees || null,
            revenue: liveIntel.financialInfo?.turnover || null,
            profit: liveIntel.financialInfo?.profit_status || null,
            performance_trend: liveIntel.financialInfo?.performance_trend || null,
            basicInfo: liveIntel.basicInfo as any,
            financialInfo: liveIntel.financialInfo as any,
            entityVerified: true,
          };

          return {
            found: true,
            primaryName,
            canonicalIdentity,
            overview: liveIntel.overview,
            basicInfo: liveIntel.basicInfo as any,
            financialInfo: liveIntel.financialInfo as any,
            bankRecords: [],
            liveInformation,
            candidates: [primaryName],
            candidateOptions: [{ id: primaryName, name: primaryName, source: "live" as const }],
            needsDisambiguation: false,
          };
        }
      } catch (liveErr) {
        console.warn("[Incraax] Live company fallback error:", liveErr);
      }

      // No PostgreSQL record and no verified live evidence -> found: false
      return { found: false, primaryName: companyName, overview: "", basicInfo: null, financialInfo: null, bankRecords: [], liveInformation: null, candidates: [], candidateOptions: [], needsDisambiguation: false };
    }

    // -----------------------------------------------------------------------
    // DATABASE RECORDS FOUND: RESOLVE CANDIDATES & CANONICAL IDENTITY
    // -----------------------------------------------------------------------
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

    const qLower = cleaned.toLowerCase();
    const exactInputLower = companyName.trim().toLowerCase();
    const searchTargetLower = searchTarget.toLowerCase();

    // Relevance scoring for matching candidates:
    const getRelevanceScore = (name: string): number => {
      const lower = name.toLowerCase();
      if (lower === exactInputLower || lower === rawCleaned.toLowerCase()) {
        return 0;
      }
      if (
        lower === qLower ||
        lower === searchTargetLower ||
        lower === `${qLower} limited` ||
        lower === `${qLower} ltd` ||
        lower === `${qLower} private limited` ||
        lower === `${qLower} pvt ltd` ||
        lower === `${searchTargetLower} limited` ||
        lower === `${searchTargetLower} ltd`
      ) {
        return 1;
      }
      if (
        lower.startsWith(exactInputLower + " ") ||
        lower.startsWith(rawCleaned.toLowerCase() + " ") ||
        lower.startsWith(qLower + " ") ||
        lower.startsWith(searchTargetLower + " ")
      ) {
        return 2;
      }
      const escaped = qLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) {
        return 3;
      }
      return 4;
    };

    const allCandidates = Array.from(candidateMap.values()).sort((a, b) => {
      const scoreA = getRelevanceScore(a.name);
      const scoreB = getRelevanceScore(b.name);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.name.length - b.name.length;
    });

    // Deduplicate candidates by normalized company name
    const seenNames = new Set<string>();
    const deduplicatedCandidates: CompanyCandidate[] = [];
    for (const cand of allCandidates) {
      const normKey = cand.name.toLowerCase().replace(/[.,;!?]+$/, "").trim();
      if (!seenNames.has(normKey)) {
        seenNames.add(normKey);
        deduplicatedCandidates.push(cand);
      }
    }

    const candidates = deduplicatedCandidates.map((candidate) => candidate.name);

    const exactMatch =
      candidates.find((c) => c.toLowerCase() === exactInputLower || c.toLowerCase() === rawCleaned.toLowerCase()) ||
      candidates.find((c) => c.toLowerCase() === qLower) ||
      candidates.find((c) => {
        const cLow = c.toLowerCase();
        return (
          cLow === `${qLower} limited` ||
          cLow === `${qLower} ltd` ||
          cLow === `${qLower} private limited` ||
          cLow === `${qLower} pvt ltd`
        );
      }) ||
      (searchTargetLower ? candidates.find((c) => {
        const cLow = c.toLowerCase();
        return (
          cLow === searchTargetLower ||
          cLow === `${searchTargetLower} limited` ||
          cLow === `${searchTargetLower} ltd`
        );
      }) : undefined);

    let selectedBankRecords = bankRecords;
    let primaryName = exactMatch || candidates[0] || companyName;

    // Explicit selection occurs when the user's input exactly matches one of the canonical candidate names
    const isExplicitSelection = candidates.some((c) => c.toLowerCase() === exactInputLower || c.toLowerCase() === rawCleaned.toLowerCase());

    // If multiple candidates exist and the user has not explicitly selected an exact canonical candidate name,
    // require disambiguation so the user can choose their exact employer from the numbered list.
    let needsDisambiguation = candidates.length > 1 && !isExplicitSelection;

    if (exactMatch) {
      primaryName = exactMatch;
      const exactFiltered = bankRecords.filter((r) => r.company_name.toLowerCase() === exactMatch.toLowerCase());
      if (exactFiltered.length > 0) {
        selectedBankRecords = exactFiltered;
      }
    }

    // Build focused, ranked candidate options (top relevant candidates up to 10)
    let candidateOptions: CompanyCandidate[] = [];
    if (isExplicitSelection) {
      candidateOptions = [
        deduplicatedCandidates.find((c) => c.name.toLowerCase() === exactInputLower || c.name.toLowerCase() === rawCleaned.toLowerCase()) || {
          id: primaryName,
          name: primaryName,
          source: "database",
        },
      ];
      needsDisambiguation = false;
    } else if (candidates.length === 1) {
      candidateOptions = deduplicatedCandidates.slice(0, 1);
      needsDisambiguation = false;
    } else {
      candidateOptions = deduplicatedCandidates.slice(0, 10);
      needsDisambiguation = candidateOptions.length > 1;
    }

    const isLlp = /\b(?:llp|limited\s+liability\s+partnership)\b/i.test(primaryName);
    const extractedCin = !isLlp ? extractCinFromOtherInfo(selectedBankRecords) : undefined;
    const extractedLlpin = isLlp ? extractLlpinFromOtherInfo(selectedBankRecords) : undefined;

    // Construct Canonical Company Identity
    const canonicalIdentity: CanonicalCompanyIdentity = {
      canonicalName: primaryName,
      legalName: exactMatch || primaryName,
      databaseId: selectedBankRecords[0]?.id,
      cin: extractedCin,
      llpin: extractedLlpin,
      isLlp,
      country: "India",
      isPublic: Boolean(!isLlp && primaryName.toLowerCase().includes("limited") && !primaryName.toLowerCase().includes("private")),
    };

    // Fetch live company intelligence in real-time on-the-fly (NOT stored in DB)
    let overview: string | null = `${primaryName} is verified in partner bank corporate records.`;
    let basicInfo: CompanyBasicInfo | null = null;
    let financialInfo: CompanyFinancialInfo | null = null;
    let liveInformation: LiveCompanyData | null = null;

    if (!needsDisambiguation && primaryName) {
      try {
        const liveIntel = await fetchLiveCompanyIntelligence(canonicalIdentity, extractedCin, extractedLlpin);
        if (liveIntel) {
          if (liveIntel.entityVerified && liveIntel.overview) {
            overview = liveIntel.overview;
          }
          basicInfo = liveIntel.basicInfo as any;
          financialInfo = liveIntel.financialInfo as any;

          liveInformation = {
            overview: liveIntel.entityVerified ? liveIntel.overview : null,
            website: liveIntel.basicInfo?.website || null,
            cin: isLlp ? null : (liveIntel.basicInfo?.cin || extractedCin || null),
            llpin: isLlp ? (liveIntel.basicInfo?.llpin || extractedLlpin || null) : null,
            address: liveIntel.basicInfo?.address || null,
            industry: liveIntel.basicInfo?.industry || null,
            incorporation_date: liveIntel.basicInfo?.incorporation_date || null,
            listing_status: liveIntel.basicInfo?.listing_status || (isLlp ? "Unlisted Limited Liability Partnership (LLP)" : null),
            employees: liveIntel.financialInfo?.employees || null,
            revenue: liveIntel.financialInfo?.turnover || null,
            profit: liveIntel.financialInfo?.profit_status || null,
            performance_trend: liveIntel.financialInfo?.performance_trend || null,
            basicInfo,
            financialInfo,
            entityVerified: liveIntel.entityVerified,
          };
        }
      } catch (liveErr) {
        console.warn("[Incraax] Live enrichment error:", liveErr);
      }
    }

    return {
      found: true,
      primaryName,
      canonicalIdentity,
      overview,
      basicInfo,
      financialInfo,
      bankRecords: selectedBankRecords,
      liveInformation,
      candidates,
      candidateOptions,
      needsDisambiguation,
    };
  } catch (err: any) {
    console.error("searchCompany database error:", err?.message || err);
    return { found: false, primaryName: companyName, overview: "", basicInfo: null, financialInfo: null, bankRecords: [], candidates: [], candidateOptions: [], needsDisambiguation: false };
  }
}

/** Small deterministic typo matcher over verified company names in bank_company_data. */
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

  // 1. Query bank_company_data prefix match in DB
  const prefix = normalized.slice(0, 2);
  const result = await pool.query(
    `SELECT MIN(id)::text AS id, company_name
       FROM bank_company_data
       WHERE LOWER(company_name) LIKE $1
       GROUP BY company_name
       LIMIT 500`,
    [`${prefix}%`]
  ).catch(() => ({ rows: [] }));

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
 * Format complete Company Search Result into clean, structured Markdown.
 * Shows validated real-time live company intelligence and verified partner bank records.
 * Displays reporting periods and cleanly indicates unverified fields without fabricating values.
 */
export function formatCompanyResponse(compRes: CompanySearchResult): string {
  const lines: string[] = [];

  const isLlp = Boolean(
    compRes.canonicalIdentity?.isLlp ||
    /\b(?:llp|limited\s+liability\s+partnership)\b/i.test(compRes.primaryName)
  );

  // 1. Company Overview
  lines.push(`### 🏢 Company Overview: **${compRes.primaryName}**`);
  lines.push("");
  lines.push(compRes.overview || `${compRes.primaryName} is verified in partner bank corporate records.`);
  lines.push("");

  // 2. Live Company Information
  lines.push(`### Live Company Information`);
  lines.push("");

  const formatValue = (val: any) => {
    if (
      val === null ||
      val === undefined ||
      String(val).trim() === "" ||
      /^(?:undefined|null|n\/a|-|not available from verified source)$/i.test(String(val).trim())
    ) {
      return "-";
    }
    return String(val).trim();
  };

  const live = compRes.liveInformation;
  const b = live?.basicInfo || compRes.basicInfo;
  const rowsBasic: [string, string][] = [
    ["Industry", formatValue(live?.industry || b?.industry)],
    ["Country", formatValue(b?.country || "India")],
    ["Incorporation Date", formatValue(live?.incorporation_date || b?.incorporation_date)],
    ["Listing Status", formatValue(live?.listing_status || b?.listing_status)],
  ];

  if (isLlp) {
    rowsBasic.push(["LLPIN", formatValue(live?.llpin || b?.llpin || compRes.canonicalIdentity?.llpin)]);
  } else {
    rowsBasic.push(["CIN", formatValue(live?.cin || b?.cin || compRes.canonicalIdentity?.cin)]);
  }

  rowsBasic.push(["Address", formatValue(live?.address || b?.address)]);
  rowsBasic.push(["Website", formatValue(live?.website || b?.website)]);

  lines.push(`#### Basic Information`);
  lines.push("");
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  rowsBasic.forEach(([label, value]) => lines.push(`| ${label} | ${value} |`));
  lines.push("");

  const f = live?.financialInfo || compRes.financialInfo;
  const formatFinancialValue = (val: any, field?: VerifiedField<string>) => {
    if (
      val === null ||
      val === undefined ||
      String(val).trim() === "" ||
      /^(?:undefined|null|n\/a|-|not available from verified source)$/i.test(String(val).trim())
    ) {
      return "-";
    }
    const periodStr = field?.reportingPeriod ? ` *(${field.reportingPeriod})*` : "";
    return `${String(val).trim()}${periodStr}`;
  };

  const rowsFinancial: [string, string][] = [
    ["Employees", formatFinancialValue(live?.employees || f?.employees, f?.employees_field)],
    ["Turnover / Revenue", formatFinancialValue(live?.revenue || f?.turnover, f?.turnover_field)],
  ];

  if (f?.paid_up_capital || f?.paid_up_capital_field?.value) {
    rowsFinancial.push(["Paid-up Capital", formatFinancialValue(f?.paid_up_capital, f?.paid_up_capital_field)]);
  }
  if (f?.authorized_capital || f?.authorized_capital_field?.value) {
    rowsFinancial.push(["Authorized Capital", formatFinancialValue(f?.authorized_capital, f?.authorized_capital_field)]);
  }

  rowsFinancial.push(
    ["Profit Status", formatFinancialValue(live?.profit || f?.profit_status, f?.profit_status_field)],
    ["Last AGM", formatFinancialValue(f?.last_agm, f?.last_agm_field)],
    ["Performance Trend", formatFinancialValue(live?.performance_trend || f?.performance_trend, f?.performance_trend_field)]
  );

  lines.push(`#### Financial Information`);
  lines.push("");
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  rowsFinancial.forEach(([label, value]) => lines.push(`| ${label} | ${value} |`));
  lines.push("");

  // 3. Partner Bank Records (from PostgreSQL bank_company_data)
  const records = compRes.bankRecords || [];
  const uniqueRecords = records.filter((r: any, idx: number, self: any[]) =>
    idx === self.findIndex((t: any) => t.bank_name?.toLowerCase() === r.bank_name?.toLowerCase())
  );

  lines.push(`### Partner Bank Records`);
  lines.push(`*(Partner Bank / Employer Records verified in PostgreSQL)*`);
  lines.push("");
  if (uniqueRecords.length > 0) {
    lines.push(`| Bank Name | Category | Other Info |`);
    lines.push(`| --- | --- | --- |`);
    uniqueRecords.slice(0, 30).forEach((r: any) => {
      lines.push(`| ${r.bank_name} | ${r.company_category || "Approved"} | ${r.other_info || "-"} |`);
    });
    lines.push("");
  } else {
    lines.push(`Company not listed under specific partner bank lists. Evaluated under Open Market / Standard Tier criteria across partner banks.`);
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
  // Numbered markdown list as resilient fallback for all markdown renderers and mobile clients
  candidates.slice(0, 10).forEach((c, idx) => {
    lines.push(`${idx + 1}. **${c}**`);
  });
  lines.push("");
  lines.push("*(Click any company above or reply with 1, 2, etc. to continue)*");
  return lines.join("\n");
}
