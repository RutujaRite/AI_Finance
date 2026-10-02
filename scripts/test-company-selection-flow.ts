import { normalizeCompanySearchInput, searchCompany, findCompanySuggestions, formatCompanyResponse } from "../lib/companySearch";
import { extractCompanyCandidateFromText, getEligibilityState, saveEligibilityState } from "../lib/dynamicEligibilityEngine";
import { runCentralAgent } from "../lib/ai/agent";
import pool from "../lib/db";

async function runTests() {
  console.log("=================================================");
  console.log("   CREDITWISE AI: COMPANY SELECTION FLOW TEST   ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // TEST 1: Input extraction & normalization
  console.log("--- 1. Testing Input Extraction & Normalization ---");
  const inputs = [
    { raw: "Infosys", expected: "Infosys" },
    { raw: "Infosys Pvt Ltd", expected: "Infosys" },
    { raw: "I work at Infosys", expected: "Infosys" },
    { raw: "My employer is Infosys", expected: "Infosys" },
    { raw: "infosys pvt. limited", expected: "infosys" },
    { raw: "I am working in Wipro", expected: "Wipro" },
    { raw: "My company is TCS", expected: "TCS" },
  ];

  for (const item of inputs) {
    const extracted = extractCompanyCandidateFromText(item.raw);
    const normalized = normalizeCompanySearchInput(item.raw);
    const success = (extracted?.toLowerCase() === item.expected.toLowerCase()) || 
                    (normalized.toLowerCase() === item.expected.toLowerCase());
    assert(success, `"${item.raw}" -> extracted: "${extracted}", normalized: "${normalized}" (expected: "${item.expected}")`);
  }

  // TEST 2: Spelling mistakes / fuzzy typo matching
  console.log("\n--- 2. Testing Spelling Mistakes / Typo Suggestions ---");
  const typoTests = ["infoye", "infosis"];
  for (const typo of typoTests) {
    const suggestions = await findCompanySuggestions(typo);
    const hasInfosys = suggestions.some((s) => s.name.toLowerCase() === "infosys");
    assert(hasInfosys, `Typo "${typo}" suggested "Infosys": ${JSON.stringify(suggestions.map(s => s.name))}`);
  }

  // TEST 3: Database & Alias Resolution (TCS, Tata)
  console.log("\n--- 3. Testing Database Search & Alias Resolution ---");
  const tcsRes = await searchCompany("TCS");
  assert(tcsRes.found, `TCS resolved in database: found=${tcsRes.found}, name="${tcsRes.primaryName}"`);
  assert(tcsRes.bankRecords.length > 0, `TCS returned ${tcsRes.bankRecords.length} bank records`);

  const tataRes = await searchCompany("Tata");
  assert(tataRes.found, `Tata search found=${tataRes.found}`);
  assert(tataRes.candidates.length > 1, `Tata returned multiple candidates (${tataRes.candidates.length} candidates)`);
  assert(tataRes.needsDisambiguation, `Tata correctly flagged needsDisambiguation=true`);

  // TEST 4: No Match Handling
  console.log("\n--- 4. Testing No Match Handling ---");
  const noMatchRes = await searchCompany("XyzNonExistentCorporation999");
  assert(!noMatchRes.found, `Non-existent company found=false`);

  // TEST 5: Single Response Format (Overview + Basic + Financial + Bank Records)
  console.log("\n--- 5. Testing Single Response 4-Section Output ---");
  const formattedInfosys = formatCompanyResponse({
    found: true,
    primaryName: "Infosys Limited",
    overview: "Infosys Limited is a global leader in next-generation digital services and consulting.",
    basicInfo: {
      company_name: "Infosys Limited",
      cin: "L85110KA1981PLC013115",
      industry: "IT Services",
      address: "Electronics City, Bengaluru",
      website: "https://www.infosys.com",
      country: "India",
      incorporation_date: "1981-07-02",
      listing_status: "Public Listed",
    },
    financialInfo: {
      company_name: "Infosys Limited",
      employees: "300,000+",
      turnover: "₹1,40,000+ Cr",
      profit_status: "Profitable",
      last_agm: "2025-06-25",
      profit_history: "Positive cash flow",
    },
    bankRecords: [
      { bank_name: "HDFC Bank", company_category: "Super CAT A", other_info: "Tier 1", sr_no: "1", company_name: "Infosys Limited" },
      { bank_name: "ICICI Bank", company_category: "Elite", other_info: "Tier 1", sr_no: "2", company_name: "Infosys Limited" },
    ],
    candidates: ["Infosys Limited"],
    candidateOptions: [{ id: "1", name: "Infosys Limited", source: "database" }],
    needsDisambiguation: false,
  });

  assert(formattedInfosys.includes("Company Overview"), "Response contains Section 1: Company Overview");
  assert(formattedInfosys.includes("Basic Information"), "Response contains Section 2: Basic Information");
  assert(formattedInfosys.includes("Financial Information"), "Response contains Section 3: Financial Information");
  assert(formattedInfosys.includes("Bank / Employer Records"), "Response contains Section 4: Bank / Employer Records");

  // TEST 6: End-to-End Agent Conversation Flows
  console.log("\n--- 6. Testing End-to-End Agent Conversation Flows ---");
  const testConvId = "test_flow_" + Date.now();

  // 6A. Typo flow with confirmation: "infoye"
  console.log("\n[6A] Testing Typo Input -> 'Did you mean Infosys?'");
  const typoTurn = await runCentralAgent({
    message: "infoye",
    conversationId: testConvId,
  });
  assert(typoTurn.reply.includes("Did you mean") && typoTurn.reply.includes("Infosys"), `Agent replied with typo suggestion: "${typoTurn.reply}"`);
  assert(typoTurn.companyData?.company_flow === "COMPANY_CONFIRMATION", `company_flow set to COMPANY_CONFIRMATION`);
  assert(typoTurn.companyData?.typo_suggestion?.name === "Infosys", `typo_suggestion name is Infosys`);

  // 6B. Click "Yes, Infosys" confirmation
  console.log("\n[6B] Testing Click 'Yes, Infosys'");
  const confirmTurn = await runCentralAgent({
    message: "Yes, Infosys",
    conversationId: testConvId,
    companySelectionAction: { type: "confirm" },
  });
  assert(confirmTurn.reply.includes("Corporate Intelligence"), `Agent returned company intelligence report`);
  assert(confirmTurn.reply.includes("What is your monthly take-home salary?"), `Agent immediately asked next eligibility question`);
  assert(confirmTurn.companyData?.company_name?.toLowerCase().includes("infosys"), `companyData has selected company_name`);

  // Verify state preserved
  const savedSession = await getEligibilityState(testConvId);
  assert(Boolean(savedSession?.applicant?.companyName?.toLowerCase().includes("infosys")), `Saved applicant has canonical companyName: ${savedSession?.applicant?.companyName}`);
  assert(savedSession?.expectedField === "monthlyIncome", `Next expected field is monthlyIncome: ${savedSession?.expectedField}`);

  // 6C. Test Multiple Matches with Disambiguation: "Tata"
  console.log("\n[6C] Testing Multiple Matches: 'Tata'");
  const testConvId2 = "test_flow_tata_" + Date.now();
  const tataTurn = await runCentralAgent({
    message: "I work at Tata",
    conversationId: testConvId2,
  });
  assert(tataTurn.companyData?.company_flow === "COMPANY_SELECTION", `company_flow set to COMPANY_SELECTION for Tata`);
  assert(tataTurn.companyData?.candidates?.length > 1, `Candidates list has multiple items: ${tataTurn.companyData?.candidates?.length}`);
  assert(tataTurn.companyData?.candidates?.[0]?.id !== undefined, `Candidate has actual ID: ${tataTurn.companyData?.candidates?.[0]?.id}`);

  // 6D. Click specific company candidate from disambiguation
  console.log("\n[6D] Testing Click Specific Candidate from Disambiguation");
  const selectedCandidate = tataTurn.companyData?.candidates?.[0];
  const selectTurn = await runCentralAgent({
    message: selectedCandidate.name,
    conversationId: testConvId2,
    companySelectionAction: {
      type: "select",
      companyId: String(selectedCandidate.id),
      companyName: selectedCandidate.name,
    },
  });
  assert(selectTurn.reply.includes("Corporate Intelligence"), `Agent returned company intelligence report for selected candidate`);
  assert(selectTurn.reply.includes("What is your monthly take-home salary?"), `Agent asked next eligibility question without restarting`);

  // 6E. Test Click "No, enter again" / Retry
  console.log("\n[6E] Testing Click 'No, enter again'");
  const testConvId3 = "test_flow_retry_" + Date.now();
  await runCentralAgent({
    message: "infosis",
    conversationId: testConvId3,
  });
  const retryTurn = await runCentralAgent({
    message: "No, enter again",
    conversationId: testConvId3,
    companySelectionAction: { type: "retry" },
  });
  assert(retryTurn.reply.includes("Please enter your employer's exact company name"), `Agent cleanly prompted to re-enter company name`);

  // 6F. Next user message continues eligibility and does NOT re-ask for company
  console.log("\n[6F] Testing Next User Message ('75000') Continues Eligibility Flow");
  const salaryTurn = await runCentralAgent({
    message: "75000",
    conversationId: testConvId,
  });
  assert(!salaryTurn.reply.toLowerCase().includes("which company") && !salaryTurn.reply.toLowerCase().includes("employer"), `Agent did NOT re-ask for company name: "${salaryTurn.reply}"`);
  assert(salaryTurn.reply.toLowerCase().includes("loan") || salaryTurn.reply.toLowerCase().includes("borrow"), `Agent asked next missing eligibility parameter (loan amount): "${salaryTurn.reply}"`);

  const stateAfterSalary = await getEligibilityState(testConvId);
  assert(stateAfterSalary?.applicant?.monthlyIncome === 75000, `State has monthlyIncome=75000`);
  assert(Boolean(stateAfterSalary?.applicant?.companyName?.toLowerCase().includes("infosys")), `State preserved companyName: ${stateAfterSalary?.applicant?.companyName}`);

  // 6G. Testing State Persistence Requirements (selectedCompanyId, selectedCompanyName, selectedCompany, companyCandidate)
  console.log("\n[6G] Testing Full Company State Persistence Schema");
  assert(Boolean(savedSession?.selectedCompanyId), `Root selectedCompanyId persisted: ${savedSession?.selectedCompanyId}`);
  assert(Boolean(savedSession?.selectedCompanyName), `Root selectedCompanyName persisted: ${savedSession?.selectedCompanyName}`);
  assert(Boolean(savedSession?.selectedCompany), `Root selectedCompany persisted: ${savedSession?.selectedCompany}`);
  assert(Boolean(savedSession?.companyCandidate), `Root companyCandidate persisted`);
  assert(savedSession?.companyFlow?.stage === "ELIGIBILITY_INPUT", `companyFlow stage is ELIGIBILITY_INPUT: ${savedSession?.companyFlow?.stage}`);
  assert(Boolean(savedSession?.companyFlow?.selectedCompanyId), `companyFlow.selectedCompanyId persisted`);
  assert(Boolean(savedSession?.companyFlow?.selectedCompanyName), `companyFlow.selectedCompanyName persisted`);

  // 6H. Dynamic Missing Parameter: When salary is already known, ask next parameter (not hardcoded salary)
  console.log("\n[6H] Testing Dynamic Next Missing Parameter when Salary is Already Known");
  const testConvId4 = "test_flow_known_salary_" + Date.now();
  // Pre-seed state with known salary
  await saveEligibilityState(testConvId4, {
    applicant: {
      loanType: "Personal Loan",
      monthlyIncome: 95000,
    },
    expectedField: "companyName",
    missingFields: ["companyName", "loanAmount", "tenureMonths", "cibil", "age", "existingEmi"],
    in_eligibility_flow: true,
    updatedAt: Date.now(),
  });

  // User selects company
  const companyWithSalaryTurn = await runCentralAgent({
    message: "Infosys Limited",
    conversationId: testConvId4,
    companySelectionAction: {
      type: "select",
      companyId: "infosys_id",
      companyName: "Infosys Limited",
    },
  });

  assert(companyWithSalaryTurn.reply.includes("Corporate Intelligence"), `Response contains Corporate Intelligence`);
  assert(companyWithSalaryTurn.reply.includes("Now let's continue with your eligibility assessment."), `Response contains transition sentence`);
  // Must NOT ask for salary because salary is 95000!
  assert(!companyWithSalaryTurn.reply.toLowerCase().includes("monthly take-home salary"), `Did NOT ask for salary when salary was already known!`);
  assert(companyWithSalaryTurn.reply.toLowerCase().includes("borrow") || companyWithSalaryTurn.reply.toLowerCase().includes("how much"), `Dynamically asked loan amount instead: "${companyWithSalaryTurn.reply}"`);

  // 6I. Regression check: "I want a loan" -> "Infosys Pvt Ltd"
  console.log("\n[6I] Testing 'I want a loan' -> 'Infosys Pvt Ltd' flow");
  const testConvId5 = "test_loan_intent_" + Date.now();
  const intentTurn = await runCentralAgent({
    message: "I want a loan",
    conversationId: testConvId5,
  });
  assert(intentTurn.reply.toLowerCase().includes("company") || intentTurn.reply.toLowerCase().includes("employer"), `Starts by asking for company: "${intentTurn.reply}"`);

  const compPvtTurn = await runCentralAgent({
    message: "Infosys Pvt Ltd",
    conversationId: testConvId5,
  });
  assert(Boolean(compPvtTurn.companyData), `Found company data for 'Infosys Pvt Ltd'`);

  console.log("\n=================================================");
  console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================\n");

  await pool.end();
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
