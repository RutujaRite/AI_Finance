/**
 * Incraax (SearXNG) web search integration.
 * Internal usage: chat API route falls back to web search when the query is not
 * recognized as a company, bank-manager, or account question.
 *
 * Depends on: INCRAAX_SEARCH_URL, INCRAAX_SEARCH_API_KEY, INCRAAX_SEARCH_USERNAME,
 *             INCRAAX_SEARCH_PASSWORD from .env
 */

const BASE_URL = (process.env.INCRAAX_SEARCH_URL || "https://search.incraaxaiautomation.in/api/search")
  .replace(/\/api\/search$/, "");
const LOGIN_URL = `${BASE_URL}/login`;
const SEARCH_URL = process.env.INCRAAX_SEARCH_URL || "https://search.incraaxaiautomation.in/api/search";

const SESSION_TTL = 30 * 60 * 1000;

let sessionCookie = "";
let authAt = 0;

async function login(): Promise<void> {
  const username = process.env.INCRAAX_SEARCH_USERNAME || "admin@example.com";
  const password = process.env.INCRAAX_SEARCH_PASSWORD || "";

  const getRes = await fetch(LOGIN_URL, { method: "GET", redirect: "manual" });
  const initialCookie = getRes.headers.get("set-cookie");
  if (initialCookie) sessionCookie = initialCookie.split(";")[0];

  const body = new URLSearchParams({ username, password, action: "login_with_password" }).toString();
  const loginRes = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    body,
    redirect: "manual",
  });
  const loginCookie = loginRes.headers.get("set-cookie");
  if (loginCookie) sessionCookie = loginCookie.split(";")[0];
  authAt = Date.now();
}

export interface IncraaxResult {
  title: string;
  url: string;
  snippet: string;
}

export async function incraaxSearch(query: string, maxResults = 5): Promise<IncraaxResult[]> {
  if (!query) return [];
  const apiKey = process.env.INCRAAX_SEARCH_API_KEY || "";
  if (!apiKey) return [];

  try {
    if (!sessionCookie || Date.now() - authAt > SESSION_TTL) {
      await login();
    }

    const url = new URL(SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
    });
    if (!res.ok) throw new Error(`Incraax search failed with status ${res.status}`);
    const data: any = await res.json();
    const results: IncraaxResult[] = (data.results || [])
      .slice(0, maxResults)
      .map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.content || r.snippet || "",
      }));
    return results;
  } catch (err) {
    console.error("Incraax search error:", err);
    throw err;
  }
}
