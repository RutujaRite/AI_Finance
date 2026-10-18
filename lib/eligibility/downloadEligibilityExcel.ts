import * as XLSX from 'xlsx';
import { CustomerInfo, EligibilityResult, LoanRow } from './eligibilityTypes';
import { formatIndianRupees } from './calculateEligibility';

export interface EligibilityExcelExportData {
  customerInfo: CustomerInfo;
  salary: number;
  foirPercent: number;
  roiPercent: number;
  tenureMonths: number;
  multiplier: number;
  loans: LoanRow[];
  result: EligibilityResult;
  monthlyEmi?: number;
  totalInterest?: number;
  totalProcessingFees?: number;
  totalPayment?: number;
}

/**
 * Generates and downloads a comprehensive Excel (.xlsx) report containing:
 * 1. Applicant & Underwriting Benchmark details (Net Monthly Salary, Considered FOIR %, ROI %, Tenure, Multiplier)
 * 2. Underwriting Limits (FOIR Based Limit & Multiplier Based Limit)
 * 3. Pre-calculated Key Financials (Monthly EMI, Tenure, Total Interest, Processing Fees 1% + 18% GST, Total Payment)
 * 4. Live Existing Loan Portfolio Details (Sanctions, Outstanding POS, EMIs, Balance Transfer Status, Remarks)
 * 5. Full 60-Month Repayment & Amortization Schedule
 */
export function downloadEligibilityExcel(data: EligibilityExcelExportData) {
  const {
    customerInfo,
    salary,
    foirPercent,
    roiPercent,
    tenureMonths,
    multiplier,
    loans,
    result,
  } = data;

  // 1. Calculate Financials if not provided
  const principal = Math.max(0, result.foirEligibility);
  const tenure = Math.max(1, Math.round(Number(tenureMonths) || 60));
  const annualRoi = Number(roiPercent) || 9.99;
  const monthlyRate = (annualRoi / 100) / 12;

  let calculatedEmi = data.monthlyEmi;
  if (calculatedEmi === undefined || calculatedEmi <= 0) {
    if (principal > 0 && tenure > 0) {
      if (monthlyRate === 0) {
        calculatedEmi = Math.round(principal / tenure);
      } else {
        const factor = Math.pow(1 + monthlyRate, tenure);
        const emi = (principal * monthlyRate * factor) / (factor - 1);
        calculatedEmi = isFinite(emi) ? Math.round(emi) : 0;
      }
    } else {
      calculatedEmi = 0;
    }
  }

  const processingFeeBase = Math.round(principal * 0.01);
  const processingFeeGst = Math.round(processingFeeBase * 0.18);
  const calculatedProcessingFees = data.totalProcessingFees ?? (processingFeeBase + processingFeeGst);

  // Generate month-by-month schedule
  let currentBalance = principal;
  let accumulatedInterest = 0;
  const scheduleRows: any[][] = [];

  for (let m = 1; m <= tenure; m++) {
    const year = Math.ceil(m / 12);
    const opening = currentBalance;
    let interestForMonth = Math.round(opening * monthlyRate);
    let principalForMonth = calculatedEmi - interestForMonth;

    if (m === tenure || principalForMonth >= opening) {
      principalForMonth = opening;
      interestForMonth = Math.max(0, Math.round(opening * monthlyRate));
      currentBalance = 0;
    } else {
      currentBalance = Math.max(0, opening - principalForMonth);
    }

    accumulatedInterest += interestForMonth;

    scheduleRows.push([
      m,
      `Year ${year}`,
      opening,
      calculatedEmi,
      principalForMonth,
      interestForMonth,
      currentBalance,
    ]);
  }

  const calculatedTotalInterest = data.totalInterest ?? accumulatedInterest;
  const calculatedTotalPayment = data.totalPayment ?? (principal + calculatedTotalInterest + calculatedProcessingFees);

  // Portfolio Totals
  const totalSanction = loans.reduce((acc, r) => acc + (Number(r.sanctionAmount) || 0), 0);
  const totalOutstanding = loans.reduce((acc, r) => acc + (Number(r.outstanding) || 0), 0);
  const totalLoanEmi = loans.reduce((acc, r) => acc + (Number(r.emi) || 0), 0);
  const ongoingObligations = loans
    .filter((r) => r.balanceTransfer === 'No')
    .reduce((acc, r) => acc + (Number(r.emi) || 0), 0);
  const btTakeoverPos = loans
    .filter((r) => r.balanceTransfer === 'Yes')
    .reduce((acc, r) => acc + (Number(r.outstanding) || 0), 0);
  const selfClosurePos = loans
    .filter((r) => r.balanceTransfer === 'Self Closure')
    .reduce((acc, r) => acc + (Number(r.outstanding) || 0), 0);

  // --------------------------------------------------------------------------
  // SHEET 1: ELIGIBILITY & UNDERWRITING ASSESSMENT
  // --------------------------------------------------------------------------
  const sheet1Data: any[][] = [
    ['CREDITWISE FINANCIAL INTELLIGENCE - LOAN ELIGIBILITY ASSESSMENT REPORT'],
    ['Generated On', new Date().toLocaleString('en-IN'), 'Platform', 'CreditWise AI Multi-Bank Underwriting Engine'],
    [],
    ['1. APPLICANT INFORMATION'],
    ['Applicant Name', customerInfo.name || customerInfo.customerName || 'Not Specified', 'Mobile Number', customerInfo.mobile || 'Not Specified'],
    ['Employer / Company Name', customerInfo.company || customerInfo.companyName || 'Not Specified', 'Email Address', customerInfo.email || 'Not Specified'],
    ['Work Location / City', customerInfo.currentCity || 'Not Specified', 'Assessment ID', `CW-${Date.now().toString().slice(-6)}`],
    [],
    ['2. UNDERWRITING BENCHMARK PARAMETERS'],
    ['Net Monthly Salary (₹)', salary, 'Considered Salary (Post-Obligations)', result.consideredSalary],
    ['Considered FOIR % (Debt Limit Cap)', `${foirPercent}%`, 'Max Permissible Total EMI', result.foirAllowedEmi],
    ['ROI % (Annual Interest Rate)', `${annualRoi}% p.a.`, 'Monthly Interest Rate', `${((annualRoi / 12)).toFixed(4)}%`],
    ['Tenure (Months)', `${tenure} Months (${(tenure / 12).toFixed(1)} Years)`, 'Salary Multiplier Factor', `${multiplier}x`],
    [],
    ['3. BORROWING CAPACITY & ELIGIBILITY LIMITS'],
    ['Metric Description', 'Amount (₹)', 'Formula & Calculation Basis'],
    ['Net Monthly In-Hand Salary', salary, 'Customer declared take-home salary'],
    ['FOIR Allowed Total EMI (Cap)', result.foirAllowedEmi, `Salary × FOIR % (${salary} × ${foirPercent}%)`],
    ['Deducted Ongoing Obligations (BT = No)', result.existingObligations, 'Sum of EMIs where Balance Transfer = No'],
    ['Available Net Eligible Monthly EMI', result.finalEligibleEmi, 'FOIR Allowed EMI − Current Ongoing Obligations'],
    ['FOIR Based Loan Eligibility Limit', result.foirEligibility, `PV of ₹${result.finalEligibleEmi} EMI @ ${annualRoi}% for ${tenure}M`],
    ['Multiplier Based Loan Eligibility Limit', result.multiplierEligibility, `Considered Salary × Multiplier (${result.consideredSalary} × ${multiplier}x)`],
    ['Final Recommended Borrowing Capacity', result.foirEligibility, 'Primary institutional underwriting cap based on debt service'],
    [],
    ['4. PRE-CALCULATED REPAYMENT & COST FINANCIALS'],
    ['Financial Metric', 'Value', 'Calculation Details'],
    ['Monthly EMI', `₹${formatIndianRupees(calculatedEmi)}/mo`, `${tenure} Equated Monthly Installments`],
    ['Tenure', `${tenure} Months`, `${(tenure / 12).toFixed(1)} Calendar Years`],
    ['Total Interest Payable', `₹${formatIndianRupees(calculatedTotalInterest)}`, `@ ${annualRoi}% per annum fixed reducing rate`],
    ['Processing Fees', `₹${formatIndianRupees(calculatedProcessingFees)}`, '1.0% of Loan Amount + 18% GST'],
    ['Total Payment (Principal + Interest + Fees)', `₹${formatIndianRupees(calculatedTotalPayment)}`, 'Principal + Total Interest + Gross Processing Fees'],
    [],
    ['5. LIVE EXISTING LOAN PORTFOLIO DETAILS (ADD / EDIT / DELETE ROWS)'],
    [
      '#',
      'Open Date',
      'Loan Type',
      'Bank / Lender Name',
      'Sanction Amt (₹)',
      'Outstanding POS (₹)',
      'EMI (₹)',
      'Balance Transfer (BT)',
      'Remarks',
      'Additional Info'
    ]
  ];

  if (loans.length === 0) {
    sheet1Data.push(['No existing credit lines recorded (Debt-free applicant profile)']);
  } else {
    loans.forEach((loan, idx) => {
      sheet1Data.push([
        idx + 1,
        loan.openDate || 'N/A',
        loan.type || 'Personal Loan',
        loan.bankName || 'Other Bank / NBFC',
        Number(loan.sanctionAmount) || 0,
        Number(loan.outstanding) || 0,
        Number(loan.emi) || 0,
        loan.balanceTransfer === 'Yes'
          ? 'Yes (BT Takeover - EMI freed)'
          : loan.balanceTransfer === 'Self Closure'
          ? 'Self Closure (EMI freed)'
          : 'No (Ongoing Obligation - Deducted)',
        loan.remark || '',
        loan.additionalInfo || ''
      ]);
    });

    // Portfolio Totals Row
    sheet1Data.push([
      'TOTAL',
      '',
      `${loans.length} Loans Total`,
      '',
      totalSanction,
      totalOutstanding,
      totalLoanEmi,
      '',
      '',
      ''
    ]);

    // Obligation Breakdown Row
    sheet1Data.push([
      'PORTFOLIO BREAKDOWN',
      '',
      `Ongoing Deducted EMIs: ₹${ongoingObligations}`,
      `BT Takeover POS: ₹${btTakeoverPos}`,
      `Self Closure POS: ₹${selfClosurePos}`,
      '',
      '',
      '',
      '',
      ''
    ]);
  }

  // --------------------------------------------------------------------------
  // SHEET 2: REPAYMENT SCHEDULE & AMORTIZATION
  // --------------------------------------------------------------------------
  const sheet2Data: any[][] = [
    ['CREDITWISE FINANCIAL INTELLIGENCE - AMORTIZATION ENGINE & REPAYMENT SCHEDULE'],
    [
      `Loan Amount: ₹${formatIndianRupees(principal)}`,
      `Tenure: ${tenure} Months`,
      `Interest Rate: ${annualRoi}% p.a.`,
      `Monthly EMI: ₹${formatIndianRupees(calculatedEmi)}`,
      `Total Payment: ₹${formatIndianRupees(calculatedTotalPayment)}`
    ],
    [],
    [
      'Month #',
      'Period',
      'Opening Balance (₹)',
      'Monthly EMI (₹)',
      'Principal Paid (₹)',
      'Interest Paid (₹)',
      'Remaining Balance (₹)'
    ],
    ...scheduleRows,
    [
      'TOTAL',
      `${tenure} Months`,
      '',
      calculatedEmi * tenure,
      principal,
      calculatedTotalInterest,
      0
    ]
  ];

  // Create Workbook
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = [
    { wch: 8 },   // #
    { wch: 16 },  // Open Date
    { wch: 22 },  // Loan Type
    { wch: 26 },  // Bank Name
    { wch: 18 },  // Sanction Amt
    { wch: 20 },  // Outstanding POS
    { wch: 16 },  // EMI
    { wch: 34 },  // Balance Transfer
    { wch: 24 },  // Remarks
    { wch: 24 }   // Additional Info
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Eligibility Assessment');

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = [
    { wch: 10 },  // Month #
    { wch: 14 },  // Period
    { wch: 22 },  // Opening Balance
    { wch: 18 },  // Monthly EMI
    { wch: 20 },  // Principal Paid
    { wch: 18 },  // Interest Paid
    { wch: 24 }   // Remaining Balance
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Amortization Schedule');

  // Generate Filename & Trigger Client-Side Download
  const safeName = (customerInfo.name || 'Applicant').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().split('T')[0];
  const filename = `CreditWise_Loan_Eligibility_${safeName}_${dateStamp}.xlsx`;

  try {
    XLSX.writeFile(wb, filename);
  } catch (err) {
    // Robust fallback for mobile browsers
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
  }
}
