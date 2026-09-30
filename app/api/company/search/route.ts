import { NextRequest, NextResponse } from "next/server";
import { searchCompany, formatCompanyResponse } from "../../../../lib/companySearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nowISO() {
  return new Date().toISOString();
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
        `Your search for **"${companyName}"** matched multiple companies:\n\n` +
        `${candidateList}\n\n` +
        `Please select the specific company you want information about.`;

      return NextResponse.json({
        success: true,

        // Tell frontend to display company selection
        selection_required: true,

        company_name: companyName,

        // List of companies user can select
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

    const reply = formatCompanyResponse(result);

    return NextResponse.json({
      success: true,

      selection_required: false,

      company_name: result.primaryName,

      response: reply,

      /*
       * Complete information of the selected company:
       * - Verified partner bank records from bank_company_data
       * - Real-time live overview/basic/financial from Incraax (NEVER stored in DB)
       */
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