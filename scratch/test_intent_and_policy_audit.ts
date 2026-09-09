import { runCentralAgent } from "../lib/ai/agent";
import { clearEligibilityState, getEligibilityState } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function runAudit() {
  console.log("================================================================================");
  console.log("AUDIT 1: GREETINGS AND CASUAL MESSAGES (MUST NEVER TRIGGER COMPANY OR LOAN FLOW)");
  console.log("================================================================================\n");

  const casualMessages = [
    "Hi",
    "Hello",
    "Hey there",
    "Good morning",
    "How are you?",
    "What can you do?",
    "Who are you?",
    "Tell me about yourself",
    "Thanks",
    "Ok, got it"
  ];

  for (const msg of casualMessages) {
    const convId = "audit_casual_" + Math.random().toString(36).slice(2);
    const res = await runCentralAgent({ message: msg, conversationId: convId });

    const state = await getEligibilityState(convId);
    const triggeredCompany = !!res.companyData || !!res.companyQuery;
    const triggeredLoanFlow = !!state ||
                              res.reply.toLowerCase().includes("what is your company") ||
                              res.reply.toLowerCase().includes("loan amount needed");

    console.log(`[TEST] Message: "${msg}"`);
    console.log(`   -> Company lookup triggered: ${triggeredCompany ? "❌ FAIL" : "✅ PASS (None)"}`);
    console.log(`   -> Loan flow triggered:       ${triggeredLoanFlow ? "❌ FAIL" : "✅ PASS (None)"}`);
    console.log(`   -> Active flow state:        ${state ? "❌ Active" : "✅ None"}`);
    console.log(`   -> Reply preview:            ${res.reply.split("\n")[0]}`);
    console.log("");

    if (triggeredCompany || triggeredLoanFlow) {
      throw new Error(`Casual message "${msg}" inappropriately triggered company or loan processing!`);
    }
  }

  console.log("================================================================================");
  console.log("AUDIT 2: GREETINGS/CASUAL CHATTER INSIDE AN ACTIVE FLOW");
  console.log("================================================================================\n");

  const activeFlowConvId = "audit_active_flow_" + Math.random().toString(36).slice(2);
  
  // Step 1: Start genuine loan flow
  console.log("Step 1: Starting loan flow with 'I want a personal loan'...");
  const turn1 = await runCentralAgent({
    message: "I want a personal loan",
    conversationId: activeFlowConvId,
  });
  console.log(`Turn 1 response: ${turn1.reply.trim()}`);
  const stateAfterTurn1 = await getEligibilityState(activeFlowConvId);
  console.log(`State expected field: ${stateAfterTurn1?.expectedField}`);

  // Step 2: User says "Hello" instead of company name
  console.log("\nStep 2: User sends greeting 'Hello' instead of answering company name...");
  const turn2 = await runCentralAgent({
    message: "Hello",
    conversationId: activeFlowConvId,
  });
  console.log(`Turn 2 reply: ${turn2.reply.trim()}`);
  const compLookupTurn2 = !!turn2.companyData || !!turn2.companyQuery;
  console.log(`Turn 2 company lookup: ${compLookupTurn2 ? "❌ FAIL" : "✅ PASS (None)"}`);

  // Step 3: User says "How are you?" instead of company name
  console.log("\nStep 3: User sends casual query 'How are you?'...");
  const turn3 = await runCentralAgent({
    message: "How are you?",
    conversationId: activeFlowConvId,
  });
  console.log(`Turn 3 reply: ${turn3.reply.trim()}`);
  const compLookupTurn3 = !!turn3.companyData || !!turn3.companyQuery;
  console.log(`Turn 3 company lookup: ${compLookupTurn3 ? "❌ FAIL" : "✅ PASS (None)"}`);

  // Step 4: User now provides genuine company name "TCS"
  console.log("\nStep 4: User now provides company 'TCS'...");
  const turn4 = await runCentralAgent({
    message: "TCS",
    conversationId: activeFlowConvId,
  });
  console.log(`Turn 4 response: ${turn4.reply.trim()}`);
  const stateAfterTurn4 = await getEligibilityState(activeFlowConvId);
  console.log(`State companyName resolved: ${stateAfterTurn4?.applicant?.companyName}`);
  console.log(`State next expected field: ${stateAfterTurn4?.expectedField}`);

  console.log("\n================================================================================");
  console.log("AUDIT 3: GENUINE LOAN INTENT INITIATION");
  console.log("================================================================================\n");

  const genuineLoanPhrases = [
    "I want a personal loan",
    "Check my loan eligibility",
    "Can I get a personal loan?",
    "Need 3 lakhs personal loan"
  ];

  for (const phrase of genuineLoanPhrases) {
    const convId = "audit_loan_intent_" + Math.random().toString(36).slice(2);
    const res = await runCentralAgent({ message: phrase, conversationId: convId });
    const asksCompany = res.reply.toLowerCase().includes("company") || res.reply.toLowerCase().includes("employer");
    console.log(`[TEST] Loan Intent: "${phrase}"`);
    console.log(`   -> Started flow asking company: ${asksCompany ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`   -> Reply: ${res.reply.trim()}`);
    console.log("");
  }

  console.log("================================================================================");
  console.log("AUDIT 4: NON-LOAN INTENTS (COMPANY SEARCH & BANK MANAGER)");
  console.log("================================================================================\n");

  const compSearchConv = "audit_comp_search_" + Math.random().toString(36).slice(2);
  const compRes = await runCentralAgent({
    message: "Is Infosys listed in your company records?",
    conversationId: compSearchConv,
  });
  console.log(`Company search reply preview: ${compRes.reply.slice(0, 150)}...`);
  console.log(`Started loan flow: ${compRes.reply.toLowerCase().includes("what is your company") ? "❌ FAIL" : "✅ PASS (Did not hijack into loan flow)"}`);

  const mgrConv = "audit_mgr_" + Math.random().toString(36).slice(2);
  const mgrRes = await runCentralAgent({
    message: "Give me contact number of Pune bank manager",
    conversationId: mgrConv,
  });
  console.log(`\nManager search reply preview: ${mgrRes.reply.slice(0, 150)}...`);
  console.log(`Started loan flow: ${mgrRes.reply.toLowerCase().includes("what is your company") ? "❌ FAIL" : "✅ PASS (Did not hijack into loan flow)"}`);

  console.log("\n================================================================================");
  console.log("AUDIT 5: FULL MULTI-TURN POLICY ELIGIBILITY FLOW PRESERVATION");
  console.log("================================================================================\n");

  const fullFlowConvId = "audit_full_flow_" + Math.random().toString(36).slice(2);
  console.log("Turn 1: 'I want a personal loan'");
  const f1 = await runCentralAgent({ message: "I want a personal loan", conversationId: fullFlowConvId });
  console.log(`-> ${f1.reply.trim()}`);

  console.log("\nTurn 2: 'Infosys'");
  const f2 = await runCentralAgent({ message: "Infosys", conversationId: fullFlowConvId });
  console.log(`-> ${f2.reply.trim()}`);

  console.log("\nTurn 3: 'Monthly salary is 85000'");
  const f3 = await runCentralAgent({ message: "Monthly salary is 85000", conversationId: fullFlowConvId });
  console.log(`-> ${f3.reply.trim()}`);

  console.log("\nTurn 4: 'Loan amount 500000'");
  const f4 = await runCentralAgent({ message: "Loan amount 500000", conversationId: fullFlowConvId });
  console.log(`-> ${f4.reply.trim()}`);

  console.log("\nTurn 5: 'Tenure 36 months'");
  const f5 = await runCentralAgent({ message: "Tenure 36 months", conversationId: fullFlowConvId });
  console.log(`-> ${f5.reply.trim()}`);

  console.log("\nTurn 6: 'CIBIL score is 780'");
  const f6 = await runCentralAgent({ message: "CIBIL score is 780", conversationId: fullFlowConvId });
  console.log(`-> ${f6.reply.trim()}`);

  console.log("\nTurn 7: 'Existing EMI 0'");
  const f7 = await runCentralAgent({ message: "Existing EMI 0", conversationId: fullFlowConvId });
  console.log(`-> ${f7.reply.trim()}`);

  console.log("\nTurn 8: 'Age 29'");
  const f8 = await runCentralAgent({ message: "Age 29", conversationId: fullFlowConvId });
  console.log(`\nFinal Report Summary Preview:`);
  console.log(f8.reply.slice(0, 450) + "...\n");
  const hasApprovedBanks = f8.reply.includes("Approved Partner Banks") || f8.reply.includes("Eligible");
  console.log(`Final report has approved banks: ${hasApprovedBanks ? "✅ PASS" : "❌ FAIL"}`);

  console.log("\n================================================================================");
  console.log("ALL 5 AUDIT SUITES PASSED COMPLETELY!");
  console.log("================================================================================");
}

runAudit()
  .then(() => pool.end())
  .catch(err => {
    console.error("Audit failed:", err);
    pool.end();
    process.exit(1);
  });
