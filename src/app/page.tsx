'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { EMICalculatorSection } from '@/components/EMICalculatorSection';
import { AIAssistantSection } from '@/components/AIAssistantSection';
import { BankRatesSection } from '@/components/BankRatesSection';
import { CompanySearchSection } from '@/components/CompanySearchSection';
import { FeaturesSection } from '@/components/FeaturesSection';
import { Footer } from '@/components/Footer';
import { AuthModals } from '@/components/AuthModals';
import { LegalModal, LegalDocType } from '@/components/LegalModal';
import { User, ThemeMode } from '@/types';
import { CheckCircle2, Sparkles, X } from 'lucide-react';

export default function HomePage() {
  // Theme State
  const [theme, setTheme] = useState<ThemeMode>('light');

  // User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Modals State
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocType>('privacy');

  // User feedback toast
  const [authToast, setAuthToast] = useState<string | null>(null);

  // Initialize theme and restore user session from localStorage
  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem('finai-theme') as ThemeMode;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // User session initialization
    const savedUserJson = localStorage.getItem('finai_user');
    if (savedUserJson) {
      try {
        const parsed = JSON.parse(savedUserJson);
        if (parsed && parsed.name) {
          setCurrentUser(parsed);
        }
      } catch (e) {
        console.error('Failed to parse saved user', e);
      }
    }
  }, []);

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('finai-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Auth Handlers
  const handleOpenLogin = () => {
    setRegisterOpen(false);
    setLoginOpen(true);
  };

  const handleOpenRegister = () => {
    setLoginOpen(false);
    setRegisterOpen(true);
  };

  const handleCloseAuth = () => {
    setLoginOpen(false);
    setRegisterOpen(false);
  };

  const handleOpenLegal = (doc: LegalDocType) => {
    setLegalDoc(doc);
    setLegalOpen(true);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('finai_user', JSON.stringify(user));
    setAuthToast(`Welcome, ${user.name}! Full calculator access & AI insights unlocked.`);
    setTimeout(() => setAuthToast(null), 5000);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('finai_user');
    setAuthToast('You have been logged out.');
    setTimeout(() => setAuthToast(null), 4000);
  };

  return (
    <div className="landing-page-root bg-grid">
      {/* Toast Notification */}
      {authToast && (
        <div className="auth-notification-toast animate-fade-in">
          <div className="toast-content">
            <CheckCircle2 size={18} className="toast-icon text-teal" />
            <span>{authToast}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setAuthToast(null)}
            className="toast-close-btn"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 1. Header with dynamic login/register or My Account/Logout buttons */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
        onOpenLogin={handleOpenLogin}
        onOpenRegister={handleOpenRegister}
        onLogout={handleLogout}
      />

      {/* Logged in Welcome Status Bar (when authenticated) */}
      {currentUser && (
        <div className="user-status-bar">
          <div className="container status-bar-inner">
            <div className="status-pill-left">
              <span className="live-pulse-dot" />
              <span>Full Access Unlocked for <strong>{currentUser.name}</strong> ({currentUser.email})</span>
            </div>
            <div className="status-pill-right">
              <Sparkles size={14} className="text-teal" />
              <span>Unlimited calculations & saved quotes active</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Flow */}
      <main>
        {/* 2. Hero Section with strong headline & subtitle */}
        <HeroSection
          onOpenRegister={handleOpenRegister}
          isLoggedIn={!!currentUser}
        />

        {/* 3. Core Feature: Interactive Real-Time EMI Calculator */}
        <EMICalculatorSection
          currentUser={currentUser}
          onOpenRegister={handleOpenRegister}
          onOpenLogin={handleOpenLogin}
        />

        {/* 5. 24/7 AI Financial Assistant */}
        <AIAssistantSection />

        {/* 6. Partner Bank Comparison Benchmarks */}
        <BankRatesSection />

        {/* 7. Corporate Underwriting: Employer & Company Category Search */}
        <CompanySearchSection />

        {/* 8. FinTech Features & Trust */}
        <FeaturesSection />
      </main>

      {/* 8. Modern Footer */}
      <Footer onOpenLegal={handleOpenLegal} />

      {/* 9. Authentication Modals (Register & Login with toggle between them) */}
      <AuthModals
        loginOpen={loginOpen}
        registerOpen={registerOpen}
        onClose={handleCloseAuth}
        onLoginSuccess={handleLoginSuccess}
        onOpenLogin={handleOpenLogin}
        onOpenRegister={handleOpenRegister}
      />

      {/* 10. Legal & Governance Modal (Privacy Policy, Terms of Service, Security Statement) */}
      <LegalModal
        isOpen={legalOpen}
        initialDoc={legalDoc}
        onClose={() => setLegalOpen(false)}
      />

      <style jsx>{`
        .landing-page-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }

        /* User Status Bar */
        .user-status-bar {
          background: linear-gradient(90deg, #091a2f 0%, #0d2847 100%);
          color: #ffffff;
          padding: 8px 0;
          font-size: 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .status-bar-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }

        .status-pill-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .live-pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
        }

        .status-pill-right {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #2dd4bf;
          font-weight: 600;
        }

        /* Toast */
        .auth-notification-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2000;
          background: var(--bg-surface);
          border: 1.5px solid var(--teal-600);
          border-radius: var(--radius-lg);
          padding: 14px 20px;
          box-shadow: var(--shadow-xl), 0 10px 25px -5px rgba(13, 148, 136, 0.3);
          display: flex;
          align-items: center;
          gap: 16px;
          max-width: 440px;
        }

        .toast-content {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .toast-close-btn {
          color: var(--text-muted);
          padding: 2px;
        }

        .toast-close-btn:hover {
          color: var(--text-primary);
        }

        @media (max-width: 640px) {
          .status-bar-inner {
            flex-direction: column;
            align-items: flex-start;
          }
          .auth-notification-toast {
            left: 16px;
            right: 16px;
            bottom: 16px;
          }
        }
      `}</style>
    </div>
  );
}
