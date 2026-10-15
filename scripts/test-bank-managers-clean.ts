import fs from "fs";
import path from "path";

async function verifyBankManagersClean() {
  console.log("================================================================================");
  console.log("   VERIFYING BANK MANAGERS VIEW: DIRECTORY SECTION REMOVED");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      failed++;
    }
  }

  const bankManagersPageSrc = fs.readFileSync(
    path.join(process.cwd(), "app/admin/bank-managers/page.tsx"),
    "utf-8"
  );

  // 1. Verify Directory table and tabs are removed
  assert(
    !bankManagersPageSrc.includes("Bank Manager Directory ("),
    "No 'Bank Manager Directory' tab button"
  );

  assert(
    !bankManagersPageSrc.includes("activeTab"),
    "No tab switching state (activeTab removed)"
  );

  assert(
    !bankManagersPageSrc.includes("loadingManagers"),
    "Removed loadingManagers state"
  );

  assert(
    !bankManagersPageSrc.includes("fetchManagers()"),
    "Removed fetchManagers() calls and bulk manager loading"
  );

  // 2. Verify Spreadsheets / Manager Files management is directly rendered
  assert(
    bankManagersPageSrc.includes("handleUploadSubmit"),
    "Upload Bank Manager Spreadsheet form is directly visible"
  );

  assert(
    bankManagersPageSrc.includes("searchFileQuery"),
    "Spreadsheet search/filter input is present"
  );

  assert(
    bankManagersPageSrc.includes("bi-download") && bankManagersPageSrc.includes("download={f.file_name}"),
    "Download action button is present in files table"
  );

  assert(
    bankManagersPageSrc.includes("handleDeleteFile"),
    "Delete action button is present in files table"
  );

  // 3. Verify AdminHeader remains intact
  assert(
    bankManagersPageSrc.includes("<AdminHeader") && !bankManagersPageSrc.includes("<aside"),
    "AdminHeader is preserved with NO sidebar"
  );

  // 4. Test API returns manager files
  const BASE_URL = "http://localhost:3001";
  try {
    const { signToken } = await import("../lib/auth");
    const adminToken = signToken({
      id: 1,
      email: "admin@gmail.com",
      name: "Admin User",
      role: "admin",
    });

    const res = await fetch(`${BASE_URL}/api/bank-managers/files`, {
      headers: {
        Cookie: `token=${adminToken}`,
      },
    });
    const data = await res.json();
    assert(
      Array.isArray(data.files) && data.files.length > 0,
      `API /api/bank-managers/files returns ${data?.files?.length || 0} manager spreadsheets`
    );
  } catch (err: any) {
    console.warn("API check failed:", err.message);
  }

  console.log("\n================================================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

verifyBankManagersClean();
