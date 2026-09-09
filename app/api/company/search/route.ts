import { NextRequest, NextResponse } from "next/server";
import { searchCompany } from "../../../../lib/companySearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nowISO() {
  return new Date().toISOString();
}

/**
 * Build final response for the selected company.
 *
 * Sections:
 * 1. Company Live Information
 * 2. Basic Information
 * 3. Bank Records
 * 4. Financial Information
 */
function buildCompanyReply(
  name: string,
  overview: string,
  basic: any,
  financial: any,
  bankRecords: any[]
) {
  // 1. Live information from Exa/live search
  const liveSection = overview
    ? `### Company Live Information\n\n${overview}\n`
    : "";

  // 2. Basic information
  const basicRows = [
    ["Company Name", name],
    ["Industry", basic?.industry],
    ["Country", basic?.country],
    ["Incorporation Date", basic?.incorporation_date],
    ["Listing Status", basic?.listing_status],
    ["CIN", basic?.cin],
    ["Address", basic?.address],
    ["Website", basic?.website],
  ]
    .filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    )
    .map(([label, value]) => `| ${label} | ${value} |`)
    .join("\n");

  const basicSection = `
### Basic Information

| Field | Value |
| --- | --- |
${basicRows}
`;

  // 3. Bank records - remove duplicate bank names
  const seenBanks = new Set<string>();

  const uniqueBankRecords = (bankRecords || []).filter((record: any) => {
    const bankName = String(record?.bank_name || "")
      .trim()
      .toLowerCase();

    if (!bankName || seenBanks.has(bankName)) {
      return false;
    }

    seenBanks.add(bankName);
    return true;
  });

  const bankRows = uniqueBankRecords
    .map(
      (record: any) =>
        `| ${record.bank_name || "-"} | ${
          record.company_category || "-"
        } | ${record.other_info || "-"} |`
    )
    .join("\n");

  const bankSection = uniqueBankRecords.length
    ? `
### Bank Records

| Bank Name | Category | Other Info |
| --- | --- | --- |
${bankRows}
`
    : "";

  // 4. Financial information
  const financialRows = [
    ["Employees", financial?.employees],
    ["Turnover", financial?.turnover],
    ["Profit Status", financial?.profit_status],
    ["Last AGM", financial?.last_agm],
    ["Profit History", financial?.profit_history],
  ]
    .filter(
      ([, value]) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    )
    .map(([label, value]) => `| ${label} | ${value} |`)
    .join("\n");

  const financialSection = financialRows
    ? `
### Financial Information

| Field | Value |
| --- | --- |
${financialRows}
`
    : "";

  // Return sections in the required order
  return [
    liveSection,
    basicSection,
    bankSection,
    financialSection,
  ]
    .filter(Boolean)
    .join("\n");
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
    // ---------------------------------------------------------

    const reply = buildCompanyReply(
      result.primaryName,
      result.overview || "",
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