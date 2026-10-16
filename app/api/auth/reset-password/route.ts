/**
 * Reset Password API route.
 * Verifies 6-digit numeric OTP code against password_resets table:
 * - Checks code match with bcrypt.
 * - Checks expiration (< 15 mins) and unused status.
 * - Hashes new password (bcrypt >= 10 rounds) and updates users table.
 * - Marks the reset code as used.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, code, password, confirmPassword } = body;

    // 1. Input presence validation
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

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "New password is required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "New password and confirmation password do not match." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const client = await pool.connect();

    try {
      // 2. Fetch active, non-expired, unused reset records for this email
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
          { success: false, error: "Invalid or expired verification code. Please request a new code." },
          { status: 400 }
        );
      }

      // 3. Find matching code hash among active reset records
      let matchedResetId: string | null = null;
      for (const row of resetsRes.rows) {
        const matches = await bcrypt.compare(cleanCode, row.code_hash);
        if (matches) {
          matchedResetId = row.id;
          break;
        }
      }

      if (!matchedResetId) {
        return NextResponse.json(
          { success: false, error: "Invalid verification code. Please double-check the 6-digit code sent to your email." },
          { status: 400 }
        );
      }

      // 4. Verify user exists in users table
      const userRes = await client.query(
        "SELECT id, email FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1",
        [normalizedEmail]
      );

      if (userRes.rowCount === 0) {
        return NextResponse.json(
          { success: false, error: "User account could not be found." },
          { status: 404 }
        );
      }

      // 5. Hash new password with bcrypt (salt rounds = 10)
      const hashedPassword = await bcrypt.hash(password, 10);

      // 6. Update user's password in users table
      await client.query(
        "UPDATE users SET password = $1 WHERE LOWER(TRIM(email)) = $2",
        [hashedPassword, normalizedEmail]
      );

      // 7. Mark reset code as used to prevent replay attacks
      await client.query(
        "UPDATE password_resets SET is_used = true WHERE id = $1",
        [matchedResetId]
      );

      // Invalidate any other pending reset codes for this email as well
      await client.query(
        "UPDATE password_resets SET is_used = true WHERE LOWER(TRIM(email)) = $1 AND is_used = false",
        [normalizedEmail]
      );

      return NextResponse.json({
        success: true,
        message: "Your password has been successfully reset. You can now log in with your new password.",
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[RESET_PASSWORD_ERROR]", err);
    return NextResponse.json(
      { success: false, error: "Failed to reset password. Please try again later." },
      { status: 500 }
    );
  }
}
