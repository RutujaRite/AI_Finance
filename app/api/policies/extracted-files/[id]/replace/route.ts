import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fileId = parseInt(id, 10);
    if (!fileId || isNaN(fileId)) {
      return NextResponse.json({ success: false, error: "Invalid file ID" }, { status: 400 });
    }

    const formData = await req.formData();
    const uploadedFile = formData.get("file") as File | null;

    if (!uploadedFile) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const bytes = await uploadedFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = uploadedFile.name;
    const fileSize = uploadedFile.size;
    const ext = path.extname(fileName).toLowerCase() || ".txt";

    // Read text content if plain text/csv/pdf/etc
    let textContent = "";
    if (ext === ".txt" || ext === ".csv" || ext === ".json" || ext === ".md") {
      textContent = buffer.toString("utf8");
    } else {
      textContent = `Document content for ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`;
    }

    // Save to upload directory
    const uploadDir = path.join(process.cwd(), "public", "uploads", "policies");
    await fs.mkdir(uploadDir, { recursive: true });
    const targetPath = path.join(uploadDir, `${Date.now()}_${fileName}`);
    await fs.writeFile(targetPath, buffer);

    // Update database record
    await pool.query(
      `
      UPDATE bank_policy_files
      SET 
        file_name = $1,
        file_type = $2,
        file_path = $3,
        file_size_bytes = $4,
        extracted_text = $5,
        uploaded_at = NOW()
      WHERE id = $6
      `,
      [fileName, ext, targetPath, fileSize, textContent, fileId]
    );

    return NextResponse.json({
      success: true,
      message: `File updated successfully to ${fileName}`,
      file_name: fileName,
      file_size_bytes: fileSize,
    });
  } catch (err) {
    console.error("Failed to replace policy file", err);
    return NextResponse.json(
      { success: false, error: "Failed to replace policy file" },
      { status: 500 }
    );
  }
}
