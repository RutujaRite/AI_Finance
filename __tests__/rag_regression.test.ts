// __tests__/rag_regression.test.ts
/**
 * Comprehensive Automated RAG Regression Test Suite
 * Covering Tests 1 through 12:
 * 1. Unsupported ranges (Failure A Guardrail)
 * 2. Follow-up constraints (Failure B Guardrail)
 * 3. Product isolation (Personal Loan vs Home Loan)
 * 4. Lender isolation (Failure D Guardrail)
 * 5. Missing evidence (Explicit EVIDENCE_NOT_FOUND)
 * 6. Exact citations provenance
 * 7. Demo document exclusion
 * 8. Attribute relevance & Axis Finance Section 7 verification
 * 9. Topic switch handling
 * 10. Source failure & resilient PostgreSQL fallback
 * 11. Conflicting sources resolution
 * 12. Streaming & grounded generation
 */

import pool from "@/lib/db";
import { searchPolicyEmbeddings, rewritePolicyQuery, PolicyPgVectorRetriever } from "@/lib/ai/policyRetrieval";
import {
  validateSalaryEvidence,
  validateChunkEvidence,
  executeGroundedRag,
  STRICT_MISSING_EVIDENCE_MESSAGE,
  AXIS_FINANCE_VERIFIED_SALARIES,
  selectRelevantDocuments,
} from "@/lib/ai/ragEngine";
import { isConstraintOnlyFollowUp, resolveConversationalContext } from "@/lib/ai/conversationIntelligence";
import { classifyRetrievalIntent, detectLoanCategory } from "@/lib/ai/intentRouting";
import { searchBankPolicyEmbeddings } from "@/lib/ai/dualSourceRag";
import { resolvePolicyTarget } from "@/lib/policyRag";
import * as fs from "fs";
import * as path from "path";

interface TestStats {
  total: number;
  passed: number;
  failed: number;
  errors: string[];
}

const stats: TestStats = { total: 0, passed: 0, failed: 0, errors: [] };

function runTest(name: string, fn: () => void | Promise<void>) {
  stats.total++;
  return Promise.resolve()
    .then(fn)
    .then(() => {
      stats.passed++;
      console.log(`  ✅ PASS: ${name}`);
    })
    .catch((err) => {
      stats.failed++;
      const msg = `  ❌ FAIL: ${name} -> ${err instanceof Error ? err.message : String(err)}`;
      stats.errors.push(msg);
      console.error(msg);
    });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log("================================================================================");
  console.log("CREDITWISE AI: MASTER SPECIFICATION RAG REGRESSION SUITE (TESTS 1 - 12)");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1: Unsupported Ranges (Failure A Guardrail)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Unsupported Salary Ranges & Strict Missing-Evidence Guardrail ---");
  await runTest("Test 1: Returns EVIDENCE_NOT_FOUND when chunks lack numerical salary figures", () => {
    const mockChunksWithoutNumbers = [
      { content: "The applicant must have stable employment and regular salary credits." },
      { content: "All salaried individuals working in standard companies can apply." },
    ];
    const validation = validateSalaryEvidence(mockChunksWithoutNumbers);
    assert(validation.status === "EVIDENCE_NOT_FOUND", "Expected status to be EVIDENCE_NOT_FOUND");
    assert(validation.hasSufficientEvidence === false, "Expected hasSufficientEvidence to be false");
    assert(
      validation.fallbackMessage === STRICT_MISSING_EVIDENCE_MESSAGE,
      "Expected fallback message to match STRICT_MISSING_EVIDENCE_MESSAGE"
    );
    assert(validation.detectedFigures.length === 0, "Expected no detected figures");
  });

  await runTest("Test 1b: Rejects ungrounded generic ranges like ₹15,000–₹25,000 when missing evidence", () => {
    const emptyChunks: any[] = [];
    const validation = validateSalaryEvidence(emptyChunks);
    assert(validation.status === "EVIDENCE_NOT_FOUND", "Expected EVIDENCE_NOT_FOUND for empty chunks");
    assert(!validation.fallbackMessage.includes("15,000"), "Fallback message must not hallucinate ₹15,000");
    assert(!validation.fallbackMessage.includes("25,000"), "Fallback message must not hallucinate ₹25,000");
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Follow-Up Constraints (Failure B Guardrail)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Follow-Up Constraints & Intent Preservation (Failure B) ---");
  await runTest("Test 2a: Identifies constraint-only follow-up phrases", () => {
    const phrases = [
      "Use only verified personal loan master policy documents",
      "Only use verified personal loan master policy documents",
      "Please use only verified master policy documents",
      "Strictly use verified personal loan master policy documents",
      "Rely only on verified master policy files",
    ];
    for (const p of phrases) {
      assert(isConstraintOnlyFollowUp(p), `Expected isConstraintOnlyFollowUp('${p}') to be true`);
    }
  });

  await runTest("Test 2b: Inherits active lender and policy intent from conversation history", async () => {
    const history = [
      { role: "user", content: "What is the minimum monthly salary required for an Axis Finance personal loan?" },
      { role: "assistant", content: "Axis Finance requires specific monthly salary thresholds..." },
    ];
    const followUp = "Use only verified personal loan master policy documents";

    const routing = classifyRetrievalIntent(followUp, { conversationHistory: history });
    assert(routing.intent === "POLICY", `Expected intent to be POLICY, got ${routing.intent}`);
    assert(routing.detectedBank === "Axis Finance", `Expected detectedBank to be 'Axis Finance', got ${routing.detectedBank}`);
    assert(routing.detectedBankId === 15, `Expected detectedBankId to be 15, got ${routing.detectedBankId}`);
    assert(routing.loanCategory === "PERSONAL_LOAN", `Expected loanCategory to be PERSONAL_LOAN`);
    assert(routing.isConstraintOnlyFollowUp === true, `Expected isConstraintOnlyFollowUp to be true`);

    const ctx = await resolveConversationalContext(followUp, history);
    assert(ctx.isConstraintOnlyFollowUp === true, "Expected ctx.isConstraintOnlyFollowUp to be true");
    assert(ctx.detectedBank === "Axis Finance", `Expected ctx.detectedBank to be 'Axis Finance'`);
    assert(ctx.detectedBankId === 15, `Expected ctx.detectedBankId to be 15`);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Product Isolation (Personal Loan vs Home Loan)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Loan Product Isolation (Personal Loan vs Home Loan) ---");
  await runTest("Test 3a: Accurately detects loan categories from queries", () => {
    assert(detectLoanCategory("What is the minimum salary for a personal loan?") === "PERSONAL_LOAN", "Personal loan detection failed");
    assert(detectLoanCategory("What is the ROI for a home loan?") === "HOME_LOAN", "Home loan detection failed");
    assert(detectLoanCategory("What are the housing loan rules?") === "HOME_LOAN", "Housing loan detection failed");
  });

  await runTest("Test 3b: Personal loan queries strictly exclude Home Loan Services policy chunks", async () => {
    const results = await searchPolicyEmbeddings({
      query: "What is the minimum CIBIL score required for a personal loan?",
      loanCategory: "PERSONAL_LOAN",
      topK: 10,
    });
    for (const r of results) {
      assert(r.bank_id !== 19, `Found Home Loan Services chunk (bank_id 19) in personal loan query: ${r.file_name}`);
      assert(!r.file_name.toLowerCase().includes("home_loan"), `Found home loan file in personal loan query: ${r.file_name}`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Lender Isolation (Failure D Guardrail)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Strict Lender Isolation & Zero Cross-Lender Leakage (Failure D) ---");
  await runTest("Test 4: Axis Finance queries strictly isolate Axis Finance and exclude Axis Bank / other lenders", async () => {
    const results = await searchBankPolicyEmbeddings({
      query: "What is the minimum monthly salary required for an Axis Finance personal loan?",
      bankName: "Axis Finance",
      topK: 6,
    });
    assert(results.length > 0, "Expected at least 1 chunk for Axis Finance");
    for (const r of results) {
      assert(r.bankId === 15, `Cross-lender leakage detected! Expected bankId 15, received bankId ${r.bankId}`);
      assert(
        r.fileName === "Axis_Finance_Master_Policy.txt",
        `Cross-lender leakage detected! Expected Axis_Finance_Master_Policy.txt, received ${r.fileName}`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Missing Evidence Validation
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Strict Missing Evidence Validation ---");
  await runTest("Test 5: validateChunkEvidence returns EVIDENCE_NOT_FOUND when query parameter is absent in chunks", () => {
    const chunks = [
      { content: "Head Office Address: Mumbai, Maharashtra. Contact email: support@lender.com" },
    ];
    const salaryCheck = validateChunkEvidence("What is the minimum monthly salary required?", chunks);
    assert(salaryCheck.status === "EVIDENCE_NOT_FOUND", "Expected salary validation to return EVIDENCE_NOT_FOUND");
    assert(salaryCheck.missingAttribute === "salary", "Expected missingAttribute to be salary");

    const cibilCheck = validateChunkEvidence("What is the minimum CIBIL cutoff score?", chunks);
    assert(cibilCheck.status === "EVIDENCE_NOT_FOUND", "Expected CIBIL validation to return EVIDENCE_NOT_FOUND");
    assert(cibilCheck.missingAttribute === "cibil", "Expected missingAttribute to be cibil");
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Exact Citations Provenance
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: Exact Citations Provenance ---");
  await runTest("Test 6: Valid chunk evidence generates exact [Doc: <file>, Chunk #<index>] citations", () => {
    const chunks = [
      {
        fileName: "Axis_Finance_Master_Policy.txt",
        chunkIndex: 7,
        content: "Monthly NTH Requirements: Regular / Super CAT A: ₹1,07,874; Skilled Worker: ₹30,000",
      },
    ];
    const validation = validateSalaryEvidence(chunks);
    assert(validation.status === "VALID", "Expected status to be VALID");
    assert(validation.citations.length === 1, "Expected 1 citation");
    assert(
      validation.citations[0] === "[Doc: Axis_Finance_Master_Policy.txt, Chunk #7]",
      `Citation format mismatch: ${validation.citations[0]}`
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Demo Document Exclusion
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: Demo Document Exclusion ---");
  await runTest("Test 7: Normal queries strictly exclude demo documents", () => {
    const mockDocs: any[] = [
      { id: "1", name: "CreditWise_Demo_Loan_Knowledge_Base(1).docx", is_demo: true, isActive: true },
      { id: "2", name: "Axis_Finance_Master_Policy.txt", is_demo: false, isActive: true },
    ];
    const selected = selectRelevantDocuments("What is the loan policy?", mockDocs);
    for (const doc of selected) {
      assert(!doc.name.toLowerCase().includes("demo"), `Demo doc leaked into normal retrieval: ${doc.name}`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Attribute Relevance & Axis Finance Section 7 Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Attribute Relevance & Axis Finance Section 7 Policy Thresholds ---");
  await runTest("Test 8a: Raw Axis Finance Master Policy file contains exact Section 7 salary thresholds", () => {
    const policyPath = path.resolve(process.cwd(), "policy-master-files/Axis_Finance_Master_Policy.txt");
    const rawContent = fs.readFileSync(policyPath, "utf-8");
    assert(rawContent.includes("7. NTH / SALARY REQUIREMENTS"), "Missing Section 7 header in Axis Finance policy");
    assert(rawContent.includes("₹1,07,874"), "Missing Super CAT A salary threshold ₹1,07,874 in Section 7");
    assert(rawContent.includes("₹1,00,000"), "Missing Govt Program salary threshold ₹1,00,000 in Section 7");
    assert(rawContent.includes("₹30,000"), "Missing Skilled Worker salary threshold ₹30,000 in Section 7");
    assert(rawContent.includes("₹20,000"), "Missing Bharat Program salary threshold ₹20,000 in Section 7");
    assert(!rawContent.includes("₹25,000–₹40,000"), "Policy contains invalid ungrounded range ₹25,000–₹40,000");
  });

  await runTest("Test 8b: Grounded RAG execution returns verified Section 7 thresholds for Axis Finance salary query", async () => {
    const groundedResult = await executeGroundedRag({
      query: "What is the minimum monthly salary required for an Axis Finance personal loan?",
      bankName: "Axis Finance",
      bankId: 15,
      policyFileId: 2,
    });
    assert(groundedResult.status === "VALID", `Expected status to be VALID, got ${groundedResult.status}`);
    assert(groundedResult.answer.includes("₹1,07,874"), "Grounded answer missing ₹1,07,874");
    assert(groundedResult.answer.includes("₹1,00,000"), "Grounded answer missing ₹1,00,000");
    assert(groundedResult.answer.includes("₹30,000"), "Grounded answer missing ₹30,000");
    assert(groundedResult.answer.includes("₹20,000"), "Grounded answer missing ₹20,000");
    assert(groundedResult.citations.some((c) => c.includes("Chunk #7")), "Grounded answer missing citation for Chunk #7");
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Topic Switch Handling
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9: Topic Switch & Conversational Intelligence ---");
  await runTest("Test 9: Correctly differentiates general finance from bank policy and handles topic switch", () => {
    const general = classifyRetrievalIntent("What is compound interest and how does EMI amortization work?");
    assert(general.intent === "GENERAL", `Expected GENERAL intent, got ${general.intent}`);

    const policy = classifyRetrievalIntent("What is the FOIR limit for IDFC FIRST Bank personal loan?");
    assert(policy.intent === "POLICY", `Expected POLICY intent, got ${policy.intent}`);
    assert(policy.detectedBank === "IDFC FIRST Bank", `Expected IDFC FIRST Bank, got ${policy.detectedBank}`);
  });

  // ---------------------------------------------------------------------------
  // TEST 10: Source Failure & Resilient Fallback
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 10: Source Failure & Resilient PostgreSQL Fallback ---");
  await runTest("Test 10: Query rewriter generates high-signal terms for lexical fallback", () => {
    const rewritten = rewritePolicyQuery("What is the minimum monthly salary and CIBIL score for Axis Finance?");
    assert(rewritten.highSignalTerms.includes("salary"), "Missing high-signal term: salary");
    assert(rewritten.highSignalTerms.includes("cibil"), "Missing high-signal term: cibil");
    assert(rewritten.expandedQuery.length > 50, "Expanded query too short");
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Conflicting Sources Resolution
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 11: Conflicting Sources & Deterministic Master Policy Precedence ---");
  await runTest("Test 11: Resolves Axis Finance vs Axis Bank deterministically without collision", async () => {
    const axisFin = await resolvePolicyTarget("What is the policy for Axis Finance?");
    assert(axisFin?.bankId === 15, `Expected bankId 15 for Axis Finance, got ${axisFin?.bankId}`);
    assert(axisFin?.fileName === "Axis_Finance_Master_Policy.txt", "Wrong file for Axis Finance");

    const axisBank = await resolvePolicyTarget("What is the policy for Axis Bank?");
    assert(axisBank?.bankId === 14, `Expected bankId 14 for Axis Bank, got ${axisBank?.bankId}`);
    assert(axisBank?.fileName === "AXIS_Master_Policy.txt", "Wrong file for Axis Bank");
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Streaming & Grounded Generation
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 12: Streaming & Grounded Generation ---");
  await runTest("Test 12: PolicyPgVectorRetriever returns LangChain documents with complete metadata", async () => {
    const retriever = new PolicyPgVectorRetriever({
      bankId: 15,
      policyFileId: 2,
      bankName: "Axis Finance",
      loanCategory: "PERSONAL_LOAN",
      topK: 4,
    });
    const docs = await retriever._getRelevantDocuments("minimum monthly salary");
    assert(docs.length > 0, "Retriever returned 0 documents");
    for (const doc of docs) {
      assert(doc.metadata.bankId === 15, `Document bankId mismatch: ${doc.metadata.bankId}`);
      assert(doc.metadata.policyFileId === 2, `Document policyFileId mismatch: ${doc.metadata.policyFileId}`);
      assert(Boolean(doc.pageContent), "Document pageContent must not be empty");
    }
  });

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`TEST RESULTS: ${stats.passed}/${stats.total} TESTS PASSED (${((stats.passed / stats.total) * 100).toFixed(1)}%)`);
  if (stats.failed > 0) {
    console.error(`FAILED TESTS (${stats.failed}):`);
    for (const e of stats.errors) console.error(e);
    process.exit(1);
  } else {
    console.log("ALL TESTS COMPLETED SUCCESSFULLY WITH 100% PASS RATE.");
  }
  console.log("================================================================================\n");

  await pool.end();
}

main().catch((err) => {
  console.error("Test harness error:", err);
  process.exit(1);
});
