// scripts/test-smart-conversation-fixes.ts

import {
  isHowAreYouQuery,
  formatHowAreYouResponse,
  buildMultiBankIntakePrompt,
} from "../lib/dynamicEligibilityEngine";
import {
  isGeneralFinancialQuery,
  answerGeneralFinancialQuery,
  FINANCIAL_KNOWLEDGE_BASE,
} from "../lib/ai/generalFinancialQueries";

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 TESTING SMART CONVERSATION FIXES & USER INTENT UNDERSTANDING");
  console.log("==================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
    }
  }

  // --- ISSUE 1: "How are you" handling ---
  console.log("--- 1. Testing 'How are you' Natural Conversation ---");
  assert(isHowAreYouQuery("how are you"), "'how are you' recognized as pleasantry");
  assert(isHowAreYouQuery("how are u"), "'how are u' recognized as pleasantry");
  assert(isHowAreYouQuery("how r u"), "'how r u' recognized as pleasantry");
  assert(isHowAreYouQuery("how are you doing"), "'how are you doing' recognized as pleasantry");
  assert(isHowAreYouQuery("how's it going"), "'how\\'s it going' recognized as pleasantry");

  const howReply = formatHowAreYouResponse(false);
  assert(howReply.includes("I'm doing great, thank you for asking 😊!"), "Reply warmly states 'I'm doing great, thank you for asking 😊!'");
  assert(howReply.includes("How are you doing today?"), "Reply asks user 'How are you doing today?'");

  // --- ISSUE 2: "What is cibil" concept vs bank specific ---
  console.log("\n--- 2. Testing CIBIL Concept vs Bank-Specific Query ---");
  assert(isGeneralFinancialQuery("what is cibil"), "'what is cibil' recognized as general financial query");
  assert(isGeneralFinancialQuery("what is cibili"), "'what is cibili' (typo) recognized as general financial query");
  assert(isGeneralFinancialQuery("tell me about cibil"), "'tell me about cibil' recognized as general financial query");

  const cibilReply = await answerGeneralFinancialQuery("what is cibili");
  assert(cibilReply.includes("CIBIL & Credit Score Explained"), "Answers with general CIBIL concept header");
  assert(cibilReply.includes("300 to 900"), "Explains standard 300 to 900 score range");
  assert(!cibilReply.includes("Axis Bank Master Policy"), "Does NOT mistakenly default to Axis Bank Master Policy");

  // If bank is explicitly mentioned, it should NOT be a generic financial query
  assert(!isGeneralFinancialQuery("what is cibil for HDFC Bank"), "'what is cibil for HDFC Bank' routes to bank policy, not generic concept");

  // --- ISSUE 3: "Which documents are needed for loan" ---
  console.log("\n--- 3. Testing Common Loan Documents vs Bank-Specific Table ---");
  assert(isGeneralFinancialQuery("which documents are neded for loan"), "'which documents are neded for loan' recognized as general query");
  assert(isGeneralFinancialQuery("what documents are required for personal loan"), "'what documents are required for personal loan' recognized as general query");

  const docReply = await answerGeneralFinancialQuery("which documents are neded for loan");
  assert(docReply.includes("Standard Documents Required for Personal Loans"), "Answers with standard personal loan documentation header");
  assert(docReply.includes("Identity Proof"), "Covers Identity Proof");
  assert(docReply.includes("Address / Residence Proof"), "Covers Address Proof");
  assert(docReply.includes("Income Proof"), "Covers Income Proof");
  assert(docReply.includes("Banking & Employment Proof"), "Covers Banking & Employment Proof");
  assert(!docReply.includes("HDFC Bank Master Policy"), "Does NOT mistakenly restrict to a single bank's private table");

  // If bank is explicitly mentioned, it should NOT be generic documents
  assert(!isGeneralFinancialQuery("which documents are needed for ICICI Bank"), "'which documents are needed for ICICI Bank' routes to ICICI bank policy");

  // --- ISSUE 4: Multi-bank slot intake when user provides "My company is Microsoft" ---
  console.log("\n--- 4. Testing Progressive Multi-Bank Intake & Employer Acknowledgment ---");
  const turn1Prompt = buildMultiBankIntakePrompt({});
  assert(turn1Prompt.includes("To check your eligibility across our **23+ partner lenders**"), "Turn 1 prompts for initial inputs");
  assert(turn1Prompt.includes("employer/company name"), "Turn 1 invites company name to apply preferential terms");

  // Turn 2: User provides employer as Microsoft
  const turn2Prompt = buildMultiBankIntakePrompt({
    companyName: "Microsoft",
    employmentType: "Salaried",
  });

  assert(turn2Prompt.includes("employer as **Microsoft**"), "Turn 2 explicitly acknowledges 'employer as **Microsoft**'");
  assert(!turn2Prompt.includes("If you share your employer/company name as well"), "Turn 2 NEVER asks for employer/company name again");
  assert(turn2Prompt.includes("Net Monthly Salary"), "Turn 2 asks for remaining monthly salary");
  assert(turn2Prompt.includes("Approximate CIBIL Score"), "Turn 2 asks for remaining CIBIL score");

  // --- ISSUE 5: "Do you have any personal loan offers?" ---
  console.log("\n--- 5. Testing Personal Loan Offers Queries & Resumption Bridge ---");
  const { isGeneralLoanAssistanceQuery, getGeneralLoanAssistanceReply, buildContextualEligibilityResumptionBridge } = await import("../lib/ai/generalFinancialQueries");

  const offerQ1 = isGeneralLoanAssistanceQuery("Do you have any personal loan offers?");
  assert(offerQ1.isMatch && offerQ1.type === "OFFERS", "'Do you have any personal loan offers?' recognized as OFFERS");

  const offerQ2 = isGeneralLoanAssistanceQuery("Do you have personal loan offers?");
  assert(offerQ2.isMatch && offerQ2.type === "OFFERS", "'Do you have personal loan offers?' recognized as OFFERS");

  const offerQ3 = isGeneralLoanAssistanceQuery("Any personal loan offers?");
  assert(offerQ3.isMatch && offerQ3.type === "OFFERS", "'Any personal loan offers?' recognized as OFFERS");

  const offerQ4 = isGeneralLoanAssistanceQuery("personal loan offers");
  assert(offerQ4.isMatch && offerQ4.type === "OFFERS", "'personal loan offers' recognized as OFFERS");

  const offerQ5 = isGeneralLoanAssistanceQuery("what personal loan offers do you have?");
  assert(offerQ5.isMatch && offerQ5.type === "OFFERS", "'what personal loan offers do you have?' recognized as OFFERS");

  const offerQ6 = isGeneralLoanAssistanceQuery("loan offers");
  assert(offerQ6.isMatch && offerQ6.type === "OFFERS", "'loan offers' recognized as OFFERS");

  const offersReply = getGeneralLoanAssistanceReply({ isMatch: true, type: "OFFERS" });
  assert(offersReply.includes("Partner Bank Personal Loan Offers & Highlights"), "Offers reply contains Partner Bank Personal Loan Offers header");
  assert(offersReply.includes("Top Private Banks"), "Offers reply lists Top Private Banks (HDFC, ICICI, Axis, Kotak)");
  assert(offersReply.includes("10.25%"), "Offers reply includes benchmark interest rates");
  assert(offersReply.includes("Processing Fee Offers"), "Offers reply includes Processing Fee Offers");
  assert(!offersReply.includes("Matching Companies Found"), "Offers reply does NOT contain company selection prompt");

  // Bridge after user provided Microsoft
  const bridge = buildContextualEligibilityResumptionBridge({ companyName: "Microsoft" }, "monthlyIncome");
  assert(bridge.includes("employer as **Microsoft**"), "Bridge acknowledges employer as Microsoft");
  assert(bridge.includes("net monthly take-home salary"), "Bridge prompts for next field (monthly salary)");
  assert(!bridge.includes("name of your current employer"), "Bridge does NOT re-prompt for employer");

  console.log("\n==================================================================");
  console.log(`📊 RESULTS: ${passed} / ${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("==================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
