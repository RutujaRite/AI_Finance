/**
 * EMI save API route.
 * Persists a user's EMI calculation to the `emi_calculations` table.
 * Uses: lib/db, lib/auth (verifyToken)
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { verifyToken } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      loanType,
      principal,
      annualRate,
      feePercent,
      termMonths,
      monthsOrYears,
      emi,
      totalInterest,
      totalPayment,
      processingFeeAmount,
      schedule,
      calculationName,
      clientName,
      clientPhone,
    } = body;

    const trimmedName =
      String(calculationName || clientName || "").trim() ||
      `${loanType || "Loan"} • ₹${Number(principal || 0).toLocaleString("en-IN")}`;
    const trimmedPhone = String(clientPhone || "").trim();

    const client = await pool.connect();
    try {
      // 1. Check existing saved calculations count for this user
      const existingRes = await client.query(
        `SELECT id, client_name, created_at
         FROM emi_calculations
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [payload.id]
      );

      let replacedOldestName: string | null = null;

      // 2. FIFO: If 10 or more exist, remove the oldest calculation(s) so count becomes 9
      if (existingRes.rows.length >= 10) {
        const deleteCount = existingRes.rows.length - 9;
        const toDelete = existingRes.rows.slice(0, deleteCount);
        const idsToDelete = toDelete.map((r: any) => r.id);
        replacedOldestName = toDelete[0]?.client_name || `Calculation #${toDelete[0]?.id}`;

        await client.query(
          `DELETE FROM emi_calculations
           WHERE id = ANY($1::int[]) AND user_id = $2`,
          [idsToDelete, payload.id]
        );
      }

      // 3. Insert the new calculation
      const insertRes = await client.query(
        `INSERT INTO emi_calculations
          (user_id, loan_type, loan_amount, annual_rate, processing_fee_percent,
           term_months, months_or_years, monthly_emi, total_interest,
           total_payment, processing_fee_amount, client_name, client_phone, schedule)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, created_at`,
        [
          payload.id,
          loanType || "Personal Loan",
          principal || 0,
          annualRate || 0,
          feePercent || 0,
          termMonths || 0,
          monthsOrYears || null,
          emi || 0,
          totalInterest || 0,
          totalPayment || 0,
          processingFeeAmount || 0,
          trimmedName,
          trimmedPhone,
          schedule ? JSON.stringify(schedule) : null,
        ]
      );

      const newId = insertRes.rows[0]?.id;

      return NextResponse.json({
        success: true,
        id: newId,
        calculationName: trimmedName,
        message: replacedOldestName
          ? `Saved "${trimmedName}" (Replaced oldest: "${replacedOldestName}")`
          : `Saved "${trimmedName}"`,
        replacedOldest: replacedOldestName,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("emi save error", err);
    return NextResponse.json({ success: false, error: "Save failed" }, { status: 500 });
  }
}
