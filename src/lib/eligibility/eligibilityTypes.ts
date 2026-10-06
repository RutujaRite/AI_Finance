export type BalanceTransferOption = 'Yes' | 'No' | 'Self Closure';

export interface LoanRow {
  id: string;
  openDate: string;
  type: string;
  bankName: string;
  sanctionAmount: number;
  outstanding: number;
  emi: number;
  balanceTransfer: BalanceTransferOption;
  remark: string;
  additionalInfo: string;
}

export interface EligibilityInput {
  salary: number;
  foirPercent: number; // e.g. 60 or 0.60
  roiPercent: number; // e.g. 9.99 or 0.0999
  tenureMonths: number; // e.g. 60
  multiplier: number; // e.g. 20
  loans: LoanRow[];
  currentObligationsOverride?: number | null;
}

export interface EligibilityResult {
  existingObligations: number;
  foirAllowedEmi: number;
  consideredSalary: number;
  finalEligibleEmi: number;
  foirEligibility: number;
  foirEligibilityExact: number;
  multiplierEligibility: number;
  balanceTransferPOS: number;
  selfClosurePOS: number;
  totalSanction: number;
  totalOutstanding: number;
  totalEmi: number;
}

export interface CustomerInfo {
  name: string;
  mobile: string;
  pan: string;
  email: string;
  company: string;
  remarks: string;
  // Legacy / optional fields for backwards compatibility
  customerName?: string;
  companyName?: string;
  cibilScore?: number | string;
  employmentType?: 'Salaried' | 'Self-Employed';
  currentCity?: string;
  requiredLoanAmount?: number;
}

export interface SavedRecord {
  id: string;
  createdAt: string;
  customerInfo: CustomerInfo;
  salary: number;
  foirPercent: number;
  roiPercent: number;
  tenureMonths: number;
  multiplier: number;
  loans: LoanRow[];
  result: EligibilityResult;
}
