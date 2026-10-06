import { EligibilityInput, LoanRow, CustomerInfo } from './eligibilityTypes';

export interface ValidationIssue {
  field: string;
  message: string;
  type: 'error' | 'warning';
}

export const INITIAL_DEMO_BENCHMARKS = {
  salary: 100000,
  foirPercent: 60,
  roiPercent: 9.99,
  tenureMonths: 60,
  multiplier: 20,
};

export const INITIAL_DEMO_CUSTOMER: CustomerInfo = {
  name: 'Rahul Sharma',
  mobile: '9876543210',
  pan: 'ABCDE1234F',
  email: 'rahul.sharma@example.com',
  company: 'Tata Consultancy Services',
  remarks: 'Salaried applicant with excellent credit history and clean track record.',
  customerName: 'Rahul Sharma',
  companyName: 'Tata Consultancy Services',
  cibilScore: 780,
  employmentType: 'Salaried',
  currentCity: 'Mumbai',
  requiredLoanAmount: 2000000,
};

export const INITIAL_DEMO_LOANS: LoanRow[] = [
  {
    id: 'demo_loan_1',
    openDate: '2025-12-17',
    type: 'Personal Loan',
    bankName: '',
    sanctionAmount: 512933,
    outstanding: 85000,
    emi: 4000,
    balanceTransfer: 'Yes',
    remark: '',
    additionalInfo: '',
  },
  {
    id: 'demo_loan_2',
    openDate: '2025-05-14',
    type: 'Home Loan',
    bankName: '',
    sanctionAmount: 500000,
    outstanding: 1950000,
    emi: 19500,
    balanceTransfer: 'No',
    remark: '',
    additionalInfo: '',
  },
  {
    id: 'demo_loan_3',
    openDate: '2025-05-14',
    type: 'Personal Loan',
    bankName: '',
    sanctionAmount: 500000,
    outstanding: 320000,
    emi: 7800,
    balanceTransfer: 'Self Closure',
    remark: 'JOint',
    additionalInfo: '',
  },
  {
    id: 'demo_loan_4',
    openDate: '2025-05-14',
    type: 'Consumer Loan',
    bankName: '',
    sanctionAmount: 0,
    outstanding: 0,
    emi: 0,
    balanceTransfer: 'Self Closure',
    remark: 'JOint',
    additionalInfo: '',
  },
  {
    id: 'demo_loan_5',
    openDate: '2020-08-26',
    type: 'Home Loan',
    bankName: '',
    sanctionAmount: 0,
    outstanding: 0,
    emi: 0,
    balanceTransfer: 'No',
    remark: 'JOint',
    additionalInfo: '',
  },
];

export function validateEligibilityInput(input: EligibilityInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!input.salary || input.salary <= 0) {
    issues.push({
      field: 'salary',
      message: 'Monthly net salary is required and must be greater than zero.',
      type: 'error',
    });
  } else if (input.salary < 10000) {
    issues.push({
      field: 'salary',
      message: 'Most banks require a minimum monthly take-home of ₹15,000 to ₹25,000.',
      type: 'warning',
    });
  }

  const foir = Number(input.foirPercent) > 1 ? Number(input.foirPercent) : Number(input.foirPercent) * 100;
  if (foir <= 0 || foir > 100) {
    issues.push({
      field: 'foirPercent',
      message: 'FOIR should typically be between 30% and 80%.',
      type: 'warning',
    });
  }

  const roi = Number(input.roiPercent) > 1 ? Number(input.roiPercent) : Number(input.roiPercent) * 100;
  if (roi <= 0 || roi > 40) {
    issues.push({
      field: 'roiPercent',
      message: 'Annual interest rate is typically between 8% and 24%.',
      type: 'warning',
    });
  }

  if (!input.tenureMonths || input.tenureMonths < 6) {
    issues.push({
      field: 'tenureMonths',
      message: 'Tenure must be at least 6 months.',
      type: 'error',
    });
  }

  if (input.multiplier <= 0) {
    issues.push({
      field: 'multiplier',
      message: 'Salary multiplier must be greater than 0 (typically 12x to 30x).',
      type: 'error',
    });
  }

  return issues;
}

export function createDefaultLoanRow(): LoanRow {
  return {
    id: `loan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    openDate: new Date().toISOString().split('T')[0],
    type: 'Personal Loan',
    bankName: '',
    sanctionAmount: 0,
    outstanding: 0,
    emi: 0,
    balanceTransfer: 'No',
    remark: '',
    additionalInfo: '',
  };
}
