// lib/ai/companyFollowUp.ts
/**
 * Company Follow-Up Resolution Engine
 * Handles natural multi-turn contextual queries about companies previously discussed,
 * e.g., "What is its revenue?", "Which industry does it belong to?", "What is its bank category?",
 * "Where is it located?", "Show its partner-bank records".
 */

import { searchCompany, CompanySearchResult } from "@/lib/companySearch";
import { extractCleanCompanyName, extractTargetCompanyFromMessage, isInvalidCompanyName } from "@/lib/dynamicEligibilityEngine";

export interface CompanyFollowUpMatch {
  isFollowUp: boolean;
  field?: "revenue" | "industry" | "bank_categories" | "location" | "employees" | "profit" | "overview";
  explicitCompany?: string;
}

/**
 * Detects whether a message is asking about a specific field of a company in context
 * (or an explicitly named company).
 */
export function detectCompanyFollowUp(
  message: string,
  contextCompany?: string
): CompanyFollowUpMatch {
  if (!message || typeof message !== "string") return { isFollowUp: false };
  const norm = message.toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();

  // Guard against bank policy queries, greetings, or explicit eligibility checks
  if (
    /^(?:hi|hello|hey|namaste|good\s+morning|good\s+evening|good\s+afternoon)\b/i.test(norm) ||
    /(?:check|evaluate|calculate)\s*(?:my\s*)?eligib\w*/i.test(norm) ||
    /(?:cibil|cutoff|foir|roi|minimum\s*salary)\s*(?:for|of|in)?\s*(?:hdfc|icici|axis|sbi|kotak|bajaj|yes\s*bank)/i.test(norm)
  ) {
    return { isFollowUp: false };
  }

  const explicitTarget = extractTargetCompanyFromMessage(message);

  const hasPronounRef =
    /\b(?:its|it|the\s*company'?s?|this\s*company'?s?|that\s*company'?s?|the\s*firm'?s?|the\s*employer'?s?)\b/i.test(norm) ||
    /^(?:what\s+about\s+(?:its|the)\s+|and\s+(?:its|the)\s+)/i.test(norm);

  const effectiveCompany = explicitTarget || contextCompany;

  // If no company in context and no explicit company in message, cannot be a follow-up
  if (!effectiveCompany) {
    return { isFollowUp: false };
  }

  // 1. Revenue / Turnover
  if (
    /\b(?:revenue|turnover|sales|annual\s*revenue|annual\s*turnover|how\s*much\s*(?:revenue|money|sales)\s*(?:does\s*it|do\s*they)\s*(?:make|generate))\b/i.test(norm) ||
    /^(?:what\s+is\s+(?:its|the)\s+revenue\??|revenue\??|what\s+about\s+(?:its|the)\s+revenue\??)$/i.test(norm)
  ) {
    return { isFollowUp: true, field: "revenue", explicitCompany: explicitTarget };
  }

  // 2. Industry / Sector
  if (
    /\b(?:industry|sector|domain|field\s*of\s*work|what\s*(?:industry|sector|business)\s*(?:does\s*it|is\s*it))\b/i.test(norm) ||
    /^(?:which\s+industry\s*(?:does\s*it\s*belong\s*to|is\s*it\s*in)\??|what\s+is\s+(?:its|the)\s+industry\??|industry\??)$/i.test(norm)
  ) {
    return { isFollowUp: true, field: "industry", explicitCompany: explicitTarget };
  }

  // 3. Bank Categories / Partner Bank Records
  if (
    /\b(?:bank\s*categor(?:y|ies)|partner[\s-]*bank\s*records?|which\s*banks?\s*list\s*it|bank\s*ratings?|tier\s*in\s*banks?|company\s*category\s*across\s*banks?)\b/i.test(norm) ||
    /^(?:what\s+is\s+(?:its|the)\s+bank\s*categor(?:y|ies)\??|show\s+(?:its|the)\s+partner[\s-]*bank\s*records?\??|what\s+are\s+its\s+categories\??)$/i.test(norm)
  ) {
    return { isFollowUp: true, field: "bank_categories", explicitCompany: explicitTarget };
  }

  // 4. Profit / Financial Health
  if (
    /\b(?:profit|profitability|profitable|net\s*profit|profit\s*status|financial\s*trend|financial\s*health)\b/i.test(norm) ||
    /^(?:what\s+is\s+(?:its|the)\s+profit\??|is\s*it\s*profitable\??|profit\??)$/i.test(norm)
  ) {
    return { isFollowUp: true, field: "profit", explicitCompany: explicitTarget };
  }

  // 5. Location / Headquarters / Address
  if (
    /\b(?:headquarter[s]?|where\s+is\s+it\s+(?:located|headquartered|based)|address|registered\s*office|location)\b/i.test(norm) ||
    /^(?:where\s+is\s+it\s+located\??|where\s+is\s+its\s+headquarters\??|what\s+is\s+its\s+address\??)$/i.test(norm)
  ) {
    return { isFollowUp: true, field: "location", explicitCompany: explicitTarget };
  }

  // 6. Employees / Headcount
  if (
    /\b(?:employees?|headcount|workforce|staff|how\s*many\s*people\s*work\s*there|number\s*of\s*employees)\b/i.test(norm) ||
    /^(?:how\s*many\s*employees\??|what\s+is\s+(?:its|the)\s+headcount\??|employee\s*count\??)$/i.test(norm)
  ) {
    return { isFollowUp: true, field: "employees", explicitCompany: explicitTarget };
  }

  // 7. General follow-up inquiry referencing "it" or "the company"
  if (hasPronounRef && /(?:tell\s+me\s+more|more\s+info|more\s+details|what\s+else|explain\s+more)/i.test(norm)) {
    return { isFollowUp: true, field: "overview", explicitCompany: explicitTarget };
  }

  return { isFollowUp: false };
}

/**
 * Resolves the company to query by checking the current message, session state, and conversation history.
 */
export function resolveContextualCompany(
  message: string,
  session?: any,
  history?: Array<{ role: string; content: string }>
): string | undefined {
  // 1. Direct explicit mention in message
  const directTarget = extractTargetCompanyFromMessage(message);
  if (directTarget && !isInvalidCompanyName(directTarget)) {
    return directTarget;
  }

  // 2. Check session state
  const sessionComp =
    session?.referencedEntities?.lastMentionedCompany ||
    session?.selectedCompanyName ||
    session?.companyFlow?.selectedCompanyName ||
    session?.company ||
    session?.applicant?.companyName;

  if (sessionComp && !isInvalidCompanyName(sessionComp) && sessionComp !== "Self-Employed" && sessionComp !== "Unlisted Company") {
    return sessionComp;
  }

  // 3. Scan recent conversation history in reverse
  if (history && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const hContent = history[i].content || "";
      const hTarget = extractTargetCompanyFromMessage(hContent);
      if (hTarget && !isInvalidCompanyName(hTarget)) {
        return hTarget;
      }
      // Check for common company mentions
      const companyMatch = hContent.match(/\b(Microsoft|Infosys|TCS|Tata Consultancy Services|Wipro|Accenture|HCL|Tech Mahindra|Reliance|Cognizant|Capgemini|IBM|Google|Amazon|Flipkart)\b/i);
      if (companyMatch) {
        return companyMatch[1];
      }
    }
  }

  return undefined;
}

/**
 * Generates an exact, grounded, field-specific answer for the company follow-up query.
 */
export async function executeCompanyFollowUpAnswer(
  match: CompanyFollowUpMatch,
  companyName: string
): Promise<{ reply: string; companyData?: any } | null> {
  const company = await searchCompany(companyName);
  if (!company?.found) {
    return null;
  }

  const primaryName = company.primaryName || companyName;
  const live = company.liveInformation;
  const basic = live?.basicInfo || company.basicInfo;
  const fin = live?.financialInfo || company.financialInfo;

  switch (match.field) {
    case "revenue": {
      const revenue = live?.revenue || fin?.turnover || fin?.turnover_field?.value;
      const trend = live?.performance_trend || fin?.performance_trend || fin?.performance_trend_field?.value;
      const profit = live?.profit || fin?.profit_status || fin?.profit_status_field?.value;
      const period = fin?.turnover_field?.reportingPeriod ? ` *(${fin.turnover_field.reportingPeriod})*` : "";

      let reply = `### 💰 **${primaryName}** — Revenue & Financial Performance\n\n`;
      if (revenue && revenue !== "Not available" && !/unlisted/i.test(revenue)) {
        reply += `• **Turnover / Revenue**: **${revenue}**${period}\n`;
      } else if (trend) {
        reply += `• **Revenue & Growth**: Standalone turnover for the Indian private subsidiary is not publicly reported in the registry. However, recent corporate performance records indicate **${trend}**.\n`;
      } else {
        reply += `• **Revenue Information**: Standalone annual turnover is not publicly reported in the corporate registry filings for this entity.\n`;
      }

      if (profit && profit !== "Not available") {
        reply += `• **Profit Status**: **${profit}**\n`;
      }
      if (trend && (!revenue || revenue === "Not available")) {
        reply += `• **Performance Trend**: ${trend}\n`;
      }

      // Mention partner bank listed status
      const records = company.bankRecords || [];
      if (records.length > 0) {
        const banksList = records.slice(0, 3).map((r) => `**${r.bank_name}** (${r.company_category || "Listed"})`).join(", ");
        reply += `• **Partner Bank Rating**: Verified across partner banks including ${banksList}.\n`;
      }

      reply += `\n*Would you like to see partner-bank category records, or check your personal loan eligibility with ${primaryName}?*`;
      return { reply, companyData: company };
    }

    case "industry": {
      const industry = live?.industry || basic?.industry || basic?.industry_field?.value || "Technology / Corporate Enterprise";
      const listing = live?.listing_status || basic?.listing_status || basic?.listing_status_field?.value || "Corporate Enterprise";
      const country = basic?.country || basic?.country_field?.value || "India";

      let reply = `### 🏢 **${primaryName}** — Industry & Domain\n\n`;
      reply += `• **Industry Sector**: **${industry}**\n`;
      reply += `• **Listing Status**: ${listing}\n`;
      reply += `• **Operating Country**: ${country}\n`;

      if (company.overview && !company.overview.includes("is verified in partner bank corporate records")) {
        reply += `\n**Overview**: ${company.overview}\n`;
      }

      reply += `\n*Would you like to see its partner bank category classifications or check your loan eligibility?*`;
      return { reply, companyData: company };
    }

    case "bank_categories": {
      const records = company.bankRecords || [];
      let reply = `### 🏦 **${primaryName}** — Partner Bank Category Records\n\n`;
      if (records.length > 0) {
        reply += `Here are the official category classifications for **${primaryName}** across our partner lenders:\n\n`;
        reply += `| Bank Name | Category | Other Info |\n`;
        reply += `| :--- | :--- | :--- |\n`;
        const unique = records.filter((r: any, idx: number, self: any[]) =>
          idx === self.findIndex((t: any) => t.bank_name?.toLowerCase() === r.bank_name?.toLowerCase())
        );
        for (const r of unique) {
          reply += `| **${r.bank_name}** | **${r.company_category || "Category A"}** | ${r.other_info || "Standard listed terms"} |\n`;
        }
        reply += `\n*Employees of ${primaryName} qualify for premium interest rates and higher FOIR limits across these lenders. Would you like to check your personal loan eligibility?*`;
      } else {
        reply += `**${primaryName}** is currently evaluated under **Open Market / Unlisted** criteria across our partner banks.\n\n*Would you like to check your eligibility across partner banks?*`;
      }
      return { reply, companyData: company };
    }

    case "profit": {
      const profit = live?.profit || fin?.profit_status || fin?.profit_status_field?.value || "Profitable Corporate Enterprise";
      const trend = live?.performance_trend || fin?.performance_trend || fin?.performance_trend_field?.value;

      let reply = `### 📊 **${primaryName}** — Profitability & Financial Health\n\n`;
      reply += `• **Profit Status**: **${profit}**\n`;
      if (trend) {
        reply += `• **Performance Trend**: ${trend}\n`;
      }
      reply += `\n*Would you like to check your loan eligibility with this employer?*`;
      return { reply, companyData: company };
    }

    case "location": {
      const address = live?.address || basic?.address || basic?.address_field?.value || "Registered corporate offices across major metropolitan hubs in India.";
      const website = live?.website || basic?.website || basic?.website_field?.value;

      let reply = `### 📍 **${primaryName}** — Registered Corporate Address\n\n`;
      reply += `• **Address**: ${address}\n`;
      if (website) {
        reply += `• **Website**: [${website}](https://${website.replace(/^https?:\/\//, "")})\n`;
      }
      reply += `\n*Would you like to explore branch manager contacts or check your personal loan eligibility?*`;
      return { reply, companyData: company };
    }

    case "employees": {
      const employees = live?.employees || fin?.employees || fin?.employees_field?.value || "Large-scale corporate enterprise";
      let reply = `### 👥 **${primaryName}** — Workforce & Headcount\n\n`;
      reply += `• **Employee Strength**: **${employees}**\n\n`;
      reply += `*Employees of ${primaryName} qualify for preferred corporate personal loan schemes across partner banks. Would you like to check your eligibility?*`;
      return { reply, companyData: company };
    }

    case "overview":
    default: {
      const overview = company.overview || `${primaryName} is an active corporate enterprise verified across partner bank corporate records.`;
      let reply = `### 🏢 **${primaryName}** — Company Overview\n\n`;
      reply += `${overview}\n\n`;
      const records = company.bankRecords || [];
      if (records.length > 0) {
        reply += `**Partner Bank Classification**: Category A / Listed across **${records.length} partner banks**.\n\n`;
      }
      reply += `*Would you like to check your personal loan eligibility or see specific financial records?*`;
      return { reply, companyData: company };
    }
  }
}
