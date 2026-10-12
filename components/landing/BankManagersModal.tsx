'use client';

import React, { useState } from 'react';
import { X, Users, Search, Phone, Mail, MapPin, CheckCircle, ShieldCheck, Copy, Check } from 'lucide-react';
import { BANK_MANAGERS } from '@/data/mockData';
import { BankManager } from '@/types';

interface BankManagersModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCity?: string;
}

export const BankManagersModal: React.FC<BankManagersModalProps> = ({
  isOpen,
  onClose,
  initialCity = '',
}) => {
  const [searchTerm, setSearchTerm] = useState(initialCity);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialCity) {
      setSearchTerm(initialCity);
      setSelectedCity(initialCity);
    }
  }, [initialCity]);

  if (!isOpen) return null;

  const filteredManagers = BANK_MANAGERS.filter((mgr) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      mgr.name.toLowerCase().includes(q) ||
      mgr.city.toLowerCase().includes(q) ||
      mgr.bank.toLowerCase().includes(q) ||
      mgr.branch.toLowerCase().includes(q);

    if (selectedCity && selectedCity !== 'All') {
      return matchesSearch && mgr.city.toLowerCase() === selectedCity.toLowerCase();
    }
    return matchesSearch;
  });

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const cities = ['All', 'Pune', 'Mumbai', 'Delhi NCR', 'Bengaluru', 'Hyderabad'];

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-managers-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-badge-title">
            <div className="managers-badge-icon">
              <Users size={20} />
            </div>
            <div>
              <h2 className="header-title">Bank Managers & Credit Officers Directory</h2>
              <p className="header-desc">Direct verified branch connections for fast loan sanctions & escalations</p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn" type="button">
            <X size={18} />
          </button>
        </div>

        {/* Search & City Filter Bar */}
        <div className="filter-controls-bar">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by officer name, bank or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="managers-search-input"
            />
          </div>

          <div className="city-pill-list">
            {cities.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setSelectedCity(c === 'All' ? '' : c);
                  if (c === 'All') setSearchTerm('');
                }}
                className={`city-pill ${(selectedCity === c || (!selectedCity && c === 'All')) ? 'active' : ''}`}
                type="button"
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Cards Grid */}
        <div className="managers-scroll-area">
          {filteredManagers.length === 0 ? (
            <div className="no-results-box">
              <p>No verified bank managers found matching your search.</p>
              <button 
                onClick={() => { setSearchTerm(''); setSelectedCity(''); }} 
                className="reset-search-btn"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="managers-card-grid">
              {filteredManagers.map((mgr) => (
                <div key={mgr.id} className="manager-profile-card">
                  <div className="profile-card-top">
                    <div className="manager-avatar-badge">
                      {mgr.avatar}
                    </div>
                    <div className="profile-titles">
                      <div className="name-verified-row">
                        <h4 className="mgr-name">{mgr.name}</h4>
                        {mgr.verified && (
                          <span className="verified-pill" title="Verified Branch Manager">
                            <ShieldCheck size={13} />
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="mgr-role">{mgr.role}</p>
                      <span className="mgr-bank">{mgr.bank}</span>
                    </div>
                  </div>

                  <div className="profile-card-details">
                    <div className="detail-item">
                      <MapPin size={14} className="detail-icon" />
                      <span>{mgr.branch}, {mgr.city}</span>
                    </div>
                    <div className="detail-item">
                      <Mail size={14} className="detail-icon" />
                      <a href={`mailto:${mgr.email}`} className="email-link">{mgr.email}</a>
                    </div>
                  </div>

                  <div className="profile-card-actions">
                    <button 
                      onClick={() => handleCopyPhone(mgr.id, mgr.phone)}
                      className="btn-call-copy"
                      type="button"
                    >
                      {copiedId === mgr.id ? (
                        <>
                          <Check size={14} className="text-green" />
                          <span>Copied Phone!</span>
                        </>
                      ) : (
                        <>
                          <Phone size={14} />
                          <span>{mgr.phone}</span>
                          <Copy size={12} className="copy-icon" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-managers-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 860px;
          height: 640px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .modal-header {
          padding: 1.25rem 1.75rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-badge-title {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .managers-badge-icon {
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          background: #ede9fe;
          color: #7c3aed;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        [data-theme='dark'] .managers-badge-icon {
          background: rgba(124, 58, 237, 0.2);
          color: #c4b5fd;
        }

        .header-title {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .header-desc {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .modal-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .filter-controls-bar {
          padding: 0.85rem 1.75rem;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .search-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 240px;
        }

        .search-icon {
          position: absolute;
          left: 0.85rem;
          color: var(--text-muted);
        }

        .managers-search-input {
          width: 100%;
          padding: 0.5rem 0.85rem 0.5rem 2.3rem;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          font-size: 0.825rem;
          color: var(--text-primary);
          outline: none;
        }

        .city-pill-list {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
        }

        .city-pill {
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 600;
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          transition: all 0.18s ease;
          white-space: nowrap;
        }

        .city-pill.active {
          background: var(--primary-50);
          color: var(--primary-600);
          border-color: var(--primary-500);
        }

        .managers-scroll-area {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem 1.75rem;
        }

        .managers-card-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.25rem;
        }

        .manager-profile-card {
          background: var(--bg-subtle);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.2s ease;
        }

        .manager-profile-card:hover {
          border-color: var(--primary-200);
          box-shadow: var(--shadow-md);
        }

        .profile-card-top {
          display: flex;
          gap: 0.85rem;
          margin-bottom: 0.85rem;
        }

        .manager-avatar-badge {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: #fff;
          font-weight: 800;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .profile-titles {
          flex: 1;
        }

        .name-verified-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .mgr-name {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .verified-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.65rem;
          font-weight: 700;
          color: #059669;
          background: #d1fae5;
          padding: 0.15rem 0.45rem;
          border-radius: var(--radius-sm);
        }

        [data-theme='dark'] .verified-pill {
          background: #064e3b;
          color: #a7f3d0;
        }

        .mgr-role {
          font-size: 0.775rem;
          color: var(--text-muted);
          margin-top: 0.15rem;
        }

        .mgr-bank {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--primary-600);
          margin-top: 0.25rem;
        }

        .profile-card-details {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          margin-bottom: 1rem;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.775rem;
          color: var(--text-secondary);
        }

        .detail-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .email-link {
          color: var(--text-secondary);
        }

        .email-link:hover {
          color: var(--primary-500);
          text-decoration: underline;
        }

        .profile-card-actions {
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-color);
        }

        .btn-call-copy {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-primary);
          transition: all 0.2s ease;
        }

        .btn-call-copy:hover {
          border-color: var(--primary-500);
          color: var(--primary-600);
          background: var(--primary-50);
        }

        .copy-icon {
          opacity: 0.6;
        }

        .text-green {
          color: #10b981;
        }

        .no-results-box {
          text-align: center;
          padding: 3rem 1rem;
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .reset-search-btn {
          margin-top: 0.75rem;
          font-weight: 600;
          color: var(--primary-500);
        }

        @media (max-width: 768px) {
          .managers-card-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
