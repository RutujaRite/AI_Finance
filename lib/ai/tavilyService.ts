// lib/ai/tavilyService.ts

/**
 * Searches the live web using Tavily Search API.
 * Provides real-time financial information, current interest rate trends, and external bank news.
 */
export async function searchTavilyWeb(query: string): Promise<string> {
  const q = String(query || "").trim();
  if (!q) {
    return "Please provide a query for web search.";
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return (
      `🌐 **Web Search (Tavily)**: Web search is currently unconfigured (missing \`TAVILY_API_KEY\`). ` +
      `For partner bank policies and official loan criteria, I can directly consult our official Master Policy files and database records.`
    );
  }

  const url = "https://api.tavily.com/search";
  const searchQuery = `${q} banking loan personal loan interest rate India`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; CreditWiseAI/1.0)",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: searchQuery,
        search_depth: "advanced",
        include_answer: true,
        include_raw_content: false,
        max_results: 5,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return `Web search request failed with status ${response.status}. Please check your query or try again later.`;
    }

    const data = await response.json();
    const answer = data.answer ? `### 🌐 Web Summary\n\n${data.answer}\n\n` : "";
    const results = Array.isArray(data.results) ? data.results : [];

    if (results.length === 0 && !answer) {
      return `No recent web search results found for "${q}".`;
    }

    const sources = results
      .slice(0, 4)
      .map(
        (r: any, idx: number) =>
          `**${idx + 1}. [${r.title || "Web Result"}](${r.url || "#"})**\n${(r.content || "").slice(0, 200)}...`
      )
      .join("\n\n");

    return `${answer}#### Relevant Sources:\n${sources}`;
  } catch (error: any) {
    console.error("[Tavily] Search error:", error?.message || error);
    return `An error occurred while performing web search for "${q}". Using local Master Policy files instead.`;
  }
}
