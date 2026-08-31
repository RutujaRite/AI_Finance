/**
 * JWT authentication utilities.
 * Internal usage: auth API routes and protected API middleware.
 * Depends on: JWT_SECRET from .env
 */

// @ts-ignore
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export function signToken(payload: { id: number; email: string; name: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): { id: number; email: string; name: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: number; email: string; name: string; role: string };
  } catch {
    return null;
  }
}
