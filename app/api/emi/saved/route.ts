/**
 * Saved EMI calculations API route.
 * GET: Retrieve up to 10 saved EMI calculations for the authenticated user.
 * DELETE: Delete a saved EMI calculation owned by the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { verifyToken } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT
           id,
           loan_type AS "loanType",
           loan_amount AS "principal",
           annual_rate AS "annualRate",
           processing_fee_percent AS "feePercent",
           term_months AS "termMonths",
           months_or_years AS "monthsOrYears",
           monthly_emi AS "emi",
           total_interest AS "totalInterest",
           total_payment AS "totalPayment",
           processing_fee_amount AS "processingFeeAmount",
           COALESCE(client_name, 'EMI Calculation') AS "calculationName",
           schedule,
           created_at AS "createdAt"
         FROM emi_calculations
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [payload.id]
      );

      const calculations = res.rows.map((row) => ({
        ...row,
        principal: Number(row.principal) || 0,
        annualRate: Number(row.annualRate) || 0,
        feePercent: Number(row.feePercent) || 0,
        termMonths: Number(row.termMonths) || 0,
        emi: Number(row.emi) || 0,
        totalInterest: Number(row.totalInterest) || 0,
        totalPayment: Number(row.totalPayment) || 0,
        processingFeeAmount: Number(row.processingFeeAmount) || 0,
        schedule: typeof row.schedule === "string" ? JSON.parse(row.schedule) : (row.schedule || []),
      }));

      return NextResponse.json({
        success: true,
        calculations,
        count: calculations.length,
        maxLimit: 10,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("fetch saved emi error", err);
    return NextResponse.json({ success: false, error: "Failed to retrieve saved calculations" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const idStr = searchParams.get("id");
  const id = idStr ? parseInt(idStr, 10) : null;

  if (!id || isNaN(id)) {
    return NextResponse.json({ success: false, error: "Calculation ID is required" }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `DELETE FROM emi_calculations
         WHERE id = $1 AND user_id = $2
         RETURNING id, client_name`,
        [id, payload.id]
      );

      if (res.rowCount === 0) {
        return NextResponse.json({ success: false, error: "Calculation not found or unauthorized" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Calculation #${id} removed successfully`,
        id,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("delete saved emi error", err);
    return NextResponse.json({ success: false, error: "Failed to delete calculation" }, { status: 500 });
  }
}
