// scripts/phase1-state-test-suite.ts
/**
 * CreditWise AI Smart Assistant Upgrade - Phase 1 State Management Test Suite
 *
 * Tests:
 * 1. State creation
 * 2. State retrieval
 * 3. State update
 * 4. State persistence (PostgreSQL)
 * 5. State restoration (reloading from DB with memory cache cleared)
 * 6. State isolation between conversations (Conv A vs Conv B)
 * 7. New conversation reset (clean wipe)
 * 8. Applicant state persistence (all 7 required fields preserved)
 * 9. Active task persistence & stack suspension/resumption
 * 10. Safe state-merge (partial updates do NOT overwrite unrelated attributes)
 */

import assert from "assert";
import pool from "../lib/db";
import {
  getConversationContext,
  updateConversationState,
  resetConversationState,
  suspendActiveTask,
  resumeInterruptedTask,
  safeMergeApplicantProfile,
  createDefaultSessionState,
} from "../lib/ai/contextBuilder";
import { inMemorySessionStates, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

interface TestOutcome {
  id: number;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const outcomes: TestOutcome[] = [];

async function runTestCase(id: number, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    outcomes.push({ id, name, passed: true, durationMs });
    console.log(`  ✅ Test ${id} PASSED: ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    outcomes.push({ id, name, passed: false, error: err?.message || String(err), durationMs });
    console.error(`  ❌ Test ${id} FAILED: ${name}`);
    console.error(`     Error: ${err?.message || err}`);
  }
}

async function runPhase1Suite() {
  console.log("================================================================================");
  console.log("🧪 CREDITWISE AI: PHASE 1 STATE OWNERSHIP & CONTEXT TEST SUITE");
  console.log("================================================================================\n");

  const client = await pool.connect();
  const testUserId = 2;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: State Creation
    // -------------------------------------------------------------------------
    await runTestCase(1, "Clean State Creation for New Conversation", async () => {
      const convId = `p1_create_${Date.now()}`;
      await clearEligibilityState(convId);

      const ctx = await getConversationContext(convId);
      assert.strictEqual(ctx.conversationId, convId, "Context conversationId must match");
      assert.ok(ctx.state, "Context must contain state");
      assert.ok(ctx.applicant, "Context must contain applicant");
      assert.strictEqual(ctx.applicant.loanType, "Personal Loan", "Default loanType should be Personal Loan");
      assert.strictEqual(ctx.isNewSession, true, "Fresh conversation should be marked isNewSession=true");
      assert.strictEqual(ctx.taskStack.length, 0, "Initial taskStack must be empty");
      assert.strictEqual(ctx.hasInterruptedTask(), false, "hasInterruptedTask must be false");

      await clearEligibilityState(convId);
    });

    // -------------------------------------------------------------------------
    // TEST 2: State Retrieval
    // -------------------------------------------------------------------------
    await runTestCase(2, "State Retrieval via getConversationContext", async () => {
      const convId = `p1_retrieve_${Date.now()}`;
      await clearEligibilityState(convId);

      await updateConversationState(convId, {
        applicantUpdates: {
          companyName: "Infosys Limited",
          monthlyIncome: 80000,
        },
        conversationUpdates: {
          currentTopic: "LOAN_ELIGIBILITY",
          summary: "User started loan intake for Infosys.",
        },
      });

      const ctx = await getConversationContext(convId);
      assert.strictEqual(ctx.applicant.companyName, "Infosys Limited", "Applicant company must be retrieved");
      assert.strictEqual(ctx.applicant.monthlyIncome, 80000, "Applicant monthlyIncome must be retrieved");
      assert.strictEqual(ctx.currentTopic, "LOAN_ELIGIBILITY", "Current topic must be retrieved");
      assert.strictEqual(ctx.summary, "User started loan intake for Infosys.", "Summary must be retrieved");

      const known = ctx.getKnownFields();
      assert.ok(known.some((k) => k.field === "companyName" && k.value === "Infosys Limited"));
      assert.ok(known.some((k) => k.field === "monthlyIncome" && k.value === 80000));

      await clearEligibilityState(convId);
    });

    // -------------------------------------------------------------------------
    // TEST 3: State Update
    // -------------------------------------------------------------------------
    await runTestCase(3, "Atomic State Update via updateConversationState", async () => {
      const convId = `p1_update_${Date.now()}`;
      await clearEligibilityState(convId);

      // Step A: Set initial values
      await updateConversationState(convId, {
        applicantUpdates: { companyName: "Tata Consultancy Services" },
      });

      // Step B: Update task and salary
      const updated = await updateConversationState(convId, {
        applicantUpdates: { monthlyIncome: 75000 },
        taskUpdates: {
          taskType: "LOAN_ELIGIBILITY",
          status: "WAITING_USER_INPUT",
          expectedField: "loanAmount",
        },
      });

      assert.strictEqual(updated.applicant.companyName, "Tata Consultancy Services", "Company must be preserved");
      assert.strictEqual(updated.applicant.monthlyIncome, 75000, "Salary must be updated");
      assert.strictEqual(updated.activeTask?.taskType, "LOAN_ELIGIBILITY", "Task type must match");
      assert.strictEqual(updated.activeTask?.expectedField, "loanAmount", "Expected field must match");
      assert.strictEqual(updated.expectedField, "loanAmount", "Legacy expectedField must be synchronized");

      await clearEligibilityState(convId);
    });

    // -------------------------------------------------------------------------
    // TEST 4: State Persistence to PostgreSQL
    // -------------------------------------------------------------------------
    await runTestCase(4, "State Persistence to PostgreSQL Table assistant_conversation_states", async () => {
      // Create a valid integer conversation in assistant_conversations
      const convRes = await client.query(
        `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'P1 Persist Test') RETURNING id`,
        [testUserId]
      );
      const numConvId = Number(convRes.rows[0].id);
      const convIdStr = String(numConvId);

      await updateConversationState(convIdStr, {
        applicantUpdates: {
          companyName: "Google India",
          monthlyIncome: 150000,
          cibil: 780,
        },
        taskUpdates: {
          taskType: "LOAN_ELIGIBILITY",
          status: "IN_PROGRESS",
          selectedEntity: "Google India",
        },
      });

      // Verify row in assistant_conversation_states table directly with SQL
      const dbRow = await client.query(
        `SELECT state, expires_at FROM assistant_conversation_states WHERE conversation_id = $1`,
        [numConvId]
      );
      assert.strictEqual(dbRow.rowCount, 1, "Must find exactly 1 row in assistant_conversation_states");
      assert.strictEqual(dbRow.rows[0].state.applicant.companyName, "Google India");
      assert.strictEqual(dbRow.rows[0].state.applicant.monthlyIncome, 150000);
      assert.strictEqual(dbRow.rows[0].state.applicant.cibil, 780);

      // Cleanup
      await client.query(`DELETE FROM assistant_conversations WHERE id = $1`, [numConvId]);
      await clearEligibilityState(convIdStr);
    });

    // -------------------------------------------------------------------------
    // TEST 5: State Restoration (Clearing In-Memory Cache)
    // -------------------------------------------------------------------------
    await runTestCase(5, "State Restoration from DB After In-Memory Cache Eviction", async () => {
      const convRes = await client.query(
        `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'P1 Cache Evict Test') RETURNING id`,
        [testUserId]
      );
      const numConvId = Number(convRes.rows[0].id);
      const convIdStr = String(numConvId);

      await updateConversationState(convIdStr, {
        applicantUpdates: {
          companyName: "Microsoft India",
          monthlyIncome: 180000,
          loanAmount: 1500000,
          tenureMonths: 48,
          cibil: 810,
        },
        conversationUpdates: {
          currentTopic: "LOAN_ELIGIBILITY",
          summary: "Customer looking for high-ticket loan.",
        },
      });

      // Simulate cold restart: Purge inMemorySessionStates completely
      inMemorySessionStates.delete(convIdStr);
      assert.strictEqual(inMemorySessionStates.has(convIdStr), false, "In-memory cache must be evicted");

      // Reload via getConversationContext
      const restoredCtx = await getConversationContext(convIdStr);
      assert.strictEqual(restoredCtx.applicant.companyName, "Microsoft India", "Company restored from DB");
      assert.strictEqual(restoredCtx.applicant.monthlyIncome, 180000, "Salary restored from DB");
      assert.strictEqual(restoredCtx.applicant.loanAmount, 1500000, "Loan amount restored from DB");
      assert.strictEqual(restoredCtx.applicant.cibil, 810, "CIBIL restored from DB");
      assert.strictEqual(restoredCtx.summary, "Customer looking for high-ticket loan.", "Summary restored from DB");

      // Cleanup
      await client.query(`DELETE FROM assistant_conversations WHERE id = $1`, [numConvId]);
      await clearEligibilityState(convIdStr);
    });

    // -------------------------------------------------------------------------
    // TEST 6: Strict State Isolation Between Conversations (Conv A vs Conv B)
    // -------------------------------------------------------------------------
    await runTestCase(6, "Strict State Isolation Between Conversation A and Conversation B", async () => {
      const resA = await client.query(
        `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Chat A') RETURNING id`,
        [testUserId]
      );
      const resB = await client.query(
        `INSERT INTO assistant_conversations (user_id, title) VALUES ($1, 'Chat B') RETURNING id`,
        [testUserId]
      );
      const idA = String(resA.rows[0].id);
      const idB = String(resB.rows[0].id);

      // Session A: Infosys / ₹60,000
      await updateConversationState(idA, {
        applicantUpdates: {
          companyName: "Infosys",
          monthlyIncome: 60000,
        },
      });

      // Session B: TCS / ₹45,000
      await updateConversationState(idB, {
        applicantUpdates: {
          companyName: "TCS",
          monthlyIncome: 45000,
        },
      });

      // Verify Session A
      const ctxA = await getConversationContext(idA);
      assert.strictEqual(ctxA.applicant.companyName, "Infosys", "Conv A company must be Infosys");
      assert.strictEqual(ctxA.applicant.monthlyIncome, 60000, "Conv A salary must be 60000");

      // Verify Session B
      const ctxB = await getConversationContext(idB);
      assert.strictEqual(ctxB.applicant.companyName, "TCS", "Conv B company must be TCS");
      assert.strictEqual(ctxB.applicant.monthlyIncome, 45000, "Conv B salary must be 45000");

      // Ensure no bleed: Conv A has NOT become TCS or 45000
      assert.notStrictEqual(ctxA.applicant.companyName, ctxB.applicant.companyName);
      assert.notStrictEqual(ctxA.applicant.monthlyIncome, ctxB.applicant.monthlyIncome);

      // Cleanup
      await client.query(`DELETE FROM assistant_conversations WHERE id = $1`, [Number(idA)]);
      await client.query(`DELETE FROM assistant_conversations WHERE id = $1`, [Number(idB)]);
      await clearEligibilityState(idA);
      await clearEligibilityState(idB);
    });

    // -------------------------------------------------------------------------
    // TEST 7: New Conversation Reset
    // -------------------------------------------------------------------------
    await runTestCase(7, "New Conversation Reset (Zero State Carryover)", async () => {
      const convId = `p1_reset_${Date.now()}`;

      // Populate conversation with full profile
      await updateConversationState(convId, {
        applicantUpdates: {
          companyName: "Wipro",
          monthlyIncome: 55000,
          loanAmount: 600000,
          cibil: 740,
        },
        taskUpdates: {
          taskType: "LOAN_ELIGIBILITY",
          status: "IN_PROGRESS",
          expectedField: "tenureMonths",
        },
      });

      // Explicit reset
      await resetConversationState(convId);

      // Verify fresh state
      const cleanCtx = await getConversationContext(convId);
      assert.strictEqual(cleanCtx.applicant.companyName, undefined, "Company must be undefined after reset");
      assert.strictEqual(cleanCtx.applicant.monthlyIncome, undefined, "Monthly income must be undefined after reset");
      assert.strictEqual(cleanCtx.applicant.cibil, undefined, "CIBIL must be undefined after reset");
      assert.strictEqual(cleanCtx.activeTask, null, "Active task must be null after reset");
      assert.strictEqual(cleanCtx.taskStack.length, 0, "Task stack must be empty after reset");
    });

    // -------------------------------------------------------------------------
    // TEST 8: Full Applicant Profile Attributes Persistence
    // -------------------------------------------------------------------------
    await runTestCase(8, "Full 7 Required Applicant Attributes Persistence", async () => {
      const convId = `p1_full_${Date.now()}`;
      await clearEligibilityState(convId);

      await updateConversationState(convId, {
        applicantUpdates: {
          companyName: "HCL Technologies",
          monthlyIncome: 95000,
          loanAmount: 800000,
          tenureMonths: 60,
          cibil: 765,
          existingEmi: 12000,
          age: 31,
          employmentType: "Salaried",
          location: "Pune",
        },
      });

      const ctx = await getConversationContext(convId);
      assert.strictEqual(ctx.applicant.companyName, "HCL Technologies");
      assert.strictEqual(ctx.applicant.monthlyIncome, 95000);
      assert.strictEqual(ctx.applicant.loanAmount, 800000);
      assert.strictEqual(ctx.applicant.tenureMonths, 60);
      assert.strictEqual(ctx.applicant.cibil, 765);
      assert.strictEqual(ctx.applicant.existingEmi, 12000);
      assert.strictEqual(ctx.applicant.age, 31);
      assert.strictEqual(ctx.applicant.employmentType, "Salaried");
      assert.strictEqual(ctx.applicant.location, "Pune");

      // Verify missing fields is empty because all 7 required fields are present
      const missing = ctx.getMissingFields();
      assert.strictEqual(missing.length, 0, "All 7 required eligibility fields are satisfied");

      await clearEligibilityState(convId);
    });

    // -------------------------------------------------------------------------
    // TEST 9: Active Task Persistence & Suspension/Resumption
    // -------------------------------------------------------------------------
    await runTestCase(9, "Task State Management (Active Task, Suspension, and Resumption)", async () => {
      const convId = `p1_task_${Date.now()}`;
      await clearEligibilityState(convId);

      // Start loan eligibility task
      await updateConversationState(convId, {
        applicantUpdates: { companyName: "TCS", monthlyIncome: 60000 },
        taskUpdates: {
          taskType: "LOAN_ELIGIBILITY",
          status: "WAITING_USER_INPUT",
          expectedField: "loanAmount",
        },
      });

      // Suspend loan eligibility task (e.g. user interrupts with side question)
      await suspendActiveTask(convId, "Interrupted by user asking about Axis Bank policy");

      const pausedCtx = await getConversationContext(convId);
      assert.strictEqual(pausedCtx.hasInterruptedTask(), true, "Should record interrupted task");
      assert.strictEqual(pausedCtx.taskStack.length, 1, "Task stack length should be 1");
      const suspended = pausedCtx.getInterruptedTask();
      assert.strictEqual(suspended?.taskType, "LOAN_ELIGIBILITY");
      assert.strictEqual(suspended?.expectedField, "loanAmount");
      assert.strictEqual(suspended?.applicantSnapshot.companyName, "TCS");

      // Resume loan eligibility task
      const { resumedTask } = await resumeInterruptedTask(convId);
      assert.ok(resumedTask, "Must return resumed task");
      assert.strictEqual(resumedTask?.taskType, "LOAN_ELIGIBILITY");

      const resumedCtx = await getConversationContext(convId);
      assert.strictEqual(resumedCtx.activeTask?.taskType, "LOAN_ELIGIBILITY");
      assert.strictEqual(resumedCtx.activeTask?.expectedField, "loanAmount");
      assert.strictEqual(resumedCtx.taskStack.length, 0, "Task stack should be empty after resumption");

      await clearEligibilityState(convId);
    });

    // -------------------------------------------------------------------------
    // TEST 10: Safe State-Merge (No Accidental Overwrites)
    // -------------------------------------------------------------------------
    await runTestCase(10, "Safe State-Merge (Partial updates never overwrite existing attributes)", async () => {
      const convId = `p1_safemerge_${Date.now()}`;
      await clearEligibilityState(convId);

      // 1. Initial State: company = "Infosys", salary = 60000, cibil = 750
      await updateConversationState(convId, {
        applicantUpdates: {
          companyName: "Infosys",
          monthlyIncome: 60000,
          cibil: 750,
        },
      });

      // 2. Partial update: only salary = 65000
      await updateConversationState(convId, {
        applicantUpdates: {
          monthlyIncome: 65000,
        },
      });

      let ctx = await getConversationContext(convId);
      assert.strictEqual(ctx.applicant.companyName, "Infosys", "companyName must NOT be wiped when salary updates");
      assert.strictEqual(ctx.applicant.monthlyIncome, 65000, "salary must be updated to 65000");
      assert.strictEqual(ctx.applicant.cibil, 750, "cibil must NOT be wiped when salary updates");

      // 3. Second partial update: only cibil = 780
      await updateConversationState(convId, {
        applicantUpdates: {
          cibil: 780,
        },
      });

      ctx = await getConversationContext(convId);
      assert.strictEqual(ctx.applicant.companyName, "Infosys", "companyName must remain Infosys");
      assert.strictEqual(ctx.applicant.monthlyIncome, 65000, "salary must remain 65000");
      assert.strictEqual(ctx.applicant.cibil, 780, "cibil must be updated to 780");

      // 4. Unit check on safeMergeApplicantProfile helper directly
      const merged = safeMergeApplicantProfile(
        { companyName: "Infosys", monthlyIncome: 60000, cibil: 750 },
        { monthlyIncome: 70000 }
      );
      assert.strictEqual(merged.companyName, "Infosys");
      assert.strictEqual(merged.monthlyIncome, 70000);
      assert.strictEqual(merged.cibil, 750);

      await clearEligibilityState(convId);
    });

  } finally {
    client.release();
    await pool.end();
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("📊 PHASE 1 STATE MANAGEMENT TEST SUMMARY");
  console.log("================================================================================");

  const passed = outcomes.filter((o) => o.passed);
  const failed = outcomes.filter((o) => !o.passed);

  console.log(`Total Phase 1 Tests: ${outcomes.length}`);
  console.log(`Passed:              ${passed.length}`);
  console.log(`Failed:              ${failed.length}`);
  console.log("--------------------------------------------------------------------------------");

  if (failed.length > 0) {
    console.error("❌ Some Phase 1 tests failed:");
    for (const f of failed) {
      console.error(`  - Test ${f.id} (${f.name}): ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log("🎉 ALL 10 PHASE 1 STATE MANAGEMENT TESTS PASSED PERFECTLY!");
    console.log("================================================================================\n");
    process.exit(0);
  }
}

runPhase1Suite().catch((err) => {
  console.error("Fatal error during Phase 1 test suite execution:", err);
  process.exit(1);
});
