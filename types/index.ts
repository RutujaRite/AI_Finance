export type ThemeMode = 'light' | 'dark';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Loan Officer' | 'DSA Agent' | 'Borrower / Applicant' | 'Bank Manager';
  avatarInitials: string;
  company?: string;
}

export interface BankPolicy {
  id: string;
  bankName: string;
  code: string;
  logoColor: string;
  minCibil: number;
  maxFoir: number; // percentage
  minSalary: number; // INR
  roiRange: string;
  processingFee: string;
  employerCategories: string[];
  maxTenureYears: number;
  specialRules: string[];
}

export interface BankManager {
  id: string;
  name: string;
  role: string;
  bank: string;
  city: string;
  branch: string;
  phone: string;
  email: string;
  verified: boolean;
  avatar: string;
}

export interface StatItem {
  id: string;
  number: string;
  label: string;
  sublabel: string;
  icon: string;
  badge?: string;
  trend?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  calculatedEmi?: {
    monthlyEmi: number;
    principal: number;
    interest: number;
    tenureMonths: number;
  };
}
