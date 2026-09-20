// lib/ai/tavilyService.ts

import { searchIncraax, isIncraaxSearchConfigured } from "../incraax";

/**
 * Live web search powered by the unified Incraax Search API (replaces legacy Tavily).
 * Provides real-time financial information, current interest rate trends, and external bank news.
 */
export async function searchTavilyWeb(query: string): Promise<string> {
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
