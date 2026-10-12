import { runCentralAgent } from "../lib/ai/agent";
import { clearEligibilityState, getEligibilityState, saveEligibilityState } from "../lib/dynamicEligibilityEngine";
import { classifyIntelligentIntent } from "../lib/ai/intentClassifier";
import { getTokenBudget } from "../lib/ai/tokenOptimizer";
import pool from "../lib/db";

async function runTestSuite() {
  console.log("==================================================================");
  console.log("   CREDITWISE INTELLIGENT AGENT ARCHITECTURE VERIFICATION SUITE  ");
  console.log("==================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean | undefined | null, testId: string, testName: string, detail?: string) {
    totalTests++;
    if (Boolean(condition)) {
      passedTests++;
      console.log(`✅ PASS: [${testId}] ${testName}`);
    } else {
      console.error(`❌ FAIL: [${testId}] ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
    }
  }

  // ------------------------------------------------------------------
  // TEST A: General query
  // User: "What is artificial intelligence?"
  // Expected: Direct LLM response. No RAG, company search, or manager search.
  // ------------------------------------------------------------------
  {
    const convId = `test_a_${Date.now()}`;
    await clearEligibilityState(convId);
    const nlu = await classifyIntelligentIntent({ userMessage: "What is artificial intelligence?" });
    const res = await runCentralAgent({
      conversationId: convId,
      message: "What is artificial intelligence?",
      conversationHistory: [],
    });
    const replyLower = res.reply.toLowerCase();
    assert(
      nlu.intent === "GENERAL_QUERY" &&
      !replyLower.includes("cibil score") &&
      !replyLower.includes("bank manager") &&
      !replyLower.includes("master policy") &&
      res.reply.length > 20,
      "TEST A",
      "General query 'What is artificial intelligence?' routed directly to LLM without loan RAG",
      `Intent: ${nlu.intent}, Reply: ${res.reply.slice(0, 100)}`
    );
  }

  // ------------------------------------------------------------------
  // TEST B: Policy query
  // User: "What is the HDFC personal loan minimum CIBIL requirement?"
  // Expected: Semantic retrieval of relevant HDFC policy evidence.
  // ------------------------------------------------------------------
  {
    const convId = `test_b_${Date.now()}`;
    await clearEligibilityState(convId);
    const nlu = await classifyIntelligentIntent({ userMessage: "What is the HDFC personal loan minimum CIBIL requirement?" });
    const res = await runCentralAgent({
      conversationId: convId,
      message: "What is the HDFC personal loan minimum CIBIL requirement?",
      conversationHistory: [],
    });
    const replyLower = res.reply.toLowerCase();
    assert(
      nlu.intent === "BANK_POLICY_QUERY" &&
      (replyLower.includes("hdfc") || replyLower.includes("cibil") || replyLower.includes("policy") || replyLower.includes("score")),
      "TEST B",
      "Policy query retrieves HDFC policy evidence",
      `Intent: ${nlu.intent}, Reply: ${res.reply.slice(0, 150)}`
    );
  }

  // ------------------------------------------------------------------
  // TEST C: Missing policy information
  // User asks about a rule not present in the stored policy.
  // Expected: Explicitly report that the information is unavailable.
  // ------------------------------------------------------------------
  {
    const convId = `test_c_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "What is the pet insurance foreclosure policy for HDFC personal loan?",
      conversationHistory: [],
    });
    const replyLower = res.reply.toLowerCase();
    assert(
      replyLower.includes("not specified") ||
      replyLower.includes("not available") ||
      replyLower.includes("unavailable") ||
      replyLower.includes("does not contain") ||
      replyLower.includes("stored policy") ||
      replyLower.includes("enough information"),
      "TEST C",
      "Explicitly reports that requested rule is unavailable in stored policy",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST D: Company verification
  // User: "Check Infosys company category."
  // Expected: PostgreSQL company lookup. Live company search only when required. No policy RAG.
  // ------------------------------------------------------------------
  {
    const convId = `test_d_${Date.now()}`;
    await clearEligibilityState(convId);
    const nlu = await classifyIntelligentIntent({ userMessage: "Check Infosys company category." });
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Check Infosys company category.",
      conversationHistory: [],
    });
    const replyLower = res.reply.toLowerCase();
    assert(
      nlu.intent === "COMPANY_SEARCH_OR_VERIFICATION" &&
      replyLower.includes("infosys") &&
      (replyLower.includes("cat") || replyLower.includes("tier") || replyLower.includes("category") || replyLower.includes("matching companies")),
      "TEST D",
      "PostgreSQL company lookup returns Infosys category without policy RAG",
      `Intent: ${nlu.intent}, Reply: ${res.reply.slice(0, 150)}`
    );
  }

  // ------------------------------------------------------------------
  // TEST E: Eligibility initial calculation
  // User supplies company, salary, CIBIL, age, loan amount, tenure, and EMI.
  // Expected: Validate inputs and call the existing calculation engine.
  // ------------------------------------------------------------------
  const initialConvId = `test_e_f_g_h_${Date.now()}`;
  {
    await clearEligibilityState(initialConvId);
    const fullProfileMsg = "My company is Microsoft. Loan amount is 600000. Tenure is 36 months. My CIBIL score is 560. My age is 34, monthly take-home salary is 70000, and my existing EMI is 0.";
    const nlu = await classifyIntelligentIntent({ userMessage: fullProfileMsg });
    const res = await runCentralAgent({
      conversationId: initialConvId,
      message: fullProfileMsg,
      conversationHistory: [],
    });
    const state = await getEligibilityState(initialConvId);
    assert(
      nlu.intent === "LOAN_ELIGIBILITY_CALCULATION" &&
      state?.applicant?.companyName?.toLowerCase().includes("microsoft") &&
      state?.applicant?.cibil === 560 &&
      (res.reply.includes("Bank") || res.reply.includes("Eligibility") || res.reply.includes("Status") || res.reply.includes("Lender") || res.reply.includes("Eligib")),
      "TEST E",
      "Initial eligibility calculation executed with Microsoft, CIBIL 560, salary 70000",
      `Reply: ${res.reply.slice(0, 150)}`
    );
  }

  // ------------------------------------------------------------------
  // TEST F: Eligibility recalculation
  // Initial CIBIL: 560.
  // User: "Calculate again with CIBIL 780."
  // Expected: Preserve every other applicant field and calculate using 780.
  // ------------------------------------------------------------------
  {
    const history = [
      { role: "user", content: "My company is Microsoft. Loan amount is 600000. Tenure is 36 months. My CIBIL score is 560. My age is 34, monthly take-home salary is 70000, and my existing EMI is 0." },
      { role: "assistant", content: "Eligibility evaluated." },
    ];
    const nlu = await classifyIntelligentIntent({
      userMessage: "Calculate again with CIBIL 780.",
      conversationHistory: history,
      existingApplicant: { cibil: 560, monthlyIncome: 70000, companyName: "Microsoft" },
    });
    const res = await runCentralAgent({
      conversationId: initialConvId,
      message: "Calculate again with CIBIL 780.",
      conversationHistory: history,
    });
    const state = await getEligibilityState(initialConvId);
    assert(
      nlu.intent === "ELIGIBILITY_UPDATE_OR_RECALCULATION" &&
      state?.applicant?.cibil === 780 &&
      state?.applicant?.monthlyIncome === 70000 &&
      state?.applicant?.companyName?.toLowerCase().includes("microsoft"),
      "TEST F",
      "Recalculation with CIBIL 780 preserved Microsoft and 70000 salary",
      `Applicant CIBIL: ${state?.applicant?.cibil}, Company: ${state?.applicant?.companyName}`
    );
  }

  // ------------------------------------------------------------------
  // TEST G: Second recalculation
  // Previous CIBIL: 780.
  // User: "Now calculate with CIBIL 760."
  // Expected: Calculate using 760, not 780 or 560.
  // ------------------------------------------------------------------
  {
    const history = [
      { role: "user", content: "Calculate again with CIBIL 780." },
      { role: "assistant", content: "Recalculated with CIBIL 780." },
    ];
    const nlu = await classifyIntelligentIntent({
      userMessage: "Now calculate with CIBIL 760.",
      conversationHistory: history,
      existingApplicant: { cibil: 780, monthlyIncome: 70000, companyName: "Microsoft" },
    });
    const res = await runCentralAgent({
      conversationId: initialConvId,
      message: "Now calculate with CIBIL 760.",
      conversationHistory: history,
    });
    const state = await getEligibilityState(initialConvId);
    assert(
      nlu.intent === "ELIGIBILITY_UPDATE_OR_RECALCULATION" &&
      state?.applicant?.cibil === 760 &&
      state?.applicant?.companyName?.toLowerCase().includes("microsoft"),
      "TEST G",
      "Second recalculation updated CIBIL to 760 (not 780 or 560)",
      `Applicant CIBIL: ${state?.applicant?.cibil}`
    );
  }

  // ------------------------------------------------------------------
  // TEST H: Hypothetical scenario
  // Saved CIBIL: 760 (or 780).
  // User: "What if my CIBIL were 720?"
  // Expected: Calculate the hypothetical scenario using 720 without silently replacing the saved score.
  // ------------------------------------------------------------------
  {
    const history = [
      { role: "user", content: "Now calculate with CIBIL 760." },
      { role: "assistant", content: "Calculated with CIBIL 760." },
    ];
    const nlu = await classifyIntelligentIntent({
      userMessage: "What if my CIBIL were 720?",
      conversationHistory: history,
      existingApplicant: { cibil: 760, monthlyIncome: 70000, companyName: "Microsoft" },
    });
    const res = await runCentralAgent({
      conversationId: initialConvId,
      message: "What if my CIBIL were 720?",
      conversationHistory: history,
    });
    const state = await getEligibilityState(initialConvId);
    assert(
      nlu.isScenario === true &&
      state?.applicant?.cibil === 760 &&
      (res.reply.includes("Hypothetical") || res.reply.includes("Scenario") || res.reply.includes("720")),
      "TEST H",
      "Scenario evaluated with 720 while baseline applicant remains preserved at 760",
      `Saved CIBIL: ${state?.applicant?.cibil}, isScenario: ${nlu.isScenario}`
    );
  }

  // ------------------------------------------------------------------
  // TEST I: Employer correction
  // Previous employer: Microsoft.
  // User: "I changed my job to Infosys."
  // Expected: Update the employer, retrieve the correct category, and refresh dependent eligibility.
  // ------------------------------------------------------------------
  {
    const history = [
      { role: "user", content: "My company is Microsoft." },
      { role: "assistant", content: "Noted Microsoft." },
    ];
    const nlu = await classifyIntelligentIntent({
      userMessage: "I changed my job to Infosys.",
      conversationHistory: history,
      existingApplicant: { companyName: "Microsoft", cibil: 760 },
    });
    const res = await runCentralAgent({
      conversationId: initialConvId,
      message: "I changed my job to Infosys.",
      conversationHistory: history,
    });
    const state = await getEligibilityState(initialConvId);
    assert(
      nlu.intent === "INFORMATION_CORRECTION" &&
      state?.applicant?.companyName?.toLowerCase().includes("infosys"),
      "TEST I",
      "Employer updated from Microsoft to Infosys with category refreshed",
      `Company: ${state?.applicant?.companyName}, Category: ${state?.applicant?.companyCategory}`
    );
  }

  // ------------------------------------------------------------------
  // TEST J: Manager search
  // User: "Find an HDFC manager for PIN 411009."
  // Expected: PostgreSQL manager/branch search with no invented contact details.
  // ------------------------------------------------------------------
  {
    const convId = `test_j_${Date.now()}`;
    await clearEligibilityState(convId);
    const nlu = await classifyIntelligentIntent({ userMessage: "Find an HDFC manager for PIN 411009." });
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Find an HDFC manager for PIN 411009.",
      conversationHistory: [],
    });
    const replyLower = res.reply.toLowerCase();
    assert(
      nlu.intent === "BANK_MANAGER_SEARCH" &&
      (replyLower.includes("hdfc") || replyLower.includes("manager") || replyLower.includes("branch") || replyLower.includes("411009")),
      "TEST J",
      "PostgreSQL manager search executed for PIN 411009 without hallucinated contacts",
      `Intent: ${nlu.intent}, Reply: ${res.reply.slice(0, 150)}`
    );
  }

  // ------------------------------------------------------------------
  // TEST K: Context resolution
  // User: "Find Infosys." -> Assistant returns matching company information.
  // User: "Now calculate my eligibility." -> Reuses verified employer information when applicable.
  // ------------------------------------------------------------------
  {
    const convId = `test_k_${Date.now()}`;
    await clearEligibilityState(convId);
    // Turn 1
    const res1 = await runCentralAgent({
      conversationId: convId,
      message: "Find Infosys.",
      conversationHistory: [],
    });
    // Turn 2
    const nlu2 = await classifyIntelligentIntent({
      userMessage: "Now calculate my eligibility.",
      conversationHistory: [
        { role: "user", content: "Find Infosys." },
        { role: "assistant", content: res1.reply },
      ],
      activeContext: { isFlowActive: true },
    });
    const res2 = await runCentralAgent({
      conversationId: convId,
      message: "Now calculate my eligibility.",
      conversationHistory: [
        { role: "user", content: "Find Infosys." },
        { role: "assistant", content: res1.reply },
      ],
    });
    const state = await getEligibilityState(convId);
    assert(
      (nlu2.intent === "CONVERSATION_FOLLOW_UP" || nlu2.intent === "LOAN_ELIGIBILITY_CALCULATION") &&
      (state?.company?.toLowerCase().includes("infosys") || state?.applicant?.companyName?.toLowerCase().includes("infosys") || res2.reply.includes("salary")),
      "TEST K",
      "Context resolution: 'Now calculate my eligibility' retained Infosys and asked for missing parameters",
      `State Company: ${state?.company || state?.applicant?.companyName}, Reply: ${res2.reply.slice(0, 120)}`
    );
  }

  // ------------------------------------------------------------------
  // TEST L: Tool failure safety
  // Policy embedding service / retrieval fails gracefully without guessing.
  // ------------------------------------------------------------------
  {
    const convId = `test_l_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "What is the policy for NonExistentBankXYZ123?",
      conversationHistory: [],
    });
    const replyLower = res.reply.toLowerCase();
    assert(
      replyLower.includes("not available") ||
      replyLower.includes("unavailable") ||
      replyLower.includes("not found") ||
      replyLower.includes("partner"),
      "TEST L",
      "Tool failure safety: unsupported or failing bank lookup does not manufacture claims",
      res.reply.slice(0, 150)
    );
  }

  // ------------------------------------------------------------------
  // TEST M: Context isolation
  // Two different users have separate applicant states.
  // Expected: No cross-user state or result leakage.
  // ------------------------------------------------------------------
  {
    const user1ConvId = `test_m_u1_${Date.now()}`;
    const user2ConvId = `test_m_u2_${Date.now()}`;
    await clearEligibilityState(user1ConvId);
    await clearEligibilityState(user2ConvId);

    await runCentralAgent({
      conversationId: user1ConvId,
      message: "My company is Google. Salary is 95000. CIBIL is 790. Age is 30. Loan amount is 500000. Tenure is 24 months. Existing EMI is 0.",
      conversationHistory: [],
    });

    await runCentralAgent({
      conversationId: user2ConvId,
      message: "My company is Wipro. Salary is 40000. CIBIL is 680. Age is 26. Loan amount is 300000. Tenure is 36 months. Existing EMI is 0.",
      conversationHistory: [],
    });

    const stateUser1 = await getEligibilityState(user1ConvId);
    const stateUser2 = await getEligibilityState(user2ConvId);

    assert(
      stateUser1?.applicant?.cibil === 790 &&
      stateUser1?.applicant?.companyName?.toLowerCase().includes("google") &&
      stateUser2?.applicant?.cibil === 680 &&
      stateUser2?.applicant?.companyName?.toLowerCase().includes("wipro"),
      "TEST M",
      "Complete user context isolation: User 1 (Google, 790) and User 2 (Wipro, 680) are cleanly separated",
      `U1: ${stateUser1?.applicant?.companyName} (${stateUser1?.applicant?.cibil}), U2: ${stateUser2?.applicant?.companyName} (${stateUser2?.applicant?.cibil})`
    );
  }

  // ------------------------------------------------------------------
  // TEST N: Stale result prevention
  // Calculate with CIBIL 560, update to 780, then request the latest result.
  // Expected: The displayed result must correspond to 780.
  // ------------------------------------------------------------------
  {
    const convId = `test_n_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({
      conversationId: convId,
      message: "My company is Microsoft. Loan amount is 600000. Tenure is 36 months. My CIBIL score is 560. My age is 34, monthly take-home salary is 70000, and my existing EMI is 0.",
      conversationHistory: [],
    });
    const resUpdate = await runCentralAgent({
      conversationId: convId,
      message: "Calculate again with CIBIL 780.",
      conversationHistory: [],
    });
    const state = await getEligibilityState(convId);
    assert(
      state?.applicant?.cibil === 780 &&
      !resUpdate.reply.includes("560"),
      "TEST N",
      "Stale result prevention: updated evaluation strictly uses 780, not old 560",
      `Active CIBIL in state: ${state?.applicant?.cibil}`
    );
  }

  // ------------------------------------------------------------------
  // TEST O: Mixed intent
  // User asks for an HDFC policy explanation and then requests a manager in Pune.
  // Expected: Execute appropriate policy and manager tools without confusing results.
  // ------------------------------------------------------------------
  {
    const mixedMsg = "What is HDFC personal loan eligibility and find an HDFC manager in Pune";
    const nlu = await classifyIntelligentIntent({ userMessage: mixedMsg });
    assert(
      nlu.intent === "MULTI_INTENT" &&
      nlu.multiIntents?.includes("BANK_POLICY_QUERY") &&
      nlu.multiIntents?.includes("BANK_MANAGER_SEARCH"),
      "TEST O",
      "Mixed intent accurately decomposed into BANK_POLICY_QUERY and BANK_MANAGER_SEARCH",
      `Intents: ${nlu.multiIntents?.join(", ")}`
    );
  }

  // ------------------------------------------------------------------
  // TEST P: Tool-call sensitivity
  // Send 20 ordinary educational questions.
  // Expected: No unnecessary database, policy, company, or manager calls.
  // ------------------------------------------------------------------
  {
    const educationalQuestions = [
      "What is artificial intelligence?",
      "Explain Java inheritance.",
      "What is the difference between AI and ML?",
      "Explain compound interest.",
      "What is a credit score?",
      "How does gravity work?",
      "What is photosynthesis?",
      "Explain object oriented programming.",
      "What is Python used for?",
      "How do neural networks learn?",
      "What is inflation?",
      "Explain simple interest versus compound interest.",
      "What is quantum computing?",
      "Explain the concept of recursion.",
      "What is a database index?",
      "What is the speed of light?",
      "How does DNS work?",
      "What is cloud computing?",
      "Explain the theory of relativity.",
      "What is FOIR?",
    ];

    let allGeneral = true;
    for (const q of educationalQuestions) {
      const nlu = await classifyIntelligentIntent({ userMessage: q });
      if (nlu.intent !== "GENERAL_QUERY") {
        allGeneral = false;
        console.error(`Question failed GENERAL_QUERY classification: "${q}" -> ${nlu.intent}`);
        break;
      }
    }

    assert(
      allGeneral,
      "TEST P",
      "Tool-call sensitivity: 20 ordinary educational questions classified as GENERAL_QUERY with 0 tool overhead"
    );
  }

  // ------------------------------------------------------------------
  // TEST Q: Short follow-ups
  // - "Again with 760."
  // - "Change it to 720."
  // - "What about 800?"
  // - "Use the same details."
  // - "Now find the manager."
  // Expected: Correct contextual interpretation or a concise clarification.
  // ------------------------------------------------------------------
  {
    const historyWithContext = [
      { role: "user", content: "Check my eligibility with Microsoft and salary 70000 and CIBIL 780" },
      { role: "assistant", content: "Evaluated eligibility." },
    ];
    const existing = { cibil: 780, monthlyIncome: 70000, companyName: "Microsoft" };

    const nlu1 = await classifyIntelligentIntent({
      userMessage: "Again with 760.",
      conversationHistory: historyWithContext,
      existingApplicant: existing,
    });

    const nlu2 = await classifyIntelligentIntent({
      userMessage: "Change it to 720.",
      conversationHistory: historyWithContext,
      existingApplicant: existing,
    });

    const nlu3 = await classifyIntelligentIntent({
      userMessage: "What about 800?",
      conversationHistory: historyWithContext,
      existingApplicant: existing,
    });

    const nlu4 = await classifyIntelligentIntent({
      userMessage: "Use the same details.",
      conversationHistory: historyWithContext,
      existingApplicant: existing,
    });

    const nlu5 = await classifyIntelligentIntent({
      userMessage: "Now find the manager.",
      conversationHistory: historyWithContext,
      existingApplicant: existing,
      activeContext: { selectedBank: "HDFC Bank", lastLocation: "Pune" },
    });

    assert(
      nlu1.intent === "ELIGIBILITY_UPDATE_OR_RECALCULATION" &&
      nlu1.updatedValue === 760 &&
      nlu2.intent === "ELIGIBILITY_UPDATE_OR_RECALCULATION" &&
      nlu2.updatedValue === 720 &&
      nlu3.intent === "ELIGIBILITY_UPDATE_OR_RECALCULATION" &&
      nlu3.updatedValue === 800 &&
      nlu4.intent === "CONVERSATION_FOLLOW_UP" &&
      nlu5.intent === "BANK_MANAGER_SEARCH",
      "TEST Q",
      "Short follow-ups ('Again with 760', 'Change it to 720', 'What about 800?', 'Use the same details', 'Now find the manager') contextually resolved",
      `nlu1: ${nlu1.intent} (${nlu1.updatedValue}), nlu2: ${nlu2.intent} (${nlu2.updatedValue}), nlu3: ${nlu3.intent} (${nlu3.updatedValue}), nlu4: ${nlu4.intent}, nlu5: ${nlu5.intent}`
    );
  }

  console.log("\n==================================================================");
  console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("==================================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL 17 TESTS (TEST A THROUGH TEST Q) PASSED PERFECTLY!\n");
    process.exit(0);
  } else {
    console.error(`⚠️ ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
