import assert from "node:assert";
import { runCentralAgent } from "../lib/ai/agent";
import { saveEligibilityState } from "../lib/dynamicEligibilityEngine";
import { getUniqueBranches, getUniqueManagerRecords, formatBankManagersTable, findBankBranches, searchBankManager } from "../lib/bankSearch";
import pool from "../lib/db";

async function setupEligibleSession(conversationId: string, bank: string = "HDFC Bank") {
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
    eligible_banks: ["HDFC Bank", "ICICI Bank", "Bandhan Bank", "Tata Capital"],
    topBank: bank,
    postEligibilityStage: "ELIGIBILITY_CONFIRMED",
    expectedField: "selectedBank",
    currentStep: "BANK_SELECTION",
    updatedAt: Date.now(),
  } as any);
}

async function runDatabaseDrivenTests() {
  console.log("=================================================");
  console.log("TESTING 100% DATABASE-DRIVEN BANK MANAGER FLOW");
  console.log("=================================================\n");

  // TEST 1: Deduplication logic unit tests
  console.log("--- TEST 1: Unit Test getUniqueBranches ---");
  const duplicateBranches = ["Camp", "CAMP", "  Camp  ", "Deccan", "deccan", "Hadapsar"];
  const uniqueBranches = getUniqueBranches(duplicateBranches);
  console.log("Raw branches:", duplicateBranches);
  console.log("Unique branches:", uniqueBranches);
  assert.strictEqual(uniqueBranches.length, 3, "Must deduplicate case-insensitively and trimmed to 3 branches");
  assert.ok(uniqueBranches.includes("Camp"));
  assert.ok(uniqueBranches.includes("Deccan"));
  assert.ok(uniqueBranches.includes("Hadapsar"));
  console.log("✅ TEST 1 PASSED!\n");

  // TEST 2: Unit Test getUniqueManagerRecords across all 6 columns
  console.log("--- TEST 2: Unit Test getUniqueManagerRecords ---");
  const sampleManagers: any[] = [
    {
      bank_name: "HDFC Bank",
      branch: "Camp",
      city: "Pune",
      location: "Camp, Pune 411001",
      name: "John Doe",
      phone: "9876543210",
      extra_info: { pincode: "411001" },
    },
    // Exact duplicate
    {
      bank_name: "HDFC Bank",
      branch: "Camp",
      city: "Pune",
      location: "Camp, Pune 411001",
      name: "John Doe",
      phone: "9876543210",
      extra_info: { pincode: "411001" },
    },
    // Same name, different branch -> MUST NOT BE COLLAPSED
    {
      bank_name: "HDFC Bank",
      branch: "Deccan",
      city: "Pune",
      location: "Deccan, Pune 411004",
      name: "John Doe",
      phone: "9876543210",
      extra_info: { pincode: "411004" },
    },
    // Same branch, different contact -> MUST NOT BE COLLAPSED
    {
      bank_name: "HDFC Bank",
      branch: "Camp",
      city: "Pune",
      location: "Camp, Pune 411001",
      name: "Jane Smith",
      phone: "9123456780",
      extra_info: { pincode: "411001" },
    },
  ];

  const uniqueMgrs = getUniqueManagerRecords(sampleManagers);
  console.log("Raw managers count:", sampleManagers.length, "Unique managers count:", uniqueMgrs.length);
  assert.strictEqual(uniqueMgrs.length, 3, "Must only remove the exact duplicate across all 6 columns");
  console.log("✅ TEST 2 PASSED!\n");

  // TEST 3: Bank Selection prompts for city (pincode is NOT asked)
  console.log("--- TEST 3: User selects bank -> prompts for city ---");
  const cid1 = `db_test_turn1_${Date.now()}`;
  await setupEligibleSession(cid1);
  const r1 = await runCentralAgent({ conversationId: cid1, message: "HDFC Bank" });
  console.log("User: HDFC Bank");
  console.log("Assistant:\n", r1.reply);
  assert.ok(r1.reply.includes("HDFC Bank"), "Must mention HDFC Bank");
  assert.ok(/city/i.test(r1.reply), "Must ask for city");
  assert.ok(!/share your pincode/i.test(r1.reply), "Must not demand pincode");
  console.log("✅ TEST 3 PASSED!\n");

  // TEST 4: User provides city -> immediate DB query for branches, pincode NEVER asked
  console.log("--- TEST 4: User provides city 'Pune' -> immediate DB search for branches ---");
  const r2 = await runCentralAgent({ conversationId: cid1, message: "Pune" });
  console.log("User: Pune");
  console.log("Assistant:\n", r2.reply);
  assert.ok(r2.reply.includes("Available HDFC Bank branches in Pune"), "Must display branches header");
  assert.ok(r2.reply.includes("Please select a branch"), "Must prompt to select a branch");
  assert.ok(!/pincode/i.test(r2.reply), "Pincode is NEVER asked when city is provided");

  // Verify branches in reply actually exist in database
  const actualDbBranches = await findBankBranches("HDFC Bank", "Pune");
  console.log("Actual DB branches for HDFC Bank in Pune:", actualDbBranches);
  assert.ok(actualDbBranches.length > 0, "DB must have branches for HDFC Bank in Pune");
  for (const b of actualDbBranches.slice(0, 3)) {
    assert.ok(r2.reply.includes(b), `Reply must list DB branch: ${b}`);
  }
  console.log("✅ TEST 4 PASSED!\n");

  // TEST 5: User selects a valid branch from list -> DB query for bank+city+branch -> 6-column table
  console.log("--- TEST 5: User selects branch '1' -> 6-column manager table ---");
  const r3 = await runCentralAgent({ conversationId: cid1, message: "1" });
  console.log("User: 1");
  console.log("Assistant:\n", r3.reply);
  assert.ok(r3.reply.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"), "Must contain exact 6-column header");
  assert.ok(r3.reply.includes("HDFC Bank"), "Must contain HDFC Bank");
  assert.ok(r3.reply.includes("Pune"), "Must contain Pune");
  assert.ok(!r3.reply.includes("ICICI Bank"), "Must not leak other banks");
  console.log("✅ TEST 5 PASSED!\n");

  // TEST 6: User selects non-existent branch (e.g. 'Wakad') -> reports no record found
  console.log("--- TEST 6: Non-existent branch 'Wakad' -> no manager record found ---");
  const cid2 = `db_test_wakad_${Date.now()}`;
  await setupEligibleSession(cid2);
  await runCentralAgent({ conversationId: cid2, message: "HDFC Bank" });
  await runCentralAgent({ conversationId: cid2, message: "Pune" });
  const rWakad = await runCentralAgent({ conversationId: cid2, message: "Wakad" });
  console.log("User: Wakad");
  console.log("Assistant:\n", rWakad.reply);
  assert.ok(
    rWakad.reply.includes("I couldn't find an HDFC Bank manager record for the Wakad branch in Pune"),
    "Must report Wakad manager record not found without inventing or falling back"
  );
  assert.ok(!rWakad.reply.includes("| Bank | Branch | City |"), "Must not display manager table for missing branch");
  console.log("✅ TEST 6 PASSED!\n");

  // TEST 7: Invalid City -> reports no branches found in database
  console.log("--- TEST 7: Non-existent city 'AtlantisCity' -> no branch records found ---");
  const cid3 = `db_test_nocity_${Date.now()}`;
  await setupEligibleSession(cid3);
  await runCentralAgent({ conversationId: cid3, message: "HDFC Bank" });
  const rNoCity = await runCentralAgent({ conversationId: cid3, message: "AtlantisCity" });
  console.log("User: AtlantisCity");
  console.log("Assistant:\n", rNoCity.reply);
  assert.ok(
    rNoCity.reply.includes("I couldn't find any HDFC Bank branch records for AtlantisCity in the database"),
    "Must report 0 branch records found in database"
  );
  console.log("✅ TEST 7 PASSED!\n");

  console.log("=================================================");
  console.log("ALL 100% DATABASE-DRIVEN BANK MANAGER TESTS PASSED!");
  console.log("=================================================");
}

runDatabaseDrivenTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
