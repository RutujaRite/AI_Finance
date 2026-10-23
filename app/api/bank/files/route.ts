/**
 * Bank / Company Data files API route.
 * Strictly accepts company categorization and employer data files (.csv, .xlsx, .xls).
 * Rejects bank policy documents (which belong under /policies).
 * GET: list uploaded company files with company record counts and summary metrics.
 * POST: upload and ingest company spreadsheet records into bank_company_data with strict idempotency and deduplication.
 * DELETE: remove file, disk file, and associated company data records.
 * Uses: lib/db, lib/auth (verifyToken, isAdminUser)
 */

import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { verifyToken, isAdminUser } from "@/lib/auth";
import { writeFile, mkdir, unlink, readdir, stat } from "fs/promises";
import { existsSync, createReadStream } from "fs";
import path from "path";
import crypto from "crypto";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "bank-company-data");
const URL_PREFIX = "/uploads/bank-company-data/";

interface UploadResultPayload {
  status: number;
  body: any;
}

// In-flight active upload lock to prevent concurrent execution of identical uploads
const activeUploads = new Map<string, Promise<UploadResultPayload>>();

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

interface ParseResult {
  records: ParsedCompanyRecord[];
  totalParsed: number;
  validCount: number;
  invalidCount: number;
  emptyCount: number;
  invalidSamples: string[];
}

function parseCompanyFile(
  buffer: Buffer,
  originalName: string,
  selectedBankName?: string
): ParseResult {
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

  const chosenBank = (selectedBankName && selectedBankName.trim()) || defaultBankFromFileName || "Corporate Master";

  const records: ParsedCompanyRecord[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let emptyCount = 0;
  const invalidSamples: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") {
      emptyCount++;
      continue;
    }

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
        bank_name: (selectedBankName?.trim() || bankName || chosenBank).slice(0, 255),
        company_category: (compCat || "Approved").slice(0, 100),
        sr_no: (srNo || String(i + 1)).slice(0, 100),
        other_info: otherInfo,
      });
      validCount++;
    } else {
      // Row has content but missing recognizable company name
      const hasAnyVal = Object.values(row).some((v) => String(v ?? "").trim().length > 0);
      if (hasAnyVal) {
        invalidCount++;
        if (invalidSamples.length < 5) {
          invalidSamples.push(`Row ${i + 1}: ${JSON.stringify(row).slice(0, 120)}`);
        }
      } else {
        emptyCount++;
      }
    }
  }

  return {
    records,
    totalParsed: rows.length,
    validCount,
    invalidCount,
    emptyCount,
    invalidSamples,
  };
}

function inferBankName(fileName: string): string {
  const clean = (fileName || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/_\d{4}-\d{2}-\d{2}.*$/, "")
    .replace(/\(\d+\)$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  const lower = clean.toLowerCase();
  if (lower.includes("categorization master") || lower.includes("multi bank") || (lower.includes("company master") && !lower.includes("bank"))) {
    return "Multi-Bank Master";
  }
  if (lower.includes("hdfc")) return "HDFC Bank";
  if (lower.includes("icici")) return "ICICI Bank";
  if (lower.includes("axis finance")) return "Axis Finance";
  if (lower.includes("axis")) return "Axis Bank";
  if (lower.includes("kotak")) return "Kotak Mahindra Bank";
  if (lower.includes("bajaj finserv")) return "Bajaj Finserv";
  if (lower.includes("bajaj markets")) return "Bajaj Markets";
  if (lower.includes("tata capital")) return "TATA Capital";
  if (lower.includes("idfc")) return "IDFC FIRST Bank";
  if (lower.includes("finnable")) return "Finnable Credit";
  if (lower.includes("fibe") || lower.includes("earlysalary")) return "Fibe (EarlySalary)";
  if (lower.includes("chola") || lower.includes("cholamandalam")) return "Cholamandalam";
  if (lower.includes("bandhan")) return "Bandhan Bank";
  if (lower.includes("yes bank") || lower.includes("yes")) return "Yes Bank";
  if (lower.includes("indusind")) return "IndusInd Bank";
  if (lower.includes("poonawalla")) return "Poonawalla Fincorp";
  if (lower.includes("piramal")) return "Piramal Finance";
  if (lower.includes("aditya birla") || lower.includes("abfl")) return "Aditya Birla Capital";
  if (lower.includes("smfg") || lower.includes("fullerton")) return "SMFG India Credit";
  if (lower.includes("l&t") || lower.includes("lt finance")) return "L&T Finance";
  if (lower.includes("utkarsh")) return "Utkarsh Small Finance Bank";
  if (lower.includes("sbm")) return "SBM Bank India";
  return clean || "Multi-Bank Master";
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
    // 1. Query registered files joined with actual company records count and bank name
    const res = await client.query(
      `SELECT bf.id, bf.file_name, bf.file_path, bf.file_size, bf.file_hash, bf.record_count as registered_count,
              bf.status, bf.uploaded_by, bf.uploaded_at,
              u.name as uploaded_by_name,
              COUNT(bcd.id)::int as actual_db_records,
              COALESCE(MAX(bcd.bank_name), '') as bank_name
       FROM bank_uploaded_files bf
       LEFT JOIN users u ON bf.uploaded_by = u.id
       LEFT JOIN bank_company_data bcd ON bcd.file_id = bf.id
       GROUP BY bf.id, u.name
       ORDER BY bf.id ASC`
    );

    let filesList: any[] = res.rows.map((row: any) => {
      const bankName = (row.bank_name || "").trim() || inferBankName(row.file_name);
      const actualCount = Number(row.actual_db_records) || 0;
      const registeredCount = Number(row.registered_count) || 0;
      const finalCount = actualCount > 0 ? actualCount : registeredCount;

      return {
        id: row.id,
        file_name: row.file_name,
        file_path: row.file_path,
        file_size: Number(row.file_size) || 0,
        file_hash: row.file_hash || null,
        uploaded_by: row.uploaded_by,
        uploaded_at: row.uploaded_at,
        uploaded_by_name: row.uploaded_by_name || "Admin",
        record_count: finalCount,
        bank_name: bankName,
        status: row.status || "Processed",
      };
    });

    // 2. Track all registered filenames, paths, and basenames to prevent phantom duplicates
    const registeredIdentifiers = new Set<string>();
    filesList.forEach((f) => {
      if (f.file_name) registeredIdentifiers.add(f.file_name.toLowerCase());
      if (f.file_path) {
        registeredIdentifiers.add(f.file_path.toLowerCase());
        registeredIdentifiers.add(path.basename(f.file_path).toLowerCase());
      }
    });

    // 3. Fallback: Check ONLY external seed directory (company-master-files)
    // NEVER scan public/uploads/bank-company-data because that is the private storage directory for bank_uploaded_files!
    const externalSeedDir = path.join(process.cwd(), "company-master-files");
    if (existsSync(externalSeedDir)) {
      try {
        const dirEntries = await readdir(externalSeedDir, { withFileTypes: true });
        for (const entry of dirEntries) {
          if (!entry.isFile()) continue;
          const ext = path.extname(entry.name).toLowerCase();
          if (![".xlsx", ".xls", ".csv"].includes(ext)) continue;
          if (registeredIdentifiers.has(entry.name.toLowerCase())) continue;

          const fullFilePath = path.join(externalSeedDir, entry.name);
          const fileStat = await stat(fullFilePath);
          const bName = inferBankName(entry.name);

          // Fast line count for CSV or default 0
          let estimatedCount = 0;
          if (ext === ".csv") {
            try {
              const fileBuf = await import("fs/promises").then((m) => m.readFile(fullFilePath));
              const lineCount = fileBuf.toString("utf8").split("\n").filter((l) => l.trim().length > 0).length;
              estimatedCount = Math.max(0, lineCount - 1); // exclude header
            } catch {
              estimatedCount = 0;
            }
          }

          filesList.push({
            id: `fs-${entry.name}`,
            file_name: entry.name,
            file_path: fullFilePath,
            file_size: fileStat.size,
            uploaded_by: 1,
            uploaded_at: fileStat.mtime.toISOString(),
            uploaded_by_name: "System Master",
            record_count: estimatedCount,
            bank_name: bName,
            status: "Processed",
          });
          registeredIdentifiers.add(entry.name.toLowerCase());
        }
      } catch (scanErr) {
        console.warn("External master files scan error:", scanErr);
      }
    }

    // 4. Compute exact total records in database
    const countRes = await client.query("SELECT COUNT(*)::bigint as total FROM bank_company_data");
    const totalCompanyRecords = Number(countRes.rows[0]?.total || 0);

    return NextResponse.json({
      success: true,
      files: filesList,
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
    const selectedBank = (formData.get("bank_name") as string || "").trim();
    const isForce = formData.get("force") === "true" || formData.get("reupload") === "true";
    const clientProvidedKey = (
      (formData.get("idempotency_key") as string) ||
      req.headers.get("x-idempotency-key") ||
      req.headers.get("idempotency-key") ||
      ""
    ).trim();

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

    const effectiveBank = selectedBank || inferBankName(originalName);

    // Compute cryptographic SHA-256 hash of file content for idempotency and duplicate detection
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const idempotencyKey = clientProvidedKey || `${effectiveBank}_${fileHash}`;
    const concurrencyKey = `${effectiveBank}:${fileHash}`;

    // -------------------------------------------------------------------------
    // CONCURRENCY GUARD: If identical upload is currently in-flight, await and share
    // -------------------------------------------------------------------------
    if (activeUploads.has(concurrencyKey)) {
      console.log(`[CSV_UPLOAD] Concurrent upload detected for ${concurrencyKey}. Awaiting in-flight operation.`);
      const result = await activeUploads.get(concurrencyKey)!;
      return NextResponse.json(result.body, { status: result.status });
    }

    // Wrapper function that performs the actual upload and ingestion
    const processUpload = async (): Promise<UploadResultPayload> => {
      const client = await pool.connect();
      try {
        // ---------------------------------------------------------------------
        // 1. IDEMPOTENCY CHECK: Check if this file + bank was already processed
        // ---------------------------------------------------------------------
        const existingCheck = await client.query(
          `SELECT bf.id, bf.file_name, bf.file_path, bf.file_size, bf.record_count, bf.uploaded_at,
                  COUNT(bcd.id)::int as actual_records,
                  COALESCE(MAX(bcd.bank_name), '') as bank_name
           FROM bank_uploaded_files bf
           LEFT JOIN bank_company_data bcd ON bcd.file_id = bf.id
           WHERE (bf.file_hash = $1 OR (bf.idempotency_key IS NOT NULL AND bf.idempotency_key = $2))
             AND bf.status = 'completed'
           GROUP BY bf.id
           ORDER BY bf.id DESC
           LIMIT 1`,
          [fileHash, idempotencyKey]
        );

        if (existingCheck.rows.length > 0 && !isForce) {
          const existing = existingCheck.rows[0];
          const count = Number(existing.actual_records) || Number(existing.record_count) || 0;
          console.log(`[CSV_UPLOAD] Idempotent hit: File ${originalName} (hash ${fileHash.slice(0, 8)}) already exists with ${count} records.`);

          return {
            status: 200,
            body: {
              success: true,
              duplicate: true,
              already_exists: true,
              message: `File "${originalName}" has already been processed for "${effectiveBank}". Retaining existing ${count.toLocaleString()} company records without duplicate insertion.`,
              file: {
                id: existing.id,
                file_name: existing.file_name,
                file_path: existing.file_path,
                file_size: existing.file_size,
                record_count: count,
                uploaded_by: existing.uploaded_by,
                uploaded_at: existing.uploaded_at,
                bank_name: existing.bank_name || effectiveBank,
                status: "Processed",
              },
              stats: {
                inserted: 0,
                skipped_duplicate: count,
                total_records: count,
                invalid_rows: 0,
              },
            },
          };
        }

        // If force re-upload was requested and previous record exists, safely remove previous file record & records
        if (existingCheck.rows.length > 0 && isForce) {
          const prevId = existingCheck.rows[0].id;
          console.log(`[CSV_UPLOAD] Force re-upload requested: Removing existing file ID ${prevId} before re-ingestion.`);
          await client.query("DELETE FROM bank_company_data WHERE file_id = $1", [prevId]);
          await client.query("DELETE FROM bank_uploaded_files WHERE id = $1", [prevId]);
        }

        // ---------------------------------------------------------------------
        // 2. SAVE PHYSICAL FILE TO DISK
        // ---------------------------------------------------------------------
        const uniqueDiskId = Date.now().toString(36) + "_" + crypto.randomBytes(4).toString("hex");
        const savedName = uniqueDiskId + ext;
        const filePath = path.join(UPLOAD_DIR, savedName);
        const publicPath = URL_PREFIX + savedName;

        await writeFile(filePath, fileBuffer);

        // ---------------------------------------------------------------------
        // 3. PARSE AND VALIDATE COMPANY RECORDS
        // ---------------------------------------------------------------------
        const parseResult = parseCompanyFile(fileBuffer, originalName, effectiveBank);
        const { records, validCount, invalidCount, emptyCount, invalidSamples } = parseResult;

        // ---------------------------------------------------------------------
        // 4. TRANSACTIONAL INGESTION INTO POSTGRESQL
        // ---------------------------------------------------------------------
        await client.query("BEGIN");

        const insertFileRes = await client.query(
          `INSERT INTO bank_uploaded_files (file_name, file_path, file_size, file_hash, idempotency_key, record_count, status, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'processing', $7)
           RETURNING id, file_name, uploaded_at`,
          [originalName, publicPath, file.size, fileHash, idempotencyKey, validCount, payload.id]
        );
        const newFileId = insertFileRes.rows[0].id;

        // Ingest records in chunks of 500
        if (records.length > 0) {
          const BATCH_SIZE = 500;
          for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
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

        // Mark upload completed with accurate record count
        await client.query(
          `UPDATE bank_uploaded_files
           SET record_count = $1, status = 'completed'
           WHERE id = $2`,
          [validCount, newFileId]
        );

        await client.query("COMMIT");

        console.log(`[CSV_UPLOAD] Successfully ingested file ID ${newFileId}: ${validCount} records for bank ${effectiveBank}.`);

        return {
          status: 200,
          body: {
            success: true,
            message: validCount > 0
              ? `Successfully uploaded "${originalName}" and ingested ${validCount.toLocaleString()} company records for "${effectiveBank}".`
              : `Uploaded "${originalName}". Note: 0 company records recognized (expected columns: Company Name, Category, Bank Name).`,
            file: {
              id: newFileId,
              file_name: originalName,
              file_path: publicPath,
              file_size: file.size,
              record_count: validCount,
              uploaded_by: payload.id,
              uploaded_at: insertFileRes.rows[0].uploaded_at,
              bank_name: effectiveBank,
              status: "Processed",
            },
            stats: {
              inserted: validCount,
              invalid_rows: invalidCount,
              empty_rows: emptyCount,
              total_rows_parsed: parseResult.totalParsed,
              invalid_samples: invalidSamples,
            },
          },
        };
      } catch (dbErr: any) {
        await client.query("ROLLBACK");
        console.error("[CSV_UPLOAD] Database ingestion error, rolled back:", dbErr);
        throw dbErr;
      } finally {
        client.release();
      }
    };

    const uploadPromise = processUpload();
    activeUploads.set(concurrencyKey, uploadPromise);

    try {
      const result = await uploadPromise;
      return NextResponse.json(result.body, { status: result.status });
    } finally {
      activeUploads.delete(concurrencyKey);
    }

  } catch (err: any) {
    console.error("bank company file upload error", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not save and ingest the company data file" },
      { status: 500 }
    );
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
    let rawFileId = searchParams.get("id");
    if (!rawFileId) {
      try {
        const body = await req.json();
        rawFileId = body?.id || body?.file_id || body?.fileId;
      } catch (e) {
        // body not present
      }
    }

    if (!rawFileId) {
      return NextResponse.json({ success: false, error: "Missing file id" }, { status: 400 });
    }

    const fileId = decodeURIComponent(String(rawFileId));
    const isFsScan = fileId.startsWith("fs-");
    const numericId = parseInt(fileId, 10);
    const isNumeric = !isNaN(numericId) && !isFsScan && String(numericId) === fileId;

    const client = await pool.connect();
    try {
      let targetFileRecord: any = null;
      let rawFileName = isFsScan ? fileId.replace(/^fs-/, "") : fileId;

      if (isNumeric) {
        const res = await client.query(
          "SELECT id, file_name, file_path FROM bank_uploaded_files WHERE id = $1",
          [numericId]
        );
        if (res.rowCount && res.rowCount > 0) {
          targetFileRecord = res.rows[0];
          rawFileName = targetFileRecord.file_name;
        }
      } else if (!isFsScan) {
        const res = await client.query(
          "SELECT id, file_name, file_path FROM bank_uploaded_files WHERE file_name = $1 OR file_path ILIKE $2 LIMIT 1",
          [rawFileName, `%${rawFileName}%`]
        );
        if (res.rowCount && res.rowCount > 0) {
          targetFileRecord = res.rows[0];
          rawFileName = targetFileRecord.file_name;
        }
      }

      let deletedRecordsCount = 0;
      let diskDeleted = false;

      // 1. Delete associated database records if registered in bank_uploaded_files
      if (targetFileRecord) {
        const compDeleteRes = await client.query(
          "DELETE FROM bank_company_data WHERE file_id = $1",
          [targetFileRecord.id]
        );
        deletedRecordsCount += compDeleteRes.rowCount || 0;

        await client.query("DELETE FROM bank_uploaded_files WHERE id = $1", [targetFileRecord.id]);
      }

      // 2. Delete file from disk if path exists
      if (targetFileRecord?.file_path) {
        let explicitPath = "";
        const p = targetFileRecord.file_path;
        if (p.startsWith(URL_PREFIX)) {
          explicitPath = path.join(UPLOAD_DIR, p.replace(URL_PREFIX, ""));
        } else if (p.startsWith("/uploads/")) {
          explicitPath = path.join(process.cwd(), "public", p.replace(/^\//, ""));
        } else if (path.isAbsolute(p)) {
          explicitPath = p;
        } else {
          explicitPath = path.join(process.cwd(), p);
        }

        try {
          if (existsSync(explicitPath)) {
            await unlink(explicitPath);
            diskDeleted = true;
          }
        } catch (e) {
          console.warn("Could not delete explicit disk path:", explicitPath, e);
        }
      }

      if (!targetFileRecord && !diskDeleted && deletedRecordsCount === 0) {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `File "${rawFileName}" and ${deletedRecordsCount.toLocaleString()} associated company records were deleted successfully.`,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("delete bank company file error", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Could not delete the file" },
      { status: 500 }
    );
  }
}
