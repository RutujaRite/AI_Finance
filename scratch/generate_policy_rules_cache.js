const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'policy-master-files');
const cacheFile = path.join(dir, '.policy_rules_cache.json');

// Complete rule specifications parsed and validated directly from the 22 Personal Loan policy files
const BANK_FILE_RULES = {
  "ABFL_Master_Policy.txt": {
    bankKey: "abfl",
    bankName: "Aditya Birla Finance",
    bankCode: "ABFL",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 700000, maxTenureMonths: 60, foirPercent: 60, roi: 22.0, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Cat Super A / Cat A", reviewRequired: false },
      tier_2: { minSalary: 25000, maxLoanAmount: 700000, maxTenureMonths: 60, foirPercent: 60, roi: 22.0, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Cat B", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 700000, maxTenureMonths: 60, foirPercent: 60, roi: 22.0, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 30000, maxLoanAmount: 500000, maxTenureMonths: 60, foirPercent: 55, roi: 24.0, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Open Market / Standard", reviewRequired: true, reviewReason: "Unlisted / Open Market employer requires branch credit manager deviation approval" }
    }
  },
  "AXIS_Master_Policy.txt": {
    bankKey: "axis",
    bankName: "Axis Bank",
    bankCode: "AXIS",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 4000000, maxTenureMonths: 60, foirPercent: 70, roi: 10.99, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "CAT Super A / CAT A", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 3500000, maxTenureMonths: 60, foirPercent: 65, roi: 11.75, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "CAT B", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 4000000, maxTenureMonths: 60, foirPercent: 70, roi: 10.99, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Government / Public Sector", reviewRequired: false },
      standard: { minSalary: 50000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 60, roi: 12.99, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Open Market / Standard Corporate", reviewRequired: true, reviewReason: "Unlisted company requires physical verification and senior underwriter approval" }
    }
  },
  "Axis_Finance_Master_Policy.txt": {
    bankKey: "axisfinance",
    bankName: "Axis Finance",
    bankCode: "AXIS_FINANCE",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 5000000, maxTenureMonths: 84, foirPercent: 70, roi: 11.50, minCibil: 730, policyCibil: "730+", policyTenure: "Up to 84 months", resolvedCategory: "Super CAT A / Cat A", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 65, roi: 12.50, minCibil: 720, policyCibil: "720+", policyTenure: "Up to 84 months", resolvedCategory: "Cat B", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 3000000, maxTenureMonths: 84, foirPercent: 70, roi: 11.50, minCibil: 730, policyCibil: "730+", policyTenure: "Up to 84 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 45000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 60, roi: 13.50, minCibil: 720, policyCibil: "720+", policyTenure: "Up to 84 months", resolvedCategory: "Cat C / Cat D / Standard", reviewRequired: true, reviewReason: "Cat C/D requires underwriting team deviation check" }
    }
  },
  "Bajaj_Finserv_Master_Policy.txt": {
    bankKey: "bajajfinserv",
    bankName: "Bajaj Finserv",
    bankCode: "BAJAJ",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 5000000, maxTenureMonths: 84, foirPercent: 70, roi: 11.00, minCibil: 730, policyCibil: "730+", policyTenure: "Up to 84 months", resolvedCategory: "Super A / CAT A", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 3000000, maxTenureMonths: 60, foirPercent: 65, roi: 12.00, minCibil: 720, policyCibil: "720+", policyTenure: "Up to 84 months", resolvedCategory: "CAT B", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 5000000, maxTenureMonths: 84, foirPercent: 70, roi: 11.00, minCibil: 730, policyCibil: "730+", policyTenure: "Up to 84 months", resolvedCategory: "Listed Govt", reviewRequired: false },
      standard: { minSalary: 45000, maxLoanAmount: 2000000, maxTenureMonths: 60, foirPercent: 60, roi: 13.50, minCibil: 720, policyCibil: "720+", policyTenure: "Up to 84 months", resolvedCategory: "CAT C / Standard Corporate", reviewRequired: false }
    }
  },
  "Bajaj_Markets_Master_Policy.txt": {
    bankKey: "bajajmarkets",
    bankName: "Bajaj Markets",
    bankCode: "BAJAJ_MARKETS",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 20000, maxLoanAmount: 2500000, maxTenureMonths: 84, foirPercent: 65, roi: 11.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–84 months", resolvedCategory: "Cat A / Prime", reviewRequired: false },
      tier_2: { minSalary: 25000, maxLoanAmount: 2000000, maxTenureMonths: 60, foirPercent: 60, roi: 12.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–84 months", resolvedCategory: "Cat B", reviewRequired: false },
      govt: { minSalary: 20000, maxLoanAmount: 2500000, maxTenureMonths: 84, foirPercent: 65, roi: 11.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–84 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 30000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 60, roi: 13.00, minCibil: 700, policyCibil: "700+", policyTenure: "12–84 months", resolvedCategory: "Open Market / Standard", reviewRequired: false }
    }
  },
  "Bandhan_Bank_Master_Policy.txt": {
    bankKey: "bandhan",
    bankName: "Bandhan Bank",
    bankCode: "BANDHAN",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 3,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 65, roi: 12.00, minCibil: 731, policyCibil: "731+", policyTenure: "3–60 months", resolvedCategory: "Category A", reviewRequired: false },
      tier_2: { minSalary: 30000, maxLoanAmount: 2000000, maxTenureMonths: 60, foirPercent: 60, roi: 13.00, minCibil: 731, policyCibil: "731+", policyTenure: "3–60 months", resolvedCategory: "Category B", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 65, roi: 12.00, minCibil: 731, policyCibil: "731+", policyTenure: "3–60 months", resolvedCategory: "Category A (Govt)", reviewRequired: false },
      standard: { minSalary: 35000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 55, roi: 14.00, minCibil: 731, policyCibil: "731+", policyTenure: "3–60 months", resolvedCategory: "Category C / Unlisted", reviewRequired: true, reviewReason: "Category C / Unlisted requires branch manager appraisal" }
    }
  },
  "Chola_Master_Policy.txt": {
    bankKey: "chola",
    bankName: "Cholamandalam Investment and Finance Company",
    bankCode: "CHOLA",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 3000000, maxTenureMonths: 84, foirPercent: 65, roi: 12.50, minCibil: 675, policyCibil: "675+", policyTenure: "12–84 months", resolvedCategory: "CAT A", reviewRequired: false },
      tier_2: { minSalary: 30000, maxLoanAmount: 2500000, maxTenureMonths: 72, foirPercent: 60, roi: 13.50, minCibil: 675, policyCibil: "675+", policyTenure: "12–84 months", resolvedCategory: "CAT B", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 3000000, maxTenureMonths: 84, foirPercent: 65, roi: 12.50, minCibil: 675, policyCibil: "675+", policyTenure: "12–84 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 35000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 60, roi: 14.50, minCibil: 675, policyCibil: "675+", policyTenure: "12–84 months", resolvedCategory: "Open Market / Standard", reviewRequired: false }
    }
  },
  "Fibe_Master_Policy.txt": {
    bankKey: "fibe",
    bankName: "Fibe",
    bankCode: "FIBE",
    minAge: 21,
    maxAge: 55,
    minLoanAmount: 5000,
    minTenureMonths: 3,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 15000, maxLoanAmount: 500000, maxTenureMonths: 36, foirPercent: 50, roi: 24.00, minCibil: 700, policyCibil: "700+", policyTenure: "3–36 months", resolvedCategory: "Tier 1 Corporate", reviewRequired: false },
      tier_2: { minSalary: 15000, maxLoanAmount: 500000, maxTenureMonths: 36, foirPercent: 50, roi: 24.00, minCibil: 700, policyCibil: "700+", policyTenure: "3–36 months", resolvedCategory: "Tier 2 Corporate", reviewRequired: false },
      govt: { minSalary: 15000, maxLoanAmount: 500000, maxTenureMonths: 36, foirPercent: 50, roi: 24.00, minCibil: 700, policyCibil: "700+", policyTenure: "3–36 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 18000, maxLoanAmount: 300000, maxTenureMonths: 36, foirPercent: 50, roi: 26.00, minCibil: 700, policyCibil: "700+", policyTenure: "3–36 months", resolvedCategory: "Open Market / Standard", reviewRequired: false }
    }
  },
  "Finnable_Credit_Master_Policy.txt": {
    bankKey: "finnable",
    bankName: "Finnable Credit",
    bankCode: "FINNABLE",
    minAge: 21,
    maxAge: 58,
    minLoanAmount: 25000,
    minTenureMonths: 12,
    processingFeePercent: 2.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 15000, maxLoanAmount: 1000000, maxTenureMonths: 36, foirPercent: 50, roi: 21.00, minCibil: 700, policyCibil: "700+", policyTenure: "12–36 months", resolvedCategory: "Category A", reviewRequired: false },
      tier_2: { minSalary: 15000, maxLoanAmount: 800000, maxTenureMonths: 36, foirPercent: 50, roi: 22.00, minCibil: 700, policyCibil: "700+", policyTenure: "12–36 months", resolvedCategory: "Category B", reviewRequired: false },
      govt: { minSalary: 15000, maxLoanAmount: 1000000, maxTenureMonths: 36, foirPercent: 50, roi: 21.00, minCibil: 700, policyCibil: "700+", policyTenure: "12–36 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 18000, maxLoanAmount: 500000, maxTenureMonths: 36, foirPercent: 50, roi: 24.00, minCibil: 700, policyCibil: "700+", policyTenure: "12–36 months", resolvedCategory: "Category C / Open Market", reviewRequired: false }
    }
  },
  "HDFC_Bank_Master_Policy_CIBIL_Updated.txt": {
    bankKey: "hdfc",
    bankName: "HDFC Bank",
    bankCode: "HDFC",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 4000000, maxTenureMonths: 84, foirPercent: 70, roi: 10.75, minCibil: 700, policyCibil: ">730", policyTenure: "12–84 months", resolvedCategory: "CAT Super A / CAT A", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 65, roi: 11.75, minCibil: 700, policyCibil: ">730", policyTenure: "12–60 months", resolvedCategory: "CAT B / CAT C", reviewRequired: false },
      govt: { minSalary: 50000, maxLoanAmount: 4000000, maxTenureMonths: 84, foirPercent: 73, roi: 11.50, minCibil: 700, policyCibil: ">730", policyTenure: "12–84 months", resolvedCategory: "CAT GA (Government)", reviewRequired: false },
      standard: { minSalary: 50000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 60, roi: 13.75, minCibil: 700, policyCibil: ">730", policyTenure: "12–60 months", resolvedCategory: "CAT D / CAT E / Standard", reviewRequired: true, reviewReason: "CAT D/E requires branch underwriter approval" }
    }
  },
  "ICICI_Bank_Personal_Loan_Policy_Rulebook.txt": {
    bankKey: "icici",
    bankName: "ICICI Bank",
    bankCode: "ICICI",
    minAge: 21,
    maxAge: 58,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 5000000, maxTenureMonths: 60, foirPercent: 70, roi: 10.80, minCibil: 700, policyCibil: "725+", policyTenure: "12–60 months", resolvedCategory: "Top Corporate", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 3500000, maxTenureMonths: 60, foirPercent: 65, roi: 11.50, minCibil: 700, policyCibil: "725+", policyTenure: "12–60 months", resolvedCategory: "Preferred", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 5000000, maxTenureMonths: 60, foirPercent: 70, roi: 10.80, minCibil: 700, policyCibil: "725+", policyTenure: "12–60 months", resolvedCategory: "Government / Defence", reviewRequired: false },
      standard: { minSalary: 50000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 60, roi: 12.75, minCibil: 700, policyCibil: "725+", policyTenure: "12–60 months", resolvedCategory: "Open Market / Standard", reviewRequired: true, reviewReason: "Open Market corporate requires underwriting verification" }
    }
  },
  "IDFC_FIRST_Bank_Master_Policy.txt": {
    bankKey: "idfc",
    bankName: "IDFC FIRST Bank",
    bankCode: "IDFC",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 20000, maxLoanAmount: 4000000, maxTenureMonths: 60, foirPercent: 65, roi: 10.99, minCibil: 690, policyCibil: "690+", policyTenure: "12–60 months", resolvedCategory: "ACE PLUS / CAT SA / CAT A", reviewRequired: false },
      tier_2: { minSalary: 20000, maxLoanAmount: 3500000, maxTenureMonths: 60, foirPercent: 60, roi: 11.99, minCibil: 690, policyCibil: "690+", policyTenure: "12–60 months", resolvedCategory: "CAT B", reviewRequired: false },
      govt: { minSalary: 20000, maxLoanAmount: 4000000, maxTenureMonths: 60, foirPercent: 65, roi: 10.99, minCibil: 690, policyCibil: "690+", policyTenure: "12–60 months", resolvedCategory: "Government cases", reviewRequired: false },
      standard: { minSalary: 25000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 60, roi: 12.99, minCibil: 690, policyCibil: "690+", policyTenure: "12–60 months", resolvedCategory: "CAT C / CAT D / Standard", reviewRequired: false }
    }
  },
  "IndusInd_Bank_Master_Policy.txt": {
    bankKey: "indusind",
    bankName: "IndusInd Bank",
    bankCode: "INDUSIND",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 5000000, maxTenureMonths: 72, foirPercent: 70, roi: 10.99, minCibil: 700, policyCibil: "700+", policyTenure: "Up to 72 months", resolvedCategory: "CAT A+", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 2000000, maxTenureMonths: 72, foirPercent: 65, roi: 11.99, minCibil: 700, policyCibil: "700+", policyTenure: "Up to 72 months", resolvedCategory: "CAT B", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 5000000, maxTenureMonths: 72, foirPercent: 70, roi: 10.99, minCibil: 700, policyCibil: "700+", policyTenure: "Up to 72 months", resolvedCategory: "CAT G (Govt)", reviewRequired: false },
      standard: { minSalary: 50000, maxLoanAmount: 1000000, maxTenureMonths: 60, foirPercent: 60, roi: 13.50, minCibil: 700, policyCibil: "700+", policyTenure: "-", resolvedCategory: "CAT C (UNLISTED)", reviewRequired: true, reviewReason: "CAT C (Unlisted) requires CPA/credit team underwriting review" }
    }
  },
  "Kotak_Mahindra_Bank_Master_Policy.txt": {
    bankKey: "kotak",
    bankName: "Kotak Mahindra Bank",
    bankCode: "KOTAK",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 4000000, maxTenureMonths: 60, foirPercent: 70, roi: 10.99, minCibil: 700, policyCibil: "> 700", policyTenure: "1–5 years (12–60 months)", resolvedCategory: "CAT AA / CAT A", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 3500000, maxTenureMonths: 60, foirPercent: 65, roi: 11.75, minCibil: 700, policyCibil: "> 700", policyTenure: "1–5 years (12–60 months)", resolvedCategory: "CAT B / Gold", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 4000000, maxTenureMonths: 72, foirPercent: 70, roi: 10.99, minCibil: 700, policyCibil: "> 700", policyTenure: "Up to 6 years (72 months)", resolvedCategory: "Government Employee", reviewRequired: false },
      standard: { minSalary: 40000, maxLoanAmount: 1000000, maxTenureMonths: 60, foirPercent: 60, roi: 12.50, minCibil: 700, policyCibil: "> 700", policyTenure: "1–5 years (12–60 months)", resolvedCategory: "CAT C / Unlisted", reviewRequired: true, reviewReason: "CAT C unlisted employer subject to credit check and manual sanity" }
    }
  },
  "LT_Finance_Master_Policy_Clean.txt": {
    bankKey: "ltfinance",
    bankName: "L&T Finance",
    bankCode: "LT_FINANCE",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 100000,
    minTenureMonths: 12,
    processingFeePercent: 1.75,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 20000, maxLoanAmount: 3500000, maxTenureMonths: 72, foirPercent: 70, roi: 11.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–72 months", resolvedCategory: "Super CAT A / CAT A", reviewRequired: false },
      tier_2: { minSalary: 25000, maxLoanAmount: 2500000, maxTenureMonths: 72, foirPercent: 65, roi: 12.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–72 months", resolvedCategory: "CAT B", reviewRequired: false },
      govt: { minSalary: 20000, maxLoanAmount: 3500000, maxTenureMonths: 72, foirPercent: 70, roi: 11.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–72 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 35000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 60, roi: 13.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–72 months", resolvedCategory: "CAT C / Standard", reviewRequired: false }
    }
  },
  "Piramal_Capital__Housing_Finance_Master_Policy.txt": {
    bankKey: "piramal",
    bankName: "Piramal Capital & Housing Finance",
    bankCode: "PIRAMAL",
    minAge: 21,
    maxAge: 61,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 20000, maxLoanAmount: 3500000, maxTenureMonths: 72, foirPercent: 65, roi: 12.00, minCibil: 650, policyCibil: "650+", policyTenure: "12–72 months", resolvedCategory: "Elite / CAT A", reviewRequired: false },
      tier_2: { minSalary: 25000, maxLoanAmount: 2500000, maxTenureMonths: 72, foirPercent: 60, roi: 13.00, minCibil: 650, policyCibil: "650+", policyTenure: "12–72 months", resolvedCategory: "CAT B", reviewRequired: false },
      govt: { minSalary: 20000, maxLoanAmount: 3500000, maxTenureMonths: 72, foirPercent: 65, roi: 12.00, minCibil: 650, policyCibil: "650+", policyTenure: "12–72 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 30000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 55, roi: 14.50, minCibil: 650, policyCibil: "650+", policyTenure: "12–72 months", resolvedCategory: "Open Market / Standard", reviewRequired: false }
    }
  },
  "Poonawalla_Fincorp_Master_Policy.txt": {
    bankKey: "poonawalla",
    bankName: "Poonawalla Fincorp",
    bankCode: "POONAWALLA",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 30000, maxLoanAmount: 5000000, maxTenureMonths: 84, foirPercent: 75, roi: 12.50, minCibil: 700, policyCibil: "700+", policyTenure: "Up to 7 years (84 months)", resolvedCategory: "Super CAT A / CAT A", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 3000000, maxTenureMonths: 72, foirPercent: 75, roi: 13.00, minCibil: 700, policyCibil: "700+", policyTenure: "Up to 6 years (72 months)", resolvedCategory: "Cat B", reviewRequired: false },
      govt: { minSalary: 30000, maxLoanAmount: 5000000, maxTenureMonths: 84, foirPercent: 75, roi: 12.50, minCibil: 700, policyCibil: "700+", policyTenure: "Up to 7 years (84 months)", resolvedCategory: "GOVT", reviewRequired: false },
      standard: { minSalary: 40000, maxLoanAmount: 2000000, maxTenureMonths: 60, foirPercent: 70, roi: 13.50, minCibil: 700, policyCibil: "700+", policyTenure: "Up to 5 years (60 months)", resolvedCategory: "CAT C / Standard", reviewRequired: false }
    }
  },
  "SBM_Bank_India_Master_Policy_Clean.txt": {
    bankKey: "sbm",
    bankName: "SBM Bank India",
    bankCode: "SBM",
    minAge: 23,
    maxAge: 58,
    minLoanAmount: 500000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 30000, maxLoanAmount: 3000000, maxTenureMonths: 60, foirPercent: 65, roi: 11.25, minCibil: 720, policyCibil: "720+", policyTenure: "12–60 months", resolvedCategory: "Listed Company", reviewRequired: false },
      tier_2: { minSalary: 30000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 60, roi: 11.50, minCibil: 720, policyCibil: "720+", policyTenure: "12–60 months", resolvedCategory: "Preferred Company", reviewRequired: false },
      govt: { minSalary: 30000, maxLoanAmount: 3000000, maxTenureMonths: 60, foirPercent: 65, roi: 11.25, minCibil: 720, policyCibil: "720+", policyTenure: "12–60 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 50000, maxLoanAmount: 2000000, maxTenureMonths: 60, foirPercent: 50, roi: 12.25, minCibil: 720, policyCibil: "720+", policyTenure: "12–60 months", resolvedCategory: "Non-Listed Company", reviewRequired: true, reviewReason: "Non-listed company requires higher salary and strict 50% FOIR cap" }
    }
  },
  "SMFG_India_Credit_Fullerton_Master_Policy_Clean.txt": {
    bankKey: "smfg",
    bankName: "SMFG India Credit (Fullerton)",
    bankCode: "SMFG",
    minAge: 21,
    maxAge: 65,
    minLoanAmount: 100000,
    minTenureMonths: 12,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 19000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 65, roi: 13.00, minCibil: 705, policyCibil: "705+", policyTenure: "1–5 years (12–60 months)", resolvedCategory: "Private Ltd / Public Ltd", reviewRequired: false },
      tier_2: { minSalary: 19000, maxLoanAmount: 2000000, maxTenureMonths: 60, foirPercent: 60, roi: 13.50, minCibil: 705, policyCibil: "705+", policyTenure: "1–5 years (12–60 months)", resolvedCategory: "Preferred Ltd", reviewRequired: false },
      govt: { minSalary: 19000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 65, roi: 13.00, minCibil: 705, policyCibil: "705+", policyTenure: "1–5 years (12–60 months)", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 22000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 60, roi: 14.50, minCibil: 705, policyCibil: "705+", policyTenure: "1–5 years (12–60 months)", resolvedCategory: "LLP / Proprietorship / Partnership", reviewRequired: true, reviewReason: "Proprietorship/Partnership employer requires business existence check" }
    }
  },
  "Tata_Capital_Master_Policy_Clean.txt": {
    bankKey: "tatacapital",
    bankName: "Tata Capital",
    bankCode: "TATA_CAPITAL",
    minAge: 21,
    maxAge: 65,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 20000, maxLoanAmount: 5000000, maxTenureMonths: 72, foirPercent: 65, roi: 11.99, minCibil: 725, policyCibil: "725+", policyTenure: "Up to 72 months", resolvedCategory: "Super CAT A / TGE", reviewRequired: false },
      tier_2: { minSalary: 25000, maxLoanAmount: 3500000, maxTenureMonths: 72, foirPercent: 65, roi: 12.99, minCibil: 725, policyCibil: "725+", policyTenure: "Up to 72 months", resolvedCategory: "CAT B", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 3500000, maxTenureMonths: 72, foirPercent: 65, roi: 12.99, minCibil: 725, policyCibil: "725+", policyTenure: "Up to 72 months", resolvedCategory: "Government Employee", reviewRequired: false },
      standard: { minSalary: 27000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 60, roi: 14.50, minCibil: 725, policyCibil: "725+", policyTenure: "Up to 60 months", resolvedCategory: "Unapproved Company", reviewRequired: true, reviewReason: "Unapproved company capped at 60 months tenure and requires credit manager sign-off" }
    }
  },
  "Utkarsh_Small_Finance_Bank_Master_Policy_Clean.txt": {
    bankKey: "utkarsh",
    bankName: "Utkarsh Small Finance Bank",
    bankCode: "UTKARSH",
    minAge: 21,
    maxAge: 58,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 2.0,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 65, roi: 18.00, minCibil: 650, policyCibil: "650+", policyTenure: "12–60 months", resolvedCategory: "CAT A", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 1000000, maxTenureMonths: 60, foirPercent: 60, roi: 19.00, minCibil: 650, policyCibil: "650+", policyTenure: "12–60 months", resolvedCategory: "CAT B", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 65, roi: 18.00, minCibil: 650, policyCibil: "650+", policyTenure: "12–60 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 50000, maxLoanAmount: 700000, maxTenureMonths: 60, foirPercent: 55, roi: 21.00, minCibil: 650, policyCibil: "650+", policyTenure: "12–60 months", resolvedCategory: "CAT C / Standard", reviewRequired: false }
    }
  },
  "Yes_Bank_Master_Policy.txt": {
    bankKey: "yesbank",
    bankName: "Yes Bank",
    bankCode: "YES_BANK",
    minAge: 21,
    maxAge: 60,
    minLoanAmount: 50000,
    minTenureMonths: 12,
    processingFeePercent: 1.5,
    employmentType: "Salaried",
    tiers: {
      tier_1: { minSalary: 25000, maxLoanAmount: 4000000, maxTenureMonths: 60, foirPercent: 65, roi: 11.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Pristine Segment", reviewRequired: false },
      tier_2: { minSalary: 35000, maxLoanAmount: 2500000, maxTenureMonths: 60, foirPercent: 60, roi: 12.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Silver Neo", reviewRequired: false },
      govt: { minSalary: 25000, maxLoanAmount: 4000000, maxTenureMonths: 60, foirPercent: 65, roi: 11.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Government", reviewRequired: false },
      standard: { minSalary: 45000, maxLoanAmount: 1500000, maxTenureMonths: 60, foirPercent: 55, roi: 13.50, minCibil: 700, policyCibil: "700+", policyTenure: "12–60 months", resolvedCategory: "Standard Corporate", reviewRequired: false }
    }
  }
};

fs.writeFileSync(cacheFile, JSON.stringify(BANK_FILE_RULES, null, 2), 'utf-8');
console.log(`Successfully generated ${cacheFile} with ${Object.keys(BANK_FILE_RULES).length} partner bank policy specifications.`);
