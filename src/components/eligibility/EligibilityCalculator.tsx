'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { EligibilityHeader } from './EligibilityHeader';
import { CustomerInformation } from './CustomerInformation';
import { LoanDetailsTable } from './LoanDetailsTable';
import { CalculationBenchmarks } from './CalculationBenchmarks';
import { RepaymentSchedule } from './RepaymentSchedule';
import { EligibilitySummary } from './EligibilitySummary';
import { EligibilityPieChart } from './EligibilityPieChart';
import { SavedRecordsModal } from './SavedRecordsModal';
import { InCraaxFooter } from '@/components/InCraaxFooter';
import { 
  LoanRow, 
  CustomerInfo, 
  SavedRecord 
} from '@/lib/eligibility/eligibilityTypes';
import { 
  calculateEligibility, 
  formatIndianRupees 
} from '@/lib/eligibility/calculateEligibility';
import { 
  INITIAL_DEMO_BENCHMARKS, 
  INITIAL_DEMO_CUSTOMER, 
  INITIAL_DEMO_LOANS,
  createDefaultLoanRow,
  validateEligibilityInput
} from '@/lib/eligibility/eligibilityValidation';

export const EligibilityCalculator: React.FC = () => {
  // State 1: Benchmarks
  const [salary, setSalary] = useState<number>(INITIAL_DEMO_BENCHMARKS.salary);
  const [foirPercent, setFoirPercent] = useState<number>(INITIAL_DEMO_BENCHMARKS.foirPercent);
  const [roiPercent, setRoiPercent] = useState<number>(INITIAL_DEMO_BENCHMARKS.roiPercent);
  const [tenureMonths, setTenureMonths] = useState<number>(INITIAL_DEMO_BENCHMARKS.tenureMonths);
  const [multiplier, setMultiplier] = useState<number>(INITIAL_DEMO_BENCHMARKS.multiplier);
  const [obligationsOverride, setObligationsOverride] = useState<number | null>(null);

  // State 2: Customer Information
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>(INITIAL_DEMO_CUSTOMER);

  // State 3: Loan Portfolio (Loaded with demo data: Aditya Birla, HDFC, ICICI)
  const [loans, setLoans] = useState<LoanRow[]>(INITIAL_DEMO_LOANS);

  // State 4: Saved Records (localStorage backed)
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState<boolean>(false);


  // State 6: Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  // Load saved records from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('callnow_saved_assessments');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedRecords(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load saved assessments', e);
    }
  }, []);

  // Sync saved records to localStorage
  const updateSavedRecords = (newRecords: SavedRecord[]) => {
    setSavedRecords(newRecords);
    try {
      localStorage.setItem('callnow_saved_assessments', JSON.stringify(newRecords));
    } catch (e) {
      console.error('Failed to store saved assessments', e);
    }
  };

  // Dynamic Obligation calculation from Table (BT = "No" loans)
  const tableObligations = useMemo(() => {
    return loans
      .filter((l) => l.balanceTransfer === 'No')
      .reduce((acc, l) => acc + (Number(l.emi) || 0), 0);
  }, [loans]);

  // Synchronous Core Underwriting Calculation
  const eligibilityResult = useMemo(() => {
    return calculateEligibility({
      salary,
      foirPercent,
      roiPercent,
      tenureMonths,
      multiplier,
      loans,
      currentObligationsOverride: obligationsOverride,
    });
  }, [salary, foirPercent, roiPercent, tenureMonths, multiplier, loans, obligationsOverride]);

  // Input Validation Issues
  const validationIssues = useMemo(() => {
    return validateEligibilityInput({
      salary,
      foirPercent,
      roiPercent,
      tenureMonths,
      multiplier,
      loans,
    });
  }, [salary, foirPercent, roiPercent, tenureMonths, multiplier, loans]);

  // Handlers for Loan Table
  const handleAddLoan = () => {
    const newRow = createDefaultLoanRow();
    setLoans((prev) => [...prev, newRow]);
    showToast('New loan row added. Edit details to update calculations immediately.');
  };

  const handleUpdateLoan = (id: string, field: keyof LoanRow, value: any) => {
    setLoans((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleDeleteLoan = (id: string) => {
    setLoans((prev) => prev.filter((r) => r.id !== id));
    showToast('Loan row removed from debt portfolio.');
  };

  const handleLoadSampleLoans = () => {
    setLoans(INITIAL_DEMO_LOANS);
    showToast('Reset portfolio to reference demo loans (Aditya Birla, HDFC, ICICI).');
  };

  const handleClearLoans = () => {
    setLoans([]);
    showToast('All loan rows cleared.');
  };

  // Customer Info Handler
  const handleCustomerInfoChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo((prev) => ({ ...prev, [field]: value }));
  };

  // Reset Benchmarks Handler
  const handleResetBenchmarks = () => {
    setSalary(INITIAL_DEMO_BENCHMARKS.salary);
    setFoirPercent(INITIAL_DEMO_BENCHMARKS.foirPercent);
    setRoiPercent(INITIAL_DEMO_BENCHMARKS.roiPercent);
    setTenureMonths(INITIAL_DEMO_BENCHMARKS.tenureMonths);
    setMultiplier(INITIAL_DEMO_BENCHMARKS.multiplier);
    setObligationsOverride(null);
    showToast('Reset benchmarks to default values (Salary ₹100k, FOIR 60%, ROI 9.99%, Tenure 60m, Multiplier 20x).');
  };

  // Save Data Handler
  const handleSaveData = () => {
    const newRecord: SavedRecord = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      customerInfo: { ...customerInfo },
      salary,
      foirPercent,
      roiPercent,
      tenureMonths,
      multiplier,
      loans: [...loans],
      result: { ...eligibilityResult },
    };

    const nextList = [newRecord, ...savedRecords.slice(0, 19)];
    updateSavedRecords(nextList);
    showToast(`Assessment saved for ${customerInfo.name || 'Applicant'}!`);
  };

  // Restore Record Handler
  const handleLoadRecord = (rec: SavedRecord) => {
    if (rec.customerInfo) setCustomerInfo(rec.customerInfo);
    if (rec.salary !== undefined) setSalary(rec.salary);
    if (rec.foirPercent !== undefined) setFoirPercent(rec.foirPercent);
    if (rec.roiPercent !== undefined) setRoiPercent(rec.roiPercent);
    if (rec.tenureMonths !== undefined) setTenureMonths(rec.tenureMonths);
    if (rec.multiplier !== undefined) setMultiplier(rec.multiplier);
    if (rec.loans) setLoans(rec.loans);
    setObligationsOverride(null);
    setIsSavedModalOpen(false);
    showToast(`Loaded assessment for ${rec.customerInfo?.name || 'Applicant'}.`);
  };

  const handleDeleteRecord = (id: string) => {
    const nextList = savedRecords.filter((r) => r.id !== id);
    updateSavedRecords(nextList);
    showToast('Record deleted.');
  };

  const handleClearAllRecords = () => {
    updateSavedRecords([]);
    showToast('Cleared all saved records.');
  };

  // Export PDF Handler
  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="calculator-layout-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="floating-toast animate-fade-in" role="status">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
          <button 
            type="button" 
            className="toast-close" 
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss toast"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="calculator-container">
        {/* 1. HEADER */}
        <EligibilityHeader
          savedCount={savedRecords.length}
          onOpenSavedRecords={() => setIsSavedModalOpen(true)}
          onSaveData={handleSaveData}
        />

        {/* Validation warnings banner if applicable */}
        {validationIssues.length > 0 && (
          <div className="validation-alert-box">
            <div className="alert-head">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="alert-title">Input Advisory:</span>
            </div>
            <div className="alert-msgs">
              {validationIssues.map((issue, idx) => (
                <span key={idx} className="alert-item">
                  • {issue.message}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 2. CUSTOMER INFORMATION CARD (Collapsible) */}
        <CustomerInformation
          customerInfo={customerInfo}
          onChange={handleCustomerInfoChange}
        />

        {/* 3. LOAN DETAILS TABLE (Editable with dynamic totals) */}
        <LoanDetailsTable
          loans={loans}
          onAddLoan={handleAddLoan}
          onUpdateLoan={handleUpdateLoan}
          onDeleteLoan={handleDeleteLoan}
          onLoadSampleLoans={handleLoadSampleLoans}
          onClearLoans={handleClearLoans}
        />

        {/* 4. ELIGIBILITY INTELLIGENCE (Large section with 2 columns) */}
        <section className="eligibility-intelligence-section">
          <div className="intelligence-grid">
            {/* LEFT SIDE: CALCULATION BENCHMARKS */}
            <div className="intelligence-col">
              <CalculationBenchmarks
                salary={salary}
                foirPercent={foirPercent}
                roiPercent={roiPercent}
                tenureMonths={tenureMonths}
                multiplier={multiplier}
                onSalaryChange={setSalary}
                onFoirChange={setFoirPercent}
                onRoiChange={setRoiPercent}
                onTenureChange={setTenureMonths}
                onMultiplierChange={setMultiplier}
                onResetBenchmarks={handleResetBenchmarks}
              />

              {/* REPAYMENT SCHEDULE & AMORTIZATION ENGINE */}
              <RepaymentSchedule
                salary={salary}
                foirPercent={foirPercent}
                roiPercent={roiPercent}
                tenureMonths={tenureMonths}
                result={eligibilityResult}
                customerInfo={customerInfo}
              />
            </div>

            {/* RIGHT SIDE: ELIGIBILITY SUMMARY */}
            <div className="intelligence-col">
              <EligibilitySummary
                salary={salary}
                foirPercent={foirPercent}
                roiPercent={roiPercent}
                tenureMonths={tenureMonths}
                multiplier={multiplier}
                result={eligibilityResult}
              />

              {/* PIE CHART GRAPHICAL ALLOCATION */}
              <EligibilityPieChart
                salary={salary}
                foirPercent={foirPercent}
                roiPercent={roiPercent}
                tenureMonths={tenureMonths}
                tableObligations={tableObligations}
                result={eligibilityResult}
              />
            </div>
          </div>
        </section>

      </div>

      {/* 7. FOOTER */}
      <InCraaxFooter />

      {/* Saved Records Modal */}
      <SavedRecordsModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedRecords={savedRecords}
        onLoadRecord={handleLoadRecord}
        onDeleteRecord={handleDeleteRecord}
        onClearAll={handleClearAllRecords}
      />

      <style jsx>{`
        .calculator-layout-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: #f1f5f9;
          color: #0f172a;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        }

        .calculator-container {
          max-width: 1240px;
          width: 100%;
          margin: 0 auto;
          padding: 24px 20px 40px 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .floating-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #0f172a;
          color: #ffffff;
          padding: 12px 18px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35);
          z-index: 10000;
          font-size: 0.84rem;
          font-weight: 600;
          max-width: 440px;
        }

        .toast-close {
          color: #94a3b8;
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px;
          margin-left: 6px;
        }

        .toast-close:hover {
          color: #ffffff;
        }

        .validation-alert-box {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 10px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .alert-head {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .alert-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: #92400e;
        }

        .alert-msgs {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 0.76rem;
          color: #b45309;
        }

        .eligibility-intelligence-section {
          width: 100%;
        }

        .intelligence-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .intelligence-grid {
            grid-template-columns: 1fr;
          }
        }

        .intelligence-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        @media print {
          .calculator-layout-wrapper {
            background: #ffffff;
          }
          .floating-toast,
          .validation-alert-box {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
