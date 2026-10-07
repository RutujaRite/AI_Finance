// lib/agent-studio/planLimits.ts
/**
 * Centralized Plan Configuration for AI Agent Studio
 * Single source of truth for plan limits, pricing, and feature comparison.
 */

export type PlanTier = "basic" | "pro" | "business";

export interface PlanLimits {
  agents: number; // Basic: 1, Pro: 5, Business: Infinity
  testMessages: number; // Basic: 10, Pro: 500, Business: 5000
  knowledgeFiles: number; // Basic: 1, Pro: 10, Business: Infinity
}

export interface PlanConfig {
  id: PlanTier;
  name: string;
  priceINR: number;
  period: string;
  badge?: string;
  subtitle: string;
  limits: PlanLimits;
  features: string[];
  ctaText: string;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  basic: {
    id: "basic",
    name: "Basic",
    priceINR: 0,
    period: "month",
    subtitle: "For trying AI Agent Studio",
    limits: {
      agents: 1,
      testMessages: 10,
      knowledgeFiles: 1,
    },
    features: [
      "1 AI Agent",
      "10 test messages",
      "1 knowledge file",
      "Basic agent customization",
      "Basic qualification",
      "Basic capabilities",
      "PDF knowledge",
    ],
    ctaText: "Current Plan",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceINR: 1499,
    period: "month",
    badge: "MOST POPULAR",
    subtitle: "For growing AI assistants",
    limits: {
      agents: 5,
      testMessages: 500,
      knowledgeFiles: 10,
    },
    features: [
      "Up to 5 AI Agents",
      "500 test messages / month",
      "Up to 10 knowledge files",
      "Advanced agent customization",
      "Lead qualification",
      "Document collection",
      "Conversation history",
      "Analytics",
      "Advanced capabilities",
    ],
    ctaText: "Upgrade to Pro",
  },
  business: {
    id: "business",
    name: "Business",
    priceINR: 4999,
    period: "month",
    subtitle: "For teams and businesses",
    limits: {
      agents: Infinity,
      testMessages: 5000,
      knowledgeFiles: Infinity,
    },
    features: [
      "Unlimited AI Agents",
      "5,000 test messages / month",
      "Unlimited knowledge files",
      "Advanced qualification",
      "Advanced document collection",
      "Advanced tools & actions",
      "Analytics",
      "Team members",
      "Role-based access",
      "Custom branding",
      "Priority support",
    ],
    ctaText: "Choose Business",
  },
};

export interface PlanComparisonRow {
  feature: string;
  basic: string;
  pro: string;
  business: string;
}

export const PLAN_COMPARISON_TABLE: PlanComparisonRow[] = [
  { feature: "AI Agents", basic: "1", pro: "5", business: "Unlimited" },
  { feature: "Test Messages", basic: "10", pro: "500", business: "5,000" },
  { feature: "Knowledge Files", basic: "1", pro: "10", business: "Unlimited" },
  { feature: "Qualification", basic: "Basic", pro: "Advanced", business: "Advanced" },
  { feature: "Documents", basic: "Basic", pro: "✓", business: "✓" },
  { feature: "Analytics", basic: "—", pro: "✓", business: "✓" },
  { feature: "Team Members", basic: "—", pro: "—", business: "✓" },
  { feature: "Custom Branding", basic: "—", pro: "—", business: "✓" },
];

export const COMPARISON_FEATURES = PLAN_COMPARISON_TABLE;

export function getPlanConfig(plan: PlanTier = "basic"): PlanConfig {
  return PLAN_CONFIGS[plan] || PLAN_CONFIGS.basic;
}

export function formatLimit(val: number): string {
  if (!isFinite(val) || val === Infinity) return "Unlimited";
  return val.toLocaleString("en-IN");
}
