import { runCentralAgent } from "../lib/ai/agent";
import { clearEligibilityState, getEligibilityState, saveEligibilityState } from "../lib/dynamicEligibilityEngine";

async function runTests() {
  console.log("================================================================================");
  console.log("🤖 TESTING CHATGPT-STYLE CONVERSATIONAL BEHAVIOR IN CREDITWISE AI");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      failed++;
    }
  }

  // Helper to send message with conversation history tracking
  async function chat(convId: string, message: string, history: Array<{ role: string; content: string }>) {
    const res = await runCentralAgent({
      message,
      conversationId: convId,
      conversationHistory: [...history],
    });
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: res.reply });
    return res;
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Mandatory Company Confirmation (Exact single match)
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 1: Mandatory Company Confirmation on Single Match ---");
  const conv1 = `conv_test_comp_${Date.now()}`;
  const hist1: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv1);

  const res1_1 = await chat(conv1, "I want a personal loan", hist1);
  assert(
    /company|employer/i.test(res1_1.reply),
    "1.1 Intent detected, prompts for employer",
    res1_1.reply
  );

  const res1_2 = await chat(conv1, "Infosys", hist1);
  assert(
    /confirm.*employer/i.test(res1_2.reply) && /Infosys/i.test(res1_2.reply),
    "1.2 Shows mandatory company confirmation list/prompt",
    res1_2.reply
  );

  const res1_3 = await chat(conv1, "Yes", hist1);
  assert(
    /Corporate Intelligence|\bInfosys\b/i.test(res1_3.reply) && /salary|income/i.test(res1_3.reply),
    "1.3 User confirms 'Yes' -> company confirmed and advances to monthly salary",
    res1_3.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Compound Message (Company + Salary) with Mandatory Confirmation
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 2: Compound Company + Salary Input ---");
  const conv2 = `conv_test_compound_${Date.now()}`;
  const hist2: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv2);

  const res2_1 = await chat(conv2, "I work at Infosys and earn 80000", hist2);
  assert(
    /confirm.*employer/i.test(res2_1.reply) && /Infosys/i.test(res2_1.reply),
    "2.1 Prompts to confirm Infosys employer",
    res2_1.reply
  );

  const res2_2 = await chat(conv2, "Yes", hist2);
  assert(
    !/take-home salary\?/i.test(res2_2.reply) && (/how much|borrow|loan amount|tenure/i.test(res2_2.reply)),
    "2.2 Confirms company and advances to next field without asking for salary again",
    res2_2.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Compound Company + Question in One Message
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 3: Compound Company + Side Question ---");
  const conv3 = `conv_test_comp_q_${Date.now()}`;
  const hist3: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv3);

  const res3_1 = await chat(conv3, "I work at Infosys, but what is CIBIL?", hist3);
  assert(
    /3-digit|credit.*track record/i.test(res3_1.reply) && /confirm.*employer/i.test(res3_1.reply) && /Infosys/i.test(res3_1.reply),
    "3.1 Answers CIBIL question pointwise AND displays company confirmation prompt",
    res3_1.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Pointwise ChatGPT-style Q&A during Active Assessment & Gentle Prompt
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 4: Side Question during Assessment with Gentle Prompt ---");
  const conv4 = `conv_test_side_q_${Date.now()}`;
  const hist4: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv4);

  // Setup: User at salary step
  await chat(conv4, "I need a loan", hist4);
  await chat(conv4, "Infosys", hist4);
  await chat(conv4, "Yes", hist4);

  // User asks question instead of giving salary
  const res4_1 = await chat(conv4, "What is CIBIL?", hist4);
  assert(
    res4_1.reply.includes("* **") && /can we proceed with your loan eligibility calculation\?/i.test(res4_1.reply),
    "4.1 Answer is structured pointwise with bold bullets AND gently asks to proceed without force",
    res4_1.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Resuming on Agreement ("Yes")
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 5: Resuming on Agreement ---");
  const res5_1 = await chat(conv4, "Yes", hist4);
  assert(
    /proceed|welcome back/i.test(res5_1.reply) && /salary/i.test(res5_1.reply),
    "5.1 User says 'Yes' -> warm acknowledgment, recaps known details, and prompts for salary",
    res5_1.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Pausing on Rejection ("Not now")
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 6: Pausing on Rejection ---");
  const conv6 = `conv_test_pause_${Date.now()}`;
  const hist6: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv6);

  await chat(conv6, "I want a loan", hist6);
  await chat(conv6, "Infosys", hist6);
  await chat(conv6, "Yes", hist6);

  const res6_1 = await chat(conv6, "What is FOIR?", hist6);
  assert(/can we proceed/i.test(res6_1.reply), "6.1 Asks to proceed after FOIR question", res6_1.reply);

  const res6_2 = await chat(conv6, "Not now", hist6);
  assert(/paused|resume/i.test(res6_2.reply), "6.2 User says 'Not now' -> politely acknowledges pause and mentions 'resume'", res6_2.reply);

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Natural Short Replies ("80k", "5 years", "750", "28", "0")
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 7: Natural Short Replies ---");
  const conv7 = `conv_test_short_${Date.now()}`;
  const hist7: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv7);

  await chat(conv7, "I want a loan", hist7);
  await chat(conv7, "Infosys", hist7);
  await chat(conv7, "Yes", hist7);

  // Send "80k" for monthlyIncome
  const res7_1 = await chat(conv7, "80k", hist7);
  assert(/borrow|loan amount/i.test(res7_1.reply), "7.1 Short salary '80k' accepted -> asks for loan amount", res7_1.reply);

  // Send "10 lakh" for loanAmount
  const res7_2 = await chat(conv7, "10 lakh", hist7);
  assert(/tenure/i.test(res7_2.reply), "7.2 Short loan amount '10 lakh' accepted -> asks for tenure", res7_2.reply);

  // Send "5 years" for tenureMonths
  const res7_3 = await chat(conv7, "5 years", hist7);
  assert(/cibil|credit score/i.test(res7_3.reply), "7.3 Short tenure '5 years' accepted -> asks for CIBIL", res7_3.reply);

  // Send "750" for cibil
  const res7_4 = await chat(conv7, "750", hist7);
  assert(/age/i.test(res7_4.reply), "7.4 Short CIBIL '750' accepted -> asks for age", res7_4.reply);

  // Send "28" for age
  const res7_5 = await chat(conv7, "28", hist7);
  assert(/emi|existing/i.test(res7_5.reply), "7.5 Short age '28' accepted -> asks for existing EMI", res7_5.reply);

  // Send "0" for existingEmi -> Full evaluation!
  const res7_6 = await chat(conv7, "0", hist7);
  assert(/Eligible Banks|HDFC|Status/i.test(res7_6.reply), "7.6 Short EMI '0' accepted -> completes all 7 fields and outputs evaluation table!", res7_6.reply);

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Contextual Follow-up ("What about HDFC?", "And for 5 years?")
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 8: Contextual Follow-ups ---");
  // Follow-up after evaluation: "What about HDFC?"
  const res8_1 = await chat(conv7, "What about HDFC?", hist7);
  assert(/HDFC Bank/i.test(res8_1.reply) && /personal loans|eligibility/i.test(res8_1.reply), "8.1 Contextual bank follow-up 'What about HDFC?' gives HDFC details", res8_1.reply);

  // Tenure follow-up with existing loan amount
  const res8_2 = await chat(conv7, "And for 3 years?", hist7);
  assert(/₹|EMI|month/i.test(res8_2.reply) && /3 years/i.test(res8_2.reply), "8.2 Contextual follow-up 'And for 3 years?' calculates EMI for 3 years", res8_2.reply);

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Corrections ("Actually my salary is 90k")
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 9: Mid-conversation Correction ---");
  const conv9 = `conv_test_corr_${Date.now()}`;
  const hist9: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv9);

  await chat(conv9, "I work at Infosys and earn 80000", hist9);
  await chat(conv9, "Yes", hist9);

  // User corrects salary
  const res9_1 = await chat(conv9, "Actually my salary is 90k, not 80k", hist9);
  const state9 = await getEligibilityState(conv9);
  assert(
    state9?.applicant.monthlyIncome === 90000,
    "9.1 Salary successfully updated to 90,000 via natural correction",
    `Monthly income is ${state9?.applicant.monthlyIncome}`
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Standalone Q&A Outside Assessment (No mechanical prompt)
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 10: Standalone Q&A Outside Assessment ---");
  const conv10 = `conv_test_standalone_${Date.now()}`;
  const hist10: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv10);

  const res10_1 = await chat(conv10, "What is reducing balance interest rate?", hist10);
  assert(
    res10_1.reply.includes("* **Reducing Rate**:") && !res10_1.reply.includes("can we proceed with your loan eligibility calculation?"),
    "10.1 Standalone question answered pointwise WITHOUT mechanical eligibility prompt",
    res10_1.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Out of Domain Boundary Redirection
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 11: Out-of-Domain Redirection ---");
  const conv11 = `conv_test_ood_${Date.now()}`;
  const hist11: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv11);

  const res11_1 = await chat(conv11, "Write me a Python script for web scraping", hist11);
  assert(
    /CreditWise|personal loan|finance|assist/i.test(res11_1.reply),
    "11.1 Politely redirects out-of-domain request while remaining in finance scope",
    res11_1.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Contextual "Why?" Objections
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 12: Contextual 'Why?' Objections ---");
  const conv12 = `conv_test_why_${Date.now()}`;
  const hist12: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv12);

  await chat(conv12, "I want a loan", hist12);
  const whyResp = await chat(conv12, "why?", hist12);

  assert(
    whyResp.reply.includes("* **Category Tiers**:") || /employer|tiers|category/i.test(whyResp.reply),
    "12.1 'why?' contextual objection answered pointwise explaining employer category importance",
    whyResp.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 13: Company Information Inquiry Flow ("i want my company information")
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 13: Company Information Inquiry Flow ---");
  const conv13 = `conv_test_comp_info_${Date.now()}`;
  const hist13: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv13);

  const res13_1 = await chat(conv13, "i want my company information", hist13);
  assert(
    /tell me your company'?s name|company name/i.test(res13_1.reply) &&
      res13_1.reply.includes("* **What I Check**:") &&
      !res13_1.reply.includes("can we proceed with your loan eligibility calculation?"),
    "13.1 Asks for company name pointwise without mechanical calculation prompt",
    res13_1.reply
  );

  const res13_2 = await chat(conv13, "infosys", hist13);
  assert(
    /confirm.*employer/i.test(res13_2.reply) && /Infosys/i.test(res13_2.reply),
    "13.2 Shows mandatory company confirmation list/prompt for Infosys",
    res13_2.reply
  );

  const res13_3 = await chat(conv13, "Yes", hist13);
  assert(
    /Corporate Intelligence|\bInfosys\b/i.test(res13_3.reply) && /salary|income|take-home/i.test(res13_3.reply),
    "13.3 Provides company corporate intelligence and advances to salary",
    res13_3.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 14: Company Disavowal ("this is not my company") — Zero Salary Loop
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 14: Company Disavowal at Salary Step ---");
  const conv14 = `conv_test_disavowal_${Date.now()}`;
  const hist14: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv14);

  // Step 1: User gives company
  await chat(conv14, "I work at Infosys", hist14);
  await chat(conv14, "Yes", hist14); // Now at salary step

  // Step 2: User says "this is not my company"
  const res14_disavow = await chat(conv14, "this is not my company", hist14);
  assert(
    /removed that company|actual.*employer|company name/i.test(res14_disavow.reply) &&
      !/take-home pay|quick number for your monthly salary/i.test(res14_disavow.reply),
    "14.1 Resets company and asks for actual company, ZERO salary loop repetition",
    res14_disavow.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 15: Compound Company Disavowal With Replacement Company
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 15: Disavowal with Immediate Replacement Company ---");
  const conv15 = `conv_test_replace_comp_${Date.now()}`;
  const hist15: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv15);

  await chat(conv15, "I work at Infosys", hist15);
  await chat(conv15, "Yes", hist15); // Now at salary step

  const res15_replace = await chat(conv15, "this is not my company, I work at TCS", hist15);
  assert(
    /confirm.*employer/i.test(res15_replace.reply) && /Tata Consultancy Services|TCS/i.test(res15_replace.reply),
    "15.1 Immediately removes previous company and prompts to confirm TCS",
    res15_replace.reply
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 16: Pointwise Ineligibility Guidance Report
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 16: Pointwise Ineligibility Guidance Report ---");
  const conv16 = `conv_test_ineligible_${Date.now()}`;
  const hist16: Array<{ role: string; content: string }> = [];
  await clearEligibilityState(conv16);

  // Ineligible parameters (very low salary 12000, huge loan 20 lakh, low cibil 550)
  const ineligMsg = "I work at Infosys, salary is 12000, need 20 lakh loan for 2 years, cibil is 550, age is 25, zero emi";
  const res16_eval = await chat(conv16, ineligMsg, hist16);
  // May need confirmation if Infosys wasn't confirmed
  let ineligReport = res16_eval.reply;
  if (/confirm.*employer/i.test(ineligReport)) {
    const confirmRes = await chat(conv16, "Yes", hist16);
    ineligReport = confirmRes.reply;
  }

  assert(
    ineligReport.includes("#### 💡 How You Can Become Eligible:") &&
      ineligReport.includes("* **") &&
      ineligReport.includes("Salary Threshold") || ineligReport.includes("Credit Score") || ineligReport.includes("Lower Loan Amount"),
    "16.1 Ineligible profile assessment contains pointwise actionable guidance",
    ineligReport
  );

  console.log("\n================================================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
