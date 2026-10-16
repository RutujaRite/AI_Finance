'use client';

import React from 'react';
import { Building2, Sparkles, ShieldCheck } from 'lucide-react';

interface BankPartnerItem {
  name: string;
  code: string;
  rate: string;
  category: string;
  color: string;
}

const PARTNER_BANKS: BankPartnerItem[] = [
  { name: 'HDFC Bank', code: 'HDFC', rate: '8.50%', category: 'Master Guidelines', color: '#004c8f' },
  { name: 'ICICI Bank', code: 'ICICI', rate: '8.40%', category: 'Corporate Tier-A', color: '#f58220' },
  { name: 'State Bank of India', code: 'SBI', rate: '8.25%', category: 'Benchmark Prime', color: '#2b5ea9' },
  { name: 'Axis Bank', code: 'AXIS', rate: '8.65%', category: 'Instant Disbursal', color: '#97144d' },
  { name: 'Kotak Mahindra', code: 'KOTAK', rate: '8.75%', category: 'Super CAT Match', color: '#ed1b24' },
  { name: 'IndusInd Bank', code: 'INDUS', rate: '8.90%', category: 'Flexible Multiplier', color: '#881d22' },
  { name: 'Bajaj Finserv', code: 'BAJAJ', rate: '9.15%', category: 'Fast Approval', color: '#0072bc' },
  { name: 'Tata Capital', code: 'TATA', rate: '9.20%', category: 'High FOIR Limits', color: '#00549f' },
  { name: 'Poonawalla Fincorp', code: 'PFC', rate: '9.40%', category: 'Digital Underwrite', color: '#e31b23' },
  { name: 'Cholamandalam', code: 'CHOLA', rate: '9.50%', category: 'Prime NBFC', color: '#f37023' },
  { name: 'SMFG India Credit', code: 'SMFG', rate: '9.75%', category: 'Multi-Lender Rule', color: '#00529b' },
  { name: 'Piramal Finance', code: 'PIRAMAL', rate: '9.60%', category: 'Flexible Tenures', color: '#c41230' },
  { name: 'Fibe (EarlySalary)', code: 'FIBE', rate: '10.0%', category: 'Smart Instant AI', color: '#00bfa5' },
  { name: 'Utkarsh SFB', code: 'UTKARSH', rate: '9.90%', category: 'Fast Sourcing', color: '#ed6c00' },
];

export const PartnerBanksMarquee: React.FC = () => {
  // Double list to create uninterrupted infinite scroll
  const marqueeList = [...PARTNER_BANKS, ...PARTNER_BANKS];

  return (
    <div className="partner-marquee-container">
      <div className="marquee-glass-wrapper">
        <div className="marquee-header-pill">
          <Sparkles size={14} className="text-teal" />
          <span>20+ Leading Indian Lenders Benchmarked</span>
        </div>

        <div className="marquee-inner-viewport">
          <div className="marquee-track">
            {marqueeList.map((bank, idx) => (
              <div 
                key={`${bank.code}-${idx}`} 
                className="marquee-bank-badge"
                title={`${bank.name} • Best APR from ${bank.rate}`}
              >
                <div 
                  className="marquee-bank-logo"
                  style={{ background: bank.color }}
                >
                  {bank.code.slice(0, 3)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{bank.name}</span>
                  <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>{bank.category}</span>
                </div>
                <span className="marquee-bank-rate">From {bank.rate}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
