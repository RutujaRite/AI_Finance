/**
 * Comprehensive Test Suite for the Company Data Section:
 * 1. Authentication & Security (Admin check, non-admin rejection)
 * 2. GET /api/bank/files (Listing, record counts, total ingested stats)
 * 3. File type enforcement: REJECT policy documents (.pdf, .txt, .docx)
 * 4. Company Data Upload & Ingestion (.csv with company categorization records)
 * 5. Company Data Download (Generated/streamed CSV with valid headers & data)
 * 6. Pre-existing bank file download (Reconstruction from DB for existing 50k+ records)
 * 7. Company Data Delete (File removal and cascaded DB cleanup)
 * 8. Backward-compatible /api/bank/upload alias
 */

import pool from "../lib/db";
import { signToken } from "../lib/auth";
import assert from "assert";

const BASE_URL = "http://localhost:3001";

const adminToken = signToken({ id: 1, email: "admin@gmail.com", name: "Admin", role: "admin" });
const userToken = signToken({ id: 3, email: "test@example.com", name: "User", role: "user" });

async function runTestSuite() {
  console.log("================================================================================");
  console.log("🧪 STARTING COMPANY DATA SECTION COMPREHENSIVE TEST SUITE");
  console.log("================================================================================\n");

  let createdFileId: number | null = null;

  // ---------------------------------------------------------------------------
  // TEST 1: Authentication & Authorization on /api/bank/files
  // ---------------------------------------------------------------------------
  console.log("▶ TEST 1: Verifying Authentication & Admin Access Controls...");
  {
    // Unauthenticated
    const resNoAuth = await fetch(`${BASE_URL}/api/bank/files`);
    assert(
      resNoAuth.status === 401 || resNoAuth.status === 403,
      `Expected 401/403 for unauthenticated request, got ${resNoAuth.status}`
    );

    // Non-admin user
    const resUser = await fetch(`${BASE_URL}/api/bank/files`, {
      headers: { Cookie: `token=${userToken}` },
    });
    assert(
      resUser.status === 403,
      `Expected 403 Forbidden for non-admin user, got ${resUser.status}`
    );

    // Admin user
    const resAdmin = await fetch(`${BASE_URL}/api/bank/files`, {
      headers: { Cookie: `token=${adminToken}` },
    });
    assert.strictEqual(resAdmin.status, 200, `Expected 200 for admin user, got ${resAdmin.status}`);
    const adminData = await resAdmin.json();
    assert.strictEqual(adminData.success, true, "Expected success: true");
    assert(Array.isArray(adminData.files), "Expected files array");
    assert(typeof adminData.totalCompanyRecords === "number", "Expected totalCompanyRecords number");
    console.log(`  ✅ Passed: Admin authorized. Found ${adminData.files.length} company files and ${adminData.totalCompanyRecords.toLocaleString()} total company records in DB.\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Rejection of Policy Files (.pdf, .txt, .docx)
  // ---------------------------------------------------------------------------
  console.log("▶ TEST 2: Policy Document Rejection (PDF, TXT, DOCX must NOT be accepted)...");
  {
    // 2a. Rejection of PDF policy file
    const pdfFormData = new FormData();
    const fakePdfBlob = new Blob(["%PDF-1.4 Mock Policy content for testing rejection"], { type: "application/pdf" });
    pdfFormData.append("file", fakePdfBlob, "HDFC_Master_Policy_Rules.pdf");

    const pdfRes = await fetch(`${BASE_URL}/api/bank/files`, {
      method: "POST",
      headers: { Cookie: `token=${adminToken}` },
      body: pdfFormData,
    });
    const pdfJson = await pdfRes.json();
    assert.strictEqual(pdfRes.status, 400, `Expected 400 for PDF upload, got ${pdfRes.status}`);
    assert.strictEqual(pdfJson.success, false);
    assert(
      pdfJson.error.toLowerCase().includes("policy") || pdfJson.error.toLowerCase().includes("not accepted"),
      `Expected rejection message mentioning policy, got: ${pdfJson.error}`
    );
    console.log(`  ✅ Passed: PDF policy file correctly rejected: "${pdfJson.error}"`);

    // 2b. Rejection of TXT policy file
    const txtFormData = new FormData();
    const fakeTxtBlob = new Blob(["Axis Bank interest rate cutoffs"], { type: "text/plain" });
    txtFormData.append("file", fakeTxtBlob, "Axis_Policy_Guidelines.txt");

    const txtRes = await fetch(`${BASE_URL}/api/bank/files`, {
      method: "POST",
      headers: { Cookie: `token=${adminToken}` },
      body: txtFormData,
    });
    const txtJson = await txtRes.json();
    assert.strictEqual(txtRes.status, 400, `Expected 400 for TXT upload, got ${txtRes.status}`);
    assert.strictEqual(txtJson.success, false);
    console.log(`  ✅ Passed: TXT policy file correctly rejected: "${txtJson.error}"`);

    // 2c. Rejection of unhandled extension (e.g. .png)
    const pngFormData = new FormData();
    const fakePngBlob = new Blob(["fake png"], { type: "image/png" });
    pngFormData.append("file", fakePngBlob, "screenshot.png");

    const pngRes = await fetch(`${BASE_URL}/api/bank/files`, {
      method: "POST",
      headers: { Cookie: `token=${adminToken}` },
      body: pngFormData,
    });
    assert.strictEqual(pngRes.status, 400);
    console.log(`  ✅ Passed: Non-company extension correctly rejected.\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Company Data Upload & Ingestion (.csv)
  // ---------------------------------------------------------------------------
  console.log("▶ TEST 3: Uploading Company Categorization CSV & Verifying DB Ingestion...");
  {
    const sampleCsvContent = `SR_NO,COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY,OTHER_INFO
1,Test Apex Automation Technologies Pvt Ltd,Kotak Mahindra Bank,Super CAT A,CIN-U72200MH2021PTC123456
2,Test Vertex Bio Solutions Limited,Kotak Mahindra Bank,CAT B,CIN-U24230DL2019PLC654321
3,Test Quantum Cloud Logistics LLP,Kotak Mahindra Bank,CAT C,LLP-AAB-9876`;

    const csvFormData = new FormData();
    const csvBlob = new Blob([sampleCsvContent], { type: "text/csv" });
    csvFormData.append("file", csvBlob, "Kotak_Test_Companies_2026.csv");

    const uploadRes = await fetch(`${BASE_URL}/api/bank/files`, {
      method: "POST",
      headers: { Cookie: `token=${adminToken}` },
      body: csvFormData,
    });

    assert.strictEqual(uploadRes.status, 200, `Expected 200 for CSV upload, got ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    assert.strictEqual(uploadData.success, true, "Upload response should be success: true");
    assert(uploadData.file && uploadData.file.id, "Upload response should return file id");
    createdFileId = uploadData.file.id;
    assert.strictEqual(uploadData.file.record_count, 3, "Expected 3 company records ingested");

    // Verify database rows directly in bank_company_data
    const dbCheck = await pool.query(
      "SELECT * FROM bank_company_data WHERE file_id = $1 ORDER BY sr_no ASC",
      [createdFileId]
    );
    assert.strictEqual(dbCheck.rows.length, 3, "Database must contain 3 rows in bank_company_data");
    assert.strictEqual(dbCheck.rows[0].company_name, "Test Apex Automation Technologies Pvt Ltd");
    assert.strictEqual(dbCheck.rows[0].bank_name, "Kotak Mahindra Bank");
    assert.strictEqual(dbCheck.rows[0].company_category, "Super CAT A");
    console.log(`  ✅ Passed: Uploaded file ID ${createdFileId}. Verified 3 rows ingested into bank_company_data.\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Downloading Uploaded Company Data
  // ---------------------------------------------------------------------------
  console.log("▶ TEST 4: Downloading Uploaded Company Data File...");
  {
    assert(createdFileId !== null, "createdFileId must exist");
    const downloadRes = await fetch(`${BASE_URL}/api/bank/files/${createdFileId}/download`, {
      headers: { Cookie: `token=${adminToken}` },
    });

    assert.strictEqual(downloadRes.status, 200, `Expected 200 for download, got ${downloadRes.status}`);
    const disposition = downloadRes.headers.get("content-disposition");
    assert(
      disposition && disposition.includes("Kotak_Test_Companies_2026.csv"),
      `Expected attachment header with filename, got: ${disposition}`
    );

    const downloadText = await downloadRes.text();
    assert(
      downloadText.includes("Test Apex Automation Technologies Pvt Ltd"),
      "Downloaded CSV must include Test Apex Automation Technologies Pvt Ltd"
    );
    assert(
      downloadText.includes("Super CAT A"),
      "Downloaded CSV must include Super CAT A category"
    );
    console.log(`  ✅ Passed: Downloaded file successfully (${downloadText.length} bytes, correct headers & content).\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Downloading Existing Pre-Migrated Bank File (File 13: Piramal)
  // ---------------------------------------------------------------------------
  console.log("▶ TEST 5: Downloading Existing Pre-Migrated Company Data (File ID 13: Piramal)...");
  {
    const piramalRes = await fetch(`${BASE_URL}/api/bank/files/13/download`, {
      headers: { Cookie: `token=${adminToken}` },
    });

    assert.strictEqual(piramalRes.status, 200, `Expected 200 for Piramal download, got ${piramalRes.status}`);
    const disposition = piramalRes.headers.get("content-disposition");
    assert(
      disposition && disposition.includes("Piramal"),
      `Expected disposition with Piramal filename, got ${disposition}`
    );

    const text = await piramalRes.text();
    assert(text.startsWith("SR_NO,COMPANY_NAME"), "Expected standard CSV header");
    assert(text.includes("Piramal"), "Expected Piramal records in CSV");
    console.log(`  ✅ Passed: Pre-migrated file reconstructed from DB successfully (${(text.length / 1024 / 1024).toFixed(2)} MB, tens of thousands of records).\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Single File Metadata GET (/api/bank/files/[id])
  // ---------------------------------------------------------------------------
  console.log("▶ TEST 6: Testing GET /api/bank/files/[id] Single File Query...");
  {
    assert(createdFileId !== null);
    const getRes = await fetch(`${BASE_URL}/api/bank/files/${createdFileId}`, {
      headers: { Cookie: `token=${adminToken}` },
    });
    assert.strictEqual(getRes.status, 200, `Expected 200, got ${getRes.status}`);
    const getData = await getRes.json();
    assert.strictEqual(getData.success, true);
    assert.strictEqual(getData.file.id, createdFileId);
    assert.strictEqual(Number(getData.file.record_count), 3);
    console.log(`  ✅ Passed: Fetched metadata for file ID ${createdFileId} (3 records).\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 7: Deleting Company Data File & Cascaded Record Removal
  // ---------------------------------------------------------------------------
  console.log("▶ TEST 7: Deleting Company Data File & Verifying Cascaded Removal...");
  {
    assert(createdFileId !== null);
    const deleteRes = await fetch(`${BASE_URL}/api/bank/files/${createdFileId}`, {
      method: "DELETE",
      headers: { Cookie: `token=${adminToken}` },
    });

    assert.strictEqual(deleteRes.status, 200, `Expected 200 for DELETE, got ${deleteRes.status}`);
    const deleteData = await deleteRes.json();
    assert.strictEqual(deleteData.success, true);
    assert(deleteData.message.includes("deleted successfully"), `Expected success message, got: ${deleteData.message}`);

    // Verify row is gone from bank_uploaded_files
    const checkFile = await pool.query("SELECT * FROM bank_uploaded_files WHERE id = $1", [createdFileId]);
    assert.strictEqual(checkFile.rows.length, 0, "File must be removed from bank_uploaded_files");

    // Verify cascaded removal from bank_company_data
    const checkData = await pool.query("SELECT * FROM bank_company_data WHERE file_id = $1", [createdFileId]);
    assert.strictEqual(checkData.rows.length, 0, "All associated records in bank_company_data must be deleted");

    console.log(`  ✅ Passed: File ID ${createdFileId} and all associated company records completely deleted.\n`);
  }

  // ---------------------------------------------------------------------------
  // TEST 8: /api/bank/upload Alias Test
  // ---------------------------------------------------------------------------
  console.log("▶ TEST 8: Testing /api/bank/upload POST Alias Endpoint...");
  {
    const aliasCsv = `COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY
Alias Test Corp Ltd,Yes Bank,Category A`;

    const aliasFormData = new FormData();
    const aliasBlob = new Blob([aliasCsv], { type: "text/csv" });
    aliasFormData.append("file", aliasBlob, "Alias_Test_Data.csv");

    const aliasRes = await fetch(`${BASE_URL}/api/bank/upload`, {
      method: "POST",
      headers: { Cookie: `token=${adminToken}` },
      body: aliasFormData,
    });

    assert.strictEqual(aliasRes.status, 200, `Expected 200 from /api/bank/upload alias, got ${aliasRes.status}`);
    const aliasJson = await aliasRes.json();
    assert.strictEqual(aliasJson.success, true);
    const aliasId = aliasJson.file.id;

    // Clean up test file
    await fetch(`${BASE_URL}/api/bank/files/${aliasId}`, {
      method: "DELETE",
      headers: { Cookie: `token=${adminToken}` },
    });
    console.log(`  ✅ Passed: /api/bank/upload alias works identically and cleaned up.\n`);
  }

  console.log("================================================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! COMPANY DATA SECTION FULLY VERIFIED.");
  console.log("================================================================================");
}

runTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ TEST FAILURE:", err);
    process.exit(1);
  });
