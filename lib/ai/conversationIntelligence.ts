// lib/ai/conversationIntelligence.ts
/**
 * CreditWise AI — Conversational Intelligence & State Management
 *
 * Enforces Constraint-Only Intent Preservation (Failure B):
 * - Detects constraint-only follow-up phrases like:
 *   "Use only verified personal loan master policy documents"
 * - Accurately inherits active prompt attributes (target lender, active parameter, loan product)
 *   from recent conversation history rather than wrongly triggering a new document-checklist intent.
 * - Prevents topic abandonment and ensures zero hallucination.
 */

import { resolveBankName } from "@/lib/dynamicEligibilityEngine";
import { resolvePolicyTarget, PolicyTarget } from "@/lib/policyRag";
import { LoanProductCategory, detectLoanCategory } from "./intentRouting";

export interface ConstraintDirectives {
  isConstraintOnly: boolean;
  enforceVerifiedOnly: boolean;
  loanCategory: LoanProductCategory;
  excludeDemoDocs: boolean;
  targetParameter?: string;
}

export interface ConversationContextResult {
  isConstraintOnlyFollowUp: boolean;
  inheritedFromPriorTurn: boolean;
  intent: "POLICY" | "AGENT_KNOWLEDGE" | "GENERAL";
  loanCategory: LoanProductCategory;
  detectedBank?: string;
  detectedBankId?: number;
  detectedPolicyFileId?: number;
  activeParameter?: string; // e.g. "salary", "cibil", "foir", "age", "tenure"
  effectiveQuery: string;
  constraintDirectives: ConstraintDirectives;
  reason: string;
}

/**
 * Regex matching meta-constraint phrases that instruct the system HOW to answer
 * rather than asking a new substantive question.
 */
const CONSTRAINT_ONLY_PATTERNS = [
  /^(?:please\s+)?(?:use|rely\s+on|refer\s+to|stick\s+to|consider|apply|enforce)?\s*(?:only|strictly|just)\s*(?:the\s*)?(?:verified|official|approved|active|master)?\s*(?:personal\s*loan\s*)?(?:policy|master\s*policy|rulebook|knowledge|bank)?\s*(?:documents?|files?|records?|sources?|data)\b/i,
  /^(?:please\s+)?(?:use|rely\s+on|refer\s+to|stick\s+to|consider)?\s*only\s*verified\b/i,
  /\b(?:verified|official)\s*(?:personal\s*loan\s*)?(?:master\s*policy|policy)\s*(?:documents?|files?)\s*only\b/i,
  /\buse\s+(?:only\s+)?verified\s+(?:personal\s*loan\s*)?(?:master\s*policy|policy)\s*documents?\b/i,
  /\bonly\s+use\s+verified\s+(?:personal\s*loan\s*)?(?:master\s*policy|policy)\s*documents?\b/i,
  /\bbased\s+(?:strictly\s+)?(?:only\s+)?on\s+verified\s+(?:master\s*)?polic(?:y|ies)\b/i,
  /\brely\s+only\s+on\s+verified\s+(?:master\s*)?polic(?:y|ies)\b/i,
];

/**
 * Checks whether a given message is a constraint-only follow-up modifier.
 */
export function isConstraintOnlyFollowUp(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // If user asks a brand new substantive question with question words, not constraint-only
  if (
    /^(?:what|when|where|why|how\s+much|how\s+many|can\s+i|is\s+there|who|which\s+bank\s+offers)\b/i.test(lower) &&
    !/\b(?:documents?\s*only|only\s*verified)\b/i.test(lower)
  ) {
    return false;
  }

  for (const pattern of CONSTRAINT_ONLY_PATTERNS) {
    if (pattern.test(raw)) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts constraint directives from input text.
 */
export function extractConstraintDirectives(text: string): ConstraintDirectives {
  const isConstraint = isConstraintOnlyFollowUp(text);
  const loanCategory = detectLoanCategory(text);
  const enforceVerifiedOnly = /\b(?:verified|master\s*policy|official|approved)\b/i.test(text);
  const excludeDemoDocs = !/\b(?:demo|sample|test\s*data|fictional)\b/i.test(text);

  let targetParameter: string | undefined = undefined;
  if (/\b(?:salary|nth|income|nmi|net\s*take\s*home)\b/i.test(text)) {
    targetParameter = "salary";
  } else if (/\b(?:cibil|credit\s*score)\b/i.test(text)) {
    targetParameter = "cibil";
  } else if (/\b(?:foir|multiplier|obligation)\b/i.test(text)) {
    targetParameter = "foir";
  } else if (/\b(?:age|vintage|experience)\b/i.test(text)) {
    targetParameter = "age";
  }

  return {
    isConstraintOnly: isConstraint,
    enforceVerifiedOnly,
    loanCategory,
    excludeDemoDocs,
    targetParameter,
  };
}

/**
 * Resolves conversational context across multi-turn interactions.
 * If the current message is a constraint modifier (Failure B), inherits active attributes
 * from prior turns to maintain query context and avoid spurious document-checklist routing.
 */
export async function resolveConversationalContext(
  query: string,
  history?: Array<{ role: string; content: string }>,
  currentState?: any
): Promise<ConversationContextResult> {
  const text = String(query || "").trim();
  const directives = extractConstraintDirectives(text);

  // Default non-constraint context
  const defaultResult: ConversationContextResult = {
    isConstraintOnlyFollowUp: false,
    inheritedFromPriorTurn: false,
    intent: "POLICY",
    loanCategory: directives.loanCategory,
    effectiveQuery: text,
    constraintDirectives: directives,
    reason: "Standard user query",
  };

  if (!directives.isConstraintOnly) {
    return defaultResult;
  }

  // If constraint-only follow-up, inspect history in reverse to inherit prompt attributes
  const priorTurns = history && Array.isArray(history) ? [...history] : [];
  let inheritedBank: string | undefined = undefined;
  let inheritedBankId: number | undefined = undefined;
  let inheritedPolicyFileId: number | undefined = undefined;
  let inheritedParameter: string | undefined = undefined;
  let inheritedQuery: string = text;

  // 1. Check current state first if available
  if (currentState?.bankName || currentState?.selectedBank) {
    inheritedBank = currentState.bankName || currentState.selectedBank;
  }
  if (currentState?.bankId) {
    inheritedBankId = Number(currentState.bankId);
  }
  if (currentState?.policyFileId) {
    inheritedPolicyFileId = Number(currentState.policyFileId);
  }

  // 2. Scan prior user messages to recover the substantive query and entity
  for (let i = priorTurns.length - 1; i >= 0; i--) {
    const turn = priorTurns[i];
    if (turn.role === "user") {
      const priorContent = turn.content.trim();
      if (!isConstraintOnlyFollowUp(priorContent)) {
        inheritedQuery = priorContent;

        // Extract parameter from prior question
        if (/\b(?:salary|nth|income|nmi|net\s*take\s*home|earn|pay)\b/i.test(priorContent)) {
          inheritedParameter = "salary";
        } else if (/\b(?:cibil|credit\s*score)\b/i.test(priorContent)) {
          inheritedParameter = "cibil";
        } else if (/\b(?:foir|multiplier|obligation)\b/i.test(priorContent)) {
          inheritedParameter = "foir";
        } else if (/\b(?:age|vintage|tenure)\b/i.test(priorContent)) {
          inheritedParameter = "age";
        }

        // Resolve lender target from prior question if not yet resolved
        if (!inheritedBank) {
          const resolved = await resolvePolicyTarget(priorContent);
          if (resolved) {
            inheritedBank = resolved.bankName;
            inheritedBankId = resolved.bankId;
            inheritedPolicyFileId = resolved.policyFileId;
          } else {
            const basicBank = resolveBankName(priorContent);
            if (basicBank?.bankName) {
              inheritedBank = basicBank.bankName;
            }
          }
        }
        break;
      }
    }
  }

  // If bank name known but not ID, resolve policy target
  if (inheritedBank && (!inheritedBankId || !inheritedPolicyFileId)) {
    const resolved = await resolvePolicyTarget(inheritedBank);
    if (resolved) {
      inheritedBank = resolved.bankName;
      inheritedBankId = resolved.bankId;
      inheritedPolicyFileId = resolved.policyFileId;
    }
  }

  return {
    isConstraintOnlyFollowUp: true,
    inheritedFromPriorTurn: true,
    intent: "POLICY",
    loanCategory: directives.loanCategory || "PERSONAL_LOAN",
    detectedBank: inheritedBank,
    detectedBankId: inheritedBankId,
    detectedPolicyFileId: inheritedPolicyFileId,
    activeParameter: inheritedParameter || directives.targetParameter || "salary",
    effectiveQuery: inheritedQuery,
    constraintDirectives: directives,
    reason: `Constraint-only follow-up inherited active attributes from prior question (Lender: ${inheritedBank || "None"}, Param: ${inheritedParameter || "general"}, Product: ${directives.loanCategory})`,
  };
}
