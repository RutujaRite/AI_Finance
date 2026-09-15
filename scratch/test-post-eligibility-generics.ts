import dotenv from "dotenv";
dotenv.config();

import { runCentralAgent } from "../lib/ai/agent";

async function testPostEligibilityGenerics() {
  console.log("===============================================================================");
  console.log("🧪 TESTING POST-ELIGIBILITY GENERIC HANDLING");
  console.log("===============================================================================\n");

  const convId = "conv_post_gen_" + Date.now();
  const history: Array<{ role: string; content: string }> = [];

  const tableHeader = "| Bank | Status | CIBIL | Tenure | Est. EMI |";

  // ---------------------------------------------------------------------------
  // TURN 1: Complete applicant profile provided upfront
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 1: Complete applicant profile provided upfront");
  const msg1 = "I work at Tata Consultancy Services, earning 1.2 lakhs per month. Need 5 lakhs loan for 3 years. CIBIL is 780, zero existing EMIs, age 29.";
  console.log(`User: "${msg1}"`);
  const res1 = await runCentralAgent({ message: msg1, conversationId: convId, conversationHistory: history });
  history.push({ role: "user", content: msg1 });
  history.push({ role: "assistant", content: res1.reply });

  if (!res1.reply.includes(tableHeader)) {
    throw new Error("TURN 1 FAILED: Expected eligibility table was not generated.");
  }
  console.log("✅ TURN 1 PASSED: Initial eligibility evaluation table generated.\n");

  // ---------------------------------------------------------------------------
  // TURN 2: User says "proceed"
  // MUST NOT auto-select Bajaj Markets or any bank
  // MUST NOT invent "Mumbai" or create a lead
  // MUST NOT regenerate the table
  // MUST ask for which eligible bank to proceed with
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 2: User says 'proceed'");
  const msg2 = "proceed";
  console.log(`User: "${msg2}"`);
  const res2 = await runCentralAgent({ message: msg2, conversationId: convId, conversationHistory: history });
  history.push({ role: "user", content: msg2 });
  history.push({ role: "assistant", content: res2.reply });
  console.log("\nAssistant:\n" + res2.reply + "\n");

  if (res2.reply.includes(tableHeader)) {
    throw new Error("TURN 2 FAILED: Evaluation table was repeated on 'proceed'!");
  }
  if (/Official Bank Manager Directory/i.test(res2.reply) || /Official manager contact request logged/i.test(res2.reply)) {
    throw new Error("TURN 2 FAILED: Assistant auto-selected a bank and created a lead instead of asking which bank!");
  }
  if (/Mumbai/i.test(res2.reply)) {
    throw new Error("TURN 2 FAILED: Assistant invented 'Mumbai' without user specifying it!");
  }
  console.log("✅ TURN 2 PASSED: No auto-selection, no invented city, no repeated table, asked naturally.\n");

  // ---------------------------------------------------------------------------
  // TURN 3: User rejects a bank: "I don't want Bajaj Markets, what other banks can I choose?"
  // MUST understand rejection generically
  // MUST NOT create lead or show error
  // MUST ask for another eligible bank
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 3: User rejects a bank: 'I don't want Bajaj Markets, what other banks can I choose?'");
  const msg3 = "I don't want Bajaj Markets, what other banks can I choose?";
  console.log(`User: "${msg3}"`);
  const res3 = await runCentralAgent({ message: msg3, conversationId: convId, conversationHistory: history });
  history.push({ role: "user", content: msg3 });
  history.push({ role: "assistant", content: res3.reply });
  console.log("\nAssistant:\n" + res3.reply + "\n");

  if (res3.reply.includes("AI service is currently unavailable")) {
    throw new Error("TURN 3 FAILED: AI service error shown on rejection!");
  }
  if (/Official manager contact request logged for \*\*Bajaj/i.test(res3.reply)) {
    throw new Error("TURN 3 FAILED: Created lead for rejected bank!");
  }
  if (res3.reply.includes(tableHeader)) {
    throw new Error("TURN 3 FAILED: Evaluation table repeated on rejection!");
  }
  console.log("✅ TURN 3 PASSED: Bank rejection understood generically, no lead created, other banks offered.\n");

  // ---------------------------------------------------------------------------
  // TURN 4: User selects a bank: "Let's go with HDFC Bank"
  // City is not known yet!
  // MUST NOT invent "Mumbai"
  // MUST ask for city / location
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 4: User selects a bank: 'Let's go with HDFC Bank'");
  const msg4 = "Let's go with HDFC Bank";
  console.log(`User: "${msg4}"`);
  const res4 = await runCentralAgent({ message: msg4, conversationId: convId, conversationHistory: history });
  history.push({ role: "user", content: msg4 });
  history.push({ role: "assistant", content: res4.reply });
  console.log("\nAssistant:\n" + res4.reply + "\n");

  if (/Mumbai/i.test(res4.reply)) {
    throw new Error("TURN 4 FAILED: Invented 'Mumbai' instead of asking for user's city!");
  }
  if (/Official manager contact request logged/i.test(res4.reply)) {
    throw new Error("TURN 4 FAILED: Logged manager lead before obtaining user's city!");
  }
  console.log("✅ TURN 4 PASSED: Bank choice confirmed and user's city requested naturally.\n");

  // ---------------------------------------------------------------------------
  // TURN 5: User provides city: "I am based in Pune"
  // BOTH bank (HDFC Bank) AND city (Pune) are now known!
  // MUST proceed to connect with HDFC Bank in Pune
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 5: User provides city: 'I am based in Pune'");
  const msg5 = "I am based in Pune";
  console.log(`User: "${msg5}"`);
  const res5 = await runCentralAgent({ message: msg5, conversationId: convId, conversationHistory: history });
  history.push({ role: "user", content: msg5 });
  history.push({ role: "assistant", content: res5.reply });
  console.log("\nAssistant:\n" + res5.reply + "\n");

  if (!/HDFC/i.test(res5.reply) || !/Pune/i.test(res5.reply)) {
    throw new Error("TURN 5 FAILED: Expected manager connection for HDFC in Pune!");
  }
  console.log("✅ TURN 5 PASSED: Successfully connected HDFC Bank in Pune.\n");

  // ---------------------------------------------------------------------------
  // TURN 6: Explicit re-evaluation request in a new completed session
  // MUST generate the table when explicitly asked
  // ---------------------------------------------------------------------------
  console.log("👉 TURN 6: Explicit re-evaluation request");
  const convIdRecalc = "conv_recalc_" + Date.now();
  await runCentralAgent({ message: msg1, conversationId: convIdRecalc });
  const msgRecalc = "Can you re-evaluate my loan eligibility and show the table again?";
  console.log(`User: "${msgRecalc}"`);
  const resRecalc = await runCentralAgent({ message: msgRecalc, conversationId: convIdRecalc });

  if (!resRecalc.reply.includes(tableHeader)) {
    throw new Error("TURN 6 FAILED: Evaluation table was not shown on explicit request!");
  }
  console.log("✅ TURN 6 PASSED: Table generated upon explicit re-evaluation request.\n");

  console.log("===============================================================================");
  console.log("🎉 ALL POST-ELIGIBILITY GENERIC TESTS PASSED WITH 100% SUCCESS!");
  console.log("===============================================================================");
}

testPostEligibilityGenerics().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
