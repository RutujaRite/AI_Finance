import { answerPolicyWithRag, resolvePolicyTarget, __llmCallCounterForTest, __resetLlmCallCounterForTest } from "../lib/policyRag";
import pool from "../lib/db";

interface TestCase {
  id: number;
  name: string;
  query: string;
  expectedBank: string;
  expectedPolicyFileId: number;
  validate: (answer: string, sources: any[]) => { passed: boolean; reason: string };
}

async function runGenerationTests() {
  console.log("================================================================================");
  console.log("PHASE 6B — CANONICAL POLICY RAG GENERATION TEST SUITE");
  console.log("================================================================================\n");

  const testCases: TestCase[] = [
    {
      id: 1,
      name: "Focused CIBIL",
      query: "What is the minimum CIBIL for Axis Finance?",
      expectedBank: "Axis Finance",
      expectedPolicyFileId: 2,
      validate: (ans, sources) => {
        const has720 = ans.includes("720");
        const hasNoAxisBank = !ans.toLowerCase().includes("axis_master") && !sources.some((s) => s.bankId === 14);
        const noInternalMeta = !ans.includes("policy_embeddings") && !ans.includes("policy_file_id");
        const passed = has720 && hasNoAxisBank && noInternalMeta;
        return {
          passed,
          reason: `has 720: ${has720}, no Axis Bank: ${hasNoAxisBank}, no internal meta: ${noInternalMeta}`,
        };
      },
    },
    {
      id: 2,
      name: "Minimum Age",
      query: "What is the minimum age for Axis Finance?",
      expectedBank: "Axis Finance",
      expectedPolicyFileId: 2,
      validate: (ans) => {
        const has21 = ans.includes("21");
        const hasReview = ans.includes("[REVIEW]");
        const passed = has21;
        return {
          passed,
          reason: `has 21: ${has21}, [REVIEW] preserved: ${hasReview}`,
        };
      },
    },
    {
      id: 3,
      name: "Maximum Loan",
      query: "What is the maximum loan amount for Axis Finance?",
      expectedBank: "Axis Finance",
      expectedPolicyFileId: 2,
      validate: (ans) => {
        const mentions50LOrMulti =
          ans.includes("50") || ans.includes("30") || ans.includes("96") || ans.toLowerCase().includes("program");
        const doesNotSayOnly40L = !ans.includes("40 lacs for Category 0");
        const passed = mentions50LOrMulti && doesNotSayOnly40L;
        return {
          passed,
          reason: `mentions program caps: ${mentions50LOrMulti}, not only 40L: ${doesNotSayOnly40L}`,
        };
      },
    },
    {
      id: 4,
      name: "Documents",
      query: "What documents are required for Axis Finance?",
      expectedBank: "Axis Finance",
      expectedPolicyFileId: 2,
      validate: (ans, sources) => {
        const hasBankStatement = /bank statement/i.test(ans);
        const hasPayslipOrEpfo = /payslip|epfo/i.test(ans);
        const allSourcesAfl = sources.every((s) => s.policyFileId === 2);
        const passed = hasBankStatement && hasPayslipOrEpfo && allSourcesAfl;
        return {
          passed,
          reason: `bank statement: ${hasBankStatement}, payslip/epfo: ${hasPayslipOrEpfo}, all AFL sources: ${allSourcesAfl}`,
        };
      },
    },
    {
      id: 5,
      name: "Broad Eligibility",
      query: "What are the eligibility criteria for Axis Finance?",
      expectedBank: "Axis Finance",
      expectedPolicyFileId: 2,
      validate: (ans) => {
        const hasSections = /###|\*\*|1\.|2\./.test(ans);
        const hasReview = ans.includes("[REVIEW]");
        const passed = hasSections && ans.length > 300;
        return {
          passed,
          reason: `structured sections: ${hasSections}, length: ${ans.length}, review preserved: ${hasReview}`,
        };
      },
    },
    {
      id: 6,
      name: "Contractual Employee",
      query: "Can a contractual employee apply to Axis Finance?",
      expectedBank: "Axis Finance",
      expectedPolicyFileId: 2,
      validate: (ans) => {
        const mentionsContractualOrSalaried =
          /contractual|salaried|not allowed|epfo/i.test(ans);
        const passed = mentionsContractualOrSalaried;
        return {
          passed,
          reason: `contractual/salaried/epfo mentioned: ${mentionsContractualOrSalaried}`,
        };
      },
    },
    {
      id: 7,
      name: "Axis Bank Isolation",
      query: "What is the eligibility criteria of Axis Bank?",
      expectedBank: "Axis Bank",
      expectedPolicyFileId: 3,
      validate: (ans, sources) => {
        const allSourcesAxisBank = sources.every((s) => s.policyFileId === 3);
        const hasNoAfl = !sources.some((s) => s.bankId === 15);
        const passed = allSourcesAxisBank && hasNoAfl && ans.length > 200;
        return {
          passed,
          reason: `all sources Axis Bank (file 3): ${allSourcesAxisBank}, no AFL sources: ${hasNoAfl}`,
        };
      },
    },
  ];

  let allPassed = true;

  for (const tc of testCases) {
    console.log("--------------------------------------------------------------------------------");
    console.log(`TEST #${tc.id}: ${tc.name}`);
    console.log(`Query: "${tc.query}"`);
    console.log("--------------------------------------------------------------------------------");

    // 1. Resolve Target
    const target = await resolvePolicyTarget(tc.expectedBank);
    if (!target) {
      console.error(`FAIL: Could not resolve target for ${tc.expectedBank}`);
      allPassed = false;
      continue;
    }

    // 2. Instrument LLM call counter: verify EXACTLY ONE LLM call
    __resetLlmCallCounterForTest();

    const result = await answerPolicyWithRag({
      query: tc.query,
      policyFileId: target.policyFileId,
      bankId: target.bankId,
      bankName: target.bankName,
      bankCode: target.bankCode,
      fileName: target.fileName,
      topK: 5,
    });

    const llmCalls = __llmCallCounterForTest;
    const singleCallPass = llmCalls === 1;

    // 3. Validate response content
    const val = tc.validate(result.answer, result.sources);

    const testPassed = singleCallPass && val.passed;
    if (!testPassed) allPassed = false;

    console.log(`- Resolved Bank:       ${target.bankName} (ID: ${target.bankId})`);
    console.log(`- Resolved PolicyFile: ${target.fileName} (ID: ${target.policyFileId})`);
    console.log(`- Retrieved Chunks:    ${result.retrievedChunks}`);
    console.log(`- Exact 1 LLM Call:    ${singleCallPass ? "PASS (1 call)" : `FAIL (${llmCalls} calls)`}`);
    console.log(`- Content Validation:  ${val.passed ? "PASS" : "FAIL"} (${val.reason})`);
    console.log(`- Answer Preview:      ${result.answer.slice(0, 140).replace(/\n/g, " ")}...`);
    console.log(`STATUS: ${testPassed ? "PASS ✅" : "FAIL ❌"}\n`);
  }

  console.log("================================================================================");
  console.log(`OVERALL GENERATION TEST STATUS: ${allPassed ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);
  console.log("================================================================================\n");

  await pool.end();

  if (!allPassed) {
    process.exit(1);
  }
}

runGenerationTests().catch(console.error);
