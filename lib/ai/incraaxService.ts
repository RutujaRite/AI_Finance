// lib/ai/incraaxService.ts

import {
  searchIncraax,
  isIncraaxSearchConfigured,
  fetchLiveCompanyIntelligence,
  extractReportingPeriod,
  type IncraaxResult,
  type VerifiedField,
  type LiveCompanyIntelligence,
} from "../incraax";

export {
  searchIncraax,
  fetchLiveCompanyIntelligence,
  extractReportingPeriod,
  isIncraaxSearchConfigured,
};
export type { IncraaxResult, VerifiedField, LiveCompanyIntelligence };

export interface FinancialDirectorySearchResult {
  companyName: string;
  turnover?: VerifiedField<string>;
  revenue?: VerifiedField<string>;
  paidUpCapital?: VerifiedField<string>;
  authorizedCapital?: VerifiedField<string>;
  sources: IncraaxResult[];
  intelligence: LiveCompanyIntelligence;
}

/**
 * Searches targeted Indian corporate registries & financial directories (ZaubaCorp, Tofler, InstaFinancials)
 * using site operators for accurate turnover, revenue, paid-up capital, and authorized capital extraction.
 * Every extracted metric includes complete provenance (sourceUrl, sourceTitle, confidence, reportingPeriod).
 */
export async function searchFinancialDirectories(companyName: string): Promise<FinancialDirectorySearchResult> {
  const cleanName = String(companyName || "").trim();
  const intel = await fetchLiveCompanyIntelligence(cleanName);

  return {
    companyName: cleanName,
    turnover: intel.financialInfo.turnover_field,
    revenue: intel.financialInfo.turnover_field,
    paidUpCapital: intel.financialInfo.paid_up_capital_field,
    authorizedCapital: intel.financialInfo.authorized_capital_field,
    sources: intel.sources,
    intelligence: intel,
  };
}

/**
 * Live web search powered by the unified Incraax Search API.
 * Provides real-time financial information, current interest rate trends, and external bank news.
 * Automatically falls back to categories: "general" if categories: "news" returns empty results.
 */
export async function searchIncraaxWeb(query: string): Promise<string> {
  const q = String(query || "").trim();
  if (!q) {
    return "Please provide a query for web search.";
  }

  if (!isIncraaxSearchConfigured()) {
    return (
      `🌐 **Web Search**: Web search is currently unconfigured (missing \`INCRAAX_SEARCH_API_KEY\`). ` +
      `For partner bank policies and official loan criteria, I can directly consult our official Master Policy files and database records.`
    );
  }

  try {
    const results = await searchIncraax(q, { maxResults: 5 });
    if (results.length === 0) {
      return `No recent web search results found for "${q}".`;
    }

    const sources = results
      .slice(0, 4)
      .map(
        (r, idx) =>
          `**${idx + 1}. [${r.title || "Web Result"}](${r.url || "#"})**\n${(r.snippet || "").slice(0, 200)}...`
      )
      .join("\n\n");

    return `### 🌐 Web Search\n\n#### Relevant Sources:\n${sources}`;
  } catch (error: any) {
    console.error("[Incraax Search] Web search error:", error?.message || error);
    return `An error occurred while performing web search for "${q}". Using local Master Policy files instead.`;
  }
}
