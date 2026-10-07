import * as fs from "fs";
import * as path from "path";

function runArchitectureAudit() {
  console.log("================================================================================");
  console.log("PHASE 7 — POLICY RAG STATIC ARCHITECTURAL AUDIT");
  console.log("================================================================================\n");

  let allPassed = true;

  const rootDir = process.cwd();
  const policyRagPath = path.join(rootDir, "lib/policyRag.ts");
  const agentPath = path.join(rootDir, "lib/ai/agent.ts");
  const toolSearchPath = path.join(rootDir, "lib/ai/tools/policyRagSearchTool.ts");
  const retrievalPath = path.join(rootDir, "lib/policyRetrieval.ts");

  const policyRagCode = fs.readFileSync(policyRagPath, "utf-8");
  const agentCode = fs.readFileSync(agentPath, "utf-8");
  const toolSearchCode = fs.readFileSync(toolSearchPath, "utf-8");
  const retrievalCode = fs.readFileSync(retrievalPath, "utf-8");

  // Extract answerBankPolicyWithMasterPolicy block from agent.ts
  const answerBankPolicyMatch = agentCode.match(/async function answerBankPolicyWithMasterPolicy[\s\S]*?\n\}/);
  const answerBankPolicyBlock = answerBankPolicyMatch ? answerBankPolicyMatch[0] : "";

  // ---------------------------------------------------------------------------
  // Check 1: Forbidden Local File Fallback in AI Policy Flow
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("CHECK #1: Forbidden AI Policy Local File Fallback (getMasterPolicyFileContent)");
  console.log("--------------------------------------------------------------------------------");
  const hasLocalReadInRag = policyRagCode.includes("getMasterPolicyFileContent") || policyRagCode.includes("readFileSync");
  const hasLocalReadInAgent = answerBankPolicyBlock.includes("getMasterPolicyFileContent") || answerBankPolicyBlock.includes("readFileSync");
  const passCheck1 = !hasLocalReadInRag && !hasLocalReadInAgent;

  console.log(`- Local file read in lib/policyRag.ts:                   ${hasLocalReadInRag ? "FOUND (FAIL)" : "NONE (PASS)"}`);
  console.log(`- Local file read in answerBankPolicyWithMasterPolicy:   ${hasLocalReadInAgent ? "FOUND (FAIL)" : "NONE (PASS)"}`);
  console.log(`STATUS: ${passCheck1 ? "PASS ✅" : "FAIL ❌"}\n`);
  if (!passCheck1) allPassed = false;

  // ---------------------------------------------------------------------------
  // Check 2: Forbidden Direct Policy LLM (fetch to openrouter.ai)
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("CHECK #2: Forbidden Direct Policy LLM Fetch (openrouter.ai/api/v1/chat/completions)");
  console.log("--------------------------------------------------------------------------------");
  const hasDirectFetchInAgentPolicy = answerBankPolicyBlock.includes("https://openrouter.ai/api/v1/chat/completions");
  const hasDirectFetchInRag = policyRagCode.includes("fetch(\"https://openrouter.ai/api/v1/chat/completions\")");
  const passCheck2 = !hasDirectFetchInAgentPolicy && !hasDirectFetchInRag;

  console.log(`- Direct fetch in answerBankPolicyWithMasterPolicy:      ${hasDirectFetchInAgentPolicy ? "FOUND (FAIL)" : "NONE (PASS)"}`);
  console.log(`- Direct fetch in lib/policyRag.ts:                      ${hasDirectFetchInRag ? "FOUND (FAIL)" : "NONE (PASS)"}`);
  console.log(`STATUS: ${passCheck2 ? "PASS ✅" : "FAIL ❌"}\n`);
  if (!passCheck2) allPassed = false;

  // ---------------------------------------------------------------------------
  // Check 3: Forbidden Duplicate Policy Retrieval in Production Code
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("CHECK #3: Forbidden Duplicate Retrieval Calls in Production Policy Functions");
  console.log("--------------------------------------------------------------------------------");
  // Check that answerPolicyWithRag, generatePolicyRagResponse, and policyRagSearchTool do NOT call searchPolicyEmbeddings directly
  const hasSearchEmbeddingsInRag = /answerPolicyWithRag[\s\S]*?searchPolicyEmbeddings/.test(policyRagCode);
  const hasSearchEmbeddingsInTool = toolSearchCode.includes("searchPolicyEmbeddings");
  const hasSearchEmbeddingsInAgent = answerBankPolicyBlock.includes("searchPolicyEmbeddings");
  const passCheck3 = !hasSearchEmbeddingsInRag && !hasSearchEmbeddingsInTool && !hasSearchEmbeddingsInAgent;

  console.log(`- searchPolicyEmbeddings in answerPolicyWithRag:         ${hasSearchEmbeddingsInRag ? "FOUND (FAIL)" : "NONE (PASS)"}`);
  console.log(`- searchPolicyEmbeddings in policyRagSearchTool:         ${hasSearchEmbeddingsInTool ? "FOUND (FAIL)" : "NONE (PASS)"}`);
  console.log(`- searchPolicyEmbeddings in answerBankPolicyWithMaster:  ${hasSearchEmbeddingsInAgent ? "FOUND (FAIL)" : "NONE (PASS)"}`);
  console.log(`STATUS: ${passCheck3 ? "PASS ✅" : "FAIL ❌"}\n`);
  if (!passCheck3) allPassed = false;

  // ---------------------------------------------------------------------------
  // Check 4: Forbidden Hardcoded Policy-File Mapping
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("CHECK #4: Forbidden Hardcoded Policy-File Mapping (e.g. policyFileId = 2)");
  console.log("--------------------------------------------------------------------------------");
  // Ensure resolvePolicyTarget in policyRag.ts does NOT hardcode policy IDs
  const resolveTargetMatch = policyRagCode.match(/async function resolvePolicyTarget[\s\S]*?\n\}/);
  const resolveTargetBlock = resolveTargetMatch ? resolveTargetMatch[0] : "";
  const hasHardcodedFileId =
    /policyFileId\s*=\s*[0-9]+/.test(resolveTargetBlock) ||
    /bankId\s*=\s*[0-9]+/.test(resolveTargetBlock) ||
    /if\s*\([^)]*axis\s*finance[^)]*\)/i.test(resolveTargetBlock);
  const passCheck4 = !hasHardcodedFileId && resolveTargetBlock.length > 0;

  console.log(`- Hardcoded policy mappings in resolvePolicyTarget:      ${hasHardcodedFileId ? "FOUND (FAIL)" : "NONE (PASS)"}`);
  console.log(`STATUS: ${passCheck4 ? "PASS ✅" : "FAIL ❌"}\n`);
  if (!passCheck4) allPassed = false;

  // ---------------------------------------------------------------------------
  // Check 5: Single Canonical Context Pipeline & Generation Flow
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------------");
  console.log("CHECK #5: Single Canonical Retrieval, Context, & Generator Wiring");
  console.log("--------------------------------------------------------------------------------");
  const usesRetrieverInRag = policyRagCode.includes("new PolicyPgVectorRetriever");
  const usesBuildContextInRag = policyRagCode.includes("buildPolicyContext(rawDocs");
  const usesGeneratorInRag = policyRagCode.includes("generatePolicyRagResponse({");
  const usesCanonicalPrompt = policyRagCode.includes("POLICY_RAG_SYSTEM_PROMPT");
  const noSimpleChatFallback = !policyRagCode.includes("simpleOpenRouterChat");
  const passCheck5 = usesRetrieverInRag && usesBuildContextInRag && usesGeneratorInRag && usesCanonicalPrompt && noSimpleChatFallback;

  console.log(`- PolicyPgVectorRetriever in answerPolicyWithRag:        ${usesRetrieverInRag ? "YES (PASS)" : "NO (FAIL)"}`);
  console.log(`- buildPolicyContext in answerPolicyWithRag:             ${usesBuildContextInRag ? "YES (PASS)" : "NO (FAIL)"}`);
  console.log(`- generatePolicyRagResponse in answerPolicyWithRag:      ${usesGeneratorInRag ? "YES (PASS)" : "NO (FAIL)"}`);
  console.log(`- Single POLICY_RAG_SYSTEM_PROMPT:                       ${usesCanonicalPrompt ? "YES (PASS)" : "NO (FAIL)"}`);
  console.log(`- Zero simpleOpenRouterChat fallback in policyRag:       ${noSimpleChatFallback ? "YES (PASS)" : "NO (FAIL)"}`);
  console.log(`STATUS: ${passCheck5 ? "PASS ✅" : "FAIL ❌"}\n`);
  if (!passCheck5) allPassed = false;

  console.log("================================================================================");
  console.log(`OVERALL ARCHITECTURE AUDIT STATUS: ${allPassed ? "ALL AUDIT CHECKS PASSED ✅" : "SOME AUDIT CHECKS FAILED ❌"}`);
  console.log("================================================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

runArchitectureAudit();
