'use client';

import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  TrendingDown, 
  Percent, 
  Zap, 
  Layers,
  Award
} from 'lucide-react';
import { COMPANIES_DATA, CompanyListing } from '@/data/companiesData';

interface CompanySearchSectionProps {
  onSelectCompany?: (company: CompanyListing) => void;
}

export const CompanySearchSection: React.FC<CompanySearchSectionProps> = ({
  onSelectCompany
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCompanyModal, setSelectedCompanyModal] = useState<CompanyListing | null>(null);

  // Filter companies based on search term and category filter
  const filteredCompanies = useMemo(() => {
    return COMPANIES_DATA.filter((comp) => {
      const matchesSearch = 
        comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat = 
        selectedCategory === 'All' || comp.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <section id="company-search" className="company-search-section">
      <div className="container">
        {/* Section Header */}
        <div className="section-head">
          <div className="section-badge">
            <Building2 size={15} className="text-teal" />
            <span>Corporate Underwriting Matrix</span>
          </div>
          <h2 className="section-title">Employer & Company Category Search</h2>
          <p className="section-subtitle">
            Banks classify 339,000+ companies into risk tiers. Search your employer to find out your approved category, special loan multipliers, and interest rate discounts across top lenders.
          </p>

          {/* Search Bar */}
          <div className="search-bar-wrapper">
            <div className="search-input-box glass-panel">
              <Search size={20} className="search-icon text-teal" />
              <input
                type="text"
                placeholder="Search company (e.g. Google, TCS, Infosys, Deloitte, Reliance, Wipro, Central Govt)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="company-search-input"
              />
              {searchTerm && (
                <button 
                  type="button" 
                  onClick={() => setSearchTerm('')} 
                  className="clear-search-btn"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="category-filter-pills">
              {['All', 'Super CAT-A', 'CAT-A', 'CAT-B', 'Govt / PSU'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                >
                  {cat === 'All' ? 'All Employers' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Counter */}
        <div className="results-status-bar">
          <span className="results-count">
            Showing <strong>{filteredCompanies.length}</strong> verified corporate profiles
          </span>
          <span className="verified-stamp">
            <ShieldCheck size={14} className="text-teal" />
            <span>Synced with HDFC, ICICI, SBI & Axis Underwriting Tiers</span>
          </span>
        </div>

        {/* Company Cards Grid */}
        <div className="companies-grid">
          {filteredCompanies.map((company) => (
            <div key={company.id} className="company-card glass-panel">
              <div className="company-card-header">
                <div className="company-info">
                  <div className="company-icon-circle">
                    {company.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="company-title">{company.name}</h3>
                    <span className="company-industry">{company.industry}</span>
                  </div>
                </div>

                <div 
                  className="category-badge"
                  style={{ 
                    backgroundColor: `${company.badgeColor}15`, 
                    color: company.badgeColor,
                    borderColor: `${company.badgeColor}40`
                  }}
                >
                  <Award size={13} />
                  <span>{company.category}</span>
                </div>
              </div>

              {/* Bank Categories Grid */}
              <div className="bank-tiers-grid">
                <div className="bank-tier-item">
                  <span className="bank-code-label">HDFC</span>
                  <span className="bank-tier-val">{company.bankTiers.hdfc}</span>
                </div>
                <div className="bank-tier-item">
                  <span className="bank-code-label">ICICI</span>
                  <span className="bank-tier-val">{company.bankTiers.icici}</span>
                </div>
                <div className="bank-tier-item">
                  <span className="bank-code-label">SBI</span>
                  <span className="bank-tier-val">{company.bankTiers.sbi}</span>
                </div>
                <div className="bank-tier-item">
                  <span className="bank-code-label">Axis</span>
                  <span className="bank-tier-val">{company.bankTiers.axis}</span>
                </div>
              </div>

              {/* Special Underwriting Privileges */}
              <div className="privileges-box">
                <div className="privilege-row">
                  <Zap size={14} className="text-teal" />
                  <span className="priv-lbl">Loan Capacity:</span>
                  <strong className="priv-val">{company.maxMultiplier}</strong>
                </div>
                <div className="privilege-row">
                  <TrendingDown size={14} className="text-teal" />
                  <span className="priv-lbl">Rate Concession:</span>
                  <strong className="priv-val text-teal-highlight">{company.roiDiscount}</strong>
                </div>
                <div className="privilege-row">
                  <Percent size={14} className="text-teal" />
                  <span className="priv-lbl">FOIR Allowed:</span>
                  <strong className="priv-val">{company.maxFoir}</strong>
                </div>
                <div className="privilege-row">
                  <CheckCircle2 size={14} className="text-teal" />
                  <span className="priv-lbl">Processing Fee:</span>
                  <strong className="priv-val">{company.processingFee}</strong>
                </div>
              </div>

              {/* Action Button */}
              <a 
                href="#emi-calculator" 
                className="company-cta-btn"
                onClick={() => onSelectCompany && onSelectCompany(company)}
              >
                <span>Calculate EMI for {company.name.split(' ')[0]}</span>
                <ArrowRight size={15} />
              </a>
            </div>
          ))}

          {filteredCompanies.length === 0 && (
            <div className="no-results-box glass-panel">
              <Building2 size={36} className="text-muted" />
              <h4>No employers found matching "{searchTerm}"</h4>
              <p>We track over 339,000 unlisted and listed corporates. Try searching for a broader term or check standard CAT-B guidelines.</p>
              <button 
                type="button" 
                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
                className="reset-search-btn"
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </div>

        {/* Corporate Underwriting Explainer */}
        <div className="explainer-banner glass-panel">
          <div className="explainer-icon-box">
            <Sparkles size={24} className="text-teal" />
          </div>
          <div className="explainer-text">
            <h4 className="explainer-title">How Employer Categorization Impacts Your Loan Approval</h4>
            <p className="explainer-desc">
              When underwriting personal and home loans, premier banks evaluate employer stability. Applicants working in <strong>Super CAT-A</strong> and <strong>CAT-A</strong> listed enterprises receive automated credit sanctioning, up to <strong>0.35% lower interest rates</strong>, and increased salary multipliers (up to 30x monthly income instead of standard 18x).
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .company-search-section {
          padding: 80px 0;
          background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--bg-primary) 100%);
        }

        .section-head {
          text-align: center;
          max-width: 720px;
          margin: 0 auto 40px auto;
        }

        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: var(--radius-full);
          background: var(--teal-50);
          color: var(--teal-800);
          font-size: 0.78rem;
          font-weight: 700;
          margin-bottom: 14px;
          border: 1px solid var(--teal-200);
        }

        :global([data-theme='dark']) .section-badge {
          background: rgba(13, 148, 136, 0.15);
          color: var(--teal-300);
          border-color: rgba(13, 148, 136, 0.3);
        }

        .section-title {
          font-size: 2.4rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin-bottom: 12px;
        }

        .section-subtitle {
          font-size: 1.02rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 28px;
        }

        /* Search Bar */
        .search-bar-wrapper {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }

        .search-input-box {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          max-width: 640px;
          border-radius: var(--radius-full);
          border: 1.5px solid var(--border-color);
          padding: 6px 20px;
          box-shadow: var(--shadow-md);
          transition: all 0.2s ease;
        }

        .search-input-box:focus-within {
          border-color: var(--teal-600);
          box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.15);
        }

        .search-icon {
          margin-right: 12px;
          flex-shrink: 0;
        }

        .company-search-input {
          width: 100%;
          border: none;
          background: transparent;
          font-size: 0.98rem;
          color: var(--text-primary);
          outline: none;
          padding: 8px 0;
        }

        .clear-search-btn {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
          padding: 4px 8px;
        }

        .clear-search-btn:hover {
          color: var(--text-primary);
        }

        /* Category Filter Pills */
        .category-filter-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .cat-pill {
          padding: 6px 14px;
          border-radius: var(--radius-full);
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }

        .cat-pill:hover {
          border-color: var(--teal-600);
          color: var(--teal-600);
        }

        .cat-pill.active {
          background: var(--teal-600);
          border-color: var(--teal-600);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3);
        }

        /* Status Bar */
        .results-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          font-size: 0.84rem;
          color: var(--text-muted);
          flex-wrap: wrap;
          gap: 12px;
        }

        .verified-stamp {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--teal-700);
          font-weight: 600;
        }

        :global([data-theme='dark']) .verified-stamp {
          color: var(--teal-300);
        }

        /* Companies Grid */
        .companies-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
        }

        .company-card {
          border-radius: var(--radius-lg);
          padding: 24px;
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }

        .company-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-xl);
          border-color: var(--teal-400);
        }

        .company-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .company-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .company-icon-circle {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #0d9488, #1e3a8a);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.1rem;
        }

        .company-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .company-industry {
          font-size: 0.76rem;
          color: var(--text-muted);
        }

        .category-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: 0.74rem;
          font-weight: 800;
          border: 1px solid;
          white-space: nowrap;
        }

        /* Bank Tiers Grid */
        .bank-tiers-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          padding: 10px 12px;
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
        }

        .bank-tier-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          text-align: center;
        }

        .bank-code-label {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .bank-tier-val {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        /* Privileges Box */
        .privileges-box {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 14px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
        }

        .privilege-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
        }

        .priv-lbl {
          color: var(--text-muted);
          width: 110px;
          flex-shrink: 0;
        }

        .priv-val {
          color: var(--text-primary);
          font-weight: 700;
          margin-left: auto;
          text-align: right;
        }

        .text-teal-highlight {
          color: var(--teal-600) !important;
        }

        .company-cta-btn {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          color: var(--teal-700);
          font-size: 0.86rem;
          font-weight: 700;
          transition: all 0.2s ease;
        }

        :global([data-theme='dark']) .company-cta-btn {
          color: var(--teal-300);
        }

        .company-cta-btn:hover {
          background: var(--teal-600);
          color: #ffffff;
          border-color: var(--teal-600);
        }

        .no-results-box {
          grid-column: 1 / -1;
          padding: 48px;
          text-align: center;
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .no-results-box h4 {
          font-size: 1.2rem;
          color: var(--text-primary);
        }

        .no-results-box p {
          max-width: 480px;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .reset-search-btn {
          padding: 8px 18px;
          border-radius: var(--radius-md);
          background: var(--teal-600);
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 700;
          margin-top: 8px;
        }

        /* Explainer Banner */
        .explainer-banner {
          display: flex;
          align-items: flex-start;
          gap: 18px;
          padding: 24px 28px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--teal-200);
          background: linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(30, 58, 138, 0.04) 100%);
        }

        :global([data-theme='dark']) .explainer-banner {
          border-color: rgba(13, 148, 136, 0.3);
          background: rgba(13, 148, 136, 0.1);
        }

        .explainer-icon-box {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          background: var(--teal-50);
          border: 1px solid var(--teal-200);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        :global([data-theme='dark']) .explainer-icon-box {
          background: rgba(13, 148, 136, 0.2);
          border-color: rgba(13, 148, 136, 0.35);
        }

        .explainer-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .explainer-desc {
          font-size: 0.88rem;
          line-height: 1.55;
          color: var(--text-secondary);
        }

        @media (max-width: 640px) {
          .results-status-bar {
            flex-direction: column;
            align-items: flex-start;
          }
          .bank-tiers-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
        }
      `}</style>
    </section>
  );
};
