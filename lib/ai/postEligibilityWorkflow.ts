import {
  BankManagerRecord,
  lookupPostEligibilityBankManager,
  formatPostEligibilityManagerDetails,
  findBankBranches,
  getUniqueBranches,
  formatBankManagersTable,
} from "@/lib/bankSearch";
import {
  isSameBank,
  resolveBankName,
  resolvePincodeToCity,
  isValidIndianPincode,
  isLocationInput,
  isPureGreeting,
  extractBankBranchLocationParams,
  reconcileBankManagerEntities,
  extractProfileUpdates,
  applyProfileUpdateAndRecalculate,
  saveEligibilityState,
  SessionState,
} from "@/lib/dynamicEligibilityEngine";
import { AgentResult } from "@/lib/ai/agent";

export interface PostEligibilityHandlerParams {
  conversationId?: string;
  userMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  eligibilitySession: any;
  currentApplicant: any;
  requestedModel?: string;
  bankSelectionAction?: { bankId?: string; bankName: string };
  finalizeAndReturn: (
    res: AgentResult,
    customState?: Partial<SessionState>
  ) => Promise<AgentResult>;
}

const SUPPORTED_PARTNER_BANKS = [
  "HDFC Bank",
  "ICICI Bank",
  "IDFC FIRST Bank",
  "Kotak Mahindra Bank",
  "Axis Bank",
  "Axis Finance",
  "Bajaj Finserv",
  "Bajaj Markets",
  "Bandhan Bank",
  "Cholamandalam Investment & Finance",
  "Finnable Credit",
  "Fibe (EarlySalary)",
  "IndusInd Bank",
  "L&T Finance",
  "Piramal Finance",
  "Poonawalla Fincorp",
  "SBM Bank India",
  "SMFG India Credit",
  "TATA Capital",
  "Utkarsh Small Finance Bank",
  "Yes Bank",
];

function detectPartnerBankInText(text: string): string | null {
  const norm = text.trim();
  for (const b of SUPPORTED_PARTNER_BANKS) {
    if (isSameBank(norm, b)) return b;
  }
  const lower = norm.toLowerCase();
  for (const b of SUPPORTED_PARTNER_BANKS) {
    const bLower = b.toLowerCase();
    if (lower.includes(bLower)) return b;
    const short = bLower.replace(/\s+(?:bank|finance|capital|credit|investment.*|fincorp|markets|finserv)/gi, "").trim();
    if (short.length >= 3 && new RegExp(`\\b${short}\\b`, "i").test(lower)) {
      if (short === "axis" && /axis\s+finance/i.test(lower)) return "Axis Finance";
      if (short === "bajaj" && /bajaj\s+markets/i.test(lower)) return "Bajaj Markets";
      return b;
    }
  }
  return null;
}

/**
 * Deterministic Post-Eligibility Bank Selection & Bank Manager Lookup Workflow Engine.
 * Handles Steps 1-9 without letting generic intent classifiers or search engines hijack the flow.
 */
export async function handlePostEligibilityWorkflow({
  conversationId,
  userMessage,
  conversationHistory = [],
  eligibilitySession,
  currentApplicant,
  requestedModel,
  bankSelectionAction,
  finalizeAndReturn,
}: PostEligibilityHandlerParams): Promise<AgentResult | null> {
  const isPostEligibilityActive = Boolean(
    Boolean(bankSelectionAction) ||
    eligibilitySession?.hasCompletedEvaluation ||
    eligibilitySession?.evaluationCompleted ||
    (eligibilitySession?.postEligibilityStage &&
      eligibilitySession.postEligibilityStage !== "ELIGIBILITY_COMPLETED" &&
      eligibilitySession.postEligibilityStage !== "ELIGIBILITY_CONFIRMED") ||
    eligibilitySession?.currentStep === "BANK_SELECTION" ||
    eligibilitySession?.currentStep === "CITY_COLLECTION" ||
    eligibilitySession?.currentStep === "BRANCH_SELECTION" ||
    eligibilitySession?.currentStep === "BANK_MANAGER_RESULTS" ||
    eligibilitySession?.currentStep === "AWAITING_BRANCH_LOCATION" ||
    eligibilitySession?.currentStep === "AWAITING_PIN_CODE" ||
    eligibilitySession?.expectedField === "selectedBank" ||
    eligibilitySession?.expectedField === "city" ||
    eligibilitySession?.expectedField === "cityOrPincode" ||
    eligibilitySession?.expectedField === "branchSelection" ||
    eligibilitySession?.expectedEntity === "branchSelection" ||
    eligibilitySession?.expectedEntity === "selectedBank" ||
    eligibilitySession?.expectedEntity === "city"
  );

  if (!isPostEligibilityActive) {
    return null;
  }

  const trimmedMsg = userMessage.trim();
  const lowerMsg = trimmedMsg.toLowerCase();

  // =========================================================================
  // SCENARIO 15 & RULE 6: PROFILE RECALCULATION REQUEST
  // Only trigger when the message explicitly targets updating an applicant parameter
  // =========================================================================
  const isExplicitRecalc = Boolean(
    /^(?:update|change|recalculate|modify|set)\s+(?:my\s+)?(?:salary|income|cibil|tenure|loan|amount|age|emi)\b/i.test(trimmedMsg) ||
    /\b(?:salary\s*is|cibil\s*is|tenure\s*is)\s+\d+/i.test(trimmedMsg) ||
    /\b(?:my\s+salary\s+is|my\s+cibil\s+is)\b/i.test(trimmedMsg) ||
    /\b(?:what\s+if|suppose)\s+(?:my\s+)?(?:salary|cibil|income)\b/i.test(trimmedMsg)
  );

  if (isExplicitRecalc) {
    const profileUpdates = extractProfileUpdates(userMessage);
    if (profileUpdates && Object.keys(profileUpdates).length > 0) {
      const recalcRes = await applyProfileUpdateAndRecalculate(
        conversationId || "default_conv",
        userMessage,
        currentApplicant,
        profileUpdates,
        requestedModel
      );
      return await finalizeAndReturn({
        reply: recalcRes.reply,
        companyData: recalcRes.evalResult?.companyMatch?.isFound
          ? {
              company_name:
                recalcRes.evalResult.companyMatch.matchedName ||
                recalcRes.evalResult.companyMatch.searchedName,
              category: recalcRes.evalResult.companyMatch.bankCategories,
              needs_disambiguation: false,
            }
          : undefined,
      });
    }
  }

  // =========================================================================
  // SCENARIO 14 & STEP 8: PLEASANTRIES (THANK YOU, HELLO) DO NOT RESTART FLOW
  // =========================================================================
  const isThanks =
    /^(?:thanks?|thank\s*you(?:\s*so\s*much|\s*a\s*lot)?|thx|much\s*obliged)\b/i.test(
      trimmedMsg.replace(/[!.]+$/, "")
    );
  if (isThanks) {
    const activeBank =
      eligibilitySession?.selectedBank ||
      eligibilitySession?.chosenBank ||
      eligibilitySession?.topBank;
    const reply = activeBank
      ? `You're very welcome! If you would like to explore another branch or have any further questions about your loan application with **${activeBank}**, I'm here to help.`
      : `You're very welcome! If you would like to proceed with one of your eligible partner banks or have any questions, I'm here to help.`;
    return await finalizeAndReturn({ reply });
  }

  const isGreeting =
    (isPureGreeting(userMessage) ||
      /^(?:hello|hi|hey|good\s*(?:morning|afternoon|evening)|namaste)\b/i.test(trimmedMsg)) &&
    !SUPPORTED_PARTNER_BANKS.some((b) => isSameBank(trimmedMsg, b));

  if (isGreeting) {
    const activeBank =
      eligibilitySession?.selectedBank ||
      eligibilitySession?.chosenBank ||
      eligibilitySession?.topBank;
    const reply = activeBank
      ? `Hello! We've already completed your eligibility evaluation. You've selected **${activeBank}**. Which city or branch area would you like to visit?`
      : `Hello! We've already completed your loan eligibility evaluation. Which bank from your eligible list would you like to proceed with?`;
    return await finalizeAndReturn({ reply });
  }

  const eligibleBanks: string[] = eligibilitySession?.eligible_banks || [];
  const topBank: string = eligibilitySession?.topBank || (eligibleBanks.length > 0 ? eligibleBanks[0] : "");

  // =========================================================================
  // STEP 2 & 3: USER SELECTS "SELECT ANOTHER BANK"
  // =========================================================================
  const isSelectAnotherBank =
    /^(?:i\s+want\s+to\s+select\s+another\s+bank|select\s+another\s+bank|choose\s+another\s+bank|other\s+banks|show\s+alternatives|different\s+bank)\b/i.test(
      trimmedMsg
    );

  if (isSelectAnotherBank) {
    const currentBank = eligibilitySession?.selectedBank || eligibilitySession?.chosenBank;
    const alternatives = eligibleBanks.filter((b) => !currentBank || !isSameBank(b, currentBank));
    const listToShow = alternatives.length > 0 ? alternatives : eligibleBanks;
    const formattedList = listToShow.map((b, i) => `${i + 1}. **${b}**`).join("\n");

    const reply = `Here are the available eligible partner banks from your evaluation results:\n\n${formattedList}\n\nWhich bank would you like to proceed with for your loan application?`;

    return await finalizeAndReturn(
      { reply },
      {
        selectedBank: "",
        chosenBank: "",
        postEligibilityStage: "BANK_SELECTION",
        currentStep: "BANK_SELECTION",
        expectedField: "selectedBank",
        expectedEntity: "selectedBank",
      }
    );
  }

  // =========================================================================
  // STEP 6: BRANCH SELECTION CHOICE (e.g. "1", "2", or branch name)
  // Must be evaluated BEFORE checking named banks to prevent numeric branch choices
  // from being confused with eligible bank index 1.
  // =========================================================================
  const isBranchStage =
    eligibilitySession?.postEligibilityStage === "BRANCH_SELECTION" ||
    eligibilitySession?.currentStep === "BRANCH_SELECTION" ||
    eligibilitySession?.expectedField === "branchSelection" ||
    eligibilitySession?.expectedEntity === "branchSelection";

  if (isBranchStage) {
    const availableBranches: string[] = eligibilitySession?.availableBranches || [];
    let selectedBranch = "";

    if (/^\d+$/.test(trimmedMsg)) {
      const idx = parseInt(trimmedMsg, 10) - 1;
      if (idx >= 0 && idx < availableBranches.length) {
        selectedBranch = availableBranches[idx];
      }
    } else {
      const branchMatch = availableBranches.find(
        (b) => b.toLowerCase() === lowerMsg || lowerMsg.includes(b.toLowerCase())
      );
      if (branchMatch) selectedBranch = branchMatch;
    }

    if (selectedBranch) {
      const targetBank =
        eligibilitySession?.selectedBank ||
        eligibilitySession?.chosenBank ||
        topBank ||
        "HDFC Bank";
      const targetCity = eligibilitySession?.city;

      const searchRes = await lookupPostEligibilityBankManager({
        bankName: targetBank,
        branch: selectedBranch,
        city: targetCity,
      });

      if (searchRes.managers && searchRes.managers.length > 0) {
        const reply = formatPostEligibilityManagerDetails(targetBank, searchRes.managers, {
          userCity: targetCity,
          userBranch: selectedBranch,
        });
        return await finalizeAndReturn(
          { reply },
          {
            selectedBank: targetBank,
            chosenBank: targetBank,
            city: targetCity,
            branch: selectedBranch,
            preferredBranch: selectedBranch,
            postEligibilityStage: "MANAGER_RESULTS_SHOWN",
            currentStep: "BANK_MANAGER_RESULTS",
            expectedField: "completed",
            managerFound: true,
            managerResultsShown: true,
          }
        );
      } else {
        const reply = `I couldn't find an exact or matching ${targetBank} manager in our database for that location. Would you like to try another area or PIN code?`;
        return await finalizeAndReturn(
          { reply },
          {
            postEligibilityStage: "AWAITING_BRANCH_LOCATION",
            currentStep: "CITY_COLLECTION",
            expectedField: "cityOrPincode",
            managerFound: false,
          }
        );
      }
    }
  }

  // =========================================================================
  // STEP 3: DETECT INTENT — "PROCEED WITH THIS BANK" / "WHAT ARE THE NEXT STEPS?"
  // =========================================================================
  const isProceedThisBank = Boolean(
    /^(?:proceed\s+with\s+this\s+bank|proceed\s+with\s+it|proceed|what\s+are\s+the\s+next\s+steps\??|next\s+steps\??|i\s+would\s+like\s+to\s+proceed(?:\s+with\s+my\s+loan\s+application)?|apply\s+now)$/i.test(
      trimmedMsg
    ) ||
    /^(?:i\s+want\s+to\s+proceed|let'?s\s+proceed|continue\s+with\s+this\s+bank)$/i.test(trimmedMsg)
  );

  // Check if user selected via UI button action OR named a bank explicitly in message
  const actionBankName = bankSelectionAction?.bankName ? bankSelectionAction.bankName.trim() : null;
  const resolvedBankObj = !actionBankName && !/^\d+$/.test(trimmedMsg) ? resolveBankName(trimmedMsg, eligibleBanks) : null;
  const namedBank = actionBankName
    ? (resolveBankName(actionBankName, eligibleBanks)?.bankName || detectPartnerBankInText(actionBankName) || actionBankName)
    : (resolvedBankObj ? resolvedBankObj.bankName : (!/^\d+$/.test(trimmedMsg) ? detectPartnerBankInText(trimmedMsg) : null));

  // -------------------------------------------------------------------------
  // Handle Named Bank Selection
  // -------------------------------------------------------------------------
  if (namedBank) {
    // Validate bank strictly against the server's latest eligibility results
    const isEligible = eligibleBanks.length === 0 || eligibleBanks.some((b) => isSameBank(b, namedBank));

    if (!isEligible) {
      const formattedList = eligibleBanks.map((b, i) => `${i + 1}. **${b}**`).join("\n");
      const reply = `Under your current loan evaluation, **${namedBank}** is not eligible. Here are the banks you are currently eligible for:\n\n${formattedList}\n\nPlease choose one of your eligible partner banks to proceed.`;
      return await finalizeAndReturn(
        { reply },
        {
          postEligibilityStage: "BANK_SELECTION",
          currentStep: "BANK_SELECTION",
          expectedField: "selectedBank",
          expectedEntity: "selectedBank",
        }
      );
    }

    // Bank is verified and eligible!
    const effectiveBank = namedBank;
    let selectedBankId = bankSelectionAction?.bankId;
    if (!selectedBankId) {
      const foundEval = eligibilitySession?.lastEligibilityResult?.evaluations?.find((e: any) => isSameBank(e.bankName, effectiveBank));
      selectedBankId = foundEval?.bankId || effectiveBank.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    }

    const knownCity = eligibilitySession?.city;
    const knownPincode = eligibilitySession?.pincode;

    // If location is not known yet, ask for city/branch/pincode
    if (!knownCity && !knownPincode) {
      const reply = `You selected **${effectiveBank}**. Which city, branch, or pincode would you prefer?`;
      return await finalizeAndReturn(
        { reply },
        {
          selectedBank: effectiveBank,
          chosenBank: effectiveBank,
          selectedBankId,
          branch: undefined,
          preferredBranch: undefined,
          availableBranches: undefined,
          postEligibilityStage: "AWAITING_BRANCH_LOCATION",
          currentStep: "CITY_COLLECTION",
          locationStep: "CITY_COLLECTION",
          expectedField: "city",
          expectedEntity: "city",
        }
      );
    }

    // Location is already known from earlier session state (e.g. Pune)
    const searchRes = await lookupPostEligibilityBankManager({
      bankName: effectiveBank,
      city: knownCity,
      pincode: knownPincode,
    });

    if (searchRes.matchLevel === "city_branches" && searchRes.branches && searchRes.branches.length >= 1) {
      const formattedList = searchRes.branches.map((b, idx) => `${idx + 1}. **${b}**`).join("\n");
      const reply = `Available ${effectiveBank} branches in ${knownCity}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`;
      return await finalizeAndReturn(
        { reply },
        {
          selectedBank: effectiveBank,
          chosenBank: effectiveBank,
          selectedBankId,
          city: knownCity,
          branch: undefined,
          availableBranches: searchRes.branches,
          postEligibilityStage: "BRANCH_SELECTION",
          currentStep: "BRANCH_SELECTION",
          expectedField: "branchSelection",
          expectedEntity: "branchSelection",
        }
      );
    }

    if (searchRes.managers && searchRes.managers.length > 0) {
      const reply = formatPostEligibilityManagerDetails(effectiveBank, searchRes.managers, {
        userCity: knownCity,
        userPincode: knownPincode,
      });
      return await finalizeAndReturn(
        { reply },
        {
          selectedBank: effectiveBank,
          chosenBank: effectiveBank,
          city: knownCity,
          pincode: knownPincode,
          postEligibilityStage: "MANAGER_RESULTS_SHOWN",
          currentStep: "BANK_MANAGER_RESULTS",
          managerFound: true,
          managerResultsShown: true,
        }
      );
    }

    const reply = `I couldn't find an exact or matching ${effectiveBank} manager in our database for that location. Would you like to try another area or PIN code?`;
    return await finalizeAndReturn(
      { reply },
      {
        selectedBank: effectiveBank,
        chosenBank: effectiveBank,
        postEligibilityStage: "AWAITING_BRANCH_LOCATION",
        currentStep: "CITY_COLLECTION",
        expectedField: "cityOrPincode",
        managerFound: false,
      }
    );
  }

  // -------------------------------------------------------------------------
  // Handle "Proceed With This Bank" or "What are the next steps?"
  // -------------------------------------------------------------------------
  if (isProceedThisBank) {
    let effectiveBank =
      eligibilitySession?.selectedBank ||
      eligibilitySession?.chosenBank ||
      topBank;

    if (!effectiveBank && eligibleBanks.length > 0) {
      effectiveBank = eligibleBanks[0];
    }

    if (!effectiveBank) {
      const reply = `Please select ONE bank from your eligible list to proceed with connecting to an official branch manager.`;
      return await finalizeAndReturn(
        { reply },
        {
          postEligibilityStage: "BANK_SELECTION",
          currentStep: "BANK_SELECTION",
          expectedField: "selectedBank",
          expectedEntity: "selectedBank",
        }
      );
    }

    const knownCity = eligibilitySession?.city;
    const knownPincode = eligibilitySession?.pincode;

    if (!knownCity && !knownPincode) {
      const reply = `Great! You've selected **${effectiveBank}**. I can help you find a bank manager near your preferred branch. Which city or area would you like to visit?`;
      return await finalizeAndReturn(
        { reply },
        {
          selectedBank: effectiveBank,
          chosenBank: effectiveBank,
          postEligibilityStage: "AWAITING_BRANCH_LOCATION",
          currentStep: "CITY_COLLECTION",
          locationStep: "CITY_COLLECTION",
          expectedField: "city",
          expectedEntity: "city",
        }
      );
    }

    // City already known
    const searchRes = await lookupPostEligibilityBankManager({
      bankName: effectiveBank,
      city: knownCity,
      pincode: knownPincode,
    });

    if (searchRes.matchLevel === "city_branches" && searchRes.branches && searchRes.branches.length > 1) {
      const formattedList = searchRes.branches.map((b, idx) => `${idx + 1}. **${b}**`).join("\n");
      const reply = `Available ${effectiveBank} branches in ${knownCity}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`;
      return await finalizeAndReturn(
        { reply },
        {
          selectedBank: effectiveBank,
          chosenBank: effectiveBank,
          city: knownCity,
          availableBranches: searchRes.branches,
          postEligibilityStage: "BRANCH_SELECTION",
          currentStep: "BRANCH_SELECTION",
          expectedField: "branchSelection",
          expectedEntity: "branchSelection",
        }
      );
    }

    if (searchRes.managers && searchRes.managers.length > 0) {
      const reply = formatPostEligibilityManagerDetails(effectiveBank, searchRes.managers, {
        userCity: knownCity,
        userPincode: knownPincode,
      });
      return await finalizeAndReturn(
        { reply },
        {
          selectedBank: effectiveBank,
          chosenBank: effectiveBank,
          city: knownCity,
          pincode: knownPincode,
          postEligibilityStage: "MANAGER_RESULTS_SHOWN",
          currentStep: "BANK_MANAGER_RESULTS",
          managerFound: true,
          managerResultsShown: true,
        }
      );
    }

    const reply = `I couldn't find an exact or matching ${effectiveBank} manager in our database for that location. Would you like to try another area or PIN code?`;
    return await finalizeAndReturn(
      { reply },
      {
        selectedBank: effectiveBank,
        chosenBank: effectiveBank,
        postEligibilityStage: "AWAITING_BRANCH_LOCATION",
        expectedField: "cityOrPincode",
        managerFound: false,
      }
    );
  }



  // =========================================================================
  // DISCOVERY QUERY ("What branches are available?", "Show branches")
  // =========================================================================
  const isDiscoveryMsg = Boolean(
    /(?:tell|show|list|give|view|check|find)\s+(?:all\s+)?(?:available\s+)?(?:branches|locations)\b/i.test(trimmedMsg) ||
    /(?:what|which)\s+(?:are\s+)?(?:the\s+)?(?:available\s+)?(?:branches|locations)\b/i.test(trimmedMsg) ||
    /(?:what|which)\s+(?:branches|locations)\s+are\s+available\b/i.test(trimmedMsg) ||
    /(?:available\s+branches|available\s+locations)\b/i.test(trimmedMsg)
  );

  if (isDiscoveryMsg) {
    const targetBank =
      eligibilitySession?.selectedBank ||
      eligibilitySession?.chosenBank ||
      topBank ||
      "HDFC Bank";
    const targetCity = eligibilitySession?.city || "Pune";

    const dbBranches = await findBankBranches(targetBank, targetCity);
    const uniqueBranches = getUniqueBranches(dbBranches);

    if (uniqueBranches.length > 0) {
      const formattedList = uniqueBranches.map((b, idx) => `${idx + 1}. **${b}**`).join("\n");
      const reply = `Available ${targetBank} branches in ${targetCity}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`;
      return await finalizeAndReturn(
        { reply },
        {
          selectedBank: targetBank,
          chosenBank: targetBank,
          city: targetCity,
          availableBranches: uniqueBranches,
          postEligibilityStage: "BRANCH_SELECTION",
          currentStep: "BRANCH_SELECTION",
          expectedField: "branchSelection",
          expectedEntity: "branchSelection",
        }
      );
    }
  }

  // =========================================================================
  // STEP 4 & 5: LOCATION INPUT (PIN CODE, AREA, OR CITY)
  // =========================================================================
  const isPin = /^[1-9]\d{5}$/.test(trimmedMsg);
  const targetBank =
    eligibilitySession?.selectedBank ||
    eligibilitySession?.chosenBank ||
    topBank ||
    "HDFC Bank";

  // Check if turn is a location input
  const isLocationTurn =
    isPin ||
    isLocationInput(trimmedMsg) ||
    eligibilitySession?.expectedField === "city" ||
    eligibilitySession?.expectedField === "cityOrPincode" ||
    eligibilitySession?.expectedField === "pincode" ||
    eligibilitySession?.postEligibilityStage === "AWAITING_BRANCH_LOCATION" ||
    eligibilitySession?.postEligibilityStage === "AWAITING_PIN_CODE" ||
    eligibilitySession?.postEligibilityStage === "BANK_MANAGER_DETAILS_INPUT";

  if (isLocationTurn) {
    // 0. PIN code specifically required or requested
    if ((eligibilitySession?.expectedField === "pincode" || eligibilitySession?.postEligibilityStage === "AWAITING_PIN_CODE") && !isPin) {
      const reply = `Could you please share the branch PIN code?`;
      return await finalizeAndReturn(
        { reply },
        {
          postEligibilityStage: "AWAITING_PIN_CODE",
          currentStep: "AWAITING_PIN_CODE",
          expectedField: "pincode",
          expectedEntity: "pincode",
        }
      );
    }

    if (/\b(?:exact\s+branch|exact\s+pin|pin\s*code|pincode)\b/i.test(trimmedMsg) && !isPin) {
      const reply = `Could you please share the branch PIN code?`;
      return await finalizeAndReturn(
        { reply },
        {
          postEligibilityStage: "AWAITING_PIN_CODE",
          currentStep: "AWAITING_PIN_CODE",
          expectedField: "pincode",
          expectedEntity: "pincode",
        }
      );
    }

    // 1. PIN code provided
    if (isPin) {
      const pin = trimmedMsg;
      const cityFromPin = resolvePincodeToCity(pin);

      const searchRes = await lookupPostEligibilityBankManager({
        bankName: targetBank,
        pincode: pin,
        city: cityFromPin || eligibilitySession?.city,
      });

      if (searchRes.managers && searchRes.managers.length > 0) {
        const reply = formatPostEligibilityManagerDetails(targetBank, searchRes.managers, {
          userPincode: pin,
          userCity: cityFromPin || eligibilitySession?.city,
        });
        return await finalizeAndReturn(
          { reply },
          {
            selectedBank: targetBank,
            chosenBank: targetBank,
            pincode: pin,
            city: cityFromPin || eligibilitySession?.city,
            postEligibilityStage: "MANAGER_RESULTS_SHOWN",
            currentStep: "BANK_MANAGER_RESULTS",
            expectedField: "completed",
            managerFound: true,
            managerResultsShown: true,
          }
        );
      } else {
        const reply = `I couldn't find an exact or matching ${targetBank} manager in our database for that location. Would you like to try another area or PIN code?`;
        return await finalizeAndReturn(
          { reply },
          {
            selectedBank: targetBank,
            chosenBank: targetBank,
            pincode: pin,
            city: cityFromPin || eligibilitySession?.city,
            postEligibilityStage: "AWAITING_BRANCH_LOCATION",
            currentStep: "CITY_COLLECTION",
            expectedField: "cityOrPincode",
            managerFound: false,
          }
        );
      }
    }

    // 2. City or Area string provided
    const prevBranch = eligibilitySession?.preferredBranch || eligibilitySession?.branch;
    const cleanLocation = trimmedMsg.replace(/[.,!]/g, "").trim();

    // Check if user specifically requested a branch (like "Swarget")
    const searchRes = await lookupPostEligibilityBankManager({
      bankName: targetBank,
      city: cleanLocation,
      area: prevBranch || undefined,
      branch: prevBranch || undefined,
    });

    if (searchRes.matchLevel === "city_branches" && searchRes.branches && searchRes.branches.length >= 1) {
      const formattedList = searchRes.branches.map((b, idx) => `${idx + 1}. **${b}**`).join("\n");
      const reply = `Available ${targetBank} branches in ${cleanLocation}:\n\n${formattedList}\n\nPlease select a branch to view the bank manager details.`;
      return await finalizeAndReturn(
        { reply },
        {
          selectedBank: targetBank,
          chosenBank: targetBank,
          city: cleanLocation,
          availableBranches: searchRes.branches,
          postEligibilityStage: "BRANCH_SELECTION",
          currentStep: "BRANCH_SELECTION",
          expectedField: "branchSelection",
          expectedEntity: "branchSelection",
        }
      );
    }

    if (searchRes.managers && searchRes.managers.length > 0) {
      const reply = formatPostEligibilityManagerDetails(targetBank, searchRes.managers, {
        userCity: cleanLocation,
        userBranch: prevBranch,
      });
      return await finalizeAndReturn(
        { reply },
        {
          selectedBank: targetBank,
          chosenBank: targetBank,
          city: cleanLocation,
          branch: prevBranch,
          preferredBranch: prevBranch,
          postEligibilityStage: "MANAGER_RESULTS_SHOWN",
          currentStep: "BANK_MANAGER_RESULTS",
          expectedField: "completed",
          managerFound: true,
          managerResultsShown: true,
        }
      );
    }

    // If zero matches found
    const reply = `I couldn't find an exact or matching ${targetBank} manager in our database for that location. Would you like to try another area or PIN code?`;
    return await finalizeAndReturn(
      { reply },
      {
        selectedBank: targetBank,
        chosenBank: targetBank,
        city: cleanLocation,
        postEligibilityStage: "AWAITING_BRANCH_LOCATION",
        currentStep: "CITY_COLLECTION",
        expectedField: "cityOrPincode",
        managerFound: false,
      }
    );
  }

  return null;
}
