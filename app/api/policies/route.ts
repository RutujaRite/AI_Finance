import { NextRequest, NextResponse } from "next/server";
import {
  getAllMasterPolicies,
  deleteBankMasterPolicy,
  updateBankMasterPolicy,
  saveMasterPolicyContent,
} from "@/lib/masterPolicies";
import pool from "@/lib/db";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status")?.trim().toLowerCase() || null;
    const bank_id = sp.get("bank_id") ? parseInt(sp.get("bank_id")!, 10) : null;
    const search = sp.get("search")?.trim().toLowerCase() || null;
    const loan_type = sp.get("loan_type")?.trim().toLowerCase() || null;
    const getBanks = sp.get("banks") === "true";

    // If requesting banks list
    if (getBanks) {
      try {
        const banksRes = await pool.query(`SELECT id, name, code FROM banks ORDER BY name ASC`);
        return NextResponse.json({ success: true, banks: banksRes.rows });
      } catch {
        const fallbackBanks = getAllMasterPolicies().map((p) => ({
          id: p.bank_id,
          name: p.bank_name,
          code: p.bank_code,
        }));
        return NextResponse.json({ success: true, banks: fallbackBanks });
      }
    }

    // Return exactly ONE row per bank with one master text file
    let rows = getAllMasterPolicies();

    // Strict deduplication by bank_id and bank_name to guarantee exactly one row per bank
    const seenBankIds = new Set<string>();
    rows = rows.filter((r) => {
      const key = `${r.bank_id}_${r.bank_name.toLowerCase().trim()}`;
      if (seenBankIds.has(key)) return false;
      seenBankIds.add(key);
      return true;
    });

    if (bank_id) {
      rows = rows.filter((r) => r.bank_id === bank_id);
    }

    if (status && status !== "all") {
      rows = rows.filter((r) => r.status.toLowerCase() === status);
    }

    if (search) {
      rows = rows.filter(
        (r) =>
          r.bank_name.toLowerCase().includes(search) ||
          r.bank_code.toLowerCase().includes(search)
      );
    }

    if (loan_type && loan_type !== "all") {
      rows = rows.filter(
        (r) =>
          r.loan_type.toLowerCase().includes(loan_type) ||
          (Array.isArray(r.supported_loan_types) &&
            r.supported_loan_types.some((t: string) => t.toLowerCase().includes(loan_type)))
      );
    }

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Failed to load master policies", err);
    return NextResponse.json({ error: "Failed to load master policies" }, { status: 500 });
  }
}

// POST /api/policies - Upload new policy file with loan type
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bankId = formData.get("bank_id") as string;
    const loanType = formData.get("loan_type") as string;
    const policyVersion = formData.get("policy_version") as string || "V1";
    const employmentType = formData.get("employment_type") as string || "Salaried";
    const description = formData.get("description") as string || "";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!bankId) {
      return NextResponse.json({ success: false, error: "Bank ID is required" }, { status: 400 });
    }

    if (!loanType) {
      return NextResponse.json({ success: false, error: "Loan type is required" }, { status: 400 });
    }

    // Read file content
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const fileExt = path.extname(fileName).toLowerCase();
    
    // Extract text from file
    let extractedText = "";
    try {
      if (fileExt === ".txt") {
        extractedText = fileBuffer.toString("utf-8");
      } else if (fileExt === ".pdf") {
        // Use pdfjs-dist for PDF extraction
        const pdfPkg = 'pdfjs-dist/legacy/build/pdf.mjs';
        const imported: any = await import(/* webpackIgnore: true */ pdfPkg);
        const pdfjsLib = imported.default || imported;
        const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) }).promise;
        const textParts: string[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          const lines = new Map<number, string[]>();
          for (const item of content.items) {
            if (!('transform' in item) || !('str' in item)) continue;
            const y = Math.round(item.transform[5] * 10) / 10;
            if (!lines.has(y)) lines.set(y, []);
            lines.get(y)!.push(item.str);
          }
          const sortedLines = Array.from(lines.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([, words]) => words.join(' '));
          textParts.push(sortedLines.join('\n'));
        }
        extractedText = textParts.join('\n\n');
      } else if (fileExt === ".docx") {
        const mammoth = (await import("mammoth")).default;
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value || "";
      } else if (fileExt === ".csv") {
        extractedText = fileBuffer.toString("utf-8");
      } else {
        return NextResponse.json({ success: false, error: "Unsupported file type. Supported: .txt, .pdf, .docx, .csv" }, { status: 400 });
      }
    } catch (extractErr) {
      console.error("Text extraction failed:", extractErr);
      return NextResponse.json({ success: false, error: "Failed to extract text from file" }, { status: 500 });
    }

    // Determine bank info
    const bankIdNum = parseInt(bankId, 10);
    let bankName = "";
    let bankCode = "";
    
    try {
      if (pool) {
        const bankRes = await pool.query("SELECT name, code FROM banks WHERE id = $1", [bankIdNum]);
        if (bankRes.rows.length > 0) {
          bankName = bankRes.rows[0].name;
          bankCode = bankRes.rows[0].code;
        }
      }
    } catch (dbErr) {
      console.warn("Could not fetch bank info from DB:", dbErr);
    }

    // Fallback to master policies
    if (!bankName) {
      const masterPolicies = getAllMasterPolicies();
      const matched = masterPolicies.find(p => p.bank_id === bankIdNum);
      if (matched) {
        bankName = matched.bank_name;
        bankCode = matched.bank_code;
      }
    }

    if (!bankName) {
      return NextResponse.json({ success: false, error: "Invalid bank ID" }, { status: 400 });
    }

    // Generate unique file name
    const timestamp = Date.now();
    const safeFileName = `${bankCode}_${loanType.replace(/\s+/g, '_')}_${policyVersion}_${timestamp}${fileExt}`;
    const dirPath = path.join(process.cwd(), "policy-master-files");
    
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, safeFileName);
    fs.writeFileSync(filePath, fileBuffer);

    // Save to database
    let policyFileId: number | null = null;
    let sourceId: number | null = null;
    let versionId: number | null = null;
    let ruleId: number | null = null;

    try {
      if (pool) {
        // 1. Insert into policy_sources
        const sourceRes = await pool.query(
          `INSERT INTO policy_sources (bank_id, file_name, file_path, file_type, file_size_bytes, description, uploaded_by, uploaded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING id`,
          [bankIdNum, safeFileName, `/policy-master-files/${safeFileName}`, fileExt, fileBuffer.length, description, 1]
        );
        sourceId = sourceRes.rows[0].id;

        // 2. Insert into policy_versions
        const versionRes = await pool.query(
          `INSERT INTO policy_versions (bank_id, source_id, version, status, loan_type, notes, created_by, created_at)
           VALUES ($1, $2, $3, 'active', $4, $5, $6, NOW())
           RETURNING id`,
          [bankIdNum, sourceId, policyVersion, loanType, `Uploaded policy file: ${fileName}`, 1]
        );
        versionId = versionRes.rows[0].id;

        // 3. Insert into policy_rules (basic rules from extracted text)
        const rulesRes = await pool.query(
          `INSERT INTO policy_rules (policy_version_id, loan_type, employment_type, status, created_at)
           VALUES ($1, $2, $3, 'active', NOW())
           RETURNING id`,
          [versionId, loanType, employmentType]
        );
        ruleId = rulesRes.rows[0].id;

        // 4. Insert into bank_policy_files
        const fileRes = await pool.query(
          `INSERT INTO bank_policy_files (bank_id, policy_version_id, file_name, file_path, file_type, file_size_bytes, uploaded_by, uploaded_at, description, extracted_text, extraction_status, extracted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, 'completed', NOW())
           RETURNING id`,
          [bankIdNum, versionId, safeFileName, `/policy-master-files/${safeFileName}`, fileExt, fileBuffer.length, 1, description, extractedText]
        );
        policyFileId = fileRes.rows[0].id;

        // 5. Insert into policy_attachments
        await pool.query(
          `INSERT INTO policy_attachments (policy_rule_id, file_name, file_path, file_type, file_size_bytes, extracted_text, uploaded_by, uploaded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [ruleId, safeFileName, `/policy-master-files/${safeFileName}`, fileExt, fileBuffer.length, extractedText, 1]
        );
      }
    } catch (dbErr) {
      console.warn("Database insert operations skipped or failed:", dbErr);
    }

    // Update master policies cache
    saveMasterPolicyContent(safeFileName, extractedText);

    return NextResponse.json({
      success: true,
      message: `Policy file uploaded successfully for ${bankName}`,
      data: {
        file_id: policyFileId,
        file_name: safeFileName,
        bank_id: bankIdNum,
        bank_name: bankName,
        bank_code: bankCode,
        loan_type: loanType,
        policy_version: policyVersion,
        file_size_bytes: fileBuffer.length,
        text_length: extractedText.length,
      }
    });
  } catch (err: any) {
    console.error("Failed to upload policy file:", err);
    return NextResponse.json({ success: false, error: err?.message || "Upload failed" }, { status: 500 });
  }
}

// Fallback DELETE /api/policies?id=...&bank_id=...&file_name=...
export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const id = sp.get("id");
    const bankIdParam = sp.get("bank_id");
    const fileName = sp.get("file_name") || undefined;

    const bankId = parseInt(bankIdParam || id || "", 10);
    if (!bankId || isNaN(bankId)) {
      return NextResponse.json({ success: false, error: "Invalid bank or policy ID" }, { status: 400 });
    }

    const res = await deleteBankMasterPolicy(bankId, fileName);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Delete failed" }, { status: 500 });
  }
}
