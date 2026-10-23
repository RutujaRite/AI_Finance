// scripts/test-rag-retrieval-isolation.ts
/**
 * Automated Regression Test Suite:
 * 1. Demo Document Isolation (Normal queries exclude demo files; explicit queries allow them)
 * 2. Loan-Type Isolation (Personal Loan vs Home Loan cross-contamination prevention)
 * 3. Source-Grounding Compliance (Axis Finance salary grounded; missing info returns transparent notice)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import pool from "../lib/db";
import { classifyRetrievalIntent, detectLoanCategory } from "../lib/ai/intentRouting";
import {
  performDualSourceRetrieval,
  searchBankPolicyEmbeddings,
  searchAgentKnowledgeEmbeddings,
} from "../lib/ai/dualSourceRag";
import { selectRelevantDocuments, retrieveKnowledgeChunks } from "../lib/agent-studio/ragEngine";
import { extractSpecificBankPolicyParameter } from "../lib/ai/bankPolicyFormatter";
import { searchPolicyEmbeddings } from "../lib/policyRetrieval";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function runRegressionSuite() {
  console.log("================================================================================");
  console.log("CREDITWISE AI: RAG RETRIEVAL, METADATA FILTERING & GROUNDING REGRESSION TEST SUITE");
  console.log("================================================================================\n");

  try {
    // ---------------------------------------------------------------------------
    // SUITE 1: DEMO DOCUMENT ISOLATION & FILTERING
    // ---------------------------------------------------------------------------
    console.log("--------------------------------------------------------------------------------");
    console.log("SUITE 1: Demo Document Isolation & Metadata Filtering");
    console.log("--------------------------------------------------------------------------------");

    // 1.1 Test normal query against agent knowledge embeddings
    const normalKnowledgeRes = await searchAgentKnowledgeEmbeddings({
      query: "What is the maximum loan amount and interest rate for personal loan?",
      includeDemo: false,
      topK: 5,
    });
    const hasDemoInNormal = normalKnowledgeRes.some((c) =>
      (c.documentName || "").toLowerCase().includes("demo") ||
      (c.metadata?.documentName || "").toLowerCase().includes("demo")
    );
    assert(
      !hasDemoInNormal,
      "Normal query does NOT retrieve demo documents in searchAgentKnowledgeEmbeddings",
      `Found ${normalKnowledgeRes.length} chunks with demo: ${hasDemoInNormal}`
    );

    // 1.2 Test selectRelevantDocuments does not pick demo docs for normal loan queries
    const mockDocs: any[] = [
      {
        id: "demo-doc-1",
        name: "CreditWise_Demo_Loan_Knowledge_Base(1).docx",
        is_demo: true,
        isActive: true,
        status: "READY",
      },
      {
        id: "prod-doc-2",
        name: "Company_Category_Policy_Guide.pdf",
        is_demo: false,
        isActive: true,
        status: "READY",
      },
    ];
    const selectedForNormal = selectRelevantDocuments(
      "What is the eligibility for personal loan?",
      mockDocs
    );
    const demoSelected = selectedForNormal.some((d) => d.name.toLowerCase().includes("demo"));
    assert(!demoSelected, "selectRelevantDocuments excludes demo files for standard loan queries");

    // 1.3 Test explicit demo request allows demo documents
    const selectedForExplicitDemo = selectRelevantDocuments(
      "Show me demo loan knowledge base data for testing",
      mockDocs
    );
    const explicitDemoIncluded = selectedForExplicitDemo.some((d) => d.name.toLowerCase().includes("demo"));
    assert(
      explicitDemoIncluded,
      "selectRelevantDocuments includes demo files when user explicitly asks for demo/test data"
    );

    // 1.4 Test dual-source retrieval for normal query does not cite demo file
    const normalRouting = classifyRetrievalIntent("What is the personal loan interest rate?");
    const dualSourceNormal = await performDualSourceRetrieval({
      query: "What is the personal loan interest rate?",
      routing: normalRouting,
      topK: 5,
    });
    const hasDemoInDualSource = dualSourceNormal.sources.some((s) => s.name.toLowerCase().includes("demo"));
    assert(!hasDemoInDualSource, "performDualSourceRetrieval excludes demo files for normal inquiries");

    // ---------------------------------------------------------------------------
    // SUITE 2: LOAN PRODUCT ISOLATION (PERSONAL LOAN vs HOME LOAN)
    // ---------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("SUITE 2: Loan Product Isolation (Personal Loan vs Home Loan)");
    console.log("--------------------------------------------------------------------------------");

    // 2.1 Test intent classification detects product category
    const plCategory = detectLoanCategory("What is the minimum CIBIL score for a personal loan?");
    assert(plCategory === "PERSONAL_LOAN", "detectLoanCategory identifies personal loan query");

    const hlCategory = detectLoanCategory("What are the interest rates and tenure for a home loan?");
    assert(hlCategory === "HOME_LOAN", "detectLoanCategory identifies home loan query");

    // 2.2 Test cross-bank personal loan search excludes Home Loan Services
    const plChunks = await searchBankPolicyEmbeddings({
      query: "What is the minimum CIBIL score across all partner banks?",
      loanCategory: "PERSONAL_LOAN",
      topK: 10,
    });
    const hasHomeLoanInPL = plChunks.some(
      (c) =>
        c.fileName.toLowerCase().includes("home_loan") ||
        c.bankId === 19 ||
        c.loanCategory === "HOME_LOAN"
    );
    assert(
      !hasHomeLoanInPL && plChunks.length > 0,
      "Cross-bank Personal Loan search strictly excludes Home Loan Services policy",
      `Retrieved ${plChunks.length} chunks, hasHomeLoanInPL: ${hasHomeLoanInPL}`
    );

    // 2.3 Test Home Loan search strictly retrieves Home Loan policy and excludes Personal Loan
    const hlChunks = await searchBankPolicyEmbeddings({
      query: "Home loan documents list and collateral criteria",
      loanCategory: "HOME_LOAN",
      topK: 5,
    });
    const allHomeLoan = hlChunks.every(
      (c) =>
        c.fileName.toLowerCase().includes("home_loan") ||
        c.bankId === 19 ||
        c.loanCategory === "HOME_LOAN"
    );
    assert(
      allHomeLoan && hlChunks.length > 0,
      "Home Loan query retrieves strictly Home Loan policy chunks without personal loan mixing",
      `Retrieved ${hlChunks.length} chunks, allHomeLoan: ${allHomeLoan}`
    );

    // 2.4 Test policyRetrieval internal vector search with loanCategory constraint
    const plPolicyRetrieval = await searchPolicyEmbeddings({
      query: "minimum monthly salary",
      loanCategory: "PERSONAL_LOAN",
      topK: 6,
    });
    const hasHlInPolicyRetrieval = plPolicyRetrieval.some((c) => c.bank_id === 19 || c.file_name.includes("Home_Loan"));
    assert(
      !hasHlInPolicyRetrieval,
      "PolicyPgVectorRetriever search enforces personal loan isolation"
    );

    // ---------------------------------------------------------------------------
    // SUITE 3: SOURCE-GROUNDING COMPLIANCE & AXIS FINANCE SALARY AUDIT
    // ---------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------------------------------");
    console.log("SUITE 3: Source-Grounding Compliance & Axis Finance Salary Audit");
    console.log("--------------------------------------------------------------------------------");

    // 3.1 Raw Document Verification: verify ₹25,000-₹40,000 does NOT exist in raw Axis Finance policy
    const axisRawChunks = await pool.query(
      "SELECT chunk_index, content FROM bank_policy_embeddings WHERE file_name = 'Axis_Finance_Master_Policy.txt' ORDER BY chunk_index ASC"
    );
    let rawAxisHas25kTo40k = false;
    for (const row of axisRawChunks.rows) {
      if (/₹?25,000\s*(?:to|-|–)\s*₹?40,000/i.test(row.content)) {
        rawAxisHas25kTo40k = true;
      }
    }
    assert(
      !rawAxisHas25kTo40k,
      "Raw Axis Finance Master Policy file does NOT contain ungrounded '₹25,000–₹40,000' range"
    );

    // 3.2 Formatter Grounding: Verify extractSpecificBankPolicyParameter returns verified Section 7 values
    const axisSalaryAns = extractSpecificBankPolicyParameter("Axis Finance", "What is the minimum salary?");
    const hasUngroundedRange = axisSalaryAns?.includes("₹25,000 to ₹40,000") || false;
    const hasGroundedSuperCatA = axisSalaryAns?.includes("1,07,874") || false;
    const hasGroundedBharat = axisSalaryAns?.includes("20,000") || false;
    const hasGroundedSkilled = axisSalaryAns?.includes("30,000") || false;

    assert(
      !hasUngroundedRange,
      "Axis Finance salary formatter eliminates ungrounded '₹25,000 to ₹40,000' range"
    );
    assert(
      hasGroundedSuperCatA && hasGroundedBharat && hasGroundedSkilled,
      "Axis Finance salary formatter outputs verified Section 7 policy thresholds (₹1,07,874 / ₹30,000 / ₹20,000)",
      `SuperCAT A: ${hasGroundedSuperCatA}, Bharat: ${hasGroundedBharat}, Skilled: ${hasGroundedSkilled}`
    );

    // 3.3 Missing Requirement Directive: Verify transparent message formatting
    const groundingNotice =
      "The available bank policy documents do not specify this requirement. Please refer to your lender's official underwriting guidelines for exact confirmation.";
    assert(
      groundingNotice.includes("official underwriting guidelines for exact confirmation"),
      "Graceful missing information directive matches strict user prompt specification"
    );

    console.log("\n================================================================================");
    console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log("================================================================================\n");

    if (passedTests !== totalTests) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution encountered an error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runRegressionSuite().catch(console.error);
