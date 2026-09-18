// lib/bankSearch.ts

/**
 * Bank Manager Search
 *
 * Responsibility:
 * - Search verified bank manager records from PostgreSQL.
 * - Accept structured filters prepared by the LLM/tool layer.
 * - Do NOT decide user intent.
 * - Do NOT maintain hardcoded bank/city/role dictionaries.
 * - Do NOT calculate loan eligibility.
 *
 * Expected flow:
 *
 * User
 *   ↓
 * LLM understands the request
 *   ↓
 * tools.ts creates structured search parameters
 *   ↓
 * searchBankManager()
 *   ↓
 * PostgreSQL bank_managers table
 *   ↓
 * verified records
 */

import pool from "./db";

/* =====================================================
 * TYPES
 * ===================================================== */

export interface BankManagerSearchParams {
  /**
   * Canonical/normalized bank name supplied by the
   * agent/tool layer.
   *
   * Example:
   * "ICICI Bank"
   */
  bank_name?: string;

  /**
   * City/location supplied by the LLM.
   *
   * Example:
   * "Pune"
   */
  city?: string;

  /**
   * Branch name supplied by the LLM.
   */
  branch_name?: string;

  /**
   * Exact/partial manager name supplied by the LLM.
   */
  manager_name?: string;

  /**
   * Role supplied by the LLM.
   *
   * Example:
   * "Relationship Manager"
   * "ASM"
   * "RSM"
   */
  role?: string;

  /**
   * Optional free-text query.
   *
   * This is used only when the agent intentionally
   * supplies a free-text search and no structured field
   * is available.
   */
  query?: string;
}

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
  extra_info?: Record<string, unknown> | null;
}

/* =====================================================
 * INTERNAL HELPERS
 * ===================================================== */

/**
 * Converts a value into a trimmed string.
 *
 * This is intentionally only normalization.
 * It does NOT try to understand intent.
 */
function normalizeValue(
  value: unknown
): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Escape SQL LIKE wildcard characters.
 *
 * This prevents user-supplied '%' and '_' from changing
 * the intended LIKE pattern.
 */
function escapeLikeValue(
  value: string
): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Build a LIKE parameter.
 */
function likeValue(
  value: string
): string {
  return `%${escapeLikeValue(value)}%`;
}

/* =====================================================
 * BRANCH DISCOVERY
 * ===================================================== */

/**
 * Searches distinct branch locations in PostgreSQL for a given bank and city/location.
 */
export async function findBankBranches(
  bankName: string,
  cityOrLocation: string
): Promise<string[]> {
  const client = await pool.connect();
  try {
    const normBank = bankName.replace(/bank|finance|limited|ltd/gi, "").trim();
    const normCity = cityOrLocation.trim();
    if (!normBank || !normCity) return [];

    const res = await client.query(
      `SELECT DISTINCT COALESCE(NULLIF(branch, ''), location) as branch_name
       FROM bank_managers
       WHERE LOWER(COALESCE(bank_name, '')) LIKE LOWER($1) ESCAPE '\\'
         AND (
           LOWER(COALESCE(location, '')) LIKE LOWER($2) ESCAPE '\\'
           OR LOWER(COALESCE(city, '')) LIKE LOWER($2) ESCAPE '\\'
           OR LOWER(COALESCE(district, '')) LIKE LOWER($2) ESCAPE '\\'
           OR LOWER(COALESCE(state, '')) LIKE LOWER($2) ESCAPE '\\'
         )
         AND COALESCE(NULLIF(branch, ''), location) IS NOT NULL
       ORDER BY branch_name ASC`,
      [`%${escapeLikeValue(normBank)}%`, `%${escapeLikeValue(normCity)}%`]
    );

    const rawBranches = res.rows
      .map((r: any) => String(r.branch_name || "").trim())
      .filter((b: string) => b.length > 0);

    // If more specific branch names exist (e.g. "KOLHAPUR - DASARA CHOWK"),
    // filter out the pure city name (e.g. "Kolhapur")
    const specificBranches = rawBranches.filter((b) => {
      const bLower = b.toLowerCase().replace(/[^\\w]/g, " ").trim();
      const cLower = normCity.toLowerCase().replace(/[^\\w]/g, " ").trim();
      return bLower !== cLower;
    });

    const candidates = specificBranches.length > 0 ? specificBranches : rawBranches;

    // Deduplicate case-insensitively
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const b of candidates) {
      const key = b.toLowerCase().replace(/\\s+/g, " ").trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(b);
      }
    }

    return unique;
  } catch (error) {
    console.error("[bankSearch] findBankBranches error:", error);
    return [];
  } finally {
    client.release();
  }
}

/* =====================================================
 * BANK MANAGER SEARCH
 * ===================================================== */

/**
 * Search bank managers using ONLY the structured filters
 * supplied by the caller.
 *
 * The LLM/tool layer is responsible for understanding:
 *
 *   "show ICICI RM in Pune"
 *
 * and converting it into something like:
 *
 * {
 *   bank_name: "ICICI Bank",
 *   city: "Pune",
 *   role: "Relationship Manager"
 * }
 *
 * This function does not maintain a hardcoded list of:
 * - banks
 * - cities
 * - roles
 */
export async function searchBankManager(
  params: BankManagerSearchParams
): Promise<BankManagerRecord[]> {
  const client =
    await pool.connect();

  try {
    const bankName =
      normalizeValue(params.bank_name);

    const city =
      normalizeValue(params.city);

    const branchName =
      normalizeValue(params.branch_name);

    const managerName =
      normalizeValue(params.manager_name);

    const role =
      normalizeValue(params.role);

    const freeText =
      normalizeValue(params.query);

    /**
     * Require at least one meaningful search field.
     *
     * This protects the database from accidental
     * "return every manager" queries.
     */
    const hasStructuredFilter =
      Boolean(
        bankName ||
        city ||
        branchName ||
        managerName ||
        role
      );

    const hasFreeText =
      Boolean(freeText);

    if (
      !hasStructuredFilter &&
      !hasFreeText
    ) {
      console.log(
        "[bankSearch] No search filters supplied."
      );

      return [];
    }

    /* -------------------------------------------------
     * BASE QUERY
     * ------------------------------------------------- */

    let query = `
      SELECT
        id,
        COALESCE(bank_name, 'Partner Bank') AS bank_name,
        COALESCE(name, 'Manager') AS name,
        COALESCE(phone, 'N/A') AS phone,
        COALESCE(email, 'N/A') AS email,
        COALESCE(location, 'General Branch') AS location,
        city,
        district,
        state,
        branch,
        NULL AS branch_code,
        role,
        employee_code,
        extra_info,
        COALESCE(status, 'active') AS status
      FROM bank_managers
      WHERE 1 = 1
    `;

    const queryParams: string[] = [];

    /* -------------------------------------------------
     * BANK FILTER
     * ------------------------------------------------- */

    if (bankName) {
      queryParams.push(
        likeValue(bankName)
      );

      query += `
        AND LOWER(COALESCE(bank_name, ''))
            LIKE LOWER($${queryParams.length}) ESCAPE '\\'
      `;
    }

    /* -------------------------------------------------
     * CITY / LOCATION FILTER
     *
     * Search across:
     * - location
     * - city
     * - district
     * - state
     *
     * The LLM decides what "Pune" means.
     * This service only searches the DB fields.
     * ------------------------------------------------- */

    if (city) {
      queryParams.push(
        likeValue(city)
      );

      const parameter =
        `$${queryParams.length}`;

      query += `
        AND (
          LOWER(COALESCE(location, ''))
              LIKE LOWER(${parameter}) ESCAPE '\\'
          OR
          LOWER(COALESCE(city, ''))
              LIKE LOWER(${parameter}) ESCAPE '\\'
          OR
          LOWER(COALESCE(district, ''))
              LIKE LOWER(${parameter}) ESCAPE '\\'
          OR
          LOWER(COALESCE(state, ''))
              LIKE LOWER(${parameter}) ESCAPE '\\'
        )
      `;
    }

    /* -------------------------------------------------
     * BRANCH FILTER
     * ------------------------------------------------- */

    if (branchName) {
      queryParams.push(
        likeValue(branchName)
      );

      query += `
        AND (
          LOWER(COALESCE(branch, ''))
              LIKE LOWER($${queryParams.length}) ESCAPE '\\'
          OR
          LOWER(COALESCE(location, ''))
              LIKE LOWER($${queryParams.length}) ESCAPE '\\'
        )
      `;
    }

    /* -------------------------------------------------
     * MANAGER NAME FILTER
     * ------------------------------------------------- */

    if (managerName) {
      queryParams.push(
        likeValue(managerName)
      );

      query += `
        AND LOWER(COALESCE(name, ''))
            LIKE LOWER($${queryParams.length}) ESCAPE '\\'
      `;
    }

    /* -------------------------------------------------
     * ROLE FILTER
     *
     * No ROLE_LIST.
     *
     * The LLM sends the role.
     * ------------------------------------------------- */

    if (role) {
      queryParams.push(
        likeValue(role)
      );

      query += `
        AND LOWER(COALESCE(role, ''))
            LIKE LOWER($${queryParams.length}) ESCAPE '\\'
      `;
    }

    /* -------------------------------------------------
     * FREE TEXT FILTER
     *
     * Used only when the caller explicitly supplies
     * a query.
     *
     * This is NOT used to invent or infer entities.
     * ------------------------------------------------- */

    if (
      freeText &&
      !hasStructuredFilter
    ) {
      const words =
        freeText
          .split(/\s+/)
          .map((word) =>
            word.trim()
          )
          .filter(
            (word) =>
              word.length > 1
          )
          .slice(0, 8);

      for (const word of words) {
        queryParams.push(
          likeValue(word)
        );

        const parameter =
          `$${queryParams.length}`;

        query += `
          AND (
            LOWER(COALESCE(bank_name, ''))
                LIKE LOWER(${parameter}) ESCAPE '\\'
            OR
            LOWER(COALESCE(name, ''))
                LIKE LOWER(${parameter}) ESCAPE '\\'
            OR
            LOWER(COALESCE(location, ''))
                LIKE LOWER(${parameter}) ESCAPE '\\'
            OR
            LOWER(COALESCE(city, ''))
                LIKE LOWER(${parameter}) ESCAPE '\\'
            OR
            LOWER(COALESCE(district, ''))
                LIKE LOWER(${parameter}) ESCAPE '\\'
            OR
            LOWER(COALESCE(state, ''))
                LIKE LOWER(${parameter}) ESCAPE '\\'
            OR
            LOWER(COALESCE(branch, ''))
                LIKE LOWER(${parameter}) ESCAPE '\\'
            OR
            LOWER(COALESCE(role, ''))
                LIKE LOWER(${parameter}) ESCAPE '\\'
          )
        `;
      }
    }

    /* -------------------------------------------------
     * ORDERING
     * ------------------------------------------------- */

    query += `
      ORDER BY
        bank_name ASC,
        city ASC NULLS LAST,
        name ASC
      LIMIT 20
    `;

    console.log(
      "[bankSearch] Structured search:",
      {
        bank_name: bankName || null,
        city: city || null,
        branch_name:
          branchName || null,
        manager_name:
          managerName || null,
        role: role || null,
        query: freeText || null
      }
    );

    console.log(
      "[bankSearch] SQL:",
      query
    );

    console.log(
      "[bankSearch] Parameters:",
      queryParams
    );

    const result =
      await client.query<
        BankManagerRecord
      >(
        query,
        queryParams
      );

    console.log(
      "[bankSearch] Rows returned:",
      result.rows.length
    );

    return result.rows;
  } catch (error: unknown) {
    console.error(
      "[bankSearch] Search error:",
      error
    );

    return [];
  } finally {
    client.release();
  }
}

/* =====================================================
 * MANAGER FORMATTER
 * ===================================================== */

/**
 * Convert verified DB manager records into the existing
 * markdown table format.
 *
 * IMPORTANT:
 * This function only formats database results.
 * It does not make search decisions.
 */
export function formatManagers(
  managers: BankManagerRecord[],
  _userQuery?: string
): string {
  if (
    !managers ||
    managers.length === 0
  ) {
    return (
      `| ⚠️ Status | Message |\n` +
      `| :--- | :--- |\n` +
      `| **No Records Found** | ` +
      `No bank manager records matched your criteria. ` +
      `Please verify the bank, city, branch, or manager name. |`
    );
  }

  let table =
    `| 🏦 Bank Name | 👤 Manager Name & Role | 📞 Mobile Contact | ✉️ Official Email | 📍 Location & Branch Details | 🆔 Emp Code |\n`;

  table +=
    `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  managers.forEach(
    (mgr) => {
      const bankName =
        mgr.bank_name ||
        "Partner Bank";

      const managerName =
        mgr.name ||
        "Manager";

      const roleText =
        mgr.role
          ? `<br/>*(${mgr.role})*`
          : "";

      const nameRole =
        `**${managerName}**${roleText}`;

      /* ---------------------------------------------
       * PHONE
       * --------------------------------------------- */

      const hasValidPhone =
        Boolean(
          mgr.phone &&
          mgr.phone !== "N/A" &&
          mgr.phone !== "#ERROR!"
        );

      const phone =
        hasValidPhone
          ? `\`${mgr.phone}\``
          : "—";

      /* ---------------------------------------------
       * EMAIL
       * --------------------------------------------- */

      const hasValidEmail =
        Boolean(
          mgr.email &&
          mgr.email !== "N/A" &&
          !mgr.email.includes(
            "example.com"
          )
        );

      const email =
        hasValidEmail
          ? `\`${mgr.email}\``
          : "—";

      /* ---------------------------------------------
       * LOCATION
       * --------------------------------------------- */

      const cleanLocation =
        (
          mgr.location ||
          "General Branch"
        )
          .replace(
            /\n/g,
            ", "
          );

      const locationParts: string[] =
        [cleanLocation];

      if (mgr.city) {
        locationParts.push(
          mgr.city
        );
      }

      if (mgr.district) {
        locationParts.push(
          mgr.district
        );
      }

      if (mgr.state) {
        locationParts.push(
          mgr.state
        );
      }

      if (mgr.branch) {
        locationParts.push(
          `Branch: ${mgr.branch}`
        );
      }

      if (mgr.branch_code) {
        locationParts.push(
          `Branch Code: ${mgr.branch_code}`
        );
      }

      /* ---------------------------------------------
       * EXTRA INFO / CPC
       * --------------------------------------------- */

      let extraLocation =
        "";

      if (
        mgr.extra_info &&
        typeof mgr.extra_info ===
          "object"
      ) {
        const cpc =
          mgr.extra_info[
            "Sourcing & Processing CPC"
          ] ??
          mgr.extra_info["CPC"];

        if (
          cpc !== undefined &&
          cpc !== null &&
          String(cpc).trim()
        ) {
          extraLocation =
            `<br/>*CPC: ${String(cpc)}*`;
        }
      }

      const locationCol =
        `${locationParts.join(", ")}${extraLocation}`;

      /* ---------------------------------------------
       * EMPLOYEE CODE
       * --------------------------------------------- */

      const empCode =
        mgr.employee_code &&
        mgr.employee_code !== "N/A"
          ? `\`${mgr.employee_code}\``
          : "—";

      table +=
        `| **${bankName}** | ` +
        `${nameRole} | ` +
        `${phone} | ` +
        `${email} | ` +
        `${locationCol} | ` +
        `${empCode} |\n`;
    }
  );

  return table.trim();
}

/**
 * Display bank managers in a clean tabular format:
 * | Manager Name | Bank | Branch | City | Phone | Email | Employee ID |
 * Only displays fields that actually exist in the DB without inventing missing values.
 */
export function formatBankManagersTable(managers: BankManagerRecord[]): string {
  if (!managers || managers.length === 0) {
    return "";
  }

  let table = `| Manager Name | Bank | Branch | City | Phone | Email | Employee ID |\n`;
  table += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const mgr of managers) {
    const managerName = mgr.name
      ? (mgr.role ? `**${mgr.name}** *(${mgr.role})*` : `**${mgr.name}**`)
      : "—";
    const bank = mgr.bank_name || "—";
    const branch = mgr.branch || mgr.location || "—";
    const city = mgr.city || (mgr.location && mgr.location !== mgr.branch ? mgr.location : "—");
    const phone =
      mgr.phone && mgr.phone !== "N/A" && mgr.phone !== "#ERROR!"
        ? `\`${mgr.phone}\``
        : "—";
    const email =
      mgr.email && mgr.email !== "N/A" && !mgr.email.includes("example.com")
        ? `\`${mgr.email}\``
        : "—";
    const empId =
      mgr.employee_code && mgr.employee_code !== "N/A"
        ? `\`${mgr.employee_code}\``
        : "—";

    table += `| ${managerName} | ${bank} | ${branch} | ${city} | ${phone} | ${email} | ${empId} |\n`;
  }

  return table.trim();
}