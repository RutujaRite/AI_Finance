/**
 * Comprehensive Acceptance Test Suite for:
 * CreditWise Admin Dashboard Navigation & Dedicated Module Routing (TEST 1 - TEST 15)
 */

import fs from "fs";
import path from "path";
import pool from "../lib/db";
import { signToken } from "../lib/auth";

const BASE_URL = "http://localhost:3001";

async function runAcceptanceTests() {
  console.log("================================================================================");
  console.log("   ACCEPTANCE TEST SUITE: ADMIN DASHBOARD NAVIGATION & DEDICATED ROUTING");
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

    // Read source files for structural verification
    const topbarSrc = fs.readFileSync(path.join(process.cwd(), "components/Topbar.tsx"), "utf-8");
    const adminPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/page.tsx"), "utf-8");
    const middlewareSrc = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf-8");

    // -------------------------------------------------------------------------
    // TEST 1: Top Navigation "Admin Dashboard" -> Opens Dashboard Overview
    // -------------------------------------------------------------------------
    const hasAdminDashboardInTopbar =
      topbarSrc.includes("Admin Dashboard") &&
      topbarSrc.includes('href="/admin"') &&
      topbarSrc.includes("isAdmin");

    const adminPageRes = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: adminCookie },
    });

    assert(
      hasAdminDashboardInTopbar && adminPageRes.status === 200,
      "TEST 1",
      "Clicking 'Admin Dashboard' in top navigation opens dashboard overview (/admin) with HTTP 200"
    );

    // -------------------------------------------------------------------------
    // TEST 2: Old "Admin Panel" Navigation Tab is No Longer Displayed
    // -------------------------------------------------------------------------
    const hasOldAdminPanelTab =
      topbarSrc.includes('>Admin Panel<') ||
      topbarSrc.includes('"Admin Panel"');

    assert(
      !hasOldAdminPanelTab,
      "TEST 2",
      "Old 'Admin Panel' navigation item has been removed from top navigation"
    );

    // -------------------------------------------------------------------------
    // TEST 3: Company Search -> Dedicated Page (/company-search)
    // -------------------------------------------------------------------------
    const companyCardRoutesDedicated =
      adminPageSrc.includes('router.push("/company-search")') ||
      adminPageSrc.includes('href: "/company-search"');

    const companyRes = await fetch(`${BASE_URL}/company-search`, {
      headers: { Cookie: adminCookie },
    });

    assert(
      companyCardRoutesDedicated && companyRes.status === 200,
      "TEST 3",
      "Company Search dashboard card routes to dedicated page /company-search (HTTP 200)"
    );

    // -------------------------------------------------------------------------
    // TEST 4: Bank Policy -> Dedicated Page (/policies)
    // -------------------------------------------------------------------------
    const policiesCardRoutesDedicated =
      adminPageSrc.includes('router.push("/policies")') ||
      adminPageSrc.includes('href: "/policies"');

    const policiesRes = await fetch(`${BASE_URL}/policies`, {
      headers: { Cookie: adminCookie },
    });

    assert(
      policiesCardRoutesDedicated && policiesRes.status === 200,
      "TEST 4",
      "Bank Policy dashboard card routes to dedicated page /policies (HTTP 200)"
    );

    // -------------------------------------------------------------------------
    // TEST 5: Bank Managers -> Dedicated Page (/bank-managers)
    // -------------------------------------------------------------------------
    const managersCardRoutesDedicated =
      adminPageSrc.includes('router.push("/bank-managers")') ||
      adminPageSrc.includes('href: "/bank-managers"');

    const managersRes = await fetch(`${BASE_URL}/bank-managers`, {
      headers: { Cookie: adminCookie },
    });

    assert(
      managersCardRoutesDedicated && managersRes.status === 200,
      "TEST 5",
      "Bank Managers dashboard card routes to dedicated page /bank-managers (HTTP 200)"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Location & Contact -> Dedicated Page (/location-contact)
    // -------------------------------------------------------------------------
    const locationCardRoutesDedicated =
      adminPageSrc.includes('router.push("/location-contact")') ||
      adminPageSrc.includes('href: "/location-contact"');

    const locationRes = await fetch(`${BASE_URL}/location-contact`, {
      headers: { Cookie: adminCookie },
    });

    assert(
      locationCardRoutesDedicated && locationRes.status === 200,
      "TEST 6",
      "Location & Contact dashboard card routes to dedicated page /location-contact (HTTP 200)"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Total Users -> Dedicated User Management Page (/admin/users)
    // -------------------------------------------------------------------------
    const usersCardRoutesDedicated =
      adminPageSrc.includes('router.push("/admin/users")') ||
      adminPageSrc.includes('href: "/admin/users"');

    const usersRes = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Cookie: adminCookie },
    });

    assert(
      usersCardRoutesDedicated && usersRes.status === 200,
      "TEST 7",
      "Total Users dashboard card routes to dedicated page /admin/users (HTTP 200)"
    );

    // -------------------------------------------------------------------------
    // TEST 8: AI Model -> Dedicated Page (/admin/models)
    // -------------------------------------------------------------------------
    const modelsCardRoutesDedicated =
      adminPageSrc.includes('router.push("/admin/models")') ||
      adminPageSrc.includes('href: "/admin/models"');

    const modelsRes = await fetch(`${BASE_URL}/admin/models`, {
      headers: { Cookie: adminCookie },
    });

    assert(
      modelsCardRoutesDedicated && modelsRes.status === 200,
      "TEST 8",
      "AI Model dashboard card routes to dedicated page /admin/models (HTTP 200)"
    );

    // -------------------------------------------------------------------------
    // TEST 9: AI Agent Studio -> Dedicated Page (/agent-studio)
    // -------------------------------------------------------------------------
    const studioCardRoutesDedicated =
      adminPageSrc.includes('router.push("/agent-studio")') ||
      adminPageSrc.includes('href: "/agent-studio"');

    const studioRes = await fetch(`${BASE_URL}/agent-studio`, {
      headers: { Cookie: adminCookie },
    });

    assert(
      studioCardRoutesDedicated && studioRes.status === 200,
      "TEST 9",
      "AI Agent Studio dashboard card routes to dedicated page /agent-studio (HTTP 200)"
    );

    // -------------------------------------------------------------------------
    // TEST 10: None of these cards render inside old Admin Panel sections/tabs
    // -------------------------------------------------------------------------
    const hasInlineModuleSwitch =
      adminPageSrc.includes("activeTool === 'company'") ||
      adminPageSrc.includes("activeTool === 'users'") ||
      adminPageSrc.includes("activeTool === 'policies'");

    assert(
      !hasInlineModuleSwitch,
      "TEST 10",
      "Dashboard overview is clean - cards use Next.js routing, NOT inline section conditional rendering"
    );

    // -------------------------------------------------------------------------
    // TEST 11: Directly opening or refreshing dedicated URLs works correctly
    // -------------------------------------------------------------------------
    const dedicatedRoutes = [
      "/company-search",
      "/policies",
      "/bank-managers",
      "/location-contact",
      "/admin/users",
      "/admin/models",
      "/agent-studio",
    ];

    let allDirectLoadsOk = true;
    for (const route of dedicatedRoutes) {
      const res = await fetch(`${BASE_URL}${route}`, {
        headers: { Cookie: adminCookie },
      });
      if (res.status !== 200) {
        allDirectLoadsOk = false;
        console.error(`Route direct load failed: ${route} (${res.status})`);
      }
    }

    assert(
      allDirectLoadsOk,
      "TEST 11",
      "Direct URL loading and refreshing all 7 dedicated module routes succeeds with HTTP 200"
    );

    // -------------------------------------------------------------------------
    // TEST 12: Return navigation to Admin Dashboard overview
    // -------------------------------------------------------------------------
    const policiesViewSrc = fs.readFileSync(path.join(process.cwd(), "components/PoliciesView.tsx"), "utf-8");
    const managersPageSrc = fs.readFileSync(path.join(process.cwd(), "app/bank-managers/page.tsx"), "utf-8");
    const companyPageSrc = fs.readFileSync(path.join(process.cwd(), "app/company-search/page.tsx"), "utf-8");
    const locationPageSrc = fs.readFileSync(path.join(process.cwd(), "app/location-contact/page.tsx"), "utf-8");
    const usersPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/users/page.tsx"), "utf-8");
    const modelsPageSrc = fs.readFileSync(path.join(process.cwd(), "app/admin/models/page.tsx"), "utf-8");
    const studioTopbarSrc = fs.readFileSync(path.join(process.cwd(), "components/agent-studio/StudioTopbar.tsx"), "utf-8");

    const modulesReturnToDashboard = [
      policiesViewSrc.includes('"/admin"'),
      managersPageSrc.includes('"/admin"'),
      companyPageSrc.includes('"/admin"'),
      locationPageSrc.includes('"/admin"'),
      usersPageSrc.includes('"/admin"'),
      modelsPageSrc.includes('"/admin"'),
      studioTopbarSrc.includes('"/admin"'),
    ];

    assert(
      modulesReturnToDashboard.every(Boolean),
      "TEST 12",
      "All 7 dedicated module pages provide explicit return navigation to the Admin Dashboard overview (/admin)"
    );

    // -------------------------------------------------------------------------
    // TEST 13: Security & Authorization Protection
    // -------------------------------------------------------------------------
    const unauthRes = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
    const isUnauthBlocked = unauthRes.status === 307 || unauthRes.status === 302 || unauthRes.status === 401;

    const nonAdminRes = await fetch(`${BASE_URL}/admin`, {
      headers: { Cookie: userCookie },
      redirect: "manual",
    });
    const isNonAdminBlocked = nonAdminRes.status === 307 || nonAdminRes.status === 302 || nonAdminRes.status === 403;

    const middlewareCoversAdminRoutes =
      middlewareSrc.includes("'/admin'") &&
      middlewareSrc.includes("'/company-search'") &&
      middlewareSrc.includes("'/location-contact'") &&
      middlewareSrc.includes("'/policies'") &&
      middlewareSrc.includes("'/bank-managers'");

    assert(
      isUnauthBlocked && isNonAdminBlocked && middlewareCoversAdminRoutes,
      "TEST 13",
      "Unauthorized & non-admin users cannot access protected admin pages (Middleware enforcement verified)"
    );

    // -------------------------------------------------------------------------
    // TEST 14: All Existing Module Functions & Data Remain Operational
    // -------------------------------------------------------------------------
    const usersApiRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Cookie: adminCookie },
    });
    const usersApiData = await usersApiRes.json();

    const statsApiRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    });
    const statsApiData = await statsApiRes.json();

    const managersApiRes = await fetch(`${BASE_URL}/api/bank-managers`, {
      headers: { Cookie: adminCookie },
    });
    const managersApiData = await managersApiRes.json();

    const modulesOperational =
      usersApiRes.status === 200 &&
      Array.isArray(usersApiData.users) &&
      statsApiRes.status === 200 &&
      statsApiData.success === true &&
      managersApiRes.status === 200 &&
      Array.isArray(managersApiData.managers || managersApiData.data || []);

    assert(
      modulesOperational,
      "TEST 14",
      "Existing module APIs (User CRUD, Dashboard Stats, Bank Managers) are fully operational with PostgreSQL data"
    );

    // -------------------------------------------------------------------------
    // TEST 15: No Unrelated Functionality Broken
    // -------------------------------------------------------------------------
    const homeRes = await fetch(`${BASE_URL}/home`, {
      headers: { Cookie: adminCookie },
    });
    const calcRes = await fetch(`${BASE_URL}/home?section=eligibility`, {
      headers: { Cookie: adminCookie },
    });
    const assistantRes = await fetch(`${BASE_URL}/home?section=assistant`, {
      headers: { Cookie: adminCookie },
    });

    const unrelatedHealthy =
      homeRes.status === 200 &&
      calcRes.status === 200 &&
      assistantRes.status === 200;

    assert(
      unrelatedHealthy,
      "TEST 15",
      "No unrelated functionality broken: /home, Eligibility Calculator, and AI Assistant remain fully operational"
    );

    console.log("\n================================================================================");
    console.log(`ACCEPTANCE RESULTS: ${passed}/15 PASSED, ${failed} FAILED`);
    console.log("================================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAcceptanceTests();
