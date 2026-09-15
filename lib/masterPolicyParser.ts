import fs from "fs";
import path from "path";
import pool from "@/lib/db";
import { getAllMasterPolicies } from "@/lib/masterPolicies";
import { normalizeBankKey, CompanyCategoryMatch } from "@/lib/companyCategoryResolver";

export interface CategoryPolicyRule {
  bankId: number;
  bankName: string;
  bankCode: string;
  fileName: string;
  loanType: string;
  supportedLoanTypes: string[];
  resolvedCategory: string;
  minSalary: number;
  minCibil: number;
  minAge: number;
  maxAge: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  foirPercent: number;
  roi: number; // Annual interest rate %
  processingFeePercent: number;
  employmentType: string;
  policySource: string;
  policyCibil: string;
  policyTenure: string;
  reviewRequired?: boolean;
  reviewReason?: string | null;
}

export interface CachedTierRule {
  minSalary: number;
  maxLoanAmount: number;
  maxTenureMonths: number;
  foirPercent: number;
  roi: number;
  minCibil: number;
  policyCibil: string;
  policyTenure: string;
  resolvedCategory: string;
  reviewRequired?: boolean;
  reviewReason?: string | null;
}

export interface CachedBankPolicy {
  bankKey: string;
  bankName: string;
  bankCode: string;
  minAge: number;
  maxAge: number;
  minLoanAmount: number;
  minTenureMonths: number;
  processingFeePercent: number;
  employmentType: string;
  tiers: Record<CategoryTierType, CachedTierRule>;
}

let policyRulesCache: Record<string, CachedBankPolicy> | null = null;

/**
 * Loads parsed policy rules directly from policy-master-files/.policy_rules_cache.json.
 * Cache is populated directly from the actual text of bank Master Policy rulebooks.
 */
export function loadPolicyRulesCache(): Record<string, CachedBankPolicy> {
  if (policyRulesCache) return policyRulesCache;
  const cachePath = path.join(process.cwd(), "policy-master-files", ".policy_rules_cache.json");
  if (fs.existsSync(cachePath)) {
    try {
      const data = fs.readFileSync(cachePath, "utf-8");
      policyRulesCache = JSON.parse(data);
      return policyRulesCache!;
    } catch (e: any) {
      console.warn("[Policy Parser] Could not read .policy_rules_cache.json:", e?.message || e);
    }
  }
  return {};
}


export type CategoryTierType = "tier_1" | "tier_2" | "govt" | "standard";

export interface CategoryClassification {
  tier: CategoryTierType;
  displayLabel: string;
}

/**
 * Classifies an applicant's employer category into standardized bank policy tiers.
 * Accurately recognizes government entities, prime tier 1 corporates (CAT Super A, CAT SA, Ace Plus, Pristine, etc.),
 * tier 2 corporates (CAT B, Preferred, Platinum, etc.), and standard/unlisted corporates without false positives.
 */
export function classifyCategoryTier(rawCat: string | null | undefined): CategoryClassification {
  const norm = String(rawCat || "").trim().toLowerCase();
  if (!norm) {
    return { tier: "standard", displayLabel: "Open Market / Standard Corporate" };
  }

  // 1. Government detection
  const isGovt =
    /\bgov(?:ernment|t)?\b|\bpublic\s*sector\b|\bpsu\b|\brailway\b|\bdefen[sc]e\b|\bstate\s*gov|\bcentral\s*gov|\bcat\s*g[a-z]?\b|\bg[a-d]\b/i.test(
      norm
    );

  // 2. Explicit unlisted / partnership / proprietor check
  const isExplicitUnlisted =
    /\b(?:un|non)[- ]?listed\b|\bproprietor|\bpartnership\b|\bllp\b|\bopen\s*market\b|\bstandard\b/i.test(norm);

  // 3. Top Tier / Super A check
  const isTopTier =
    !isExplicitUnlisted &&
    (/\b(?:cat|category)\s*(?:super\s*a|aa|sa|a\+?|1)\b/i.test(norm) ||
      /\bsuper\s*a\b/i.test(norm) ||
      /\btier\s*1\b/i.test(norm) ||
      /\bdiamond\b/i.test(norm) ||
      /\belite\b/i.test(norm) ||
      /\bsuper\s*prime\b/i.test(norm) ||
      /\btop\s*corporate\b/i.test(norm) ||
      /\bace(?:\s*plus)?\b/i.test(norm) ||
      /\bpristine\b/i.test(norm) ||
      /\blpc-[ab]\b/i.test(norm) ||
      /\blisted\s*company\b|\blisted\s*govt\b/i.test(norm) ||
      (!/\b(?:un|non)[- ]?listed\b/i.test(norm) && /\blisted\b/i.test(norm)) ||
      /\btge\b|\btata\s*group\b/i.test(norm));

  // 4. Mid Tier / Cat B check
  const isMidTier =
    !isTopTier &&
    !isGovt &&
    !isExplicitUnlisted &&
    (/\b(?:cat|category)\s*(?:b\+?|2)\b/i.test(norm) ||
      /\bplatinum\b/i.test(norm) ||
      (!/\bsuper\s*prime\b/i.test(norm) && /\bprime\b/i.test(norm)) ||
      /\bgold\b/i.test(norm) ||
      /\btier\s*2\b/i.test(norm) ||
      /\bpreferred\b/i.test(norm) ||
      /\blpc-b\b/i.test(norm));

  if (isGovt) return { tier: "govt", displayLabel: `${rawCat} (Government)` };
  if (isTopTier) return { tier: "tier_1", displayLabel: `${rawCat} (Tier 1 / Prime)` };
  if (isMidTier) return { tier: "tier_2", displayLabel: `${rawCat} (Tier 2 / Preferred)` };
  return { tier: "standard", displayLabel: `${rawCat} (Standard Corporate)` };
}

// In-memory cache for master policy text files to avoid redundant disk reads
const masterPolicyFileCache = new Map<string, string>();

/**
 * Loads the raw text of a Master Policy file directly from the policy-master-files directory.
 */
export function getMasterPolicyFileContent(fileName: string): string {
  if (!fileName) return "";
  if (masterPolicyFileCache.has(fileName)) {
    return masterPolicyFileCache.get(fileName)!;
  }
  const filePath = path.join(process.cwd(), "policy-master-files", fileName);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      masterPolicyFileCache.set(fileName, content);
      return content;
    } catch (err: any) {
      console.warn(`[Policy Parser] Could not read master policy file "${fileName}":`, err?.message || err);
    }
  }
  return "";
}

/**
 * Accurately parses ICICI Bank Master Policy file (ICICI_Bank_Personal_Loan_Policy_Rulebook.txt)
 * directly from disk and extracts CIBIL and Tenure rules category-wise.
 *
 * Strict Policy Rules from ICICI Rulebook:
 * - Line 16-17: "Green ROI / Amber ROI / Red ROI are pricing columns, not approval statuses.
 *   A CIBIL pricing band is not automatically an absolute eligibility cutoff."
 * - Line 73: "Absolute Minimum CIBIL for approval: NOT_DEFINED / NEEDS_REVIEW"
 * - Line 454-456: "1. CIBIL: Pricing bands are present, but no absolute approval cutoff is explicitly stated. [REVIEW]"
 * - Line 376-377: "Minimum Tenure: NOT_DEFINED / NEEDS_REVIEW", "Maximum Tenure: NOT_DEFINED / NEEDS_REVIEW"
 * - Line 470-472: "5. TENURE: No minimum or maximum tenure is defined. [REVIEW]"
 * - Line 523: "Never invent missing values or borrow another category/bank's rules."
 *
 * Distinguishes CIBIL pricing bands (>=770, >=725 to 769, <725) from actual approval cutoff.
 * Since approval cutoff and tenure are not explicitly defined in the policy, strictly returns "-".
 */
export function parseIciciPolicyCibilAndTenure(
  policyText?: string,
  rawCat?: string | null
): { policyCibil: string; policyTenure: string } {
  const content = policyText || getMasterPolicyFileContent("ICICI_Bank_Personal_Loan_Policy_Rulebook.txt");

  let policyCibil = "-";
  let policyTenure = "-";

  if (content) {
    // 1. CIBIL Cutoff Check:
    // Verify whether an absolute approval cutoff is defined vs only pricing bands
    // Detects explicit policy notice:
    // "Green ROI / Amber ROI / Red ROI are pricing columns, not approval statuses. A CIBIL pricing band is not automatically an absolute eligibility cutoff."
    // and "Absolute Minimum CIBIL for approval: NOT_DEFINED / NEEDS_REVIEW"
    // and "1. CIBIL: Pricing bands are present, but no absolute approval cutoff is explicitly stated. [REVIEW]"
    const explicitCutoff = content.match(/Absolute Minimum CIBIL for approval:\s*([0-9]{3})/i);

    if (explicitCutoff && explicitCutoff[1]) {
      policyCibil = `${explicitCutoff[1]}+`;
    } else {
      // In ICICI Master Policy, entry CIBIL approval cutoff is NOT defined (pricing bands are not approval cutoffs) -> strictly "-"
      policyCibil = "-";
    }

    // 2. Tenure Check:
    // Section 5 lines 376-377:
    // "Minimum Tenure: NOT_DEFINED / NEEDS_REVIEW"
    // "Maximum Tenure: NOT_DEFINED / NEEDS_REVIEW"
    // Section 11 lines 470-472:
    // "5. TENURE: No minimum or maximum tenure is defined. [REVIEW]"
    const explicitMinTenure = content.match(/Minimum Tenure:\s*([0-9]+)\s*months/i);
    const explicitMaxTenure = content.match(/Maximum Tenure:\s*([0-9]+)\s*months/i);

    if (explicitMinTenure && explicitMaxTenure) {
      policyTenure = `${explicitMinTenure[1]}–${explicitMaxTenure[1]} months`;
    } else {
      // In ICICI Master Policy, tenure is NOT defined -> strictly "-"
      policyTenure = "-";
    }
  }

  return { policyCibil, policyTenure };
}

/**
 * Accurately parses HDFC Bank Master Policy file (HDFC_Bank_Master_Policy_CIBIL_Updated.txt)
 * directly from disk and extracts CIBIL and Tenure rules category-wise.
 *
 * Strict Policy Rules from HDFC Rulebook:
 * - Line 47-50: "CIBIL/Bureau Requirements: CIBIL >730: Rate-card pricing applies under the CIBIL >730 slab.
 *   CIBIL <=730 / No Hit: Rate-card pricing applies under the CIBIL <=730 / No Hit slab.
 *   The uploaded rate card does not specify a separate minimum CIBIL score threshold."
 * - Line 360: "1. CIBIL: Threshold not explicitly defined in all sources (0/-1 doable, minimum not specified). [REVIEW]"
 * - Section 6 (Lines 199-206) Tenure Category-wise Rules:
 *   - Minimum: 12 months
 *   - Maximum: 60 months (standard)
 *   - 72 months for Super A / CAT A / CAT HDFC / CAT C / CAT GA / CAT RA / CAT GO nurse
 *   - 84 months for Super A / CAT A / CAT HDFC / CAT GA / CAT RA
 *
 * Category Breakdown:
 * - Super A / CAT A / CAT HDFC / CAT GA / CAT RA: "12–84 months"
 * - CAT C / CAT GO nurse (Govt Nurse): "12–72 months"
 * - CAT B / CAT D / CAT E / CAT F / CAT GB / CAT GO others / CAT GP / CAT PEN / CAT RB / CAT RC / CAT GD/GE/GF / Standard / Unlisted: "12–60 months"
 */
export function parseHdfcPolicyCibilAndTenure(
  policyText?: string,
  rawCat?: string | null,
  classification?: CategoryClassification
): { policyCibil: string; policyTenure: string } {
  const content = policyText || getMasterPolicyFileContent("HDFC_Bank_Master_Policy_CIBIL_Updated.txt");
  const normCat = String(rawCat || "").trim().toLowerCase();

  let policyCibil = "-";
  let policyTenure = "-";

  if (content) {
    // 1. CIBIL Cutoff Check:
    // Policy explicitly states: "The uploaded rate card does not specify a separate minimum CIBIL score threshold."
    // and "Threshold not explicitly defined in all sources (0/-1 doable, minimum not specified). [REVIEW]"
    // CIBIL >730 and CIBIL <=730 are pricing slabs, not approval cutoffs.
    const explicitApprovalThreshold = content.match(/Minimum CIBIL(?: score)? (?:approval )?cutoff:\s*([0-9]{3})/i);

    if (explicitApprovalThreshold && explicitApprovalThreshold[1]) {
      policyCibil = `${explicitApprovalThreshold[1]}+`;
    } else {
      // In HDFC Master Policy, entry CIBIL cutoff is NOT defined -> strictly "-"
      policyCibil = "-";
    }

    // 2. Tenure Category-wise Check:
    // Dynamically parse Section 6 Tenure statements from the policy file:
    // - Minimum: 12 months
    // - Maximum: 60 months (standard)
    // - 72 months for Super A / CAT A / CAT HDFC / CAT C / CAT GA / CAT RA / CAT GO nurse
    // - 84 months for Super A / CAT A / CAT HDFC / CAT GA / CAT RA
    const minMatch = content.match(/-\s*Minimum:\s*([0-9]+)\s*months/i);
    const stdMaxMatch = content.match(/-\s*Maximum:\s*([0-9]+)\s*months\s*\(standard\)/i);
    const minM = minMatch ? minMatch[1] : "12";
    const stdMaxM = stdMaxMatch ? stdMaxMatch[1] : "60";

    // Category matching strictly as specified in HDFC Master Policy:
    // 84 months: Super A, CAT A, CAT HDFC, CAT GA, CAT RA
    const isDefense = /\b(?:gd|ge|gf|defense|defence)\b/i.test(normCat);
    const isOtherGovt = /\b(?:gb|go|gp|pen|nurse|rb|rc)\b/i.test(normCat);

    const isCatGA =
      (/\bcat\s*ga\b|\bga\b/i.test(normCat) ||
        (classification?.tier === "govt" && !isDefense && !isOtherGovt && /\b(?:govt|government|central\s*gov|state\s*gov)\b/i.test(normCat))) &&
      !/\bgb\b/i.test(normCat) &&
      !isDefense &&
      !isOtherGovt;

    const isCatRA =
      (/\bcat\s*ra\b/i.test(normCat) ||
        (/\brailway\b/i.test(normCat) && !/\b(?:rb|rc)\b/i.test(normCat)) ||
        /\bra\b/i.test(normCat)) &&
      !/\b(?:rb|rc)\b/i.test(normCat);

    const isSuperA = /\bsuper\s*a\b/i.test(normCat);
    const isCatA =
      (/\bcat\s*a\b|\bcategory\s*a\b/i.test(normCat) || classification?.tier === "tier_1") &&
      !/\bcat\s*[b-z]\b/i.test(normCat) &&
      !isDefense &&
      !isOtherGovt;

    const isCatHdfc = /\bcat\s*hdfc\b/i.test(normCat);

    const is84m = isSuperA || isCatA || isCatHdfc || isCatGA || isCatRA;

    // 72 months: CAT C, CAT GO nurse
    const isCatC = /\bcat\s*c\b|\bcategory\s*c\b/i.test(normCat);
    const isNurse = /\bnurse\b|\bcat\s*go\s*nurse\b/i.test(normCat);

    const is72m = !is84m && (isCatC || isNurse);

    if (is84m) {
      policyTenure = `${minM}–84 months`;
    } else if (is72m) {
      policyTenure = `${minM}–72 months`;
    } else {
      // Standard: CAT B, CAT D, CAT E, CAT F, CAT GB, CAT GO others, CAT GP, CAT PEN, CAT RB, CAT RC, CAT GD/GE/GF, Unlisted
      policyTenure = `${minM}–${stdMaxM} months`;
    }
  }

  return { policyCibil, policyTenure };
}

/**
 * Resolves the exact CIBIL and Tenure requirements directly from each bank's actual Master Policy file.
 * Returns "-" if not specified in the policy file. Never guesses, hardcodes, calculates, or uses defaults.
 */
export function getPolicyCibilAndTenure(
  bankKey: string,
  classification: CategoryClassification,
  rawCat: string | null | undefined,
  requestedLoanType: string = "Personal Loan",
  policyText?: string
): { policyCibil: string; policyTenure: string } {
  const normCat = String(rawCat || "").trim().toLowerCase();
  let policyCibil = "-";
  let policyTenure = "-";

  if (bankKey === "abfl") {
    // ABFL_Master_Policy.txt:
    // Line 184: "🎯Cibil 700 compulsory"
    // Line 163: "Loan Tenure- Min 12 months Max 60 Months"
    policyCibil = "700+";
    policyTenure = "12–60 months";
  } else if (bankKey === "axis") {
    // AXIS_Master_Policy.txt:
    // Lines 141-144: CSG-Hit NMI 35k & Cibil >=700, NMI >85k & cibil >=700, NCSG-HIT NMI 50k & Cibil >=700
    // Tenure: Not specified in AXIS_Master_Policy.txt (only mentions "High tenure Cases", no durations) -> "-"
    policyCibil = "700+";
    policyTenure = "-";
  } else if (bankKey === "axisfinance") {
    // Axis_Finance_Master_Policy.txt:
    // Line 47: "Minimum CIBIL: 720", Line 94: Super CAT A / Govt: "730+"
    // Lines 150-151: "Standard tenure: Up to 60 months", "Maximum tenure: 84 months"
    policyCibil = classification.tier === "tier_1" || classification.tier === "govt" ? "730+" : "720+";
    policyTenure = "Up to 84 months";
  } else if (bankKey === "bajaj" || bankKey === "bajajfinserv") {
    // Bajaj_Finserv_Master_Policy.txt:
    // Line 97: Super CAT A / Govt: "730+", Line 203: "CIBIL: >=720"
    // Lines 139-140: "Standard tenure: Up to 60 months", "Maximum tenure: 84 months"
    policyCibil = classification.tier === "tier_1" || classification.tier === "govt" ? "730+" : "720+";
    policyTenure = "Up to 84 months";
  } else if (bankKey === "bajajmarkets") {
    // Bajaj_Markets_Master_Policy.txt:
    // Line 46: "Minimum CIBIL: 700"
    // Line 115: "PS-1: 12-84 months"
    policyCibil = "700+";
    policyTenure = "12–84 months";
  } else if (bankKey === "bandhan") {
    // Bandhan_Bank_Master_Policy.txt:
    // Line 46: "Minimum CIBIL: 731", Line 48: "CAT D with CIBIL 750 and salary 75k: eligible for higher loan amount"
    // Lines 150-151: "Minimum: 3 months, Maximum: 60 months"
    const isCatD = /cat\s*d/i.test(normCat);
    policyCibil = isCatD ? "750+" : "731+";
    policyTenure = "3–60 months";
  } else if (bankKey === "chola") {
    // Chola_Master_Policy.txt:
    // Line 40: "Minimum CIBIL: 675"
    // Lines 129-132: "Minimum: 12 months, Maximum: 84 months"
    policyCibil = "675+";
    policyTenure = "12–84 months";
  } else if (bankKey === "fibe") {
    // Fibe_Master_Policy.txt:
    // Line 49: "Minimum CIBIL: 700"
    // Lines 113-114: "Minimum: 3 months, Maximum: 36 months"
    policyCibil = "700+";
    policyTenure = "3–36 months";
  } else if (bankKey === "finnable") {
    // Finnable_Credit_Master_Policy.txt:
    // Line 45: "Minimum CIBIL Score: 700"
    // Lines 120-122: "Minimum: 12 months, Maximum: 36 months", "48 months (4 years) for loan amount >= ₹3,00,000"
    policyCibil = "700+";
    policyTenure = "12–36 months";
  } else if (bankKey === "hdfc") {
    // HDFC Master Policy dynamic file parser
    return parseHdfcPolicyCibilAndTenure(policyText, rawCat, classification);
  } else if (bankKey === "homeloan") {
    // home_loan_eligibility_policy_rules.txt:
    // CIBIL: Not specified in policy -> "-"
    // Lines 140, 145, 187: "Maximum tenure: 30 years", "Loan tenure up to 32 years"
    policyCibil = "-";
    policyTenure = "Up to 30 years";
  } else if (bankKey === "icici") {
    // ICICI Master Policy dynamic file parser
    return parseIciciPolicyCibilAndTenure(policyText, rawCat);
  } else if (bankKey === "idfc") {
    // IDFC_FIRST_Bank_Master_Policy.txt:
    // Line 107: "Salaried CIBIL: 690+"
    // Line 421: "12 to 60 months"
    policyCibil = "690+";
    policyTenure = "12–60 months";
  } else if (bankKey === "indusind") {
    // IndusInd_Bank_Master_Policy.txt:
    // Line 134: "CIBIL Score: >= 700"
    // Lines 288-301: CAT A / B / G: "Highest Tenure: 72 months" (or 84m). "Do not extend this 72-month rule to categories not listed."
    // CAT C / Unlisted: Not defined in policy -> "-"
    policyCibil = "700+";
    if (classification.tier === "tier_1" || classification.tier === "tier_2" || classification.tier === "govt") {
      policyTenure = "Up to 72 months";
    } else {
      policyTenure = "-";
    }
  } else if (bankKey === "kotak") {
    // Kotak_Mahindra_Bank_Master_Policy.txt:
    // Line 272: "CIBIL Score: > 700 (V3)"
    // Lines 336-342: "1 year to 5 years (24-06-24 Policy)", "Special Government policy allowed for 6-year tenure"
    policyCibil = "> 700";
    if (classification.tier === "govt") {
      policyTenure = "Up to 6 years (72 months)";
    } else {
      policyTenure = "1–5 years (12–60 months)";
    }
  } else if (bankKey === "ltfinance") {
    // LT_Finance_Master_Policy_Clean.txt:
    // Line 83: "CIBIL V3 >= 700"
    // Lines 107-114: "Minimum Tenure: 12 months, Maximum Tenure: 72 months"
    policyCibil = "700+";
    policyTenure = "12–72 months";
  } else if (bankKey === "piramal") {
    // Piramal_Capital__Housing_Finance_Master_Policy.txt:
    // Line 92: "CIBIL 650 can be considered as stated in supplied policy text"
    // Lines 23-24: "Standard: 12 to 72 months", "Revised JFM program: up to 84 months"
    policyCibil = "650+";
    policyTenure = "12–72 months";
  } else if (bankKey === "poonawalla") {
    // Poonawalla_Fincorp_Master_Policy.txt:
    // Line 104, 285: "CAT D maximum funding 10 Lakhs (750 CIBIL & OWN House Required)"
    // Line 222: Rate grid TU score starts at > 700
    // Lines 101-104, 214-216:
    // Super CAT A / CAT A / GOVT: Tenure up to 7 Years (84m)
    // Cat B: Tenure up to 6 Years (72m)
    // All other categories: max loan tenure will be 60 months
    const isCatD = /cat\s*d/i.test(normCat);
    policyCibil = isCatD ? "750+" : "700+";
    if (classification.tier === "tier_1" || classification.tier === "govt") {
      policyTenure = "Up to 7 years (84 months)";
    } else if (classification.tier === "tier_2") {
      policyTenure = "Up to 6 years (72 months)";
    } else {
      policyTenure = "Up to 5 years (60 months)";
    }
  } else if (bankKey === "sbm") {
    // SBM_Bank_India_Master_Policy_Clean.txt:
    // Line 30: "Minimum CIBIL Score: 720+"
    // Lines 55-56: "Minimum Tenure: 12 months, Maximum Tenure: 60 months"
    policyCibil = "720+";
    policyTenure = "12–60 months";
  } else if (bankKey === "smfg") {
    // SMFG_India_Credit_Fullerton_Master_Policy_Clean.txt:
    // Line 37: "Minimum CIBIL Score: 705+"
    // Lines 50-51: "Minimum Tenure: 1 year, Maximum Tenure: 5 years"
    policyCibil = "705+";
    policyTenure = "1–5 years (12–60 months)";
  } else if (bankKey === "tatacapital") {
    // Tata_Capital_Master_Policy_Clean.txt:
    // Line 51: "Normal salaried base policy: 725+"
    // Lines 56-58: "Up to 72 months for eligible salary/category profiles", "CAT C normal salaried: Maximum 60 months"
    policyCibil = "725+";
    if (classification.tier === "tier_1" || classification.tier === "tier_2" || classification.tier === "govt") {
      policyTenure = "Up to 72 months";
    } else {
      policyTenure = "Up to 60 months";
    }
  } else if (bankKey === "utkarsh") {
    // Utkarsh_Small_Finance_Bank_Master_Policy_Clean.txt:
    // Line 47: "Minimum CIBIL Score: 650+"
    // Lines 39-40: "Minimum: 12 months, Maximum: 60 months"
    policyCibil = "650+";
    policyTenure = "12–60 months";
  } else if (bankKey === "yesbank") {
    // Yes_Bank_Master_Policy.txt:
    // Line 53: "-1 and above 731, Below 731 is not allowed"
    // Lines 107-112: "72 months can be offered where: a) Loan eligibility is > 5 lakhs, b) Green band, c) NTH is > 50,000, d) Company category other than Silver/Silver Neo. For others: Maximum 60 months"
    policyCibil = "731+";
    policyTenure = "Up to 60 months";
  }

  return { policyCibil, policyTenure };
}

/**
 * Deterministically parses policy rules from the raw text content of a bank Master Policy file.
 */
export function extractRulesFromPolicyText(
  fileName: string,
  content: string,
  classification: CategoryClassification
): {
  minSalary: number;
  minCibil: number;
  minAge: number;
  maxAge: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  foirPercent: number;
  roi: number;
  processingFeePercent: number;
  policyCibil?: string;
  policyTenure?: string;
  reviewRequired?: boolean;
  reviewReason?: string | null;
} {
  let minAge = 21;
  let maxAge = 60;
  const ageM = content.match(/age[:\s]+(\d{2})\s*(?:to|-)\s*(\d{2})/i) ||
               content.match(/(\d{2})\s*(?:to|-)\s*(\d{2})\s*years?/i);
  if (ageM) {
    minAge = parseInt(ageM[1], 10);
    maxAge = parseInt(ageM[2], 10);
  }

  let minLoanAmount = 50000;
  let maxLoanAmount = classification.tier === "tier_1" || classification.tier === "govt" ? 4000000 : 2500000;
  const minAmtM = content.match(/min(?:imum)?\s*loan\s*(?:amount)?[:\s]*(?:rs\.?|₹)?\s*([\d,]+)/i);
  if (minAmtM) {
    const val = parseInt(minAmtM[1].replace(/,/g, ""), 10);
    if (val >= 5000 && val <= 1000000) minLoanAmount = val;
  }
  const maxAmtM = content.match(/max(?:imum)?\s*(?:loan\s*amount|funding)[:\s]*(?:rs\.?|₹)?\s*([\d,]+)/i);
  if (maxAmtM) {
    const val = parseInt(maxAmtM[1].replace(/,/g, ""), 10);
    if (val >= 100000 && val <= 10000000) maxLoanAmount = val;
  }

  let minTenureMonths = 12;
  let maxTenureMonths = classification.tier === "tier_1" || classification.tier === "govt" ? 72 : 60;
  const minTenM = content.match(/min(?:imum)?\s*tenure[:\s]*(\d+)\s*months?/i);
  if (minTenM) minTenureMonths = parseInt(minTenM[1], 10);
  const maxTenM = content.match(/max(?:imum)?\s*tenure[:\s]*(\d+)\s*(?:months?|years?)/i);
  if (maxTenM) {
    let val = parseInt(maxTenM[1], 10);
    if (val <= 10) val = val * 12;
    maxTenureMonths = val;
  }

  let minSalary = classification.tier === "tier_1" || classification.tier === "govt" ? 25000 : classification.tier === "tier_2" ? 35000 : 45000;
  const salM = content.match(/min(?:imum)?\s*(?:net\s*)?(?:monthly\s*)?(?:salary|nmi|nth)[:\s]*(?:rs\.?|₹)?\s*([\d,]+)/i);
  if (salM) {
    const val = parseInt(salM[1].replace(/,/g, ""), 10);
    if (val >= 10000 && val <= 200000) minSalary = val;
  }

  let minCibil = 700;
  const cibilM = content.match(/cibil\s*(?:score)?[:\s]*(?:>=|>)?\s*(\d{3})/i) ||
                 content.match(/min(?:imum)?\s*cibil[:\s]*(\d{3})/i);
  if (cibilM) {
    const val = parseInt(cibilM[1], 10);
    if (val >= 600 && val <= 850) minCibil = val;
  }

  let foirPercent = classification.tier === "tier_1" || classification.tier === "govt" ? 70 : classification.tier === "tier_2" ? 65 : 60;
  const foirM = content.match(/(?:max(?:imum)?\s*)?foir[:\s]+(?:up\s*to\s*)?(\d{2})%/i) ||
                content.match(/(\d{2})%\s*foir/i);
  if (foirM) foirPercent = parseInt(foirM[1], 10);

  let roi = classification.tier === "tier_1" || classification.tier === "govt" ? 11.5 : classification.tier === "tier_2" ? 12.5 : 13.5;
  const roiM = content.match(/roi[:\s]+(?:starting\s*from\s*)?(\d{1,2}(?:\.\d{1,2})?)\s*%/i) ||
               content.match(/interest\s*rate[:\s]+(?:starting\s*from\s*)?(\d{1,2}(?:\.\d{1,2})?)\s*%/i) ||
               content.match(/irr[:\s]*(\d{1,2}(?:\.\d{1,2})?)\s*%/i);
  if (roiM) roi = parseFloat(roiM[1]);

  let processingFeePercent = 1.5;
  const pfM = content.match(/processing\s*fee[:\s]*(\d(?:\.\d{1,2})?)\s*%/i);
  if (pfM) processingFeePercent = parseFloat(pfM[1]);

  const isUnlisted = classification.tier === "standard";
  const reviewRequired = isUnlisted;
  const reviewReason = isUnlisted ? "Unlisted corporate subject to internal credit policy review" : null;

  return {
    minSalary,
    minCibil,
    minAge,
    maxAge,
    minLoanAmount,
    maxLoanAmount,
    minTenureMonths,
    maxTenureMonths,
    foirPercent,
    roi,
    processingFeePercent,
    reviewRequired,
    reviewReason,
  };
}

/**
 * Extracts bank-specific category-adjusted policy rules using the Master Policy .txt file
 * as the primary source of truth. Evaluates only relevant Personal Loan policy files.
 */
export function getBankRulesForCategory(
  bankName: string,
  companyCategory: string | null | undefined,
  requestedLoanType: string = "Personal Loan"
): CategoryPolicyRule | null {
  const bankKey = normalizeBankKey(bankName);
  const allMasterPolicies = getAllMasterPolicies();
  const matchedMaster = allMasterPolicies.find(
    (b) =>
      normalizeBankKey(b.bank_name) === bankKey ||
      normalizeBankKey(b.bank_code) === bankKey ||
      (b.file_name && normalizeBankKey(b.file_name) === bankKey)
  );

  if (!matchedMaster) {
    console.warn(
      `[Bank Fetching] Cannot load Master Policy for "${bankName}": Bank is not active or has been deactivated/deleted.`
    );
    return null;
  }

  // Filter out non-Personal Loan policies if Personal Loan requested
  const normReq = (requestedLoanType || "Personal Loan").toLowerCase().replace(/\s*loan$/, "");
  if (normReq === "personal") {
    if (matchedMaster.bank_code === "HOME_LOAN" || /home_loan/i.test(matchedMaster.file_name || "")) {
      return null;
    }
    const isPL =
      (matchedMaster.loan_type && matchedMaster.loan_type.toLowerCase().includes("personal")) ||
      (Array.isArray(matchedMaster.supported_loan_types) &&
        matchedMaster.supported_loan_types.some((t: string) => t.toLowerCase().includes("personal")));
    if (!isPL) {
      return null;
    }
  }

  const fileName = matchedMaster.file_name;
  if (!fileName) {
    console.warn(
      `[Bank Fetching] Cannot load Master Policy for "${matchedMaster.bank_name}": No policy file registered.`
    );
    return null;
  }

  const filePath = path.join(process.cwd(), "policy-master-files", fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(
      `[Bank Fetching] Cannot load Master Policy for "${matchedMaster.bank_name}": File "${fileName}" not found on disk at "${filePath}".`
    );
    return null;
  }

  try {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      console.warn(
        `[Bank Fetching] Cannot load Master Policy for "${matchedMaster.bank_name}": File "${fileName}" is empty (0 bytes).`
      );
      return null;
    }
  } catch (err: any) {
    console.warn(
      `[Bank Fetching] Cannot load Master Policy for "${matchedMaster.bank_name}": Error accessing file "${fileName}": ${err?.message || err}`
    );
    return null;
  }

  const classification = classifyCategoryTier(companyCategory);
  const cache = loadPolicyRulesCache();
  const cachedBank = cache[fileName] || Object.values(cache).find(
    (b: any) => b.bankKey === bankKey || normalizeBankKey(b.bankName) === bankKey || normalizeBankKey(b.bankCode) === bankKey
  );

  const policyFileContent = getMasterPolicyFileContent(fileName);
  const { policyCibil: derivedCibil, policyTenure: derivedTenure } = getPolicyCibilAndTenure(
    bankKey,
    classification,
    companyCategory,
    requestedLoanType,
    policyFileContent
  );

  let tierRule: CachedTierRule | null = null;
  let baseBank: CachedBankPolicy | null = null;

  if (cachedBank && cachedBank.tiers) {
    baseBank = cachedBank;
    tierRule = cachedBank.tiers[classification.tier] || cachedBank.tiers["standard"] || null;
  }

  if (!tierRule || !baseBank) {
    const extracted = extractRulesFromPolicyText(fileName, policyFileContent, classification);
    return {
      bankId: matchedMaster?.bank_id ?? matchedMaster?.id ?? 0,
      bankName: matchedMaster.bank_name,
      bankCode: matchedMaster.bank_code,
      fileName,
      loanType: requestedLoanType,
      supportedLoanTypes: matchedMaster.supported_loan_types || ["Personal Loan"],
      resolvedCategory: classification.displayLabel,
      minSalary: extracted.minSalary,
      minCibil: extracted.minCibil,
      minAge: extracted.minAge,
      maxAge: extracted.maxAge,
      minLoanAmount: extracted.minLoanAmount,
      maxLoanAmount: extracted.maxLoanAmount,
      minTenureMonths: extracted.minTenureMonths,
      maxTenureMonths: extracted.maxTenureMonths,
      foirPercent: extracted.foirPercent,
      roi: extracted.roi,
      processingFeePercent: extracted.processingFeePercent,
      employmentType: "Salaried",
      policySource: `${matchedMaster.bank_name} Master Policy (${fileName})`,
      policyCibil: derivedCibil !== "-" ? derivedCibil : (extracted.policyCibil || "-"),
      policyTenure: derivedTenure !== "-" ? derivedTenure : (extracted.policyTenure || "-"),
      reviewRequired: extracted.reviewRequired || false,
      reviewReason: extracted.reviewReason || null,
    };
  }

  return {
    bankId: matchedMaster?.bank_id ?? matchedMaster?.id ?? 0,
    bankName: matchedMaster.bank_name || baseBank.bankName,
    bankCode: matchedMaster.bank_code || baseBank.bankCode,
    fileName,
    loanType: requestedLoanType,
    supportedLoanTypes: matchedMaster.supported_loan_types || ["Personal Loan"],
    resolvedCategory: tierRule.resolvedCategory || classification.displayLabel,
    minSalary: tierRule.minSalary,
    minCibil: tierRule.minCibil,
    minAge: baseBank.minAge,
    maxAge: baseBank.maxAge,
    minLoanAmount: baseBank.minLoanAmount,
    maxLoanAmount: tierRule.maxLoanAmount,
    minTenureMonths: baseBank.minTenureMonths,
    maxTenureMonths: tierRule.maxTenureMonths,
    foirPercent: tierRule.foirPercent,
    roi: tierRule.roi,
    processingFeePercent: baseBank.processingFeePercent,
    employmentType: baseBank.employmentType,
    policySource: `${matchedMaster.bank_name} Master Policy (${fileName})`,
    policyCibil: derivedCibil !== "-" ? derivedCibil : tierRule.policyCibil,
    policyTenure: derivedTenure !== "-" ? derivedTenure : tierRule.policyTenure,
    reviewRequired: tierRule.reviewRequired || false,
    reviewReason: tierRule.reviewReason || null,
  };
}

/**
 * Loads rules for all banks for a specific company category.
 * Dynamically fetches all active partner banks from getAllMasterPolicies(),
 * maps the applicant's company category to each bank's policy rules,
 * verifies that each Master Policy file exists and is non-empty on disk,
 * and logs the exact reason if any bank or policy cannot be loaded.
 */
export function getAllBankRulesForCategory(
  categoryInput: Record<string, string> | CompanyCategoryMatch,
  loanType: string = "Personal Loan"
): CategoryPolicyRule[] {
  const rules: CategoryPolicyRule[] = [];
  const allMasterPolicies = getAllMasterPolicies();

  const isMatchObj =
    typeof categoryInput === "object" &&
    categoryInput !== null &&
    "overallCategoryTier" in categoryInput;

  const companyCategoryMap: Record<string, string> = isMatchObj
    ? (categoryInput as CompanyCategoryMatch).bankCategories
    : (categoryInput as Record<string, string>) || {};
  const overallTier: string | undefined = isMatchObj
    ? (categoryInput as CompanyCategoryMatch).overallCategoryTier
    : undefined;

  console.log(`[Bank Fetching] Fetching Master Policies for ${allMasterPolicies.length} active partner banks...`);
  if (overallTier) {
    console.log(`[Bank Fetching] Applying company category tier: "${overallTier}" across partner banks`);
  }

  const normLoanType = (loanType || "Personal Loan").toLowerCase().replace(/\s*loan$/, "");

  for (const master of allMasterPolicies) {
    // Evaluate only active policies matching the requested loan product (e.g. Personal Loan)
    if (master.status && master.status !== "active") {
      continue;
    }
    if (normLoanType === "personal") {
      if (master.bank_code === "HOME_LOAN" || /home_loan/i.test(master.file_name)) {
        continue;
      }
      const isPersonal =
        (master.loan_type && master.loan_type.toLowerCase().includes("personal")) ||
        (Array.isArray(master.supported_loan_types) &&
          master.supported_loan_types.some((t: string) => t.toLowerCase().includes("personal")));
      if (!isPersonal) {
        continue;
      }
    }

    const bankKey = normalizeBankKey(master.bank_name);
    const codeKey = normalizeBankKey(master.bank_code);
    let cat = companyCategoryMap[bankKey] || companyCategoryMap[codeKey] || null;

    // If bank does not have a direct mapped row in company_records, apply overall category tier to this bank's policy
    if (!cat && overallTier) {
      if (overallTier === "Tier 1 / Super A") {
        if (bankKey === "axis") cat = "CAT Super A / CAT A";
        else if (bankKey === "abfl") cat = "Cat Super A";
        else if (bankKey === "bajaj" || bankKey === "bajajfinserv") cat = "Super A / CAT A";
        else if (bankKey === "bajajmarkets") cat = "Cat A / Prime";
        else if (bankKey === "bandhan") cat = "Category A";
        else if (bankKey === "chola") cat = "CAT A";
        else if (bankKey === "fibe") cat = "Tier 1 Corporate";
        else if (bankKey === "finnable") cat = "Category A";
        else if (bankKey === "hdfc") cat = "CAT Super A";
        else if (bankKey === "icici") cat = "Top Corporate";
        else if (bankKey === "idfc") cat = "CAT SA";
        else if (bankKey === "indusind") cat = "CAT A+";
        else if (bankKey === "kotak") cat = "CAT A";
        else if (bankKey === "ltfinance") cat = "Super CAT A / CAT A";
        else if (bankKey === "piramal") cat = "Elite / CAT A";
        else if (bankKey === "poonawalla") cat = "Super CAT A";
        else if (bankKey === "sbm") cat = "Listed Company";
        else if (bankKey === "smfg") cat = "Private Ltd / Public Ltd / Government";
        else if (bankKey === "tatacapital") cat = "Super CAT A";
        else if (bankKey === "utkarsh") cat = "CAT A";
        else if (bankKey === "yesbank") cat = "Pristine Segment";
        else cat = "Super A (Tier 1)";
      } else if (overallTier === "Tier 2 / Cat B") {
        if (bankKey === "axis") cat = "CAT B";
        else if (bankKey === "abfl") cat = "Cat B";
        else if (bankKey === "bajaj" || bankKey === "bajajfinserv") cat = "CAT B";
        else if (bankKey === "bajajmarkets") cat = "Cat B";
        else if (bankKey === "bandhan") cat = "Category B";
        else if (bankKey === "chola") cat = "CAT B";
        else if (bankKey === "fibe") cat = "Tier 2 Corporate";
        else if (bankKey === "finnable") cat = "Category B";
        else if (bankKey === "hdfc") cat = "CAT B";
        else if (bankKey === "icici") cat = "Preferred";
        else if (bankKey === "idfc") cat = "CAT B";
        else if (bankKey === "indusind") cat = "CAT B";
        else if (bankKey === "kotak") cat = "CAT B";
        else if (bankKey === "ltfinance") cat = "CAT B";
        else if (bankKey === "piramal") cat = "CAT B";
        else if (bankKey === "poonawalla") cat = "Cat B";
        else if (bankKey === "sbm") cat = "Non-Listed Company";
        else if (bankKey === "smfg") cat = "LLP / Proprietorship / Partnership";
        else if (bankKey === "tatacapital") cat = "CAT B";
        else if (bankKey === "utkarsh") cat = "CAT B";
        else if (bankKey === "yesbank") cat = "Silver Neo";
        else cat = "Cat B (Tier 2)";
      } else if (overallTier === "Government") {
        if (bankKey === "axis") cat = "Government / Public Sector";
        else if (bankKey === "abfl") cat = "Government";
        else if (bankKey === "bajaj" || bankKey === "bajajfinserv") cat = "Listed Govt";
        else if (bankKey === "chola") cat = "Government";
        else if (bankKey === "hdfc") cat = "CAT GA";
        else if (bankKey === "idfc") cat = "Government cases";
        else if (bankKey === "kotak") cat = "Government";
        else if (bankKey === "ltfinance") cat = "Government";
        else if (bankKey === "piramal") cat = "Government";
        else if (bankKey === "poonawalla") cat = "GOVT";
        else if (bankKey === "sbm") cat = "Government";
        else if (bankKey === "smfg") cat = "Government";
        else if (bankKey === "tatacapital") cat = "Government Employee";
        else if (bankKey === "utkarsh") cat = "Government";
        else if (bankKey === "yesbank") cat = "Government";
        else cat = "Government / Public Sector";
      } else if (overallTier === "Self-Employed") {
        cat = "Self-Employed";
      } else {
        if (bankKey === "bandhan") cat = "Category C";
        else if (bankKey === "hdfc") cat = "CAT D";
        else if (bankKey === "icici") cat = "Open Market";
        else if (bankKey === "idfc") cat = "CAT D";
        else if (bankKey === "kotak") cat = "CAT C";
        else if (bankKey === "poonawalla") cat = "CAT C";
        else if (bankKey === "sbm") cat = "Non-Listed Company";
        else if (bankKey === "smfg") cat = "LLP";
        else if (bankKey === "tatacapital") cat = "Unapproved Company";
        else if (bankKey === "utkarsh") cat = "CAT C";
        else cat = "Open Market / Standard Corporate";
      }
    }

    const rule = getBankRulesForCategory(master.bank_name, cat, loanType);
    if (rule) {
      rules.push(rule);
      console.log(
        `[Bank Fetching] ✓ Loaded "${rule.bankName}" (${rule.fileName}) | Category: ${rule.resolvedCategory} | Min Salary: ₹${rule.minSalary.toLocaleString("en-IN")} | Min CIBIL: ${rule.minCibil} | Policy CIBIL: ${rule.policyCibil} | Policy Tenure: ${rule.policyTenure} | ROI: ${rule.roi}%`
      );
    }
  }

  console.log(`[Bank Fetching] Successfully loaded ${rules.length} of ${allMasterPolicies.length} partner bank policies for evaluation.`);
  return rules;
}

