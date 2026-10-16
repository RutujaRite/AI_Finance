/**
 * Verify Reset Code API route.
 * Pre-validates the 6-digit numeric OTP code for a given email address.
 * Allows multi-step UI verification before committing password changes.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, code } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Email address is required." },
        { status: 400 }
      );
    }

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json(
        { success: false, error: "6-digit verification code is required." },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Verification code must be exactly 6 digits." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const client = await pool.connect();

    try {
      const resetsRes = await client.query(
        `SELECT id, code_hash, expires_at, is_used 
         FROM password_resets 
         WHERE LOWER(TRIM(email)) = $1 
           AND is_used = false 
           AND expires_at > NOW() 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [normalizedEmail]
      );

      if (resetsRes.rowCount === 0) {
        return NextResponse.json(
          { success: false, error: "Verification code is invalid or has expired." },
          { status: 400 }
        );
      }

      let isValid = false;
      for (const row of resetsRes.rows) {
        const matches = await bcrypt.compare(cleanCode, row.code_hash);
        if (matches) {
          isValid = true;
          break;
        }
      }

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Incorrect verification code. Please check your email and try again." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Verification code verified successfully.",
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[VERIFY_CODE_ERROR]", err);
    return NextResponse.json(
      { success: false, error: "Failed to verify code. Please try again." },
      { status: 500 }
    );
  }
}
