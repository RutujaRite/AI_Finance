// lib/bankSearch.ts
/**
 * Bank manager search functionality for CreditWise AI Financial Assistant.
 * Queries PostgreSQL `bank_managers` table with strict location and bank filtering.
 */

import pool from "./db";

export interface BankManagerRecord {
  id: number;
  bank_name: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  role: string | null;
  status: string;
  branch?: string | null;
  branch_code?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  employee_code?: string | null;
  extra_info?: any;
}

const CITY_LIST = [
  "pune", "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "chennai", 
  "kolkata", "jaipur", "jodhpur", "ahmedabad", "surat", "nagpur", "nashik", 
  "thane", "ghaziabad", "noida", "gurgaon", "gurugram", "indore", "bhopal", 
  "lucknow", "kanpur", "patna", "vadodara", "coimbatore", "kochi", "trivandrum", 
  "chandigarh", "ludhiana", "raipur", "ranchi", "raigad", "wardha", "nagpur"
];

const BANK_LIST = [
  "icici", "hdfc", "sbi", "axis", "kotak", "indusind", "idfc", "bajaj", 
  "chola", "fibe", "finnable", "piramal", "poonawalla", "tata", "utkarsh", "yes", "bandhan", "smfg", "incred"
];

const ROLE_LIST = [
  { keywords: ["asm", "area sales manager", "area manager"], filter: "area" },
  { keywords: ["rsm", "regional sales manager", "regional manager"], filter: "regional" },
  { keywords: ["zsm", "zonal sales manager", "zonal manager"], filter: "zonal" },
  { keywords: ["rm", "relationship manager"], filter: "relationship" },
  { keywords: ["sm", "sales manager"], filter: "sales manager" },
  { keywords: ["rh", "regional head"], filter: "regional head" },
  { keywords: ["zh", "zone head"], filter: "zone head" },
  { keywords: ["coordinator", "spoc"], filter: "coordinator" }
];

export async function searchBankManager(
  params: Partial<{ bank_name: string; city: string; branch_name: string; manager_name: string; query?: string }>
): Promise<BankManagerRecord[]> {
  const client = await pool.connect();
  
  try {
    const rawQuery = (params.query || `${params.bank_name || ""} ${params.city || ""} ${params.branch_name || ""}`).toLowerCase().trim();
    
    // 1. Sentence Tokenization & Entity Extraction
    let targetBank = (params.bank_name || "").toLowerCase().trim();
    if (!targetBank) {
      const foundBank = BANK_LIST.find(b => rawQuery.includes(b));
      if (foundBank) targetBank = foundBank;
    }
    // Clean bank token (e.g. "icici bank manager contact" -> "icici")
    let cleanBank = targetBank;
    for (const b of BANK_LIST) {
      if (targetBank.includes(b) || rawQuery.includes(b)) {
        cleanBank = b;
        break;
      }
    }
    if (!cleanBank && targetBank) {
      cleanBank = targetBank.replace(/bank|manager|contact|details|location|branch|officer/gi, "").trim();
    }

    // 2. City / Location Token
    let targetCity = (params.city || "").toLowerCase().trim();
    if (!targetCity) {
      const foundCity = CITY_LIST.find(c => rawQuery.includes(c));
      if (foundCity) targetCity = foundCity;
    }
    // Clean city token (e.g. "mumbai location" -> "mumbai")
    let cleanCity = targetCity;
    for (const c of CITY_LIST) {
      if (targetCity.includes(c) || rawQuery.includes(c)) {
        cleanCity = c;
        break;
      }
    }
    if (!cleanCity && targetCity) {
      cleanCity = targetCity.replace(/location|city|branch|area|district|state|manager|contact/gi, "").trim();
    }

    // Detect Role filter if user requested specific role (ASM, RSM, ZSM, RM, etc.)
    let targetRoleFilter = "";
    for (const r of ROLE_LIST) {
      if (r.keywords.some(k => rawQuery.includes(k))) {
        targetRoleFilter = r.filter;
        break;
      }
    }

    let query = `
      SELECT 
        id,
        COALESCE(bank_name, 'Partner Bank') AS bank_name,
        COALESCE(name, 'Manager') AS name,
        phone,
        email,
        COALESCE(location, 'General Branch') AS location,
        city,
        district,
        state,
        branch,
        role,
        employee_code,
        extra_info,
        status
      FROM bank_managers
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];

    // Filter by Bank Name (Clean token e.g. "icici")
    if (cleanBank) {
      queryParams.push(`%${cleanBank}%`);
      query += ` AND LOWER(bank_name) LIKE LOWER($${queryParams.length})`;
    }

    // Filter by City / Location / District / State (Clean token e.g. "mumbai")
    if (cleanCity) {
      queryParams.push(`%${cleanCity}%`);
      query += ` AND (
        LOWER(location) LIKE LOWER($${queryParams.length}) OR 
        LOWER(COALESCE(city, '')) LIKE LOWER($${queryParams.length}) OR 
        LOWER(COALESCE(district, '')) LIKE LOWER($${queryParams.length}) OR 
        LOWER(COALESCE(state, '')) LIKE LOWER($${queryParams.length})
      )`;
    }

    console.log("[bankSearch DEBUG] cleanBank:", cleanBank, "| cleanCity:", cleanCity, "| rawQuery:", rawQuery);
    console.log("[bankSearch DEBUG] SQL:", query);
    console.log("[bankSearch DEBUG] Params:", queryParams);

    const result = await client.query(query, queryParams);
    console.log("[bankSearch DEBUG] Query returned rows count:", result.rows.length);
    if (result.rows.length > 0) {
      return result.rows;
    }

    // Progressive Smart Fallback 1: If Bank + City yields 0 records, try Bank match alone
    if (cleanBank) {
      const bankOnlyRes = await client.query(
        `SELECT id, COALESCE(bank_name, 'Partner Bank') AS bank_name, COALESCE(name, 'Manager') AS name, 
                phone, email, COALESCE(location, 'General Branch') AS location, city, district, state, 
                branch, role, employee_code, extra_info, status 
         FROM bank_managers 
         WHERE LOWER(bank_name) LIKE LOWER($1) 
         ORDER BY name ASC LIMIT 15`,
        [`%${cleanBank}%`]
      );
      if (bankOnlyRes.rows.length > 0) {
        return bankOnlyRes.rows;
      }
    }

    // Progressive Smart Fallback 2: If City match alone
    if (cleanCity) {
      const cityOnlyRes = await client.query(
        `SELECT id, COALESCE(bank_name, 'Partner Bank') AS bank_name, COALESCE(name, 'Manager') AS name, 
                phone, email, COALESCE(location, 'General Branch') AS location, city, district, state, 
                branch, role, employee_code, extra_info, status 
         FROM bank_managers 
         WHERE (LOWER(location) LIKE LOWER($1) OR LOWER(COALESCE(city, '')) LIKE LOWER($1) OR LOWER(COALESCE(district, '')) LIKE LOWER($1) OR LOWER(COALESCE(state, '')) LIKE LOWER($1))
         ORDER BY bank_name ASC LIMIT 15`,
        [`%${cleanCity}%`]
      );
      if (cityOnlyRes.rows.length > 0) {
        return cityOnlyRes.rows;
      }
    }

    // Fallback 3: Multi-word general text search
    if (rawQuery.length > 2) {
      const words = rawQuery
        .split(/\s+/)
        .filter(w => w.length > 2 && !["bank", "manager", "details", "contact", "number", "in", "for", "the", "find", "show", "give"].includes(w));
      
      if (words.length > 0) {
        const andConditions = words.map((_, i) => `(LOWER(bank_name) LIKE $${i + 1} OR LOWER(location) LIKE $${i + 1} OR LOWER(name) LIKE $${i + 1} OR LOWER(COALESCE(role, '')) LIKE $${i + 1})`).join(" AND ");
        const andParams = words.map(w => `%${w}%`);
        
        let fallbackSql = `
          SELECT 
            id, COALESCE(bank_name, 'Partner Bank') AS bank_name, COALESCE(name, 'Manager') AS name, 
            phone, email, COALESCE(location, 'General Branch') AS location, city, district, state, 
            branch, role, employee_code, extra_info, status 
          FROM bank_managers 
          WHERE ${andConditions} LIMIT 20
        `;
        const fallbackRes = await client.query(fallbackSql, andParams);
        return fallbackRes.rows;
      }
    }
    
    return [];
  } catch (err) {
    console.error("searchBankManager error:", err);
    return [];
  } finally {
    client.release();
  }
}

export function formatManagers(managers: BankManagerRecord[], userQuery?: string): string {
  if (!managers || managers.length === 0) {
    return `| ⚠️ Status | Message |\n| :--- | :--- |\n| **No Records Found** | No bank manager records matched your criteria. Please verify bank name or city. |`;
  }

  let table = `| 🏦 Bank Name | 👤 Manager Name & Role | 📞 Mobile Contact | ✉️ Official Email | 📍 Location & CPC Details | 🆔 Emp Code |\n`;
  table += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  managers.forEach((mgr) => {
    const bankName = mgr.bank_name || "Partner Bank";
    const roleText = mgr.role ? `<br/>*(${mgr.role})*` : "";
    const nameRole = `**${mgr.name || 'Manager'}**${roleText}`;
    
    const phone = (mgr.phone && mgr.phone !== "N/A" && mgr.phone !== "#ERROR!") ? `\`${mgr.phone}\`` : "—";
    const hasValidEmail = mgr.email && !mgr.email.includes("example.com");
    const email = hasValidEmail ? `\`${mgr.email}\`` : "—";
    
    const cleanLoc = (mgr.location || "General Branch").replace(/\n/g, ", ");
    let extraLoc = "";
    if (mgr.extra_info && typeof mgr.extra_info === "object") {
      const cpc = mgr.extra_info["Sourcing & Processing CPC"] || mgr.extra_info["CPC"] || "";
      if (cpc) extraLoc = `<br/>*CPC: ${cpc}*`;
    }
    const locationCol = `${cleanLoc}${mgr.state ? ` (${mgr.state})` : ""}${extraLoc}`;
    
    const empCode = (mgr.employee_code && mgr.employee_code !== "N/A") ? `\`${mgr.employee_code}\`` : "—";

    table += `| **${bankName}** | ${nameRole} | ${phone} | ${email} | ${locationCol} | ${empCode} |\n`;
  });

  return table.trim();
}