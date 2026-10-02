import assert from "assert";
import { runCentralAgent } from "../lib/ai/agent";
import {
  getEligibilityState,
  clearEligibilityState,
  saveEligibilityState,
  SessionState,
} from "../lib/dynamicEligibilityEngine";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function check(condition: boolean, testName: string, failureDetails?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}`);
    if (failureDetails) {
      console.error("     Details:", typeof failureDetails === "object" ? JSON.stringify(failureDetails, null, 2) : failureDetails);
    }
  }
}

async function runRegressionSuite() {
  console.log("================================================================================");
  console.log("🧪 CREDITWISE AI CONVERSATIONAL NLP ARCHITECTURE REGRESSION SUITE");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Side-question during CIBIL collection - HDFC Documents
  // ---------------------------------------------------------------------------
  console.log("Scenario 1: Side-question interruption - HDFC documents during CIBIL step");
  const cid1 = `reg_test_1_${Date.now()}`;
  await clearEligibilityState(cid1);

  // Setup state where CIBIL is the expected field
  await saveEligibilityState(cid1, {
    applicant: {
      companyName: "Infosys",
      monthlyIncome: 65000,
      loanAmount: 500000,
      tenureMonths: 36,
      existingEmi: 0,
      age: 29,
    },
    expectedField: "cibil",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [],
    updatedAt: Date.now(),
  });

  const res1 = await runCentralAgent({
    conversationId: cid1,
    message: "Which documents are required for HDFC?",
  });
  console.log("Assistant Reply:\n", res1.reply, "\n");

  const state1 = await getEligibilityState(cid1);
  check(
    res1.reply.toLowerCase().includes("hdfc") || res1.reply.toLowerCase().includes("document") || res1.reply.toLowerCase().includes("payslip") || res1.reply.toLowerCase().includes("pan"),
    "1.1 Answers HDFC document requirements using authoritative policy",
    res1.reply
  );
  check(
    state1?.applicant.cibil === undefined,
    "1.2 Question did NOT pollute CIBIL score",
    state1?.applicant
  );
  check(
    res1.reply.toLowerCase().includes("cibil") || res1.reply.toLowerCase().includes("credit score"),
    "1.3 Empathetically prompts to resume CIBIL collection",
    res1.reply
  );
  check(
    Boolean(state1?.taskStack && state1.taskStack.length > 0),
    "1.4 Task stack saved suspended loan eligibility task",
    state1?.taskStack
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Conceptual question - "What is FOIR?" during loan flow
  // ---------------------------------------------------------------------------
  console.log("\nScenario 2: Conceptual question - 'What is FOIR?' during active flow");
  const cid2 = `reg_test_2_${Date.now()}`;
  await clearEligibilityState(cid2);

  await saveEligibilityState(cid2, {
    applicant: { companyName: "TCS", monthlyIncome: 50000 },
    expectedField: "loanAmount",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [],
    updatedAt: Date.now(),
  });

  const res2 = await runCentralAgent({
    conversationId: cid2,
    message: "What is FOIR?",
  });
  console.log("Assistant Reply:\n", res2.reply, "\n");

  const state2 = await getEligibilityState(cid2);
  check(
    res2.reply.toLowerCase().includes("foir") || res2.reply.toLowerCase().includes("fixed obligation"),
    "2.1 Authoritatively explains FOIR",
    res2.reply
  );
  check(
    state2?.applicant.loanAmount === undefined,
    "2.2 FOIR question does not set loanAmount",
    state2?.applicant
  );
  check(
    res2.reply.toLowerCase().includes("loan") || res2.reply.toLowerCase().includes("borrow"),
    "2.3 Prompts next missing field or loan resumption",
    res2.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Entity correction - "My salary is 45k, not 39k"
  // ---------------------------------------------------------------------------
  console.log("\nScenario 3: Entity correction - 'My salary is 45k, not 39k'");
  const cid3 = `reg_test_3_${Date.now()}`;
  await clearEligibilityState(cid3);

  await saveEligibilityState(cid3, {
    applicant: {
      companyName: "Wipro",
      monthlyIncome: 39000,
    },
    expectedField: "loanAmount",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [],
    updatedAt: Date.now(),
  });

  const res3 = await runCentralAgent({
    conversationId: cid3,
    message: "My salary is 45k, not 39k",
  });
  console.log("Assistant Reply:\n", res3.reply, "\n");

  const state3 = await getEligibilityState(cid3);
  check(
    state3?.applicant.monthlyIncome === 45000,
    "3.1 Corrects salary to 45000",
    state3?.applicant
  );
  check(
    res3.reply.toLowerCase().includes("45,000") || res3.reply.toLowerCase().includes("45000") || res3.reply.toLowerCase().includes("updated"),
    "3.2 Acknowledges salary update",
    res3.reply
  );
  check(
    res3.reply.toLowerCase().includes("loan") || res3.reply.toLowerCase().includes("amount"),
    "3.3 Prompts for required loan amount next",
    res3.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 4: EMI switch - "I changed my mind, calculate EMI instead."
  // ---------------------------------------------------------------------------
  console.log("\nScenario 4: Topic switch - 'I changed my mind, calculate EMI instead.'");
  const cid4 = `reg_test_4_${Date.now()}`;
  await clearEligibilityState(cid4);

  await saveEligibilityState(cid4, {
    applicant: {
      companyName: "Cognizant",
      monthlyIncome: 50000,
    },
    expectedField: "loanAmount",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [],
    updatedAt: Date.now(),
  });

  const res4 = await runCentralAgent({
    conversationId: cid4,
    message: "I changed my mind, calculate EMI instead.",
  });
  console.log("Assistant Reply:\n", res4.reply, "\n");

  const state4 = await getEligibilityState(cid4);
  check(
    state4?.activeFlow === "EMI_CALCULATOR",
    "4.1 Active flow switched to EMI_CALCULATOR",
    state4?.activeFlow
  );
  check(
    res4.reply.toLowerCase().includes("emi"),
    "4.2 Responded with EMI calculator guidance",
    res4.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Company switch - "Forget the loan, show TCS details."
  // ---------------------------------------------------------------------------
  console.log("\nScenario 5: Topic switch - 'Forget the loan, show TCS details.'");
  const cid5 = `reg_test_5_${Date.now()}`;
  await clearEligibilityState(cid5);

  await saveEligibilityState(cid5, {
    applicant: {
      monthlyIncome: 50000,
    },
    expectedField: "loanAmount",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [],
    updatedAt: Date.now(),
  });

  const res5 = await runCentralAgent({
    conversationId: cid5,
    message: "Forget the loan, show TCS details.",
  });
  console.log("Assistant Reply:\n", res5.reply, "\n");

  const state5 = await getEligibilityState(cid5);
  check(
    res5.reply.toLowerCase().includes("tata consultancy services") || res5.reply.toLowerCase().includes("tcs") || res5.reply.toLowerCase().includes("cat"),
    "5.1 Responded with TCS company tier/category information",
    res5.reply
  );
  check(
    state5?.activeFlow === "COMPANY_SEARCH",
    "5.2 Switched activeFlow to COMPANY_SEARCH",
    state5?.activeFlow
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Valid CIBIL - "750"
  // ---------------------------------------------------------------------------
  console.log("\nScenario 6: Valid CIBIL - '750'");
  const cid6 = `reg_test_6_${Date.now()}`;
  await clearEligibilityState(cid6);

  await saveEligibilityState(cid6, {
    applicant: {
      companyName: "IBM",
      monthlyIncome: 60000,
      loanAmount: 400000,
      tenureMonths: 36,
    },
    expectedField: "cibil",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [],
    updatedAt: Date.now(),
  });

  const res6 = await runCentralAgent({
    conversationId: cid6,
    message: "750",
  });
  console.log("Assistant Reply:\n", res6.reply, "\n");

  const state6 = await getEligibilityState(cid6);
  check(
    state6?.applicant.cibil === 750,
    "6.1 CIBIL 750 saved cleanly",
    state6?.applicant
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Invalid CIBIL - The "76" Principle
  // ---------------------------------------------------------------------------
  console.log("\nScenario 7: Invalid CIBIL - '76' while CIBIL expected");
  const cid7 = `reg_test_7_${Date.now()}`;
  await clearEligibilityState(cid7);

  await saveEligibilityState(cid7, {
    applicant: {
      companyName: "Capgemini",
      monthlyIncome: 70000,
      loanAmount: 500000,
      tenureMonths: 36,
    },
    expectedField: "cibil",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [],
    updatedAt: Date.now(),
  });

  const res7 = await runCentralAgent({
    conversationId: cid7,
    message: "76",
  });
  console.log("Assistant Reply:\n", res7.reply, "\n");

  const state7 = await getEligibilityState(cid7);
  check(
    state7?.applicant.cibil === undefined,
    "7.1 '76' NOT saved as CIBIL score",
    state7?.applicant
  );
  check(
    state7?.applicant.age === undefined,
    "7.2 '76' NOT converted to age",
    state7?.applicant
  );
  check(
    res7.reply.includes("300") && res7.reply.includes("900"),
    "7.3 Asked clarification explaining 300–900 CIBIL range",
    res7.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Question with numbers - "What salary is required for a 5 lakh loan?"
  // ---------------------------------------------------------------------------
  console.log("\nScenario 8: Question with numbers - 'What salary is required for a 5 lakh loan?'");
  const cid8 = `reg_test_8_${Date.now()}`;
  await clearEligibilityState(cid8);

  await saveEligibilityState(cid8, {
    applicant: {},
    expectedField: "companyName",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [],
    updatedAt: Date.now(),
  });

  const res8 = await runCentralAgent({
    conversationId: cid8,
    message: "What salary is required for a 5 lakh loan?",
  });
  console.log("Assistant Reply:\n", res8.reply, "\n");

  const state8 = await getEligibilityState(cid8);
  check(
    state8?.applicant.loanAmount === undefined,
    "8.1 ₹5 Lakh from question NOT saved as applicant loanAmount",
    state8?.applicant
  );
  check(
    state8?.applicant.monthlyIncome === undefined,
    "8.2 Monthly salary NOT guessed or populated",
    state8?.applicant
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Multi-entity input
  // ---------------------------------------------------------------------------
  console.log("\nScenario 9: Multi-entity input - 'I need 8 lakh for 5 years, salary is 40k and CIBIL is 760.'");
  const cid9 = `reg_test_9_${Date.now()}`;
  await clearEligibilityState(cid9);

  const res9 = await runCentralAgent({
    conversationId: cid9,
    message: "I need 8 lakh for 5 years, salary is 40k and CIBIL is 760.",
  });
  console.log("Assistant Reply:\n", res9.reply, "\n");

  const state9 = await getEligibilityState(cid9);
  check(
    state9?.applicant.loanAmount === 800000,
    "9.1 Loan amount extracted as 800000",
    state9?.applicant
  );
  check(
    state9?.applicant.tenureMonths === 60,
    "9.2 Tenure extracted as 60 months",
    state9?.applicant
  );
  check(
    state9?.applicant.monthlyIncome === 40000,
    "9.3 Salary extracted as 40000",
    state9?.applicant
  );
  check(
    state9?.applicant.cibil === 760,
    "9.4 CIBIL extracted as 760",
    state9?.applicant
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 10: New conversationId isolation
  // ---------------------------------------------------------------------------
  console.log("\nScenario 10: New conversationId isolation");
  const cid10 = `reg_test_10_isolated_${Date.now()}`;
  const state10 = await getEligibilityState(cid10);
  check(
    state10 === null,
    "10.1 Fresh conversationId returns null state (zero cross-session bleed)",
    state10
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Reset command
  // ---------------------------------------------------------------------------
  console.log("\nScenario 11: Reset command");
  const cid11 = `reg_test_11_${Date.now()}`;
  await saveEligibilityState(cid11, {
    applicant: { companyName: "Accenture", monthlyIncome: 85000 },
    expectedField: "cibil",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [],
    updatedAt: Date.now(),
  });

  const res11 = await runCentralAgent({
    conversationId: cid11,
    message: "reset",
  });
  console.log("Assistant Reply:\n", res11.reply, "\n");

  const state11 = await getEligibilityState(cid11);
  check(
    state11 === null,
    "11.1 Session cleared completely upon reset",
    state11
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Resume command
  // ---------------------------------------------------------------------------
  console.log("\nScenario 12: Resume command");
  const cid12 = `reg_test_12_${Date.now()}`;
  await saveEligibilityState(cid12, {
    applicant: { companyName: "Microsoft", monthlyIncome: 150000 },
    expectedField: "cibil",
    in_eligibility_flow: true,
    activeFlow: "LOAN_ELIGIBILITY",
    taskStack: [
      {
        taskType: "LOAN_ELIGIBILITY",
        expectedField: "cibil",
        missingFields: ["cibil"],
        applicantSnapshot: { companyName: "Microsoft", monthlyIncome: 150000 },
        timestamp: Date.now(),
        description: "Suspended on cibil",
      },
    ],
    updatedAt: Date.now(),
  });

  const res12 = await runCentralAgent({
    conversationId: cid12,
    message: "resume",
  });
  console.log("Assistant Reply:\n", res12.reply, "\n");
  check(
    res12.reply.toLowerCase().includes("cibil") || res12.reply.toLowerCase().includes("credit score") || res12.reply.toLowerCase().includes("welcome back"),
    "12.1 Resumed directly back to CIBIL collection",
    res12.reply
  );

  console.log("\n================================================================================");
  console.log(`TOTAL REGRESSION TESTS: ${totalTests}`);
  console.log(`PASSED:                 ${passedTests}`);
  console.log(`FAILED:                 ${failedTests}`);
  console.log("================================================================================");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL ARCHITECTURE REGRESSION TESTS PASSED!");
  }
}

runRegressionSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
