import pool from "@/lib/db";
import { searchCompany, formatCompanyResponse, formatCompanyCandidateList } from "@/lib/companySearch";
import { searchBankManager, formatManagers } from "@/lib/bankSearch";

// @ts-ignore
import assistantFlowService from "@/services/assistantFlowService";
// @ts-ignore
import programCategoryResolver from "@/services/programCategoryResolver";
// @ts-ignore
import eligibilityService from "@/services/eligibilityService";

const {
  getConversationState,
  setConversationState,
  clearConversationState,
  collectEligibilityField,
  formatEligibilityResult,
  generateEligibleBankRecommendations,
} = assistantFlowService;

const {
  RESOLVER_QUESTIONS,
  getNextResolverQuestion,
  isResolverComplete,
} = programCategoryResolver;

const {
  evaluateApplicantAgainstPolicies,
} = eligibilityService;

export function isLoanEligibilityIntent(text: string): boolean {
  const norm = String(text || "").toLowerCase();
  if (/interest\s*rate|roi|rate|tenure|document|company|listing|manager|contact|phone|email/i.test(norm)) {
    return false;
  }
  return /(check loan eligibility|am i eligible|loan eligibility|check my eligibility|eligibility check|check eligibility|apply for loan|loan wizard|eligibility wizard|calculate eligibility|loan criteria check|i want personal loan|i need personal loan|want personal loan|need personal loan|i want a loan|i need a loan|looking for personal loan|looking for a loan|apply for personal loan|get personal loan|i want loan|want loan|need loan|apply loan)/i.test(norm);
}

export async function processEligibilityFlow(
  conversationId: string,
  userMessage: string,
  modelOverride?: string,
  callOpenRouterFn?: (msg: string, model?: string, context?: string, prompt?: string) => Promise<string | null>
): Promise<{ reply: string; isFinished: boolean; applicant?: any; companyData?: any }> {
  const activeState = await getConversationState(pool, conversationId);
  const lowerMsg = userMessage.toLowerCase().trim();

  if (lowerMsg === "cancel" || lowerMsg === "reset" || lowerMsg === "restart") {
    await clearConversationState(pool, conversationId);
    return {
      reply: "🔄 **Loan Eligibility Assessment Reset**\n\nYou can start a new eligibility check anytime by typing **'Check loan eligibility'** or **'I want loan'**.",
      isFinished: true,
    };
  }

  // 1. Check if user is currently selecting a bank to proceed (chosenBank)
  if (activeState && activeState.in_eligibility_flow && activeState.expected_field === "chosenBank") {
    const rawInput = userMessage.trim();
    const eligibleBanks: string[] = activeState.eligible_banks || [];
    const collectedLocation = activeState.applicant?.preferredLocation || "";

    // Extract specific target bank from userMessage or default to top eligible bank
    let selectedBank = "";
    for (const b of eligibleBanks) {
      const bClean = b.replace(/bank|finance|limited|ltd/gi, "").trim().toLowerCase();
      if (bClean && rawInput.toLowerCase().includes(bClean)) {
        selectedBank = b;
        break;
      }
    }

    if (!selectedBank) {
      const commonBanks = ["hdfc", "icici", "axis", "sbi", "kotak", "indusind", "idfc", "bajaj", "chola", "piramal", "poonawalla", "tata", "yes"];
      for (const cb of commonBanks) {
        if (rawInput.toLowerCase().includes(cb)) {
          selectedBank = eligibleBanks.find(b => b.toLowerCase().includes(cb)) || cb.toUpperCase() + " Bank";
          break;
        }
      }
    }

    if (!selectedBank && eligibleBanks.length > 0) {
      selectedBank = eligibleBanks[0];
    }
    if (!selectedBank) selectedBank = rawInput;

    // Determine target location (from collected profile location or user input)
    let userLocation = collectedLocation;
    if (!userLocation) {
      userLocation = rawInput
        .replace(new RegExp(selectedBank, "gi"), "")
        .replace(/hdfc|icici|axis|sbi|kotak|indusind|idfc|bajaj|chola|piramal|poonawalla|tata|yes|bank|in|at|for|branch/gi, "")
        .trim();
    }
    if (!userLocation || userLocation.length < 2) {
      userLocation = "Mumbai";
    }

    let managerSection = "";
    try {
      const mgrList = await searchBankManager({ bank_name: selectedBank, city: userLocation, query: `${selectedBank} ${userLocation}` });
      
      const filteredMgrs = mgrList.filter((m: any) => {
        const mBank = (m.bank_name || "").toLowerCase();
        const sBank = selectedBank.toLowerCase().replace(/bank|finance|ltd/gi, "").trim();
        return mBank.includes(sBank) || sBank.includes(mBank);
      });

      const displayMgrs = filteredMgrs.length > 0 ? filteredMgrs : mgrList.slice(0, 10);

      if (displayMgrs.length > 0) {
        managerSection = `### 👔 Official Bank Manager Details: **${selectedBank}** (${userLocation})\n\n` +
          formatManagers(displayMgrs, userLocation);
      } else {
        managerSection = `| 🏦 Bank | 📍 Location | Message |\n| :--- | :--- | :--- |\n| **${selectedBank}** | **${userLocation}** | Branch manager details logged for ${selectedBank} in ${userLocation}. |`;
      }
    } catch (err) {
      console.warn("Failed to fetch bank managers for location:", err);
      managerSection = `Bank: **${selectedBank}** | Location: **${userLocation}**. Bank manager details will be sent directly.`;
    }

    await clearConversationState(pool, conversationId);

    return {
      reply: `${managerSection}\n\n---\n✅ **Thank you for choosing ${selectedBank}! Our official bank manager for ${userLocation} will contact you soon.**`,
      isFinished: true,
      applicant: activeState.applicant,
    };
  }

  // 2. Existing active eligibility flow (Steps 1 through 8)
  if (activeState && activeState.in_eligibility_flow) {
    const currentExpectedField = activeState.expected_field;

    // If user expresses fresh loan eligibility intent during an active flow (beyond Step 1), reset to Step 1
    if (isLoanEligibilityIntent(userMessage) && currentExpectedField !== "companyName" && currentExpectedField !== "companySelection") {
      await clearConversationState(pool, conversationId);
      const initialApplicant: any = {};
      const firstQ = getNextResolverQuestion(initialApplicant);
      await setConversationState(pool, conversationId, {
        in_eligibility_flow: true,
        applicant: initialApplicant,
        expected_field: firstQ ? firstQ.key : "companyName",
      });
      return {
        reply: firstQ ? firstQ.label : "What is your employer or company name?",
        isFinished: false,
        applicant: initialApplicant,
      };
    }

    let companyHeaderBlock = "";

    // Handle Company Confirmation Step: expected_field === "companyConfirmation"
    if (currentExpectedField === "companyConfirmation") {
      const lower = userMessage.trim().toLowerCase();
      if (/yes|proceed|ok|confirm|yup|sure|correct|y/i.test(lower) || lower.includes("yes") || lower.includes("proceed")) {
        const nextQ = getNextResolverQuestion(activeState.applicant || {});
        await setConversationState(pool, conversationId, {
          in_eligibility_flow: true,
          applicant: activeState.applicant || {},
          expected_field: nextQ ? nextQ.key : "employmentType",
        });

        return {
          reply: nextQ ? nextQ.label : "Are you salaried or self-employed?",
          isFinished: false,
          applicant: activeState.applicant,
        };
      } else {
        return {
          reply: "Please reply **'Yes, proceed'** to confirm your company details and continue with the loan eligibility check.",
          isFinished: false,
          applicant: activeState.applicant,
        };
      }
    }

    // Handle Step 1 Disambiguation selection: expected_field === "companySelection"
    if (currentExpectedField === "companySelection") {
      const candidates: string[] = activeState.candidate_companies || [];
      let chosenCompany = userMessage.trim();

      const numIndex = parseInt(chosenCompany) - 1;
      if (!isNaN(numIndex) && numIndex >= 0 && numIndex < candidates.length) {
        chosenCompany = candidates[numIndex];
      } else {
        const foundMatch = candidates.find(c => c.toLowerCase().includes(chosenCompany.toLowerCase()));
        if (foundMatch) chosenCompany = foundMatch;
      }

      const updatedApplicant = { ...(activeState.applicant || {}), companyName: chosenCompany };
      let compDataObj: any = null;
      try {
        const compRes = await searchCompany(chosenCompany);
        if (compRes?.found) {
          companyHeaderBlock = formatCompanyResponse(compRes) + "\n\n---\n\n";
          updatedApplicant.companyName = compRes.primaryName;
          compDataObj = {
            company_name: compRes.primaryName,
            overview: compRes.overview,
            basic_info: compRes.basicInfo,
            financial_info: compRes.financialInfo,
            bank_records: compRes.bankRecords,
            needs_disambiguation: false,
          };
        }
      } catch (err) {
        console.warn("[Wizard] Company selection lookup error:", err);
      }

      await setConversationState(pool, conversationId, {
        in_eligibility_flow: true,
        applicant: updatedApplicant,
        expected_field: "companyConfirmation",
      });

      return {
        reply: `${companyHeaderBlock}⚠️ **Please confirm your company details.**\nReply **"Yes, proceed"** to start your loan eligibility evaluation.`,
        isFinished: false,
        applicant: updatedApplicant,
        companyData: compDataObj,
      };
    }

    // If user is answering Step 1 (companyName)
    if (currentExpectedField === "companyName") {
      const trimmedUserMsg = userMessage.trim();
      if (isLoanEligibilityIntent(trimmedUserMsg) || /^(i want|i need|want|need)\s*(a|personal)?\s*loan$/i.test(trimmedUserMsg)) {
        return {
          reply: "What is your employer or company name?",
          isFinished: false,
          applicant: activeState.applicant,
        };
      }

      try {
        const compRes = await searchCompany(userMessage);
        if (compRes?.found) {
          // Check if multiple matching candidate companies exist in bank records
          if (compRes.candidates && compRes.candidates.length > 1) {
            await setConversationState(pool, conversationId, {
              in_eligibility_flow: true,
              applicant: activeState.applicant || {},
              expected_field: "companySelection",
              candidate_companies: compRes.candidates,
            });

            return {
              reply: formatCompanyCandidateList(compRes.candidates, userMessage),
              isFinished: false,
              applicant: activeState.applicant,
              companyData: { needs_disambiguation: true, candidates: compRes.candidates }
            };
          }

          companyHeaderBlock = formatCompanyResponse(compRes) + "\n\n---\n\n";
          activeState.applicant = activeState.applicant || {};
          activeState.applicant.companyName = compRes.primaryName;

          await setConversationState(pool, conversationId, {
            in_eligibility_flow: true,
            applicant: activeState.applicant,
            expected_field: "companyConfirmation",
          });

          return {
            reply: `${companyHeaderBlock}⚠️ **Please confirm your company details.**\nReply **"Yes, proceed"** to start your loan eligibility evaluation.`,
            isFinished: false,
            applicant: activeState.applicant,
            companyData: {
              company_name: compRes.primaryName,
              overview: compRes.overview,
              basic_info: compRes.basicInfo,
              financial_info: compRes.financialInfo,
              bank_records: compRes.bankRecords,
              needs_disambiguation: false,
            },
          };
        }
      } catch (err) {
        console.warn("[Wizard] Company lookup error:", err);
      }
    }

    // Collect applicant inputs
    // @ts-ignore
    const updatedApplicant = collectEligibilityField(userMessage, activeState.applicant || {}, currentExpectedField);
    const nextQ = getNextResolverQuestion(updatedApplicant);

    if (nextQ) {
      await setConversationState(pool, conversationId, {
        in_eligibility_flow: true,
        applicant: updatedApplicant,
        expected_field: nextQ.key,
      });

      return {
        reply: `${companyHeaderBlock}${nextQ.label}`,
        isFinished: false,
        applicant: updatedApplicant,
      };
    } else {
      // All inputs collected! Perform deterministic policy evaluation across all master bank rules
      const evals = await evaluateApplicantAgainstPolicies(pool, updatedApplicant);
      const rawReport = formatEligibilityResult(updatedApplicant, evals);
      const eligibleList = Array.isArray(evals) ? evals.filter((e: any) => e.status === "ELIGIBLE") : [];
      const eligibleBankNames = eligibleList.map((e: any) => e.bank);
      const recs = generateEligibleBankRecommendations(eligibleList);

      let finalReport = `${rawReport}\n\n${recs}`;

      if (callOpenRouterFn) {
        try {
          const llmSynthesized = await callOpenRouterFn(
            userMessage,
            modelOverride,
            finalReport,
            "You are CreditWise AI Financial Assistant. Present a clear, executive Loan Eligibility Report for the applicant. List Eligible Banks with ROI %, Max Loan Amount, and processing fee. List Conditional/Review Banks and Ineligible Banks with clear explanations. Format cleanly in Markdown with tables and emojis."
          );
          if (
            llmSynthesized &&
            !llmSynthesized.includes("unable to process") &&
            !llmSynthesized.includes("Please try again") &&
            llmSynthesized.trim().length > 50
          ) {
            finalReport = llmSynthesized;
          }
        } catch (err) {
          console.warn("[Wizard] LLM synthesis failed, using deterministic policy report:", err);
        }
      }

      // Transition to Step 9: Ask preferred bank selection for Bank Manager Connection
      await setConversationState(pool, conversationId, {
        in_eligibility_flow: true,
        applicant: updatedApplicant,
        expected_field: "chosenBank",
        eligible_banks: eligibleBankNames,
        last_report: finalReport,
      });

      return {
        reply: `${companyHeaderBlock}${finalReport}\n\n---\n\n🏦 **Choose Bank to Proceed**\n\nPlease select or reply with your **Chosen Bank** to connect with an official manager (e.g. *"HDFC Bank"* or *"ICICI Bank"*):`,
        isFinished: false,
        applicant: updatedApplicant,
      };
    }
  }

  // 3. Start New Assessment Flow
  const initialApplicant: any = {};
  
  // Check if initial prompt directly contains a valid company name
  if (!isLoanEligibilityIntent(userMessage)) {
    try {
      const compRes = await searchCompany(userMessage);
      if (compRes?.found && compRes.candidates && compRes.candidates.length === 1) {
        initialApplicant.companyName = compRes.primaryName;
      }
    } catch (e) {}
  }

  const firstQ = getNextResolverQuestion(initialApplicant);

  if (firstQ) {
    await setConversationState(pool, conversationId, {
      in_eligibility_flow: true,
      applicant: initialApplicant,
      expected_field: firstQ.key,
    });

    return {
      reply: `${firstQ.label}`,
      isFinished: false,
      applicant: initialApplicant,
    };
  }

  return {
    reply: "Could you please provide your employer or company name to start the loan eligibility check?",
    isFinished: false,
  };
}

export interface DeterministicApplicantInput {
  bankName?: string;
  loanType?: string;
  salary?: number | string;
  monthlyIncome?: number | string;
  cibil?: number | string;
  creditScore?: number | string;
  existingEmi?: number | string;
  companyName?: string;
  company?: string;
  employmentType?: string;
  age?: number | string;
  loanAmount?: number | string;
  requestedLoanAmount?: number | string;
  tenureMonths?: number | string;
}

export interface DeterministicCalculations {
  netSalary?: number;
  existingEmi?: number;
  foirPercent?: number;
  maxPermissibleEmi?: number;
  netAvailableEmi?: number;
  estimatedMaxLoanAmount?: number;
}

export interface DeterministicEligibilityResult {
  loanType: string;
  eligibility: 'Eligible' | 'Not Eligible' | 'Conditionally Eligible' | 'Unable to Determine';
  conditionsChecked: string[];
  passedConditions: string[];
  failedConditions: string[];
  missingInformation: string[];
  calculations: DeterministicCalculations;
  policySource: string;
  reason: string;
  bankName?: string;
}

/**
 * Deterministic Loan Eligibility Calculation Engine
 * Validates applicant parameters directly against active PostgreSQL bank policy rules.
 */
export async function calculateDeterministicEligibility(
  input: DeterministicApplicantInput,
  poolOverride?: any
): Promise<DeterministicEligibilityResult> {
  const dbPool = poolOverride || pool;
  
  // Extract and normalize inputs
  const rawSalary = input.salary ?? input.monthlyIncome;
  const netSalary = rawSalary != null && rawSalary !== "" && !isNaN(Number(rawSalary)) ? Number(rawSalary) : undefined;

  const rawCibil = input.cibil ?? input.creditScore;
  const cibil = rawCibil != null && rawCibil !== "" && !isNaN(Number(rawCibil)) ? Number(rawCibil) : undefined;

  const rawEmi = input.existingEmi;
  const existingEmi = rawEmi != null && rawEmi !== "" && !isNaN(Number(rawEmi)) ? Number(rawEmi) : undefined;

  const companyName = (input.companyName || input.company || "").trim() || undefined;
  const employmentType = (input.employmentType || "Salaried").trim();
  const loanType = (input.loanType || "Personal").trim();
  const bankName = (input.bankName || "").trim();

  const rawAge = input.age;
  const age = rawAge != null && rawAge !== "" && !isNaN(Number(rawAge)) ? Number(rawAge) : undefined;

  const conditionsChecked: string[] = [];
  const passedConditions: string[] = [];
  const failedConditions: string[] = [];
  const missingInformation: string[] = [];
  const calculations: DeterministicCalculations = {};

  // Check required basic inputs
  if (netSalary === undefined) missingInformation.push("Net Monthly Salary");
  if (cibil === undefined) missingInformation.push("CIBIL Credit Score");
  if (existingEmi === undefined) missingInformation.push("Existing Monthly EMIs");

  // Query policy rules from PostgreSQL
  let queryBankSql = "";
  const params: any[] = [loanType];

  if (bankName) {
    params.push(`%${bankName}%`);
    queryBankSql = ` AND (b.name ILIKE $2 OR b.code ILIKE $2)`;
  }

  let rulesRes;
  try {
    rulesRes = await dbPool.query(
      `SELECT
        b.id AS bank_id,
        b.name AS bank_name,
        b.code AS bank_code,
        pv.version AS policy_version,
        pr.*
       FROM banks b
       JOIN policy_versions pv ON pv.bank_id = b.id
       JOIN policy_rules pr ON pr.policy_version_id = pv.id
       WHERE b.is_active = true
         AND pv.status = 'active'
         AND pr.status IN ('active', 'review')
         AND pr.loan_type = $1
         ${queryBankSql}
       ORDER BY b.name ASC, pr.id DESC`,
      params
    );
  } catch (err) {
    console.error("[Deterministic Engine] Database query error:", err);
    return {
      loanType,
      eligibility: "Unable to Determine",
      conditionsChecked: [],
      passedConditions: [],
      failedConditions: [],
      missingInformation: ["Database Policy Rules"],
      calculations: {},
      policySource: "N/A",
      reason: "Database policy lookup failed.",
      bankName
    };
  }

  if (!rulesRes || rulesRes.rows.length === 0) {
    return {
      loanType,
      eligibility: "Unable to Determine",
      conditionsChecked: [],
      passedConditions: [],
      failedConditions: [],
      missingInformation: [],
      calculations: {},
      policySource: "N/A",
      reason: `No active ${loanType} Loan policy rules found for ${bankName || "the specified bank"} in PostgreSQL.`,
      bankName
    };
  }

  const primaryRule = rulesRes.rows[0];
  const policySource = `${primaryRule.bank_name} — ${loanType} Loan Policy ${primaryRule.policy_version || 'V1'}`;

  // 1. Validate Net Monthly Salary
  conditionsChecked.push("Minimum Net Monthly Salary");
  if (primaryRule.min_salary != null) {
    const minSal = Number(primaryRule.min_salary);
    if (netSalary === undefined) {
      failedConditions.push(`Net monthly salary missing (Policy requires min ₹${minSal.toLocaleString("en-IN")}) — [FAIL]`);
    } else {
      calculations.netSalary = netSalary;
      if (netSalary >= minSal) {
        passedConditions.push(`Net monthly salary (₹${netSalary.toLocaleString("en-IN")}) meets policy minimum (₹${minSal.toLocaleString("en-IN")}) — [PASS]`);
      } else {
        failedConditions.push(`Net monthly salary (₹${netSalary.toLocaleString("en-IN")}) is below policy minimum (₹${minSal.toLocaleString("en-IN")}) — [FAIL]`);
      }
    }
  }

  // 2. Validate CIBIL Credit Score
  conditionsChecked.push("Minimum CIBIL Credit Score");
  if (primaryRule.min_cibil != null) {
    const minCibil = Number(primaryRule.min_cibil);
    if (cibil === undefined) {
      failedConditions.push(`CIBIL score missing (Policy requires min ${minCibil}+) — [FAIL]`);
    } else {
      if (cibil >= minCibil) {
        passedConditions.push(`CIBIL score (${cibil}) meets required threshold (${minCibil}+) — [PASS]`);
      } else {
        failedConditions.push(`CIBIL score (${cibil}) is below required threshold (${minCibil}+) — [FAIL]`);
      }
    }
  }

  // 3. Validate FOIR & EMI Obligations (Formula: FOIR % = Existing EMI / Net Salary * 100)
  conditionsChecked.push("FOIR & Permissible EMI Limit");
  let foirCap = primaryRule.foir_percent != null ? Number(primaryRule.foir_percent) : undefined;
  
  if (foirCap === undefined && netSalary !== undefined) {
    if (netSalary >= 100000) foirCap = 65;
    else if (netSalary >= 50000) foirCap = 60;
    else foirCap = 50;
  }

  if (foirCap !== undefined) {
    calculations.foirPercent = foirCap;
    if (netSalary !== undefined) {
      const maxPermissibleEmi = Math.round((netSalary * foirCap) / 100);
      calculations.maxPermissibleEmi = maxPermissibleEmi;

      if (existingEmi !== undefined) {
        calculations.existingEmi = existingEmi;
        const netAvailableEmi = Math.max(0, maxPermissibleEmi - existingEmi);
        calculations.netAvailableEmi = netAvailableEmi;

        const estimatedMaxLoanAmount = Math.round(netAvailableEmi * 38.5);
        calculations.estimatedMaxLoanAmount = estimatedMaxLoanAmount;

        const calculatedFoir = Number(((existingEmi / netSalary) * 100).toFixed(1));
        if (existingEmi > maxPermissibleEmi) {
          failedConditions.push(`Calculated FOIR (${calculatedFoir}%) exceeds PostgreSQL policy FOIR cap (${foirCap}%) [Max EMI Cap: ₹${maxPermissibleEmi.toLocaleString("en-IN")}] — [FAIL]`);
        } else {
          passedConditions.push(`Calculated FOIR (${calculatedFoir}%) is within PostgreSQL policy FOIR cap (${foirCap}%) [Net Capacity: ₹${netAvailableEmi.toLocaleString("en-IN")}/mo] — [PASS]`);
        }
      }
    }
  }

  // 4. Validate Employment Type
  if (primaryRule.employment_type && primaryRule.employment_type !== "Any") {
    conditionsChecked.push("Employment Type");
    if (employmentType.toLowerCase().includes(primaryRule.employment_type.toLowerCase())) {
      passedConditions.push(`Employment type '${employmentType}' matches required '${primaryRule.employment_type}' — [PASS]`);
    } else {
      failedConditions.push(`Employment type '${employmentType}' does not match required '${primaryRule.employment_type}' — [FAIL]`);
    }
  }

  // 5. Validate Age
  if (primaryRule.min_age != null || primaryRule.max_age != null) {
    conditionsChecked.push("Applicant Age");
    if (age !== undefined) {
      const minAge = primaryRule.min_age != null ? Number(primaryRule.min_age) : 21;
      const maxAge = primaryRule.max_age != null ? Number(primaryRule.max_age) : 60;
      if (age >= minAge && age <= maxAge) {
        passedConditions.push(`Age (${age} years) is within permissible range (${minAge}–${maxAge} years) — [PASS]`);
      } else {
        failedConditions.push(`Age (${age} years) is outside permissible range (${minAge}–${maxAge} years) — [FAIL]`);
      }
    }
  }

  // 6. Validate Company / Employer Category
  if (companyName) {
    conditionsChecked.push("Employer Category Rating");
    try {
      const compRes = await dbPool.query(
        `SELECT company_category FROM company_records WHERE company_name ILIKE $1 LIMIT 1`,
        [`%${companyName}%`]
      );
      if (compRes.rows.length > 0) {
        const cat = compRes.rows[0].company_category || "Approved";
        passedConditions.push(`Employer '${companyName}' verified under category '${cat}'`);
      } else {
        passedConditions.push(`Employer '${companyName}' evaluated under Open Market / Standard Corporate guidelines`);
      }
    } catch (e) {
      passedConditions.push(`Employer '${companyName}' evaluated under standard corporate guidelines`);
    }
  }

  // Determine Overall Eligibility Status
  let eligibility: 'Eligible' | 'Not Eligible' | 'Conditionally Eligible' | 'Unable to Determine' = 'Unable to Determine';
  let reason = "";

  if (failedConditions.length > 0) {
    eligibility = "Not Eligible";
    reason = `Applicant failed ${failedConditions.length} policy criteria: ${failedConditions.join("; ")}`;
  } else if (missingInformation.length > 0) {
    eligibility = "Conditionally Eligible";
    reason = `Applicant meets tested conditions, but required inputs are missing: ${missingInformation.join(", ")}`;
  } else if (passedConditions.length > 0) {
    eligibility = "Eligible";
    reason = `Applicant meets all ${passedConditions.length} policy conditions for ${primaryRule.bank_name}.`;
  }

  return {
    loanType,
    eligibility,
    conditionsChecked,
    passedConditions,
    failedConditions,
    missingInformation,
    calculations,
    policySource,
    reason,
    bankName: primaryRule.bank_name
  };
}
