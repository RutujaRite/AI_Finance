'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  LogIn, 
  UserPlus, 
  LogOut, 
  User, 
  ChevronDown, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  ShieldCheck, 
  Calculator, 
  Sliders, 
  Bot, 
  CheckCircle2,
  TrendingUp,
  Building2
} from 'lucide-react';
import { User as UserType, ThemeMode } from '@/types';

interface HeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  currentUser: UserType | null;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  currentUser,
  onOpenLogin,
  onOpenRegister,
  onLogout,
}) => {
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="site-header">
      <div className="container header-container">
        {/* Brand Logo */}
        <a href="/" className="brand-logo">
          <div className="logo-badge">
            <Sparkles size={20} className="logo-icon" />
            <span className="logo-live-dot" />
          </div>
          <div className="brand-text">
            <span className="brand-title">CreditWise<span className="brand-accent">Engine</span></span>
            <span className="brand-tagline">Loan Eligibility Calculator</span>
          </div>
        </a>

        {/* Navigation Links */}
        <nav className="desktop-nav">
          <a href="#calculator" className="nav-link">
            <Calculator size={15} />
            <span>Calculator</span>
          </a>
          <a href="#panel-customer-profile" className="nav-link">
            <User size={15} />
            <span>Applicant Profile</span>
          </a>
          <a href="#panel-existing-obligations" className="nav-link">
            <Sliders size={15} />
            <span>Debt Portfolio (BT)</span>
          </a>
          <a href="#panel-calculation-breakdown" className="nav-link">
            <TrendingUp size={15} />
            <span>FOIR Audit</span>
          </a>
          <a href="#panel-underwriting-guide" className="nav-link">
            <ShieldCheck size={15} />
            <span>Underwriting Rules</span>
          </a>
        </nav>

        {/* Right Corner: Theme Toggle & Auth State */}
        <div className="header-right">
          {/* Theme Toggle */}
          <button 
            onClick={onToggleTheme} 
            className="theme-btn"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            type="button"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Conditional User State */}
          {currentUser ? (
            /* Logged In State: "My Account" profile icon & "Logout" button */
            <div className="logged-in-controls" ref={dropdownRef}>
              <div className="account-dropdown-wrapper">
                <button 
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  className="my-account-btn"
                  id="my-account-profile-btn"
                  type="button"
                >
                  <div className="avatar-circle">
                    {currentUser.avatarInitials || <User size={16} />}
                  </div>
                  <div className="user-meta">
                    <span className="my-account-label">My Account</span>
                    <span className="account-name">{currentUser.name}</span>
                  </div>
                  <ChevronDown size={14} className={`chevron ${accountDropdownOpen ? 'open' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {accountDropdownOpen && (
                  <div className="account-dropdown animate-fade-in">
                    <div className="dropdown-user-info">
                      <p className="dd-name">{currentUser.name}</p>
                      <p className="dd-email">{currentUser.email}</p>
                      <div className="access-pill">
                        <CheckCircle2 size={13} className="text-teal" />
                        <span>Full Calculator Access Granted</span>
                      </div>
                    </div>
                    <div className="dropdown-divider" />
                    <div className="dropdown-perks">
                      <div className="perk-item">
                        <ShieldCheck size={14} className="text-teal" />
                        <span>Verified AI Financial Profile</span>
                      </div>
                      <div className="perk-item">
                        <Calculator size={14} className="text-teal" />
                        <span>Unlimited Quotes & Amortization</span>
                      </div>
                    </div>
                    <div className="dropdown-divider" />
                    <button 
                      onClick={() => {
                        setAccountDropdownOpen(false);
                        onLogout();
                      }}
                      className="dropdown-logout-action"
                      type="button"
                    >
                      <LogOut size={16} />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Dedicated Logout Button right beside My Account */}
              <button 
                onClick={onLogout}
                className="btn-logout"
                id="header-logout-btn"
                title="Log out of your account"
                type="button"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            /* Logged Out State: "Login" (outline) & "Register" (solid teal/blue) */
            <div className="auth-buttons-group">
              <button 
                onClick={onOpenLogin}
                className="btn-login-outline"
                id="header-login-btn"
                type="button"
              >
                <LogIn size={15} />
                <span>Login</span>
              </button>
              <button 
                onClick={onOpenRegister}
                className="btn-register-solid"
                id="header-register-btn"
                type="button"
              >
                <Sparkles size={14} />
                <span>Register</span>
              </button>
            </div>
          )}

          {/* Mobile hamburger menu */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-toggle"
            type="button"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer animate-fade-in">
          <nav className="mobile-nav-links">
            <a href="#calculator" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-item">
              <Calculator size={18} />
              <span>Loan Calculator</span>
            </a>
            <a href="#panel-customer-profile" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-item">
              <User size={18} />
              <span>Applicant Profile</span>
            </a>
            <a href="#panel-existing-obligations" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-item">
              <Sliders size={18} />
              <span>Debt Portfolio & Balance Transfer</span>
            </a>
            <a href="#panel-calculation-breakdown" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-item">
              <TrendingUp size={18} />
              <span>FOIR vs Multiplier Audit</span>
            </a>
            <a href="#panel-underwriting-guide" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-item">
              <ShieldCheck size={18} />
              <span>Underwriting Rules Guide</span>
            </a>
          </nav>

          <div className="mobile-auth-footer">
            {currentUser ? (
              <div className="mobile-user-card">
                <div className="mobile-user-row">
                  <div className="avatar-circle">{currentUser.avatarInitials}</div>
                  <div>
                    <p className="mobile-username">{currentUser.name}</p>
                    <p className="mobile-email">{currentUser.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="mobile-logout-btn"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="mobile-auth-row">
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenLogin();
                  }}
                  className="btn-login-outline full-width"
                >
                  <LogIn size={16} />
                  <span>Login</span>
                </button>
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenRegister();
                  }}
                  className="btn-register-solid full-width"
                >
                  <Sparkles size={16} />
                  <span>Register</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .site-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border-color);
          transition: all 0.25s ease;
        }

        :global([data-theme='dark']) .site-header {
          background: rgba(11, 17, 32, 0.92);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: var(--header-height);
        }

        /* Logo */
        .brand-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }

        .logo-badge {
          position: relative;
          width: 42px;
          height: 42px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #1e3a8a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
        }

        .logo-live-dot {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid #ffffff;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
        }

        .brand-title {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary);
        }

        .brand-accent {
          color: var(--teal-600);
          background: linear-gradient(135deg, #0d9488, #2563eb);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .brand-tagline {
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }

        /* Desktop Nav */
        .desktop-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          transition: all 0.2s ease;
        }

        .nav-link:hover {
          color: var(--teal-600);
          background: var(--bg-hover);
        }

        /* Right Header Controls */
        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .theme-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }

        .theme-btn:hover {
          color: var(--teal-600);
          border-color: var(--teal-600);
        }

        /* Auth Buttons: Outline Login & Solid Teal Register */
        .auth-buttons-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-login-outline {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 9px 18px;
          border-radius: var(--radius-md);
          border: 1.5px solid var(--border-color);
          background: transparent;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .btn-login-outline:hover {
          border-color: var(--teal-600);
          color: var(--teal-600);
          background: rgba(13, 148, 136, 0.05);
          transform: translateY(-1px);
        }

        .btn-register-solid {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 9px 20px;
          border-radius: var(--radius-md);
          border: none;
          background: linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #1e40af 100%);
          color: #ffffff;
          font-size: 0.9rem;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35);
          transition: all 0.2s ease;
        }

        .btn-register-solid:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(13, 148, 136, 0.45);
          filter: brightness(1.05);
        }

        /* Logged In Controls */
        .logged-in-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .account-dropdown-wrapper {
          position: relative;
        }

        .my-account-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px 6px 8px;
          background: var(--bg-surface);
          border: 1.5px solid var(--teal-600);
          border-radius: var(--radius-full);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }

        .my-account-btn:hover {
          background: var(--bg-hover);
          box-shadow: var(--shadow-teal);
        }

        .avatar-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0d9488, #2563eb);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .user-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          line-height: 1.2;
        }

        .my-account-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .account-name {
          font-size: 0.72rem;
          color: var(--teal-600);
          font-weight: 600;
        }

        .chevron {
          color: var(--text-muted);
          transition: transform 0.2s ease;
        }

        .chevron.open {
          transform: rotate(180deg);
        }

        /* Account Dropdown */
        .account-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 270px;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 16px;
          box-shadow: var(--shadow-xl);
          z-index: 100;
        }

        .dropdown-user-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dd-name {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-primary);
        }

        .dd-email {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .access-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          background: var(--teal-50);
          color: var(--teal-700);
          font-size: 0.75rem;
          font-weight: 600;
        }

        :global([data-theme='dark']) .access-pill {
          background: rgba(13, 148, 136, 0.15);
          color: var(--teal-300);
        }

        .dropdown-divider {
          height: 1px;
          background: var(--border-color);
          margin: 12px 0;
        }

        .dropdown-perks {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .perk-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .dropdown-logout-action {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px;
          border-radius: var(--radius-sm);
          color: #ef4444;
          font-size: 0.85rem;
          font-weight: 600;
          transition: background 0.2s ease;
        }

        .dropdown-logout-action:hover {
          background: #fee2e2;
        }

        :global([data-theme='dark']) .dropdown-logout-action:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        /* Dedicated Logout Button */
        .btn-logout {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .btn-logout:hover {
          color: #ef4444;
          border-color: #fca5a5;
          background: #fee2e2;
        }

        :global([data-theme='dark']) .btn-logout:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        .mobile-toggle {
          display: none;
          color: var(--text-primary);
        }

        /* Mobile Drawer */
        .mobile-drawer {
          position: fixed;
          top: var(--header-height);
          left: 0;
          right: 0;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          padding: 20px 24px;
          box-shadow: var(--shadow-xl);
        }

        .mobile-nav-links {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .mobile-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-weight: 600;
          color: var(--text-secondary);
        }

        .mobile-nav-item:hover {
          background: var(--bg-hover);
          color: var(--teal-600);
        }

        .full-width {
          width: 100%;
        }

        .mobile-auth-row {
          display: flex;
          gap: 10px;
        }

        .mobile-user-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 14px;
          border-radius: var(--radius-md);
          background: var(--bg-subtle);
        }

        .mobile-user-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .mobile-username {
          font-weight: 700;
          color: var(--text-primary);
        }

        .mobile-email {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .mobile-logout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px;
          border-radius: var(--radius-sm);
          background: #fee2e2;
          color: #dc2626;
          font-weight: 600;
          font-size: 0.85rem;
        }

        /* Responsive Breakpoints */
        @media (max-width: 960px) {
          .desktop-nav {
            display: none;
          }
          .mobile-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>
    </header>
  );
};
