/**
 * Bank managers & locations list & CRUD API route.
 * GET: Returns paginated bank managers with search, bank filter, city filter, and distinct filter lists.
 * POST: Create/add a single bank manager record.
 * PUT: Update an existing bank manager record by id.
 * DELETE: Remove a bank manager record by id.
 * Uses: lib/db, lib/auth
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, isAdminUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!isAdminUser(user)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();
    const bankFilter = (searchParams.get("bank") || "").trim();
    const cityFilter = (searchParams.get("city") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "25", 10)));
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
      const whereClauses: string[] = ["1=1"];
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (query) {
        whereClauses.push(
          `(bm.name ILIKE $${paramIndex} OR bm.bank_name ILIKE $${paramIndex} OR bm.branch ILIKE $${paramIndex} OR bm.location ILIKE $${paramIndex} OR bm.city ILIKE $${paramIndex} OR bm.phone ILIKE $${paramIndex} OR bm.email ILIKE $${paramIndex})`
        );
        queryParams.push(`%${query}%`);
        paramIndex++;
      }

      if (bankFilter && bankFilter.toLowerCase() !== "all") {
        whereClauses.push(`bm.bank_name = $${paramIndex}`);
        queryParams.push(bankFilter);
        paramIndex++;
      }

      if (cityFilter && cityFilter.toLowerCase() !== "all") {
        whereClauses.push(`(bm.city ILIKE $${paramIndex} OR bm.location ILIKE $${paramIndex})`);
        queryParams.push(`%${cityFilter}%`);
        paramIndex++;
      }

      const whereSql = whereClauses.join(" AND ");

      // 1. Total matching count
      const countRes = await client.query(
        `SELECT COUNT(*) FROM bank_managers bm WHERE ${whereSql}`,
        queryParams
      );
      const total = parseInt(countRes.rows[0].count, 10) || 0;

      // 2. Fetch records
      const selectParams = [...queryParams, limit, offset];
      const recordsRes = await client.query(
        `SELECT 
          bm.id,
          bm.bank_name,
          bm.name,
          bm.role,
          bm.phone,
          bm.email,
          bm.location,
          bm.city,
          bm.district,
          bm.state,
          bm.branch,
          bm.employee_code,
          bm.status,
          bm.created_at
         FROM bank_managers bm
         WHERE ${whereSql}
         ORDER BY bm.bank_name ASC, bm.name ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        selectParams
      );

      // 3. Available banks for dropdown
      const banksRes = await client.query(
        `SELECT DISTINCT bank_name FROM bank_managers WHERE bank_name IS NOT NULL AND bank_name <> '' ORDER BY bank_name ASC LIMIT 50`
      );
      const availableBanks = banksRes.rows.map((r) => r.bank_name);

      // 4. Available cities for dropdown
      const citiesRes = await client.query(
        `SELECT DISTINCT COALESCE(NULLIF(city, ''), NULLIF(location, '')) as city_name 
         FROM bank_managers 
         WHERE COALESCE(NULLIF(city, ''), NULLIF(location, '')) IS NOT NULL 
         ORDER BY city_name ASC 
         LIMIT 60`
      );
      const availableCities = citiesRes.rows.map((r) => r.city_name).filter(Boolean);

      return NextResponse.json({
        success: true,
        managers: recordsRes.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        availableBanks,
        availableCities,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error querying bank managers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve bank managers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!isAdminUser(user)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const bankName = (body.bank_name || "").trim();
    const name = (body.name || body.manager_name || "").trim();
    const role = (body.role || "Branch Manager").trim();
    const phone = (body.phone || body.mobile_number || "").trim();
    const email = (body.email || "").trim();
    const location = (body.location || body.address || body.city || "Branch Location").trim();
    const city = (body.city || "").trim();
    const state = (body.state || "").trim();
    const branch = (body.branch || body.branch_name || "").trim();
    const employeeCode = (body.employee_code || body.branch_code || "").trim();
    const status = (body.status || "active").trim();

    if (!bankName || !name) {
      return NextResponse.json(
        { success: false, error: "Bank Name and Manager Name are required." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO bank_managers (bank_name, name, role, phone, email, location, city, state, branch, employee_code, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
         RETURNING id, bank_name, name, role, phone, email, location, city, state, branch, employee_code, status, created_at`,
        [bankName, name, role, phone, email, location, city, state, branch, employeeCode, status]
      );

      return NextResponse.json({
        success: true,
        message: `Manager record for "${name}" (${bankName}) created successfully.`,
        manager: res.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error creating bank manager record:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create manager record" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!isAdminUser(user)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const id = parseInt(body.id, 10);
    const bankName = (body.bank_name || "").trim();
    const name = (body.name || body.manager_name || "").trim();
    const role = (body.role || "Branch Manager").trim();
    const phone = (body.phone || body.mobile_number || "").trim();
    const email = (body.email || "").trim();
    const location = (body.location || body.address || body.city || "Branch Location").trim();
    const city = (body.city || "").trim();
    const state = (body.state || "").trim();
    const branch = (body.branch || body.branch_name || "").trim();
    const employeeCode = (body.employee_code || body.branch_code || "").trim();
    const status = (body.status || "active").trim();

    if (!id || !bankName || !name) {
      return NextResponse.json(
        { success: false, error: "Record ID, Bank Name, and Manager Name are required." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        `UPDATE bank_managers
         SET bank_name = $1, name = $2, role = $3, phone = $4, email = $5, location = $6, city = $7, state = $8, branch = $9, employee_code = $10, status = $11
         WHERE id = $12
         RETURNING id, bank_name, name, role, phone, email, location, city, state, branch, employee_code, status, created_at`,
        [bankName, name, role, phone, email, location, city, state, branch, employeeCode, status, id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Manager record not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Manager record for "${name}" updated successfully.`,
        manager: res.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error updating bank manager record:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update manager record" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!isAdminUser(user)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    let id = parseInt(searchParams.get("id") || "0", 10);

    if (!id) {
      try {
        const body = await req.json();
        if (body.id) id = parseInt(body.id, 10);
      } catch {
        // no body
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Manager Record ID is required." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const res = await client.query(`DELETE FROM bank_managers WHERE id = $1 RETURNING id, name`, [id]);
      if (res.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Record not found or already deleted." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Manager record "${res.rows[0].name}" (ID #${id}) deleted successfully.`,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error deleting bank manager record:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete manager record" },
      { status: 500 }
    );
  }
}
