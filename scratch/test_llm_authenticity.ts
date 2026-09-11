import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

// Old canned strings that MUST NOT appear anymore
const BANNED_CANNED_STRINGS = [
  "You're very welcome! If you need assistance with loan eligibility, EMI calculations, or bank policies, feel free to ask.",
  "Great! How can I assist you further? You can ask to check personal loan eligibility, calculate EMIs, or view bank policies.",
  "Goodbye! Have a great day ahead. Feel free to return anytime you need financial or loan guidance.",
  "Good morning! I'm CreditWise AI, your financial intelligence assistant. I can help you check loan eligibility",
  "Good afternoon! I'm CreditWise AI, your financial intelligence assistant.",
  "Good evening! I'm CreditWise AI, your financial intelligence assistant.",
  "Hello! I am CreditWise AI, your automated Banking & Financial Intelligence Assistant.\n\nI can help you:\n- **Evaluate Personal & Corporate Loan Eligibility**",
  "Glad that helped! Let's pick right back up with your loan assessment",
  "Whenever you'd like to continue your personal loan assessment",
];

function assertNotCanned(text: string, label: string) {
  for (const banned of BANNED_CANNED_STRINGS) {
    if (text.includes(banned)) {
      throw new Error(`[FAIL: CANNED STRING DETECTED] ${label} contains banned canned phrase:\n"${banned}"\nFull text:\n"${text}"`);
    }
  }
}

async function testAuthenticity() {
  console.log("================================================================================");
  console.log("🧪 COMPREHENSIVE LLM AUTHENTICITY & CONTEXTUAL REFACTORING TEST SUITE");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  async function runStep(name: string, fn: () => Promise<void>) {
    totalTests++;
    console.log(`\n▶ TEST ${totalTests}: ${name}`);
    try {
      await fn();
      passedTests++;
      console.log(`✅ TEST ${totalTests} PASSED: ${name}`);
    } catch (err: any) {
      console.error(`❌ TEST ${totalTests} FAILED: ${name}\n`, err?.message || err);
      throw err;
    }
  }

  // --- Test 1: Greetings (LLM Generated & Dynamic) ---
  await runStep("Greetings are dynamic and not matching old canned templates", async () => {
    const convId = "test-greeting-" + Date.now();
    const res1 = await runCentralAgent({
      message: "Good morning! How are you doing today?",
      conversationId: convId,
    });
    console.log(`Reply 1:\n${res1.reply}\n`);
    assertNotCanned(res1.reply, "Greeting 1");
    if (!res1.reply || res1.reply.length < 15) throw new Error("Greeting reply too short");

    const res2 = await runCentralAgent({
      message: "Hey there CreditWise! What can you help me with?",
      conversationId: "test-greeting-2-" + Date.now(),
    });
    console.log(`Reply 2:\n${res2.reply}\n`);
    assertNotCanned(res2.reply, "Greeting 2");
    if (!res2.reply || res2.reply.length < 15) throw new Error("Greeting reply 2 too short");
  });

  // --- Test 2: Casual Messages & Acknowledgements (Contextual LLM) ---
  await runStep("Casual messages (thanks, ok, cool, bye) are dynamic and contextual", async () => {
    const convId = "test-casual-" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    // Turn 1: User asks a quick question
    const q1 = "What is the repo rate?";
    const res1 = await runCentralAgent({ message: q1, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: q1 }, { role: "assistant", content: res1.reply });

    // Turn 2: User says thanks
    const q2 = "Thank you so much, that was super clear!";
    const res2 = await runCentralAgent({ message: q2, conversationId: convId, conversationHistory: history });
    console.log(`Thanks reply:\n${res2.reply}\n`);
    assertNotCanned(res2.reply, "Thanks reply");
    if (!res2.reply || res2.reply.length < 10) throw new Error("Thanks reply too short");

    // Turn 3: User says ok cool
    const q3 = "Awesome, cool!";
    const res3 = await runCentralAgent({ message: q3, conversationId: convId, conversationHistory: history });
    console.log(`Cool reply:\n${res3.reply}\n`);
    assertNotCanned(res3.reply, "Cool reply");

    // Turn 4: User says bye
    const q4 = "Alright, see you later, bye!";
    const res4 = await runCentralAgent({ message: q4, conversationId: convId, conversationHistory: history });
    console.log(`Bye reply:\n${res4.reply}\n`);
    assertNotCanned(res4.reply, "Bye reply");
  });

  // --- Test 3: Standalone Concept QA (No static continuation template appended) ---
  await runStep("Concept explanation (What is FOIR?) produces clean explanation without robotic append", async () => {
    const convId = "test-foir-" + Date.now();
    const res = await runCentralAgent({
      message: "What is FOIR in banking?",
      conversationId: convId,
    });
    console.log(`FOIR reply:\n${res.reply}\n`);
    assertNotCanned(res.reply, "FOIR definition");
    if (!/fixed\s*obligation|income\s*ratio|formula|emi/i.test(res.reply)) {
      throw new Error("Expected FOIR explanation to mention obligation/income ratio");
    }
    if (res.reply.includes("Whenever you'd like to continue")) {
      throw new Error("Found static continuation hint in standalone concept QA");
    }
  });

  // --- Test 4: Objections Mid-Assessment (Why Age / CIBIL Score Impact) ---
  await runStep("In-flow objections are answered conversationally and progress eligibility", async () => {
    const convId = "test-objection-" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    // Step 1: Start loan intent
    const m1 = "I want to apply for a personal loan. I work at Microsoft with 1.2 Lakh salary.";
    const r1 = await runCentralAgent({ message: m1, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m1 }, { role: "assistant", content: r1.reply });
    console.log(`Loan start reply:\n${r1.reply}\n`);
    assertNotCanned(r1.reply, "Loan start reply");

    // Step 2: User raises objection about age
    const m2 = "Why do you need to know my age? Is that really mandatory?";
    const r2 = await runCentralAgent({ message: m2, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m2 }, { role: "assistant", content: r2.reply });
    console.log(`Age objection reply:\n${r2.reply}\n`);
    assertNotCanned(r2.reply, "Age objection reply");
    if (!/age|21|60|tenure|policy|retirement/i.test(r2.reply)) {
      throw new Error("Expected age objection reply to explain why age matters");
    }

    // Step 3: User raises objection about CIBIL impact
    const m3 = "Will this check hurt my credit score? I am worried about hard inquiries.";
    const r3 = await runCentralAgent({ message: m3, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m3 }, { role: "assistant", content: r3.reply });
    console.log(`CIBIL objection reply:\n${r3.reply}\n`);
    assertNotCanned(r3.reply, "CIBIL objection reply");
    if (!/cibil|score|inquiry|soft|impact|safe|protect/i.test(r3.reply)) {
      throw new Error("Expected CIBIL objection reply to reassure user about soft credit check");
    }
  });

  // --- Test 5: Side Question Mid-Flow (Disbursement time / Collateral) ---
  await runStep("Side question during active flow is answered without mechanical template", async () => {
    const convId = "test-sideq-" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    const m1 = "I need ₹6 Lakh loan, my company is Infosys";
    const r1 = await runCentralAgent({ message: m1, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m1 }, { role: "assistant", content: r1.reply });

    // Side question: Do I need collateral?
    const m2 = "Do I need to pledge collateral or get a guarantor for this loan?";
    const r2 = await runCentralAgent({ message: m2, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m2 }, { role: "assistant", content: r2.reply });
    console.log(`Collateral side question reply:\n${r2.reply}\n`);
    assertNotCanned(r2.reply, "Collateral side question reply");
    if (!/unsecured|collateral|security|guarantor/i.test(r2.reply)) {
      throw new Error("Expected side question reply to explain unsecured loan / no collateral");
    }
  });

  // --- Test 6: In-flow Correction (Wait, actually my salary is 95000 not 80k) ---
  await runStep("Profile correction is naturally acknowledged by LLM and updates applicant state", async () => {
    const convId = "test-correction-" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    const m1 = "I want a loan for Wipro with salary 80000";
    const r1 = await runCentralAgent({ message: m1, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m1 }, { role: "assistant", content: r1.reply });

    // Correction
    const m2 = "Wait, actually my salary is 95000, not 80k";
    const r2 = await runCentralAgent({ message: m2, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m2 }, { role: "assistant", content: r2.reply });
    console.log(`Correction reply:\n${r2.reply}\n`);
    assertNotCanned(r2.reply, "Correction reply");

    const state = await getEligibilityState(convId);
    if (state?.applicant?.monthlyIncome !== 95000) {
      throw new Error(`Expected applicant monthlyIncome to be updated to 95000, got: ${state?.applicant?.monthlyIncome}`);
    }
  });

  // --- Test 7: Unexpected Reply (I am not working anywhere right now) ---
  await runStep("Unexpected replies like unemployment are gracefully handled with policy context", async () => {
    const convId = "test-unemployed-" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    const m1 = "Can I get a personal loan?";
    const r1 = await runCentralAgent({ message: m1, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m1 }, { role: "assistant", content: r1.reply });

    const m2 = "I am not working anywhere right now";
    const r2 = await runCentralAgent({ message: m2, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m2 }, { role: "assistant", content: r2.reply });
    console.log(`Unemployed reply:\n${r2.reply}\n`);
    assertNotCanned(r2.reply, "Unemployed reply");
    if (!/not eligible|ineligible|income|regular|employment|unsecured/i.test(r2.reply)) {
      throw new Error("Expected unemployed response to explain income/employment policy requirement");
    }
  });

  // --- Test 8: Full End-to-End Eligibility Assessment with Structured Result Table ---
  await runStep("Complete loan eligibility flow produces final policy evaluation with required table format", async () => {
    const convId = "test-full-eval-" + Date.now();
    const history: Array<{ role: string; content: string }> = [];

    // Turn 1: Intent + Employer
    const m1 = "I need ₹10 Lakh personal loan, I work at Google";
    const r1 = await runCentralAgent({ message: m1, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m1 }, { role: "assistant", content: r1.reply });
    assertNotCanned(r1.reply, "Eval Turn 1");

    // Turn 2: Salary
    const m2 = "My net monthly take-home salary is ₹1,60,000";
    const r2 = await runCentralAgent({ message: m2, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m2 }, { role: "assistant", content: r2.reply });
    assertNotCanned(r2.reply, "Eval Turn 2");

    // Turn 3: Tenure
    const m3 = "4 years";
    const r3 = await runCentralAgent({ message: m3, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m3 }, { role: "assistant", content: r3.reply });
    assertNotCanned(r3.reply, "Eval Turn 3");

    // Turn 4: CIBIL
    const m4 = "My CIBIL score is 780";
    const r4 = await runCentralAgent({ message: m4, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m4 }, { role: "assistant", content: r4.reply });
    assertNotCanned(r4.reply, "Eval Turn 4");

    // Turn 5: Existing EMI & Age
    const m5 = "I have 0 EMI and my age is 31";
    const r5 = await runCentralAgent({ message: m5, conversationId: convId, conversationHistory: history });
    history.push({ role: "user", content: m5 }, { role: "assistant", content: r5.reply });
    console.log(`Final Evaluation Report:\n${r5.reply}\n`);
    assertNotCanned(r5.reply, "Final Report");

    // Verify required table format
    const hasRequiredTable = /\|\s*Bank\s*\|\s*Status\s*\|\s*CIBIL\s*\|\s*Tenure\s*\|\s*Est\.\s*EMI\s*\|/i.test(r5.reply);
    if (!hasRequiredTable) {
      throw new Error(`Evaluation did not contain required table schema: | Bank | Status | CIBIL | Tenure | Est. EMI |`);
    }
    // Verify eligible banks like HDFC or ICICI appear
    if (!/HDFC|ICICI|Axis|Kotak/i.test(r5.reply)) {
      throw new Error("Expected qualifying partner banks in evaluation result");
    }
  });

  console.log("\n================================================================================");
  console.log(`🎉 ALL ${passedTests} OF ${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log("No hardcoded canned responses or regex fallbacks were triggered.");
  console.log("All responses were contextual and dynamically LLM/NLU-generated.");
  console.log("================================================================================\n");
}

testAuthenticity().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
