// components/agent-studio/PlansSection.tsx
"use client";

import React, { useState } from "react";
import { UserSubscriptionState } from "@/lib/agent-studio/types";
import { PLAN_CONFIGS, PlanTier, COMPARISON_FEATURES } from "@/lib/agent-studio/planLimits";

interface PlansSectionProps {
  subscription: UserSubscriptionState;
  onPlanUpgraded: (newSub: UserSubscriptionState) => void;
  onToast: (msg: string, type?: "success" | "info") => void;
}

export default function PlansSection({
  subscription,
  onPlanUpgraded,
  onToast,
}: PlansSectionProps) {
  const [upgradingTier, setUpgradingTier] = useState<string | null>(null);

  async function handleUpgrade(tier: PlanTier) {
    if (subscription.plan === tier) return;

    try {
      setUpgradingTier(tier);
      const res = await fetch("/api/agents/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: tier }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onPlanUpgraded(data.subscription);
        onToast(
          `✓ Upgraded to ${tier.toUpperCase()} plan! You now have ${data.subscription.maxMessages} test messages and up to ${
            tier === "business" ? "unlimited" : data.subscription.maxAgents
          } agents.`,
          "success"
        );
      } else {
        onToast("Could not process demo upgrade.", "info");
      }
    } catch (err) {
      console.error("Upgrade error:", err);
      onToast("Demo upgrade network error.", "info");
    } finally {
      setUpgradingTier(null);
    }
  }

  const plans = Object.values(PLAN_CONFIGS);

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-16 animate-fadeIn">
      {/* Title & Subtitle */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
          Choose the right plan for your AI agents
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
          Start small, experiment freely, and upgrade when your AI assistant is ready.
        </p>
      </div>

      {/* THREE Clean Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {plans.map((plan) => {
          const isCurrent = subscription.plan === plan.id;
          const isPro = plan.id === "pro";
          const isBusiness = plan.id === "business";

          return (
            <div
              key={plan.id}
              className={`rounded-2xl bg-white p-6 transition flex flex-col justify-between relative border ${
                isPro
                  ? "border-indigo-300/80 shadow-md ring-1 ring-indigo-500/10"
                  : "border-slate-200/80 shadow-xs hover:border-slate-300"
              }`}
            >
              {/* Most popular badge */}
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                    Most Popular
                  </span>
                </div>
              )}

              <div>
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[32px]">
                    {plan.tagline}
                  </p>
                </div>

                <div className="mb-6 pb-6 border-b border-slate-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                      {plan.priceDisplay}
                    </span>
                    <span className="text-xs text-slate-400">
                      {plan.priceSubtext}
                    </span>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2.5 mb-8">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                      <i className="bi bi-check2 text-emerald-500 font-bold shrink-0 text-sm mt-[-1px]" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500 cursor-default border border-slate-200/80"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id as PlanTier)}
                    disabled={Boolean(upgradingTier)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition shadow-xs hover:shadow ${
                      isPro
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : "bg-white hover:bg-slate-50 text-slate-800 border border-slate-200"
                    } disabled:opacity-50`}
                  >
                    {upgradingTier === plan.id
                      ? "Upgrading..."
                      : isPro
                      ? "Upgrade to Pro"
                      : isBusiness
                      ? "Choose Business"
                      : "Downgrade to Basic"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan Comparison Table (Compact) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Plan Comparison
          </h3>
          <p className="text-xs text-slate-500">
            Compare resource limits and capabilities across all plans.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Feature</th>
                <th className="py-2.5 px-3">Basic</th>
                <th className="py-2.5 px-3 text-indigo-700 font-bold">Pro</th>
                <th className="py-2.5 px-3">Business</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {COMPARISON_FEATURES.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-800">{row.feature}</td>
                  <td className="py-2.5 px-3 text-slate-600">{row.basic}</td>
                  <td className="py-2.5 px-3 font-semibold text-indigo-600">{row.pro}</td>
                  <td className="py-2.5 px-3 text-slate-800 font-medium">{row.business}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
