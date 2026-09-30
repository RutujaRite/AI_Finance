import assert from "node:assert";
import pool from "../lib/db";
import {
  searchBankManager,
  findBankBranches,
  getUniqueBranches,
  getUniqueManagerRecords,
  formatBankManagersTable,
  BankManagerRecord,
} from "../lib/bankSearch";
import {
  extractBankBranchLocationParams,
  reconcileBankManagerEntities,
  BankManagerSearchEntities,
} from "../lib/dynamicEligibilityEngine";

async function verifyCompleteBankManagerFlow() {
  console.log("================================================================================");
  console.log("COMPREHENSIVE VERIFICATION: BANK MANAGER ACCESS LOGIC BY BANK, BRANCH & LOCATION");
  console.log("================================================================================\n");

  const client = await pool.connect();
  try {
    // -------------------------------------------------------------------------
    // STEP 1: Entity Extraction & Reconciliation Logic (Turn by Turn)
    // -------------------------------------------------------------------------
    console.log("--- STEP 1: Multi-Turn Entity Extraction & Reconciliation ---");

    // Turn 1: User indicates preferred bank
    console.log("Turn 1: User says: 'I want to go with Bandhan Bank'");
    const t1Extracted = extractBankBranchLocationParams("I want to go with Bandhan Bank");
    console.log("  Extracted:", t1Extracted);
    assert.strictEqual(t1Extracted.bankName, "Bandhan Bank");

    let sessionEntities: BankManagerSearchEntities = reconcileBankManagerEntities(null, t1Extracted);
    console.log("  Reconciled session entities:", sessionEntities);
    assert.strictEqual(sessionEntities.bank_name, "Bandhan Bank");

    // Turn 2: User provides preferred location / city
    console.log("\nTurn 2: User says: 'I am based in Pune'");
    const t2Extracted = extractBankBranchLocationParams("I am based in Pune", sessionEntities.bank_name);
    console.log("  Extracted:", t2Extracted);
    assert.strictEqual(t2Extracted.city, "Pune");

    sessionEntities = reconcileBankManagerEntities(sessionEntities, t2Extracted);
    console.log("  Reconciled session entities (Bank preserved + City added):", sessionEntities);
    assert.strictEqual(sessionEntities.bank_name, "Bandhan Bank", "Bank MUST be preserved");
    assert.strictEqual(sessionEntities.city, "Pune", "City MUST be updated to Pune");

    // Turn 2 Branch Discovery from DB
    console.log("\nTurn 2b: System discovers available branches in DB for Bandhan Bank in Pune");
    const discoveredBranches = await findBankBranches(sessionEntities.bank_name!, sessionEntities.city!);
    console.log("  Available branches:", discoveredBranches);
    assert.ok(discoveredBranches.length > 0, "Must find branches in Pune");
    const chosenBranch = discoveredBranches[0];

    // Turn 3: User chooses branch (e.g. "1" or branch name)
    console.log(`\nTurn 3: User chooses branch: '${chosenBranch}'`);
    const t3Extracted = extractBankBranchLocationParams(chosenBranch, sessionEntities.bank_name, undefined, "branchSelection", sessionEntities.city);
    console.log("  Extracted:", t3Extracted);

    sessionEntities = reconcileBankManagerEntities(sessionEntities, { ...t3Extracted, branch: chosenBranch });
    console.log("  Reconciled session entities (Bank + City + Branch complete):", sessionEntities);
    assert.strictEqual(sessionEntities.bank_name, "Bandhan Bank");
    assert.strictEqual(sessionEntities.city, "Pune");
    assert.strictEqual(sessionEntities.branch, chosenBranch);
    console.log("✅ Step 1: Multi-turn entity extraction & reconciliation passed!\n");

    // -------------------------------------------------------------------------
    // STEP 2: Database Query with (Bank + Branch + Location)
    // -------------------------------------------------------------------------
    console.log("--- STEP 2: Database Query for Bank Manager Contact Details ---");
    const managers = await searchBankManager({
      bank_name: sessionEntities.bank_name,
      city: sessionEntities.city,
      branch_name: sessionEntities.branch,
    });

    console.log(`Query returned ${managers.length} manager records from PostgreSQL.`);
    assert.ok(managers.length > 0, "Must return manager records for chosen bank, branch, and city");

    for (const m of managers) {
      console.log(`  • ID ${m.id} | Bank: ${m.bank_name} | Name: ${m.name} | Phone: ${m.phone} | Email: ${m.email} | City: ${m.city} | Branch/Loc: ${m.branch || m.location}`);
      assert.ok(m.bank_name.toLowerCase().includes("bandhan"), "Bank name must match Bandhan");
      assert.ok(m.name && m.name.length > 0, "Manager name must not be empty");
      assert.ok(m.phone !== undefined, "Phone field must be defined");
    }
    console.log("✅ Step 2: Database query logic passed!\n");

    // -------------------------------------------------------------------------
    // STEP 3: Formatting & Deduplication into 6-Column Display Table
    // -------------------------------------------------------------------------
    console.log("--- STEP 3: 6-Column Table Formatting & Sanitization ---");
    const tableMarkdown = formatBankManagersTable(managers, {
      userCity: sessionEntities.city,
      userBranch: sessionEntities.branch,
    });

    console.log("Formatted Table:\n" + tableMarkdown);

    // Verify Table Requirements:
    assert.ok(tableMarkdown.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"), "Header must match exactly");
    const rows = tableMarkdown.trim().split("\n").slice(2);
    assert.ok(rows.length > 0, "Must have data rows");

    for (const row of rows) {
      const cols = row.split("|").map((c) => c.trim()).filter(Boolean);
      assert.strictEqual(cols.length, 6, "Every row must have exactly 6 columns");
      assert.strictEqual(cols[0], "Bandhan Bank", "Column 0 must be Bank");
      assert.ok(cols[1].length > 0 && cols[1] !== "undefined", "Column 1 (Branch) must be valid");
      assert.strictEqual(cols[2], "Pune", "Column 2 (City) must be Pune");
      assert.ok(cols[3].length > 0, "Column 3 (Pincode) must be valid or 'Not available'");
      assert.ok(cols[4].length > 0, "Column 4 (Manager Name) must be valid");
      assert.ok(cols[5].length > 0, "Column 5 (Contact) must be valid or 'Not available'");
    }
    console.log("✅ Step 3: Table formatting passed!\n");

    // -------------------------------------------------------------------------
    // STEP 4: City Switch / Correction Isolation
    // -------------------------------------------------------------------------
    console.log("--- STEP 4: User Switches Location (e.g. Pune -> Mumbai) ---");
    console.log("User says: 'Actually switch my location to Mumbai'");
    const switchExtracted = extractBankBranchLocationParams("Actually switch my location to Mumbai", sessionEntities.bank_name);
    console.log("  Extracted switch:", switchExtracted);
    assert.strictEqual(switchExtracted.city, "Mumbai");
    assert.strictEqual(switchExtracted.isCorrection, true);

    const switchedEntities = reconcileBankManagerEntities(sessionEntities, switchExtracted);
    console.log("  Reconciled switched entities:", switchedEntities);
    assert.strictEqual(switchedEntities.bank_name, "Bandhan Bank", "Bank MUST still be preserved");
    assert.strictEqual(switchedEntities.city, "Mumbai", "City MUST update to Mumbai");
    assert.strictEqual(switchedEntities.branch, undefined, "Old Pune branch MUST be invalidated");

    // Query Mumbai branches for Bandhan Bank
    const mumbaiBranches = await findBankBranches(switchedEntities.bank_name!, switchedEntities.city!);
    console.log("  Bandhan Bank branches in Mumbai:", mumbaiBranches);
    assert.ok(mumbaiBranches.length > 0, "Must find branches in Mumbai");
    assert.ok(!mumbaiBranches.includes("Pune"), "Mumbai branches must NOT contain Pune");
    console.log("✅ Step 4: Location switch & entity isolation passed!\n");

    // -------------------------------------------------------------------------
    // STEP 5: Bank Switch Isolation
    // -------------------------------------------------------------------------
    console.log("--- STEP 5: User Switches Bank (e.g. Bandhan Bank -> ICICI Bank) ---");
    console.log("User says: 'Change bank to ICICI Bank'");
    const bankSwitchExtracted = extractBankBranchLocationParams("Change bank to ICICI Bank");
    console.log("  Extracted bank switch:", bankSwitchExtracted);
    assert.strictEqual(bankSwitchExtracted.bankName, "ICICI Bank");

    const bankSwitchedEntities = reconcileBankManagerEntities(switchedEntities, bankSwitchExtracted);
    console.log("  Reconciled bank switch entities:", bankSwitchedEntities);
    assert.strictEqual(bankSwitchedEntities.bank_name, "ICICI Bank", "Bank MUST update to ICICI Bank");
    assert.strictEqual(bankSwitchedEntities.city, "Mumbai", "City Mumbai MUST be preserved");
    assert.strictEqual(bankSwitchedEntities.branch, undefined, "Old branch MUST be invalidated");

    const iciciMumbaiMgrs = await searchBankManager({
      bank_name: bankSwitchedEntities.bank_name,
      city: bankSwitchedEntities.city,
    });
    console.log(`  Found ${iciciMumbaiMgrs.length} ICICI Bank managers in Mumbai.`);
    assert.ok(iciciMumbaiMgrs.length > 0, "Must find ICICI Bank managers in Mumbai");
    console.log("✅ Step 5: Bank switch isolation passed!\n");

    console.log("================================================================================");
    console.log("🎯 ALL TESTS PASSED: BANK MANAGER ACCESS LOGIC IS 100% OPERATIONAL & VERIFIED!");
    console.log("================================================================================");
  } finally {
    client.release();
    await pool.end();
  }
}

verifyCompleteBankManagerFlow().catch((err) => {
  console.error("FATAL ERROR in flow verification:", err);
  process.exit(1);
});
