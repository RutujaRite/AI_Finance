/**
 * Bank files API route.
 * GET: list uploaded bank PDF/CSV files.
 * POST: upload bank document to server and DB.
 * DELETE: remove file and DB record.
 * Uses: lib/db, lib/auth (verifyToken)
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "../../../../lib/db";
import { verifyToken } from "../../../../lib/auth";
import bcrypt from "bcryptjs";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "bank-pdfs");
const URL_PREFIX = "/uploads/bank-pdfs/";

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
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
      `SELECT bf.id, bf.file_name, bf.file_path, bf.file_size, bf.uploaded_by, bf.uploaded_at, u.name as uploaded_by_name
       FROM bank_uploaded_files bf
       LEFT JOIN users u ON bf.uploaded_by = u.id
       ORDER BY bf.uploaded_at DESC`
    );
    return NextResponse.json({ files: res.rows });
  } catch (err: any) {
    console.error("list bank files error", err);
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
    if (!file || file.size === 0) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();
    if (![".pdf", ".csv"].includes(ext)) {
      return NextResponse.json({ success: false, error: "Only PDF and CSV files are allowed" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, error: "File size exceeds 50 MB limit" }, { status: 400 });
    }

    const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const savedName = fileId + ext;
    const filePath = path.join(UPLOAD_DIR, savedName);
    const publicPath = URL_PREFIX + savedName;

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, bytes);

    const client = await pool.connect();
    try {
      const res = await client.query(
        `INSERT INTO bank_uploaded_files (file_name, file_path, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, file_name, uploaded_at`,
        [originalName, publicPath, file.size, payload.id]
      );
      const row = res.rows[0];
      return NextResponse.json({
        success: true,
        file: {
          id: row.id,
          file_name: row.file_name,
          file_path: publicPath,
          file_size: file.size,
          uploaded_by: payload.id,
          uploaded_at: row.uploaded_at,
        },
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("bank file upload error", err);
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
      const res = await client.query("SELECT file_path FROM bank_uploaded_files WHERE id = $1", [Number(fileId)]);
      if (res.rowCount === 0) {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }

      const filePath = res.rows[0].file_path;
      if (filePath && filePath.startsWith(URL_PREFIX)) {
        const fileName = filePath.replace(URL_PREFIX, "");
        const fullPath = path.join(UPLOAD_DIR, fileName);
        try {
          await unlink(fullPath);
        } catch (e) {
          // ignore missing file
        }
      }

      await client.query("DELETE FROM bank_uploaded_files WHERE id = $1", [Number(fileId)]);
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("delete bank file error", err);
    return NextResponse.json({ success: false, error: "Could not delete the file" }, { status: 500 });
  }
}
