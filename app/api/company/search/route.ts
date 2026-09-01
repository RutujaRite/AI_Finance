import { NextRequest, NextResponse } from "next/server";
import { searchCompany } from "../../../../lib/companySearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nowISO() {
  return new Date().toISOString();
}

function buildCompanyReply(name: string, basic: any, financial: any, bankRecords: any[]) {
  const industry = basic?.industry || "-"
  const country = basic?.country || "-"
  const incorporation = basic?.incorporation_date || "-"
  const listing = basic?.listing_status || "-"
  const employees = financial?.employees || "-"
  const turnover = financial?.turnover || "-"
  const profit = financial?.profit_status || "-"
  const lastAGM = financial?.last_agm || "-"

  const summaryParts = [
    industry && industry !== "-" ? `operates in the **${industry}** sector` : null,
    country && country !== "-" ? `is based in **${country}**` : null,
    incorporation && incorporation !== "-" ? `was incorporated on **${incorporation}**` : null,
    listing && listing !== "-" ? `has a **${listing}** listing status` : null,
    employees && employees !== "-" ? `employs approximately **${employees}** people` : null,
    turnover && turnover !== "-" ? `reports a turnover of **${turnover}**` : null,
    profit && profit !== "-" ? `and is currently **${profit}**` : null,
  ].filter(Boolean)

  const summaryParagraph = summaryParts.length > 0
    ? `**${name}** ${summaryParts.join(", ")}.`
    : ""

  return summaryParagraph
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    /*
     * Works for ANY company:
     *
     * First search:
     * { company_name: "TCS" }
     *
     * If multiple companies are found, frontend shows candidates.
     *
     * After selection:
     * { company_name: "Tata Consultancy Services Limited" }
     */
    const companyName = String(body.company_name || "").trim();

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
     * - Database search
     * - Company matching
     * - Multiple-company detection
     * - Exa/live search
     * - Selected-company data
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
      /*
       * Convert candidates into a standard structure.
       * This allows the frontend to display them as selectable
       * company options.
       */
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
        `I found multiple companies related to ${companyName}.\n\n` +
        `Please select the specific company you want to view.`;

      return NextResponse.json({
        success: true,
        selection_required: true,
        company_name: companyName,
        candidates,
        response: reply,
        company_data: {
          company_name: companyName,
          overview: reply,
          basic_info: null,
          financial_info: null,
          bank_records: [],
          candidates: candidates.map((c: any) => c.name || c),
          needs_disambiguation: true,
        },
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
    // ---------------------------------------------------------

    const reply = buildCompanyReply(
      result.primaryName,
      result.basicInfo || {},
      result.financialInfo || {},
      result.bankRecords || []
    );

    return NextResponse.json({
      success: true,

      selection_required: false,

      company_name: result.primaryName,

      response: reply,

      /*
       * Complete information of the selected company.
       */
      company_data: {
        company_name: result.primaryName,

        // Exa/live information - 3 to 4 lines
        overview: result.overview,

        // CIN, address, website, industry, etc.
        basic_info: result.basicInfo,

        // Bank Name + Category + Other Info
        // Duplicate bank names are removed in the response.
        bank_records: result.bankRecords,

        // Employees, turnover, profit, AGM, etc.
        financial_info: result.financialInfo,
      },

      company_query: companyName,

      ai_message: {
        role: "ai",
        content: reply,

        company_data: {
          company_name: result.primaryName,
          overview: result.overview,
          basic_info: result.basicInfo,
          bank_records: result.bankRecords,
          financial_info: result.financialInfo,
        },

        company_query: companyName,
        timestamp: nowISO(),
      },
    });
  } catch (error) {
    console.error("company search error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Company search failed",
      },
      { status: 500 }
    );
  }
}