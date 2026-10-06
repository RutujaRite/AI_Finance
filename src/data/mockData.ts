import { BankPolicy, BankManager, StatItem } from '../types';

export const STATS_DATA: StatItem[] = [
  {
    id: 'stat-banks',
    number: '20+ Banks',
    label: 'Underwriting Integrations',
    sublabel: 'HDFC, ICICI, SBI, Axis & more',
    icon: 'Building2',
    badge: 'Live API',
    trend: '+3 this month'
  },
  {
    id: 'stat-employers',
    number: '339K+',
    label: 'Employer Category Listings',
    sublabel: 'CAT-A, Super CAT-A, CAT-B, & Govt',
    icon: 'BarChart3',
    badge: 'Updated Today',
    trend: '99.8% accurate'
  },
  {
    id: 'stat-policies',
    number: 'Live Policies',
    label: 'Underwriting Guidelines',
    sublabel: 'CIBIL, FOIR, Age & Salary rules',
    icon: 'FileCheck2',
    badge: 'Verified',
    trend: 'Auto-synced'
  },
  {
    id: 'stat-math',
    number: 'Instant Math',
    label: 'Financial Algorithms',
    sublabel: 'Real-time amortization schedule',
    icon: 'Zap',
    badge: '< 50ms',
    trend: 'Precision grade'
  }
];

export const BANK_POLICIES: BankPolicy[] = [
  {
    id: 'hdfc',
    bankName: 'HDFC Bank',
    code: 'HDFC',
    logoColor: '#004c8f',
    minCibil: 720,
    maxFoir: 65,
    minSalary: 30000,
    roiRange: '8.45% - 9.80%',
    processingFee: '0.50% (Max ₹10,000)',
    employerCategories: ['Super CAT-A', 'CAT-A', 'CAT-B', 'Listed MNC'],
    maxTenureYears: 30,
    specialRules: [
      'Allows step-up EMI for young professionals under 35',
      'No prepayment penalty on floating rate loans',
      'Bonus and rental income considered at 60% realization'
    ]
  },
  {
    id: 'icici',
    bankName: 'ICICI Bank',
    code: 'ICICI',
    logoColor: '#b02a30',
    minCibil: 700,
    maxFoir: 60,
    minSalary: 25000,
    roiRange: '8.60% - 10.15%',
    processingFee: '0.50% - 1.0%',
    employerCategories: ['Elite', 'CAT-A', 'CAT-B', 'Unlisted Corp'],
    maxTenureYears: 30,
    specialRules: [
      'Instant digital sanction letter in 15 minutes with NetBanking',
      'Overdraft loan facility available against property',
      'Co-applicant mandatory if applicant age is > 55 at tenure end'
    ]
  },
  {
    id: 'sbi',
    bankName: 'State Bank of India',
    code: 'SBI',
    logoColor: '#1d71b8',
    minCibil: 680,
    maxFoir: 65,
    minSalary: 25000,
    roiRange: '8.40% - 9.25%',
    processingFee: 'Nil to 0.35% (Special campaign)',
    employerCategories: ['Central Govt', 'State Govt', 'Defence', 'CAT-A', 'CAT-B'],
    maxTenureYears: 30,
    specialRules: [
      'Lowest processing fees and concession for women borrowers (5 bps)',
      'Yuva Home Loan with 20% higher eligibility for applicants up to 45 years',
      'Max age at loan maturity: 70 years'
    ]
  },
  {
    id: 'axis',
    bankName: 'Axis Bank',
    code: 'AXIS',
    logoColor: '#861f41',
    minCibil: 710,
    maxFoir: 60,
    minSalary: 28000,
    roiRange: '8.75% - 10.40%',
    processingFee: '1.0% (Min ₹10,000)',
    employerCategories: ['Tier-1 Tech', 'CAT-A', 'CAT-B', 'Self-Employed Prof'],
    maxTenureYears: 30,
    specialRules: [
      'Shubh Aarambh loan with 12 EMIs waived on regular repayment',
      'Fast-track approval for pre-approved developer projects',
      'FOIR stretchable up to 70% for net salaries above ₹1.5 Lakh/month'
    ]
  },
  {
    id: 'kotak',
    bankName: 'Kotak Mahindra Bank',
    code: 'KOTAK',
    logoColor: '#ed1c24',
    minCibil: 730,
    maxFoir: 65,
    minSalary: 35000,
    roiRange: '8.55% - 9.90%',
    processingFee: '0.50% + GST',
    employerCategories: ['Tier-1 Corporates', 'CAT-A', 'Doctors/CAs'],
    maxTenureYears: 25,
    specialRules: [
      'Preferential pricing for salary accounts maintained with Kotak',
      'Flexi-EMI options with bullet repayment support',
      'Balance transfer top-up up to 100% of original loan amount'
    ]
  }
];

export const BANK_MANAGERS: BankManager[] = [
  {
    id: 'mgr-1',
    name: 'Rajesh Sharma',
    role: 'Chief Credit Officer & Loan Manager',
    bank: 'ICICI Bank',
    city: 'Pune',
    branch: 'Shivajinagar Commercial Branch',
    phone: '+91 98230 44120',
    email: 'rajesh.sharma@icicibank.example.com',
    verified: true,
    avatar: 'RS'
  },
  {
    id: 'mgr-2',
    name: 'Priya Iyer',
    role: 'AVP - Retail Mortgage & Asset Lending',
    bank: 'HDFC Bank',
    city: 'Mumbai',
    branch: 'Bandra-Kurla Complex (BKC)',
    phone: '+91 99301 88204',
    email: 'priya.iyer@hdfcbank.example.com',
    verified: true,
    avatar: 'PI'
  },
  {
    id: 'mgr-3',
    name: 'Vikramaditya Verma',
    role: 'Branch Manager - SME & Retail Credit',
    bank: 'State Bank of India',
    city: 'Delhi NCR',
    branch: 'Connaught Place Central Hub',
    phone: '+91 98110 57321',
    email: 'vikram.verma@sbi.example.com',
    verified: true,
    avatar: 'VV'
  },
  {
    id: 'mgr-4',
    name: 'Ananya Deshmukh',
    role: 'Regional Credit Head - Personal & Home Loans',
    bank: 'Axis Bank',
    city: 'Pune',
    branch: 'Kothrud Regional Office',
    phone: '+91 97654 32918',
    email: 'ananya.deshmukh@axisbank.example.com',
    verified: true,
    avatar: 'AD'
  },
  {
    id: 'mgr-5',
    name: 'Karthik Sundaram',
    role: 'Senior Loan Underwriting Lead',
    bank: 'Kotak Mahindra Bank',
    city: 'Bengaluru',
    branch: 'Indiranagar Prime Branch',
    phone: '+91 98450 19283',
    email: 'karthik.s@kotak.example.com',
    verified: true,
    avatar: 'KS'
  },
  {
    id: 'mgr-6',
    name: 'Neha Kapoor',
    role: 'Retail Lending Specialist',
    bank: 'HDFC Bank',
    city: 'Hyderabad',
    branch: 'Hitec City Corporate Park',
    phone: '+91 98860 77152',
    email: 'neha.kapoor@hdfcbank.example.com',
    verified: true,
    avatar: 'NK'
  }
];

export const INITIAL_AI_CHAT: {
  query: string;
  response: string;
  emiDetails?: {
    monthlyEmi: number;
    principal: number;
    interest: number;
    tenureMonths: number;
  };
}[] = [
  {
    query: 'Calculate EMI for 5L home loan at 9.5%',
    response: 'Here is the instant calculation for a ₹5,00,000 loan at 9.5% per annum for a tenure of 5 years (60 months). Monthly EMI is ₹10,501. Total interest payable over the loan term is ₹1,30,050.',
    emiDetails: {
      monthlyEmi: 10501,
      principal: 500000,
      interest: 130050,
      tenureMonths: 60
    }
  },
  {
    query: 'Loan processing fees & charges',
    response: 'Across our integrated banking network:\n• SBI: 0.35% (Special promotional offers frequently waive fees)\n• HDFC Bank: 0.50% (Max ₹10,000 + GST)\n• ICICI Bank: 0.50% - 1.00% depending on employer tier rating\n• Axis Bank: 1.00% flat (Min ₹10,000)\n\nNote: All processing charges are subject to applicable GST (18%).'
  },
  {
    query: 'Find ICICI manager details in Pune',
    response: 'Found verified contact:\n• Rajesh Sharma - Chief Credit Officer & Loan Manager\n• Branch: ICICI Bank, Shivajinagar Commercial Branch, Pune\n• Direct Phone: +91 98230 44120\n• Official Email: rajesh.sharma@icicibank.example.com\n\nVerified Status: Active & accepting DSA / applicant direct requests.'
  }
];
