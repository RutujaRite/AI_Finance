import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CreditWiseAI | Intelligent Banking & Loan Underwriting Platform',
  description: 'Enterprise financial assistant, instant EMI amortization calculators, underwriting policy rules across 20+ banks, and verified bank managers directory.',
  keywords: 'loan assistant, emi calculator, banking underwriting, bank policies, hdfc, icici, sbi, axis, cibil, foir',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
