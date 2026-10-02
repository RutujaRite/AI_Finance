import { runCentralAgent } from "../lib/ai/agent";
import pool from "../lib/db";

async function runConversationalSlotMachineTests() {
  console.log("================================================================================");
  console.log("TESTING END-TO-END CONVERSATIONAL SLOT-FILLING ASSISTANT (runCentralAgent)");
  console.log("================================================================================\n");

  const convId = `test-slot-conv-${Date.now()}`;

  // --------------------------------------------------------------------------
  // TEST 1: Full 5-Slot Waterfall Sequence (Turn by Turn)
  // --------------------------------------------------------------------------
  console.log(">>> TEST 1: 5-SLOT WATERFALL SEQUENCE <<<\n");

  // Turn 1: Initial Loan Intent
  console.log("User: 'I want a personal loan'");
  const t1 = await runCentralAgent({ message: "I want a personal loan", conversationId: convId });
  console.log(`Assistant:\n${t1.reply}\n`);
  if (!t1.reply.includes("what is the exact name of your employer or company")) {
    throw new Error("Turn 1 failed! Expected prompt for employer.");
  }

  // Turn 2: Provide Employer
  console.log("User: 'Infosys'");
  const t2 = await runCentralAgent({ message: "Infosys", conversationId: convId });
  console.log(`Assistant:\n${t2.reply}\n`);
  if (!t2.reply.includes("Infosys") || !t2.reply.includes("How much loan amount would you like to borrow")) {
    throw new Error("Turn 2 failed! Expected acknowledgment of employer and prompt for requestedAmount.");
  }

  // Turn 3: Provide Loan Amount
  console.log("User: '5 lakhs'");
  const t3 = await runCentralAgent({ message: "5 lakhs", conversationId: convId });
  console.log(`Assistant:\n${t3.reply}\n`);
  if (!t3.reply.includes("5,00,000") || !t3.reply.includes("What is your preferred repayment tenure")) {
    throw new Error("Turn 3 failed! Expected acknowledgment of loan amount and prompt for tenureMonths.");
  }

  // Turn 4: Provide Tenure
  console.log("User: '5 years'");
  const t4 = await runCentralAgent({ message: "5 years", conversationId: convId });
  console.log(`Assistant:\n${t4.reply}\n`);
  if (!t4.reply.includes("60 months") || !t4.reply.includes("What is your estimated CIBIL or credit score")) {
    throw new Error("Turn 4 failed! Expected acknowledgment of tenure and prompt for cibilScore.");
  }

  // Turn 5: Provide CIBIL ('not sure')
  console.log("User: 'not sure'");
  const t5 = await runCentralAgent({ message: "not sure", conversationId: convId });
  console.log(`Assistant:\n${t5.reply}\n`);
  if (!t5.reply.includes("What is your current age")) {
    throw new Error("Turn 5 failed! Expected prompt for age.");
  }

  // Turn 6: Provide Age -> Triggers Evaluation!
  console.log("User: '28'");
  const t6 = await runCentralAgent({ message: "28", conversationId: convId });
  console.log(`Assistant:\n${t6.reply}\n`);
  if (!t6.reply.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |") || !t6.reply.includes("Personal Loan Eligibility Evaluation Complete")) {
    throw new Error("Turn 6 failed! Expected complete evaluation table with exact columns.");
  }
  console.log("✅ TEST 1 PASSED: Full 5-Slot Waterfall and Table Evaluation Completed Successfully!\n");

  // --------------------------------------------------------------------------
  // TEST 2: Multi-Slot Extraction in 1 Turn
  // --------------------------------------------------------------------------
  console.log(">>> TEST 2: MULTI-SLOT EXTRACTION IN SINGLE TURN <<<\n");
  const multiConvId = `test-multi-conv-${Date.now()}`;
  console.log("User: 'I work at Wipro and need 10 lakh loan for 3 years'");
  const multiTurn = await runCentralAgent({
    message: "I work at Wipro and need 10 lakh loan for 3 years",
    conversationId: multiConvId,
  });
  console.log(`Assistant:\n${multiTurn.reply}\n`);
  if (!multiTurn.reply.includes("Wipro") || !multiTurn.reply.includes("What is your estimated CIBIL or credit score")) {
    throw new Error("Test 2 failed! Expected extracted employer, amount, tenure, and prompt for cibilScore.");
  }
  console.log("✅ TEST 2 PASSED: Captured multiple slots in single turn and asked next missing slot!\n");

  // --------------------------------------------------------------------------
  // TEST 3: Interruption & Context Preservation
  // --------------------------------------------------------------------------
  console.log(">>> TEST 3: CONVERSATIONAL INTERRUPTION & RESUME <<<\n");
  const interruptConvId = `test-interrupt-conv-${Date.now()}`;

  // Start flow and provide employer
  console.log("User: 'I need a personal loan'");
  await runCentralAgent({ message: "I need a personal loan", conversationId: interruptConvId });

  console.log("User: 'Tata Consultancy Services'");
  const intTurn2 = await runCentralAgent({ message: "Tata Consultancy Services", conversationId: interruptConvId });
  console.log(`Assistant:\n${intTurn2.reply}\n`);

  // Interrupt with bank policy inquiry
  console.log("User: 'Before continuing, what is the minimum CIBIL required by Kotak Mahindra Bank?'");
  const policyTurn = await runCentralAgent({
    message: "Before continuing, what is the minimum CIBIL required by Kotak Mahindra Bank?",
    conversationId: interruptConvId,
  });
  console.log(`Assistant (Policy Answer):\n${policyTurn.reply.slice(0, 250)}...\n`);
  if (!policyTurn.reply.toLowerCase().includes("cibil") || !policyTurn.reply.toLowerCase().includes("kotak")) {
    throw new Error("Test 3 failed! Expected policy RAG answer.");
  }

  // Resume with next slot answer (requestedAmount: 4 lakhs)
  console.log("User: '4 lakhs'");
  const resumeTurn = await runCentralAgent({ message: "4 lakhs", conversationId: interruptConvId });
  console.log(`Assistant (Resumed Flow):\n${resumeTurn.reply}\n`);
  if (!resumeTurn.reply.includes("4,00,000") || !resumeTurn.reply.includes("What is your preferred repayment tenure")) {
    throw new Error("Test 3 failed! Expected resumed waterfall asking for tenureMonths.");
  }
  console.log("✅ TEST 3 PASSED: Interrupted with policy question, answered cleanly, and resumed without losing employer!\n");

  // --------------------------------------------------------------------------
  // TEST 4: Side-Question Resilience & In-Flow EMI Calculation (Law 1, 2, 3)
  // --------------------------------------------------------------------------
  console.log(">>> TEST 4: SIDE-QUESTION RESILIENCE & IN-FLOW EMI CALCULATION <<<\n");
  const emiConvId = `test-emi-conv-${Date.now()}`;
  console.log("User: 'I want to apply for a personal loan'");
  await runCentralAgent({ message: "I want to apply for a personal loan", conversationId: emiConvId });

  console.log("User: 'HCL Technologies'");
  await runCentralAgent({ message: "HCL Technologies", conversationId: emiConvId });

  console.log("User: 'tell me emi for 5 lacks at 10.5% for 3 years'");
  const emiTurn = await runCentralAgent({
    message: "tell me emi for 5 lacks at 10.5% for 3 years",
    conversationId: emiConvId,
  });
  console.log(`Assistant (EMI & Flow Resume):\n${emiTurn.reply}\n`);
  if (!emiTurn.reply.includes("Loan EMI Calculation") || !emiTurn.reply.includes("5,00,000") || !emiTurn.reply.includes("What is your estimated CIBIL or credit score")) {
    throw new Error("Test 4 failed! Expected EMI calculation, extracted amount and tenure, and prompt for cibilScore.");
  }
  console.log("✅ TEST 4 PASSED: Calculated EMI, extracted '5 lacks' & '3 years' without entity confusion, and resumed waterfall!\n");

  console.log("================================================================================");
  console.log("ALL CONVERSATIONAL SLOT-MACHINE TESTS PASSED SUCCESSFULLY! 🚀");
  console.log("================================================================================");

  await pool.end();
}

runConversationalSlotMachineTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
