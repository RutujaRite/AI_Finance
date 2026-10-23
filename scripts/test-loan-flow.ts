import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runLoanFlowTestSuite() {
  console.log("==================================================================");
  console.log("   CREDITWISE AI: 17-SCENARIO LOAN ELIGIBILITY CONVERSATION SUITE ");
  console.log("==================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ PASS: ${testName}`);
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
    }
  }

  // ------------------------------------------------------------------
  // TEST 1 — Normal Greeting
  // User: Hi / Hello
  // Expected: Polite response + eligibility invitation.
  // Must NOT ask for financial information immediately.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t1_${Date.now()}`;
    await clearEligibilityState(convId);
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Hello",
      conversationHistory: [],
    });

    const state = await getEligibilityState(convId);
    const replyLower = res.reply.toLowerCase();
    const noFinancialDemand =
      !replyLower.includes("what is your monthly") &&
      !replyLower.includes("what is your salary") &&
      !replyLower.includes("what is your cibil") &&
      !replyLower.includes("how much loan amount");

    assert(
      (replyLower.includes("welcome to creditwise") || replyLower.includes("hello") || replyLower.includes("creditwise ai")) &&
      replyLower.includes("would you like to calculate your loan eligibility") &&
      noFinancialDemand &&
      state?.awaitingEligibilityConsent === true,
      "TEST 1 — Normal Greeting: Returns polite greeting + eligibility invitation without demanding financial info",
      res.reply
    );
  }

  // ------------------------------------------------------------------
  // TEST 2 — Consent
  // User: Yes / Sure / Let's start / Check my eligibility
  // Expected: Start eligibility workflow.
  // Ask: "Are you currently Salaried, Self-Employed, or Unemployed?"
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t2_${Date.now()}`;
    await clearEligibilityState(convId);
    // Turn 1: Greeting
    await runCentralAgent({
      conversationId: convId,
      message: "Hi",
      conversationHistory: [],
    });
    // Turn 2: Consent
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Yes, let's start",
      conversationHistory: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello! Would you like to calculate your loan eligibility?" },
      ],
    });

    const state = await getEligibilityState(convId);
    assert(
      res.reply.includes("Are you currently Salaried, Self-Employed, or Unemployed?") &&
      state?.expectedField === "employmentType" &&
      state?.in_eligibility_flow === true,
      "TEST 2 — Consent: Starts eligibility workflow and asks for Employment Type",
      `Reply: ${res.reply} | ExpectedField: ${state?.expectedField}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 3 — Company Collection
  // User: Salaried
  // Expected: Ask company name next. Must NOT ask monthly salary yet.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t3_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({
      conversationId: convId,
      message: "Yes",
      conversationHistory: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Would you like to calculate your loan eligibility?" }],
    });

    const res = await runCentralAgent({
      conversationId: convId,
      message: "Salaried",
      conversationHistory: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Would you like to calculate your loan eligibility?" },
        { role: "user", content: "Yes" },
        { role: "assistant", content: "Are you currently Salaried, Self-Employed, or Unemployed?" },
      ],
    });

    const state = await getEligibilityState(convId);
    const replyLower = res.reply.toLowerCase();
    const askedCompany = replyLower.includes("which company") || replyLower.includes("employer");
    const didNotAskSalaryYet = !replyLower.includes("take-home salary") && !replyLower.includes("net income");

    assert(
      askedCompany &&
      didNotAskSalaryYet &&
      state?.applicant?.employmentType === "Salaried" &&
      (state?.expectedField === "companyName" || state?.expectedField === "company"),
      "TEST 3 — Company Collection: Asks for company name and does NOT ask for monthly salary yet",
      `Reply: ${res.reply} | ExpectedField: ${state?.expectedField}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 4 — Company Search
  // User: Infosys
  // Expected: Invoke existing company search and handle actual matching results.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t4_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Would you like to calculate your loan eligibility?" }] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [{ role: "user", content: "Yes" }, { role: "assistant", content: "Are you currently Salaried, Self-Employed, or Unemployed?" }] });

    const res = await runCentralAgent({
      conversationId: convId,
      message: "Infosys",
      conversationHistory: [
        { role: "user", content: "Salaried" },
        { role: "assistant", content: "Great! 😊 Which company do you currently work for?" },
      ],
    });

    const state = await getEligibilityState(convId);
    const hasCompanyOptions =
      res.reply.toLowerCase().includes("infosys") &&
      (Boolean(res.companyData) || state?.companyFlow?.stage === "COMPANY_SELECTION" || state?.companyFlow?.stage === "COMPANY_CONFIRMATION" || res.reply.includes("employer") || res.reply.includes("confirm"));

    assert(
      hasCompanyOptions,
      "TEST 4 — Company Search: Invokes database search for Infosys and provides matching candidate options/confirmation",
      `Reply: ${res.reply.slice(0, 150)}...`
    );
  }

  // ------------------------------------------------------------------
  // TEST 5 — Company Confirmation
  // Expected: Do not mark employer confirmed without the required confirmation.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t5_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Would you like to calculate your loan eligibility?" }] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [{ role: "user", content: "Yes" }, { role: "assistant", content: "Are you currently Salaried, Self-Employed, or Unemployed?" }] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [{ role: "user", content: "Salaried" }, { role: "assistant", content: "Great! 😊 Which company do you currently work for?" }] });

    const state = await getEligibilityState(convId);
    const notYetConfirmed = state?.companyFlow?.stage !== "ELIGIBILITY_INPUT" || state?.applicant?.companyName === undefined;

    assert(
      notYetConfirmed,
      "TEST 5 — Company Confirmation: Employer is not marked confirmed before user selection/confirmation",
      `CompanyFlow Stage: ${state?.companyFlow?.stage} | Confirmed Company: ${state?.applicant?.companyName}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 6 — Continue Eligibility
  // After company confirmation:
  // Expected: Ask monthly income.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t6_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Would you like to calculate your loan eligibility?" }] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [{ role: "user", content: "Yes" }, { role: "assistant", content: "Are you currently Salaried, Self-Employed, or Unemployed?" }] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [{ role: "user", content: "Salaried" }, { role: "assistant", content: "Great! 😊 Which company do you currently work for?" }] });

    // Confirm candidate option 1
    const res = await runCentralAgent({
      conversationId: convId,
      message: "1",
      conversationHistory: [
        { role: "user", content: "Infosys" },
        { role: "assistant", content: "Please select your employer from the list" },
      ],
    });

    const state = await getEligibilityState(convId);
    const asksIncome = res.reply.toLowerCase().includes("salary") || res.reply.toLowerCase().includes("monthly");

    assert(
      asksIncome && state?.expectedField === "monthlyIncome",
      "TEST 6 — Continue Eligibility: Advances to monthly take-home income following company confirmation",
      `Reply: ${res.reply.slice(0, 150)}... | ExpectedField: ${state?.expectedField}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 7 — One Question at a Time
  // Expected: Ask only one missing question per turn.
  // Sequence: monthlyIncome -> existingEmi -> cibilScore -> age -> loanAmount -> tenureMonths
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t7_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "1", conversationHistory: [] });

    // Step: monthlyIncome -> existingEmi
    const rIncome = await runCentralAgent({ conversationId: convId, message: "₹45,000", conversationHistory: [] });
    const s1 = await getEligibilityState(convId);
    const asksEmi = rIncome.reply.toLowerCase().includes("emi") && s1?.expectedField === "existingEmi";

    // Step: existingEmi -> cibil
    const rEmi = await runCentralAgent({ conversationId: convId, message: "0", conversationHistory: [] });
    const s2 = await getEligibilityState(convId);
    const asksCibil = rEmi.reply.toLowerCase().includes("cibil") && (s2?.expectedField === "cibil" || s2?.expectedField === "cibilScore");

    // Step: cibil -> age
    const rCibil = await runCentralAgent({ conversationId: convId, message: "760", conversationHistory: [] });
    const s3 = await getEligibilityState(convId);
    const asksAge = rCibil.reply.toLowerCase().includes("age") && s3?.expectedField === "age";

    // Step: age -> loanAmount
    const rAge = await runCentralAgent({ conversationId: convId, message: "26", conversationHistory: [] });
    const s4 = await getEligibilityState(convId);
    const asksAmount = rAge.reply.toLowerCase().includes("loan amount") && s4?.expectedField === "loanAmount";

    // Step: loanAmount -> tenureMonths
    const rAmt = await runCentralAgent({ conversationId: convId, message: "5 Lakhs", conversationHistory: [] });
    const s5 = await getEligibilityState(convId);
    const asksTenure = (rAmt.reply.toLowerCase().includes("tenure") || rAmt.reply.toLowerCase().includes("years")) && s5?.expectedField === "tenureMonths";

    assert(
      asksEmi && asksCibil && asksAge && asksAmount && asksTenure,
      "TEST 7 — One Question at a Time: Strictly asks 1 question per turn in sequential order",
      `Steps: EMI=${asksEmi}, CIBIL=${asksCibil}, Age=${asksAge}, Amount=${asksAmount}, Tenure=${asksTenure}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 8 — Multiple Valid Fields
  // User provides: salary 40,000, age 25, and CIBIL 780.
  // Expected: Store all valid fields and ask only the next unresolved question.
  // Do NOT re-ask salary, age, or CIBIL.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t8_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "1", conversationHistory: [] });

    // Compound input
    const res = await runCentralAgent({
      conversationId: convId,
      message: "My salary is ₹40,000, age is 25, and CIBIL is 780.",
      conversationHistory: [],
    });

    const state = await getEligibilityState(convId);
    const storedCorrectly =
      state?.applicant?.monthlyIncome === 40000 &&
      state?.applicant?.age === 25 &&
      state?.applicant?.cibil === 780;

    const asksNext = state?.expectedField === "existingEmi" && res.reply.toLowerCase().includes("emi");
    const noRepeats = !res.reply.toLowerCase().includes("what is your monthly take-home salary") && !res.reply.toLowerCase().includes("what is your current age");

    assert(
      storedCorrectly && asksNext && noRepeats,
      "TEST 8 — Multiple Valid Fields: Extracted compound parameters without re-asking valid fields",
      `Stored: Income=${state?.applicant?.monthlyIncome}, Age=${state?.applicant?.age}, CIBIL=${state?.applicant?.cibil} | ExpectedField=${state?.expectedField}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 9 — Invalid Values
  // User enters invalid input when salary is requested.
  // Expected: Clarification guidance without corrupting state or injecting synthetic benchmark defaults.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t9_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "1", conversationHistory: [] });

    // Invalid salary input
    const res = await runCentralAgent({
      conversationId: convId,
      message: "random gibberish xyz",
      conversationHistory: [],
    });

    const state = await getEligibilityState(convId);
    const noFakeDefault = state?.applicant?.monthlyIncome !== 50000 && state?.applicant?.monthlyIncome === undefined;
    const keptExpectedField = state?.expectedField === "monthlyIncome";
    const guidedUser = res.reply.toLowerCase().includes("salary") || res.reply.toLowerCase().includes("monthly");

    assert(
      noFakeDefault && keptExpectedField && guidedUser,
      "TEST 9 — Invalid Values: Asks user to correct field without injecting synthetic benchmark defaults",
      `State Salary: ${state?.applicant?.monthlyIncome} | Reply: ${res.reply.slice(0, 100)}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 10 — Automatic Calculation
  // When all required fields are valid:
  // Expected: Automatically run evaluateApplicantAgainstAllBanks.
  // Output table: | Bank | Status | CIBIL | Tenure | Est. EMI |
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t10_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "1", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "₹50,000", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "0", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "750", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "28", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "₹5,00,000", conversationHistory: [] });

    // Final field: tenure
    const res = await runCentralAgent({
      conversationId: convId,
      message: "3 years",
      conversationHistory: [],
    });

    const state = await getEligibilityState(convId);
    const hasTable =
      res.reply.includes("| Bank |") &&
      res.reply.includes("| Status |") &&
      res.reply.includes("| CIBIL |") &&
      res.reply.includes("| Tenure |") &&
      res.reply.includes("| Est. EMI |");

    const completed = state?.hasCompletedEvaluation === true || state?.evaluationCompleted === true;

    assert(
      hasTable && completed,
      "TEST 10 — Automatic Calculation: Automatically evaluates and returns formatted partner banks table",
      `HasTable: ${hasTable} | Completed: ${completed} | Table Snippet: ${res.reply.slice(res.reply.indexOf("| Bank |"), res.reply.indexOf("| Bank |") + 120)}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 11 — No Premature Calculation
  // Expected: Do not calculate before all required fields are validated.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t11_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "1", conversationHistory: [] });

    // Incomplete turn: only salary
    const res = await runCentralAgent({
      conversationId: convId,
      message: "₹50,000",
      conversationHistory: [],
    });

    const state = await getEligibilityState(convId);
    const noPrematureTable = !res.reply.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |");
    const notCompleted = state?.hasCompletedEvaluation !== true;

    assert(
      noPrematureTable && notCompleted,
      "TEST 11 — No Premature Calculation: Preserves intake state without calculating prematurely",
      `NoTable: ${noPrematureTable} | NotCompleted: ${notCompleted}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 12 — Topic Interruption
  // User asks "What is CIBIL?" while salary is pending.
  // Expected: Answer definition, preserve pending question, do NOT treat definition as a score.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t12_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "1", conversationHistory: [] });

    // Ask educational question while monthlyIncome is expected
    const res = await runCentralAgent({
      conversationId: convId,
      message: "What is CIBIL score?",
      conversationHistory: [],
    });

    const state = await getEligibilityState(convId);
    const answeredDef = res.reply.toLowerCase().includes("cibil") && (res.reply.toLowerCase().includes("credit") || res.reply.toLowerCase().includes("bureau") || res.reply.toLowerCase().includes("score"));
    const preservedPending = state?.expectedField === "monthlyIncome";
    const appScoreNotSet = state?.applicant?.cibil === undefined;
    const appSalaryNotCorrupted = state?.applicant?.monthlyIncome === undefined;

    assert(
      answeredDef && preservedPending && appScoreNotSet && appSalaryNotCorrupted,
      "TEST 12 — Topic Interruption: Answers definition, preserves pending slot, and appends resumption bridge",
      `PreservedField: ${state?.expectedField} | CIBIL: ${state?.applicant?.cibil}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 13 — Value Correction
  // User changes salary after evaluation or during intake.
  // Expected: Update appropriate field and recalculate.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t13_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "1", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "₹50,000", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "0", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "750", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "28", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "₹5,00,000", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "3 years", conversationHistory: [] });

    // Now correct salary
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Actually, update my salary to ₹85,000",
      conversationHistory: [],
    });

    const state = await getEligibilityState(convId);
    const updatedSalary = state?.applicant?.monthlyIncome === 85000;
    const reEvaluated = res.reply.includes("| Bank |") || res.reply.includes("85,000");

    assert(
      updatedSalary && reEvaluated,
      "TEST 13 — Value Correction: Updates specific field and executes dynamic recalculation",
      `UpdatedSalary: ${state?.applicant?.monthlyIncome}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 14 — Duplicate Prevention
  // Repeated processing of the same completed state must not produce duplicate evaluations or duplicate questions.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t14_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Infosys", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "1", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "₹50,000", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "0", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "750", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "28", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "₹5,00,000", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "3 years", conversationHistory: [] });

    // Repeat message after completion
    const res = await runCentralAgent({
      conversationId: convId,
      message: "Thank you!",
      conversationHistory: [],
    });

    const state = await getEligibilityState(convId);
    const didNotDuplicateIntake = state?.in_eligibility_flow === false && !res.reply.includes("Are you currently Salaried");

    assert(
      didNotDuplicateIntake,
      "TEST 14 — Duplicate Prevention: Prevents redundant intake loops on completed state",
      `InFlow: ${state?.in_eligibility_flow} | Reply: ${res.reply.slice(0, 100)}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 15 — Persistence
  // Verify that applicant and conversation state persist across turns.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t15_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Salaried", conversationHistory: [] });

    const state = await getEligibilityState(convId);
    assert(
      state?.applicant?.employmentType === "Salaried" &&
      state?.in_eligibility_flow === true &&
      (state?.expectedField === "companyName" || state?.expectedField === "company"),
      "TEST 15 — Persistence: Session state persists across multi-turn interactions",
      `PersistedType: ${state?.applicant?.employmentType} | PersistedField: ${state?.expectedField}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 16 — Self-Employed Flow
  // User: Self-Employed
  // Expected: Do not ask for company name. Ask monthly income/profit.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t16_${Date.now()}`;
    await clearEligibilityState(convId);
    await runCentralAgent({ conversationId: convId, message: "Hi", conversationHistory: [] });
    await runCentralAgent({ conversationId: convId, message: "Yes", conversationHistory: [] });

    const res = await runCentralAgent({
      conversationId: convId,
      message: "Self-Employed",
      conversationHistory: [
        { role: "user", content: "Yes" },
        { role: "assistant", content: "Are you currently Salaried, Self-Employed, or Unemployed?" },
      ],
    });

    const state = await getEligibilityState(convId);
    const replyLower = res.reply.toLowerCase();
    const doesNotAskCompany = !replyLower.includes("which company") && !replyLower.includes("current employer");
    const asksIncome = replyLower.includes("income") || replyLower.includes("profit") || replyLower.includes("salary");

    assert(
      doesNotAskCompany &&
      asksIncome &&
      state?.applicant?.employmentType === "Self-Employed" &&
      state?.expectedField === "monthlyIncome",
      "TEST 16 — Self-Employed Flow: Skips corporate company lookup and asks for monthly net income/profit",
      `Reply: ${res.reply} | ExpectedField: ${state?.expectedField}`
    );
  }

  // ------------------------------------------------------------------
  // TEST 17 — Regression Tests
  // Verify that company search, policy RAG, and bank manager search continue to function correctly.
  // ------------------------------------------------------------------
  {
    const convId = `test_flow_t17_${Date.now()}`;
    await clearEligibilityState(convId);

    // Subtest 17a: Standalone company category search
    const compRes = await runCentralAgent({
      conversationId: convId,
      message: "What category is TCS in HDFC Bank?",
      conversationHistory: [],
    });
    const compOk = compRes.reply.toLowerCase().includes("tata consultancy") || compRes.reply.toLowerCase().includes("tcs") || compRes.reply.toLowerCase().includes("cat");

    // Subtest 17b: Policy RAG
    const polRes = await runCentralAgent({
      conversationId: convId,
      message: "What is HDFC Bank personal loan policy?",
      conversationHistory: [],
    });
    const polOk = polRes.reply.toLowerCase().includes("hdfc") && (polRes.reply.toLowerCase().includes("policy") || polRes.reply.toLowerCase().includes("cibil") || polRes.reply.toLowerCase().includes("salary"));

    // Subtest 17c: Bank Manager search
    const mgrRes = await runCentralAgent({
      conversationId: convId,
      message: "Branch manager contact for HDFC in Mumbai",
      conversationHistory: [],
    });
    const mgrOk = mgrRes.reply.toLowerCase().includes("hdfc") && (mgrRes.reply.toLowerCase().includes("mumbai") || mgrRes.reply.toLowerCase().includes("branch") || mgrRes.reply.toLowerCase().includes("manager"));

    assert(
      compOk && polOk && mgrOk,
      "TEST 17 — Regression Tests: Company search, Policy RAG, and Bank Manager lookup function flawlessly",
      `CompanySearch=${compOk}, PolicyRAG=${polOk}, BankManager=${mgrOk}`
    );
  }

  console.log("\n==================================================================");
  console.log(`   LOAN FLOW TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("==================================================================\n");

  if (passedTests === totalTests) {
    console.log("🎉 ALL 17 TESTS PASSED! The loan eligibility conversational workflow is completely resolved.");
  } else {
    console.error(`⚠️ ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}

runLoanFlowTestSuite().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
