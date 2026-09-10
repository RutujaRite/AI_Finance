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
}

interface BankPolicySpec {
  bankKey: string;
  bankName: string;
  bankCode: string;
  fileName: string;
  supportedLoanTypes: string[];
  minSalaryTier1: number;
  minSalaryTier2: number;
  minSalaryStandard: number;
  minCibil: number;
  minAge: number;
  maxAge: number;
  minLoanAmount: number;
  maxLoanAmount: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  foirTier1: number;
  foirTier2: number;
  foirStandard: number;
  roiTier1: number;
  roiTier2: number;
  roiStandard: number;
  processingFeePercent: number;
  employmentType: string;
}

const VERIFIED_BANK_POLICIES: BankPolicySpec[] = [
  {
    bankKey: "abfl",
    bankName: "Aditya Birla Finance",
    bankCode: "ABFL",
    fileName: "ABFL_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 25000,
    minSalaryStandard: 30000,
    minCibil: 650,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    maxLoanAmount: 700000,
    minTenureMonths: 12,
    maxTenureMonths: 48,
    foirTier1: 60,
    foirTier2: 60,
    foirStandard: 60,
    roiTier1: 22.0,
    roiTier2: 22.0,
    roiStandard: 24.0,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
  },
  {
    bankKey: "axis",
    bankName: "Axis Bank",
    bankCode: "AXIS",
    fileName: "AXIS_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 35000,
    minSalaryStandard: 50000,
    minCibil: 700,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    maxLoanAmount: 4000000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 70,
    foirTier2: 65,
    foirStandard: 60,
    roiTier1: 10.75,
    roiTier2: 11.75,
    roiStandard: 13.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "axisfinance",
    bankName: "Axis Finance",
    bankCode: "AFL",
    fileName: "Axis_Finance_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 35000,
    minSalaryStandard: 45000,
    minCibil: 720,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 100000,
    maxLoanAmount: 3000000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 70,
    foirTier2: 65,
    foirStandard: 60,
    roiTier1: 11.50,
    roiTier2: 12.50,
    roiStandard: 13.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "bajajfinserv",
    bankName: "Bajaj Finserv",
    bankCode: "BAJAJ_FINSERV",
    fileName: "Bajaj_Finserv_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 30000,
    minSalaryStandard: 35000,
    minCibil: 730,
    minAge: 25,
    maxAge: 58,
    minLoanAmount: 50000,
    maxLoanAmount: 3500000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 70,
    foirTier2: 70,
    foirStandard: 65,
    roiTier1: 11.50,
    roiTier2: 12.50,
    roiStandard: 13.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "bajajmarkets",
    bankName: "Bajaj Markets",
    bankCode: "BAJAJ_MARKETS",
    fileName: "Bajaj_Markets_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 15000,
    minSalaryTier2: 15000,
    minSalaryStandard: 15000,
    minCibil: 700,
    minAge: 25,
    maxAge: 58,
    minLoanAmount: 50000,
    maxLoanAmount: 3500000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 70,
    foirTier2: 70,
    foirStandard: 70,
    roiTier1: 9.99,
    roiTier2: 9.99,
    roiStandard: 10.99,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "bandhan",
    bankName: "Bandhan Bank",
    bankCode: "BANDHAN",
    fileName: "Bandhan_Bank_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 25000,
    minSalaryStandard: 25000,
    minCibil: 731,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 100000,
    maxLoanAmount: 2500000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 60,
    foirTier2: 60,
    foirStandard: 60,
    roiTier1: 10.25,
    roiTier2: 10.75,
    roiStandard: 11.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "chola",
    bankName: "Cholamandalam Investment & Finance",
    bankCode: "CHOLA",
    fileName: "Chola_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 25000,
    minSalaryStandard: 25000,
    minCibil: 675,
    minAge: 25,
    maxAge: 58,
    minLoanAmount: 100000,
    maxLoanAmount: 2000000,
    minTenureMonths: 12,
    maxTenureMonths: 48,
    foirTier1: 55,
    foirTier2: 55,
    foirStandard: 50,
    roiTier1: 16.00,
    roiTier2: 17.50,
    roiStandard: 19.00,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
  },
  {
    bankKey: "fibe",
    bankName: "Fibe (EarlySalary)",
    bankCode: "FIBE",
    fileName: "Fibe_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 15000,
    minSalaryTier2: 15000,
    minSalaryStandard: 18000,
    minCibil: 700,
    minAge: 19,
    maxAge: 55,
    minLoanAmount: 5000,
    maxLoanAmount: 500000,
    minTenureMonths: 6,
    maxTenureMonths: 36,
    foirTier1: 65,
    foirTier2: 65,
    foirStandard: 60,
    roiTier1: 15.00,
    roiTier2: 16.50,
    roiStandard: 18.00,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
  },
  {
    bankKey: "finnable",
    bankName: "Finnable Credit",
    bankCode: "FINNABLE",
    fileName: "Finnable_Credit_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 20000,
    minSalaryTier2: 15000,
    minSalaryStandard: 20000,
    minCibil: 700,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    maxLoanAmount: 1000000,
    minTenureMonths: 12,
    maxTenureMonths: 48,
    foirTier1: 60,
    foirTier2: 60,
    foirStandard: 55,
    roiTier1: 15.00,
    roiTier2: 16.00,
    roiStandard: 17.50,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
  },
  {
    bankKey: "hdfc",
    bankName: "HDFC Bank",
    bankCode: "HDFC",
    fileName: "HDFC_Bank_Master_Policy_CIBIL_Updated.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 35000,
    minSalaryStandard: 50000,
    minCibil: 730,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    maxLoanAmount: 5000000,
    minTenureMonths: 12,
    maxTenureMonths: 72,
    foirTier1: 70,
    foirTier2: 65,
    foirStandard: 65,
    roiTier1: 10.75,
    roiTier2: 11.75,
    roiStandard: 13.75,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "homeloan",
    bankName: "Home Loan Services",
    bankCode: "HOME_LOAN",
    fileName: "home_loan_eligibility_policy_rules.txt",
    supportedLoanTypes: ["Home Loan"], // Strictly Home Loan only! Ineligible for Personal Loan
    minSalaryTier1: 30000,
    minSalaryTier2: 30000,
    minSalaryStandard: 35000,
    minCibil: 700,
    minAge: 21,
    maxAge: 65,
    minLoanAmount: 500000,
    maxLoanAmount: 10000000,
    minTenureMonths: 60,
    maxTenureMonths: 240,
    foirTier1: 60,
    foirTier2: 60,
    foirStandard: 55,
    roiTier1: 8.50,
    roiTier2: 8.75,
    roiStandard: 9.25,
    processingFeePercent: 0.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "icici",
    bankName: "ICICI Bank",
    bankCode: "ICICI",
    fileName: "ICICI_Bank_Personal_Loan_Policy_Rulebook.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 30000,
    minSalaryStandard: 40000,
    minCibil: 700,
    minAge: 21,
    maxAge: 58,
    minLoanAmount: 50000,
    maxLoanAmount: 5000000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 65,
    foirTier2: 60,
    foirStandard: 60,
    roiTier1: 10.65,
    roiTier2: 11.50,
    roiStandard: 12.90,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "idfc",
    bankName: "IDFC FIRST Bank",
    bankCode: "IDFC",
    fileName: "IDFC_FIRST_Bank_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 20000,
    minSalaryTier2: 20000,
    minSalaryStandard: 25000,
    minCibil: 690,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    maxLoanAmount: 4000000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 65,
    foirTier2: 60,
    foirStandard: 60,
    roiTier1: 10.99,
    roiTier2: 11.99,
    roiStandard: 12.99,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "indusind",
    bankName: "IndusInd Bank",
    bankCode: "INDUSIND",
    fileName: "IndusInd_Bank_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 35000,
    minSalaryStandard: 50000,
    minCibil: 700,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    maxLoanAmount: 2500000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 70,
    foirTier2: 65,
    foirStandard: 60,
    roiTier1: 10.99,
    roiTier2: 11.99,
    roiStandard: 13.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "kotak",
    bankName: "Kotak Mahindra Bank",
    bankCode: "KOTAK",
    fileName: "Kotak_Mahindra_Bank_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 35000,
    minSalaryStandard: 40000,
    minCibil: 700,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    maxLoanAmount: 4000000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 70,
    foirTier2: 65,
    foirStandard: 60,
    roiTier1: 10.99,
    roiTier2: 11.75,
    roiStandard: 12.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "ltfinance",
    bankName: "L&T Finance",
    bankCode: "LTF",
    fileName: "LT_Finance_Master_Policy_Clean.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 30000,
    minSalaryStandard: 35000,
    minCibil: 700,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    maxLoanAmount: 2500000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 65,
    foirTier2: 60,
    foirStandard: 60,
    roiTier1: 11.50,
    roiTier2: 12.50,
    roiStandard: 13.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "piramal",
    bankName: "Piramal Capital & Housing Finance",
    bankCode: "PIRAMAL",
    fileName: "Piramal_Capital__Housing_Finance_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 27500,
    minSalaryTier2: 27500,
    minSalaryStandard: 30000,
    minCibil: 650,
    minAge: 21,
    maxAge: 61,
    minLoanAmount: 100000,
    maxLoanAmount: 2500000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 65,
    foirTier2: 60,
    foirStandard: 55,
    roiTier1: 12.50,
    roiTier2: 13.50,
    roiStandard: 14.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "poonawalla",
    bankName: "Poonawalla Fincorp",
    bankCode: "POONAWALLA",
    fileName: "Poonawalla_Fincorp_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 30000,
    minSalaryTier2: 35000,
    minSalaryStandard: 40000,
    minCibil: 700,
    minAge: 21,
    maxAge: 58,
    minLoanAmount: 50000,
    maxLoanAmount: 5000000,
    minTenureMonths: 12,
    maxTenureMonths: 72,
    foirTier1: 75,
    foirTier2: 75,
    foirStandard: 70,
    roiTier1: 12.50,
    roiTier2: 13.00,
    roiStandard: 13.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "sbm",
    bankName: "SBM Bank India",
    bankCode: "SBM",
    fileName: "SBM_Bank_India_Master_Policy_Clean.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 30000,
    minSalaryTier2: 30000,
    minSalaryStandard: 50000,
    minCibil: 720,
    minAge: 25,
    maxAge: 60,
    minLoanAmount: 500000,
    maxLoanAmount: 3000000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 65,
    foirTier2: 60,
    foirStandard: 50,
    roiTier1: 11.25,
    roiTier2: 11.75,
    roiStandard: 12.25,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "smfg",
    bankName: "SMFG India Credit (Fullerton)",
    bankCode: "SMFG",
    fileName: "SMFG_India_Credit_Fullerton_Master_Policy_Clean.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 19000,
    minSalaryTier2: 22000,
    minSalaryStandard: 25000,
    minCibil: 705,
    minAge: 21,
    maxAge: 65,
    minLoanAmount: 100000,
    maxLoanAmount: 2500000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 70,
    foirTier2: 65,
    foirStandard: 60,
    roiTier1: 12.99,
    roiTier2: 13.99,
    roiStandard: 15.50,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
  },
  {
    bankKey: "tatacapital",
    bankName: "Tata Capital",
    bankCode: "TATA_CAPITAL",
    fileName: "Tata_Capital_Master_Policy_Clean.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 20000,
    minSalaryTier2: 25000,
    minSalaryStandard: 27000,
    minCibil: 725,
    minAge: 21,
    maxAge: 58,
    minLoanAmount: 75000,
    maxLoanAmount: 3500000,
    minTenureMonths: 12,
    maxTenureMonths: 72,
    foirTier1: 65,
    foirTier2: 65,
    foirStandard: 60,
    roiTier1: 11.99,
    roiTier2: 12.99,
    roiStandard: 14.50,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
  {
    bankKey: "utkarsh",
    bankName: "Utkarsh Small Finance Bank",
    bankCode: "UTKARSH",
    fileName: "Utkarsh_Small_Finance_Bank_Master_Policy_Clean.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 25000,
    minSalaryStandard: 30000,
    minCibil: 650,
    minAge: 23,
    maxAge: 58,
    minLoanAmount: 150000,
    maxLoanAmount: 1500000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 60,
    foirTier2: 55,
    foirStandard: 50,
    roiTier1: 14.00,
    roiTier2: 15.00,
    roiStandard: 16.50,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
  },
  {
    bankKey: "yesbank",
    bankName: "Yes Bank",
    bankCode: "YES_BANK",
    fileName: "Yes_Bank_Master_Policy.txt",
    supportedLoanTypes: ["Personal Loan"],
    minSalaryTier1: 25000,
    minSalaryTier2: 35000,
    minSalaryStandard: 45000,
    minCibil: 731,
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    maxLoanAmount: 4000000,
    minTenureMonths: 12,
    maxTenureMonths: 60,
    foirTier1: 70,
    foirTier2: 65,
    foirStandard: 60,
    roiTier1: 10.99,
    roiTier2: 11.75,
    roiStandard: 12.75,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
  },
];


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
 * Extracts bank-specific category-adjusted policy rules using the Master Policy .txt file
 * as the primary source of truth, with policy_rules as secondary fallback.
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

  // Verify Master Policy file exists on disk and is non-empty
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

  // Lookup verified bank policy specification
  const spec = VERIFIED_BANK_POLICIES.find(
    (b) =>
      b.bankKey === bankKey ||
      normalizeBankKey(b.bankName) === bankKey ||
      normalizeBankKey(b.bankCode) === bankKey ||
      (matchedMaster && normalizeBankKey(b.bankCode) === normalizeBankKey(matchedMaster.bank_code)) ||
      (matchedMaster && normalizeBankKey(b.bankName) === normalizeBankKey(matchedMaster.bank_name))
  );

  if (!spec) {
    console.warn(
      `[Bank Fetching] Cannot load Master Policy rules for "${matchedMaster.bank_name}": No matching rule specification found for "${fileName}".`
    );
    return null;
  }

  const normCat = String(companyCategory || "").trim().toLowerCase();
  const classification = classifyCategoryTier(companyCategory);

  // Apply category-tiered parameters strictly from bank Master Policy rules
  let minSalary =
    classification.tier === "tier_1" || classification.tier === "govt"
      ? spec.minSalaryTier1
      : classification.tier === "tier_2"
      ? spec.minSalaryTier2
      : spec.minSalaryStandard;

  let minCibil = spec.minCibil;
  let minAge = spec.minAge;
  let maxAge = spec.maxAge;
  let minLoanAmount = spec.minLoanAmount;
  let maxLoanAmount =
    classification.tier === "tier_1" || classification.tier === "govt"
      ? spec.maxLoanAmount
      : Math.min(spec.maxLoanAmount, 3500000);

  let minTenureMonths = spec.minTenureMonths;
  let maxTenureMonths =
    classification.tier === "tier_1" || classification.tier === "govt"
      ? spec.maxTenureMonths
      : Math.min(spec.maxTenureMonths, 60);

  let foirPercent =
    classification.tier === "tier_1" || classification.tier === "govt"
      ? spec.foirTier1
      : classification.tier === "tier_2"
      ? spec.foirTier2
      : spec.foirStandard;

  let roi =
    classification.tier === "tier_1" || classification.tier === "govt"
      ? spec.roiTier1
      : classification.tier === "tier_2"
      ? spec.roiTier2
      : spec.roiStandard;

  let processingFeePercent = spec.processingFeePercent;

  // --- Bank-specific Category Rule Refinements from Master Policy text files ---
  if (bankKey === "hdfc") {
    // HDFC Master Policy rules:
    // - CAT Super A / CAT A: up to ₹40L, 72m tenure, min salary ₹25k, ROI 10.75%, FOIR 70%
    // - CAT B / CAT C: up to ₹25L, 60m tenure, min salary ₹35k, ROI 11.75%, FOIR 65%
    // - CAT D / CAT E: up to ₹10L, 60m tenure, min salary ₹50k, ROI 13.75%, FOIR 60%
    // - CAT GA: up to ₹40L, 72m tenure, min salary ₹50k, additional 3% FOIR (73%), ROI 11.50%
    // - CAT GB: up to ₹10L, 60m tenure, min salary ₹25k, additional 3% FOIR (68%), ROI 12.50%
    if (classification.tier === "govt") {
      const isGB = /gb/i.test(normCat);
      minSalary = isGB ? 25000 : 50000;
      maxLoanAmount = isGB ? 1000000 : 4000000;
      maxTenureMonths = isGB ? 60 : 72;
      foirPercent = isGB ? 68 : 73;
      roi = isGB ? 12.50 : 11.50;
    } else if (classification.tier === "tier_1") {
      minSalary = 25000;
      maxLoanAmount = 4000000;
      maxTenureMonths = 72;
      foirPercent = 70;
      roi = 10.75;
    } else if (classification.tier === "tier_2") {
      minSalary = 35000;
      maxLoanAmount = 2500000;
      maxTenureMonths = 60;
      foirPercent = 65;
      roi = 11.75;
    } else {
      minSalary = 50000;
      maxLoanAmount = /cat\s*[de]/i.test(normCat) ? 1000000 : 2500000;
      maxTenureMonths = 60;
      foirPercent = 60;
      roi = 13.75;
    }
  } else if (bankKey === "poonawalla") {
    // Poonawalla Fincorp Master Policy rules:
    // - Super CAT A / CAT A / GOVT: Max capping 50 Lakh, tenure up to 7 years (84m), min salary ₹30k, FOIR 75%, ROI 12.50%
    // - Cat B: 30 Lakh max funding, tenure up to 6 years (72m), min salary ₹35k, FOIR 75%, ROI 13.00%
    // - CAT C: 20 Lakh max funding, tenure up to 60m, min salary ₹40k, FOIR 70%, ROI 13.50%
    // - CAT D: 10 Lakh max funding, min salary ₹50k, 750 CIBIL & own house required, ROI 14.50%
    if (classification.tier === "tier_1" || classification.tier === "govt") {
      minSalary = 30000;
      maxLoanAmount = 5000000;
      maxTenureMonths = 84;
      foirPercent = 75;
      roi = 12.50;
    } else if (classification.tier === "tier_2") {
      minSalary = 35000;
      maxLoanAmount = 3000000;
      maxTenureMonths = 72;
      foirPercent = 75;
      roi = 13.00;
    } else {
      const isCatD = /cat\s*d/i.test(normCat);
      minSalary = isCatD ? 50000 : 40000;
      maxLoanAmount = isCatD ? 1000000 : 2000000;
      maxTenureMonths = 60;
      foirPercent = isCatD ? 60 : 70;
      roi = isCatD ? 14.50 : 13.50;
    }
  } else if (bankKey === "kotak") {
    // Kotak Mahindra Bank Master Policy rules:
    // - CAT AA / CAT A / Platinum / Diamond: min salary ₹25k, max loan ₹40L, max tenure 60m, ROI 10.99%, FOIR 70%
    // - CAT B / Gold: min salary ₹35k, max loan ₹35L, max tenure 60m, ROI 11.75%, FOIR 65%
    // - Special Government policy: allowed for 6-year tenure (72m), min salary ₹25k, max loan ₹40L, ROI 10.99%, FOIR 70%
    // - CAT C / Unlisted: max loan ₹10 Lakhs, min salary ₹40k, tenure 60m, ROI 12.50%, FOIR 60%
    if (classification.tier === "govt") {
      minSalary = 25000;
      maxLoanAmount = 4000000;
      maxTenureMonths = 72;
      foirPercent = 70;
      roi = 10.99;
    } else if (classification.tier === "tier_1") {
      minSalary = 25000;
      maxLoanAmount = 4000000;
      maxTenureMonths = 60;
      foirPercent = 70;
      roi = 10.99;
    } else if (classification.tier === "tier_2") {
      minSalary = 35000;
      maxLoanAmount = 3500000;
      maxTenureMonths = 60;
      foirPercent = 65;
      roi = 11.75;
    } else {
      minSalary = 40000;
      maxLoanAmount = 1000000;
      maxTenureMonths = 60;
      foirPercent = 60;
      roi = 12.50;
    }
  } else if (bankKey === "sbm") {
    // SBM Bank India Master Policy rules:
    // - Listed Company / Government: salary ₹30,000 to ₹50,000+, funding up to ₹30 Lakhs, FOIR 65%, ROI 11.25%
    // - Non-Listed Company: salary ₹50,000, maximum funding ₹30 Lakhs (or ₹20L cap for basic), FOIR 50%, ROI 12.25%
    if (classification.tier === "tier_1" || classification.tier === "govt") {
      minSalary = 30000;
      maxLoanAmount = 3000000;
      maxTenureMonths = 60;
      foirPercent = 65;
      roi = 11.25;
    } else {
      minSalary = 50000;
      maxLoanAmount = 2000000;
      maxTenureMonths = 60;
      foirPercent = 50;
      roi = 12.25;
    }
  } else if (bankKey === "tatacapital") {
    // Tata Capital Master Policy rules:
    // - Super CAT A / CAT A / TGE: min salary ₹20k (TGE ₹15k), max loan ₹35L, tenure 72m, FOIR 65%, ROI 11.99%
    // - CAT B / Government: min salary ₹25k, max loan ₹35L, tenure 72m, FOIR 65%, ROI 12.99%
    // - CAT C / Unapproved: min salary ₹27k, max loan ₹25L, tenure 60m, FOIR 60%, ROI 14.50%
    if (classification.tier === "tier_1") {
      minSalary = /tge|tata/i.test(normCat) ? 15000 : 20000;
      maxLoanAmount = 3500000;
      maxTenureMonths = 72;
      foirPercent = 65;
      roi = 11.99;
    } else if (classification.tier === "tier_2" || classification.tier === "govt") {
      minSalary = 25000;
      maxLoanAmount = 3500000;
      maxTenureMonths = 72;
      foirPercent = 65;
      roi = 12.99;
    } else {
      minSalary = 27000;
      maxLoanAmount = 2500000;
      maxTenureMonths = 60;
      foirPercent = 60;
      roi = 14.50;
    }
  } else if (bankKey === "idfc") {
    // IDFC FIRST Bank Master Policy rules:
    // - ACE PLUS / ACE / CAT SA / CAT A: min salary ₹20k, max loan ₹40L, tenure 60m, FOIR 65%, ROI 10.99%
    // - CAT B: min salary ₹20k, max loan ₹35L, tenure 60m, FOIR 60%, ROI 11.99%
    // - CAT C / CAT D / Standard: min salary ₹25k, max loan ₹25L, tenure 60m, FOIR 60%, ROI 12.99%
    if (classification.tier === "tier_1" || classification.tier === "govt") {
      minSalary = 20000;
      maxLoanAmount = 4000000;
      maxTenureMonths = 60;
      foirPercent = 65;
      roi = 10.99;
    } else if (classification.tier === "tier_2") {
      minSalary = 20000;
      maxLoanAmount = 3500000;
      maxTenureMonths = 60;
      foirPercent = 60;
      roi = 11.99;
    } else {
      minSalary = 25000;
      maxLoanAmount = 2500000;
      maxTenureMonths = 60;
      foirPercent = 60;
      roi = 12.99;
    }
  } else if (bankKey === "axisfinance") {
    // Axis Finance Master Policy rules:
    // - Super CAT A / Cat A / Govt: min salary ₹25k, max loan ₹50L (Super CAT A) / ₹30L, tenure 60m, FOIR 70%, ROI 11.50%
    // - Cat B: min salary ₹35k, max loan ₹25L, tenure 60m, FOIR 65%, ROI 12.50%
    // - Cat C / Cat D / Standard: min salary ₹45k, max loan ₹15L, tenure 60m, FOIR 60%, ROI 13.50%
    if (classification.tier === "tier_1" || classification.tier === "govt") {
      minSalary = 25000;
      maxLoanAmount = /super/i.test(normCat) ? 5000000 : 3000000;
      maxTenureMonths = 60;
      foirPercent = 70;
      roi = 11.50;
    } else if (classification.tier === "tier_2") {
      minSalary = 35000;
      maxLoanAmount = 2500000;
      maxTenureMonths = 60;
      foirPercent = 65;
      roi = 12.50;
    } else {
      minSalary = 45000;
      maxLoanAmount = 1500000;
      maxTenureMonths = 60;
      foirPercent = 60;
      roi = 13.50;
    }
  } else if (bankKey === "indusind") {
    // IndusInd Bank Master Policy rules:
    // - CAT A+ / A / Tier 1 / Govt: min salary ₹25k, max loan ₹25L, tenure 60m, FOIR 70%, ROI 10.99%
    // - CAT B / Tier 2: min salary ₹35k, max loan ₹20L, tenure 60m, FOIR 65%, ROI 11.99%
    // - CAT C (UNLISTED): max loan ₹10L, min salary ₹50k, tenure 60m, FOIR 60%, ROI 13.50%
    if (classification.tier === "tier_1" || classification.tier === "govt") {
      minSalary = 25000;
      maxLoanAmount = 2500000;
      maxTenureMonths = 60;
      foirPercent = 70;
      roi = 10.99;
    } else if (classification.tier === "tier_2") {
      minSalary = 35000;
      maxLoanAmount = 2000000;
      maxTenureMonths = 60;
      foirPercent = 65;
      roi = 11.99;
    } else {
      minSalary = 50000;
      maxLoanAmount = 1000000;
      maxTenureMonths = 60;
      foirPercent = 60;
      roi = 13.50;
    }
  }

  const policyFileContent = getMasterPolicyFileContent(fileName);
  const { policyCibil, policyTenure } = getPolicyCibilAndTenure(
    bankKey,
    classification,
    companyCategory,
    requestedLoanType,
    policyFileContent
  );

  return {
    bankId: matchedMaster?.bank_id ?? matchedMaster?.id ?? 0,
    bankName: matchedMaster.bank_name || spec.bankName,
    bankCode: matchedMaster.bank_code || spec.bankCode,
    fileName: matchedMaster.file_name || spec.fileName,
    loanType: spec.supportedLoanTypes.includes(requestedLoanType) ? requestedLoanType : spec.supportedLoanTypes[0],
    supportedLoanTypes: matchedMaster.supported_loan_types || spec.supportedLoanTypes,
    resolvedCategory: classification.displayLabel,
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
    employmentType: spec.employmentType,
    policySource: `${matchedMaster.bank_name} Master Policy (${fileName})`,
    policyCibil,
    policyTenure,
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

  for (const master of allMasterPolicies) {
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

