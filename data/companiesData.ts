export interface CompanyListing {
  id: string;
  name: string;
  industry: string;
  category: 'Super CAT-A' | 'CAT-A' | 'CAT-B' | 'Govt / PSU';
  badgeColor: string;
  bankTiers: {
    hdfc: string;
    icici: string;
    sbi: string;
    axis: string;
    kotak: string;
  };
  maxMultiplier: string;
  roiDiscount: string;
  maxFoir: string;
  processingFee: string;
  fastTrack: boolean;
}

export const COMPANIES_DATA: CompanyListing[] = [
  {
    id: 'google',
    name: 'Google (Alphabet)',
    industry: 'Technology & Cloud',
    category: 'Super CAT-A',
    badgeColor: '#10b981',
    bankTiers: {
      hdfc: 'Super CAT-A',
      icici: 'Elite Platinum',
      sbi: 'Tier-1 Listed MNC',
      axis: 'Super CAT-A',
      kotak: 'Tier-1 Tech'
    },
    maxMultiplier: '30x Monthly Net',
    roiDiscount: '0.35% Discount (8.25% p.a.)',
    maxFoir: 'Up to 70% FOIR',
    processingFee: '100% Fee Waiver',
    fastTrack: true
  },
  {
    id: 'tcs',
    name: 'Tata Consultancy Services (TCS)',
    industry: 'IT & Software Services',
    category: 'Super CAT-A',
    badgeColor: '#10b981',
    bankTiers: {
      hdfc: 'Super CAT-A',
      icici: 'Elite Platinum',
      sbi: 'Tier-1 Listed',
      axis: 'Super CAT-A',
      kotak: 'Tier-1 Corp'
    },
    maxMultiplier: '28x Monthly Net',
    roiDiscount: '0.30% Discount (8.30% p.a.)',
    maxFoir: 'Up to 68% FOIR',
    processingFee: 'Flat ₹5,000 (50% Off)',
    fastTrack: true
  },
  {
    id: 'microsoft',
    name: 'Microsoft Corporation',
    industry: 'Technology & Enterprise',
    category: 'Super CAT-A',
    badgeColor: '#10b981',
    bankTiers: {
      hdfc: 'Super CAT-A',
      icici: 'Elite Platinum',
      sbi: 'Tier-1 Listed MNC',
      axis: 'Super CAT-A',
      kotak: 'Tier-1 Tech'
    },
    maxMultiplier: '30x Monthly Net',
    roiDiscount: '0.35% Discount (8.25% p.a.)',
    maxFoir: 'Up to 70% FOIR',
    processingFee: '100% Fee Waiver',
    fastTrack: true
  },
  {
    id: 'infosys',
    name: 'Infosys Limited',
    industry: 'IT & Consulting',
    category: 'Super CAT-A',
    badgeColor: '#10b981',
    bankTiers: {
      hdfc: 'Super CAT-A',
      icici: 'Elite',
      sbi: 'Tier-1 Listed',
      axis: 'Super CAT-A',
      kotak: 'Tier-1 Corp'
    },
    maxMultiplier: '28x Monthly Net',
    roiDiscount: '0.25% Discount (8.35% p.a.)',
    maxFoir: 'Up to 65% FOIR',
    processingFee: 'Flat ₹5,000',
    fastTrack: true
  },
  {
    id: 'amazon',
    name: 'Amazon Development Centre',
    industry: 'E-commerce & Cloud Tech',
    category: 'Super CAT-A',
    badgeColor: '#10b981',
    bankTiers: {
      hdfc: 'Super CAT-A',
      icici: 'Elite Platinum',
      sbi: 'Tier-1 Listed MNC',
      axis: 'Super CAT-A',
      kotak: 'Tier-1 Tech'
    },
    maxMultiplier: '28x Monthly Net',
    roiDiscount: '0.30% Discount (8.30% p.a.)',
    maxFoir: 'Up to 68% FOIR',
    processingFee: '100% Fee Waiver',
    fastTrack: true
  },
  {
    id: 'reliance',
    name: 'Reliance Industries Limited',
    industry: 'Energy, Retail & Telecom',
    category: 'Super CAT-A',
    badgeColor: '#10b981',
    bankTiers: {
      hdfc: 'Super CAT-A',
      icici: 'Elite',
      sbi: 'Tier-1 Bluechip',
      axis: 'Super CAT-A',
      kotak: 'Tier-1 Conglomerate'
    },
    maxMultiplier: '28x Monthly Net',
    roiDiscount: '0.30% Discount (8.30% p.a.)',
    maxFoir: 'Up to 68% FOIR',
    processingFee: '50% Concession',
    fastTrack: true
  },
  {
    id: 'accenture',
    name: 'Accenture Solutions',
    industry: 'Management & IT Consulting',
    category: 'Super CAT-A',
    badgeColor: '#10b981',
    bankTiers: {
      hdfc: 'Super CAT-A',
      icici: 'Elite Platinum',
      sbi: 'Tier-1 Listed MNC',
      axis: 'Super CAT-A',
      kotak: 'Tier-1 Corp'
    },
    maxMultiplier: '28x Monthly Net',
    roiDiscount: '0.25% Discount (8.35% p.a.)',
    maxFoir: 'Up to 65% FOIR',
    processingFee: '50% Concession',
    fastTrack: true
  },
  {
    id: 'wipro',
    name: 'Wipro Technologies',
    industry: 'IT & Digital Engineering',
    category: 'CAT-A',
    badgeColor: '#3b82f6',
    bankTiers: {
      hdfc: 'CAT-A',
      icici: 'CAT-A',
      sbi: 'Tier-1 Listed',
      axis: 'CAT-A',
      kotak: 'CAT-A Corp'
    },
    maxMultiplier: '25x Monthly Net',
    roiDiscount: '0.20% Discount (8.40% p.a.)',
    maxFoir: 'Up to 65% FOIR',
    processingFee: '0.35% Concession',
    fastTrack: false
  },
  {
    id: 'deloitte',
    name: 'Deloitte Shared Services',
    industry: 'Audit & Financial Advisory',
    category: 'CAT-A',
    badgeColor: '#3b82f6',
    bankTiers: {
      hdfc: 'CAT-A',
      icici: 'Elite',
      sbi: 'Tier-1 MNC',
      axis: 'CAT-A',
      kotak: 'Tier-1 Advisory'
    },
    maxMultiplier: '26x Monthly Net',
    roiDiscount: '0.25% Discount (8.35% p.a.)',
    maxFoir: 'Up to 65% FOIR',
    processingFee: '50% Concession',
    fastTrack: true
  },
  {
    id: 'sbi-corp',
    name: 'Central Govt / Public Sector (PSU)',
    industry: 'Government & Defence',
    category: 'Govt / PSU',
    badgeColor: '#8b5cf6',
    bankTiers: {
      hdfc: 'Govt Category-1',
      icici: 'Govt & Defence',
      sbi: 'Permanent Govt Super',
      axis: 'Govt Elite',
      kotak: 'Govt Navratna'
    },
    maxMultiplier: '32x Monthly Net',
    roiDiscount: '0.40% Discount (8.20% p.a.)',
    maxFoir: 'Up to 72% FOIR (Pension-backed)',
    processingFee: 'Zero / Nil Processing',
    fastTrack: true
  },
  {
    id: 'lt',
    name: 'Larsen & Toubro (L&T)',
    industry: 'Engineering & Infrastructure',
    category: 'CAT-A',
    badgeColor: '#3b82f6',
    bankTiers: {
      hdfc: 'CAT-A',
      icici: 'Elite',
      sbi: 'Tier-1 Bluechip',
      axis: 'CAT-A',
      kotak: 'CAT-A Corp'
    },
    maxMultiplier: '26x Monthly Net',
    roiDiscount: '0.25% Discount (8.35% p.a.)',
    maxFoir: 'Up to 65% FOIR',
    processingFee: '50% Concession',
    fastTrack: true
  },
  {
    id: 'cognizant',
    name: 'Cognizant Technology Solutions',
    industry: 'IT & Systems Integration',
    category: 'CAT-A',
    badgeColor: '#3b82f6',
    bankTiers: {
      hdfc: 'CAT-A',
      icici: 'CAT-A',
      sbi: 'Tier-1 MNC',
      axis: 'CAT-A',
      kotak: 'CAT-A Corp'
    },
    maxMultiplier: '25x Monthly Net',
    roiDiscount: '0.20% Discount (8.40% p.a.)',
    maxFoir: 'Up to 65% FOIR',
    processingFee: '0.35% Concession',
    fastTrack: false
  },
  {
    id: 'hcl',
    name: 'HCL Technologies',
    industry: 'IT Services & R&D',
    category: 'CAT-A',
    badgeColor: '#3b82f6',
    bankTiers: {
      hdfc: 'CAT-A',
      icici: 'CAT-A',
      sbi: 'Tier-1 Listed',
      axis: 'CAT-A',
      kotak: 'CAT-A Corp'
    },
    maxMultiplier: '25x Monthly Net',
    roiDiscount: '0.20% Discount (8.40% p.a.)',
    maxFoir: 'Up to 65% FOIR',
    processingFee: '0.35% Concession',
    fastTrack: false
  },
  {
    id: 'ey',
    name: 'Ernst & Young (EY)',
    industry: 'Audit & Consulting',
    category: 'CAT-A',
    badgeColor: '#3b82f6',
    bankTiers: {
      hdfc: 'CAT-A',
      icici: 'Elite',
      sbi: 'Tier-1 MNC',
      axis: 'CAT-A',
      kotak: 'Tier-1 Advisory'
    },
    maxMultiplier: '26x Monthly Net',
    roiDiscount: '0.25% Discount (8.35% p.a.)',
    maxFoir: 'Up to 65% FOIR',
    processingFee: '50% Concession',
    fastTrack: true
  },
  {
    id: 'zomato',
    name: 'Zomato Limited',
    industry: 'Consumer Tech & Logistics',
    category: 'CAT-B',
    badgeColor: '#f59e0b',
    bankTiers: {
      hdfc: 'CAT-B Listed',
      icici: 'CAT-B',
      sbi: 'Tier-2 Tech',
      axis: 'CAT-B',
      kotak: 'CAT-B Corp'
    },
    maxMultiplier: '22x Monthly Net',
    roiDiscount: 'Standard (8.55% p.a.)',
    maxFoir: 'Up to 60% FOIR',
    processingFee: 'Standard 0.50%',
    fastTrack: false
  },
  {
    id: 'flipkart',
    name: 'Flipkart Internet (Walmart Group)',
    industry: 'E-commerce & Retail Tech',
    category: 'CAT-A',
    badgeColor: '#3b82f6',
    bankTiers: {
      hdfc: 'CAT-A',
      icici: 'Elite',
      sbi: 'Tier-1 MNC Sub',
      axis: 'CAT-A',
      kotak: 'Tier-1 E-comm'
    },
    maxMultiplier: '26x Monthly Net',
    roiDiscount: '0.25% Discount (8.35% p.a.)',
    maxFoir: 'Up to 65% FOIR',
    processingFee: '50% Concession',
    fastTrack: true
  }
];
