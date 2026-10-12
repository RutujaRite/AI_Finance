import { NextRequest, NextResponse } from "next/server";
import { searchCompany, formatCompanyResponse } from "../../../../lib/companySearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nowISO() {
  return new Date().toISOString();
}

async function handleSearch(companyName: string) {
  if (!companyName) {
    return NextResponse.json(
      {
        success: false,
        error: "company_name is required",
      },
      { status: 400 }
    );
  }

  /*
   * searchCompany handles:
   * - Database search (bank_company_data only)
   * - Company matching
   * - Multiple-company detection
   */
  const result = await searchCompany(companyName);

  // ---------------------------------------------------------
  // 1. COMPANY NOT FOUND
  // ---------------------------------------------------------
  if (!result.found) {
    const reply = `${companyName} not available in records`;

    return NextResponse.json({
      success: true,
      selection_required: false,
      company_name: companyName,
      response: reply,
      company_data: null,
      company_query: companyName,

      ai_message: {
        role: "ai",
        content: reply,
        timestamp: nowISO(),
      },
    });
  }

  // ---------------------------------------------------------
  // 2. MULTIPLE COMPANIES FOUND
  // Works for ANY company name.
  // ---------------------------------------------------------
  if (
    result.needsDisambiguation &&
    Array.isArray(result.candidates) &&
    result.candidates.length > 1
  ) {
    const candidates = result.candidates.map(
      (candidate: any, index: number) => {
        if (typeof candidate === "string") {
          return {
            id: String(index + 1),
            name: candidate,
          };
        }

        return {
          id:
            candidate.id ||
            candidate.company_id ||
            String(index + 1),

          name:
            candidate.name ||
            candidate.company_name ||
            candidate.title ||
            "Unknown Company",

          cin: candidate.cin || null,

          industry: candidate.industry || null,

          country: candidate.country || null,
        };
      }
    );

    const candidateList = candidates
      .map(
        (candidate: any, index: number) =>
          `${index + 1}. ${candidate.name}`
      )
      .join("\n");

    const reply =
      `Your search for **"${companyName}"** matched multiple companies:\n\n` +
      `${candidateList}\n\n` +
      `Please select the specific company you want information about.`;

    return NextResponse.json({
      success: true,
      selection_required: true,
      company_name: companyName,
      candidates,
      response: reply,
      company_data: null,
      company_query: companyName,

      ai_message: {
        role: "ai",
        content: reply,
        selection_required: true,
        candidates,
        timestamp: nowISO(),
      },
    });
  }

  // ---------------------------------------------------------
  // 3. ONE COMPANY FOUND / SELECTED
  // Live company intelligence already fetched and verified inside searchCompany (NEVER stored in DB)
  // ---------------------------------------------------------
  const overview = result.overview || "";
  const basicInfo = result.basicInfo || null;
  const financialInfo = result.financialInfo || null;

  const nextStepText = "Now let's continue with your eligibility assessment.\nWhat is your monthly take-home salary?";
  const reply = `${formatCompanyResponse(result)}\n\n${nextStepText}`;

  return NextResponse.json({
    success: true,
    selection_required: false,
    company_name: result.primaryName,
    response: reply,
    company_data: {
      company_name: result.primaryName,
      overview,
      basic_info: basicInfo,
      financial_info: financialInfo,
      bank_records: result.bankRecords,
    },
    company_query: companyName,

    ai_message: {
      role: "ai",
      content: reply,
      company_data: {
        company_name: result.primaryName,
        overview,
        basic_info: basicInfo,
        financial_info: financialInfo,
        bank_records: result.bankRecords,
      },
      company_query: companyName,
      timestamp: nowISO(),
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyName = String(
      searchParams.get("company_name") || searchParams.get("q") || ""
    ).trim();

    return await handleSearch(companyName);
  } catch (error) {
    console.error("company search GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Company search failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyName = String(
      body.company_name || body.q || ""
    ).trim();

    return await handleSearch(companyName);
  } catch (error) {
    console.error("company search POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Company search failed",
      },
      { status: 500 }
    );
  }
}