import {
  CategoryCandidate,
  CompanyCategoryRecord,
  isCompanyCategoryLookupIntent,
  extractCompanyNameFromCategoryQuery,
  searchCategoryCandidates,
  getCompanyCategoryRecords,
  formatCompanyCategoryTable,
  formatCategoryCandidateOptions,
} from "@/lib/companySearch";
import {
  resolveBankName,
  SessionState,
  isLoanEligibilityIntent,
  saveEligibilityState,
} from "@/lib/dynamicEligibilityEngine";
import { AgentResult, CompanySelectionAction } from "@/lib/ai/agent";

export interface CompanyCategoryLookupParams {
  conversationId?: string;
  userMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  eligibilitySession: SessionState | null;
  companySelectionAction?: CompanySelectionAction;
  finalizeAndReturn: (
    res: AgentResult,
    customState?: Partial<SessionState>
  ) => Promise<AgentResult>;
}

/**
 * Checks if the user message indicates switching to the loan eligibility flow.
 */
function isLoanSwitchIntent(msg: string): boolean {
  if (isLoanEligibilityIntent(msg)) return true;
  const lower = msg.toLowerCase().trim();
  return (
    /(?:i\s*(?:need|want|require|wish|am\s*looking\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(lower) ||
    /(?:apply\s*(?:for)?\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(lower) ||
    /(?:can\s*i\s*(?:get|have|avail|take|apply\s*for)\s*(?:a\s*)?(?:personal\s*)?loan)/i.test(lower) ||
    /(?:check|evaluate|calculate|find\s*out)\s*(?:my\s*)?(?:personal\s*)?(?:loan\s*)?eligib/i.test(lower) ||
    /(?:calculate|check)\s+(?:my\s+)?loan\b/i.test(lower) ||
    /^(?:need|want)\s+(?:₹|rs\.?|inr\s*)?\d+(?:\s*(?:lakh|lakhs|l|k|crore))?\s*loan\b/i.test(lower)
  );
}

/**
 * Cleans conversational prefixes from company search queries.
 */
function sanitizeCompanySearchQuery(raw: string): string {
  let s = raw.trim();
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(
      /^(?:actually|wait|no|instead|search\s+for|search|check|lookup|look\s+up|find|my\s+company\s+is|it\s+is|company\s+name\s+is|change\s+to|switch\s+to)\s+/i,
      ""
    ).trim();
  }
  return s.replace(/[?.,!]+$/, "").trim();
}

/**
 * Displays the category table for a selected candidate and saves state.
 */
async function displayCategoryForSelectedCandidate(
  candidate: { id: string; name: string; canonicalName?: string },
  eligibilitySession: SessionState | null,
  finalizeAndReturn: (res: AgentResult, customState?: Partial<SessionState>) => Promise<AgentResult>
): Promise<AgentResult> {
  const compId = candidate.id;
  const compName = candidate.canonicalName || candidate.name;
  const records = await getCompanyCategoryRecords({
    companyId: compId,
    companyName: compName,
  });

  const table = formatCompanyCategoryTable(records);
  return await finalizeAndReturn({
    reply: table,
  }, {
    activeIntent: "COMPANY_CATEGORY_LOOKUP",
    selectedCompanyId: compId,
    selectedCompanyName: compName,
    candidateCompanies: eligibilitySession?.candidateCompanies || [candidate],
    searchQuery: eligibilitySession?.searchQuery || compName,
    awaitingCompanyName: false,
    awaitingCompanySelection: false,
    in_eligibility_flow: false,
  });
}

/**
 * Central State Machine for Company Category Lookup.
 * Enforces Steps 1-5 of the Company Category Lookup Flow.
 */
export async function handleCompanyCategoryLookupFlow(
  params: CompanyCategoryLookupParams
): Promise<AgentResult | null> {
  const {
    userMessage,
    eligibilitySession,
    companySelectionAction,
    finalizeAndReturn,
  } = params;

  const rawMsg = userMessage.trim();
  const lowerMsg = rawMsg.toLowerCase();

  const isCurrentCategorySession = eligibilitySession?.activeIntent === "COMPANY_CATEGORY_LOOKUP";
  const isCategoryQuery = isCompanyCategoryLookupIntent(rawMsg);

  // If neither an active category session nor a category query, pass through to normal agent pipeline
  if (!isCurrentCategorySession && !isCategoryQuery) {
    return null;
  }

  // -------------------------------------------------------------------------
  // Case L: User switches to Loan Eligibility from an active Category session
  // -------------------------------------------------------------------------
  if (isCurrentCategorySession && (isLoanSwitchIntent(rawMsg) || isLoanEligibilityIntent(rawMsg))) {
    // Retain selected company in applicant profile if user already selected one
    const preservedCompany = eligibilitySession?.selectedCompanyName || eligibilitySession?.company;
    const customUpdate: Partial<SessionState> = {
      activeIntent: "LOAN_ELIGIBILITY",
      activeFlow: "LOAN_ELIGIBILITY",
      in_eligibility_flow: true,
      awaitingCompanyName: false,
      awaitingCompanySelection: false,
    };
    if (preservedCompany) {
      customUpdate.selectedCompanyName = preservedCompany;
      customUpdate.company = preservedCompany;
      customUpdate.applicant = {
        ...(eligibilitySession?.applicant || {}),
        companyName: preservedCompany,
        loanType: "Personal Loan",
      };
    }
    if (eligibilitySession) {
      Object.assign(eligibilitySession, customUpdate);
    }
    if (params.conversationId) {
      await saveEligibilityState(params.conversationId, eligibilitySession || (customUpdate as any));
    }
    // Return null to let the agent pipeline process the loan request with updated state
    return null;
  }

  // -------------------------------------------------------------------------
  // Case I: Follow-up question for a specific bank after selecting a company
  // e.g. "What about HDFC Bank?", "How about ICICI Bank?"
  // -------------------------------------------------------------------------
  if (
    isCurrentCategorySession &&
    eligibilitySession?.selectedCompanyName &&
    !eligibilitySession?.awaitingCompanySelection &&
    !eligibilitySession?.awaitingCompanyName
  ) {
    const bankResolution = resolveBankName(rawMsg);
    const hasBankInquiry =
      Boolean(bankResolution) &&
      !isCategoryQuery &&
      (/\b(?:what\s+about|how\s+about|check|in|for|and|category)\b/i.test(lowerMsg) ||
        lowerMsg.includes(bankResolution!.bankName.toLowerCase()) ||
        lowerMsg === bankResolution!.bankName.toLowerCase());

    if (hasBankInquiry && bankResolution?.bankName) {
      const records = await getCompanyCategoryRecords({
        companyId: eligibilitySession.selectedCompanyId,
        companyName: eligibilitySession.selectedCompanyName,
        bankName: bankResolution.bankName,
      });

      if (records.length > 0) {
        const table = formatCompanyCategoryTable(records);
        return await finalizeAndReturn({
          reply: table,
        }, {
          activeIntent: "COMPANY_CATEGORY_LOOKUP",
          selectedCompanyId: eligibilitySession.selectedCompanyId,
          selectedCompanyName: eligibilitySession.selectedCompanyName,
          candidateCompanies: eligibilitySession.candidateCompanies,
          awaitingCompanyName: false,
          awaitingCompanySelection: false,
          in_eligibility_flow: false,
        });
      } else {
        return await finalizeAndReturn({
          reply: `The category for **${eligibilitySession.selectedCompanyName}** in **${bankResolution.bankName}** could not be found in our verified partner bank records.`,
        }, {
          activeIntent: "COMPANY_CATEGORY_LOOKUP",
          selectedCompanyId: eligibilitySession.selectedCompanyId,
          selectedCompanyName: eligibilitySession.selectedCompanyName,
          candidateCompanies: eligibilitySession.candidateCompanies,
          awaitingCompanyName: false,
          awaitingCompanySelection: false,
          in_eligibility_flow: false,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // STEP 3: Handle pending selection (awaitingCompanySelection)
  // Cases C, D, J
  // -------------------------------------------------------------------------
  if (
    isCurrentCategorySession &&
    eligibilitySession?.awaitingCompanySelection &&
    Array.isArray(eligibilitySession?.candidateCompanies) &&
    eligibilitySession.candidateCompanies.length > 0
  ) {
    const candidates = eligibilitySession.candidateCompanies;

    // A. Click Selection Action via UI button
    if (companySelectionAction?.type === "select") {
      const matched = candidates.find(
        (c) =>
          (companySelectionAction.companyId && String(c.id) === String(companySelectionAction.companyId)) ||
          (companySelectionAction.companyName &&
            c.name.toLowerCase() === companySelectionAction.companyName.toLowerCase())
      );
      if (matched) {
        return await displayCategoryForSelectedCandidate(matched, eligibilitySession, finalizeAndReturn);
      }
    }

    // B. Number Selection (e.g. "1", "option 2", "#1")
    const numMatch = rawMsg.match(/^(?:option\s+|#\s*)?(\d+)\.?$/i);
    if (numMatch) {
      const selectedIdx = parseInt(numMatch[1], 10);
      if (selectedIdx >= 1 && selectedIdx <= candidates.length) {
        const matched = candidates[selectedIdx - 1];
        return await displayCategoryForSelectedCandidate(matched, eligibilitySession, finalizeAndReturn);
      } else {
        // Case D: Invalid selection! Ask user to select a valid option
        return await finalizeAndReturn({
          reply: `Please select a valid option from the list above (1 to ${candidates.length}), or click on your company name.`,
        }, {
          activeIntent: "COMPANY_CATEGORY_LOOKUP",
          searchQuery: eligibilitySession.searchQuery,
          candidateCompanies: candidates,
          awaitingCompanyName: false,
          awaitingCompanySelection: true,
          in_eligibility_flow: false,
        });
      }
    }

    // C. Name Selection (User typed the displayed company name)
    const cleanTyped = rawMsg.replace(/^\d+\.\s*/, "").trim().toLowerCase();
    const nameMatches = candidates.filter((c) => {
      const cNorm = c.name.trim().toLowerCase().replace(/[.,;!?]+$/, "");
      const typedNorm = cleanTyped.replace(/[.,;!?]+$/, "");
      return cNorm === typedNorm;
    });

    if (nameMatches.length === 1) {
      return await displayCategoryForSelectedCandidate(nameMatches[0], eligibilitySession, finalizeAndReturn);
    } else if (nameMatches.length > 1) {
      return await finalizeAndReturn({
        reply: `I found multiple matching options for that name. Please reply with the option number (1 to ${candidates.length}) to confirm your exact company.`,
      }, {
        activeIntent: "COMPANY_CATEGORY_LOOKUP",
        searchQuery: eligibilitySession.searchQuery,
        candidateCompanies: candidates,
        awaitingCompanyName: false,
        awaitingCompanySelection: true,
        in_eligibility_flow: false,
      });
    }

    // D. Case J: User changes the company before selecting a previous result
    // e.g. User types "Wipro", "Check Infosys", "Search for Tata"
    let newCompQuery = sanitizeCompanySearchQuery(rawMsg);

    if (newCompQuery.length >= 2) {
      // Clear stale candidates and search for the new company
      const newCandidates = await searchCategoryCandidates(newCompQuery, 10);

      if (newCandidates.length === 0) {
        return await finalizeAndReturn({
          reply: `I couldn't find any matching company for **${newCompQuery}** in our verified partner bank records. Please check the spelling or provide the full registered company name.`,
        }, {
          activeIntent: "COMPANY_CATEGORY_LOOKUP",
          searchQuery: newCompQuery,
          candidateCompanies: [],
          awaitingCompanyName: true,
          awaitingCompanySelection: false,
          selectedCompanyId: undefined,
          selectedCompanyName: undefined,
          in_eligibility_flow: false,
        });
      } else if (newCandidates.length === 1) {
        // Case E: Single match
        return await displayCategoryForSelectedCandidate(newCandidates[0], eligibilitySession, finalizeAndReturn);
      } else {
        // Multiple matches
        const reply = formatCategoryCandidateOptions(newCandidates, newCompQuery);
        return await finalizeAndReturn({
          reply,
        }, {
          activeIntent: "COMPANY_CATEGORY_LOOKUP",
          searchQuery: newCompQuery,
          candidateCompanies: newCandidates,
          awaitingCompanyName: false,
          awaitingCompanySelection: true,
          selectedCompanyId: undefined,
          selectedCompanyName: undefined,
          in_eligibility_flow: false,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // STEP 2: Handle company name provided when awaitingCompanyName is true
  // Cases B, E, F
  // -------------------------------------------------------------------------
  if (isCurrentCategorySession && eligibilitySession?.awaitingCompanyName) {
    if (isLoanEligibilityIntent(rawMsg) || isLoanSwitchIntent(rawMsg)) {
      return null;
    }
    let cleanCompName = sanitizeCompanySearchQuery(rawMsg);

    const candidates = await searchCategoryCandidates(cleanCompName, 10);

    if (candidates.length === 0) {
      // Case F: 0 matches
      return await finalizeAndReturn({
        reply: `I couldn't find any matching company for **${cleanCompName}** in our verified partner bank records. Please check the spelling or provide the full registered company name.`,
      }, {
        activeIntent: "COMPANY_CATEGORY_LOOKUP",
        searchQuery: cleanCompName,
        candidateCompanies: [],
        awaitingCompanyName: true,
        awaitingCompanySelection: false,
        selectedCompanyId: undefined,
        selectedCompanyName: undefined,
        in_eligibility_flow: false,
      });
    } else if (candidates.length === 1) {
      // Case E: Exactly one reliable match
      return await displayCategoryForSelectedCandidate(candidates[0], eligibilitySession, finalizeAndReturn);
    } else {
      // Case B: Multiple matches
      const reply = formatCategoryCandidateOptions(candidates, cleanCompName);
      return await finalizeAndReturn({
        reply,
      }, {
        activeIntent: "COMPANY_CATEGORY_LOOKUP",
        searchQuery: cleanCompName,
        candidateCompanies: candidates,
        awaitingCompanyName: false,
        awaitingCompanySelection: true,
        selectedCompanyId: undefined,
        selectedCompanyName: undefined,
        in_eligibility_flow: false,
      });
    }
  }

  // -------------------------------------------------------------------------
  // STEP 1: Detect Intent & Initial Inquiry
  // Cases A, K
  // -------------------------------------------------------------------------
  if (isCategoryQuery) {
    const extractedCompany = extractCompanyNameFromCategoryQuery(rawMsg);

    if (!extractedCompany) {
      // Case A & K: Missing company name -> respond ONLY: "Sure! Please tell me your company name."
      return await finalizeAndReturn({
        reply: "Sure! Please tell me your company name.",
      }, {
        activeIntent: "COMPANY_CATEGORY_LOOKUP",
        searchQuery: undefined,
        candidateCompanies: [],
        awaitingCompanyName: true,
        awaitingCompanySelection: false,
        selectedCompanyId: undefined,
        selectedCompanyName: undefined,
        in_eligibility_flow: false,
      });
    } else {
      // User provided company name in the initial query (e.g. "What is Cognizant company category?")
      const candidates = await searchCategoryCandidates(extractedCompany, 10);

      if (candidates.length === 0) {
        // Case F
        return await finalizeAndReturn({
          reply: `I couldn't find any matching company for **${extractedCompany}** in our verified partner bank records. Please check the spelling or provide the full registered company name.`,
        }, {
          activeIntent: "COMPANY_CATEGORY_LOOKUP",
          searchQuery: extractedCompany,
          candidateCompanies: [],
          awaitingCompanyName: true,
          awaitingCompanySelection: false,
          selectedCompanyId: undefined,
          selectedCompanyName: undefined,
          in_eligibility_flow: false,
        });
      } else if (candidates.length === 1) {
        // Case E
        return await displayCategoryForSelectedCandidate(candidates[0], eligibilitySession, finalizeAndReturn);
      } else {
        // Case B
        const reply = formatCategoryCandidateOptions(candidates, extractedCompany);
        return await finalizeAndReturn({
          reply,
        }, {
          activeIntent: "COMPANY_CATEGORY_LOOKUP",
          searchQuery: extractedCompany,
          candidateCompanies: candidates,
          awaitingCompanyName: false,
          awaitingCompanySelection: true,
          selectedCompanyId: undefined,
          selectedCompanyName: undefined,
          in_eligibility_flow: false,
        });
      }
    }
  }

  return null;
}
