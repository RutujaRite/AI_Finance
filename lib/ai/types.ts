/**
 * Unified AI Finance Agent Types & State Definitions
 * Implements standard interfaces for underwriting, routing, tool calling, and structured policies.
 */

export type AgentState =
  | "MULTI_BANK_ELIGIBILITY"
  | "SINGLE_BANK_POLICY"
  | "BANK_MANAGER_SEARCH"
  | "PROFILE_DATA_COLLECTION"
  | "GENERAL_FINANCE_FAQ"
  | "GREETING"
  | "COMPANY_SEARCH"
  | "COMPANY_DISAMBIGUATION";

export interface UnderwritingProfile {
  age?: number;
  monthlySalary?: number;
  existingEmi?: number;
  cibilScore?: number;
  companyName?: string;
  employmentType?: string; // "Salaried" | "Self-Employed" | "Student" | "Homemaker" | "Unemployed" | "Retired"
  loanAmount?: number;
  tenureMonths?: number;
  city?: string;
  pincode?: string;
  salaryPaymentMode?: string;
  workExperienceMonths?: number;
  currentExperienceMonths?: number;
}

export interface LenderEvaluation {
  lender: string;
  status: "Eligible" | "Review" | "Ineligible" | "Information Required";
  cibilRequired?: string | number;
  tenure?: string;
  estimatedEmi?: string | number;
  keyReason: string;
  maxLoanAmount?: number;
  roi?: string;
}

export interface EligibilityResult {
  eligibleLenders: LenderEvaluation[];
  reviewLenders: LenderEvaluation[];
  ineligibleLenders: LenderEvaluation[];
  moreInfoLenders: LenderEvaluation[];
  allEvaluations: LenderEvaluation[];
  formattedReport: string;
  profile: UnderwritingProfile;
}

export type PolicyLookupResult =
  | {
      found: true;
      value: string;
      lender: string;
      parameter: string;
      sourceFile?: string;
      metadata?: Record<string, any>;
    }
  | {
      found: false;
      message: "Not specified in the available policy.";
      lender?: string;
      parameter?: string;
    };

export interface ExtractedEntities {
  loanAmount?: number;
  tenureMonths?: number;
  monthlySalary?: number;
  existingEmi?: number;
  cibilScore?: number;
  age?: number;
  companyName?: string;
  employmentType?: string;
  city?: string;
  pincode?: string;
  targetBank?: string;
  queryParam?: string;
}

export interface AgentResponse {
  reply: string;
  state: AgentState;
  profile?: UnderwritingProfile;
  toolResult?: any;
  conversationId: string;
  sources?: any[];
  suggestions?: string[];
  metadata?: Record<string, any>;
}

export interface FlowControllerInput {
  sessionId: string;
  userMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  model?: string;
  currentTime?: string;
  systemPrompt?: string;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}
