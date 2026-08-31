/**
 * Company/bank-record search against the local PostgreSQL database.
 * Internal usage: chat API route and company search API route.
 * Depends on: lib/db (PostgreSQL pool)
 */

import pool from "./db";

export interface CompanyRecord {
  bank_name: string;
  sr_no: string;
  company_category: string;
  other_info: string;
}

export interface CompanyBasicInfo {
  company_name: string;
  industry: string;
  address: string;
  website: string;
  cin: string;
  incorporation_date: string;
  listing_status: string;
  country: string;
}

export interface CompanyFinancialInfo {
  company_name: string;
  employees: string;
  turnover: string;
  profit_status: string;
  last_agm: string;
  profit_history: string;
}

export interface CompanySearchResult {
  found: boolean;
  primaryName: string;
  overview: string;
  basicInfo: CompanyBasicInfo | null;
  financialInfo: CompanyFinancialInfo | null;
  bankRecords: CompanyRecord[];
}

function buildOverview(info: CompanyBasicInfo | null, financial: CompanyFinancialInfo | null): string {
  const parts: string[] = [];
  if (info?.industry) parts.push(`operates in the **${info.industry}** sector`);
  if (info?.country) parts.push(`is based in **${info.country}**`);
  if (info?.listing_status) parts.push(`has a **${info.listing_status}** listing status`);
  if (financial?.employees) parts.push(`employs approximately **${financial.employees}** people`);
  if (financial?.turnover) parts.push(`reports a turnover of **${financial.turnover}**`);
  if (financial?.profit_status) parts.push(`and is currently **${financial.profit_status}**`);

  const sentence = parts.join(", ") + ".";
  if (sentence.length > 300) {
    return parts.slice(0, 3).join(", ") + ".";
  }
  return sentence;
}

export async function searchCompany(companyName: string): Promise<CompanySearchResult> {
  const client = await pool.connect();
  try {
    const pattern = `%${companyName}%`;

    const [bankRes, basicRes, financialRes] = await Promise.all([
      client.query(
        `SELECT bcd.bank_name, bcd.sr_no, bcd.company_category, bcd.other_info
         FROM bank_company_data bcd
         WHERE LOWER(bcd.company_name) LIKE LOWER($1)
         ORDER BY bcd.company_name, bcd.bank_name, bcd.sr_no
         LIMIT 200`,
        [pattern]
      ),
      client.query(
        `SELECT company_name, industry, address, website, cin, incorporation_date, listing_status, country
         FROM company_basic_info
         WHERE LOWER(company_name) LIKE LOWER($1)
         LIMIT 1`,
        [pattern]
      ),
      client.query(
        `SELECT company_name, employees, turnover, profit_status, last_agm, profit_history
         FROM company_financial_info
         WHERE LOWER(company_name) LIKE LOWER($1)
         LIMIT 1`,
        [pattern]
      ),
    ]);

    const bankRecords: CompanyRecord[] = bankRes.rows.map((r) => ({
      bank_name: r.bank_name,
      sr_no: r.sr_no,
      company_category: r.company_category,
      other_info: r.other_info,
    }));

    const basicInfo: CompanyBasicInfo | null = basicRes.rowCount > 0 ? basicRes.rows[0] : null;
    const financialInfo: CompanyFinancialInfo | null = financialRes.rowCount > 0 ? financialRes.rows[0] : null;

    const names = Array.from(new Set(bankRecords.map((r) => r.bank_name).filter(Boolean)));
    names.sort();
    const primaryName = basicInfo?.company_name || companyName || names[0] || companyName;

    if (bankRecords.length === 0 && !basicInfo && !financialInfo) {
      return { found: false, primaryName: companyName, overview: "", basicInfo: null, financialInfo: null, bankRecords: [] };
    }

    const overview = buildOverview(basicInfo, financialInfo);

    return {
      found: true,
      primaryName,
      overview,
      basicInfo,
      financialInfo,
      bankRecords,
    };
  } finally {
    client.release();
  }
}

export async function fetchCompanyFromStructuredAPI(companyName: string): Promise<{ basic_info: CompanyBasicInfo | null; financial_info: CompanyFinancialInfo | null } | null> {
  const apiUrl = process.env.COMPANY_DATA_API_URL || "";
  const apiKey = process.env.COMPANY_DATA_API_KEY || "";
  const apiHost = process.env.COMPANY_DATA_API_HOST || "";

  if (!apiUrl || !apiKey) {
    return null;
  }

  try {
    const url = new URL(apiUrl);
    url.searchParams.set("q", companyName);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiHost) {
      headers["X-RapidAPI-Host"] = apiHost;
    }
    headers["X-RapidAPI-Key"] = apiKey;

    const res = await fetch(url.toString(), {
      method: "GET",
      headers,
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(`Structured company API failed with status ${res.status}`);
      return null;
    }

    const data = await res.json();

    let companyData: any = null;

    if (data.data && typeof data.data === "object") {
      companyData = data.data;
    } else if (data.company && typeof data.company === "object") {
      companyData = data.company;
    } else if (data.result && typeof data.result === "object") {
      companyData = data.result;
    } else if (data.companies && Array.isArray(data.companies) && data.companies.length > 0) {
      companyData = data.companies[0];
    } else if (typeof data === "object" && data !== null) {
      companyData = data;
    }

    if (!companyData) {
      return null;
    }

    const basic_info: CompanyBasicInfo = {
      company_name: companyData.company_name || companyData.name || companyName,
      industry: companyData.industry || companyData.sector || companyData.industry_type || null,
      address: companyData.address || companyData.registered_address || companyData.office_address || null,
      website: companyData.website || companyData.website_url || companyData.official_website || null,
      cin: companyData.cin || companyData.corporate_identity_number || null,
      incorporation_date: companyData.incorporation_date || companyData.date_of_incorporation || companyData.established_date || null,
      listing_status: companyData.listing_status || companyData.listed || companyData.stock_exchange || null,
      country: companyData.country || companyData.nationality || "India",
    };

    const financial_info: CompanyFinancialInfo = {
      company_name: companyData.company_name || companyData.name || companyName,
      employees: companyData.employees || companyData.employee_count || companyData.employee_strength || null,
      turnover: companyData.turnover || companyData.annual_turnover || companyData.revenue || companyData.annual_revenue || null,
      profit_status: companyData.profit_status || companyData.net_profit || companyData.profit_or_loss || null,
      last_agm: companyData.last_agm || companyData.last_annual_meeting || companyData.annual_general_meeting || null,
      profit_history: companyData.profit_history || companyData.profitability || companyData.financial_performance || null,
    };

    const hasBasic = Object.values(basic_info).some((v) => v && String(v).trim() !== "");
    const hasFinancial = Object.values(financial_info).some((v) => v && String(v).trim() !== "");

    if (!hasBasic && !hasFinancial) {
      return null;
    }

    return { basic_info, financial_info };
  } catch (e) {
    console.error("Structured company API error", e);
    return null;
  }
}

export async function saveCompanyInfo(companyName: string, basicInfo: CompanyBasicInfo | null, financialInfo: CompanyFinancialInfo | null): Promise<void> {
  if (!basicInfo && !financialInfo) return;
  const client = await pool.connect();
  try {
    const normalizedName = basicInfo?.company_name || financialInfo?.company_name || companyName;
    if (!normalizedName) return;

    const existingBasic = await client.query(
      `SELECT company_name FROM company_basic_info WHERE LOWER(company_name) = LOWER($1) LIMIT 1`,
      [normalizedName]
    );
    if (basicInfo && Object.values(basicInfo).some(v => v && String(v).trim() !== "")) {
      if (existingBasic.rowCount > 0) {
        await client.query(
          `UPDATE company_basic_info SET industry=$1, address=$2, website=$3, cin=$4, incorporation_date=$5, listing_status=$6, country=$7
           WHERE LOWER(company_name)=LOWER($8)`,
          [
            basicInfo.industry || null,
            basicInfo.address || null,
            basicInfo.website || null,
            basicInfo.cin || null,
            basicInfo.incorporation_date || null,
            basicInfo.listing_status || null,
            basicInfo.country || null,
            normalizedName,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO company_basic_info (company_name, industry, address, website, cin, incorporation_date, listing_status, country)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            normalizedName,
            basicInfo.industry || null,
            basicInfo.address || null,
            basicInfo.website || null,
            basicInfo.cin || null,
            basicInfo.incorporation_date || null,
            basicInfo.listing_status || null,
            basicInfo.country || null,
          ]
        );
      }
    }

    const existingFinancial = await client.query(
      `SELECT company_name FROM company_financial_info WHERE LOWER(company_name) = LOWER($1) LIMIT 1`,
      [normalizedName]
    );
    if (financialInfo && Object.values(financialInfo).some(v => v && String(v).trim() !== "")) {
      if (existingFinancial.rowCount > 0) {
        await client.query(
          `UPDATE company_financial_info SET employees=$1, turnover=$2, profit_status=$3, last_agm=$4, profit_history=$5
           WHERE LOWER(company_name)=LOWER($6)`,
          [
            financialInfo.employees || null,
            financialInfo.turnover || null,
            financialInfo.profit_status || null,
            financialInfo.last_agm || null,
            financialInfo.profit_history || null,
            normalizedName,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO company_financial_info (company_name, employees, turnover, profit_status, last_agm, profit_history)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            normalizedName,
            financialInfo.employees || null,
            financialInfo.turnover || null,
            financialInfo.profit_status || null,
            financialInfo.last_agm || null,
            financialInfo.profit_history || null,
          ]
        );
      }
    }
  } finally {
    client.release();
  }
}
