"use client";

import React, { useState } from "react";
import {
  Check,
  Star,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  ArrowRight,
  TrendingUp,
  Percent,
  Calendar,
  IndianRupee,
  ShieldCheck,
  Info,
} from "lucide-react";

export interface RecommendedBankData {
  bankName: string;
  bankId?: string;
  status: string;
  isEligible: boolean;
  amount: string;
  roi: string;
  tenure?: string;
  reason: string;
}

export interface BankEligibilityRow {
  bankName: string;
  bankId?: string;
  status: "Eligible" | "Needs Review" | "Not Eligible" | string;
  isEligible: boolean;
  amount: string;
  roi: string;
  tenure: string;
  reason: string;
  isRecommended?: boolean;
}

export interface LoanEligibilitySheetCardProps {
  recommendedBank?: RecommendedBankData | null;
  banks: BankEligibilityRow[];
  selectedBank?: string | null;
  onSelectBank?: (bankName: string, bankId?: string) => void;
}

export function LoanEligibilitySheetCard({
  recommendedBank,
  banks,
  selectedBank,
  onSelectBank,
}: LoanEligibilitySheetCardProps) {
  const [filter, setFilter] = useState<"all" | "eligible" | "ineligible">("all");

  const eligibleCount = banks.filter((b) => b.isEligible).length;
  const ineligibleCount = banks.filter((b) => !b.isEligible).length;

  const filteredBanks = banks.filter((b) => {
    if (filter === "eligible") return b.isEligible;
    if (filter === "ineligible") return !b.isEligible;
    return true;
  });

  const isRecSelected =
    Boolean(recommendedBank?.bankName && selectedBank && isSameBankName(recommendedBank.bankName, selectedBank));

  return (
    <div className="w-full my-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden font-sans transition-all">
      {/* Header Bar */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Loan Eligibility Sheet
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono">
                ({banks.length} Lenders Evaluated)
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified underwriting evaluation based on active partner policies and your profile
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              filter === "all"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            All ({banks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("eligible")}
            className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              filter === "eligible"
                ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-emerald-600"
            }`}
          >
            Eligible ({eligibleCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("ineligible")}
            className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              filter === "ineligible"
                ? "bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-400 shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-rose-600"
            }`}
          >
            Not Eligible ({ineligibleCount})
          </button>
        </div>
      </div>

      {/* 2. Highlighted Recommended Bank Card */}
      {recommendedBank && recommendedBank.isEligible ? (
        <div className="p-4 sm:p-5">
          <div className="relative overflow-hidden rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900/90 p-4 sm:p-5 shadow-xs transition hover:border-blue-500/50">
            {/* Top pill & badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-2xs">
                <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                <span>Recommended Bank</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {recommendedBank.status || "Eligible"}
              </span>
            </div>

            {/* Bank Name & Metrics Grid */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {recommendedBank.bankName}
                  </h4>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 mt-3">
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Estimated Eligible Amount
                    </span>
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">
                      {recommendedBank.amount || "Not available"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Interest Rate
                    </span>
                    <span className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400 font-mono">
                      {recommendedBank.roi || "Not available"}
                    </span>
                  </div>
                  {recommendedBank.tenure && (
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Supported Tenure
                      </span>
                      <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">
                        {recommendedBank.tenure}
                      </span>
                    </div>
                  )}
                </div>

                {/* Why Recommended Explanation */}
                {recommendedBank.reason && (
                  <div className="mt-3 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <strong className="text-blue-700 dark:text-blue-300 font-semibold">Why recommended: </strong>
                    <span>{recommendedBank.reason.replace(/^\*\*Why recommended\*\*:\s*/i, "")}</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="shrink-0 pt-2 lg:pt-0">
                {isRecSelected ? (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-default"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Selected</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectBank && onSelectBank(recommendedBank.bankName, recommendedBank.bankId)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <span>Select This Bank</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-4 sm:p-5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm mb-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>No Partner Banks Currently Eligible</span>
            </div>
            <p>
              Based on the verified parameters of your profile, no partner banks meet all policy criteria. Please review
              the bank-specific rejection reasons in the table below.
            </p>
          </div>
        </div>
      )}

      {/* 3. Comprehensive Eligibility Table */}
      <div className="px-4 sm:px-6 pb-5">
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <table className="min-w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 font-bold">
              <tr>
                <th scope="col" className="px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                  Bank Name
                </th>
                <th scope="col" className="px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                  Eligibility Status
                </th>
                <th scope="col" className="px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                  Eligible Loan Amount
                </th>
                <th scope="col" className="px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                  Interest Rate
                </th>
                <th scope="col" className="px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                  Tenure
                </th>
                <th scope="col" className="px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider min-w-[200px]">
                  Eligibility Reason
                </th>
                <th scope="col" className="px-3.5 py-3 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredBanks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                    No lenders match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredBanks.map((b, idx) => {
                  const isSelected = Boolean(selectedBank && isSameBankName(b.bankName, selectedBank));
                  const isTopRec = Boolean(
                    recommendedBank?.bankName && isSameBankName(b.bankName, recommendedBank.bankName)
                  );

                  return (
                    <tr
                      key={`row-${b.bankId || idx}-${b.bankName}`}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/40 font-medium"
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      {/* Bank Name */}
                      <td className="px-3.5 py-2.5 text-xs text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">{b.bankName}</span>
                          {isTopRec && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              <span>Top Choice</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Eligibility Status */}
                      <td className="px-3.5 py-2.5 text-xs whitespace-nowrap">
                        {b.status === "Eligible" || b.status === "ELIGIBLE" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300/50">
                            <CheckCircle2 className="w-3 h-3" />
                            Eligible
                          </span>
                        ) : b.status === "Needs Review" || b.status === "NEEDS_REVIEW" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300/50">
                            <AlertTriangle className="w-3 h-3" />
                            Needs Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300/50">
                            <XCircle className="w-3 h-3" />
                            Not Eligible
                          </span>
                        )}
                      </td>

                      {/* Eligible Loan Amount */}
                      <td className="px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                        {b.isEligible ? b.amount : "—"}
                      </td>

                      {/* Interest Rate */}
                      <td className="px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                        {b.isEligible ? b.roi : "—"}
                      </td>

                      {/* Tenure */}
                      <td className="px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                        {b.isEligible ? b.tenure : "—"}
                      </td>

                      {/* Eligibility Reason */}
                      <td className="px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-400 leading-snug">
                        {b.reason}
                      </td>

                      {/* Action Button */}
                      <td className="px-3.5 py-2.5 text-xs text-center whitespace-nowrap">
                        {b.isEligible ? (
                          isSelected ? (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-xs shadow-2xs cursor-default"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Selected</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectBank && onSelectBank(b.bankName, b.bankId)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium text-xs shadow-2xs transition-all cursor-pointer"
                            >
                              <span>Select</span>
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 text-xs font-medium cursor-not-allowed"
                          >
                            Disabled
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function isSameBankName(a: string, b: string): boolean {
  if (!a || !b) return false;
  const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanB = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
}
