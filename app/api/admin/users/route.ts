/**
 * Admin users CRUD API route.
 * Handles Create, Read, Update, Delete for registered users (Admin only).
 * Uses: lib/db, lib/auth (verifyToken, isAdminUser), bcryptjs
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { verifyToken, isAdminUser } from "../../../../lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminAuth(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return { authorized: false, error: "Not authenticated", status: 401, payload: null };
  }
  if (!isAdminUser(payload)) {
    return {
      authorized: false,
      error: "Admin privileges required",
      status: 403,
      payload: null,
    };
  }
  return { authorized: true, error: null, status: 200, payload };
}

// -----------------------------------------------------------------------------
// READ ALL USERS
// -----------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = getAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT id, name, email, role, status, created_at, last_login FROM users ORDER BY created_at DESC"
    );
    return NextResponse.json({
      success: true,
      users: res.rows,
      total: res.rows.length,
    });
  } catch (err: any) {
    console.error("List users error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve user list", users: [] },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// CREATE USER
// -----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = getAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 });
  }

  const { name, email, password, role, status } = body;

  // Validation
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedName = String(name || "").trim();
  const trimmedPassword = String(password || "");
  const assignedRole = role === "admin" ? "admin" : "user";
  const accountStatus = status === "inactive" ? "inactive" : "active";

  if (!trimmedEmail) {
    return NextResponse.json({ success: false, error: "Email address is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });
  }

  if (!trimmedPassword || trimmedPassword.length < 6) {
    return NextResponse.json(
      { success: false, error: "Password must be at least 6 characters long" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // Check duplicate email
    const existing = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [trimmedEmail]
    );
    if ((existing.rowCount ?? 0) > 0) {
      return NextResponse.json(
        { success: false, error: "A user with this email address is already registered" },
        { status: 400 }
      );
    }

    // Securely hash password
    const passwordHash = await bcrypt.hash(trimmedPassword, 10);

    const result = await client.query(
      `INSERT INTO users (name, email, password, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, status, created_at, last_login`,
      [trimmedName || null, trimmedEmail, passwordHash, assignedRole, accountStatus]
    );

    const newUser = result.rows[0];

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        user: newUser,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Create user error:", err);
    return NextResponse.json(
      { success: false, error: "Database error creating user" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// UPDATE USER
// -----------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  const auth = getAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 });
  }

  const { id, name, email, password, role, status } = body;
  const targetId = Number(id);

  if (!targetId || isNaN(targetId)) {
    return NextResponse.json({ success: false, error: "Valid User ID is required" }, { status: 400 });
  }

  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedName = String(name || "").trim();
  const trimmedPassword = password ? String(password).trim() : "";
  const assignedRole = role === "admin" ? "admin" : "user";
  const accountStatus = status === "inactive" ? "inactive" : "active";

  if (!trimmedEmail) {
    return NextResponse.json({ success: false, error: "Email address is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });
  }

  if (trimmedPassword && trimmedPassword.length < 6) {
    return NextResponse.json(
      { success: false, error: "New password must be at least 6 characters long" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // Check target user existence
    const targetCheck = await client.query(
      "SELECT id, role, status, email FROM users WHERE id = $1 LIMIT 1",
      [targetId]
    );

    if (targetCheck.rowCount === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const currentTarget = targetCheck.rows[0];

    // Check duplicate email across other users
    const emailCheck = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1",
      [trimmedEmail, targetId]
    );
    if ((emailCheck.rowCount ?? 0) > 0) {
      return NextResponse.json(
        { success: false, error: "Email is already in use by another account" },
        { status: 400 }
      );
    }

    // Safety: Protect last active administrator from losing admin role or becoming inactive
    const isCurrentTargetAdmin =
      String(currentTarget.role || "").toLowerCase() === "admin";
    const willBeAdmin = assignedRole === "admin" && accountStatus === "active";

    if (isCurrentTargetAdmin && !willBeAdmin) {
      const adminCountRes = await client.query(
        "SELECT COUNT(*) FROM users WHERE role = 'admin' AND (status = 'active' OR status IS NULL) AND id != $1",
        [targetId]
      );
      const remainingAdmins = parseInt(adminCountRes.rows[0]?.count || "0", 10);
      if (remainingAdmins === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot demote or deactivate the last active administrator account",
          },
          { status: 400 }
        );
      }
    }

    let updatedUser;
    if (trimmedPassword) {
      const passwordHash = await bcrypt.hash(trimmedPassword, 10);
      const updateRes = await client.query(
        `UPDATE users
         SET name = $1, email = $2, password = $3, role = $4, status = $5
         WHERE id = $6
         RETURNING id, name, email, role, status, created_at, last_login`,
        [trimmedName || null, trimmedEmail, passwordHash, assignedRole, accountStatus, targetId]
      );
      updatedUser = updateRes.rows[0];
    } else {
      const updateRes = await client.query(
        `UPDATE users
         SET name = $1, email = $2, role = $3, status = $4
         WHERE id = $5
         RETURNING id, name, email, role, status, created_at, last_login`,
        [trimmedName || null, trimmedEmail, assignedRole, accountStatus, targetId]
      );
      updatedUser = updateRes.rows[0];
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("Update user error:", err);
    return NextResponse.json(
      { success: false, error: "Database error updating user" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// DELETE USER
// -----------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const auth = getAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  // Parse ID from query param ?id= or JSON body
  const urlId = req.nextUrl.searchParams.get("id");
  let targetId: number | null = urlId ? Number(urlId) : null;

  if (!targetId || isNaN(targetId)) {
    try {
      const body = await req.json();
      if (body?.id) targetId = Number(body.id);
    } catch {}
  }

  if (!targetId || isNaN(targetId)) {
    return NextResponse.json(
      { success: false, error: "Valid User ID is required for deletion" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const targetCheck = await client.query(
      "SELECT id, name, email, role FROM users WHERE id = $1 LIMIT 1",
      [targetId]
    );

    if (targetCheck.rowCount === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const targetUser = targetCheck.rows[0];

    // Protection 1: Prevent currently logged-in administrator from deleting their own account
    const currentAdminId = auth.payload?.id;
    const currentAdminEmail = String(auth.payload?.email || "").toLowerCase();

    if (
      targetId === currentAdminId ||
      String(targetUser.email || "").toLowerCase() === currentAdminEmail
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot delete your own administrator account while logged in",
        },
        { status: 400 }
      );
    }

    // Protection 2: Prevent deletion of the last remaining administrator
    const isTargetAdmin = String(targetUser.role || "").toLowerCase() === "admin";
    if (isTargetAdmin) {
      const adminCountRes = await client.query(
        "SELECT COUNT(*) FROM users WHERE role = 'admin' AND id != $1",
        [targetId]
      );
      const remainingAdmins = parseInt(adminCountRes.rows[0]?.count || "0", 10);
      if (remainingAdmins === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot delete the only remaining administrator account in the system",
          },
          { status: 400 }
        );
      }
    }

    // Safe deletion: schema has ON DELETE SET NULL / CASCADE on foreign keys
    await client.query("DELETE FROM users WHERE id = $1", [targetId]);

    return NextResponse.json({
      success: true,
      message: `User ${targetUser.email} was deleted successfully`,
      deletedId: targetId,
    });
  } catch (err: any) {
    console.error("Delete user error:", err);
    return NextResponse.json(
      { success: false, error: "Database error deleting user" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
