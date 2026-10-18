'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/landing/Header';
import { HeroSection } from '@/components/landing/HeroSection';
import { PartnerBanksMarquee } from '@/components/landing/PartnerBanksMarquee';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { MetricCards } from '@/components/landing/MetricCards';
import { ServiceCards } from '@/components/landing/ServiceCards';
import { Footer } from '@/components/landing/Footer';
import { LegalDocType } from '@/components/landing/LegalModal';
import { User, ThemeMode } from '@/types';
import { CheckCircle2, Sparkles, X, TrendingUp, Bot, ArrowRight } from 'lucide-react';
import './landing.css';

// Lazy-load below-the-fold heavy sections and modals to keep initial bundle tiny and fast
const EMICalculatorSection = dynamic(
  () => import('@/components/landing/EMICalculatorSection').then((mod) => mod.EMICalculatorSection),
  {
    loading: () => <div style={{ minHeight: '350px' }} />,
    ssr: true,
  }
);

const AIAssistantSection = dynamic(
  () => import('@/components/landing/AIAssistantSection').then((mod) => mod.AIAssistantSection),
  {
    loading: () => <div style={{ minHeight: '300px' }} />,
    ssr: true,
  }
);

const BankRatesSection = dynamic(
  () => import('@/components/landing/BankRatesSection').then((mod) => mod.BankRatesSection),
  {
    loading: () => <div style={{ minHeight: '300px' }} />,
    ssr: true,
  }
);

const CompanySearchSection = dynamic(
  () => import('@/components/landing/CompanySearchSection').then((mod) => mod.CompanySearchSection),
  {
    loading: () => <div style={{ minHeight: '350px' }} />,
    ssr: true,
  }
);

const AuthModals = dynamic(
  () => import('@/components/landing/AuthModals').then((mod) => mod.AuthModals),
  { ssr: false }
);

const LegalModal = dynamic(
  () => import('@/components/landing/LegalModal').then((mod) => mod.LegalModal),
  { ssr: false }
);

export default function HomePage() {
  const router = useRouter();

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

  // Initialize theme and restore user session from backend / localStorage
  useEffect(() => {
    // 1. Theme initialization
    const savedTheme = (localStorage.getItem('finai-theme') || localStorage.getItem('theme')) as ThemeMode;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
      document.documentElement.setAttribute('data-bs-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.setAttribute('data-bs-theme', 'light');
    }

    // 2. User session initialization (check localStorage immediately, verify in background)
    function initUserSession() {
      // Immediate local check to eliminate blocking
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

      // Background verification without blocking initial page rendering
      fetch('/api/auth/verify', { credentials: 'include' })
        .then((res) => {
          if (res.ok) {
            return res.json();
          }
          if (savedUserJson) {
            setCurrentUser(null);
            localStorage.removeItem('finai_user');
          }
          return null;
        })
        .then((data) => {
          if (data && data.success && data.user) {
            const serverUser: User = {
              id: String(data.user.id || 'usr_active'),
              name: data.user.name || (data.user.email ? data.user.email.split('@')[0] : 'User'),
              email: data.user.email,
              role: data.user.role === 'admin' ? 'Loan Officer' : 'DSA Agent',
              avatarInitials: ((data.user.name || data.user.email || 'U').substring(0, 2)).toUpperCase(),
              company: data.user.company || 'CreditWise Financial Network'
            };
            setCurrentUser(serverUser);
            localStorage.setItem('finai_user', JSON.stringify(serverUser));
          }
        })
        .catch((err) => {
          console.warn('Auth verify check notice:', err);
        });
    }

    // 3. Auto-open AuthModal if redirected from protected routes or URL params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const auth = params.get('auth');
      const isLogin = params.get('login');
      const isRegister = params.get('register');
      const from = params.get('from');

      const isLogout = params.get('logout');

      if (isLogout === 'true' || isLogout === '1') {
        setAuthToast('You have been securely logged out.');
        setTimeout(() => setAuthToast(null), 4500);
        if (window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete('logout');
          window.history.replaceState({}, '', url.pathname + (url.search || ''));
        }
      } else if (auth === 'login' || isLogin === 'true' || from) {
        setLoginOpen(true);
        setRegisterOpen(false);
      } else if (auth === 'register' || isRegister === 'true') {
        setRegisterOpen(true);
        setLoginOpen(false);
      }
    }

    initUserSession();

    // Quietly warm up the primary workspace route during idle time only
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          try {
            router.prefetch('/home');
          } catch {}
        });
      } else {
        setTimeout(() => {
          try {
            router.prefetch('/home');
          } catch {}
        }, 2000);
      }
    }
  }, [router]);

  // 4. IntersectionObserver for Scroll Reveals
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('finai-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.setAttribute('data-bs-theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      document.cookie = `theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {}
  };

  // Auth Handlers
  const handleOpenLogin = () => {
    // If user is already authenticated, directly navigate to the entire project
    if (currentUser) {
      router.push('/home');
      return;
    }
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
    if (typeof window !== 'undefined' && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      url.searchParams.delete('login');
      url.searchParams.delete('register');
      url.searchParams.delete('from');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    }
  };

  const handleOpenLegal = (doc: LegalDocType) => {
    setLegalDoc(doc);
    setLegalOpen(true);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('finai_user', JSON.stringify(user));

    // Seamlessly navigate directly to the requested workspace / entire project
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const target = params.get('from') || '/home';
      window.location.href = target;
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.warn('Logout error', e);
    }
    setCurrentUser(null);
    localStorage.removeItem('finai_user');
    setAuthToast('You have been logged out.');
    setTimeout(() => setAuthToast(null), 4000);
  };

  const handleSelectMetric = (id: string) => {
    if (id === 'stat-banks') {
      document.getElementById('bank-rates')?.scrollIntoView({ behavior: 'smooth' });
    } else if (id === 'stat-employers') {
      document.getElementById('company-search')?.scrollIntoView({ behavior: 'smooth' });
    } else if (id === 'stat-policies') {
      document.getElementById('bank-rates')?.scrollIntoView({ behavior: 'smooth' });
    } else if (id === 'stat-math') {
      document.getElementById('emi-calculator')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenAIWithPrompt = (prompt: string) => {
    if (currentUser) {
      router.push(`/home?section=assistant${prompt ? `&prompt=${encodeURIComponent(prompt)}` : ''}`);
    } else {
      const el = document.getElementById('ai-assistant');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      else handleOpenLogin();
    }
  };

  const handleOpenEMI = () => {
    if (currentUser) {
      router.push('/home?section=emi');
    } else {
      const el = document.getElementById('emi-calculator');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      else handleOpenLogin();
    }
  };

  const handleOpenPolicies = (bankId?: string) => {
    if (currentUser) {
      router.push('/home?section=policies');
    } else {
      const el = document.getElementById('bank-rates');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      else handleOpenLogin();
    }
  };

  const handleOpenManagers = () => {
    if (currentUser) {
      router.push('/bank-managers');
    } else {
      handleOpenLogin();
    }
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
            aria-label="Close notification"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 1. Header with clean Login and Register buttons */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
        onOpenLogin={handleOpenLogin}
        onOpenRegister={handleOpenRegister}
        onLogout={handleLogout}
      />

      {/* Main Page Flow */}
      <main>
        {/* 2. Hero Section */}
        <HeroSection
          onOpenRegister={handleOpenRegister}
          isLoggedIn={!!currentUser}
        />

        {/* 2.5 Infinite Auto-Scrolling Partner Banks Marquee */}
        <div className="reveal-on-scroll">
          <PartnerBanksMarquee />
        </div>

        {/* 3. Live Dashboard Information & KPI Insights */}
        <div id="dashboard-insights" className="dashboard-insights-wrapper reveal-on-scroll" style={{ marginTop: '0.5rem' }}>
          <MetricCards onSelectMetric={handleSelectMetric} />
        </div>

        {/* 4. Platform Underwriting Services & Interactive Tools */}
        <div id="dashboard-tools" className="reveal-on-scroll">
          <ServiceCards
            onOpenAIWithPrompt={handleOpenAIWithPrompt}
            onOpenEMI={handleOpenEMI}
            onOpenPolicies={handleOpenPolicies}
            onOpenManagers={handleOpenManagers}
          />
        </div>

        {/* 5. Core Feature: Interactive Real-Time EMI Calculator */}
        <div className="reveal-on-scroll">
          <EMICalculatorSection
            currentUser={currentUser}
            onOpenRegister={handleOpenRegister}
            onOpenLogin={handleOpenLogin}
          />
        </div>

        {/* 6. 24/7 AI Financial Assistant */}
        <div className="reveal-on-scroll">
          <AIAssistantSection />
        </div>

        {/* 7. Partner Bank Comparison Benchmarks */}
        <div className="reveal-on-scroll">
          <BankRatesSection />
        </div>

        {/* 8. Corporate Underwriting: Employer & Company Category Search */}
        <div className="reveal-on-scroll">
          <CompanySearchSection />
        </div>

        {/* 9. FinTech Features & Trust */}
        <div className="reveal-on-scroll">
          <FeaturesSection />
        </div>
      </main>

      {/* 10. Modern Footer */}
      <div className="reveal-on-scroll">
        <Footer onOpenLegal={handleOpenLegal} />
      </div>

      {/* 9. Authentication Modals (Register & Login) */}
      <AuthModals
        loginOpen={loginOpen}
        registerOpen={registerOpen}
        onClose={handleCloseAuth}
        onLoginSuccess={handleLoginSuccess}
        onOpenLogin={handleOpenLogin}
        onOpenRegister={handleOpenRegister}
      />

      {/* 10. Legal & Governance Modal */}
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

        /* Toast */
        .auth-notification-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2000;
          background: var(--bg-surface);
          border: 1.5px solid var(--teal-600);
          border-radius: var(--radius-lg);
          padding: 12px 18px;
          box-shadow: var(--shadow-xl), 0 10px 25px -5px rgba(13, 148, 136, 0.3);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          max-width: 480px;
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
          background: transparent;
          border: none;
          cursor: pointer;
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
