/**
 * Bank / Company Data files API route.
 * Strictly accepts company categorization and employer data files (.csv, .xlsx, .xls).
 * Rejects bank policy documents (which belong under /policies).
 * GET: list uploaded company files with company record counts and summary metrics.
 * POST: upload and ingest company spreadsheet records into bank_company_data.
 * DELETE: remove file, disk file, and associated company data records.
 * Uses: lib/db, lib/auth (verifyToken, isAdminUser)
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, isAdminUser } from "@/lib/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "bank-company-data");
const URL_PREFIX = "/uploads/bank-company-data/";

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

interface ParsedCompanyRecord {
  company_name: string;
  bank_name: string;
  company_category: string;
  sr_no: string;
  other_info: string;
}

function parseCompanyFile(buffer: Buffer, originalName: string): ParsedCompanyRecord[] {
  const ext = path.extname(originalName).toLowerCase();
  let rows: any[] = [];

  if (ext === ".csv") {
    try {
      const text = buffer.toString("utf8");
      rows = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
      });
    } catch (err) {
      console.warn("csv-parse failure, attempting line-by-line fallback:", err);
    }
  } else if (ext === ".xlsx" || ext === ".xls") {
    try {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const firstSheet = wb.SheetNames[0];
      if (firstSheet) {
        rows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: "" });
      }
    } catch (err) {
      console.warn("XLSX parsing error:", err);
    }
  }

  // Infer default bank name from file name (e.g., "HDFC Bank_2026-08-07.csv" -> "HDFC Bank")
  const defaultBankFromFileName = originalName
    .replace(/\.[^/.]+$/, "")
    .replace(/_\d{4}-\d{2}-\d{2}.*$/, "")
    .replace(/\(\d+\)$/, "")
    .trim();

  const records: ParsedCompanyRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;

    let compName = "";
    let bankName = "";
    let compCat = "";
    let srNo = "";
    let otherInfo = "";

    for (const [rawKey, rawVal] of Object.entries(row)) {
      const cleanKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, "");
      const val = String(rawVal ?? "").trim();
      if (!val) continue;

      if (!compName && (cleanKey.includes("companyname") || cleanKey === "company" || cleanKey.includes("employer") || cleanKey === "name")) {
        compName = val;
      } else if (!bankName && (cleanKey.includes("bankname") || cleanKey === "bank" || cleanKey.includes("lender"))) {
        bankName = val;
      } else if (!compCat && (cleanKey.includes("companycategory") || cleanKey.includes("category") || cleanKey === "cat" || cleanKey.includes("tier") || cleanKey.includes("grading"))) {
        compCat = val;
      } else if (!srNo && (cleanKey.includes("srno") || cleanKey.includes("sno") || cleanKey === "id" || cleanKey.includes("serial"))) {
        srNo = val;
      } else if (!otherInfo && (cleanKey.includes("otherinfo") || cleanKey.includes("remarks") || cleanKey.includes("cin") || cleanKey.includes("notes") || cleanKey.includes("info"))) {
        otherInfo = val;
      }
    }

    if (compName) {
      records.push({
        company_name: compName.slice(0, 255),
        bank_name: (bankName || defaultBankFromFileName || "Partner Bank").slice(0, 255),
        company_category: (compCat || "Approved").slice(0, 100),
        sr_no: (srNo || String(i + 1)).slice(0, 100),
        other_info: otherInfo,
      });
    }
  }

  return records;
}

export async function GET(req: NextRequest) {
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

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT bf.id, bf.file_name, bf.file_path, bf.file_size, bf.uploaded_by, bf.uploaded_at,
              u.name as uploaded_by_name, COUNT(bcd.id)::int as record_count
       FROM bank_uploaded_files bf
       LEFT JOIN users u ON bf.uploaded_by = u.id
       LEFT JOIN bank_company_data bcd ON bcd.file_id = bf.id
       GROUP BY bf.id, u.name
       ORDER BY bf.uploaded_at DESC`
    );

    const countRes = await client.query("SELECT COUNT(*)::bigint as total FROM bank_company_data");
    const totalCompanyRecords = Number(countRes.rows[0]?.total || 0);

    return NextResponse.json({
      success: true,
      files: res.rows,
      totalCompanyRecords,
    });
  } catch (err: any) {
    console.error("list bank company files error", err);
    return NextResponse.json({ success: false, files: [], totalCompanyRecords: 0 });
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

  if (!isAdminUser(payload)) {
    return NextResponse.json(
      { success: false, error: "Forbidden", message: "Admin privileges required" },
      { status: 403 }
    );
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

    // STRICT VALIDATION: Reject policy files (PDF, DOCX, TXT)
    if ([".pdf", ".docx", ".doc", ".txt", ".rtf", ".odt"].includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Policy documents are not accepted in the Company Data section. Please upload bank policy documents in the Bank Policy section (/policies).",
        },
        { status: 400 }
      );
    }

    // Only allow company data spreadsheet files
    if (![".csv", ".xlsx", ".xls"].includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: "Only company data spreadsheet files (.csv, .xlsx, .xls) are allowed in this section.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, error: "File size exceeds 50 MB limit" }, { status: 400 });
    }

    const fileIdStr = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const savedName = fileIdStr + ext;
    const filePath = path.join(UPLOAD_DIR, savedName);
    const publicPath = URL_PREFIX + savedName;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, fileBuffer);

    // Parse company categorization records
    const parsedRecords = parseCompanyFile(fileBuffer, originalName);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertFileRes = await client.query(
        `INSERT INTO bank_uploaded_files (file_name, file_path, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, file_name, uploaded_at`,
        [originalName, publicPath, file.size, payload.id]
      );
      const newFileId = insertFileRes.rows[0].id;

      // Ingest company records in batches of 500
      if (parsedRecords.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < parsedRecords.length; i += BATCH_SIZE) {
          const batch = parsedRecords.slice(i, i + BATCH_SIZE);
          const values: any[] = [];
          const placeholders: string[] = [];

          batch.forEach((rec, rIdx) => {
            const offset = rIdx * 6;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
            values.push(newFileId, rec.company_name, rec.bank_name, rec.sr_no, rec.company_category, rec.other_info);
          });

          await client.query(
            `INSERT INTO bank_company_data (file_id, company_name, bank_name, sr_no, company_category, other_info)
             VALUES ${placeholders.join(", ")}`,
            values
          );
        }
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: parsedRecords.length > 0
          ? `Successfully uploaded "${originalName}" and ingested ${parsedRecords.length.toLocaleString()} company records.`
          : `Successfully uploaded "${originalName}". Note: 0 company records recognized (expected columns: Company Name, Category, Bank Name).`,
        file: {
          id: newFileId,
          file_name: originalName,
          file_path: publicPath,
          file_size: file.size,
          record_count: parsedRecords.length,
          uploaded_by: payload.id,
          uploaded_at: insertFileRes.rows[0].uploaded_at,
        },
      });
    } catch (dbErr: any) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("bank company file upload error", err);
    return NextResponse.json({ success: false, error: err?.message || "Could not save the file" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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
    const { searchParams } = new URL(req.url);
    let fileId = searchParams.get("id");
    if (!fileId) {
      try {
        const body = await req.json();
        fileId = body?.id;
      } catch (e) {
        // body not present
      }
    }

    if (!fileId) {
      return NextResponse.json({ success: false, error: "Missing file id" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const res = await client.query("SELECT id, file_name, file_path FROM bank_uploaded_files WHERE id = $1", [Number(fileId)]);
      if (res.rowCount === 0) {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }

      const { file_name, file_path } = res.rows[0];
      if (file_path) {
        let fullPath = "";
        if (file_path.startsWith(URL_PREFIX)) {
          fullPath = path.join(UPLOAD_DIR, file_path.replace(URL_PREFIX, ""));
        } else if (file_path.startsWith("/uploads/bank-pdfs/")) {
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
          console.warn("Could not delete disk file:", e);
        }
      }

      const compDeleteRes = await client.query("DELETE FROM bank_company_data WHERE file_id = $1", [Number(fileId)]);
      await client.query("DELETE FROM bank_uploaded_files WHERE id = $1", [Number(fileId)]);

      return NextResponse.json({
        success: true,
        message: `File "${file_name}" and ${compDeleteRes.rowCount || 0} associated company records were deleted successfully.`,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("delete bank company file error", err);
    return NextResponse.json({ success: false, error: "Could not delete the file" }, { status: 500 });
  }
}
