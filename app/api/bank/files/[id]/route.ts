/**
 * Dynamic route for single bank / company data file.
 * Handles:
 * GET: retrieve details and statistics for a specific file.
 * DELETE: delete the file record, disk file, and associated company data records.
 * Uses: lib/db, lib/auth (verifyToken, isAdminUser)
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, isAdminUser } from "@/lib/auth";
import path from "path";
import { unlink } from "fs/promises";
import { existsSync } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "bank-pdfs");
const URL_PREFIX = "/uploads/bank-pdfs/";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!isAdminUser(payload)) {
    return NextResponse.json(
      { success: false, error: "Forbidden", message: "Admin privileges required" },
      { status: 403 }
    );
  }

  try {
    const resolvedParams = context?.params ? await context.params : (context as any)?.params;
    const fileId = resolvedParams?.id || new URL(req.url).searchParams.get("id");
    if (!fileId) {
      return NextResponse.json({ success: false, error: "Missing file id" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT bf.id, bf.file_name, bf.file_path, bf.file_size, bf.uploaded_by, bf.uploaded_at,
                u.name as uploaded_by_name, COUNT(bcd.id)::int as record_count
         FROM bank_uploaded_files bf
         LEFT JOIN users u ON bf.uploaded_by = u.id
         LEFT JOIN bank_company_data bcd ON bcd.file_id = bf.id
         WHERE bf.id = $1
         GROUP BY bf.id, u.name`,
        [Number(fileId)]
      );

      if (res.rowCount === 0) {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, file: res.rows[0] });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("get bank file error", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  if (!isAdminUser(payload)) {
    return NextResponse.json(
      { success: false, error: "Forbidden", message: "Admin privileges required" },
      { status: 403 }
    );
  }

  try {
    const resolvedParams = context?.params ? await context.params : (context as any)?.params;
    const fileId = resolvedParams?.id || new URL(req.url).searchParams.get("id");
    if (!fileId) {
      return NextResponse.json({ success: false, error: "Missing file id" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query(
        "SELECT id, file_name, file_path FROM bank_uploaded_files WHERE id = $1",
        [Number(fileId)]
      );
      if (res.rowCount === 0) {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }

      const { file_name, file_path } = res.rows[0];

      // Delete disk file if it exists
      if (file_path) {
        let fullPath = "";
        if (file_path.startsWith(URL_PREFIX)) {
          fullPath = path.join(UPLOAD_DIR, file_path.replace(URL_PREFIX, ""));
        } else if (file_path.startsWith("/uploads/")) {
          fullPath = path.join(process.cwd(), "public", file_path.replace(/^\//, ""));
        } else if (path.isAbsolute(file_path)) {
          fullPath = file_path;
        } else {
          fullPath = path.join(process.cwd(), file_path);
        }

        try {
          if (existsSync(fullPath)) {
            await unlink(fullPath);
          }
        } catch (e) {
          console.warn("Could not delete file from disk:", e);
        }
      }

      // Delete company data records (foreign key cascade also ensures this)
      const compDeleteRes = await client.query(
        "DELETE FROM bank_company_data WHERE file_id = $1",
        [Number(fileId)]
      );

      // Delete file record from database
      await client.query("DELETE FROM bank_uploaded_files WHERE id = $1", [Number(fileId)]);

      return NextResponse.json({
        success: true,
        message: `File "${file_name}" and ${compDeleteRes.rowCount || 0} associated company records were deleted successfully.`,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("delete bank file error", err);
    return NextResponse.json({ success: false, error: "Could not delete the file" }, { status: 500 });
  }
}
