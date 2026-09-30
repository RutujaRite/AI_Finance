import {
  extractCompanyCandidateFromText,
  isCompanyInfoOrSearchIntent,
  extractTargetCompanyFromMessage,
} from "../lib/dynamicEligibilityEngine";
import { searchCompany } from "../lib/companySearch";
import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

let passed = 0;
let failed = 0;

function check(condition: boolean, testName: string, actual?: any) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    if (actual !== undefined) {
      console.error(`   Actual:`, actual);
    }
    failed++;
  }
}

async function runTests() {
  console.log("=== STEP 1: TEST EXTRACTION & SEARCH INTENT DETECTION ===\n");

  const phrase1 = "I am working at TCS. Give me information about that company";
  check(
    isCompanyInfoOrSearchIntent(phrase1),
    "1.1 Detects company info intent for: 'I am working at TCS. Give me information about that company'",
    isCompanyInfoOrSearchIntent(phrase1)
  );
  check(
    extractTargetCompanyFromMessage(phrase1) === "TCS" || extractCompanyCandidateFromText(phrase1) === "TCS",
    "1.2 Extracts employer 'TCS' from compound sentence",
    extractCompanyCandidateFromText(phrase1)
  );

  const phrase2 = "I work at TCS";
  check(
    extractCompanyCandidateFromText(phrase2) === "TCS",
    "1.3 Extracts 'TCS' from 'I work at TCS'",
    extractCompanyCandidateFromText(phrase2)
  );

  const phrase3 = "I am working at Infosys";
  check(
    extractCompanyCandidateFromText(phrase3) === "Infosys",
    "1.4 Extracts 'Infosys' from 'I am working at Infosys'",
    extractCompanyCandidateFromText(phrase3)
  );

  const phrase4 = "Tell me about TCS";
  check(
    extractCompanyCandidateFromText(phrase4) === "TCS",
    "1.5 Extracts 'TCS' from 'Tell me about TCS'",
    extractCompanyCandidateFromText(phrase4)
  );

  const phrase5 = "My company is TCS";
  check(
    extractCompanyCandidateFromText(phrase5) === "TCS",
    "1.6 Extracts 'TCS' from 'My company is TCS'",
    extractCompanyCandidateFromText(phrase5)
  );

  const phrase6 = "I work at Tata Consultancy Services";
  check(
    extractCompanyCandidateFromText(phrase6) === "Tata Consultancy Services",
    "1.7 Extracts 'Tata Consultancy Services' from 'I work at Tata Consultancy Services'",
    extractCompanyCandidateFromText(phrase6)
  );

  console.log("\n=== STEP 2: TEST SEARCH COMPANY CANDIDATE RETENTION ===\n");

  const tcsSearch = await searchCompany("TCS");
  check(tcsSearch.found === true, "2.1 searchCompany('TCS') returns found = true");
  check(tcsSearch.needsDisambiguation === true, "2.2 searchCompany('TCS') requires disambiguation");
  check(
    tcsSearch.candidateOptions.length > 1,
    "2.3 searchCompany('TCS') preserves multiple candidate options",
    tcsSearch.candidateOptions.length
  );
  check(
    tcsSearch.candidateOptions[0].name.toLowerCase().includes("tata consultancy"),
    "2.4 Top ranked candidate is Tata Consultancy Services Limited",
    tcsSearch.candidateOptions[0].name
  );

  const infosysSearch = await searchCompany("Infosys");
  check(infosysSearch.found === true, "2.5 searchCompany('Infosys') returns found = true");
  check(infosysSearch.needsDisambiguation === true, "2.6 searchCompany('Infosys') requires disambiguation");
  check(
    infosysSearch.candidateOptions.length > 1,
    "2.7 searchCompany('Infosys') preserves multiple candidate options",
    infosysSearch.candidateOptions.length
  );

  console.log("\n=== STEP 3: TEST AGENT COMPANY FLOW TURN 1 (MATCHING LIST FIRST) ===\n");

  const convId = "test-comp-disambig-" + Date.now();
  await clearEligibilityState(convId);

  const turn1 = await runCentralAgent({
    message: "I am working at TCS. Give me information about that company",
    conversationId: convId,
  });

  check(
    turn1.reply.includes("Matching Companies Found") || turn1.reply.includes("matching options"),
    "3.1 Turn 1 shows matching companies list header",
    turn1.reply.substring(0, 150)
  );
  check(
    turn1.reply.includes("Tata Consultancy Services") && turn1.reply.includes("TCS Foundation"),
    "3.2 Turn 1 lists multiple numbered matching candidates",
    turn1.reply.substring(0, 250)
  );
  check(
    !turn1.reply.includes("#### 📋 Basic Corporate Information"),
    "3.3 Turn 1 does NOT directly display full corporate basic info card"
  );
  check(
    !turn1.reply.toLowerCase().includes("monthly income") && !turn1.reply.toLowerCase().includes("salary"),
    "3.4 Turn 1 does NOT trigger loan eligibility / ask for salary"
  );

  const stateTurn1 = await getEligibilityState(convId);
  check(
    stateTurn1?.companyFlow?.stage === "COMPANY_SELECTION",
    "3.5 State saved companyFlow.stage as COMPANY_SELECTION",
    stateTurn1?.companyFlow?.stage
  );
  check(
    stateTurn1?.in_eligibility_flow === false,
    "3.6 in_eligibility_flow is false (not forced into loan funnel)",
    stateTurn1?.in_eligibility_flow
  );

  console.log("\n=== STEP 4: TEST AGENT COMPANY FLOW TURN 2 (EXPLICIT SELECTION) ===\n");

  const turn2 = await runCentralAgent({
    message: "1",
    conversationId: convId,
  });

  check(
    turn2.reply.includes("Corporate Intelligence") || turn2.reply.includes("Company Overview"),
    "4.1 Turn 2 displays corporate intelligence / overview after selection",
    turn2.reply.substring(0, 150)
  );
  check(
    turn2.reply.includes("Basic Information") || turn2.reply.includes("Basic Corporate Information"),
    "4.2 Turn 2 displays basic corporate information table",
    turn2.reply.substring(0, 250)
  );
  check(
    turn2.reply.includes("Financial Health") || turn2.reply.includes("Turnover"),
    "4.3 Turn 2 displays financial information table"
  );
  check(
    turn2.reply.includes("Bank / Employer Records"),
    "4.4 Turn 2 displays partner bank employer records"
  );
  check(
    !turn2.reply.toLowerCase().includes("what is your approximate monthly take-home salary"),
    "4.5 Turn 2 does NOT append loan eligibility questions"
  );

  const stateTurn2 = await getEligibilityState(convId);
  check(
    stateTurn2?.in_eligibility_flow === false,
    "4.6 State preserves in_eligibility_flow = false after selection",
    stateTurn2?.in_eligibility_flow
  );

  console.log("\n=== STEP 5: TEST TELL ME ABOUT TCS ===\n");

  const convId2 = "test-comp-tell-me-" + Date.now();
  await clearEligibilityState(convId2);

  const turnTellMe = await runCentralAgent({
    message: "Tell me about TCS",
    conversationId: convId2,
  });

  check(
    turnTellMe.reply.includes("Matching Companies Found") || turnTellMe.reply.includes("matching options"),
    "5.1 'Tell me about TCS' shows matching companies list first",
    turnTellMe.reply.substring(0, 150)
  );
  check(
    !turnTellMe.reply.includes("#### 📋 Basic Corporate Information"),
    "5.2 'Tell me about TCS' does NOT auto-select the first result directly"
  );

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
