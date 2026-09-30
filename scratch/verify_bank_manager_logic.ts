import assert from "node:assert";
import pool from "../lib/db";
import {
  searchBankManager,
  findBankBranches,
  getUniqueBranches,
  getUniqueManagerRecords,
  formatBankManagersTable,
  extractPincode,
  BankManagerRecord,
} from "../lib/bankSearch";

async function main() {
  console.log("================================================================================");
  console.log("VERIFYING BANK MANAGER CONTACT DETAILS LOGIC (BANK + BRANCH + LOCATION)");
  console.log("================================================================================\n");

  const client = await pool.connect();
  try {
    // 1. Inspect Database State
    console.log("--- 1. DATABASE SCHEMA & DATA INSPECTION ---");
    const countRes = await client.query("SELECT COUNT(*) as total FROM bank_managers");
    console.log(`Total records in bank_managers table: ${countRes.rows[0].total}`);
    assert.ok(parseInt(countRes.rows[0].total, 10) > 0, "bank_managers table must not be empty");

    // Sample distinct banks
    const banksRes = await client.query(
      "SELECT bank_name, COUNT(*) as count FROM bank_managers GROUP BY bank_name ORDER BY count DESC LIMIT 5"
    );
    console.log("Top banks in DB with manager counts:", banksRes.rows);

    console.log("✅ Database inspection passed!\n");

    // 2. Test Branch Discovery via findBankBranches (Bank + Location)
    console.log("--- 2. BRANCH DISCOVERY (findBankBranches) ---");
    const puneBranches = await findBankBranches("Bandhan Bank", "Pune");
    console.log("Bandhan Bank branches in Pune:", puneBranches);
    assert.ok(Array.isArray(puneBranches), "Must return an array");
    assert.ok(puneBranches.length > 0, "Bandhan Bank must have branches in Pune");

    // Test case insensitivity
    const puneLower = await findBankBranches("bandhan bank", "pune");
    assert.deepStrictEqual(puneLower, puneBranches, "Search must be case-insensitive");

    // Test city isolation (e.g. Pune search should not return Mumbai branches)
    const hasMumbai = puneBranches.some((b) => /mumbai/i.test(b));
    assert.strictEqual(hasMumbai, false, "Pune branch results must NOT include Mumbai");
    console.log("✅ Branch discovery logic passed!\n");

    // 3. Test searchBankManager with Bank + Location
    console.log("--- 3. SEARCH BY BANK + LOCATION (searchBankManager) ---");
    const bandhanPuneMgrs = await searchBankManager({
      bank_name: "Bandhan Bank",
      city: "Pune",
    });
    console.log(`Found ${bandhanPuneMgrs.length} Bandhan Bank manager records in Pune.`);
    assert.ok(bandhanPuneMgrs.length > 0, "Must return managers for Bandhan Bank in Pune");
    for (const m of bandhanPuneMgrs) {
      assert.ok(
        m.bank_name.toLowerCase().includes("bandhan"),
        `Expected Bandhan Bank, got ${m.bank_name}`
      );
      const locText = `${m.location} ${m.city || ""} ${m.branch || ""}`.toLowerCase();
      assert.ok(
        locText.includes("pune") || locText.includes("maharashtra"),
        `Record should match Pune/Maharashtra: ${locText}`
      );
    }
    console.log("✅ Bank + Location search passed!\n");

    // 4. Test searchBankManager with Bank + Location + Specific Branch
    console.log("--- 4. SEARCH BY BANK + LOCATION + SPECIFIC BRANCH ---");
    const testBranch = puneBranches[0];
    console.log(`Testing search for Bank: Bandhan Bank, City: Pune, Branch: ${testBranch}`);

    const branchMgrs = await searchBankManager({
      bank_name: "Bandhan Bank",
      city: "Pune",
      branch_name: testBranch,
    });
    console.log(`Found ${branchMgrs.length} records for branch "${testBranch}"`);
    assert.ok(branchMgrs.length > 0, "Must return manager record for matching branch");
    assert.ok(branchMgrs[0].name, "Manager name must exist");
    console.log(`Sample Manager: ${branchMgrs[0].name}, Phone: ${branchMgrs[0].phone}, Email: ${branchMgrs[0].email}`);
    console.log("✅ Bank + Location + Branch search passed!\n");

    // 5. Test searchBankManager with Bank + Pincode
    console.log("--- 5. SEARCH BY BANK + PINCODE ---");
    const pinMgrs = await searchBankManager({
      bank_name: "Bandhan Bank",
      pincode: "411009",
    });
    console.log(`Found ${pinMgrs.length} Bandhan Bank records for pincode 411009`);
    assert.ok(pinMgrs.length > 0, "Must find Bandhan Bank manager for pincode 411009");
    const pinRecord = pinMgrs[0];
    console.log(`Found manager: ${pinRecord.name}, Phone: ${pinRecord.phone}`);
    assert.ok(pinRecord.phone, "Manager must have contact number");
    console.log("✅ Bank + Pincode search passed!\n");

    // 6. Test Non-Existent Branch / Location Handling
    console.log("--- 6. NON-EXISTENT BRANCH / LOCATION (GRACEFUL HANDLING) ---");
    const ghostMgrs = await searchBankManager({
      bank_name: "Bandhan Bank",
      city: "NonExistentCityXYZ123",
      branch_name: "NonExistentBranch999",
    });
    console.log(`Non-existent search returned ${ghostMgrs.length} rows.`);
    assert.strictEqual(ghostMgrs.length, 0, "Must return empty array for non-existent branch/location");
    console.log("✅ Graceful handling of non-existent branches passed!\n");

    // 7. Test Table Formatting & Deduplication (formatBankManagersTable)
    console.log("--- 7. TABLE FORMATTING & DEDUPLICATION ---");
    const tableOutput = formatBankManagersTable(branchMgrs, {
      userCity: "Pune",
      userBranch: testBranch,
    });
    console.log("Generated Markdown Table Output:\n" + tableOutput);

    // Verify 6 columns
    assert.ok(
      tableOutput.includes("| Bank | Branch | City | Pincode | Manager Name | Contact |"),
      "Must have the standard 6-column header"
    );
    const tableLines = tableOutput.trim().split("\n");
    const dataLines = tableLines.slice(2);
    assert.ok(dataLines.length > 0, "Must have data lines");
    for (const line of dataLines) {
      const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
      assert.strictEqual(cols.length, 6, "Every row must have exactly 6 columns");
      assert.ok(cols[0].length > 0, "Bank name column must not be empty");
      assert.ok(cols[1].length > 0, "Branch column must not be empty");
      assert.ok(cols[2].length > 0, "City column must not be empty");
      assert.ok(cols[3].length > 0, "Pincode column must not be empty");
      assert.ok(cols[4].length > 0, "Manager name column must not be empty");
      assert.ok(cols[5].length > 0, "Contact column must not be empty");
      // Check no internal debug tokens leaked
      assert.ok(!line.includes("NOT_DEFINED"), "Must not leak internal NOT_DEFINED");
      assert.ok(!line.includes("NEEDS_REVIEW"), "Must not leak internal NEEDS_REVIEW");
      assert.ok(!line.includes("undefined"), "Must not contain 'undefined'");
      assert.ok(!line.includes("null"), "Must not contain 'null'");
    }
    console.log("✅ Table formatting verified!\n");

    // 8. Test Multiple Banks (ICICI, HDFC, Axis, Tata Capital)
    console.log("--- 8. MULTI-BANK VERIFICATION ---");
    const testBanks = ["HDFC Bank", "ICICI Bank", "Axis Bank", "Tata Capital"];
    for (const b of testBanks) {
      const branches = await findBankBranches(b, "Pune");
      const managers = await searchBankManager({ bank_name: b, city: "Pune" });
      console.log(`Bank [${b}]: Found ${branches.length} branches, ${managers.length} managers in Pune.`);
      if (managers.length > 0) {
        const withContact = managers.filter(
          (m) => m.phone && m.phone !== "N/A" && m.phone !== "—" && m.phone !== "#ERROR!"
        );
        console.log(`  -> Managers with valid phone contact: ${withContact.length}/${managers.length}`);
      }
    }
    console.log("✅ Multi-bank search verified!\n");

    console.log("================================================================================");
    console.log("ALL CORE BANK MANAGER LOGIC TESTS PASSED SUCCESSFULLY! 🎯");
    console.log("================================================================================");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in bank manager verification:", err);
  process.exit(1);
});
