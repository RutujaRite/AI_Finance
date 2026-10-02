// scripts/phase0-baseline-test-suite.ts
/**
 * CreditWise AI Smart Assistant Upgrade - Phase 0 Baseline Test Suite
 * 
 * Objectives:
 * 1. Verify deterministic business logic (EMI calculations, Master Policies, Company DB, Bank Manager DB, Dynamic Eligibility Engine).
 * 2. Verify database state isolation (no cross-conversation bleed, clean session init, cascade deletes).
 * 3. Establish conversational baseline on current production behavior (capturing both passing flows and existing limitations).
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import pool from "../lib/db";
import {
  calculateEmi,
  calculateMaxLoanCapacity,
  evaluateApplicantAgainstAllBanks,
  saveEligibilityState,
  getEligibilityState,
  clearEligibilityState,
  ApplicantProfile,
} from "../lib/dynamicEligibilityEngine";
import { searchCompany } from "../lib/companySearch";
import { searchBankManager } from "../lib/bankSearch";
import { getMasterPolicyFileContent } from "../lib/masterPolicyParser";
import { runCentralAgent } from "../lib/ai/agent";

// Types for tracking results
interface TestResult {
  suite: string;
  name: string;
  status: "PASS" | "BASELINE_FAIL" | "FAIL";
  category: "DETERMINISTIC" | "DATABASE_ISOLATION" | "CONVERSATIONAL_BASELINE";
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function recordTest(
  suite: string,
  name: string,
  category: "DETERMINISTIC" | "DATABASE_ISOLATION" | "CONVERSATIONAL_BASELINE",
  fn: () => Promise<void>,
  isKnownLimitation: boolean = false
) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ suite, name, status: "PASS", category, durationMs });
    console.log(`  ✅ PASS: [${suite}] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    if (isKnownLimitation) {
      results.push({
        suite,
        name,
        status: "BASELINE_FAIL",
        category,
        details: err?.message || String(err),
        durationMs,
      });
      console.log(`  ⚠️  BASELINE_FAIL (Known Existing Bug): [${suite}] ${name}`);
      console.log(`      Detail: ${err?.message || err}`);
    } else {
      results.push({
        suite,
        name,
        status: "FAIL",
        category,
        details: err?.message || String(err),
        durationMs,
      });
      console.error(`  ❌ UNEXPECTED FAIL: [${suite}] ${name}`);
      console.error(`      Detail: ${err?.message || err}`);
    }
  }
}

async function runPhase0BaselineSuite() {
  console.log("================================================================================");
  console.log("🚀 CREDITWISE AI: PHASE 0 BASELINE & REGRESSION TEST MATRIX");
  console.log("================================================================================\n");

  const client = await pool.connect();

  try {
    // =========================================================================
    // SUITE 1: DETERMINISTIC BUSINESS LOGIC VERIFICATION
    // =========================================================================
    console.log("--- SUITE 1: Deterministic Business Logic (Zero LLM Involvement) ---");

    // 1.1 EMI Calculation Standard Case
    await recordTest(
      "Deterministic Logic",
      "1.1 EMI Standard Calculation (₹5L, 12% p.a., 36 months = ₹16,607)",
      "DETERMINISTIC",
      async () => {
        const emi = calculateEmi(500000, 12, 36);
        assert.strictEqual(emi, 16607, `Expected EMI 16607, got ${emi}`);
      }
    );

    // 1.2 EMI Calculation Edge Cases
    await recordTest(
      "Deterministic Logic",
      "1.2 EMI Edge Cases (0 rate, 0 tenure, negative checks)",
      "DETERMINISTIC",
      async () => {
        const emiZeroRate = calculateEmi(120000, 0, 12);
        assert.strictEqual(emiZeroRate, 10000, "0% interest should be simple division: 120000/12 = 10000");

        const emiZeroTenure = calculateEmi(100000, 12, 0);
        assert.strictEqual(emiZeroTenure, 0, "0 tenure should return 0");

        const emiZeroPrincipal = calculateEmi(0, 12, 12);
        assert.strictEqual(emiZeroPrincipal, 0, "0 principal should return 0");
      }
    );

    // 1.3 Maximum Loan Capacity Calculation
    await recordTest(
      "Deterministic Logic",
      "1.3 Max Loan Capacity Calculation",
      "DETERMINISTIC",
      async () => {
        // Available EMI ₹20,000 at 12% p.a. for 60 months
        const capacity = calculateMaxLoanCapacity(20000, 12, 60);
        assert.ok(capacity > 850000 && capacity < 950000, `Expected capacity ~₹9L, got ${capacity}`);
      }
    );

    // 1.4 Master Policy Files Disk Inspection
    await recordTest(
      "Deterministic Logic",
      "1.4 Master Policy Files Loaded from Disk",
      "DETERMINISTIC",
      async () => {
        const axisText = getMasterPolicyFileContent("AXIS_Master_Policy.txt");
        assert.ok(axisText.length > 500, "AXIS_Master_Policy.txt must not be empty");
        assert.ok(/personal loan/i.test(axisText), "Axis policy must mention Personal Loan");

        const hdfcText = getMasterPolicyFileContent("HDFC_Bank_Master_Policy_CIBIL_Updated.txt");
        assert.ok(hdfcText.length > 500, "HDFC_Bank_Master_Policy_CIBIL_Updated.txt must not be empty");

        const iciciText = getMasterPolicyFileContent("ICICI_Bank_Personal_Loan_Policy_Rulebook.txt");
        assert.ok(iciciText.length > 500, "ICICI_Bank_Personal_Loan_Policy_Rulebook.txt must not be empty");
      }
    );

    // 1.5 Company Search Against 339k Database Records
    await recordTest(
      "Deterministic Logic",
      "1.5 Company Search & Intelligence (TCS & Infosys)",
      "DETERMINISTIC",
      async () => {
        const tcsResult = await searchCompany("TCS", 5);
        assert.ok(tcsResult.found, "TCS must be found in DB");
        assert.ok(tcsResult.candidateOptions.length > 0, "TCS must have disambiguation candidates");
        assert.ok(
          tcsResult.candidateOptions.some((c) => /tata consultancy/i.test(c.name)),
          "Top candidates must include Tata Consultancy Services"
        );

        const infyResult = await searchCompany("Infosys", 5);
        assert.ok(infyResult.found, "Infosys must be found in DB");
        assert.ok(
          infyResult.candidateOptions.some((c) => /infosys limited/i.test(c.name)),
          "Candidates must include Infosys Limited"
        );
      }
    );

    // 1.6 Bank Manager Database Search
    await recordTest(
      "Deterministic Logic",
      "1.6 Bank Manager Database Lookup (Yes Bank & ICICI Bank)",
      "DETERMINISTIC",
      async () => {
        const managers = await searchBankManager({
          bank_name: "Yes Bank",
          city: "Pune",
        });
        assert.ok(Array.isArray(managers), "Managers result must be an array");
        assert.ok(managers.length > 0, "Must find Yes Bank managers in Pune");
        assert.ok(managers[0].bank_name.toLowerCase().includes("yes bank"), "Manager record must belong to Yes Bank");
        assert.ok(managers[0].name.length > 0, "Manager record must contain name");

        // Negative check: non-existent location returns empty array safely
        const ghost = await searchBankManager({
          bank_name: "HDFC Bank",
          city: "AtlantisCityNotReal",
        });
        assert.strictEqual(ghost.length, 0, "Non-existent city must return 0 rows cleanly");
      }
    );

    // 1.7 Dynamic Eligibility Engine: Approved Profile
    await recordTest(
      "Deterministic Logic",
      "1.7 Dynamic Eligibility Engine: Approved Profile (TCS, ₹85k, 750 CIBIL)",
      "DETERMINISTIC",
      async () => {
        const profile: ApplicantProfile = {
          companyName: "Tata Consultancy Services",
          monthlyIncome: 85000,
          loanAmount: 500000,
          tenureMonths: 36,
          cibil: 750,
          age: 28,
          existingEmi: 0,
          employmentType: "Salaried",
        };

        const res = await evaluateApplicantAgainstAllBanks(profile, "Personal Loan");
        assert.ok(res.evaluations.length >= 20, "Must evaluate at least 20 partner banks");
        assert.ok(res.eligibleBanks.length >= 5, "High-income CAT-A applicant must be eligible at >= 5 banks");
        assert.ok(res.recommendedBank !== null, "Must determine a top recommended bank");
        assert.ok(res.recommendedBank.roi > 0, "Recommended bank must have valid positive ROI");
        assert.ok(res.recommendedBank.monthlyEmi > 0, "Recommended bank must have positive monthly EMI");
      }
    );

    // 1.8 Dynamic Eligibility Engine: Ineligible Profile (< Minimum Salary / Low CIBIL)
    await recordTest(
      "Deterministic Logic",
      "1.8 Dynamic Eligibility Engine: Ineligible Profile (₹12k salary, 550 CIBIL)",
      "DETERMINISTIC",
      async () => {
        const profile: ApplicantProfile = {
          companyName: "Unlisted Small Firm",
          monthlyIncome: 12000,
          loanAmount: 2000000,
          tenureMonths: 36,
          cibil: 550,
          age: 25,
          existingEmi: 0,
          employmentType: "Salaried",
        };

        const res = await evaluateApplicantAgainstAllBanks(profile, "Personal Loan");
        assert.strictEqual(res.eligibleBanks.length, 0, "All banks must filter out 550 CIBIL and ₹12k salary");
        assert.ok(res.ineligibleBanks.length >= 20, "All partner banks must be in ineligible list with reasons");
        assert.strictEqual(res.recommendedBank, null, "No bank should be recommended for disqualified applicant");
      }
    );

    console.log();

    // =========================================================================
    // SUITE 2: DATABASE STATE & SESSION ISOLATION
    // =========================================================================
    console.log("--- SUITE 2: Database State & Session Isolation ---");

    const testUserId = 2;

    // 2.1 Conversation Creation & Clean State Init
    let conv1Id = 0;
    let conv2Id = 0;

    await recordTest(
      "Database Isolation",
      "2.1 Clean Conversation Initialization (Chat 1 & Chat 2)",
      "DATABASE_ISOLATION",
      async () => {
        const res1 = await client.query(
          `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Baseline Chat 1') RETURNING id`,
          [testUserId]
        );
        conv1Id = Number(res1.rows[0].id);

        const res2 = await client.query(
          `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Baseline Chat 2') RETURNING id`,
          [testUserId]
        );
        conv2Id = Number(res2.rows[0].id);

        const state1 = await getEligibilityState(String(conv1Id));
        const state2 = await getEligibilityState(String(conv2Id));

        assert.strictEqual(state1, null, "Fresh conversation 1 must have null eligibility state");
        assert.strictEqual(state2, null, "Fresh conversation 2 must have null eligibility state");
      }
    );

    // 2.2 Message Isolation Across Sessions
    await recordTest(
      "Database Isolation",
      "2.2 Message Isolation Between Chat 1 and Chat 2",
      "DATABASE_ISOLATION",
      async () => {
        await client.query(
          `INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1, 'user', 'Message in Chat 1')`,
          [conv1Id]
        );
        await client.query(
          `INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1, 'user', 'Message in Chat 2')`,
          [conv2Id]
        );

        const msgs1 = await client.query(
          `SELECT role, content FROM assistant_messages WHERE conversation_id = $1`,
          [conv1Id]
        );
        const msgs2 = await client.query(
          `SELECT role, content FROM assistant_messages WHERE conversation_id = $1`,
          [conv2Id]
        );

        assert.strictEqual(msgs1.rowCount, 1, "Chat 1 must have exactly 1 message");
        assert.strictEqual(msgs1.rows[0].content, "Message in Chat 1");

        assert.strictEqual(msgs2.rowCount, 1, "Chat 2 must have exactly 1 message");
        assert.strictEqual(msgs2.rows[0].content, "Message in Chat 2");
      }
    );

    // 2.3 Eligibility State Isolation Across Sessions
    await recordTest(
      "Database Isolation",
      "2.3 Eligibility State Isolation (Chat 1 ≠ Chat 2)",
      "DATABASE_ISOLATION",
      async () => {
        await saveEligibilityState(String(conv1Id), {
          applicant: {
            companyName: "Infosys Limited",
            monthlyIncome: 90000,
          },
          updatedAt: Date.now(),
        });

        await saveEligibilityState(String(conv2Id), {
          applicant: {
            companyName: "Wipro",
            monthlyIncome: 45000,
          },
          updatedAt: Date.now(),
        });

        const s1 = await getEligibilityState(String(conv1Id));
        const s2 = await getEligibilityState(String(conv2Id));

        assert.strictEqual(s1?.applicant?.companyName, "Infosys Limited", "Chat 1 must have Infosys Limited");
        assert.strictEqual(s1?.applicant?.monthlyIncome, 90000, "Chat 1 must have ₹90,000");

        assert.strictEqual(s2?.applicant?.companyName, "Wipro", "Chat 2 must have Wipro");
        assert.strictEqual(s2?.applicant?.monthlyIncome, 45000, "Chat 2 must have ₹45,000");
      }
    );

    // 2.4 Cascade Cleanup of Chat 1
    await recordTest(
      "Database Isolation",
      "2.4 Deletion Cascade & Independence (Delete Chat 1, Chat 2 unaffected)",
      "DATABASE_ISOLATION",
      async () => {
        await client.query(`DELETE FROM assistant_conversations WHERE id = $1`, [conv1Id]);
        await clearEligibilityState(String(conv1Id));

        const msgs1 = await client.query(
          `SELECT id FROM assistant_messages WHERE conversation_id = $1`,
          [conv1Id]
        );
        assert.strictEqual(msgs1.rowCount, 0, "Messages for Chat 1 must be deleted");

        const state1 = await getEligibilityState(String(conv1Id));
        assert.strictEqual(state1, null, "State for Chat 1 must be cleared");

        // Verify Chat 2 remains completely intact
        const msgs2 = await client.query(
          `SELECT id FROM assistant_messages WHERE conversation_id = $1`,
          [conv2Id]
        );
        assert.strictEqual(msgs2.rowCount, 1, "Chat 2 messages must remain intact");

        const state2 = await getEligibilityState(String(conv2Id));
        assert.strictEqual(state2?.applicant?.companyName, "Wipro", "Chat 2 state must remain intact");

        // Cleanup Chat 2
        await client.query(`DELETE FROM assistant_conversations WHERE id = $1`, [conv2Id]);
        await clearEligibilityState(String(conv2Id));
      }
    );

    console.log();

    // =========================================================================
    // SUITE 3: CONVERSATIONAL BASELINE & REGRESSION TESTS
    // =========================================================================
    console.log("--- SUITE 3: Conversational Behavior Baseline (runCentralAgent) ---");

    // 3.1 Initial Loan Intent: "I want a personal loan"
    await recordTest(
      "Conversational Baseline",
      "3.1 Initial Loan Request ('I want a personal loan')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_loan_${Date.now()}`;
        await clearEligibilityState(convId);
        const res = await runCentralAgent({
          conversationId: convId,
          message: "I want a personal loan",
        });
        await clearEligibilityState(convId);
        assert.ok(
          /company|employer|salary/i.test(res.reply),
          `Expected prompt for employer/company, got: ${res.reply.slice(0, 150)}`
        );
      }
    );

    // 3.2 Natural Employer Response: "I work at Infosys"
    await recordTest(
      "Conversational Baseline",
      "3.2 Natural Employer Response ('I work at Infosys')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_emp_${Date.now()}`;
        await clearEligibilityState(convId);
        const res = await runCentralAgent({
          conversationId: convId,
          message: "I work at Infosys",
        });
        await clearEligibilityState(convId);
        assert.ok(
          /confirm|Infosys/i.test(res.reply),
          `Expected Infosys confirmation or matching companies, got: ${res.reply.slice(0, 150)}`
        );
      }
    );

    // 3.3 Salary Input: "My salary is 60000"
    await recordTest(
      "Conversational Baseline",
      "3.3 Salary Input ('My salary is 60000')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_sal_${Date.now()}`;
        await clearEligibilityState(convId);
        // Pre-set company in state to simulate intake flow
        await saveEligibilityState(convId, {
          applicant: { companyName: "TCS" },
          expectedField: "monthlyIncome",
          in_eligibility_flow: true,
        });

        const res = await runCentralAgent({
          conversationId: convId,
          message: "My salary is 60000",
        });

        const updated = await getEligibilityState(convId);
        await clearEligibilityState(convId);
        assert.strictEqual(
          Number(updated?.applicant?.monthlyIncome),
          60000,
          `Expected monthlyIncome 60000 in state, got ${updated?.applicant?.monthlyIncome}`
        );
        assert.ok(
          /loan amount|borrow|how much/i.test(res.reply),
          "Assistant should transition to next requirement"
        );
      }
    );

    // 3.4 CIBIL Input: "My CIBIL is 760"
    await recordTest(
      "Conversational Baseline",
      "3.4 CIBIL Input ('My CIBIL is 760')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_cibil_${Date.now()}`;
        await clearEligibilityState(convId);
        await saveEligibilityState(convId, {
          applicant: { companyName: "TCS", monthlyIncome: 60000, loanAmount: 500000, tenureMonths: 36 },
          expectedField: "cibil",
          in_eligibility_flow: true,
        });

        const res = await runCentralAgent({
          conversationId: convId,
          message: "My CIBIL is 760",
        });

        const updated = await getEligibilityState(convId);
        await clearEligibilityState(convId);
        assert.strictEqual(
          Number(updated?.applicant?.cibil),
          760,
          `Expected cibil 760 in state, got ${updated?.applicant?.cibil}`
        );
      }
    );

    // 3.5 Loan Amount Input: "I need 800000"
    await recordTest(
      "Conversational Baseline",
      "3.5 Loan Amount Input ('I need 800000')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_amount_${Date.now()}`;
        await clearEligibilityState(convId);
        await saveEligibilityState(convId, {
          applicant: { companyName: "TCS", monthlyIncome: 60000 },
          expectedField: "loanAmount",
          in_eligibility_flow: true,
        });

        const res = await runCentralAgent({
          conversationId: convId,
          message: "I need 800000",
        });

        const updated = await getEligibilityState(convId);
        await clearEligibilityState(convId);
        assert.strictEqual(
          Number(updated?.applicant?.loanAmount),
          800000,
          `Expected loanAmount 800000 in state, got ${updated?.applicant?.loanAmount}`
        );
      }
    );

    // 3.6 Standalone Company Information Request: "Tell me about Infosys"
    await recordTest(
      "Conversational Baseline",
      "3.6 Company Information ('Tell me about Infosys')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_compinfo_${Date.now()}`;
        await clearEligibilityState(convId);
        const res = await runCentralAgent({
          conversationId: convId,
          message: "Tell me about Infosys",
        });
        await clearEligibilityState(convId);
        assert.ok(
          /matching companies|infosys limited|corporate intelligence/i.test(res.reply),
          `Expected company search results or intelligence, got: ${res.reply.slice(0, 150)}`
        );
      }
    );

    // 3.7 Bank Policy Request: "What is Axis Bank's personal loan policy?"
    await recordTest(
      "Conversational Baseline",
      "3.7 Bank Policy Query ('What is Axis Bank personal loan policy?')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_policy_${Date.now()}`;
        await clearEligibilityState(convId);
        const res = await runCentralAgent({
          conversationId: convId,
          message: "What is Axis Bank's personal loan policy?",
        });
        await clearEligibilityState(convId);
        assert.ok(
          /Axis Bank/i.test(res.reply),
          "Reply must mention Axis Bank"
        );
        assert.ok(
          /Criteria\s*\|\s*Details/i.test(res.reply),
          "Reply must contain 2-column Criteria | Details policy table"
        );
      }
    );

    // 3.8 Standalone EMI Calculation: "Calculate EMI for 800000"
    await recordTest(
      "Conversational Baseline",
      "3.8 EMI Calculation Request ('Calculate EMI for 800000')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_emicmd_${Date.now()}`;
        await clearEligibilityState(convId);
        const res = await runCentralAgent({
          conversationId: convId,
          message: "Calculate EMI for 800000",
        });
        await clearEligibilityState(convId);
        assert.ok(
          /EMI|tenure|interest|month/i.test(res.reply),
          `Expected EMI calculation or parameter inquiry, got: ${res.reply.slice(0, 150)}`
        );
      }
    );

    // 3.9 Bank Manager Lookup Flow: Preserving Bank and Listing Branches
    await recordTest(
      "Conversational Baseline",
      "3.9 Bank Manager Lookup Flow (Yes Bank in Pune)",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_mgr_${Date.now()}`;
        await clearEligibilityState(convId);
        // Step 1: User asks for bank policy or mentions bank
        const res1 = await runCentralAgent({
          conversationId: convId,
          message: "What is Yes Bank's policy?",
        });
        // Step 2: User asks to connect with manager in Pune
        const res2 = await runCentralAgent({
          conversationId: convId,
          message: "Show me Yes Bank managers in Pune",
          conversationHistory: [
            { role: "user", content: "What is Yes Bank's policy?" },
            { role: "assistant", content: res1.reply },
          ],
        });
        await clearEligibilityState(convId);
        assert.ok(
          /Yes Bank/i.test(res2.reply) && (/manager|branch/i.test(res2.reply)),
          `Expected manager/branch information for Yes Bank in Pune, got: ${res2.reply.slice(0, 150)}`
        );
      }
    );

    // 3.10 Ambiguous Number Guard ("The 76 Principle")
    await recordTest(
      "Conversational Baseline",
      "3.10 Ambiguous Number Guard: '76' when expected field is loanAmount",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_amb76_${Date.now()}`;
        await clearEligibilityState(convId);
        await saveEligibilityState(convId, {
          applicant: { companyName: "TCS", monthlyIncome: 60000 },
          expectedField: "loanAmount",
          in_eligibility_flow: true,
        });

        const res = await runCentralAgent({
          conversationId: convId,
          message: "76",
        });

        const stateAfter = await getEligibilityState(convId);
        await clearEligibilityState(convId);

        assert.notStrictEqual(
          Number(stateAfter?.applicant?.loanAmount),
          76,
          "Must NEVER set loanAmount to ₹76"
        );
        assert.ok(
          /clarify|specify|lakh/i.test(res.reply),
          `Must ask clarification for '76', got: ${res.reply.slice(0, 150)}`
        );
      }
    );

    // 3.11 Side Question Interruption ("What is FOIR?")
    await recordTest(
      "Conversational Baseline",
      "3.11 Conceptual Question Interruption ('What is FOIR?')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_foir_${Date.now()}`;
        await clearEligibilityState(convId);
        await saveEligibilityState(convId, {
          applicant: { companyName: "TCS" },
          expectedField: "monthlyIncome",
          in_eligibility_flow: true,
        });

        const res = await runCentralAgent({
          conversationId: convId,
          message: "What is FOIR?",
        });
        await clearEligibilityState(convId);

        assert.ok(
          /fixed obligation to income ratio|foir/i.test(res.reply),
          "Must explain FOIR accurately"
        );
      }
    );

    // =========================================================================
    // KNOWN BASELINE LIMITATIONS (Documenting current system failures)
    // These tests are expected to fail or reveal current architectural bottlenecks!
    // =========================================================================
    console.log("\n--- SUITE 4: Known Architectural Bottlenecks & Baseline Limitations ---");

    // 4.1 Out-of-order Multi-Entity Extraction in One Message
    await recordTest(
      "Known Limitation",
      "4.1 Compound Multi-Entity Extraction ('I am 28, work at TCS, earn 60k, 750 CIBIL, need 8L')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_multi_${Date.now()}`;
        await clearEligibilityState(convId);
        const res = await runCentralAgent({
          conversationId: convId,
          message: "I am 28, work at TCS, earn 60k, have a 750 CIBIL and need 8 lakh.",
        });
        const state = await getEligibilityState(convId);
        await clearEligibilityState(convId);

        console.log("      [4.1 State Recorded]:", JSON.stringify(state?.applicant || {}));
        console.log("      [4.1 Reply Sample]:", res.reply.slice(0, 120).replace(/\n/g, " "));

        // Check if all 5 entities are captured in applicant state
        const missingFields: string[] = [];
        if (!state?.applicant?.monthlyIncome) missingFields.push("monthlyIncome");
        if (!state?.applicant?.cibil) missingFields.push("cibil");
        if (!state?.applicant?.loanAmount) missingFields.push("loanAmount");
        if (!state?.applicant?.age) missingFields.push("age");

        if (missingFields.length > 0) {
          throw new Error(
            `Procedural waterfall captured only partial entities. Missing from state: ${missingFields.join(", ")}`
          );
        }
      },
      true // Mark as known existing limitation
    );

    // 4.2 Pausing Intake Flow: User says "Not now" at salary question
    await recordTest(
      "Known Limitation",
      "4.2 Workflow Pausing on Rejection ('Not now' at salary step)",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_pause_${Date.now()}`;
        await clearEligibilityState(convId);
        await saveEligibilityState(convId, {
          applicant: { companyName: "Infosys Limited" },
          expectedField: "monthlyIncome",
          in_eligibility_flow: true,
        });

        const res = await runCentralAgent({
          conversationId: convId,
          message: "Not now",
        });
        await clearEligibilityState(convId);

        // Current agent barks: "Just need a quick number for your monthly salary (like ₹50,000)"
        if (/just need a quick number for your monthly salary/i.test(res.reply)) {
          throw new Error(
            `Agent badgered user for salary despite explicit pause request ("Not now"): "${res.reply.trim()}"`
          );
        }
      },
      true // Mark as known existing limitation
    );

    // 4.3 Contextual Pronoun / Bank Follow-Up: "What about HDFC?"
    await recordTest(
      "Known Limitation",
      "4.3 Contextual Pronoun / Bank Follow-up ('What about HDFC?' post-evaluation)",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_hdfc_${Date.now()}`;
        await clearEligibilityState(convId);
        await saveEligibilityState(convId, {
          applicant: {
            companyName: "Infosys Limited",
            monthlyIncome: 80000,
            loanAmount: 1000000,
            tenureMonths: 60,
            cibil: 750,
            age: 28,
            existingEmi: 0,
          },
          evaluationCompleted: true,
          hasCompletedEvaluation: true,
          in_eligibility_flow: false,
        });

        const res = await runCentralAgent({
          conversationId: convId,
          message: "What about HDFC?",
        });
        await clearEligibilityState(convId);

        console.log("      [4.3 Reply Sample]:", res.reply.slice(0, 150).replace(/\n/g, " "));

        // Check whether HDFC bank policy or applicant evaluation at HDFC was provided
        if (!/HDFC/i.test(res.reply) || /could you please share selectedBank|momentarily busy/i.test(res.reply)) {
          throw new Error(
            `Agent failed to maintain contextual evaluation context for HDFC: "${res.reply.slice(0, 120).trim()}"`
          );
        }
      },
      true // Mark as known existing limitation
    );

    // 4.4 Mid-Turn Correction: "Actually I work at TCS"
    await recordTest(
      "Known Limitation",
      "4.4 Mid-Conversation Employer Correction ('Actually I work at TCS')",
      "CONVERSATIONAL_BASELINE",
      async () => {
        const convId = `phase0_corr_${Date.now()}`;
        await clearEligibilityState(convId);
        await saveEligibilityState(convId, {
          applicant: { companyName: "Infosys Limited" },
          expectedField: "monthlyIncome",
          in_eligibility_flow: true,
        });

        const res = await runCentralAgent({
          conversationId: convId,
          message: "Actually I work at TCS",
        });

        const updated = await getEligibilityState(convId);
        await clearEligibilityState(convId);

        if (!/tcs|tata consultancy/i.test(String(updated?.applicant?.companyName || "")) &&
            !/tcs|tata consultancy/i.test(res.reply)) {
          throw new Error(
            `Employer correction not applied. State companyName remains "${updated?.applicant?.companyName}"`
          );
        }
      },
      true // Mark as known existing limitation
    );

  } finally {
    client.release();
    await pool.end();
  }

  // ===========================================================================
  // SUMMARY REPORT GENERATION
  // ===========================================================================
  console.log("\n================================================================================");
  console.log("📊 PHASE 0 BASELINE EXECUTION SUMMARY");
  console.log("================================================================================");

  const passed = results.filter((r) => r.status === "PASS");
  const baselineFailures = results.filter((r) => r.status === "BASELINE_FAIL");
  const unexpectedFailures = results.filter((r) => r.status === "FAIL");

  console.log(`Total Tests Executed:     ${results.length}`);
  console.log(`Passed (Working Baseline): ${passed.length}`);
  console.log(`Known Baseline Failures:  ${baselineFailures.length}`);
  console.log(`Unexpected Regressions:   ${unexpectedFailures.length}`);
  console.log("--------------------------------------------------------------------------------");

  console.log("\n[1] PASSED FUNCTIONALITY (To Protect in Later Phases):");
  for (const r of passed) {
    console.log(`  ✓ [${r.category}] ${r.name}`);
  }

  if (baselineFailures.length > 0) {
    console.log("\n[2] CONFIRMED BASELINE LIMITATIONS / EXISTING ARCHITECTURAL BUGS:");
    for (const r of baselineFailures) {
      console.log(`  ⚠️  [${r.name}] -> ${r.details}`);
    }
  }

  if (unexpectedFailures.length > 0) {
    console.log("\n[3] UNEXPECTED FAILURES (MUST INVESTIGATE BEFORE PROCEEDING):");
    for (const r of unexpectedFailures) {
      console.log(`  ❌ [${r.name}] -> ${r.details}`);
    }
  }

  console.log("================================================================================\n");

  if (unexpectedFailures.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase0BaselineSuite().catch((err) => {
  console.error("Fatal error during Phase 0 test suite execution:", err);
  process.exit(1);
});
