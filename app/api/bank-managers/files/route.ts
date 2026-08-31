/**
 * Bank manager files API route.
 * GET: list uploaded Excel/CSV files.
 * POST: upload file, import managers into DB via lib/importManagers.
 * DELETE: remove file and associated manager records.
 * Uses: lib/db, lib/importManagers
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { verifyToken } from "../../../../lib/auth";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "bank-managers");
const URL_PREFIX = "/uploads/bank-managers/";

async function ensureUploadDir() {
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT bmf.id, bmf.bank_name, bmf.file_name, bmf.file_path, bmf.file_size, bmf.uploaded_at, u.name as uploaded_by_name
       FROM bank_manager_files bmf
       LEFT JOIN users u ON bmf.uploaded_by = u.id
       ORDER BY bmf.uploaded_at DESC`
    );
    return NextResponse.json({ files: res.rows });
  } catch (err: any) {
    console.error("list files error", err);
    return NextResponse.json({ files: [] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const payload: any = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  try {
    await ensureUploadDir();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bankName = (formData.get("bank_name") as string) || "";

    if (!bankName) {
      return NextResponse.json({ success: false, error: "Bank name is required" }, { status: 400 });
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();
    if (![".xlsx", ".xls", ".csv"].includes(ext)) {
      return NextResponse.json({ success: false, error: "Only Excel and CSV files are allowed" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, error: "File size exceeds 50 MB limit" }, { status: 400 });
    }

    const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const savedName = fileId + ext;
    const filePath = path.join(UPLOAD_DIR, savedName);
    const publicPath = URL_PREFIX + savedName;

    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, bytes);

    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO bank_manager_files (bank_name, file_name, file_path, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [bankName, originalName, publicPath, file.size, payload.id]
      );
      const dbFileId = res.rows[0].id;

      // Import managers from the uploaded file
      try {
        const { importManagersFromFile } = await import("../../../lib/importManagers");
        await importManagersFromFile(filePath, bankName);
      } catch (importError) {
        console.error("Import error", importError);
      }

      return NextResponse.json({ success: true, file_id: dbFileId });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Upload error", err);
    return NextResponse.json({ success: false, error: "Could not save the file" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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
      const res = await client.query("SELECT file_path, bank_name FROM bank_manager_files WHERE id = $1", [Number(fileId)]);
      if (res.rowCount === 0) {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }

      const { file_path, bank_name } = res.rows[0];
      if (file_path && file_path.startsWith(URL_PREFIX)) {
        const localFile = file_path.replace(URL_PREFIX, "");
        const fullPath = path.join(UPLOAD_DIR, localFile);
        try {
          await fs.unlink(fullPath);
        } catch (e) {
          // ignore missing file
        }
      }

      await client.query("DELETE FROM bank_managers WHERE bank_name = $1", [bank_name]);
      await client.query("DELETE FROM bank_manager_files WHERE id = $1", [Number(fileId)]);
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Delete error", err);
    return NextResponse.json({ success: false, error: "Could not delete the file" }, { status: 500 });
  }
}
