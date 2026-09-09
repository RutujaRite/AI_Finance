// routes.ts
/**
 * Company Search Routes
 * Handles company search and formatting operations
 */

import { NextRequest, NextResponse } from "next/server";
import { searchCompany, formatCompanyResponse } from "@/lib/companySearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nowISO() {
  return new Date().toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
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

    const result = await searchCompany(companyName);

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
        .map((candidate: any, index: number) => `${index + 1}. ${candidate.name}`)
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

    const reply = formatCompanyResponse(result);

    return NextResponse.json({
      success: true,
      selection_required: false,
      company_name: result.primaryName,
      response: reply,
      company_data: {
        company_name: result.primaryName,
        overview: result.overview,
        basic_info: result.basicInfo,
        bank_records: result.bankRecords,
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
