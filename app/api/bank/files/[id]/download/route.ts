/**
 * Bank / Company Data file download API route.
 * Streams the requested file from disk as an attachment.
 * If the physical file is not present on disk, reconstructs the CSV
 * directly from the bank_company_data table in PostgreSQL.
 * Uses: lib/db, lib/auth (verifyToken, isAdminUser)
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, isAdminUser } from "@/lib/auth";
import path from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "bank-company-data");
const URL_PREFIX = "/uploads/bank-company-data/";

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

    // Check if fileId is a filesystem scan identifier (fs-...)
    if (String(fileId).startsWith("fs-")) {
      const rawName = String(fileId).replace(/^fs-/, "");
      const possiblePaths = [
        path.join(process.cwd(), "company-master-files", rawName),
        path.join(process.cwd(), "public", "uploads", "bank-company-data", rawName),
        path.join(process.cwd(), "data", rawName),
      ];

      for (const p of possiblePaths) {
        if (existsSync(p)) {
          const fileBuffer = await readFile(p);
          const ext = path.extname(rawName).toLowerCase();
          const contentType =
            ext === ".csv"
              ? "text/csv; charset=utf-8"
              : ext === ".xlsx"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : ext === ".xls"
              ? "application/vnd.ms-excel"
              : "application/octet-stream";

          return new NextResponse(fileBuffer, {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="${encodeURIComponent(rawName)}"`,
            },
          });
        }
      }
    }

    const client = await pool.connect();
    try {
      const numericId = parseInt(String(fileId), 10);
      let res;
      if (!isNaN(numericId)) {
        res = await client.query(
          "SELECT id, file_name, file_path, file_size FROM bank_uploaded_files WHERE id = $1",
          [numericId]
        );
      } else {
        res = await client.query(
          "SELECT id, file_name, file_path, file_size FROM bank_uploaded_files WHERE file_name = $1 LIMIT 1",
          [fileId]
        );
      }

      if (res.rowCount === 0) {
        // Check if file exists directly on disk by name
        const directDiskPath = path.join(process.cwd(), "company-master-files", String(fileId));
        if (existsSync(directDiskPath)) {
          const fileBuffer = await readFile(directDiskPath);
          return new NextResponse(fileBuffer, {
            headers: {
              "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": `attachment; filename="${encodeURIComponent(String(fileId))}"`,
            },
          });
        }
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }

      const { file_name, file_path } = res.rows[0];

      // 1. Try streaming from disk if physical file exists
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

        // Also check company-master-files if not found in primary path
        if (!existsSync(fullPath)) {
          const altPath = path.join(process.cwd(), "company-master-files", file_name);
          if (existsSync(altPath)) fullPath = altPath;
        }

        if (existsSync(fullPath)) {
          const fileBuffer = await readFile(fullPath);
          const ext = path.extname(file_name).toLowerCase();
          const contentType =
            ext === ".csv"
              ? "text/csv; charset=utf-8"
              : ext === ".xlsx"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : ext === ".xls"
              ? "application/vnd.ms-excel"
              : "application/octet-stream";

          return new NextResponse(fileBuffer, {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="${encodeURIComponent(file_name)}"`,
            },
          });
        }
      }

      // 2. If file is not present on disk, reconstruct CSV from bank_company_data
      const compRes = await client.query(
        `SELECT sr_no, company_name, bank_name, company_category, other_info
         FROM bank_company_data
         WHERE file_id = $1
         ORDER BY id ASC`,
        [Number(fileId)]
      );

      if (compRes.rowCount && compRes.rowCount > 0) {
        function escapeCsv(val: any): string {
          if (val === null || val === undefined) return "";
          const s = String(val);
          if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        }

        const lines: string[] = [];
        lines.push(["SR_NO", "COMPANY_NAME", "BANK_NAME", "COMPANY_CATEGORY", "OTHER_INFO"].join(","));
        for (const row of compRes.rows) {
          lines.push([
            escapeCsv(row.sr_no),
            escapeCsv(row.company_name),
            escapeCsv(row.bank_name),
            escapeCsv(row.company_category),
            escapeCsv(row.other_info),
          ].join(","));
        }

        const csvData = lines.join("\r\n");
        const downloadName = file_name.toLowerCase().endsWith(".csv") ? file_name : `${file_name}.csv`;

        return new NextResponse(csvData, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(downloadName)}"`,
          },
        });
      }

      return NextResponse.json(
        { success: false, error: "File contents not found on disk or database" },
        { status: 404 }
      );
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("download bank file error", err);
    return NextResponse.json({ success: false, error: "Could not download the file" }, { status: 500 });
  }
}
