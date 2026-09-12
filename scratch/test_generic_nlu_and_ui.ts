// scratch/test_generic_nlu_and_ui.ts
import {
  processDynamicEligibility,
  consolidateApplicantProfileFromHistory,
  getRequiredPolicyFields,
  detectAndAnswerSideQuestion,
  isConfirmationMessage,
} from "../lib/dynamicEligibilityEngine";
import { resolveCompanyCategories } from "../lib/companyCategoryResolver";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✅ ${message}`);
}

async function runAllTests() {
  console.log("===============================================================================");
  console.log("🚀 STARTING GENERIC NLU, CONVERSATION-STATE & UI REGRESSION TEST SUITE");
  console.log("===============================================================================\n");

  // TEST 1: Multi-turn gathering across non-standard order without repeating already provided fields
  console.log("📋 TEST 1: Multi-turn Gathering & No Field Repetition");
  {
    const convId = "test_multi_turn_" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    // Turn 1: Company
    const t1 = await processDynamicEligibility(convId, "I want a personal loan, I work at Infosys", undefined, undefined, history);
    history.push({ role: "user", content: "I want a personal loan, I work at Infosys" });
    history.push({ role: "assistant", content: t1.nextQuestion || "" });
    assert(!t1.isComplete, "Turn 1 should not be complete");
    assert(Boolean(t1.applicant.companyName?.includes("Infosys")), "Turn 1 extracted companyName Infosys");
    assert(t1.missingFields.includes("monthlyIncome"), "Turn 1 missing salary");
    assert(!t1.missingFields.includes("companyName"), "Turn 1 does NOT re-ask companyName");

    // Turn 2: Salary
    const t2 = await processDynamicEligibility(convId, "My take home is 95,000 per month", undefined, undefined, history);
    history.push({ role: "user", content: "My take home is 95,000 per month" });
    history.push({ role: "assistant", content: t2.nextQuestion || "" });
    assert(t2.applicant.monthlyIncome === 95000, "Turn 2 extracted salary 95000");
    assert(Boolean(t2.applicant.companyName?.includes("Infosys")), "Turn 2 preserved companyName Infosys");
    assert(!t2.missingFields.includes("monthlyIncome"), "Turn 2 does NOT re-ask monthlyIncome");
    assert(!t2.missingFields.includes("companyName"), "Turn 2 does NOT re-ask companyName");

    // Turn 3: Loan amount and tenure (combined)
    const t3 = await processDynamicEligibility(convId, "I need 8 lakh for 4 years", undefined, undefined, history);
    history.push({ role: "user", content: "I need 8 lakh for 4 years" });
    history.push({ role: "assistant", content: t3.nextQuestion || "" });
    assert(t3.applicant.loanAmount === 800000, "Turn 3 extracted loanAmount 800000");
    assert(t3.applicant.tenureMonths === 48, "Turn 3 extracted tenureMonths 48");
    assert(!t3.missingFields.includes("loanAmount"), "Turn 3 does NOT re-ask loanAmount");
    assert(!t3.missingFields.includes("tenureMonths"), "Turn 3 does NOT re-ask tenureMonths");
    assert(!t3.missingFields.includes("monthlyIncome"), "Turn 3 does NOT re-ask salary");

    // Turn 4: Remaining fields: CIBIL, Age, EMI in a single sentence
    const t4 = await processDynamicEligibility(convId, "My CIBIL is 780, age 29, zero existing loans", undefined, undefined, history);
    assert(t4.isComplete, "Turn 4 should be complete since all 7 fields were provided across turns");
    assert(t4.applicant.cibil === 780, "Turn 4 extracted CIBIL 780");
    assert(t4.applicant.age === 29, "Turn 4 extracted age 29");
    assert(t4.applicant.existingEmi === 0, "Turn 4 extracted existingEmi 0");
    assert((t4.eligibleBanks || []).length > 0, "Turn 4 returned eligible banks");
    assert(Boolean(t4.formattedMarkdown?.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |")), "Turn 4 has standard markdown table");
  }

  // TEST 2: Contextual "Why?" objection handling without wiping state
  console.log("\n📋 TEST 2: Contextual 'Why?' Objection Handling (Preserves State)");
  {
    const convId = "test_why_objection_" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    // Turn 1: User gives TCS, salary 80k
    const t1 = await processDynamicEligibility(convId, "TCS, salary 80000", undefined, undefined, history);
    history.push({ role: "user", content: "TCS, salary 80000" });
    history.push({ role: "assistant", content: t1.nextQuestion || "" });
    assert(Boolean(t1.applicant.companyName?.includes("TCS") || t1.applicant.companyName?.includes("Tata")), "Turn 1 extracted TCS");
    assert(t1.applicant.monthlyIncome === 80000, "Turn 1 extracted salary 80000");

    // Turn 2: User asks "Why?" to whatever is being asked next
    const expectedField = t1.missingFields[0];
    const sideQ = detectAndAnswerSideQuestion("Why do you need that?", expectedField);
    assert(sideQ.isQuestion, "detectAndAnswerSideQuestion identified question");
    assert(Boolean(sideQ.answer && sideQ.answer.length > 10), `Side question answered for ${expectedField}: ${sideQ.answer}`);

    const t2 = await processDynamicEligibility(convId, "Why do you need that?", undefined, undefined, history);
    history.push({ role: "user", content: "Why do you need that?" });
    history.push({ role: "assistant", content: t2.nextQuestion || "" });
    assert(!t2.isComplete, "Turn 2 is not complete");
    assert(Boolean(t2.applicant.companyName?.includes("TCS") || t2.applicant.companyName?.includes("Tata")), "State preserved TCS through 'Why?' objection");
    assert(t2.applicant.monthlyIncome === 80000, "State preserved salary 80000 through 'Why?' objection");
  }

  // TEST 3: Confirmations ("ok", "proceed", "yes") contextually prompt for next missing field
  console.log("\n📋 TEST 3: Confirmations ('ok', 'proceed') Contextual Continuation");
  {
    assert(isConfirmationMessage("ok"), "isConfirmationMessage detects 'ok'");
    assert(isConfirmationMessage("proceed"), "isConfirmationMessage detects 'proceed'");
    assert(isConfirmationMessage("yes"), "isConfirmationMessage detects 'yes'");
    assert(isConfirmationMessage("sure, let's continue"), "isConfirmationMessage detects 'sure, let's continue'");
    assert(!isConfirmationMessage("Infosys"), "isConfirmationMessage rejects 'Infosys'");
    assert(!isConfirmationMessage("salary 50000"), "isConfirmationMessage rejects 'salary 50000'");

    const convId = "test_confirmation_" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    // Turn 1: Company with loan intent
    const t1 = await processDynamicEligibility(convId, "I want a loan, I work at Wipro", undefined, undefined, history);
    history.push({ role: "user", content: "I want a loan, I work at Wipro" });
    history.push({ role: "assistant", content: t1.nextQuestion || "" });

    // Turn 2: User says "ok proceed"
    const t2 = await processDynamicEligibility(convId, "ok proceed", undefined, undefined, history);
    assert(!t2.isComplete, "Turn 2 with 'ok proceed' continues cleanly");
    assert(Boolean(t2.applicant.companyName?.includes("Wipro")), "State preserved Wipro through confirmation");
    assert(t2.missingFields[0] === "monthlyIncome", "Next required field is monthlyIncome");
  }

  // TEST 4: Corrections ("actually my salary is...")
  console.log("\n📋 TEST 4: Profile Corrections Override Chronologically");
  {
    const history: Array<{ role: string; content: string }> = [
      { role: "user", content: "I work at Capgemini, salary is 75000" },
      { role: "assistant", content: "What is your loan amount?" },
      { role: "user", content: "Actually my salary is 1.5 lakh" },
    ];

    const consolidated = consolidateApplicantProfileFromHistory(history, "Actually my salary is 1.5 lakh");
    assert(Boolean(consolidated.companyName?.includes("Capgemini")), "Consolidated preserved Capgemini");
    assert(consolidated.monthlyIncome === 150000, "Consolidated updated salary to 150000");
  }

  // TEST 5: Unexpected replies (Unemployed, Student, No CIBIL)
  console.log("\n📋 TEST 5: Unexpected Replies (Unemployed, Student, No CIBIL)");
  {
    // Unemployed
    const convIdUnemp = "test_unemp_" + Date.now();
    const tUnemp = await processDynamicEligibility(convIdUnemp, "I am unemployed and have no job");
    assert(tUnemp.isComplete, "Unemployed applicant completes assessment early");
    assert(
      (tUnemp.formattedMarkdown || "").toLowerCase().includes("unemployed") ||
      (tUnemp.formattedMarkdown || "").toLowerCase().includes("income") ||
      (tUnemp.formattedMarkdown || "").toLowerCase().includes("eligible"),
      "Unemployed response explains policy income requirement"
    );

    // No CIBIL / unknown credit score
    const historyCibil: Array<{ role: string; content: string }> = [
      { role: "user", content: "Capgemini, salary 1.2 lakh, loan 5 lakh, 3 years" },
      { role: "assistant", content: "What is your CIBIL score?" },
      { role: "user", content: "I don't have a credit score, never checked" },
    ];
    const consolidatedCibil = consolidateApplicantProfileFromHistory(historyCibil, "I don't have a credit score, never checked");
    assert(consolidatedCibil.cibil === 0, "No CIBIL correctly recorded as 0");
    const missing = getRequiredPolicyFields(consolidatedCibil);
    assert(!missing.includes("cibil"), "CIBIL=0 is not considered missing");
  }

  // TEST 6: Capgemini deterministic re-run evaluation
  console.log("\n📋 TEST 6: Deterministic Evaluation (Capgemini 18 Eligible Banks Twice)");
  {
    const profile = "Capgemini, Age 28, Salary ₹1.5 lakh, CIBIL 810, Loan ₹10 lakh, 60 months, Existing EMI ₹0";

    const run1 = await processDynamicEligibility("test_cap_run1_" + Date.now(), profile);
    assert(run1.isComplete, "Run 1 complete");
    const count1 = (run1.eligibleBanks || []).length;

    const run2 = await processDynamicEligibility("test_cap_run2_" + Date.now(), profile);
    assert(run2.isComplete, "Run 2 complete");
    const count2 = (run2.eligibleBanks || []).length;

    assert(count1 === 18, `Run 1 returned exactly 18 eligible banks (got ${count1})`);
    assert(count2 === 18, `Run 2 returned exactly 18 eligible banks (got ${count2})`);
    assert(count1 === count2, "Both runs produced identical bank counts");
  }

  // TEST 7: UI Detection logic validation
  console.log("\n📋 TEST 7: Eligibility Result UI Card Detection & Classification");
  {
    // Mocking the detectEligibilityResult logic from app/home/page.tsx
    function detectEligibilityResult(content: string) {
      if (!content || typeof content !== "string") return null;
      const hasTable = content.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |");
      const hasApplicantSummary = content.includes("Applicant Summary");
      const isEligibilityAssessment =
        (hasTable && hasApplicantSummary) ||
        ((content.includes("Personal Loan Eligibility Assessment") ||
          content.includes("Personal Loan Eligibility Result:") ||
          content.includes("Assessment Outcome: No Partner Banks Currently Eligible")) &&
         (hasApplicantSummary || hasTable));

      const isConversationalIneligibility =
        /(?:currently\s+not\s+eligible|not\s+eligible\s+for\s+(?:a\s+)?(?:personal\s+)?loan|policies\s+(?:do\s+not|may\s+not)\s+support|do\s+not\s+meet\s+(?:the\s+)?(?:eligibility|criteria)|ineligible\s+for\s+personal\s+loans?|statutory\s+age\s+criteria)/i.test(content) &&
        !/(?:\?|please\s+provide|what\s+is\s+your|could\s+you\s+share)/i.test(content);

      if (!isEligibilityAssessment && !isConversationalIneligibility) return null;

      const isWarningOrError =
        isConversationalIneligibility ||
        content.includes("No Partner Banks Currently Eligible") ||
        content.includes("Policy Criteria Not Met") ||
        content.includes("❌ NOT ELIGIBLE") ||
        content.includes("❌ Not Eligible") ||
        content.includes("Key Policy Constraints Identified") ||
        content.includes("Assessment Outcome: No Partner Banks Currently Eligible") ||
        content.includes("Input Required / Conditionally Eligible") ||
        /\b(?:not\s+eligible|currently\s+not\s+eligible|ineligible|0\s+partner\s+banks?)\b/i.test(content);

      const hasEligibleTableRows =
        hasTable && /\|\s*\*\*[^*]+\*\*\s*\|\s*✅\s*Eligible/i.test(content);

      const isSuccess = hasEligibleTableRows && !isWarningOrError;

      return {
        isEligibility: true,
        isSuccess,
      };
    }

    // A. Successful Eligible Report
    const successReport = `### 📋 Personal Loan Eligibility Assessment\n\n### 👤 Applicant Summary\n- **Employer**: Infosys\n\n| Bank | Status | CIBIL | Tenure | Est. EMI |\n| :--- | :---: | :---: | :---: | :---: |\n| **HDFC Bank** | ✅ Eligible | 750+ | 36 mo | ₹15,200 |`;
    const resSuccess = detectEligibilityResult(successReport);
    assert(resSuccess !== null && resSuccess.isSuccess === true, "Eligible report detected as SUCCESS (light-green card)");

    // B. Ineligible Table Report
    const ineligReport = `### 📋 Personal Loan Eligibility Assessment\n\n### 👤 Applicant Summary\n- **Employer**: Unlisted\n\nAssessment Outcome: No Partner Banks Currently Eligible\n\n| Bank | Status | CIBIL | Tenure | Est. EMI |\n| :--- | :---: | :---: | :---: | :---: |\n| **HDFC Bank** | ❌ Not Eligible | 750+ | 36 mo | - |`;
    const resInelig = detectEligibilityResult(ineligReport);
    assert(resInelig !== null && resInelig.isSuccess === false, "Ineligible report detected as WARNING/ERROR (light-red card)");

    // C. Natural Conversational Ineligibility (e.g. Unemployed / Underage)
    const convInelig = `I understand. If you're currently unemployed, most unsecured personal-loan policies may not support the application because they require regular income. So based on the available policies, you're currently not eligible.`;
    const resConvInelig = detectEligibilityResult(convInelig);
    assert(resConvInelig !== null && resConvInelig.isSuccess === false, "Conversational ineligibility detected as WARNING/ERROR (light-red card)");

    // D. Normal Question (Should NOT be detected as an eligibility outcome card)
    const normalQuestion = `Could you please share your monthly take-home salary in INR?`;
    const resQuestion = detectEligibilityResult(normalQuestion);
    assert(resQuestion === null, "Regular chat question is NOT treated as an eligibility result card");
  }

  console.log("\n===============================================================================");
  console.log("🎉 ALL 7 REGRESSION TEST SUITES PASSED FLAWLESSLY!");
  console.log("===============================================================================");
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
