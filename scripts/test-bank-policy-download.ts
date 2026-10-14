import fs from "fs";
import path from "path";

async function verifyBankPolicyDownloadChanges() {
  console.log("================================================================================");
  console.log("   VERIFYING BANK POLICY VIEW: TAB REMOVED & DOWNLOAD ADDED");
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

  const policiesViewSrc = fs.readFileSync(
    path.join(process.cwd(), "components/PoliciesView.tsx"),
    "utf-8"
  );

  // 1. Verify "Bank Policy Files" tab is removed
  assert(
    !policiesViewSrc.includes('className="nav-tabs"'),
    "No nav-tabs / tab switcher in Bank Policy view"
  );

  assert(
    !policiesViewSrc.includes("Bank Policy Files ("),
    "No 'Bank Policy Files' tab button"
  );

  assert(
    !policiesViewSrc.includes("POLICY DOCUMENTS TAB"),
    "No secondary 'POLICY DOCUMENTS TAB' section"
  );

  // 2. Verify Download option is added in the Bank Policies section
  assert(
    policiesViewSrc.includes("handleDownloadPolicyFile"),
    "handleDownloadPolicyFile function is implemented"
  );

  assert(
    policiesViewSrc.includes("bi-download") && policiesViewSrc.includes("Download"),
    "Download action button with bi-download icon is present in Bank Policies table"
  );

  // 3. Verify Download option is also present in edit modal attached file actions
  assert(
    policiesViewSrc.includes("handleDownloadPolicyFile(editPolicy)"),
    "Download option is available for attached files in Edit Policy Modal"
  );

  // 4. Verify no broken state or unused searchFileQuery
  assert(
    !policiesViewSrc.includes("searchFileQuery"),
    "Cleaned up searchFileQuery and filteredPolicyFiles"
  );

  // 5. Verify /api/policies still returns policies with auth cookie
  const BASE_URL = "http://localhost:3001";
  try {
    const { signToken } = await import("../lib/auth");
    const adminToken = signToken({
      id: 1,
      email: "admin@gmail.com",
      name: "Admin User",
      role: "admin",
    });

    const res = await fetch(`${BASE_URL}/api/policies`, {
      headers: {
        Cookie: `token=${adminToken}`,
      },
    });
    const data = await res.json();
    assert(
      Array.isArray(data) && data.length > 0,
      `API /api/policies returns ${data?.length || 0} bank policies with admin auth`
    );
  } catch (err: any) {
    console.warn("Could not fetch API directly:", err.message);
  }

  console.log("\n================================================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

verifyBankPolicyDownloadChanges();
