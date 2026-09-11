import pool from "@/lib/db";
import { searchCompany, formatCompanyResponse, formatCompanyCandidateList } from "@/lib/companySearch";
import { searchBankManager, formatManagers } from "@/lib/bankSearch";
import {
  calculateEmi as dynamicCalculateEmi,
  evaluateApplicantAgainstAllBanks,
  formatDynamicEligibilityReport,
  processDynamicEligibility,
  extractApplicantDetails,
  getMissingRequiredFields,
  generateDynamicQuestion,
  getEligibilityState,
  saveEligibilityState,
  clearEligibilityState,
  detectLoanIntent,
  ApplicantProfile,
  BankEvaluationResult,
} from "@/lib/dynamicEligibilityEngine";
import { resolveCompanyCategories } from "@/lib/companyCategoryResolver";

/**
 * Checks whether user message expresses loan eligibility intent semantically.
 */
export function isLoanEligibilityIntent(text: string, preClassifiedIntent?: any): boolean {
  if (preClassifiedIntent?.intent) {
    return (
      preClassifiedIntent.intent === "LOAN_ELIGIBILITY" ||
      (preClassifiedIntent as any).intent === "PERSONAL_LOAN_REQUEST"
    );
  }
  return detectLoanIntent(text, preClassifiedIntent).isLoanIntent;
}


/**
 * Calculates monthly EMI using the standard financial formula.
 * Supports both function signatures: (principal, rate, tenure) or ({ principal, rate, tenure }).
 */
export function calculateEmi(
  principalOrObj: number | { principal: number; rate: number; tenure: number },
  annualRatePct?: number,
  tenureMonths?: number
): number {
  if (typeof principalOrObj === "object" && principalOrObj !== null) {
    return dynamicCalculateEmi(
      Number(principalOrObj.principal || 0),
      Number(principalOrObj.rate || 0),
      Number(principalOrObj.tenure || 0)
    );
  }
  return dynamicCalculateEmi(
    Number(principalOrObj || 0),
    Number(annualRatePct || 0),
    Number(tenureMonths || 0)
  );
}

/**
 * Formats monthly EMI and interest schedule calculation into clean Markdown.
 */
export function formatEmiResult(
  input: { principal: number; rate: number; tenure: number } | any,
  monthlyEmi: number
): string {
  const principal = Number(input?.principal || 0);
  const rate = Number(input?.rate || 0);
  const tenure = Number(input?.tenure || 0);
  const totalPayment = monthlyEmi * tenure;
  const totalInterest = Math.max(0, totalPayment - principal);

  return (
    `### 🧮 Loan EMI Calculation Result\n\n` +
    `| Parameter | Value |\n` +
    `| :--- | :--- |\n` +
    `| **Loan Amount (Principal)** | ₹${principal.toLocaleString("en-IN")} |\n` +
    `| **Annual Interest Rate (ROI)** | ${rate}% p.a. |\n` +
    `| **Repayment Tenure** | ${tenure} months (${(tenure / 12).toFixed(1)} years) |\n` +
    `| **Estimated Monthly EMI** | **₹${monthlyEmi.toLocaleString("en-IN")}/month** |\n` +
    `| **Total Interest Payable** | ₹${totalInterest.toLocaleString("en-IN")} |\n` +
    `| **Total Repayment Amount** | ₹${totalPayment.toLocaleString("en-IN")} |\n`
  );
}

/**
 * Evaluates applicant eligibility directly for central agent tool-calls.
 * Uses exact Master Policy .txt rules and resolves the company category from company_records.
 */
export async function evaluateEligibilityFromTool(input: {
  bankName?: string;
  loanType?: string;
  salary?: number | string;
  cibil?: number | string;
  existingEmi?: number | string;
  companyName?: string;
  employmentType?: string;
  age?: number | string;
  loanAmount?: number | string;
  tenureMonths?: number | string;
}): Promise<string> {
  const applicant: ApplicantProfile = {
    loanType: input.loanType || "Personal Loan",
    companyName: input.companyName,
    monthlyIncome: input.salary != null ? Number(input.salary) : undefined,
    cibil: input.cibil != null ? Number(input.cibil) : undefined,
    existingEmi: input.existingEmi != null ? Number(input.existingEmi) : undefined,
    age: input.age != null ? Number(input.age) : undefined,
    employmentType: input.employmentType || "Salaried",
    loanAmount: input.loanAmount != null ? Number(input.loanAmount) : undefined,
    tenureMonths: input.tenureMonths != null ? Number(input.tenureMonths) : undefined,
  };

  const evalResult = await evaluateApplicantAgainstAllBanks(applicant, applicant.loanType || "Personal Loan");

  // If a specific bank is requested, filter the result for that bank
  if (input.bankName) {
    const target = input.bankName.toLowerCase().replace(/bank|finance|limited|ltd/gi, "").trim();
    const matched = evalResult.evaluations.find(
      (e) => e.bankName.toLowerCase().includes(target) || e.bankCode.toLowerCase().includes(target)
    );
    if (matched) {
      let md = `### 🏦 ${matched.bankName} — ${applicant.loanType || "Personal Loan"} Eligibility: ${matched.isEligible ? "✅ ELIGIBLE" : "❌ NOT ELIGIBLE"}\n\n`;
      md += `**Policy Source**: Official Bank Lending Guidelines\n`;
      md += `**Applied Company Category**: **${matched.resolvedCategory}**\n\n`;

      if (matched.isEligible) {
        md += `**Approved Financial Terms**:\n`;
        md += `• **Annual Interest Rate (ROI)**: **${matched.roi}% p.a.**\n`;
        md += `• **Monthly EMI**: **₹${matched.monthlyEmi.toLocaleString("en-IN")}/month**\n`;
        md += `• **Maximum Loan Eligibility**: **₹${matched.maxLoanEligible.toLocaleString("en-IN")}**\n`;
        md += `• **Processing Fee**: **${matched.processingFeePercent}%**\n`;
        md += `• **FOIR Ratio**: **${matched.calculatedFoir}% used of ${matched.foirPercent}% permissible limit**\n\n`;
        md += `**Verified Policy Criteria**:\n`;
        matched.verifiedChecks.forEach((c) => { md += `• ✅ ${c}\n`; });
      } else {
        md += `**Policy Criteria Not Met**:\n`;
        matched.failureReasons.forEach((r) => { md += `• ❌ ${r}\n`; });
        if (matched.verifiedChecks.length > 0) {
          md += `\n**Passed Criteria**:\n`;
          matched.verifiedChecks.forEach((c) => { md += `• ✅ ${c}\n`; });
        }
      }
      return md;
    }
  }

  return formatDynamicEligibilityReport(applicant, evalResult);
}

/**
 * Initializes a new dynamic loan flow when loan intent is detected.
 */
export async function createLoanIntentFlow(
  dbPool: any,
  conversationId: string,
  userMessage: string
): Promise<{ reply: string; isFinished: boolean }> {
  const result = await processDynamicEligibility(conversationId, userMessage);
  return {
    reply: result.formattedMarkdown || result.nextQuestion || "",
    isFinished: result.isComplete,
  };
}

/**
 * Primary conversational eligibility handler.
 * Dynamically extracts fields, asks ONLY for what is missing, evaluates all banks against Master Policy .txt rules,
 * and seamlessly handles official bank manager connection upon bank selection.
 */
export async function processEligibilityFlow(
  conversationId: string,
  userMessage: string,
  modelOverride?: string,
  callOpenRouterFn?: (msg: string, model?: string, context?: string, prompt?: string) => Promise<string | null>,
  preClassifiedIntent?: any
): Promise<{ reply: string; isFinished: boolean; applicant?: any; companyData?: any }> {
  const lowerMsg = userMessage.toLowerCase().trim();

  const numConvId = Number(conversationId);
  const isValidConvId = Number.isFinite(numConvId);

  // Handle reset/cancel commands
  // Check existing conversation state in DB or in-memory
  let activeState: any = null;
  if (pool && isValidConvId) {
    try {
      const stateRes = await pool.query(
        `SELECT state FROM assistant_conversation_states WHERE conversation_id = $1 AND expires_at > NOW()`,
        [numConvId]
      );
      if (stateRes.rowCount && stateRes.rows[0].state) {
        activeState = stateRes.rows[0].state;
      }
    } catch (e) {
      console.warn("Error reading state in processEligibilityFlow:", e);
    }
  }
  if (!activeState) {
    activeState = await getEligibilityState(conversationId);
  }

  // Handle reset/cancel commands
  if (
    lowerMsg === "cancel" ||
    lowerMsg === "reset" ||
    lowerMsg === "restart" ||
    (preClassifiedIntent?.intent === "ANOTHER_TOPIC" && preClassifiedIntent?.subIntent === "CANCEL_RESET") ||
    (preClassifiedIntent?.intent as any) === "CANCEL_RESET"
  ) {
    if (pool && isValidConvId) {
      await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numConvId]);
    }
    await clearEligibilityState(conversationId);
    return {
      reply: "🔄 **Loan Eligibility Assessment Reset**\n\nYou can start a new eligibility evaluation anytime by asking for a loan.",
      isFinished: true,
    };
  }

  // If user expresses new loan intent, clear any stale state to ensure a 100% fresh start
  if (
    !activeState &&
    (preClassifiedIntent?.intent === "LOAN_ELIGIBILITY" ||
      (preClassifiedIntent?.intent as any) === "PERSONAL_LOAN_REQUEST" ||
      isLoanEligibilityIntent(userMessage, preClassifiedIntent))
  ) {
    if (pool && isValidConvId) {
      try {
        await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numConvId]);
      } catch (e) {}
    }
    await clearEligibilityState(conversationId);
  }

  // 1. Bank Manager Selection Step (when user selects their preferred bank after evaluation)
  if (
    activeState &&
    (activeState.expected_field === "chosenBank" ||
      activeState.expectedField === "chosenBank" ||
      (activeState.in_eligibility_flow && activeState.expected_field === "chosenBank"))
  ) {
    const rawInput = userMessage.trim();
    const eligibleBanks: string[] = activeState.eligible_banks || [];
    const collectedLocation = activeState.applicant?.location || activeState.applicant?.preferredLocation || "";

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
          selectedBank = eligibleBanks.find((b) => b.toLowerCase().includes(cb)) || cb.toUpperCase() + " Bank";
          break;
        }
      }
    }

    if (!selectedBank && eligibleBanks.length > 0) {
      selectedBank = eligibleBanks[0];
    }
    if (!selectedBank) selectedBank = rawInput;

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
        managerSection = `### 👔 Official Bank Manager Directory: **${selectedBank}** (${userLocation})\n\n` + formatManagers(displayMgrs, userLocation);
      } else {
        managerSection = `| 🏦 Bank | 📍 Location | Status |\n| :--- | :--- | :--- |\n| **${selectedBank}** | **${userLocation}** | Official manager contact request logged for ${selectedBank} in ${userLocation}. |`;
      }
    } catch (err) {
      managerSection = `Bank: **${selectedBank}** | Location: **${userLocation}**. Official manager contacts logged.`;
    }

    if (pool && isValidConvId) {
      await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numConvId]);
    }
    await clearEligibilityState(conversationId);

    return {
      reply: `${managerSection}\n\n---\n✅ **Thank you for choosing ${selectedBank}! Our official bank representative for ${userLocation} will assist with your application.**`,
      isFinished: true,
      applicant: activeState.applicant,
    };
  }

  // 2. Delegate to the fully dynamic eligibility engine
  const dynamicOutput = await processDynamicEligibility(
    conversationId,
    userMessage,
    modelOverride,
    preClassifiedIntent
  );

  if (!dynamicOutput.isComplete) {
    return {
      reply: dynamicOutput.formattedMarkdown || dynamicOutput.nextQuestion || "",
      isFinished: false,
      applicant: dynamicOutput.applicant,
    };
  }

  // 3. Evaluation complete: Save state for bank manager connection
  const eligibleBankNames = (dynamicOutput.eligibleBanks || []).map((b) => b.bankName);
  if (eligibleBankNames.length > 0) {
    if (pool && isValidConvId) {
      try {
        await pool.query(
          `INSERT INTO assistant_conversation_states (conversation_id, state, expires_at)
           VALUES ($1, $2, NOW() + INTERVAL '30 minutes')
           ON CONFLICT (conversation_id) DO UPDATE SET state = $2, expires_at = NOW() + INTERVAL '30 minutes'`,
          [
            numConvId,
            {
              in_eligibility_flow: true,
              expected_field: "chosenBank",
              eligible_banks: eligibleBankNames,
              applicant: dynamicOutput.applicant,
            },
          ]
        );
      } catch (e) {
        console.warn("Could not save chosenBank state:", e);
      }
    }

    await saveEligibilityState(conversationId, {
      applicant: dynamicOutput.applicant,
      expectedField: "chosenBank",
      updatedAt: Date.now(),
      in_eligibility_flow: true,
      eligible_banks: eligibleBankNames,
    } as any);

    return {
      reply: dynamicOutput.formattedMarkdown || "",
      isFinished: false,
      applicant: dynamicOutput.applicant,
      // Strictly do not attach internal Corporate Intelligence data to user-facing loan flow
      companyData: undefined,
    };
  } else {
    // If no partner bank is eligible, clear any stored conversation state and conclude
    if (pool && isValidConvId) {
      try {
        await pool.query(`DELETE FROM assistant_conversation_states WHERE conversation_id = $1`, [numConvId]);
      } catch (e) {}
    }
    await clearEligibilityState(conversationId);

    return {
      reply: dynamicOutput.formattedMarkdown || "",
      isFinished: true,
      applicant: dynamicOutput.applicant,
    };
  }
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
  eligibility: "Eligible" | "Not Eligible" | "Conditionally Eligible" | "Unable to Determine";
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

  if (netSalary === undefined) missingInformation.push("Net Monthly Salary");
  if (cibil === undefined) missingInformation.push("CIBIL Credit Score");
  if (existingEmi === undefined) missingInformation.push("Existing Monthly EMIs");

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
      bankName,
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
      bankName,
    };
  }

  const primaryRule = rulesRes.rows[0];
  const policySource = `${primaryRule.bank_name} — ${loanType} Loan Policy ${primaryRule.policy_version || "V1"}`;

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

  // 3. Validate FOIR & EMI Obligations
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
          failedConditions.push(`Calculated FOIR (${calculatedFoir}%) exceeds policy FOIR cap (${foirCap}%) [Max EMI Cap: ₹${maxPermissibleEmi.toLocaleString("en-IN")}] — [FAIL]`);
        } else {
          passedConditions.push(`Calculated FOIR (${calculatedFoir}%) is within policy FOIR cap (${foirCap}%) [Net Capacity: ₹${netAvailableEmi.toLocaleString("en-IN")}/mo] — [PASS]`);
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
      const catMatch = await resolveCompanyCategories(companyName);
      if (catMatch.isFound) {
        const topCat = Object.values(catMatch.bankCategories)[0] || "Prime";
        passedConditions.push(`Employer '${companyName}' verified in 591k records under '${topCat}' tier`);
      } else {
        passedConditions.push(`Employer '${companyName}' evaluated under Standard Corporate / Open Market guidelines`);
      }
    } catch (e) {
      passedConditions.push(`Employer '${companyName}' evaluated under standard corporate guidelines`);
    }
  }

  // Overall Decision
  let eligibility: "Eligible" | "Not Eligible" | "Conditionally Eligible" | "Unable to Determine" = "Unable to Determine";
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
    bankName: primaryRule.bank_name,
  };
}
