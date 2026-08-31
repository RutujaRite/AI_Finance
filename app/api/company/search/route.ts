/**
 * Company search API route.
 * Searches `bank_company_data`, `company_basic_info`, and `company_financial_info`
 * tables and returns enriched company data.
 *
 * Uses: lib/companySearch
 */

import { NextRequest, NextResponse } from "next/server";
import { searchCompany } from "../../../../lib/companySearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nowISO() {
  return new Date().toISOString();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const companyName = body.company_name || "";
  if (!companyName) {
    return NextResponse.json({ success: false, error: "company_name is required" }, { status: 400 });
  }

  try {
    const result = await searchCompany(companyName);
    if (!result.found) {
      return NextResponse.json({
        success: true,
        company_name: companyName,
        response: `${companyName} not available in records`,
        company_data: null,
        company_query: companyName,
        ai_message: {
          role: "ai",
          content: `${companyName} not available in records`,
          timestamp: nowISO(),
        },
      });
    }

    const reply = result.overview
      ? `${result.overview}\n\nFound ${result.bankRecords.length} bank record(s) for **${result.primaryName}**.`
      : `Found ${result.bankRecords.length} bank record(s) for **${result.primaryName}**.`;

    return NextResponse.json({
      success: true,
      company_name: companyName,
      response: reply,
      company_data: {
        company_name: result.primaryName,
        overview: result.overview,
        basic_info: result.basicInfo,
        financial_info: result.financialInfo,
        bank_records: result.bankRecords,
      },
      company_query: companyName,
      ai_message: {
        role: "ai",
        content: reply,
        company_data: {
          company_name: result.primaryName,
          overview: result.overview,
          basic_info: result.basicInfo,
          financial_info: result.financialInfo,
          bank_records: result.bankRecords,
        },
        company_query: companyName,
        timestamp: nowISO(),
      },
    });
  } catch (err) {
    console.error("company search error", err);
    return NextResponse.json({ success: false, error: "Company search failed" }, { status: 500 });
  }
}
