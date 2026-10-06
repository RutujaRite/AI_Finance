import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InCraax AI Automation | Professional Loan Eligibility Calculator & Underwriting Engine',
  description: 'Calculate maximum borrowing limits using FOIR Present Value (PV) and Salary Multiplier models with real-time Balance Transfer (BT) and Self Closure debt optimization.',
  keywords: 'loan eligibility calculator, foir calculator, salary multiplier, balance transfer, debt consolidation, banking underwriting, present value loan calculation',
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
