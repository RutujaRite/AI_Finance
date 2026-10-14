/**
 * Test Suite: Admin Dashboard Navigation & Dedicated Module Pages (No Sidebar)
 */

import fs from "fs";
import path from "path";
import pool from "../lib/db";
import { signToken } from "../lib/auth";

const BASE_URL = "http://localhost:3001";

async function runTestSuite() {
  console.log("================================================================================");
  console.log("   ADMIN DASHBOARD NAVIGATION & DEDICATED MODULE ROUTING VERIFICATION");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, testDesc: string, extra?: any) {
    if (condition) {
      console.log(`✅ [${testId}] PASS: ${testDesc}`);
      passed++;
    } else {
      console.error(`❌ [${testId}] FAIL: ${testDesc}`, extra ? extra : "");
      failed++;
    }
  }

  try {
    const adminToken = signToken({
      id: 1,
      email: "admin@gmail.com",
      name: "Admin User",
      role: "admin",
    });

    const userToken = signToken({
      id: 999,
      email: "agent@example.com",
      name: "Standard Agent",
      role: "user",
    });

    const adminCookie = `token=${adminToken}`;
    const userCookie = `token=${userToken}`;

    // Read source files to verify layout & structure
    const adminPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/page.tsx"), "utf-8");
    const adminHeaderSrc = fs.readFileSync(path.join(process.cwd(), "components/admin/AdminHeader.tsx"), "utf-8");

    // -------------------------------------------------------------------------
    // TEST 1: Main Admin Dashboard - No Left Sidebar
    // -------------------------------------------------------------------------
    const adminHasNoSidebar =
      !adminPageSrc.includes("<aside") &&
      !adminPageSrc.includes("</aside>") &&
      !adminPageSrc.includes("Sidebar");

    assert(
      adminHasNoSidebar,
      "TEST 1",
      "Main Admin Dashboard (/admin) has NO left sidebar completely removed"
    );

    // -------------------------------------------------------------------------
    // TEST 2: Main Admin Dashboard - Welcome Heading & Subtitle
    // -------------------------------------------------------------------------
    const hasHeading =
      adminPageSrc.includes("Welcome to Admin Dashboard") &&
      adminPageSrc.includes("Manage your platform data and tools from one place.");

    assert(
      hasHeading,
      "TEST 2",
      "Displays heading 'Welcome to Admin Dashboard' and subtitle 'Manage your platform data and tools from one place.'"
    );

    // -------------------------------------------------------------------------
    // TEST 3: Main Admin Dashboard - Top Navigation Header Controls
    // -------------------------------------------------------------------------
    const hasHeaderControls =
      adminHeaderSrc.includes("CreditWise") &&
      adminHeaderSrc.includes("bi-search") &&
      adminHeaderSrc.includes("bi-bell") &&
      adminHeaderSrc.includes("handleLogout");

    assert(
      hasHeaderControls,
      "TEST 3",
      "Admin header includes CreditWise AI branding, search, notifications, and profile menu"
    );

    // -------------------------------------------------------------------------
    // TEST 4: All 6 Dashboard Cards Navigate to Dedicated Routes (AI Model unified into AI Agent Studio)
    // -------------------------------------------------------------------------
    const cardsConfig = [
      { id: "Company Search", route: "/admin/company-search", sub: "Company data uploaded." },
      { id: "Bank Policy", route: "/admin/bank-policy", sub: "Policy knowledge base." },
      { id: "Bank Managers", route: "/admin/bank-managers", sub: "Manager directory and branch contacts." },
      { id: "Location & Contact", route: "/admin/location-contact", sub: "Locations and contact data." },
      { id: "Total Users", route: "/admin/users", sub: "View all users." },
      { id: "AI Agent Studio", route: "/admin/ai-agent-studio", sub: "Manage AI agents." },
    ];

    let allCardsCorrect = true;
    for (const card of cardsConfig) {
      const hasRoute = adminPageSrc.includes(`router.push("${card.route}")`);
      const hasSub = adminPageSrc.includes(card.sub);
      if (!hasRoute || !hasSub) {
        allCardsCorrect = false;
        console.error(`Card mismatch for: ${card.id} (route: ${hasRoute}, sub: ${hasSub})`);
      }
    }

    assert(
      allCardsCorrect,
      "TEST 4",
      "All 6 dashboard cards navigate to dedicated /admin/... routes with exact specified subtitles"
    );

    // -------------------------------------------------------------------------
    // TEST 5: HTTP 200 on All Dedicated Admin Routes
    // -------------------------------------------------------------------------
    const routesToTest = [
      { name: "Main Dashboard", path: "/admin" },
      { name: "Company Search", path: "/admin/company-search" },
      { name: "Bank Policy", path: "/admin/bank-policy" },
      { name: "Bank Managers", path: "/admin/bank-managers" },
      { name: "Location & Contact", path: "/admin/location-contact" },
      { name: "User Management", path: "/admin/users" },
      { name: "AI Model", path: "/admin/ai-model" },
      { name: "AI Agent Studio", path: "/admin/ai-agent-studio" },
    ];

    let allRoutesStatusOk = true;
    for (const r of routesToTest) {
      const res = await fetch(`${BASE_URL}${r.path}`, {
        headers: { Cookie: adminCookie },
      });
      if (res.status !== 200) {
        allRoutesStatusOk = false;
        console.error(`Route failed: ${r.name} (${r.path}) returned HTTP ${res.status}`);
      }
    }

    assert(
      allRoutesStatusOk,
      "TEST 5",
      "All dedicated admin routes respond with HTTP 200 on standalone direct load"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Dedicated Pages Use AdminHeader & Breadcrumbs (No Sidebar)
    // -------------------------------------------------------------------------
    const companyPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/company-search/page.tsx"), "utf-8");
    const policyPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/bank-policy/page.tsx"), "utf-8");
    const managersPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/bank-managers/page.tsx"), "utf-8");
    const locationPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/location-contact/page.tsx"), "utf-8");
    const usersPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/users/page.tsx"), "utf-8");
    const modelsPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/models/page.tsx"), "utf-8");
    const studioPageSrc = fs.readFileSync(path.join(process.cwd(), "app/agent-studio/page.tsx"), "utf-8");

    const allHaveAdminHeader =
      companyPageSrc.includes("<AdminHeader") &&
      policyPageSrc.includes("<AdminHeader") &&
      managersPageSrc.includes("<AdminHeader") &&
      locationPageSrc.includes("<AdminHeader") &&
      usersPageSrc.includes("<AdminHeader") &&
      modelsPageSrc.includes("<AdminHeader") &&
      studioPageSrc.includes("<AdminHeader");

    const noneHaveOldSidebar =
      !companyPageSrc.includes("<aside") &&
      !policyPageSrc.includes("<aside") &&
      !managersPageSrc.includes("<aside") &&
      !locationPageSrc.includes("<aside") &&
      !usersPageSrc.includes("<aside") &&
      !modelsPageSrc.includes("<aside");

    assert(
      allHaveAdminHeader && noneHaveOldSidebar,
      "TEST 6",
      "All dedicated admin pages use consistent AdminHeader with breadcrumbs and NO sidebar"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Breadcrumb & Return to Dashboard Navigation
    // -------------------------------------------------------------------------
    const hasClickableBreadcrumbs =
      adminHeaderSrc.includes('href="/admin"') &&
      adminHeaderSrc.includes("Admin Dashboard") &&
      adminHeaderSrc.includes("Back to Dashboard");

    assert(
      hasClickableBreadcrumbs,
      "TEST 7",
      "Breadcrumb navigation displays 'Admin Dashboard > [Page]' and links to /admin"
    );

    // -------------------------------------------------------------------------
    // TEST 8: Company Search Page - Database Records Section Removed
    // -------------------------------------------------------------------------
    const hasDatabaseRecordSection =
      companyPageSrc.includes("Database Records (") ||
      companyPageSrc.includes("activeTab === 'records'") ||
      companyPageSrc.includes("activeTab === \"records\"");

    const compFilesRes = await fetch(`${BASE_URL}/api/bank/files`, {
      headers: { Cookie: adminCookie },
    });
    const compFilesData = await compFilesRes.json();

    const compSectionClean =
      !hasDatabaseRecordSection &&
      compFilesRes.status === 200 &&
      Array.isArray(compFilesData.files);

    assert(
      compSectionClean,
      "TEST 8",
      `Database records section successfully removed from Company Search; Spreadsheets management active (${compFilesData.files?.length} files)`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Admin Dashboard Stats API (/api/admin/stats)
    // -------------------------------------------------------------------------
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    });
    const statsData = await statsRes.json();

    const statsWorking =
      statsRes.status === 200 &&
      statsData.success === true &&
      typeof statsData.stats?.companyRecords === "number" &&
      typeof statsData.stats?.totalUsers === "number" &&
      statsData.stats.companyRecords > 500000;

    assert(
      statsWorking,
      "TEST 9",
      `Dashboard Stats API returns real database counts (${statsData.stats?.companyRecords} companies, ${statsData.stats?.totalUsers} users)`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Security & RBAC - Unauthenticated Users Blocked
    // -------------------------------------------------------------------------
    const unauthAdmin = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
    const unauthCompany = await fetch(`${BASE_URL}/admin/company-search`, { redirect: "manual" });
    const unauthUsers = await fetch(`${BASE_URL}/admin/users`, { redirect: "manual" });

    const isUnauthBlocked =
      (unauthAdmin.status === 307 || unauthAdmin.status === 302 || unauthAdmin.status === 401) &&
      (unauthCompany.status === 307 || unauthCompany.status === 302 || unauthCompany.status === 401) &&
      (unauthUsers.status === 307 || unauthUsers.status === 302 || unauthUsers.status === 401);

    assert(
      isUnauthBlocked,
      "TEST 10",
      "Unauthenticated users are blocked from accessing protected admin routes"
    );

    // -------------------------------------------------------------------------
    // TEST 11: Security & RBAC - Non-Admin Users Blocked
    // -------------------------------------------------------------------------
    const nonAdminRes = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: userCookie },
      redirect: "manual",
    });

    const isNonAdminBlocked =
      nonAdminRes.status === 307 || nonAdminRes.status === 302 || nonAdminRes.status === 403;

    assert(
      isNonAdminBlocked,
      "TEST 11",
      "Non-admin users are blocked from accessing admin pages (RBAC guard verified)"
    );

    // -------------------------------------------------------------------------
    // TEST 12: Backward-Compatible Alias Routes Still Work
    // -------------------------------------------------------------------------
    const aliasRoutes = [
      { name: "Company Search Alias", path: "/company-search" },
      { name: "Bank Policy Alias", path: "/policies" },
      { name: "Bank Managers Alias", path: "/bank-managers" },
      { name: "Location Contact Alias", path: "/location-contact" },
      { name: "AI Models Alias", path: "/admin/models" },
      { name: "Agent Studio Alias", path: "/agent-studio" },
    ];

    let allAliasesOk = true;
    for (const a of aliasRoutes) {
      const res = await fetch(`${BASE_URL}${a.path}`, {
        headers: { Cookie: adminCookie },
      });
      if (res.status !== 200) {
        allAliasesOk = false;
        console.error(`Alias route failed: ${a.name} (${a.path}) returned HTTP ${res.status}`);
      }
    }

    assert(
      allAliasesOk,
      "TEST 12",
      "Backward-compatible alias routes respond with HTTP 200 without breaking bookmarks"
    );

    console.log("\n================================================================================");
    console.log(`VERIFICATION RESULTS: ${passed}/12 PASSED, ${failed} FAILED`);
    console.log("================================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTestSuite();
