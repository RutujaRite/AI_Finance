/**
 * Chat API route.
 * Routes user messages to: company search, bank-manager search, or web search
 * depending on detected intent.
 *
 * Uses: lib/companySearch, lib/bankSearch, lib/nlExtract, lib/incraax
 */

import { NextRequest, NextResponse } from "next/server";
import { searchBankManager, formatManagers } from "../../../lib/bankSearch";
import {
  extractBankName,
  extractLocation,
  extractBranch,
  extractManagerName,
} from "../../../lib/nlExtract";
import { incraaxSearch } from "../../../lib/incraax";
import { searchCompany, saveCompanyInfo, fetchCompanyFromStructuredAPI } from "../../../lib/companySearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO() {
  return new Date().toISOString();
}

const BANK_KEYWORDS = [
  "bank manager", "manager details", "branch manager", "manager", "managers",
  "branch", "contact", "phone", "mobile", "email", "location",
];

function extractAfter(label: string, text: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n\\r]+)`, "i");
  const match = text.match(regex);
  if (!match) return null;
  const value = match[1].trim();
  if (!value || /not available|unknown|n\.?a\.?/i.test(value)) return null;
  return value;
}

async function searchCompanyOnline(companyName: string): Promise<{ basic_info: any; financial_info: any } | null> {
  try {
    const queries = [
      `${companyName} company basic information CIN incorporation date listing status`,
      `${companyName} financial information employees turnover profit status last annual meeting`,
      `${companyName} India company profile`,
      `${companyName} annual report employees turnover`,
    ];
    const results = await Promise.all(queries.map((q) => incraaxSearch(q, 8).catch(() => [])));
    const combinedText = results.flat().map((r) => `${r.title} ${r.snippet}`).join("\n");

    const extractValue = (patterns: string[], text: string): string | null => {
      for (const pattern of patterns) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n\\r]{3,80})`, "i");
        const match = text.match(regex);
        if (match) {
          let value = match[1].trim();
          value = value.replace(/\s*\(.*$/, "").replace(/\s*\.\s*.*$/, "").trim();
          if (value && !/not available|unknown|n\.?a\.?|www\.|http/i.test(value)) {
            return value;
          }
        }
      }
      return null;
    };

    const basic_info: any = {
      company_name: companyName,
      industry: extractValue(["industry", "sector", "sector:"], combinedText),
      address: extractValue(["address", "headquartered", "office address", "registered address"], combinedText),
      website: extractValue(["website", "official website", "web:"], combinedText),
      cin: extractValue(["CIN", "corporate identity number", "CIN:", "CIN number"], combinedText),
      incorporation_date: extractValue(["incorporated", "founded", "established", "date of incorporation"], combinedText),
      listing_status: extractValue(["listing status", "listed", "stock exchange", "publicly listed"], combinedText),
      country: extractValue(["country", "based in", "headquarters"], combinedText),
    };

    const financial_info: any = {
      company_name: companyName,
      employees: extractValue(["employees", "employee strength", "workforce", "total employees", "no. of employees"], combinedText),
      turnover: extractValue(["turnover", "revenue", "annual turnover", "annual revenue", "total turnover"], combinedText),
      profit_status: extractValue(["profit", "net profit", "profitable", "loss", "net profit/loss"], combinedText),
      last_agm: extractValue(["annual meeting", "AGM", "last AGM", "annual general meeting", "last annual meeting"], combinedText),
      profit_history: extractValue(["profitability", "profit history", "profit trend", "financial performance"], combinedText),
    };

    const hasBasic = Object.values(basic_info).some((v) => v && String(v).trim() !== "");
    const hasFinancial = Object.values(financial_info).some((v) => v && String(v).trim() !== "");

    if (!hasBasic && !hasFinancial) return null;
    return { basic_info, financial_info };
  } catch (e) {
    console.error("Online company search failed", e);
    return null;
  }
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
    : `**${name}**`

  return summaryParagraph
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  const conversationId = body.conversation_id;

  if (!message) {
    return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
  }

  try {
    const lower = message.toLowerCase();
    let reply =
      "I'm here to help with loans, EMI calculations, and account questions. Could you tell me more?";
    let bankData: any = null;
    let companyData: any = null;
    let companyQuery: string | null = null;

    const greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "howdy", "hola"]
    const isGreeting = greetings.some((g) => lower.includes(g)) && message.trim().length <= 10

    const companyIndicator =
      lower.includes("company") ||
      lower.includes("search company") ||
      lower.includes("bank record") ||
      lower.includes("which bank") ||
      /\b(PRIVATE LIMITED|LIMITED|PVT\.?\s*LTD|LTD|INC|CORP)\b/i.test(message);

    const genericWords = new Set([
      "the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did",
      "will","would","shall","should","may","might","can","could","must","i","you","he","she","it","we","they",
      "me","him","her","us","them","my","your","his","its","our","their","this","that","these","those","am",
      "isn't","aren't","wasn't","weren't","haven't","hasn't","hadn't","won't","wouldn't","don't","doesn't","didn't",
      "search","find","show","give","list","details","information","info","about","on","for","to","from","by",
      "with","without","and","or","but","in","on","at","to","from","of","if","then","not","no","yes","ok","okay",
      "please","plz","tell","what","where","when","who","whom","how","why","which","whose","whether","either","neither",
    ])

    const tokens = message.trim().split(/\s+/).filter(Boolean)
    const meaningfulTokens = tokens.filter((t) => !genericWords.has(t.toLowerCase()) && t.length > 2)
    const isLikelyCompanyQuery = companyIndicator || meaningfulTokens.length > 0

    let companySearchResult: any = null;
    let companySearchQuery = message.trim();

    if (companyIndicator) {
      for (const prefix of ["search company", "search for company", "find company", "company", "search "]) {
        if (companySearchQuery.toLowerCase().startsWith(prefix)) {
          companySearchQuery = companySearchQuery.slice(prefix.length).trim();
          break;
        }
      }
    }

    if (isGreeting) {
      reply = "Hello! I'm your AI assistant. Ask me anything about EMI calculations, loans, bank managers, or company records."
    } else if (isLikelyCompanyQuery) {
      try {
        companySearchResult = await searchCompany(companySearchQuery);
      } catch (e) {
        console.error("Company search error", e);
      }

      if (companySearchResult?.found) {
        companyQuery = companySearchQuery;

        if (companySearchResult.needsDisambiguation && companySearchResult.candidates.length > 1) {
          reply = `I found multiple companies related to ${companySearchQuery}.\n\nPlease select the specific company you want to view.`;
          companyData = {
            company_name: companySearchQuery,
            overview: reply,
            basic_info: null,
            financial_info: null,
            bank_records: [],
            candidates: companySearchResult.candidates,
            needs_disambiguation: true,
          };
        } else {
          const records = companySearchResult.bankRecords || []
          let basic = companySearchResult.basicInfo
          let financial = companySearchResult.financialInfo

          const hasBasicData = basic && Object.entries(basic).some(([key, v]) => key !== "company_name" && v && String(v).trim() !== "")
          const hasFinancialData = financial && Object.entries(financial).some(([key, v]) => key !== "company_name" && v && String(v).trim() !== "")

          if (!hasBasicData || !hasFinancialData) {
            const structuredResult = await fetchCompanyFromStructuredAPI(companySearchResult.primaryName || companySearchQuery)
            if (structuredResult) {
              basic = basic || structuredResult.basic_info || null
              financial = financial || structuredResult.financial_info || null
            }

            const stillNeedBasic = !basic || !Object.values(basic).some((v: any) => v && String(v).trim() !== "")
            const stillNeedFinancial = !financial || !Object.values(financial).some((v: any) => v && String(v).trim() !== "")

            if (stillNeedBasic || stillNeedFinancial) {
              const onlineResult = await searchCompanyOnline(companySearchResult.primaryName || companySearchQuery)
              if (onlineResult) {
                basic = basic || onlineResult.basic_info || null
                financial = financial || onlineResult.financial_info || null
              }
            }

            if (basic || financial) {
              saveCompanyInfo(companySearchResult.primaryName || companySearchQuery, basic, financial).catch((e) => {
                console.error("Failed to save company info", e)
              })
            }
          }

          const seen = new Set<string>()
          const uniqueRecords = records.filter((r: any) => {
            const key = String(r?.bank_name || "").trim().toLowerCase()
            if (!key || seen.has(key)) return false
            seen.add(key)
            return true
          })

          const name = basic?.company_name || companySearchResult.primaryName

          reply = buildCompanyReply(name, basic, financial, uniqueRecords)
          companyData = {
            company_name: companySearchResult.primaryName,
            overview: companySearchResult.overview || reply,
            basic_info: basic,
            financial_info: financial,
            bank_records: uniqueRecords,
          };
        }
      } else {
        let fallbackBasic: any = null
        let fallbackFinancial: any = null

        const structuredResult = await fetchCompanyFromStructuredAPI(companySearchQuery)
        if (structuredResult) {
          fallbackBasic = structuredResult.basic_info
          fallbackFinancial = structuredResult.financial_info
        }

        if (!fallbackBasic || !fallbackFinancial) {
          const onlineResult = await searchCompanyOnline(companySearchQuery)
          if (onlineResult) {
            fallbackBasic = fallbackBasic || onlineResult.basic_info || null
            fallbackFinancial = fallbackFinancial || onlineResult.financial_info || null
          }
        }

        if (fallbackBasic || fallbackFinancial) {
          saveCompanyInfo(companySearchQuery, fallbackBasic, fallbackFinancial).catch((e) => {
            console.error("Failed to save company info", e)
          })

          const name = fallbackBasic?.company_name || companySearchQuery

          reply = buildCompanyReply(name, fallbackBasic, fallbackFinancial, [])

          companyData = {
            company_name: name,
            overview: reply,
            basic_info: fallbackBasic,
            financial_info: fallbackFinancial,
            bank_records: [],
          }
        } else {
          reply = `**${companySearchQuery || message}** does not appear to provide loans from our existing bank partners.`;
        }
        companyQuery = companySearchQuery || message;
      }
    } else if (BANK_KEYWORDS.some((k) => lower.includes(k))) {
      const bankName = extractBankName(message);
      const loc = extractLocation(message);
      const branch = extractBranch(message);
      const managerName = extractManagerName(message);
      const result = await searchBankManager({
        bank_name: bankName,
        city: loc.value,
        branch,
        manager_name: managerName,
      });
      reply = formatManagers(result);
      bankData = result;
    } else if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
      reply =
        "Hello! I'm your AI assistant. Ask me anything about EMI calculations, loans, or your account.";
    } else {
      try {
        const results = await incraaxSearch(message, 5);
        if (results.length > 0) {
          reply = `Here are the top search results for **${message}**:\n\n`;
          results.forEach((r, i) => {
            reply += `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}\n\n`;
          });
        } else {
          reply = `I searched for "${message}" but couldn't find any results. Could you try rephrasing your question?`;
        }
      } catch (searchErr) {
        console.error("Search error", searchErr);
        reply = `I tried to search for "${message}" but couldn't connect to the search service right now. Please try again later.`;
      }
    }

    const aiMessage: any = {
      id: uid(),
      role: "ai",
      content: reply,
      timestamp: nowISO(),
    };
    if (companyData !== null) aiMessage.company_data = companyData;
    if (companyQuery !== null) aiMessage.company_query = companyQuery;
    if (bankData !== null) aiMessage.bank_data = bankData;

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      title: message.slice(0, 40) || "New Conversation",
      ai_message: aiMessage,
      user_message: { id: uid(), role: "user", content: message, timestamp: nowISO() },
    });
  } catch (err) {
    console.error("Chat API error", err);
    return NextResponse.json({ success: false, error: "Chat failed" });
  }
}
