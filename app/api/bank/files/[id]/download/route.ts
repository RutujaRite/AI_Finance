/**
 * Bank file download API route.
 * Streams the requested file from disk as an attachment.
 * Uses: lib/db, lib/auth (verifyToken)
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import path from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "bank-pdfs");
const URL_PREFIX = "/uploads/bank-pdfs/";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("id");
    if (!fileId) {
      return NextResponse.json({ success: false, error: "Missing file id" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query("SELECT file_name, file_path FROM bank_uploaded_files WHERE id = $1", [Number(fileId)]);
      if (res.rowCount === 0) {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }

      const { file_name, file_path } = res.rows[0];
      if (!file_path || !file_path.startsWith(URL_PREFIX)) {
        return NextResponse.json({ success: false, error: "File not found on disk" }, { status: 404 });
      }

      const fileName = file_path.replace(URL_PREFIX, "");
      const fullPath = path.join(UPLOAD_DIR, fileName);
      if (!existsSync(fullPath)) {
        return NextResponse.json({ success: false, error: "File not found on disk" }, { status: 404 });
      }

      const fileBuffer = await readFile(fullPath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file_name)}"`,
        },
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("download bank file error", err);
    return NextResponse.json({ success: false, error: "Could not download the file" }, { status: 500 });
  }
}
