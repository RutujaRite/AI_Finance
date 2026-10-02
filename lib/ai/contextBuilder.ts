// lib/ai/contextBuilder.ts
/**
 * CreditWise AI Conversational Context & State Ownership Layer (Phase 1)
 *
 * Responsibilities:
 * 1. Define explicit state ownership across Conversation, Applicant, and Task levels.
 * 2. Provide a single authoritative read path: getConversationContext(conversationId).
 * 3. Provide a single authoritative update path: updateConversationState(conversationId, params).
 * 4. Ensure non-destructive safe state merging (partial updates do not wipe existing attributes).
 * 5. Enforce strict session isolation and clean new-session initialization.
 * 6. Maintain 100% backward compatibility with existing SessionState and dynamicEligibilityEngine.
 */

import pool from "../db";
import {
  ApplicantProfile,
  SessionState,
  TaskStackItem,
  getEligibilityState,
  saveEligibilityState,
  clearEligibilityState,
  getConversationHistoryMessages,
  getRequiredPolicyFields,
  pushTaskToStack,
  popTaskFromStack,
  peekActiveTask,
} from "../dynamicEligibilityEngine";

/* ============================================================================
 * 1. STATE OWNERSHIP DEFINITIONS
 * ============================================================================ */

/**
 * Task-level state: Ephemeral parameters and progress for the active workflow.
 */
export interface TaskState {
  taskType:
    | "LOAN_ELIGIBILITY"
    | "COMPANY_SEARCH"
    | "EMI_CALCULATOR"
    | "BANK_MANAGER_SEARCH"
    | "BANK_POLICY"
    | "GENERAL"
    | string;
  status: "IN_PROGRESS" | "WAITING_USER_INPUT" | "COMPLETED" | "PAUSED";
  expectedField?: string;
  missingFields?: string[];
  collectedEntities?: Record<string, any>;
  selectedEntity?: string;
  taskData?: Record<string, any>;
  updatedAt: number;
}

/**
 * Conversation-level metadata.
 */
export interface ConversationMetadata {
  conversationId: string;
  summary: string;
  currentTopic: string;
  mainUserGoal: string;
  updatedAt: number;
}

/**
 * Unified Conversation Context returned by getConversationContext().
 */
export interface ConversationContext {
  conversationId: string;
  state: SessionState;
  applicant: ApplicantProfile;
  activeTask: TaskState | null;
  taskStack: TaskStackItem[];
  recentMessages: Array<{ role: string; content: string }>;
  summary: string;
  currentTopic: string;
  mainUserGoal: string;
  isNewSession: boolean;

  // Query helpers
  getKnownFields(): Array<{ field: keyof ApplicantProfile; value: any }>;
  getMissingFields(): string[];
  hasInterruptedTask(): boolean;
  getInterruptedTask(): TaskStackItem | undefined;
}

/**
 * Parameters for atomic, safe state updates.
 */
export interface StateUpdateParams {
  applicantUpdates?: Partial<ApplicantProfile>;
  taskUpdates?: Partial<TaskState>;
  conversationUpdates?: {
    summary?: string;
    currentTopic?: string;
    mainUserGoal?: string;
  };
  directSessionUpdates?: Partial<SessionState>;
}

/* ============================================================================
 * 2. HELPER FUNCTIONS
 * ============================================================================ */

/**
 * Safely merges applicant profile updates into an existing profile.
 * Guarantees that defined existing attributes are preserved when only a subset
 * of fields are updated (e.g. updating salary preserves company and CIBIL).
 */
export function safeMergeApplicantProfile(
  existing: ApplicantProfile = {},
  updates: Partial<ApplicantProfile> = {}
): ApplicantProfile {
  const merged: ApplicantProfile = {
    loanType: existing.loanType || updates.loanType || "Personal Loan",
    ...existing,
  };

  for (const [key, val] of Object.entries(updates)) {
    // Only update if value is explicitly defined
    if (val !== undefined && val !== null) {
      if (typeof val === "string" && val.trim() === "" && key !== "companyName") {
        // Do not overwrite with empty strings for non-string fields
        continue;
      }
      (merged as any)[key] = val;
    }
  }

  return merged;
}

/**
 * Creates a clean default SessionState scoped strictly to a conversationId.
 */
export function createDefaultSessionState(conversationId: string): SessionState {
  return {
    applicant: {
      loanType: "Personal Loan",
    },
    loanType: "Personal Loan",
    taskStack: [],
    in_eligibility_flow: false,
    activeFlow: "IDLE",
    currentTopic: "GENERAL",
    mainUserGoal: "UNKNOWN",
    summary: "",
    updatedAt: Date.now(),
  };
}

/**
 * Synchronizes legacy SessionState fields with TaskState for backward compatibility.
 */
export function syncTaskToLegacySession(session: SessionState, task: TaskState): void {
  session.activeFlow = task.taskType;
  if (task.expectedField) {
    session.expectedField = task.expectedField;
  }
  if (task.missingFields) {
    session.missingFields = task.missingFields;
  }
  if (task.taskType === "LOAN_ELIGIBILITY") {
    session.in_eligibility_flow = task.status === "IN_PROGRESS" || task.status === "WAITING_USER_INPUT";
  }
  if (task.selectedEntity) {
    if (task.taskType === "BANK_POLICY" || task.taskType === "BANK_MANAGER_SEARCH") {
      session.selectedBank = task.selectedEntity;
    } else if (task.taskType === "COMPANY_SEARCH") {
      session.selectedCompanyName = task.selectedEntity;
    }
  }
  if (task.taskData) {
    if (task.taskData.city) session.city = task.taskData.city;
    if (task.taskData.branch) session.branch = task.taskData.branch;
  }
}

/* ============================================================================
 * 3. SINGLE AUTHORITATIVE READ PATH
 * ============================================================================ */

/**
 * Retrieves the unified conversation context for a conversation.
 * Combines persistent database state, in-memory cache, and message history into
 * a single authoritative context object.
 */
export async function getConversationContext(
  conversationId: string,
  options?: {
    conversationHistory?: Array<{ role: string; content: string }>;
    userMessage?: string;
  }
): Promise<ConversationContext> {
  const cleanId = String(conversationId || "").trim();
  let state = await getEligibilityState(cleanId);
  const isNew = !state;

  if (!state) {
    state = createDefaultSessionState(cleanId);
  }

  // Ensure applicant object exists
  if (!state.applicant) {
    state.applicant = { loanType: state.loanType || "Personal Loan" };
  }
  if (!state.taskStack) {
    state.taskStack = [];
  }

  // Derive active task if not explicitly stored
  let activeTask: TaskState | null = state.activeTask || null;
  if (
    !activeTask &&
    ((state.activeFlow && state.activeFlow !== "IDLE") || state.expectedField || state.in_eligibility_flow)
  ) {
    activeTask = {
      taskType: state.activeFlow || (state.in_eligibility_flow ? "LOAN_ELIGIBILITY" : "GENERAL"),
      status: state.expectedField ? "WAITING_USER_INPUT" : "IN_PROGRESS",
      expectedField: state.expectedField,
      missingFields: state.missingFields,
      selectedEntity: state.selectedBank || state.selectedCompanyName,
      taskData: {
        city: state.city,
        branch: state.branch,
        location: state.location,
      },
      updatedAt: state.updatedAt || Date.now(),
    };
  }

  // Resolve message history
  let recentMessages: Array<{ role: string; content: string }> = [];
  if (options?.conversationHistory && Array.isArray(options.conversationHistory)) {
    recentMessages = options.conversationHistory;
  } else if (cleanId && cleanId !== "0" && !isNaN(Number(cleanId))) {
    recentMessages = await getConversationHistoryMessages(cleanId);
  }

  // Build context object
  const context: ConversationContext = {
    conversationId: cleanId,
    state,
    applicant: state.applicant,
    activeTask,
    taskStack: state.taskStack,
    recentMessages,
    summary: state.summary || "",
    currentTopic: state.currentTopic || state.activeTopic || "GENERAL",
    mainUserGoal: state.mainUserGoal || "UNKNOWN",
    isNewSession: isNew && recentMessages.length === 0,

    getKnownFields(): Array<{ field: keyof ApplicantProfile; value: any }> {
      const known: Array<{ field: keyof ApplicantProfile; value: any }> = [];
      const app = state.applicant;
      if (!app) return known;

      const keys: Array<keyof ApplicantProfile> = [
        "companyName",
        "monthlyIncome",
        "loanAmount",
        "tenureMonths",
        "cibil",
        "existingEmi",
        "age",
        "employmentType",
        "location",
      ];

      for (const k of keys) {
        if (app[k] !== undefined && app[k] !== null && String(app[k]).trim() !== "") {
          known.push({ field: k, value: app[k] });
        }
      }
      return known;
    },

    getMissingFields(): string[] {
      return getRequiredPolicyFields(state.applicant);
    },

    hasInterruptedTask(): boolean {
      return Array.isArray(state.taskStack) && state.taskStack.length > 0;
    },

    getInterruptedTask(): TaskStackItem | undefined {
      return peekActiveTask(state);
    },
  };

  return context;
}

/* ============================================================================
 * 4. SINGLE AUTHORITATIVE UPDATE PATH
 * ============================================================================ */

/**
 * Updates conversation state with atomic, safe merging and persists to storage.
 * Guarantees that existing valid attributes are NOT accidentally wiped out.
 */
export async function updateConversationState(
  conversationId: string,
  params: StateUpdateParams
): Promise<SessionState> {
  const cleanId = String(conversationId || "").trim();
  if (!cleanId || cleanId === "undefined" || cleanId === "null" || cleanId === "0") {
    throw new Error(`Invalid conversationId provided to updateConversationState: "${conversationId}"`);
  }

  // 1. Fetch current state or initialize clean state
  let current = await getEligibilityState(cleanId);
  if (!current) {
    current = createDefaultSessionState(cleanId);
  }

  // 2. Safe-merge Applicant Profile updates
  if (params.applicantUpdates) {
    current.applicant = safeMergeApplicantProfile(current.applicant, params.applicantUpdates);
    // Keep missing fields evaluated
    current.missingFields = getRequiredPolicyFields(current.applicant);
  }

  // 3. Update Task State
  if (params.taskUpdates) {
    const updatedTask: TaskState = {
      taskType: params.taskUpdates.taskType || current.activeTask?.taskType || current.activeFlow || "GENERAL",
      status: params.taskUpdates.status || current.activeTask?.status || "IN_PROGRESS",
      expectedField: params.taskUpdates.expectedField !== undefined ? params.taskUpdates.expectedField : current.activeTask?.expectedField,
      missingFields: params.taskUpdates.missingFields || current.activeTask?.missingFields || current.missingFields,
      collectedEntities: {
        ...(current.activeTask?.collectedEntities || {}),
        ...(params.taskUpdates.collectedEntities || {}),
      },
      selectedEntity: params.taskUpdates.selectedEntity !== undefined ? params.taskUpdates.selectedEntity : current.activeTask?.selectedEntity,
      taskData: {
        ...(current.activeTask?.taskData || {}),
        ...(params.taskUpdates.taskData || {}),
      },
      updatedAt: Date.now(),
    };

    current.activeTask = updatedTask;
    syncTaskToLegacySession(current, updatedTask);
  }

  // 4. Update Conversation-level metadata
  if (params.conversationUpdates) {
    if (params.conversationUpdates.summary !== undefined) {
      current.summary = params.conversationUpdates.summary;
    }
    if (params.conversationUpdates.currentTopic !== undefined) {
      current.currentTopic = params.conversationUpdates.currentTopic;
      current.activeTopic = params.conversationUpdates.currentTopic;
    }
    if (params.conversationUpdates.mainUserGoal !== undefined) {
      current.mainUserGoal = params.conversationUpdates.mainUserGoal;
    }
  }

  // 5. Apply direct SessionState updates if provided (for backward compatibility)
  if (params.directSessionUpdates) {
    Object.assign(current, params.directSessionUpdates);
  }

  // 6. Set timestamp & persist
  current.updatedAt = Date.now();
  await saveEligibilityState(cleanId, current);

  return current;
}

/**
 * Resets a conversation's state completely (used for New Chat or explicit reset).
 */
export async function resetConversationState(conversationId: string): Promise<void> {
  const cleanId = String(conversationId || "").trim();
  if (!cleanId || cleanId === "undefined" || cleanId === "null" || cleanId === "0") {
    return;
  }
  await clearEligibilityState(cleanId);
}

/**
 * Pushes the current active task onto the conversation's task stack for interruption.
 */
export async function suspendActiveTask(
  conversationId: string,
  description: string
): Promise<SessionState> {
  const cleanId = String(conversationId || "").trim();
  const state = (await getEligibilityState(cleanId)) || createDefaultSessionState(cleanId);

  if (state.activeTask) {
    const stackItem: TaskStackItem = {
      taskType: state.activeTask.taskType,
      expectedField: state.activeTask.expectedField,
      missingFields: state.activeTask.missingFields,
      applicantSnapshot: { ...state.applicant },
      selectedBank: state.selectedBank || state.activeTask.selectedEntity,
      city: state.city || state.activeTask.taskData?.city,
      timestamp: Date.now(),
      description,
    };
    pushTaskToStack(state, stackItem);
    state.activeTask = undefined;
    state.expectedField = undefined;
    state.updatedAt = Date.now();
    await saveEligibilityState(cleanId, state);
  }

  return state;
}

/**
 * Resumes the most recently suspended task from the conversation's task stack.
 */
export async function resumeInterruptedTask(
  conversationId: string
): Promise<{ state: SessionState; resumedTask?: TaskStackItem }> {
  const cleanId = String(conversationId || "").trim();
  const state = (await getEligibilityState(cleanId)) || createDefaultSessionState(cleanId);
  const resumedTask = popTaskFromStack(state);

  if (resumedTask) {
    state.activeTask = {
      taskType: resumedTask.taskType,
      status: "IN_PROGRESS",
      expectedField: resumedTask.expectedField,
      missingFields: resumedTask.missingFields,
      selectedEntity: resumedTask.selectedBank,
      taskData: { city: resumedTask.city },
      updatedAt: Date.now(),
    };
    syncTaskToLegacySession(state, state.activeTask);
    state.updatedAt = Date.now();
    await saveEligibilityState(cleanId, state);
  }

  return { state, resumedTask };
}
