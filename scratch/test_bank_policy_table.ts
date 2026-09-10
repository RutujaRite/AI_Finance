import * as assert from "assert";
import fs from "fs";
import path from "path";
import { getAllMasterPolicies, deleteBankMasterPolicy } from "../lib/masterPolicies";

async function runTest() {
  console.log("=== Testing Bank Policy Table & Delete Action Updates ===");

  // 1. Verify PoliciesView.tsx component code
  const policiesViewContent = fs.readFileSync(
    path.join(__dirname, "../components/PoliciesView.tsx"),
    "utf-8"
  );

  // Check table header in rules tab (between 'activeTab === "rules"' and 'activeTab === "files"' or 'POLICY DOCUMENTS TAB')
  const rulesTabSection = policiesViewContent.slice(
    policiesViewContent.indexOf('activeTab === "rules" ? ('),
    policiesViewContent.indexOf('POLICY DOCUMENTS TAB')
  );

  assert.ok(
    !rulesTabSection.includes("<th>Master Policy File</th>"),
    "FAIL: '<th>Master Policy File</th>' must be removed from Bank Master Policies table"
  );
  assert.ok(
    rulesTabSection.includes("<th>Bank Name</th>"),
    "FAIL: '<th>Bank Name</th>' must be kept"
  );
  assert.ok(
    rulesTabSection.includes("<th>Loan Category</th>"),
    "FAIL: '<th>Loan Category</th>' must be kept"
  );
  assert.ok(
    rulesTabSection.includes("<th>Status</th>"),
    "FAIL: '<th>Status</th>' must be kept"
  );
  assert.ok(
    rulesTabSection.includes("Actions</th>"),
    "FAIL: 'Actions' must be kept"
  );

  console.log("✓ PoliciesView.tsx table columns verified: Master Policy File removed, Bank Name, Loan Category, Status, Actions kept.");

  // Check Actions in PoliciesView
  assert.ok(
    rulesTabSection.includes("handleOpenViewerFile(policy)"),
    "FAIL: View button must call handleOpenViewerFile"
  );
  assert.ok(
    rulesTabSection.includes("handleOpenEditorFile(policy)"),
    "FAIL: Edit button must call handleOpenEditorFile"
  );
  assert.ok(
    rulesTabSection.includes("handleOpenDelete(policy)"),
    "FAIL: Delete button must call handleOpenDelete"
  );
  console.log("✓ PoliciesView.tsx actions verified: View & Edit operate on policy text file.");

  // 2. Verify deleteBankMasterPolicy in masterPolicies.ts
  const initialPolicies = getAllMasterPolicies();
  const initialCount = initialPolicies.length;
  console.log(`Initial active partner banks: ${initialCount}`);

  // Test deletion on a dummy/test policy file without touching actual partner policies
  const testDir = path.join(process.cwd(), "policy-master-files");
  const testFileName = "TEMPORARY_TEST_DELETE_POLICY.txt";
  const testFilePath = path.join(testDir, testFileName);
  fs.writeFileSync(testFilePath, "Sample policy text for unit testing deletion", "utf-8");
  assert.ok(fs.existsSync(testFilePath), "Test file must exist before test deletion");

  // Call deleteBankMasterPolicy with bank ID 9999 (non-partner) and testFileName
  const deleteRes = await deleteBankMasterPolicy(9999, testFileName);
  assert.strictEqual(deleteRes.success, true, "deleteBankMasterPolicy should succeed");
  assert.ok(!fs.existsSync(testFilePath), "Test file must be unlinked from disk");

  // Verify that banks are NOT removed from the active list
  const afterPolicies = getAllMasterPolicies();
  assert.strictEqual(
    afterPolicies.length,
    initialCount,
    `Bank count must remain ${initialCount} after deletion (got ${afterPolicies.length})`
  );

  // Check that .deleted_banks.json does not contain 9999
  const deletedBanksFile = path.join(process.cwd(), "policy-master-files", ".deleted_banks.json");
  if (fs.existsSync(deletedBanksFile)) {
    const rawDeleted = JSON.parse(fs.readFileSync(deletedBanksFile, "utf-8"));
    assert.ok(
      !rawDeleted.includes(9999),
      ".deleted_banks.json must NOT contain bankId 9999"
    );
  }

  console.log("✓ deleteBankMasterPolicy verified: unlinks text file only, keeps bank in active list.");

  console.log("✅ ALL TESTS PASSED SUCCESSFULLY!");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
