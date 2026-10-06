import { EligibilityInput, EligibilityResult } from './eligibilityTypes';

/**
 * Calculates loan eligibility based on banking industry standard FOIR & Multiplier models.
 * Internal calculation logic matching reference specification:
 * - FOIR EMI: Salary × FOIR %
 * - Final EMI: FOIR EMI − Current Obligations
 * - FOIR Loan: Present Value amortization formula with ROI %, Tenure (M), Final Eligible EMI
 * - Multiplier Loan: Considered Salary × Multiplier
 * - Obligations: Dynamic sum of EMIs for loans with Balance Transfer = "No"
 * - Balance Transfer POS: Sum of Outstanding for loans marked "Yes"
 * - Self Closure POS: Sum of Outstanding for loans marked "Self Closure"
 * - Considered Salary: Salary − Current Obligations
 */
export function calculateEligibility(input: EligibilityInput): EligibilityResult {
  const salary = Math.max(0, Number(input.salary) || 0);

  // Normalize FOIR (e.g. 60 -> 0.60; 0.60 -> 0.60)
  const rawFoir = Number(input.foirPercent) || 0;
  const foirFactor = rawFoir > 1 ? rawFoir / 100 : rawFoir;

  // Normalize ROI (e.g. 9.99 -> 0.0999; 0.0999 -> 0.0999)
  const rawRoi = Number(input.roiPercent) || 0;
  const annualRoiFactor = rawRoi > 1 ? rawRoi / 100 : rawRoi;

  const tenureMonths = Math.max(0, Math.round(Number(input.tenureMonths) || 0));
  const multiplier = Math.max(0, Number(input.multiplier) || 0);
  const loans = Array.isArray(input.loans) ? input.loans : [];

  // Table Totals & Obligation Breakdown
  let totalSanction = 0;
  let totalOutstanding = 0;
  let totalEmi = 0;
  let tableObligations = 0;
  let balanceTransferPOS = 0;
  let selfClosurePOS = 0;

  for (const loan of loans) {
    const sanction = Math.max(0, Number(loan.sanctionAmount) || 0);
    const outstanding = Math.max(0, Number(loan.outstanding) || 0);
    const emi = Math.max(0, Number(loan.emi) || 0);
    const bt = loan.balanceTransfer;

    totalSanction += sanction;
    totalOutstanding += outstanding;
    totalEmi += emi;

    if (bt === 'No') {
      tableObligations += emi;
    } else if (bt === 'Yes') {
      balanceTransferPOS += outstanding;
    } else if (bt === 'Self Closure') {
      selfClosurePOS += outstanding;
    }
  }

  // Allow manual override if specified, otherwise take dynamically calculated obligations
  const existingObligations = (input.currentObligationsOverride !== undefined && input.currentObligationsOverride !== null)
    ? Math.max(0, Number(input.currentObligationsOverride) || 0)
    : tableObligations;

  // 1. FOIR Allowed EMI: Salary × FOIR % (Obligations not deducted)
  const foirAllowedEmi = Math.round(salary * foirFactor);

  // 2. Final Eligible EMI: Same as FOIR Allowed EMI (without deducting current obligations)
  const finalEligibleEmi = foirAllowedEmi;

  // 3. Considered Salary: Full Salary (without deducting current obligations)
  const consideredSalary = salary;

  // 4. FOIR Loan Eligibility: Present Value (PV) of FOIR Allowed EMI
  let foirEligibility = 0;
  let foirEligibilityExact = 0;

  if (foirAllowedEmi > 0 && tenureMonths > 0) {
    const monthlyRate = annualRoiFactor / 12;
    let pv = 0;

    if (monthlyRate === 0) {
      pv = foirAllowedEmi * tenureMonths;
    } else {
      // Standard Financial Present Value formula: PV = PMT * [ (1 - (1 + r)^(-n)) / r ]
      pv = foirAllowedEmi * ((1 - Math.pow(1 + monthlyRate, -tenureMonths)) / monthlyRate);
    }

    foirEligibility = Math.round(pv);
    const rounded3 = Math.round(pv * 1000) / 1000;
    foirEligibilityExact = Number(rounded3.toFixed(2));
  }

  // 5. Multiplier Loan: Salary × Multiplier (Direct salary multiple, no obligation deduction)
  const multiplierEligibility = salary > 0
    ? Math.round(salary * multiplier)
    : 0;

  return {
    existingObligations,
    foirAllowedEmi,
    consideredSalary,
    finalEligibleEmi,
    foirEligibility,
    foirEligibilityExact,
    multiplierEligibility,
    balanceTransferPOS,
    selfClosurePOS,
    totalSanction,
    totalOutstanding,
    totalEmi,
  };
}

/**
 * Calculates standard monthly EMI given Principal, Annual Interest Rate %, and Tenure (Months).
 * Formula: E = P * r * (1 + r)^n / ((1 + r)^n - 1)
 */
export function calculateQuickEmi(principal: number, annualRatePercent: number, tenureMonths: number): number {
  const p = Math.max(0, Number(principal) || 0);
  const n = Math.max(0, Math.round(Number(tenureMonths) || 0));
  const r = (Math.max(0, Number(annualRatePercent) || 0) / 100) / 12;

  if (p === 0 || n === 0) return 0;
  if (r === 0) return Math.round(p / n);

  const factor = Math.pow(1 + r, n);
  const emi = (p * r * factor) / (factor - 1);
  return isFinite(emi) ? Math.round(emi) : 0;
}

/**
 * Calculates loan amount from EMI using Present Value formula.
 * Formula: P = E * (1 - (1 + r)^(-n)) / r
 */
export function calculateQuickLoanFromEmi(emi: number, annualRatePercent: number, tenureMonths: number): number {
  const e = Math.max(0, Number(emi) || 0);
  const n = Math.max(0, Math.round(Number(tenureMonths) || 0));
  const r = (Math.max(0, Number(annualRatePercent) || 0) / 100) / 12;

  if (e === 0 || n === 0) return 0;
  if (r === 0) return Math.round(e * n);

  const pv = e * ((1 - Math.pow(1 + r, -n)) / r);
  return isFinite(pv) ? Math.round(pv) : 0;
}

/**
 * Formats numbers in Indian Rupee format (e.g. 19,06,589)
 */
export function formatIndianRupees(val: number, includeDecimals = false): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  const num = Number(val);
  if (includeDecimals) {
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '₹' + Math.round(num).toLocaleString('en-IN');
}

/**
 * Converts numbers into Lakhs or Crores shorthand (e.g. ₹19.07 Lakhs)
 */
export function formatLakhsCrores(val: number): string {
  if (!val || val <= 0) return '₹0';
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} Lakhs`;
  }
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}
