import "dotenv/config";
import * as assert from "assert";
import { runCentralAgent } from "../lib/ai/agent";
import {
  detectLoanIntent,
  evaluateApplicantAgainstAllBanks,
  formatDynamicEligibilityReport,
  clearEligibilityState,
  getEligibilityState,
  ApplicantProfile,
} from "../lib/dynamicEligibilityEngine";
import { classifyIntentWithLLM } from "../lib/ai/intentClassifier";

async function testAll() {
  console.log("=== 1. Testing Natural Loan Intent Detection on Phrases ===");

  const phrases = [
    { text: "I need a loan", expectAmount: undefined },
    { text: "I want a personal loan", expectAmount: undefined },
    { text: "I want to apply for a loan", expectAmount: undefined },
    { text: "Can I get a loan?", expectAmount: undefined },
    { text: "I need ₹5 lakh loan", expectAmount: 500000 },
  ];

  for (const p of phrases) {
    const detected = detectLoanIntent(p.text);
    console.log(`Checking detectLoanIntent("${p.text}") -> isLoanIntent: ${detected.isLoanIntent}, loanType: ${detected.loanType}`);
    assert.strictEqual(detected.isLoanIntent, true, `Phrase "${p.text}" must be recognized as loan intent`);

    const convId = `test-phrase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const res = await runCentralAgent({
      message: p.text,
      conversationId: convId,
    });

    console.log(`Central Agent reply for "${p.text}":\n${res.reply.slice(0, 180)}...\n`);
    // It should initiate eligibility flow and prompt for company/employer name or next missing field
    assert.ok(
      res.reply.toLowerCase().includes("company") ||
      res.reply.toLowerCase().includes("employer") ||
      res.reply.toLowerCase().includes("eligibility") ||
      res.reply.toLowerCase().includes("salary"),
      `Response for "${p.text}" must start eligibility flow and ask for details`
    );

    const session = await getEligibilityState(convId);
    assert.ok(session, `Session state must be created for conversation ${convId}`);
    if (p.expectAmount) {
      console.log(`Extracted loanAmount: ${session?.applicant?.loanAmount}`);
      assert.strictEqual(session?.applicant?.loanAmount, p.expectAmount, `Must extract loan amount ${p.expectAmount}`);
    }
  }

  console.log("\n=== 2. Testing Eligibility Results Table Format ===");
  const applicant: ApplicantProfile = {
    companyName: "Tata Consultancy Services",
    monthlyIncome: 85000,
    loanAmount: 500000,
    tenureMonths: 36,
    cibil: 780,
    existingEmi: 0,
    age: 28,
    employmentType: "Salaried",
    loanType: "Personal Loan",
  };

  const evalResult = await evaluateApplicantAgainstAllBanks(applicant, "Personal Loan");
  const report = formatDynamicEligibilityReport(applicant, evalResult);

  console.log("Eligibility Report Preview:\n", report.slice(0, 800), "\n...");

  // Verify exact table header
  assert.ok(
    report.includes("| Bank | Status | CIBIL | Tenure | Est. EMI |"),
    "FAIL: Eligible banks table must have exactly: | Bank | Status | CIBIL | Tenure | Est. EMI |"
  );
  assert.ok(
    report.includes("| :--- | :--- | :--- | :--- | :--- |"),
    "FAIL: Table divider line must match 5 columns"
  );

  // Verify rows contain status and stored values
  assert.ok(
    report.includes("✅ Eligible"),
    "FAIL: Eligible rows must show status '✅ Eligible'"
  );

  console.log("\n=== 3. Testing Bank Policy Simple Summary Table UI ===");
  const hdfcPolicyRes = await runCentralAgent({
    message: "What is HDFC bank policy?",
    conversationId: `test-policy-${Date.now()}`,
  });
  console.log("HDFC Policy Response Preview:\n", hdfcPolicyRes.reply.slice(0, 600), "\n...");

  assert.ok(
    hdfcPolicyRes.reply.includes("1. Loan Products Offered") || hdfcPolicyRes.reply.includes("Loan Products Offered"),
    "Must include Section 1: Loan Products Offered"
  );
  assert.ok(
    hdfcPolicyRes.reply.includes("2. Eligibility Criteria") || hdfcPolicyRes.reply.includes("Eligibility Criteria"),
    "Must include Section 2: Eligibility Criteria"
  );
  assert.ok(
    hdfcPolicyRes.reply.includes("3. Important Conditions") || hdfcPolicyRes.reply.includes("Important Conditions"),
    "Must include Section 3: Important Conditions"
  );
  assert.ok(
    hdfcPolicyRes.reply.includes("| Criteria | Details |"),
    "Must use 2-column tables: | Criteria | Details |"
  );

  console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY!");
}

testAll().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
