import { resolvePolicyTarget, resolveDbPolicy } from "../lib/policyRag";
import pool from "../lib/db";

async function runResolverTests() {
  console.log("================================================================================");
  console.log("CANONICAL POLICY TARGET RESOLVER VERIFICATION SUITE");
  console.log("================================================================================\n");

  const testCases = [
    {
      id: 1,
      query: "Axis Finance",
      expectedBank: "Axis Finance",
      expectedBankId: 15,
      expectedBankCode: "AFL",
      expectedPolicyFileId: 2,
      expectedFileName: "Axis_Finance_Master_Policy.txt",
    },
    {
      id: 2,
      query: "Axis Bank",
      expectedBank: "Axis Bank",
      expectedBankId: 14,
      expectedBankCode: "AXIS",
      expectedPolicyFileId: 3,
      expectedFileName: "AXIS_Master_Policy.txt",
    },
    {
      id: 3,
      query: "HDFC Bank",
      expectedBank: "HDFC Bank",
      expectedBankId: 5,
      expectedBankCode: "HDFC",
      expectedPolicyFileId: 16,
      expectedFileName: "HDFC_Bank_Master_Policy.txt",
    },
    {
      id: 4,
      query: "ICICI Bank",
      expectedBank: "ICICI Bank",
      expectedBankId: 6,
      expectedBankCode: "ICICI",
      expectedPolicyFileId: 17,
      expectedFileName: "ICICI_Bank_Master_Policy.txt",
    },
    {
      id: 5,
      query: "Bajaj Finserv",
      expectedBank: "Bajaj Finserv",
      expectedBankId: 16,
      expectedBankCode: "BAJAJ_FINSERV",
      expectedPolicyFileId: 4,
      expectedFileName: "Bajaj_Finserv_Master_Policy.txt",
    },
    {
      id: 6,
      query: "Bajaj Markets",
      expectedBank: "Bajaj Markets",
      expectedBankId: 17,
      expectedBankCode: "BAJAJ_MARKETS",
      expectedPolicyFileId: 5,
      expectedFileName: "Bajaj_Markets_Master_Policy.txt",
    },
    {
      id: 7,
      query: "L&T Finance",
      expectedBank: "L&T Finance",
      expectedBankId: 20,
      expectedBankCode: "LTF",
      expectedPolicyFileId: 8,
      expectedFileName: "LT_Finance_Master_Policy.txt",
    },
    {
      id: 8,
      query: "What is the eligibility criteria of XYZ Unknown Bank?",
      expectedBank: null,
      expectedBankId: null,
      expectedBankCode: null,
      expectedPolicyFileId: null,
      expectedFileName: null,
      isNegative: true,
    },
    {
      id: 9,
      query: "Citibank",
      expectedBank: null,
      expectedBankId: null,
      expectedBankCode: null,
      expectedPolicyFileId: null,
      expectedFileName: null,
      isNegative: true,
    },
  ];

  let allPassed = true;

  for (const tc of testCases) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`TEST #${tc.id}: "${tc.query}"`);
    console.log(`--------------------------------------------------------------------------------`);

    const result = await resolvePolicyTarget(tc.query);

    if (tc.isNegative) {
      const passed = result === null;
      console.log(`QUERY:           ${tc.query}`);
      console.log(`EXPECTED:        UNRESOLVED (null)`);
      console.log(`ACTUAL:          ${result ? `${result.bankName} (ID: ${result.bankId})` : "UNRESOLVED (null)"}`);
      console.log(`STATUS:          ${passed ? "PASS (Cleanly rejected unknown bank)" : "FAIL (Unexpected resolution)"}`);
      if (!passed) allPassed = false;
    } else {
      const matchBank = result?.bankName === tc.expectedBank;
      const matchBankId = result?.bankId === tc.expectedBankId;
      const matchBankCode = result?.bankCode === tc.expectedBankCode;
      const matchFileId = result?.policyFileId === tc.expectedPolicyFileId;
      const matchFileName = result?.fileName === tc.expectedFileName;

      const passed = matchBank && matchBankId && matchBankCode && matchFileId && matchFileName;
      if (!passed) allPassed = false;

      console.log(`QUERY:           ${tc.query}`);
      console.log(`BANK:            ${result?.bankName} (Expected: ${tc.expectedBank})`);
      console.log(`BANK ID:         ${result?.bankId} (Expected: ${tc.expectedBankId})`);
      console.log(`BANK CODE:       ${result?.bankCode} (Expected: ${tc.expectedBankCode})`);
      console.log(`POLICY FILE ID:  ${result?.policyFileId} (Expected: ${tc.expectedPolicyFileId})`);
      console.log(`FILE NAME:       ${result?.fileName} (Expected: ${tc.expectedFileName})`);
      console.log(`STATUS:          ${passed ? "PASS" : "FAIL"}`);
    }
  }

  // Also verify that resolveDbPolicy() is a thin wrapper returning the exact same result
  console.log("\n--------------------------------------------------------------------------------");
  console.log("BACKWARD COMPATIBILITY TEST (resolveDbPolicy wrapper)");
  console.log("--------------------------------------------------------------------------------");
  const direct = await resolvePolicyTarget("Axis Finance");
  const wrapper = await resolveDbPolicy("Axis Finance");
  const wrapperMatch = JSON.stringify(direct) === JSON.stringify(wrapper);
  console.log(`resolveDbPolicy("Axis Finance") matches resolvePolicyTarget("Axis Finance"): ${wrapperMatch ? "PASS" : "FAIL"}`);

  console.log("\n================================================================================");
  console.log(`OVERALL RESOLVER STATUS: ${allPassed && wrapperMatch ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);
  console.log("================================================================================\n");

  await pool.end();
}

runResolverTests().catch(console.error);
