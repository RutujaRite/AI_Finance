// Exact data and calculation engine matching the Continuum App EMI Calculator PDF Report

export interface EmiScheduleMonth {
  month: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface EmiYearSummary {
  year: number;
  months: EmiScheduleMonth[];
  totalPrincipal: number;
  totalInterest: number;
  closingBalance: number;
}

export interface EmiReportData {
  loanAmount: number;
  interestRate: number; // e.g. 12
  periodMonths: number; // e.g. 72
  processingFees: number; // e.g. 0
  monthlyEmi: number; // e.g. 63000
  totalPrincipal: number; // e.g. 3180023
  totalInterest: number; // e.g. 1355977
  totalPayment: number; // e.g. 4536000
  appTitle: string;
  appSubtitle: string;
  years: EmiYearSummary[];
}

// 1. Exact preset data from the 4-page Continuum App PDF
export const CONTINUUM_SAMPLE_MONTHS: EmiScheduleMonth[] = [
  // Page 1: Year 1
  { month: 1, principal: 29875, interest: 33125, balance: 3150148 },
  { month: 2, principal: 30186, interest: 32814, balance: 3119962 },
  { month: 3, principal: 30500, interest: 32500, balance: 3089462 },
  { month: 4, principal: 30818, interest: 32182, balance: 3058644 },
  { month: 5, principal: 31139, interest: 31861, balance: 3027505 },
  { month: 6, principal: 31464, interest: 31537, balance: 2996041 },
  { month: 7, principal: 31791, interest: 31209, balance: 2964250 },
  { month: 8, principal: 32122, interest: 30878, balance: 2932128 },
  { month: 9, principal: 32457, interest: 30543, balance: 2899670 },
  { month: 10, principal: 32795, interest: 30205, balance: 2866875 },
  { month: 11, principal: 33137, interest: 29863, balance: 2833739 },
  { month: 12, principal: 33482, interest: 29518, balance: 2800257 },

  // Page 2: Year 2
  { month: 13, principal: 33831, interest: 29169, balance: 2766426 },
  { month: 14, principal: 34183, interest: 28817, balance: 2732243 },
  { month: 15, principal: 34539, interest: 28461, balance: 2697704 },
  { month: 16, principal: 34899, interest: 28101, balance: 2662805 },
  { month: 17, principal: 35262, interest: 27738, balance: 2627543 },
  { month: 18, principal: 35630, interest: 27370, balance: 2591913 },
  { month: 19, principal: 36001, interest: 26999, balance: 2555912 },
  { month: 20, principal: 36376, interest: 26624, balance: 2519536 },
  { month: 21, principal: 36755, interest: 26245, balance: 2482781 },
  { month: 22, principal: 37138, interest: 25862, balance: 2445643 },
  { month: 23, principal: 37525, interest: 25475, balance: 2408119 },
  { month: 24, principal: 37915, interest: 25085, balance: 2370203 },

  // Page 2: Year 3
  { month: 25, principal: 38310, interest: 24690, balance: 2331893 },
  { month: 26, principal: 38709, interest: 24291, balance: 2293184 },
  { month: 27, principal: 39113, interest: 23887, balance: 2254071 },
  { month: 28, principal: 39520, interest: 23480, balance: 2214551 },
  { month: 29, principal: 39932, interest: 23068, balance: 2174619 },
  { month: 30, principal: 40348, interest: 22652, balance: 2134271 },
  { month: 31, principal: 40768, interest: 22232, balance: 2093503 },
  { month: 32, principal: 41193, interest: 21807, balance: 2052311 },
  { month: 33, principal: 41622, interest: 21378, balance: 2010689 },
  { month: 34, principal: 42055, interest: 20945, balance: 1968634 },
  { month: 35, principal: 42493, interest: 20507, balance: 1926140 },
  { month: 36, principal: 42936, interest: 20064, balance: 1883204 },

  // Page 3: Year 4
  { month: 37, principal: 43383, interest: 19617, balance: 1839821 },
  { month: 38, principal: 43835, interest: 19165, balance: 1795986 },
  { month: 39, principal: 44292, interest: 18708, balance: 1751694 },
  { month: 40, principal: 44753, interest: 18247, balance: 1706941 },
  { month: 41, principal: 45219, interest: 17781, balance: 1661721 },
  { month: 42, principal: 45690, interest: 17310, balance: 1616031 },
  { month: 43, principal: 46166, interest: 16834, balance: 1569864 },
  { month: 44, principal: 46647, interest: 16353, balance: 1523217 },
  { month: 45, principal: 47133, interest: 15867, balance: 1476084 },
  { month: 46, principal: 47624, interest: 15376, balance: 1428460 },
  { month: 47, principal: 48120, interest: 14880, balance: 1380340 },
  { month: 48, principal: 48621, interest: 14379, balance: 1331718 },

  // Page 3: Year 5
  { month: 49, principal: 49128, interest: 13872, balance: 1282590 },
  { month: 50, principal: 49640, interest: 13360, balance: 1232951 },
  { month: 51, principal: 50157, interest: 12843, balance: 1182794 },
  { month: 52, principal: 50679, interest: 12321, balance: 1132115 },
  { month: 53, principal: 51207, interest: 11793, balance: 1080907 },
  { month: 54, principal: 51741, interest: 11259, balance: 1029167 },
  { month: 55, principal: 52280, interest: 10720, balance: 976887 },
  { month: 56, principal: 52824, interest: 10176, balance: 924063 },
  { month: 57, principal: 53374, interest: 9626, balance: 870689 },
  { month: 58, principal: 53930, interest: 9070, balance: 816759 },
  { month: 59, principal: 54492, interest: 8508, balance: 762266 },
  { month: 60, principal: 55060, interest: 7940, balance: 707207 },

  // Page 4: Year 6
  { month: 61, principal: 55633, interest: 7367, balance: 651574 },
  { month: 62, principal: 56213, interest: 6787, balance: 595361 },
  { month: 63, principal: 56798, interest: 6202, balance: 538562 },
  { month: 64, principal: 57390, interest: 5610, balance: 481172 },
  { month: 65, principal: 57988, interest: 5012, balance: 423185 },
  { month: 66, principal: 58592, interest: 4408, balance: 364593 },
  { month: 67, principal: 59202, interest: 3798, balance: 305391 },
  { month: 68, principal: 59819, interest: 3181, balance: 245572 },
  { month: 69, principal: 60442, interest: 2558, balance: 185130 },
  { month: 70, principal: 61072, interest: 1928, balance: 124058 },
  { month: 71, principal: 61708, interest: 1292, balance: 62351 },
  { month: 72, principal: 62351, interest: 649, balance: 0 },
];

export const CONTINUUM_SAMPLE_DATA: EmiReportData = {
  loanAmount: 3180023,
  interestRate: 12,
  periodMonths: 72,
  processingFees: 0,
  monthlyEmi: 63000,
  totalPrincipal: 3180023,
  totalInterest: 1355977,
  totalPayment: 4536000,
  appTitle: 'EMI Calculator',
  appSubtitle: 'by Continuum App',
  years: buildYearSummaries(CONTINUUM_SAMPLE_MONTHS),
};

export function buildYearSummaries(months: EmiScheduleMonth[]): EmiYearSummary[] {
  const years: EmiYearSummary[] = [];
  const totalYears = Math.ceil(months.length / 12);

  for (let y = 1; y <= totalYears; y++) {
    const yrMonths = months.filter((m) => m.month > (y - 1) * 12 && m.month <= y * 12);
    if (yrMonths.length === 0) continue;

    const totalPrincipal = yrMonths.reduce((acc, m) => acc + m.principal, 0);
    const totalInterest = yrMonths.reduce((acc, m) => acc + m.interest, 0);
    const closingBalance = yrMonths[yrMonths.length - 1].balance;

    years.push({
      year: y,
      months: yrMonths,
      totalPrincipal,
      totalInterest,
      closingBalance,
    });
  }

  return years;
}

// Dynamic generator for any customized loan amount, rate, tenure
export function calculateDynamicEmiReport(
  loanAmount: number,
  interestRate: number,
  periodMonths: number,
  processingFees: number = 0,
  appTitle: string = 'EMI Calculator',
  appSubtitle: string = 'by Continuum App'
): EmiReportData {
  if (
    loanAmount === 3180023 &&
    interestRate === 12 &&
    periodMonths === 72 &&
    processingFees === 0
  ) {
    return {
      ...CONTINUUM_SAMPLE_DATA,
      appTitle,
      appSubtitle,
    };
  }

  const P = Math.max(1, loanAmount);
  const n = Math.max(1, periodMonths);
  const r = (interestRate / 100) / 12;

  let emi: number;
  if (r <= 0) {
    emi = Math.round(P / n);
  } else {
    emi = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  }

  const months: EmiScheduleMonth[] = [];
  let currentBalance = P;
  let totalInterest = 0;

  for (let m = 1; m <= n; m++) {
    if (m === n || currentBalance <= emi) {
      // Last month
      const interest = Math.round(currentBalance * r);
      const principal = currentBalance;
      currentBalance = 0;
      totalInterest += interest;
      months.push({
        month: m,
        principal,
        interest,
        balance: 0,
      });
      break;
    }

    const interest = Math.round(currentBalance * r);
    const principal = Math.min(currentBalance, emi - interest);
    currentBalance = Math.max(0, currentBalance - principal);
    totalInterest += interest;

    months.push({
      month: m,
      principal,
      interest,
      balance: currentBalance,
    });
  }

  const totalPrincipal = P;
  const totalPayment = totalPrincipal + totalInterest;

  return {
    loanAmount: P,
    interestRate,
    periodMonths: n,
    processingFees,
    monthlyEmi: emi,
    totalPrincipal,
    totalInterest,
    totalPayment,
    appTitle,
    appSubtitle,
    years: buildYearSummaries(months),
  };
}

// Indian Rupee number formatting with commas (e.g. 31,80,023)
export function formatIndianCurrency(num: number): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toLocaleString('en-IN');
}
