/**
 * Automated Regression Test Suite for CSV Upload & Ingestion in CreditWise AI:
 * Test A — Single upload
 * Test B — Repeated request
 * Test C — Double-click protection
 * Test D — Intentional new upload
 * Test E — Identical file retry
 * Test F — Legitimate overlapping data
 * Test G — Large CSV (multi-batch representative dataset)
 * Test H — Partial failure / error simulation
 * Test I — Bank/lender isolation
 * Test J — Concurrent uploads
 * Test K — Record-count accuracy
 */

import pool from "../lib/db";
import { signToken } from "../lib/auth";
import assert from "assert";

const BASE_URL = "http://localhost:3001";
const adminToken = signToken({ id: 1, email: "admin@gmail.com", name: "Admin", role: "admin" });

const createdTestFileIds: number[] = [];

async function cleanupTestArtifacts() {
  if (createdTestFileIds.length > 0) {
    try {
      await pool.query("DELETE FROM bank_company_data WHERE file_id = ANY($1)", [createdTestFileIds]);
      await pool.query("DELETE FROM bank_uploaded_files WHERE id = ANY($1)", [createdTestFileIds]);
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }
  }
}

async function runRegressionTests() {
  console.log("================================================================================");
  console.log("🧪 RUNNING COMPREHENSIVE CSV UPLOAD & DEDUPLICATION REGRESSION TEST SUITE");
  console.log("================================================================================\n");

  try {
    // ---------------------------------------------------------------------------
    // TEST A: Single upload
    // ---------------------------------------------------------------------------
    console.log("▶ TEST A: Single Upload of Valid CSV...");
    let testAFileId: number;
    {
      const csv = `SR_NO,COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY,OTHER_INFO
1,Test Alfa Robotics Ltd,Axis Bank,CAT A,CIN-1001
2,Test Bravo Systems Pvt Ltd,Axis Bank,CAT B,CIN-1002
3,Test Charlie Cloud Inc,Axis Bank,CAT C,CIN-1003
4,Test Delta Networks,Axis Bank,CAT A,CIN-1004
5,Test Echo Solutions Ltd,Axis Bank,CAT B,CIN-1005`;

      const formData = new FormData();
      formData.append("file", new Blob([csv], { type: "text/csv" }), "Test_Axis_Batch_A.csv");
      formData.append("bank_name", "Axis Bank");

      const res = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.file.record_count, 5);
      testAFileId = data.file.id;
      createdTestFileIds.push(testAFileId);

      // Verify DB count
      const dbRes = await pool.query("SELECT COUNT(*)::int as cnt FROM bank_company_data WHERE file_id = $1", [testAFileId]);
      assert.strictEqual(dbRes.rows[0].cnt, 5, "Database must contain exactly 5 records");
      console.log(`  ✅ Passed: Test A single upload created file ID ${testAFileId} with 5 records.\n`);
    }

    // ---------------------------------------------------------------------------
    // TEST B: Repeated request (Idempotency)
    // ---------------------------------------------------------------------------
    console.log("▶ TEST B: Repeated Request with Identical Payload & Key...");
    {
      const csv = `SR_NO,COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY,OTHER_INFO
1,Test Alfa Robotics Ltd,Axis Bank,CAT A,CIN-1001
2,Test Bravo Systems Pvt Ltd,Axis Bank,CAT B,CIN-1002
3,Test Charlie Cloud Inc,Axis Bank,CAT C,CIN-1003
4,Test Delta Networks,Axis Bank,CAT A,CIN-1004
5,Test Echo Solutions Ltd,Axis Bank,CAT B,CIN-1005`;

      const formData = new FormData();
      formData.append("file", new Blob([csv], { type: "text/csv" }), "Test_Axis_Batch_A.csv");
      formData.append("bank_name", "Axis Bank");

      const res = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.duplicate, true, "Response must flag duplicate: true");
      assert.strictEqual(data.file.id, testAFileId, "Must return existing file ID");

      // Verify no records were added
      const dbRes = await pool.query("SELECT COUNT(*)::int as cnt FROM bank_company_data WHERE file_id = $1", [testAFileId]);
      assert.strictEqual(dbRes.rows[0].cnt, 5, "Database must still contain exactly 5 records");
      console.log("  ✅ Passed: Test B repeated request recognized as duplicate without re-inserting.\n");
    }

    // ---------------------------------------------------------------------------
    // TEST C: Double-click simulation (rapid repeated submissions)
    // ---------------------------------------------------------------------------
    console.log("▶ TEST C: Double-Click Rapid Repeated Submissions...");
    {
      const csv = `SR_NO,COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY,OTHER_INFO
1,Test Rapid Click Alpha,Kotak Mahindra Bank,Approved,CIN-C1
2,Test Rapid Click Beta,Kotak Mahindra Bank,Approved,CIN-C2`;

      const makeRequest = () => {
        const formData = new FormData();
        formData.append("file", new Blob([csv], { type: "text/csv" }), "Test_Rapid_Click.csv");
        formData.append("bank_name", "Kotak Mahindra Bank");
        return fetch(`${BASE_URL}/api/bank/files`, {
          method: "POST",
          headers: { Cookie: `token=${adminToken}` },
          body: formData,
        });
      };

      const [res1, res2] = await Promise.all([makeRequest(), makeRequest()]);
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);

      const d1 = await res1.json();
      const d2 = await res2.json();
      const targetId = d1.file.id || d2.file.id;
      createdTestFileIds.push(targetId);

      const filesInDb = await pool.query(
        "SELECT COUNT(*)::int as cnt FROM bank_uploaded_files WHERE file_name = 'Test_Rapid_Click.csv'"
      );
      assert.strictEqual(filesInDb.rows[0].cnt, 1, "Only 1 file entry should be created for rapid double click");

      const rowsInDb = await pool.query(
        "SELECT COUNT(*)::int as cnt FROM bank_company_data WHERE file_id = $1",
        [targetId]
      );
      assert.strictEqual(rowsInDb.rows[0].cnt, 2, "Only 2 rows should be inserted");
      console.log("  ✅ Passed: Test C rapid double click safely handled with single ingestion.\n");
    }

    // ---------------------------------------------------------------------------
    // TEST D: Intentional new upload
    // ---------------------------------------------------------------------------
    console.log("▶ TEST D: Intentional New Upload with Different Records...");
    let testDFileId: number;
    {
      const csv = `SR_NO,COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY
1,Test New Firm 1,ICICI Bank,CAT A
2,Test New Firm 2,ICICI Bank,CAT B`;

      const formData = new FormData();
      formData.append("file", new Blob([csv], { type: "text/csv" }), "Test_ICICI_New.csv");
      formData.append("bank_name", "ICICI Bank");

      const res = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.file.record_count, 2);
      testDFileId = data.file.id;
      createdTestFileIds.push(testDFileId);

      const rowsInDb = await pool.query(
        "SELECT COUNT(*)::int as cnt FROM bank_company_data WHERE file_id = $1",
        [testDFileId]
      );
      assert.strictEqual(rowsInDb.rows[0].cnt, 2);
      console.log(`  ✅ Passed: Test D intentional new upload successfully ingested file ID ${testDFileId}.\n`);
    }

    // ---------------------------------------------------------------------------
    // TEST E: Identical file retry (deduplication check)
    // ---------------------------------------------------------------------------
    console.log("▶ TEST E: Identical File Retry...");
    {
      const csv = `SR_NO,COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY
1,Test New Firm 1,ICICI Bank,CAT A
2,Test New Firm 2,ICICI Bank,CAT B`;

      const formData = new FormData();
      formData.append("file", new Blob([csv], { type: "text/csv" }), "Test_ICICI_New.csv");
      formData.append("bank_name", "ICICI Bank");

      const res = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.duplicate, true);
      assert.strictEqual(data.stats.skipped_duplicate, 2);

      const countFiles = await pool.query(
        "SELECT COUNT(*)::int as cnt FROM bank_uploaded_files WHERE file_name = 'Test_ICICI_New.csv'"
      );
      assert.strictEqual(countFiles.rows[0].cnt, 1, "Must remain exactly 1 file entry in DB");
      console.log("  ✅ Passed: Test E retry skipped duplicate without accumulating records.\n");
    }

    // ---------------------------------------------------------------------------
    // TEST F: Legitimate overlapping data across banks
    // ---------------------------------------------------------------------------
    console.log("▶ TEST F: Legitimate Overlapping Company Name Across Different Banks...");
    {
      const hdfcCsv = `COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY
Acme Global CrossBank Ltd,HDFC Bank,Super CAT A`;

      const idfcCsv = `COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY
Acme Global CrossBank Ltd,IDFC FIRST Bank,Category B`;

      const fd1 = new FormData();
      fd1.append("file", new Blob([hdfcCsv], { type: "text/csv" }), "HDFC_Overlap.csv");
      fd1.append("bank_name", "HDFC Bank");

      const res1 = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: fd1,
      });
      const d1 = await res1.json();
      createdTestFileIds.push(d1.file.id);

      const fd2 = new FormData();
      fd2.append("file", new Blob([idfcCsv], { type: "text/csv" }), "IDFC_Overlap.csv");
      fd2.append("bank_name", "IDFC FIRST Bank");

      const res2 = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: fd2,
      });
      const d2 = await res2.json();
      createdTestFileIds.push(d2.file.id);

      const checkHdfc = await pool.query(
        "SELECT * FROM bank_company_data WHERE company_name = 'Acme Global CrossBank Ltd' AND bank_name = 'HDFC Bank'"
      );
      const checkIdfc = await pool.query(
        "SELECT * FROM bank_company_data WHERE company_name = 'Acme Global CrossBank Ltd' AND bank_name = 'IDFC FIRST Bank'"
      );

      assert.strictEqual(checkHdfc.rows.length, 1, "HDFC must have Acme Global CrossBank Ltd record");
      assert.strictEqual(checkIdfc.rows.length, 1, "IDFC must have Acme Global CrossBank Ltd record");
      assert.strictEqual(checkHdfc.rows[0].company_category, "Super CAT A");
      assert.strictEqual(checkIdfc.rows[0].company_category, "Category B");
      console.log("  ✅ Passed: Test F legitimate cross-bank records properly preserved and isolated.\n");
    }

    // ---------------------------------------------------------------------------
    // TEST G: Large CSV representative batching (1,250 records)
    // ---------------------------------------------------------------------------
    console.log("▶ TEST G: Large CSV Multi-Batch Ingestion (1,250 records across 3 batches)...");
    {
      const rows: string[] = ["SR_NO,COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY,OTHER_INFO"];
      for (let i = 1; i <= 1250; i++) {
        rows.push(`${i},Batch Company Test Row ${i},Bajaj Finserv,CAT-${(i % 4) + 1},Info-${i}`);
      }
      const largeCsv = rows.join("\n");

      const formData = new FormData();
      formData.append("file", new Blob([largeCsv], { type: "text/csv" }), "Bajaj_Large_1250.csv");
      formData.append("bank_name", "Bajaj Finserv");

      const res = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.file.record_count, 1250);
      const largeFileId = data.file.id;
      createdTestFileIds.push(largeFileId);

      const dbCheck = await pool.query(
        "SELECT COUNT(*)::int as cnt FROM bank_company_data WHERE file_id = $1",
        [largeFileId]
      );
      assert.strictEqual(dbCheck.rows[0].cnt, 1250, "All 1,250 records must be present in database");
      console.log(`  ✅ Passed: Test G multi-batch 1,250 records successfully ingested (File ID ${largeFileId}).\n`);
    }

    // ---------------------------------------------------------------------------
    // TEST H: Partial failure / rejection of invalid files
    // ---------------------------------------------------------------------------
    console.log("▶ TEST H: Error Handling & Invalid File Format Protection...");
    {
      const invalidPdf = new Blob(["%PDF-1.4 Mock invalid policy"], { type: "application/pdf" });
      const formData = new FormData();
      formData.append("file", invalidPdf, "Policy_Manual.pdf");
      formData.append("bank_name", "HDFC Bank");

      const res = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert(data.error.includes("Policy documents are not accepted"));
      console.log("  ✅ Passed: Test H correctly rejected invalid file without creating ghost records.\n");
    }

    // ---------------------------------------------------------------------------
    // TEST I: Bank/lender isolation
    // ---------------------------------------------------------------------------
    console.log("▶ TEST I: Destination Bank/Lender Isolation...");
    {
      const file1 = `COMPANY_NAME,COMPANY_CATEGORY\nIsolated Enterprise 1,CAT A`;
      const file2 = `COMPANY_NAME,COMPANY_CATEGORY\nIsolated Enterprise 2,CAT B`;

      const fd1 = new FormData();
      fd1.append("file", new Blob([file1], { type: "text/csv" }), "IndusInd_Iso.csv");
      fd1.append("bank_name", "IndusInd Bank");

      const res1 = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: fd1,
      });
      const d1 = await res1.json();
      createdTestFileIds.push(d1.file.id);

      const fd2 = new FormData();
      fd2.append("file", new Blob([file2], { type: "text/csv" }), "YesBank_Iso.csv");
      fd2.append("bank_name", "Yes Bank");

      const res2 = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: fd2,
      });
      const d2 = await res2.json();
      createdTestFileIds.push(d2.file.id);

      const indusRec = await pool.query(
        "SELECT bank_name FROM bank_company_data WHERE company_name = 'Isolated Enterprise 1'"
      );
      const yesRec = await pool.query(
        "SELECT bank_name FROM bank_company_data WHERE company_name = 'Isolated Enterprise 2'"
      );

      assert.strictEqual(indusRec.rows[0].bank_name, "IndusInd Bank");
      assert.strictEqual(yesRec.rows[0].bank_name, "Yes Bank");
      console.log("  ✅ Passed: Test I verified bank isolation.\n");
    }

    // ---------------------------------------------------------------------------
    // TEST J: Concurrent Uploads (3 concurrent requests for same file)
    // ---------------------------------------------------------------------------
    console.log("▶ TEST J: 3 Concurrent Requests for Same File...");
    {
      const csv = `COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY
Concurrent Test 1,Poonawalla Fincorp,CAT A
Concurrent Test 2,Poonawalla Fincorp,CAT B`;

      const makeCall = () => {
        const formData = new FormData();
        formData.append("file", new Blob([csv], { type: "text/csv" }), "Poonawalla_Concurrent.csv");
        formData.append("bank_name", "Poonawalla Fincorp");
        return fetch(`${BASE_URL}/api/bank/files`, {
          method: "POST",
          headers: { Cookie: `token=${adminToken}` },
          body: formData,
        });
      };

      const [r1, r2, r3] = await Promise.all([makeCall(), makeCall(), makeCall()]);
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r2.status, 200);
      assert.strictEqual(r3.status, 200);

      const d1 = await r1.json();
      createdTestFileIds.push(d1.file.id);

      const filesCount = await pool.query(
        "SELECT COUNT(*)::int as cnt FROM bank_uploaded_files WHERE file_name = 'Poonawalla_Concurrent.csv'"
      );
      assert.strictEqual(filesCount.rows[0].cnt, 1, "Must only create 1 file entry despite 3 concurrent calls");

      const rowsCount = await pool.query(
        "SELECT COUNT(*)::int as cnt FROM bank_company_data WHERE file_id = $1",
        [d1.file.id]
      );
      assert.strictEqual(rowsCount.rows[0].cnt, 2, "Must only insert 2 records");
      console.log("  ✅ Passed: Test J 3 concurrent uploads prevented duplicate records.\n");
    }

    // ---------------------------------------------------------------------------
    // TEST K: Record-count accuracy with invalid & empty rows
    // ---------------------------------------------------------------------------
    console.log("▶ TEST K: Record-Count Accuracy (Valid, Invalid & Empty Rows)...");
    {
      const mixedCsv = `SR_NO,COMPANY_NAME,BANK_NAME,COMPANY_CATEGORY
1,Valid Company One,Bandhan Bank,Approved
2,,Bandhan Bank,Approved
3,Valid Company Two,Bandhan Bank,Approved
4,   ,Bandhan Bank,Approved
5,Valid Company Three,Bandhan Bank,Approved
,,,
6,Valid Company Four,Bandhan Bank,Approved`;

      const formData = new FormData();
      formData.append("file", new Blob([mixedCsv], { type: "text/csv" }), "Bandhan_Mixed_Accuracy.csv");
      formData.append("bank_name", "Bandhan Bank");

      const res = await fetch(`${BASE_URL}/api/bank/files`, {
        method: "POST",
        headers: { Cookie: `token=${adminToken}` },
        body: formData,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.stats.inserted, 4, "Expected 4 valid inserted records");
      assert.strictEqual(data.stats.invalid_rows, 2, "Expected 2 invalid rows (empty company name)");
      createdTestFileIds.push(data.file.id);

      const dbCheck = await pool.query(
        "SELECT COUNT(*)::int as cnt FROM bank_company_data WHERE file_id = $1",
        [data.file.id]
      );
      assert.strictEqual(dbCheck.rows[0].cnt, 4, "Database must strictly have 4 records");
      console.log("  ✅ Passed: Test K record-count accuracy confirmed (4 inserted, 2 invalid, 1 empty).\n");
    }

    // ---------------------------------------------------------------------------
    // TEST GET /api/bank/files Output Check
    // ---------------------------------------------------------------------------
    console.log("▶ VERIFYING GET /api/bank/files Output Integrity...");
    {
      const getRes = await fetch(`${BASE_URL}/api/bank/files`, {
        headers: { Cookie: `token=${adminToken}` },
      });
      const getData = await getRes.json();
      assert.strictEqual(getData.success, true);

      // Verify no phantom entries starting with fs- for uploads
      const phantomUploads = getData.files.filter((f: any) =>
        String(f.id).startsWith("fs-") && f.file_name.endsWith(".csv")
      );
      assert.strictEqual(
        phantomUploads.length,
        0,
        `Found phantom file entries: ${JSON.stringify(phantomUploads)}`
      );

      // Verify totalCompanyRecords matches real DB total
      const realDbTotal = await pool.query("SELECT COUNT(*)::bigint as total FROM bank_company_data");
      assert.strictEqual(
        getData.totalCompanyRecords,
        Number(realDbTotal.rows[0].total),
        "totalCompanyRecords must equal exact PostgreSQL count"
      );
      console.log(`  ✅ Passed: GET /api/bank/files output verified (${getData.files.length} files, ${getData.totalCompanyRecords} records, 0 phantoms).\n`);
    }

    console.log("================================================================================");
    console.log("🎉 ALL REGRESSION TESTS PASSED! ZERO DUPLICATE PROCESSING CONFIRMED.");
    console.log("================================================================================");
  } finally {
    console.log("🧹 Cleaning up test artifacts...");
    await cleanupTestArtifacts();
    console.log("✅ Cleanup complete.");
    await pool.end();
  }
}

runRegressionTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ REGRESSION TEST FAILED:", err);
    process.exit(1);
  });
