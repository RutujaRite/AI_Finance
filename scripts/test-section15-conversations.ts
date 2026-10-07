import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import pool from "../lib/db";
import { runCentralAgent } from "../lib/ai/agent";

async function runSection15Tests() {
  console.log("================================================================================");
  console.log("SECTION 15 — COMPLETE CONVERSATIONAL SUITE VALIDATION");
  console.log("================================================================================\n");

  let allPassed = true;

  // ---------------------------------------------------------------------------
  // A. GENERAL CONVERSATION
  // ---------------------------------------------------------------------------
  console.log("▶ [A. GENERAL CONVERSATION]");
  const convAId = `test_sec15_a_${Date.now()}`;
  let historyA: Array<{ role: string; content: string }> = [];

  // A.1: Hi
  const resA1 = await runCentralAgent({
    message: "Hi",
    conversationId: convAId,
    conversationHistory: historyA,
  });
  console.log("  Turn 1 ('Hi'):\n  " + resA1.reply.slice(0, 120).replace(/\n/g, " ") + "...");
  historyA.push({ role: "user", content: "Hi" });
  historyA.push({ role: "assistant", content: resA1.reply });

  const a1Pass = /hello|welcome|how can i help/i.test(resA1.reply);
  console.log(`  Assert A.1 Natural greeting: ${a1Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!a1Pass) allPassed = false;

  // A.2: I want a personal loan.
  const resA2 = await runCentralAgent({
    message: "I want a personal loan.",
    conversationId: convAId,
    conversationHistory: historyA,
  });
  console.log("  Turn 2 ('I want a personal loan.'):\n  " + resA2.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  historyA.push({ role: "user", content: "I want a personal loan." });
  historyA.push({ role: "assistant", content: resA2.reply });

  const a2OffersElig = /explore loan options|check your eligibility/i.test(resA2.reply);
  const a2NotMandatoryPrompt = !resA2.reply.includes("what is the name of your current employer or company (e.g., TCS");
  const a2Pass = a2OffersElig && a2NotMandatoryPrompt;
  console.log(`  Assert A.2 Explain assistance & offer eligibility (must NOT demand company): ${a2Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!a2Pass) allPassed = false;

  // ---------------------------------------------------------------------------
  // B. POLICY
  // ---------------------------------------------------------------------------
  console.log("\n▶ [B. POLICY]");
  const convBId = `test_sec15_b_${Date.now()}`;
  let historyB: Array<{ role: string; content: string }> = [];

  // B.1: What is Axis Bank's CIBIL requirement?
  const resB1 = await runCentralAgent({
    message: "What is Axis Bank's CIBIL requirement?",
    conversationId: convBId,
    conversationHistory: historyB,
  });
  console.log("  Turn 1 ('What is Axis Bank's CIBIL requirement?'):\n  " + resB1.reply.slice(0, 140).replace(/\n/g, " ") + "...");
  historyB.push({ role: "user", content: "What is Axis Bank's CIBIL requirement?" });
  historyB.push({ role: "assistant", content: resB1.reply });

  const b1Pass = /axis\s*bank/i.test(resB1.reply) && /cibil/i.test(resB1.reply) && /\b(?:650|700)\b/.test(resB1.reply);
  console.log(`  Assert B.1 Axis Bank CIBIL requirement explained: ${b1Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!b1Pass) allPassed = false;

  // B.2: What about Yes Bank?
  const resB2 = await runCentralAgent({
    message: "What about Yes Bank?",
    conversationId: convBId,
    conversationHistory: historyB,
  });
  console.log("  Turn 2 ('What about Yes Bank?'):\n  " + resB2.reply.slice(0, 140).replace(/\n/g, " ") + "...");
  historyB.push({ role: "user", content: "What about Yes Bank?" });
  historyB.push({ role: "assistant", content: resB2.reply });

  const b2Pass = /yes\s*bank/i.test(resB2.reply) && /cibil/i.test(resB2.reply) && /\b(?:700|725|731)\b/.test(resB2.reply);
  console.log(`  Assert B.2 Follow-up resolved & Yes Bank CIBIL retrieved: ${b2Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!b2Pass) allPassed = false;

  // ---------------------------------------------------------------------------
  // C. COMPANY
  // ---------------------------------------------------------------------------
  console.log("\n▶ [C. COMPANY]");
  const convCId = `test_sec15_c_${Date.now()}`;
  let historyC: Array<{ role: string; content: string }> = [];

  // C.1: Tell me about Microsoft.
  const resC1 = await runCentralAgent({
    message: "Tell me about Microsoft.",
    conversationId: convCId,
    conversationHistory: historyC,
  });
  console.log("  Turn 1 ('Tell me about Microsoft.'):\n  " + resC1.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  historyC.push({ role: "user", content: "Tell me about Microsoft." });
  historyC.push({ role: "assistant", content: resC1.reply });

  const c1Pass = /microsoft/i.test(resC1.reply) && (/company overview|basic information|partner bank/i.test(resC1.reply) || resC1.reply.includes("🏢"));
  console.log(`  Assert C.1 Live company info & partner-bank records: ${c1Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!c1Pass) allPassed = false;

  // C.2: What is its revenue?
  const resC2 = await runCentralAgent({
    message: "What is its revenue?",
    conversationId: convCId,
    conversationHistory: historyC,
  });
  console.log("  Turn 2 ('What is its revenue?'):\n  " + resC2.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  historyC.push({ role: "user", content: "What is its revenue?" });
  historyC.push({ role: "assistant", content: resC2.reply });

  const c2Pass = /microsoft/i.test(resC2.reply) && /revenue|turnover|financial performance/i.test(resC2.reply);
  console.log(`  Assert C.2 Resolves Microsoft from context & reports revenue: ${c2Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!c2Pass) allPassed = false;

  // ---------------------------------------------------------------------------
  // D. ELIGIBILITY INTERRUPTION
  // ---------------------------------------------------------------------------
  console.log("\n▶ [D. ELIGIBILITY INTERRUPTION]");
  const convDId = `test_sec15_d_${Date.now()}`;
  let historyD: Array<{ role: string; content: string }> = [];

  // D.1: Check my eligibility. My company is Microsoft.
  const resD1 = await runCentralAgent({
    message: "Check my eligibility. My company is Microsoft.",
    conversationId: convDId,
    conversationHistory: historyD,
  });
  console.log("  Turn 1 ('Check my eligibility. My company is Microsoft.'):\n  " + resD1.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  historyD.push({ role: "user", content: "Check my eligibility. My company is Microsoft." });
  historyD.push({ role: "assistant", content: resD1.reply });

  const d1Pass = /microsoft/i.test(resD1.reply) || /salary|income|take-home/i.test(resD1.reply);
  console.log(`  Assert D.1 Stored Microsoft and requested next field: ${d1Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!d1Pass) allPassed = false;

  // D.2: What is FOIR?
  const resD2 = await runCentralAgent({
    message: "What is FOIR?",
    conversationId: convDId,
    conversationHistory: historyD,
  });
  console.log("  Turn 2 ('What is FOIR?'):\n  " + resD2.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  historyD.push({ role: "user", content: "What is FOIR?" });
  historyD.push({ role: "assistant", content: resD2.reply });

  const d2ExplainsFoir = /fixed obligation|ratio|dti/i.test(resD2.reply);
  const d2Bridges = /coming back to your loan eligibility check/i.test(resD2.reply) && /microsoft/i.test(resD2.reply);
  const d2Pass = d2ExplainsFoir && d2Bridges;
  console.log(`  Assert D.2 Explained FOIR and resumed eligibility contextually: ${d2Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!d2Pass) allPassed = false;

  // D.3: My salary is 75000.
  const resD3 = await runCentralAgent({
    message: "My salary is 75000.",
    conversationId: convDId,
    conversationHistory: historyD,
  });
  console.log("  Turn 3 ('My salary is 75000.'):\n  " + resD3.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  historyD.push({ role: "user", content: "My salary is 75000." });
  historyD.push({ role: "assistant", content: resD3.reply });

  const d3Pass = !resD3.reply.includes("what is the name of your current employer") && (/emi|cibil|loan amount|age/i.test(resD3.reply) || /75,?000/i.test(resD3.reply));
  console.log(`  Assert D.3 Stored salary (75000) and requested next field without re-prompting company: ${d3Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!d3Pass) allPassed = false;

  // ---------------------------------------------------------------------------
  // E. TOPIC SWITCH
  // ---------------------------------------------------------------------------
  console.log("\n▶ [E. TOPIC SWITCH]");
  // User in active flow switches: "Actually, tell me about HDFC Bank policy."
  const resE = await runCentralAgent({
    message: "Actually, tell me about HDFC Bank policy.",
    conversationId: convDId, // continuation of conversation D
    conversationHistory: historyD,
  });
  console.log("  Turn ('Actually, tell me about HDFC Bank policy.'):\n  " + resE.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  const eAnswersHdfc = /hdfc\s*bank/i.test(resE.reply);
  const eNotForced = !resE.reply.includes("Coming back to your loan eligibility check");
  const ePass = eAnswersHdfc && eNotForced;
  console.log(`  Assert E Answered HDFC policy without forcing eligibility: ${ePass ? "✅ PASS" : "❌ FAIL"}`);
  if (!ePass) allPassed = false;

  // ---------------------------------------------------------------------------
  // F. MANAGER SEARCH
  // ---------------------------------------------------------------------------
  console.log("\n▶ [F. MANAGER SEARCH]");
  const convFId = `test_sec15_f_${Date.now()}`;
  let historyF: Array<{ role: string; content: string }> = [];

  // F.1: Find an ICICI Bank manager in Pune.
  const resF1 = await runCentralAgent({
    message: "Find an ICICI Bank manager in Pune.",
    conversationId: convFId,
    conversationHistory: historyF,
  });
  console.log("  Turn 1 ('Find an ICICI Bank manager in Pune.'):\n  " + resF1.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  historyF.push({ role: "user", content: "Find an ICICI Bank manager in Pune." });
  historyF.push({ role: "assistant", content: resF1.reply });

  const f1Pass = /icici/i.test(resF1.reply) && /pune/i.test(resF1.reply) && (/branches/i.test(resF1.reply) || /manager/i.test(resF1.reply));
  console.log(`  Assert F.1 Shows matching branches / managers for ICICI in Pune: ${f1Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!f1Pass) allPassed = false;

  // F.2: Select branch
  const resF2 = await runCentralAgent({
    message: "1",
    conversationId: convFId,
    conversationHistory: historyF,
  });
  console.log("  Turn 2 ('1'):\n  " + resF2.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  const f2Pass = /manager/i.test(resF2.reply) || /branch/i.test(resF2.reply);
  console.log(`  Assert F.2 Retrieved manager details after branch selection: ${f2Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!f2Pass) allPassed = false;

  // ---------------------------------------------------------------------------
  // G. GENERAL ASSISTANCE
  // ---------------------------------------------------------------------------
  console.log("\n▶ [G. GENERAL ASSISTANCE]");
  const convGId = `test_sec15_g_${Date.now()}`;
  let historyG: Array<{ role: string; content: string }> = [];

  // G.1: Give me the steps to apply for a personal loan.
  const resG1 = await runCentralAgent({
    message: "Give me the steps to apply for a personal loan.",
    conversationId: convGId,
    conversationHistory: historyG,
  });
  console.log("  Turn 1 ('Give me the steps to apply for a personal loan.'):\n  " + resG1.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  historyG.push({ role: "user", content: "Give me the steps to apply for a personal loan." });
  historyG.push({ role: "assistant", content: resG1.reply });

  const g1Pass = /steps?\s+to\s+apply/i.test(resG1.reply) && /eligibility|document|sanction/i.test(resG1.reply);
  console.log(`  Assert G.1 Clear application process provided: ${g1Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!g1Pass) allPassed = false;

  // G.2: Do you have any offers?
  const resG2 = await runCentralAgent({
    message: "Do you have any offers?",
    conversationId: convGId,
    conversationHistory: historyG,
  });
  console.log("  Turn 2 ('Do you have any offers?'):\n  " + resG2.reply.slice(0, 160).replace(/\n/g, " ") + "...");
  const g2Pass = /partner\s*bank|offers/i.test(resG2.reply) && /interest\s*rate/i.test(resG2.reply);
  console.log(`  Assert G.2 Verified available offers explained: ${g2Pass ? "✅ PASS" : "❌ FAIL"}`);
  if (!g2Pass) allPassed = false;

  console.log("\n================================================================================");
  console.log(`OVERALL RESULT: ${allPassed ? "🎉 ALL 7 SECTION 15 SCENARIOS PASSED!" : "⚠️ SOME TESTS FAILED"}`);
  console.log("================================================================================");

  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

runSection15Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
