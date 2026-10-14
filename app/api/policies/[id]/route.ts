import { NextRequest, NextResponse } from "next/server";
import { deleteBankMasterPolicy, updateBankMasterPolicy } from "@/lib/masterPolicies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT /api/policies/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ruleId = parseInt(id, 10);
    if (!ruleId || isNaN(ruleId)) {
      return NextResponse.json({ success: false, error: "Invalid policy rule ID" }, { status: 400 });
    }

    const contentType = req.headers.get("content-type") || "";

    const updates: Record<string, any> = {};
    let uploadedFile: File | null = null;
    let bankIdToUpdate = ruleId;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      if (formData.get("min_cibil")) updates.min_cibil = Number(formData.get("min_cibil"));
      if (formData.get("max_cibil")) updates.max_cibil = Number(formData.get("max_cibil"));
      if (formData.get("min_salary")) updates.min_salary = Number(formData.get("min_salary"));
      if (formData.get("max_salary")) updates.max_salary = Number(formData.get("max_salary"));
      if (formData.get("min_age")) updates.min_age = Number(formData.get("min_age"));
      if (formData.get("max_age")) updates.max_age = Number(formData.get("max_age"));
      if (formData.get("min_loan_amount")) updates.min_loan_amount = Number(formData.get("min_loan_amount"));
      if (formData.get("max_loan_amount")) updates.max_loan_amount = Number(formData.get("max_loan_amount"));
      if (formData.get("min_tenure_months")) updates.min_tenure_months = Number(formData.get("min_tenure_months"));
      if (formData.get("max_tenure_months")) updates.max_tenure_months = Number(formData.get("max_tenure_months"));
      if (formData.get("foir_percent")) updates.foir_percent = Number(formData.get("foir_percent"));
      if (formData.get("roi")) updates.roi = String(formData.get("roi"));
      if (formData.get("processing_fee_percent")) updates.processing_fee_percent = Number(formData.get("processing_fee_percent"));
      if (formData.get("status")) updates.status = formData.get("status") as string;
      if (formData.get("loan_type")) updates.loan_type = formData.get("loan_type") as string;
      if (formData.get("employment_type")) updates.employment_type = formData.get("employment_type") as string;
      if (formData.get("policy_version")) updates.policy_version = formData.get("policy_version") as string;
      if (formData.get("bank_id")) bankIdToUpdate = Number(formData.get("bank_id"));

      uploadedFile = formData.get("file") as File | null;
    } else {
      const body = await req.json();
      Object.assign(updates, body);
      if (body.bank_id) bankIdToUpdate = Number(body.bank_id);
    }

    let fileData: { fileName: string; contentBuffer: Buffer } | undefined = undefined;
    if (uploadedFile && uploadedFile.size > 0) {
      const bytes = await uploadedFile.arrayBuffer();
      fileData = {
        fileName: uploadedFile.name,
        contentBuffer: Buffer.from(bytes),
      };
    }

    const result = await updateBankMasterPolicy(bankIdToUpdate, updates, fileData);

    return NextResponse.json({
      success: true,
      message: result.message,
      updates,
    });
  } catch (err: any) {
    console.error("Failed to update policy rule", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update policy rule" },
      { status: 500 }
    );
  }
}

// DELETE /api/policies/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ruleId = parseInt(id, 10);
    if (!ruleId || isNaN(ruleId)) {
      return NextResponse.json({ success: false, error: "Invalid policy ID" }, { status: 400 });
    }

    const fileName = req.nextUrl.searchParams.get("file_name") || undefined;
    const bankIdParam = req.nextUrl.searchParams.get("bank_id");
    const targetBankId = bankIdParam ? parseInt(bankIdParam, 10) : ruleId;

    const result = await deleteBankMasterPolicy(targetBankId, fileName);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Failed to delete policy rule", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to delete policy rule" },
      { status: 500 }
    );
  }
}
