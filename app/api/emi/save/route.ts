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
      clientName,
      clientPhone,
    } = body;

    const trimmedName = String(clientName || "").trim();
    const trimmedPhone = String(clientPhone || "").trim();

    if (!trimmedName) {
      return NextResponse.json({ success: false, error: "Client Name is required." }, { status: 400 });
    }
    if (!trimmedPhone) {
      return NextResponse.json({ success: false, error: "Client Contact Number is required." }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO emi_calculations
          (user_id, loan_type, loan_amount, annual_rate, processing_fee_percent,
           term_months, months_or_years, monthly_emi, total_interest,
           total_payment, processing_fee_amount, client_name, client_phone, schedule)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          payload.id,
          loanType || null,
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
      return NextResponse.json({ success: true, message: `Calculation saved for ${trimmedName}` });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("emi save error", err);
    return NextResponse.json({ success: false, error: "Save failed" });
  }
}
