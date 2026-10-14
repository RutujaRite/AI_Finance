/**
 * Automated Test Suite: Admin Dashboard & User Management CRUD
 * Validates:
 * 1. Security & RBAC: unauthenticated (401), non-admin (403), admin authorization
 * 2. User CRUD:
 *    - CREATE: validation, duplicate check, bcrypt hashing
 *    - READ: list retrieval, counts
 *    - UPDATE: fields update, last-admin demote protection
 *    - DELETE: self-delete prevention, last-admin delete protection, clean deletion
 * 3. Dashboard Integration: live stats and recent activity API
 * 4. Route verification for all 7 cards
 */

import pool from "../lib/db";
import { signToken } from "../lib/auth";
import bcrypt from "bcryptjs";

const BASE_URL = "http://localhost:3001";

async function runTests() {
  console.log("============================================================");
  console.log("STARTING TEST SUITE: Admin Dashboard & User Management CRUD");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || "");
      failed++;
    }
  }

  try {
    // Generate JWT tokens
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

    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated request to /api/admin/users
    // -------------------------------------------------------------------------
    const unauthRes = await fetch(`${BASE_URL}/api/admin/users`);
    assert(
      unauthRes.status === 401,
      "Test 1: Unauthenticated request rejected with HTTP 401"
    );

    // -------------------------------------------------------------------------
    // TEST 2: Non-admin request to /api/admin/users
    // -------------------------------------------------------------------------
    const nonAdminRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Cookie: userCookie },
    });
    assert(
      nonAdminRes.status === 403,
      "Test 2: Non-admin request rejected with HTTP 403 Forbidden"
    );

    // -------------------------------------------------------------------------
    // TEST 3: Admin GET /api/admin/users (READ)
    // -------------------------------------------------------------------------
    const listRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Cookie: adminCookie },
    });
    const listData = await listRes.json();
    assert(
      listRes.status === 200 && listData.success === true && Array.isArray(listData.users),
      "Test 3: Admin successfully reads registered user accounts list",
      { totalUsers: listData.users?.length }
    );
    const initialCount = listData.users.length;

    // -------------------------------------------------------------------------
    // TEST 4: Validation on User Creation (Invalid email, short password)
    // -------------------------------------------------------------------------
    const invalidEmailRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ email: "invalid-email", password: "password123" }),
    });
    assert(
      invalidEmailRes.status === 400,
      "Test 4a: Create rejects invalid email format with HTTP 400"
    );

    const shortPassRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ email: "valid@example.com", password: "123" }),
    });
    assert(
      shortPassRes.status === 400,
      "Test 4b: Create rejects password under 6 characters with HTTP 400"
    );

    // -------------------------------------------------------------------------
    // TEST 5: Duplicate Email Check on Creation
    // -------------------------------------------------------------------------
    const dupRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ email: "admin@gmail.com", password: "securePassword123" }),
    });
    assert(
      dupRes.status === 400,
      "Test 5: Create rejects duplicate email address with HTTP 400"
    );

    // -------------------------------------------------------------------------
    // TEST 6: CREATE User (POST)
    // -------------------------------------------------------------------------
    const testEmail = `test_crud_${Date.now()}@example.com`;
    const createRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: "Test CRUD Agent",
        email: testEmail,
        password: "securePassword123",
        role: "user",
        status: "active",
      }),
    });
    const createData = await createRes.json();
    assert(
      createRes.status === 201 && createData.success === true && createData.user?.id,
      "Test 6: Successfully creates new user account",
      { createdUser: createData.user }
    );
    const createdUserId = createData.user?.id;

    // Verify password is not in response and correctly hashed in DB
    assert(
      createData.user?.password === undefined,
      "Test 6b: Sensitive password hash is NEVER exposed in API response"
    );

    const dbUserRes = await pool.query("SELECT password FROM users WHERE id = $1", [createdUserId]);
    const storedHash = dbUserRes.rows[0]?.password;
    const isPasswordValid = await bcrypt.compare("securePassword123", storedHash);
    assert(
      isPasswordValid === true,
      "Test 6c: Stored password in PostgreSQL is safely hashed with bcrypt"
    );

    // -------------------------------------------------------------------------
    // TEST 7: UPDATE User (PUT)
    // -------------------------------------------------------------------------
    const updateRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        id: createdUserId,
        name: "Updated CRUD Agent",
        email: testEmail,
        role: "user",
        status: "inactive",
      }),
    });
    const updateData = await updateRes.json();
    assert(
      updateRes.status === 200 &&
        updateData.success === true &&
        updateData.user?.name === "Updated CRUD Agent" &&
        updateData.user?.status === "inactive",
      "Test 7: Successfully updates user details (Name, Status)",
      { updatedUser: updateData.user }
    );

    // -------------------------------------------------------------------------
    // TEST 8: Protection: Cannot demote the last administrator
    // -------------------------------------------------------------------------
    const demoteRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        id: 1, // Admin account
        email: "admin@gmail.com",
        name: "Admin",
        role: "user", // Attempt to demote to user
        status: "active",
      }),
    });
    assert(
      demoteRes.status === 400,
      "Test 8: System prevents demoting the last active administrator"
    );

    // -------------------------------------------------------------------------
    // TEST 9: Protection: Self-Deletion Prevention
    // -------------------------------------------------------------------------
    const selfDeleteRes = await fetch(`${BASE_URL}/api/admin/users?id=1`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    assert(
      selfDeleteRes.status === 400,
      "Test 9: System prevents currently logged-in administrator from self-deleting"
    );

    // -------------------------------------------------------------------------
    // TEST 10: DELETE User (DELETE)
    // -------------------------------------------------------------------------
    const deleteRes = await fetch(`${BASE_URL}/api/admin/users?id=${createdUserId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie },
    });
    const deleteData = await deleteRes.json();
    assert(
      deleteRes.status === 200 && deleteData.success === true,
      "Test 10: Successfully deletes target user account",
      { deletedId: createdUserId }
    );

    // Verify user is gone from DB
    const verifyDel = await pool.query("SELECT id FROM users WHERE id = $1", [createdUserId]);
    assert(
      verifyDel.rowCount === 0,
      "Test 10b: Confirmed user is removed from PostgreSQL database"
    );

    // -------------------------------------------------------------------------
    // TEST 11: Admin Dashboard Stats API (/api/admin/stats)
    // -------------------------------------------------------------------------
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    });
    const statsData = await statsRes.json();
    assert(
      statsRes.status === 200 &&
        statsData.success === true &&
        typeof statsData.stats?.totalUsers === "number" &&
        statsData.activity?.companyData !== undefined,
      "Test 11: Admin Dashboard stats API returns live counts and activity timestamps",
      { stats: statsData.stats }
    );

    // -------------------------------------------------------------------------
    // TEST 12: Route Verification for All 7 Dashboard Card Targets
    // -------------------------------------------------------------------------
    const routesToTest = [
      { name: "Admin Dashboard", path: "/admin" },
      { name: "Company Search", path: "/company-search" },
      { name: "Bank Policy", path: "/policies" },
      { name: "Bank Managers", path: "/bank-managers" },
      { name: "Location & Contact", path: "/location-contact" },
      { name: "Total Users", path: "/admin/users" },
      { name: "AI Model", path: "/admin/models" },
      { name: "AI Agent Studio", path: "/agent-studio" },
    ];

    for (const r of routesToTest) {
      const pageRes = await fetch(`${BASE_URL}${r.path}`, {
        headers: { Cookie: adminCookie },
      });
      assert(
        pageRes.status === 200,
        `Test 12: Route '${r.name}' (${r.path}) responds with HTTP 200`
      );
    }

    console.log("\n============================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("============================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

runTests();
