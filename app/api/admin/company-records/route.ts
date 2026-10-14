import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate admin user
    const token = request.cookies.get("token")?.value;
    const user = token ? verifyToken(token) : null;

    const isAdmin =
      user &&
      (String(user.role || "").trim().toLowerCase() === "admin" ||
        (user as any).is_admin === true ||
        String(user.email || "").toLowerCase() === "admin@gmail.com" ||
        String(user.email || "").toLowerCase() === "akshadasagar31@gmail.com" ||
        String(user.email || "").toLowerCase().startsWith("admin"));

    if (!isAdmin) {
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

      return NextResponse.json({
        success: true,
        records: recordsRes.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        availableBanks,
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
