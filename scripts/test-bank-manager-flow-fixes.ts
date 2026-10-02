import assert from "node:assert";
import { runCentralAgent } from "../lib/ai/agent";
import { saveEligibilityState } from "../lib/dynamicEligibilityEngine";
import pool from "../lib/db";

async function setupEligibleSession(conversationId: string) {
  await saveEligibilityState(conversationId, {
    applicant: {
      companyName: "Infosys",
      monthlyIncome: 85000,
      loanAmount: 500000,
      tenureMonths: 36,
      cibil: 750,
      existingEmi: 0,
      age: 30,
    },
    hasCompletedEvaluation: true,
    evaluationCompleted: true,
    eligible_banks: ["Bandhan Bank", "HDFC Bank", "ICICI Bank", "Tata Capital"],
    topBank: "Bandhan Bank",
    postEligibilityStage: "ELIGIBILITY_CONFIRMED",
    expectedField: "selectedBank",
    currentStep: "BANK_SELECTION",
    updatedAt: Date.now(),
  } as any);
}

async function runTests() {
  console.log("=================================================");
  console.log("RUNNING BANK MANAGER SEARCH FLOW TESTS");
  console.log("=================================================\n");

  // TEST 1: City-only user input
  // User: Bandhan Bank -> User: Pune
  // Expected: Database branch search: Available Bandhan Bank branches in Pune
  console.log("--- TEST 1: City-only User Input ---");
  const cid1 = `test_flow_1_${Date.now()}`;
  await setupEligibleSession(cid1);
  const r1_bank = await runCentralAgent({ conversationId: cid1, message: "Bandhan Bank" });
  console.log("User: Bandhan Bank");
  console.log("Assistant:", r1_bank.reply);
  assert.ok(r1_bank.reply.includes("Bandhan Bank"), "Must acknowledge Bandhan Bank");

  const r1_city = await runCentralAgent({ conversationId: cid1, message: "Pune" });
  console.log("User: Pune");
  console.log("Assistant:", r1_city.reply);
  assert.ok(
    r1_city.reply.includes("Available Bandhan Bank branches in Pune") || r1_city.reply.includes("Please select a branch"),
    "Must search database and show available branches in Pune"
  );
  console.log("✅ TEST 1 PASSED!\n");

  // TEST 2: City + Valid Pincode (411009)
  // User: Bandhan Bank -> User: Pune -> User: 411009
  // Expected: Exact manager records for Pune with pincode 411009
  console.log("--- TEST 2: City + Pincode 411009 ---");
  const cid2 = `test_flow_2_${Date.now()}`;
  await setupEligibleSession(cid2);
  await runCentralAgent({ conversationId: cid2, message: "Bandhan Bank" });
  await runCentralAgent({ conversationId: cid2, message: "Pune" });
  const r2_pin = await runCentralAgent({ conversationId: cid2, message: "411009" });
  console.log("User: 411009");
  console.log("Assistant:\n", r2_pin.reply);

  assert.ok(r2_pin.reply.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"), "Must contain exact 6-column header");
  assert.ok(r2_pin.reply.includes("Arun Sharma"), "Must contain Arun Sharma");
  assert.ok(r2_pin.reply.includes("9983113999"), "Must contain phone number 9983113999");
  assert.ok(r2_pin.reply.includes("411009"), "Must contain pincode 411009 in table");
  assert.ok(r2_pin.reply.includes("Pune"), "Must contain Pune in table");
  assert.ok(r2_pin.reply.includes("Application process initiated for Bandhan Bank in Pune, Maharashtra."), "Must contain proper application message");
  console.log("✅ TEST 2 PASSED!\n");

  // TEST 3: City + Non-existent Pincode (999999)
  // User: Bandhan Bank -> User: Pune -> User: 999999
  // Expected: No exact record -> show actual available Pune branches without fabricating data
  console.log("--- TEST 3: City + Non-existent Pincode 999999 ---");
  const cid3 = `test_flow_3_${Date.now()}`;
  await setupEligibleSession(cid3);
  await runCentralAgent({ conversationId: cid3, message: "Bandhan Bank" });
  await runCentralAgent({ conversationId: cid3, message: "Pune" });
  const r3_pin = await runCentralAgent({ conversationId: cid3, message: "999999" });
  console.log("User: 999999");
  console.log("Assistant:\n", r3_pin.reply);

  assert.ok(r3_pin.reply.includes("Available Bandhan Bank branches in Pune") || r3_pin.reply.includes("Please select a branch"), "Must offer available Pune branches");
  console.log("✅ TEST 3 PASSED!\n");

  // TEST 4: City + Branch (Katraj)
  // User: Bandhan Bank -> User: Pune -> User: Katraj
  // Expected: Search actual Katraj branch, if not present report no manager record found
  console.log("--- TEST 4: City + Branch (Katraj) ---");
  const cid4 = `test_flow_4_${Date.now()}`;
  await setupEligibleSession(cid4);
  await runCentralAgent({ conversationId: cid4, message: "Bandhan Bank" });
  await runCentralAgent({ conversationId: cid4, message: "Pune" });
  const r4_branch = await runCentralAgent({ conversationId: cid4, message: "Katraj" });
  console.log("User: Katraj");
  console.log("Assistant:\n", r4_branch.reply);

  assert.ok(
    r4_branch.reply.includes("Katraj") &&
    (r4_branch.reply.includes("couldn't find") || r4_branch.reply.includes("| Bank | Branch | City |")),
    "Must search Katraj and gracefully report if Katraj manager not found"
  );
  console.log("✅ TEST 4 PASSED!\n");

  // TEST 5: Verify Table Columns & Value Alignment
  console.log("--- TEST 5: Column Mapping Verification ---");
  const lines = r2_pin.reply.split("\n");
  const tableRows = lines.filter((l: string) => l.startsWith("|") && !l.includes("---") && !l.includes("Bank | Branch"));
  console.log("Sample row:", tableRows[0]);

  // Parse columns: | Bank | Branch | City | Pincode | Manager Name | Contact |
  const cols = tableRows[0].split("|").map((c: string) => c.trim()).filter(Boolean);
  assert.strictEqual(cols.length, 6, "Must have exactly 6 columns");
  assert.strictEqual(cols[0], "Bandhan Bank", "Column 0 must be Bank");
  assert.ok(cols[1].includes("Branch") || cols[1] === "Pune", "Column 1 must be Branch");
  assert.strictEqual(cols[2], "Pune", "Column 2 (City) must be Pune, NOT manager name");
  assert.strictEqual(cols[3], "411009", "Column 3 (Pincode) must be 411009, NOT phone");
  assert.strictEqual(cols[4], "Arun Sharma", "Column 4 (Manager Name) must be Arun Sharma");
  assert.strictEqual(cols[5], "9983113999", "Column 5 (Contact) must be 9983113999");

  // Verify missing contact row
  const missingContactRow = tableRows.find((r: string) => r.includes("Jiteh Dayani"));
  if (missingContactRow) {
    const mCols = missingContactRow.split("|").map((c: string) => c.trim()).filter(Boolean);
    assert.strictEqual(mCols[5], "Not available", "Missing contact must show 'Not available'");
    console.log("Missing contact row verified:", missingContactRow);
  }
  console.log("✅ TEST 5 PASSED!\n");

  // TEST 6: Available Branches Discovery (Section 8)
  console.log("--- TEST 6: Available Branches Discovery (Section 8) ---");
  const r6_discovery = await runCentralAgent({
    conversationId: cid1,
    message: "What branches are available?",
    conversationHistory: [],
    model: "gemini-2.5-flash",
  });
  console.log("User: What branches are available?");
  console.log("Assistant:\n", r6_discovery.reply);
  assert.ok(
    r6_discovery.reply.includes("Available Bandhan Bank branches in Pune") ||
    r6_discovery.reply.includes("Available **Bandhan Bank** branches in Pune"),
    "Must display available Bandhan Bank branches in Pune"
  );
  assert.ok(
    r6_discovery.reply.includes("Please select a branch to view the bank manager details") ||
    r6_discovery.reply.includes("Please select a branch to view manager details") ||
    r6_discovery.reply.includes("Please select a branch"),
    "Must ask user to select a branch"
  );
  console.log("✅ TEST 6 PASSED!\n");

  // TEST 7: Branch Selection (Section 9)
  console.log("--- TEST 7: Branch Selection (Section 9) ---");
  const r7_select = await runCentralAgent({
    conversationId: cid1,
    message: "1",
    conversationHistory: [],
    model: "gemini-2.5-flash",
  });
  console.log("User: 1");
  console.log("Assistant:\n", r7_select.reply);
  assert.ok(r7_select.reply.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"), "Must return 6-column table");
  assert.ok(r7_select.reply.includes("Bandhan Bank"), "Must include Bandhan Bank");
  assert.ok(r7_select.reply.includes("Application process initiated for Bandhan Bank"), "Must include application message");
  console.log("✅ TEST 7 PASSED!\n");

  console.log("=================================================");
  console.log("ALL REQUIRED BANK MANAGER SEARCH TESTS PASSED!");
  console.log("=================================================");
}

runTests()
  .then(() => pool.end())
  .catch((err) => {
    console.error("Test failure:", err);
    pool.end();
    process.exit(1);
  });

