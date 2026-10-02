import {
  StructuredNluResult,
  EntityCorrection,
} from "./intentClassifier";
import {
  SessionState,
  TaskStackItem,
} from "../dynamicEligibilityEngine";

export type ResponseStrategy =
  | "ANSWER_ONLY"              // Side question answered, do not force resumption yet
  | "ANSWER_AND_RESUME"       // Answered an interruption question, append a friendly bridge to resume suspended task
  | "ANSWER_AND_ASK_NEXT"     // Processed an answer, ask for the next missing field in active workflow
  | "SWITCH_TOPIC"            // Seamlessly acknowledged abandoning previous topic and starting new topic
  | "CLARIFY"                 // Ambiguous input (e.g. 76) or validation failure, ask clarifying question
  | "ACKNOWLEDGE_CORRECTION"  // Acknowledge update ("Got it, updated your salary to ₹45,000"), then prompt next step
  | "WAIT_FOR_USER";          // Final results or terminal step presented, waiting for user's next directive

export interface PlannedResponse {
  strategy: ResponseStrategy;
  bridgeText?: string;
  combinedResponse: string;
}

/**
 * Returns a human-friendly label for applicant profile fields.
 */
export function getHumanFieldLabel(field: string): string {
  switch (field) {
    case "company":
    case "companyName":
      return "the exact name of your current employer / company";
    case "monthlyIncome":
      return "your net monthly take-home salary";
    case "loanAmount":
      return "your required loan amount";
    case "tenureMonths":
      return "your preferred loan tenure (e.g., 3 years or 5 years)";
    case "cibil":
    case "cibilScore":
      return "your CIBIL or credit score (or type 'not sure' if you haven't checked)";
    case "existingEmi":
      return "any existing monthly EMI payments (or 'none' if zero)";
    case "age":
      return "your age in years";
    default:
      return field;
  }
}

/**
 * Formats values into human currency or tenure text.
 */
export function formatFieldValue(field: string, value: any): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") {
    if (field === "monthlyIncome" || field === "loanAmount" || field === "existingEmi") {
      return `₹${value.toLocaleString("en-IN")}`;
    }
    if (field === "tenureMonths") {
      const years = Math.round(value / 12);
      return years > 0 ? `${years} year${years > 1 ? "s" : ""} (${value} months)` : `${value} months`;
    }
  }
  return String(value);
}

/**
 * Generates an empathetic and non-robotic bridge to resume an interrupted task.
 */
export function generateResumeBridge(
  suspendedTask?: TaskStackItem,
  expectedField?: string,
  questionTopic?: string
): string {
  // If the interruption is a general conceptual question (FOIR, CIBIL, EMI concept, etc.)
  // Behavioral Rule 1: Do NOT ask for salary/loan amount immediately after answering a conceptual question.
  // Smoothly append: "We can continue your loan eligibility check whenever you're ready. Would you like to proceed?"
  const isConceptualTopic =
    !questionTopic ||
    questionTopic === "concept" ||
    questionTopic === "foir" ||
    questionTopic === "cibil_concept" ||
    questionTopic === "cibil_impact" ||
    questionTopic === "CIBIL" ||
    questionTopic === "emi_concept" ||
    questionTopic === "EMI" ||
    /foir|concept|general|educational|financial_concept/i.test(questionTopic);

  const targetField = expectedField || suspendedTask?.expectedField;
  if (isConceptualTopic || !targetField) {
    return "\n\nWe can continue your loan eligibility check whenever you're ready. Would you like to proceed?";
  }

  const label = getHumanFieldLabel(targetField);
  const bridges = [
    `\n\nNow, picking up where we left off with your loan check: could you please share **${label}**?`,
    `\n\nWhenever you're ready to continue with your loan eligibility: what is **${label}**?`,
    `\n\nReturning to your personal loan options: could you please provide **${label}**?`,
  ];

  // Rotate bridge deterministically based on field length
  const index = targetField.length % bridges.length;
  return bridges[index];
}

/**
 * Generates an acknowledgement bridge for entity corrections.
 */
export function generateCorrectionBridge(
  corrections: EntityCorrection[],
  nextExpectedField?: string
): string {
  if (!corrections || corrections.length === 0) {
    return nextExpectedField
      ? `Got it. Could you please provide ${getHumanFieldLabel(nextExpectedField)}?`
      : "Understood, your details have been updated.";
  }

  const parts = corrections.map((c) => {
    const label = getHumanFieldLabel(c.field);
    const val = formatFieldValue(c.field, c.newValue);
    return `${label} to **${val}**`;
  });

  let text = `Got it! I have updated your ${parts.join(" and ")}.`;
  if (nextExpectedField) {
    text += `\n\nTo continue evaluating your eligible banks, could you please share **${getHumanFieldLabel(nextExpectedField)}**?`;
  }
  return text;
}

/**
 * Deterministically determines the response strategy and synthesizes contextual bridges.
 * ZERO LLM calls — 100% deterministic, instant, and predictable.
 */
export function planResponse(params: {
  nluResult: StructuredNluResult;
  session: SessionState;
  toolAnswer?: string;
  suspendedTask?: TaskStackItem;
  nextMissingField?: string;
}): PlannedResponse {
  const { nluResult, session, toolAnswer = "", suspendedTask, nextMissingField } = params;
  const action = nluResult.conversationAction;

  // 1. CLARIFICATION required (e.g. Ambiguous numbers like "76", or out-of-range values)
  if (nluResult.clarificationRequired?.isAmbiguous) {
    const prompt = nluResult.clarificationRequired.clarificationPrompt;
    return {
      strategy: "CLARIFY",
      bridgeText: prompt,
      combinedResponse: prompt,
    };
  }

  // 2. CORRECTION acknowledged
  if (action === "CORRECTION" && nluResult.corrections.length > 0) {
    const bridge = generateCorrectionBridge(nluResult.corrections, nextMissingField);
    return {
      strategy: "ACKNOWLEDGE_CORRECTION",
      bridgeText: bridge,
      combinedResponse: bridge,
    };
  }

  // 3. TOPIC SWITCH (e.g. Abandon loan and switch to EMI or Company search)
  if (action === "TOPIC_SWITCH") {
    let bridge = "";
    if (nluResult.mainUserGoal === "EMI_CALCULATION") {
      bridge = "Sure, let's look at the EMI calculation instead.";
    } else if (nluResult.mainUserGoal === "COMPANY_SEARCH") {
      bridge = "Sure, let's look up the company details.";
    } else {
      bridge = "Understood, let's switch to that.";
    }
    const combined = toolAnswer ? `${bridge}\n\n${toolAnswer}` : bridge;
    return {
      strategy: "SWITCH_TOPIC",
      bridgeText: bridge,
      combinedResponse: combined.trim(),
    };
  }

  // 4. TEMPORARY INTERRUPT (Side question asked during active flow)
  if (action === "TEMPORARY_INTERRUPT") {
    const activeTask = suspendedTask || (session.taskStack && session.taskStack.length > 0 ? session.taskStack[session.taskStack.length - 1] : undefined);
    const resumeBridge = generateResumeBridge(activeTask, nextMissingField || session.expectedField, nluResult.questionTopic);
    let combined = toolAnswer ? toolAnswer.trim() : "";
    if (
      combined &&
      (combined.includes(resumeBridge.trim()) ||
        combined.includes("provide your CIBIL score when you're ready") ||
        combined.includes("continue with your loan eligibility calculation") ||
        combined.includes("continue with your loan eligibility check"))
    ) {
      return {
        strategy: "ANSWER_AND_RESUME",
        bridgeText: resumeBridge,
        combinedResponse: combined,
      };
    }
    combined = toolAnswer ? `${toolAnswer}${resumeBridge}` : resumeBridge.trim();
    return {
      strategy: "ANSWER_AND_RESUME",
      bridgeText: resumeBridge,
      combinedResponse: combined,
    };
  }

  // 5. RESUME explicitly requested
  if (action === "RESUME") {
    const activeTask = suspendedTask || (session.taskStack && session.taskStack.length > 0 ? session.taskStack[session.taskStack.length - 1] : undefined);
    const resumeBridge = generateResumeBridge(activeTask, nextMissingField || session.expectedField, nluResult.questionTopic);
    const combined = `Welcome back!${resumeBridge}`;
    return {
      strategy: "ANSWER_AND_RESUME",
      bridgeText: resumeBridge,
      combinedResponse: combined,
    };
  }

  // 6. CONTINUING or answering next field in active flow
  if (nextMissingField && session.activeFlow === "LOAN_ELIGIBILITY") {
    const askNext = `Could you please share **${getHumanFieldLabel(nextMissingField)}**?`;
    const combined = toolAnswer ? `${toolAnswer}\n\n${askNext}` : askNext;
    return {
      strategy: "ANSWER_AND_ASK_NEXT",
      bridgeText: askNext,
      combinedResponse: combined.trim(),
    };
  }

  // 7. General answer
  let generalReply = toolAnswer || "How else can I assist you with your finances today?";
  if (
    toolAnswer &&
    !generalReply.includes("loan eligibility") &&
    !generalReply.includes("eligibility check") &&
    !generalReply.includes("eligibility calculation")
  ) {
    generalReply += "\n\nWe can continue your loan eligibility check whenever you're ready. Would you like to proceed?";
  }
  return {
    strategy: toolAnswer ? "ANSWER_ONLY" : "WAIT_FOR_USER",
    combinedResponse: generalReply,
  };
}
