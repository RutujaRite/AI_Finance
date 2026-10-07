import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import pool from "../lib/db";
import { runCentralAgent } from "../lib/ai/agent";
import { answerPolicyWithRag, resolvePolicyTarget } from "../lib/policyRag";

interface FormattingTestCase {
  id: number;
  name: string;
  query: string;
  expectedBank: string;
  expectedPolicyFile: string;
  validate: (reply: string, sources: any[]) => { passed: boolean; reason: string };
}

async function runFormattingTests() {
  console.log("================================================================================");
  console.log("PHASE 9B — POLICY RAG FINAL RESPONSE FORMATTING & REPETITION TEST SUITE");
  console.log("================================================================================\n");

  const testCases: FormattingTestCase[] = [
    // Test 1: Focused CIBIL with Cross-Bank Reference & [REVIEW] Conflict
    {
      id: 1,
      name: "Focused CIBIL & Entity Separation",
      query: "What is the Axis Finance CIBIL requirement? I heard Axis Bank requires 750.",
      expectedBank: "Axis Finance",
      expectedPolicyFile: "Axis_Finance_Master_Policy.txt",
      validate: (reply, sources) => {
        const has720 = reply.includes("720");
        const has730 = reply.includes("730");
        const hasReview = reply.includes("[REVIEW]");
        const hasAxisBankRef = /Axis Bank/i.test(reply) && /separate|restricted|not used/i.test(reply);
        const hasSource = reply.includes("Axis_Finance_Master_Policy.txt");
        const noInternalMeta = !reply.includes("policy_file_id") && !reply.includes("policy_embeddings");
        const noCta = !/continue with your loan eligibility|check your eligibility/i.test(reply);
        const allAfl = sources.every((s) => s.fileName.includes("Axis_Finance_Master_Policy.txt"));

        const passed = has720 && has730 && hasReview && hasAxisBankRef && hasSource && noInternalMeta && noCta && allAfl;
        return {
          passed,
          reason: `720: ${has720}, 730+: ${has730}, [REVIEW]: ${hasReview}, Axis Bank Ref: ${hasAxisBankRef}, Source: ${hasSource}, No CTA: ${noCta}, AFL isolated: ${allAfl}`,
        };
      },
    },

    // Test 2: Company Categories
    {
      id: 2,
      name: "Company Categories Document Style",
      query: "What are the company categories for Axis Finance?",
      expectedBank: "Axis Finance",
      expectedPolicyFile: "Axis_Finance_Master_Policy.txt",
      validate: (reply) => {
        const mentionsCatA = /CAT\s*A/i.test(reply);
        const mentionsCatBOrSuper = /CAT\s*B|Super\s*CAT/i.test(reply);
        const hasHeading = /###.*(?:Company Categories|Category)/i.test(reply);
        const hasSource = reply.includes("Axis_Finance_Master_Policy.txt");
        const passed = mentionsCatA && mentionsCatBOrSuper && hasHeading && hasSource;
        return {
          passed,
          reason: `CAT A: ${mentionsCatA}, CAT B/Super: ${mentionsCatBOrSuper}, Heading: ${hasHeading}, Source: ${hasSource}`,
        };
      },
    },

    // Test 3: Documents
    {
      id: 3,
      name: "Required Documents Clean Grouping",
      query: "What documents are required for Axis Finance personal loan?",
      expectedBank: "Axis Finance",
      expectedPolicyFile: "Axis_Finance_Master_Policy.txt",
      validate: (reply) => {
        const hasBankStatement = /bank statement/i.test(reply);
        const hasKycOrSalary = /kyc|payslip|salary|epfo/i.test(reply);
        const hasSource = reply.includes("Axis_Finance_Master_Policy.txt");
        const noCta = !/continue with your loan eligibility/i.test(reply);
        const passed = hasBankStatement && hasKycOrSalary && hasSource && noCta;
        return {
          passed,
          reason: `Bank statement: ${hasBankStatement}, KYC/Salary: ${hasKycOrSalary}, Source: ${hasSource}, No CTA: ${noCta}`,
        };
      },
    },

    // Test 4: FOIR Requirement & Conflicts
    {
      id: 4,
      name: "FOIR Requirement & Program Variations",
      query: "What is the standard FOIR allowed in Axis Finance?",
      expectedBank: "Axis Finance",
      expectedPolicyFile: "Axis_Finance_Master_Policy.txt",
      validate: (reply) => {
        const mentionsFoirOrPct = /foir|%/i.test(reply) && (reply.includes("65") || reply.includes("70") || reply.includes("75") || reply.includes("80"));
        const hasSource = reply.includes("Axis_Finance_Master_Policy.txt");
        const passed = mentionsFoirOrPct && hasSource;
        return {
          passed,
          reason: `FOIR/Percent: ${mentionsFoirOrPct}, Source: ${hasSource}`,
        };
      },
    },

    // Test 5: Broad Eligibility Dynamic Sections
    {
      id: 5,
      name: "Broad Eligibility Dynamic Sections",
      query: "What are the complete eligibility criteria for Axis Finance?",
      expectedBank: "Axis Finance",
      expectedPolicyFile: "Axis_Finance_Master_Policy.txt",
      validate: (reply) => {
        const hasOverviewHeading = /###.*(?:Eligibility Overview|Eligibility Criteria)/i.test(reply);
        const hasCibil = /CIBIL/i.test(reply);
        const hasAge = /Age/i.test(reply);
        const hasSource = reply.includes("Axis_Finance_Master_Policy.txt");
        const passed = hasOverviewHeading && hasCibil && hasAge && hasSource && reply.length > 300;
        return {
          passed,
          reason: `Overview: ${hasOverviewHeading}, CIBIL: ${hasCibil}, Age: ${hasAge}, Source: ${hasSource}, Length: ${reply.length}`,
        };
      },
    },

    // Test 6: Missing / Non-Specified Evidence (Anti-Hallucination)
    {
      id: 6,
      name: "Missing Evidence Anti-Hallucination",
      query: "What is the pet insurance policy requirement in Axis Finance personal loan?",
      expectedBank: "Axis Finance",
      expectedPolicyFile: "Axis_Finance_Master_Policy.txt",
      validate: (reply) => {
        const acknowledgesNotSpecified =
          /not\s*(?:specified|mentioned|available|stated)|does\s*not\s*(?:specify|mention|contain)|no\s*(?:specific\s*)?requirement/i.test(
            reply
          );
        const doesNotInvent = !reply.includes("pet insurance is mandatory");
        const passed = acknowledgesNotSpecified && doesNotInvent;
        return {
          passed,
          reason: `Acknowledges not specified: ${acknowledgesNotSpecified}, Does not invent: ${doesNotInvent}`,
        };
      },
    },

    // Test 7: Cross-Bank Mention Isolation
    {
      id: 7,
      name: "Cross-Bank Mention Isolation",
      query: "What is the HDFC Bank CIBIL requirement? I heard ICICI Bank needs 770.",
      expectedBank: "HDFC Bank",
      expectedPolicyFile: "HDFC_Bank_Master_Policy_CIBIL_Updated.txt",
      validate: (reply, sources) => {
        const hasHdfc = /HDFC/i.test(reply);
        const mentionsIciciSep = /ICICI/i.test(reply) && /separate|restricted|not used/i.test(reply);
        const allHdfc = sources.every((s) => s.fileName.includes("HDFC"));
        const noIciciSources = !sources.some((s) => s.fileName.includes("ICICI"));
        const passed = hasHdfc && allHdfc && noIciciSources;
        return {
          passed,
          reason: `Has HDFC: ${hasHdfc}, ICICI separated: ${mentionsIciciSep}, All HDFC sources: ${allHdfc}, No ICICI sources: ${noIciciSources}`,
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

    const target = await resolvePolicyTarget(tc.expectedBank);
    if (!target) {
      console.error(`FAIL: Could not resolve target for ${tc.expectedBank}`);
      allPassed = false;
      continue;
    }

    const ragResult = await answerPolicyWithRag({
      query: tc.query,
      policyFileId: target.policyFileId,
      bankId: target.bankId,
      topK: 5,
    });

    const val = tc.validate(ragResult.answer, ragResult.sources);
    console.log(`Result: ${val.passed ? "PASS ✅" : "FAIL ❌"}`);
    console.log(`Reason: ${val.reason}`);
    console.log(`Preview:\n${ragResult.answer.slice(0, 250)}...\n`);

    if (!val.passed) allPassed = false;
  }

  console.log("================================================================================");
  console.log(`FINAL FORMATTING AUDIT STATUS: ${allPassed ? "ALL 7 TESTS PASSED ✅" : "SOME TESTS FAILED ❌"}`);
  console.log("================================================================================\n");

  await pool.end();

  if (!allPassed) process.exit(1);
}

runFormattingTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
