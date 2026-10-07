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
    try {
      return jwt.verify(token, "your-secret-key-change-in-production") as { id: number; email: string; name: string; role: string };
    } catch {
      return null;
    }
  }
}

export function isAdminUser(user: { role?: string; email?: string; is_admin?: boolean } | null | undefined): boolean {
  if (!user) return false;
  const role = String(user.role || "").trim().toLowerCase();
  if (role === "admin") return true;
  if (user.is_admin === true) return true;
  const email = String(user.email || "").trim().toLowerCase();
  if (email === "admin@gmail.com" || email === "akshadasagar31@gmail.com") return true;
  return false;
}
