/**
 * Forgot Password API route.
 * Initiates the password recovery flow:
 * - Generates secure 6-digit numeric verification code.
 * - Hashes code and stores with 15-minute expiry in password_resets table.
 * - Dispatches verification email.
 * - Prevents user enumeration by returning standard success response.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import pool from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address format." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // 1. Check if user exists in PostgreSQL users table
      const userRes = await client.query(
        "SELECT id, email, name FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1",
        [normalizedEmail]
      );

      // Return consistent success response even if email doesn't exist (prevents enumeration)
      if (userRes.rowCount === 0) {
        return NextResponse.json({
          success: true,
          message: "If an account exists with this email address, a 6-digit verification code has been sent.",
        });
      }

      const user = userRes.rows[0];

      // 2. Invalidate any existing unused reset codes for this email
      await client.query(
        "UPDATE password_resets SET is_used = true WHERE LOWER(TRIM(email)) = $1 AND is_used = false",
        [normalizedEmail]
      );

      // 3. Generate cryptographically random 6-digit numeric OTP code
      const numericCode = crypto.randomInt(100000, 1000000).toString();

      // 4. Hash the code with bcrypt for secure storage
      const codeHash = await bcrypt.hash(numericCode, 10);

      // 5. Expiration time: 15 minutes from now
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // 6. Insert reset record
      await client.query(
        "INSERT INTO password_resets (email, code_hash, expires_at, is_used) VALUES ($1, $2, $3, false)",
        [normalizedEmail, codeHash, expiresAt]
      );

      // 7. Dispatch verification email
      const emailResult = await sendPasswordResetEmail({
        toEmail: user.email || normalizedEmail,
        code: numericCode,
        recipientName: user.name || "Customer",
      });

      return NextResponse.json({
        success: true,
        message: "If an account exists with this email address, a 6-digit verification code has been sent.",
        ...(process.env.NODE_ENV !== "production" && emailResult.devCode ? { devCode: emailResult.devCode } : {}),
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[FORGOT_PASSWORD_ERROR]", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
