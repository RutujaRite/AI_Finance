import { Document } from "@langchain/core/documents";
import { buildPolicyContext } from "../lib/policyRag";

function runTests() {
  console.log("================================================================================");
  console.log("CANONICAL POLICY CONTEXT BUILDER UNIT TESTS");
  console.log("================================================================================\n");

  let allPassed = true;

  // ---------------------------------------------------------------------------
  // TEST 1: Ordering
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST #1: Deterministic Chunk Ordering (chunkIndex: 4, 1, 3, 0 -> 0, 1, 3, 4)");
  console.log("--------------------------------------------------------------------------------");
  const unorderedDocs: Document[] = [
    new Document({
      pageContent: "Section 4 Content: Disbursal checklist details.",
      metadata: { policyFileId: 2, bankId: 15, bankName: "Axis Finance", fileName: "Axis_Finance_Master_Policy.txt", chunkIndex: 4 },
    }),
    new Document({
      pageContent: "Section 1 Content: Basic borrower eligibility requirements.",
      metadata: { policyFileId: 2, bankId: 15, bankName: "Axis Finance", fileName: "Axis_Finance_Master_Policy.txt", chunkIndex: 1 },
    }),
    new Document({
      pageContent: "Section 3 Content: Loan tenure and interest rates.",
      metadata: { policyFileId: 2, bankId: 15, bankName: "Axis Finance", fileName: "Axis_Finance_Master_Policy.txt", chunkIndex: 3 },
    }),
    new Document({
      pageContent: "Section 0 Content: Master policy header and overview.",
      metadata: { policyFileId: 2, bankId: 15, bankName: "Axis Finance", fileName: "Axis_Finance_Master_Policy.txt", chunkIndex: 0 },
    }),
  ];

  const res1 = buildPolicyContext(unorderedDocs, { policyFileId: 2, bankName: "Axis Finance" });
  const orderedIndexes = res1.sources.map((s) => s.chunkIndex);
  const test1Passed =
    orderedIndexes.length === 4 &&
    orderedIndexes[0] === 0 &&
    orderedIndexes[1] === 1 &&
    orderedIndexes[2] === 3 &&
    orderedIndexes[3] === 4;

  console.log(`- Resulting chunk order: [${orderedIndexes.join(", ")}]`);
  console.log(`STATUS: ${test1Passed ? "PASS ✅" : "FAIL ❌"}`);
  if (!test1Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 2: Deduplication
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST #2: Chunk Deduplication (duplicate chunkIndex & content)");
  console.log("--------------------------------------------------------------------------------");
  const duplicateDocs: Document[] = [
    new Document({
      pageContent: "CIBIL score cutoff: 720 minimum.",
      metadata: { policyFileId: 2, bankId: 15, bankName: "Axis Finance", fileName: "Axis_Finance_Master_Policy.txt", chunkIndex: 2 },
    }),
    new Document({
      pageContent: "CIBIL score cutoff: 720 minimum.",
      metadata: { policyFileId: 2, bankId: 15, bankName: "Axis Finance", fileName: "Axis_Finance_Master_Policy.txt", chunkIndex: 2 },
    }),
    new Document({
      pageContent: "FOIR ceiling: 70% standard.",
      metadata: { policyFileId: 2, bankId: 15, bankName: "Axis Finance", fileName: "Axis_Finance_Master_Policy.txt", chunkIndex: 5 },
    }),
  ];

  const res2 = buildPolicyContext(duplicateDocs, { policyFileId: 2, bankName: "Axis Finance" });
  const test2Passed = res2.sources.length === 2 && res2.sources.map((s) => s.chunkIndex).join(",") === "2,5";

  console.log(`- Original chunk count: ${duplicateDocs.length}`);
  console.log(`- Deduplicated chunk count: ${res2.sources.length} (indexes: [${res2.sources.map((s) => s.chunkIndex).join(", ")}])`);
  console.log(`STATUS: ${test2Passed ? "PASS ✅" : "FAIL ❌"}`);
  if (!test2Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 3: Policy Isolation
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST #3: Policy Isolation (Reject Alien policyFileId)");
  console.log("--------------------------------------------------------------------------------");
  const mixedDocs: Document[] = [
    new Document({
      pageContent: "Axis Finance valid chunk.",
      metadata: { policyFileId: 2, bankId: 15, bankName: "Axis Finance", fileName: "Axis_Finance_Master_Policy.txt", chunkIndex: 0 },
    }),
    new Document({
      pageContent: "Axis Bank alien chunk that must NOT contaminate Axis Finance!",
      metadata: { policyFileId: 3, bankId: 14, bankName: "Axis Bank", fileName: "AXIS_Master_Policy.txt", chunkIndex: 0 },
    }),
  ];

  const res3 = buildPolicyContext(mixedDocs, { policyFileId: 2, bankName: "Axis Finance" });
  const test3Passed =
    res3.sources.length === 1 &&
    res3.sources[0].policyFileId === 2 &&
    !res3.context.includes("Axis Bank alien chunk");

  console.log(`- Expected policyFileId: 2`);
  console.log(`- Filtered sources count: ${res3.sources.length}`);
  console.log(`- Contains alien policy text in context: ${res3.context.includes("Axis Bank alien chunk") ? "YES (FAIL)" : "NO (PASS)"}`);
  console.log(`STATUS: ${test3Passed ? "PASS ✅" : "FAIL ❌"}`);
  if (!test3Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 4: Metadata Preservation
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST #4: Complete Source Metadata Preservation");
  console.log("--------------------------------------------------------------------------------");
  const metadataDoc = new Document({
    pageContent: "Full metadata test content.",
    metadata: {
      policyFileId: 2,
      bankId: 15,
      bankName: "Axis Finance",
      bankCode: "AFL",
      fileName: "Axis_Finance_Master_Policy.txt",
      chunkIndex: 8,
      similarity: 0.9123,
      distance: 0.0877,
    },
  });

  const res4 = buildPolicyContext([metadataDoc], { policyFileId: 2, bankName: "Axis Finance" });
  const src = res4.sources[0];
  const test4Passed =
    src &&
    src.policyFileId === 2 &&
    src.bankId === 15 &&
    src.bankName === "Axis Finance" &&
    src.bankCode === "AFL" &&
    src.fileName === "Axis_Finance_Master_Policy.txt" &&
    src.chunkIndex === 8 &&
    src.similarity === 0.9123 &&
    src.distance === 0.0877;

  console.log("- Preserved source fields:");
  console.log(`  policyFileId: ${src?.policyFileId}`);
  console.log(`  bankId:       ${src?.bankId}`);
  console.log(`  bankName:     ${src?.bankName}`);
  console.log(`  bankCode:     ${src?.bankCode}`);
  console.log(`  fileName:     ${src?.fileName}`);
  console.log(`  chunkIndex:   ${src?.chunkIndex}`);
  console.log(`  similarity:   ${src?.similarity}`);
  console.log(`  distance:     ${src?.distance}`);
  console.log(`STATUS: ${test4Passed ? "PASS ✅" : "FAIL ❌"}`);
  if (!test4Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 5: [REVIEW] Preservation
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST #5: [REVIEW] Marker Preservation");
  console.log("--------------------------------------------------------------------------------");
  const reviewDoc = new Document({
    pageContent: "1. NMI THRESHOLDS: Multiple thresholds found. [REVIEW]\n2. CIBIL: 720-750 [REVIEW]",
    metadata: { policyFileId: 2, bankId: 15, chunkIndex: 11 },
  });

  const res5 = buildPolicyContext([reviewDoc], { policyFileId: 2 });
  const reviewCount = (res5.context.match(/\[REVIEW\]/g) || []).length;
  const test5Passed = reviewCount === 2;

  console.log(`- [REVIEW] tags preserved in context: ${reviewCount} (expected 2)`);
  console.log(`STATUS: ${test5Passed ? "PASS ✅" : "FAIL ❌"}`);
  if (!test5Passed) allPassed = false;

  // ---------------------------------------------------------------------------
  // TEST 6: Empty Retrieval Handling
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST #6: Empty Retrieval Safe Handling");
  console.log("--------------------------------------------------------------------------------");
  const res6 = buildPolicyContext([], { policyFileId: 2, bankName: "Axis Finance" });
  const test6Passed = res6.context === "" && Array.isArray(res6.sources) && res6.sources.length === 0;

  console.log(`- Context is empty string: ${res6.context === "" ? "YES (PASS)" : "NO (FAIL)"}`);
  console.log(`- Sources is empty array:  ${res6.sources.length === 0 ? "YES (PASS)" : "NO (FAIL)"}`);
  console.log(`STATUS: ${test6Passed ? "PASS ✅" : "FAIL ❌"}`);
  if (!test6Passed) allPassed = false;

  console.log("\n================================================================================");
  console.log(`OVERALL CONTEXT BUILDER STATUS: ${allPassed ? "ALL TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);
  console.log("================================================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

runTests();
