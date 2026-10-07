import { resolvePolicyTarget } from "../lib/policyRag";
import { PolicyPgVectorRetriever } from "../lib/policyRetrieval";
import pool from "../lib/db";

interface TestCase {
  id: number;
  input: string;
  expectedBank: string | null;
  expectedBankId: number | null;
  expectedPolicyFileId: number | null;
  expectedFileName: string | null;
  isNegative?: boolean;
}

async function runCanonicalRetrieverTests() {
  console.log("================================================================================");
  console.log("CANONICAL LANGCHAIN POLICY RETRIEVER TEST SUITE");
  console.log("================================================================================\n");

  const testCases: TestCase[] = [
    {
      id: 1,
      input: "Axis Finance",
      expectedBank: "Axis Finance",
      expectedBankId: 15,
      expectedPolicyFileId: 2,
      expectedFileName: "Axis_Finance_Master_Policy.txt",
    },
    {
      id: 2,
      input: "Axis Bank",
      expectedBank: "Axis Bank",
      expectedBankId: 14,
      expectedPolicyFileId: 3,
      expectedFileName: "AXIS_Master_Policy.txt",
    },
    {
      id: 3,
      input: "HDFC Bank",
      expectedBank: "HDFC Bank",
      expectedBankId: 5,
      expectedPolicyFileId: 16,
      expectedFileName: "HDFC_Bank_Master_Policy.txt",
    },
    {
      id: 4,
      input: "ICICI Bank",
      expectedBank: "ICICI Bank",
      expectedBankId: 6,
      expectedPolicyFileId: 17,
      expectedFileName: "ICICI_Bank_Master_Policy.txt",
    },
    {
      id: 5,
      input: "XYZ Unknown Bank",
      expectedBank: null,
      expectedBankId: null,
      expectedPolicyFileId: null,
      expectedFileName: null,
      isNegative: true,
    },
  ];

  let allPassed = true;

  for (const tc of testCases) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`TEST #${tc.id}: "${tc.input}"`);
    console.log(`--------------------------------------------------------------------------------`);

    // 1. Resolve policy target via canonical resolvePolicyTarget
    const target = await resolvePolicyTarget(tc.input);

    if (tc.isNegative) {
      const passResolveNull = target === null;
      console.log(`- Policy Target Resolution: ${target ? `UNEXPECTED (${target.bankName})` : "null (PASS)"}`);

      // Verify that PolicyPgVectorRetriever refuses unconstrained execution
      const unconstrainedRetriever = new PolicyPgVectorRetriever({
        topK: 5,
      });
      const unconstrainedDocs = await unconstrainedRetriever.invoke("eligibility criteria");
      const passRefusal = unconstrainedDocs.length === 0;
      console.log(`- Unconstrained Retrieval Refusal: ${passRefusal ? "REFUSED (PASS - zero documents retrieved)" : "FAILED (leaked documents)"}`);

      const passed = passResolveNull && passRefusal;
      if (!passed) allPassed = false;
      console.log(`STATUS: ${passed ? "PASS ✅" : "FAIL ❌"}`);
      continue;
    }

    if (!target) {
      console.error(`FAIL: Failed to resolve policy target for "${tc.input}"`);
      allPassed = false;
      continue;
    }

    console.log(`- Resolved Bank:       ${target.bankName} (ID: ${target.bankId}, Code: ${target.bankCode})`);
    console.log(`- Resolved PolicyFile: ${target.fileName} (ID: ${target.policyFileId})`);

    // 2. Execute retrieval via canonical PolicyPgVectorRetriever
    const retriever = new PolicyPgVectorRetriever({
      policyFileId: target.policyFileId,
      bankId: target.bankId,
      bankName: target.bankName,
      bankCode: target.bankCode,
      fileName: target.fileName,
      topK: 5,
    });

    const docs = await retriever.invoke(`eligibility criteria for ${tc.input}`);
    console.log(`- Retrieved Chunks:    ${docs.length}`);

    // 3. Verify all returned documents strictly belong to this policyFileId and bankId
    const wrongFileDocs = docs.filter((d) => d.metadata.policyFileId !== tc.expectedPolicyFileId);
    const wrongBankDocs = docs.filter((d) => d.metadata.bankId !== tc.expectedBankId);

    const allDocsMatchPolicyFile = docs.length > 0 && docs.every((d) => d.metadata.policyFileId === tc.expectedPolicyFileId);
    console.log(`- Exact Policy File:   ${allDocsMatchPolicyFile ? `PASS (100% chunks match policyFileId === ${tc.expectedPolicyFileId})` : "FAILED (mismatch)"}`);
    if (!allDocsMatchPolicyFile) {
      console.log("  WRONG POLICY FILE CHUNKS:", wrongFileDocs.map((d) => d.metadata));
    }

    // Contamination check
    const hasCrossContam = wrongFileDocs.length > 0 || wrongBankDocs.length > 0;
    console.log(`- File Contamination:  ${wrongFileDocs.length === 0 ? "NONE (PASS)" : `FAILED (${wrongFileDocs.length} alien chunks)`}`);
    console.log(`- Bank Contamination:  ${wrongBankDocs.length === 0 ? "NONE (PASS)" : `FAILED (${wrongBankDocs.length} alien chunks)`}`);

    // Verify metadata completeness on every document
    const missingMetadata = docs.filter(
      (d) =>
        !d.metadata.policyFileId ||
        !d.metadata.bankId ||
        !d.metadata.bankName ||
        !d.metadata.bankCode ||
        !d.metadata.fileName ||
        d.metadata.chunkIndex === undefined
    );
    console.log(`- Metadata Integrity:  ${missingMetadata.length === 0 ? "FULL (PASS - all metadata fields present)" : `FAILED (${missingMetadata.length} docs missing fields)`}`);

    const passBank = target.bankId === tc.expectedBankId;
    const passFile = target.policyFileId === tc.expectedPolicyFileId && allDocsMatchPolicyFile;
    const passDocs = docs.length > 0;
    const passNoContam = !hasCrossContam;
    const passMeta = missingMetadata.length === 0;

    const testPassed = passBank && passFile && passDocs && passNoContam && passMeta;
    if (!testPassed) allPassed = false;
    console.log(`STATUS: ${testPassed ? "PASS ✅" : "FAIL ❌"}`);
  }

  // Test 6: Direct Contamination Assertion Check (Axis Finance vs Axis Bank)
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`TEST #6: DIRECT CROSS-CONTAMINATION RIGID ASSERTION (Axis Finance vs Axis Bank)`);
  console.log(`--------------------------------------------------------------------------------`);

  const aflTarget = await resolvePolicyTarget("Axis Finance");
  const axisTarget = await resolvePolicyTarget("Axis Bank");

  const aflRetriever = new PolicyPgVectorRetriever({
    policyFileId: aflTarget!.policyFileId,
    bankId: aflTarget!.bankId,
    topK: 10,
  });
  const axisRetriever = new PolicyPgVectorRetriever({
    policyFileId: axisTarget!.policyFileId,
    bankId: axisTarget!.bankId,
    topK: 10,
  });

  const aflDocs = await aflRetriever.invoke("What is the eligibility criteria?");
  const axisDocs = await axisRetriever.invoke("What is the eligibility criteria?");

  const aflHasAxisBank = aflDocs.some(
    (d) => d.metadata.policyFileId === 3 || d.metadata.bankId === 14 || d.metadata.fileName.toLowerCase().includes("axis_master")
  );
  const axisHasAfl = axisDocs.some(
    (d) => d.metadata.policyFileId === 2 || d.metadata.bankId === 15 || d.metadata.fileName.toLowerCase().includes("axis_finance")
  );

  const aflAllPolicy2 = aflDocs.every((d) => d.metadata.policyFileId === 2 && d.metadata.bankId === 15);
  const axisAllPolicy3 = axisDocs.every((d) => d.metadata.policyFileId === 3 && d.metadata.bankId === 14);

  console.log(`Assert all Axis Finance chunks have policyFileId === 2: ${aflAllPolicy2 ? "PASS (100% policy_file_id 2)" : "FAIL"}`);
  console.log(`Assert zero Axis Bank chunks in Axis Finance retrieval:  ${!aflHasAxisBank ? "PASS (0 Axis Bank chunks)" : "FAIL"}`);
  console.log(`Assert all Axis Bank chunks have policyFileId === 3:    ${axisAllPolicy3 ? "PASS (100% policy_file_id 3)" : "FAIL"}`);
  console.log(`Assert zero Axis Finance chunks in Axis Bank retrieval: ${!axisHasAfl ? "PASS (0 Axis Finance chunks)" : "FAIL"}`);

  const test6Passed = aflAllPolicy2 && !aflHasAxisBank && axisAllPolicy3 && !axisHasAfl;
  if (!test6Passed) allPassed = false;
  console.log(`STATUS: ${test6Passed ? "PASS ✅" : "FAIL ❌"}`);

  console.log("\n================================================================================");
  console.log(`OVERALL RETRIEVER TEST STATUS: ${allPassed ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);
  console.log("================================================================================\n");

  await pool.end();
}

runCanonicalRetrieverTests().catch(console.error);
