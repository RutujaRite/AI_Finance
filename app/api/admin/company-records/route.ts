import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, isAdminUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate admin user
    const token = request.cookies.get("token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!isAdminUser(user)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();
    const bankFilter = (searchParams.get("bank") || "").trim();
    const categoryFilter = (searchParams.get("category") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "25", 10)));
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
      // Build parameterized query
      const whereConditions: string[] = [];
      const queryValues: any[] = [];
      let paramIndex = 1;

      if (query) {
        whereConditions.push(
          `(company_name ILIKE $${paramIndex} OR company_category ILIKE $${paramIndex} OR other_info ILIKE $${paramIndex})`
        );
        queryValues.push(`%${query}%`);
        paramIndex++;
      }

      if (bankFilter && bankFilter !== "all") {
        whereConditions.push(`bank_name = $${paramIndex}`);
        queryValues.push(bankFilter);
        paramIndex++;
      }

      if (categoryFilter && categoryFilter !== "all") {
        whereConditions.push(`company_category = $${paramIndex}`);
        queryValues.push(categoryFilter);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      // 1. Fetch total count (optimized)
      let total = 0;
      if (whereConditions.length === 0) {
        // Fast table estimate or exact count
        const totalRes = await client.query("SELECT COUNT(*)::bigint as total FROM bank_company_data");
        total = Number(totalRes.rows[0]?.total || 0);
      } else {
        const countRes = await client.query(
          `SELECT COUNT(*)::bigint as total FROM bank_company_data ${whereClause}`,
          queryValues
        );
        total = Number(countRes.rows[0]?.total || 0);
      }

      // 2. Fetch page records
      const paginationParams = [...queryValues, limit, offset];
      const limitIndex = paramIndex;
      const offsetIndex = paramIndex + 1;

      const recordsRes = await client.query(
        `SELECT id, company_name, bank_name, company_category, other_info, sr_no, file_id
         FROM bank_company_data
         ${whereClause}
         ORDER BY id DESC
         LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        paginationParams
      );

      // 3. Fetch list of distinct banks for filter dropdown
      const banksRes = await client.query(
        "SELECT DISTINCT bank_name FROM bank_company_data WHERE bank_name IS NOT NULL AND bank_name <> '' ORDER BY bank_name ASC LIMIT 50"
      );
      const availableBanks = banksRes.rows.map((r) => r.bank_name);

      // 4. Fetch list of distinct categories for filter dropdown
      const catsRes = await client.query(
        "SELECT DISTINCT company_category FROM bank_company_data WHERE company_category IS NOT NULL AND company_category <> '' ORDER BY company_category ASC LIMIT 40"
      );
      const availableCategories = catsRes.rows.map((r) => r.company_category);

      return NextResponse.json({
        success: true,
        records: recordsRes.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        availableBanks,
        availableCategories,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error querying company records:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve company records" },
      { status: 500 }
    );
  }
}

// POST: Add new single company record
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!isAdminUser(user)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const companyName = (body.company_name || "").trim();
    const bankName = (body.bank_name || "").trim() || "Corporate Master";
    const category = (body.company_category || "").trim() || "Approved";
    const otherInfo = (body.other_info || "").trim();

    if (!companyName) {
      return NextResponse.json(
        { success: false, error: "Company name is required." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO bank_company_data (company_name, bank_name, company_category, other_info, sr_no)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, company_name, bank_name, company_category, other_info, sr_no`,
        [companyName, bankName, category, otherInfo, `MANUAL-${Date.now().toString(36).toUpperCase()}`]
      );

      return NextResponse.json({
        success: true,
        message: `Company record "${companyName}" created successfully.`,
        record: res.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error creating company record:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create company record" },
      { status: 500 }
    );
  }
}

// PUT: Update an existing company record
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!isAdminUser(user)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const id = parseInt(body.id, 10);
    const companyName = (body.company_name || "").trim();
    const bankName = (body.bank_name || "").trim() || "Corporate Master";
    const category = (body.company_category || "").trim() || "Approved";
    const otherInfo = (body.other_info || "").trim();

    if (!id || !companyName) {
      return NextResponse.json(
        { success: false, error: "Record ID and Company Name are required." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        `UPDATE bank_company_data
         SET company_name = $1, bank_name = $2, company_category = $3, other_info = $4
         WHERE id = $5
         RETURNING id, company_name, bank_name, company_category, other_info, sr_no`,
        [companyName, bankName, category, otherInfo, id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Record not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Company record "${companyName}" updated successfully.`,
        record: res.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error updating company record:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update company record" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a company record
export async function DELETE(request: NextRequest) {
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
    let id = parseInt(searchParams.get("id") || "0", 10);

    if (!id) {
      try {
        const body = await request.json();
        id = parseInt(body.id, 10);
      } catch {}
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Valid company record ID is required." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        "DELETE FROM bank_company_data WHERE id = $1 RETURNING id, company_name",
        [id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Record not found or already deleted." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Company record "${res.rows[0].company_name}" deleted successfully.`,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error deleting company record:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete company record" },
      { status: 500 }
    );
  }
}

