// lib/ai/tools.ts

/**
 * Central AI tools for CreditWise / InCraax AI.
 *
 * IMPORTANT:
 * - The LLM decides WHICH tool to use.
 * - Tools retrieve or calculate verified information.
 * - The LLM must NOT independently invent financial facts.
 * - Loan eligibility is calculated by the deterministic policy engine.
 *
 * SAFETY PRINCIPLES:
 * - Do not hardcode company names or spelling corrections.
 * - Do not treat arbitrary partial database matches as verified identity.
 * - Live company information should come from Incraax when required.
 * - Bank/company-master records come from the verified PostgreSQL database.
 * - Missing information must remain unavailable instead of being invented.
 */

import pool from "../db";
import { searchBankManager } from "../bankSearch";
import { searchCompany } from "../companySearch";
import { incraaxSearch } from "../incraaxSearch";
import { calculateDeterministicEligibility } from "../eligibilityWizard";

/* -------------------------------------------------------------------------- */
/*                              TOOL DEFINITIONS                              */
/* -------------------------------------------------------------------------- */

export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_company",

      description:
        "Search for a company using the application's verified company-search system. " +
        "Use this when the user asks about a company, company category, CIN, company information, " +
        "company records, financial information, basic company information, or whether a company " +
        "exists in a bank's company master. The company-search system may combine live Incraax web " +
        "information with verified PostgreSQL bank/company records. Do not assume that an arbitrary " +
        "partial database match is the requested company. If multiple genuine companies match, " +
        "return the candidates and ask the user to select one. Do not invent company information.",

      parameters: {
        type: "object",

        properties: {
          company_name: {
            type: "string",
            description:
              "The company name or company reference understood from the user's request. " +
              "Pass the normalized company name when it can be understood confidently. " +
              "Do not invent a company name or create a hardcoded spelling correction.",
          },
        },

        required: ["company_name"],
        additionalProperties: false,
      },
    },
  },

  {
    type: "function",
    function: {
      name: "search_bank_manager",

      description:
        "Search the internal bank manager and location database. Use this when the user asks for a bank manager, ASM, RSM, SM, ZSM, branch manager, sales manager, manager contact, phone number, email, branch contact, or bank contact in a particular location.",

      parameters: {
        type: "object",

        properties: {
          bank_name: {
            type: "string",
            description:
              "Bank or financial institution name.",
          },

          city: {
            type: "string",
            description:
              "City or location.",
          },

          branch_name: {
            type: "string",
            description:
              "Branch name if provided.",
          },

          manager_name: {
            type: "string",
            description:
              "Manager name if provided.",
          },

          query: {
            type: "string",
            description:
              "Original or additional search text when the request contains multiple details.",
          },
        },

        additionalProperties: false,
      },
    },
  },

  {
    type: "function",
    function: {
      name: "search_bank_policy",

      description:
        "Search verified bank loan policy information. Use this for questions about salary, minimum salary, CIBIL, FOIR, age, loan amount, tenure, company category, BT rules, KYC, documents, pricing, interest rate, surrogate programs, or other lending policy conditions.",

      parameters: {
        type: "object",

        properties: {
          bank_name: {
            type: "string",
            description:
              "Bank or financial institution name if known.",
          },

          query: {
            type: "string",
            description:
              "The exact policy question or policy information being requested.",
          },
        },

        required: ["query"],
        additionalProperties: false,
      },
    },
  },

  {
    type: "function",
    function: {
      name: "calculate_loan_eligibility",

      description:
        "Calculate loan eligibility using the application's deterministic policy engine and verified policy records. NEVER calculate eligibility yourself. Use this tool whenever the user asks whether they qualify for a loan or asks for an eligibility assessment.",

      parameters: {
        type: "object",

        properties: {
          bank_name: {
            type: "string",
            description:
              "Bank or lender to evaluate against, if specified.",
          },

          loan_type: {
            type: "string",
            description:
              "Loan type, for example personal loan.",
          },

          salary: {
            type: "number",
            description:
              "Applicant monthly salary or net monthly income.",
          },

          cibil: {
            type: "number",
            description:
              "Applicant CIBIL score.",
          },

          existing_emi: {
            type: "number",
            description:
              "Current monthly EMI obligations.",
          },

          age: {
            type: "number",
            description:
              "Applicant age.",
          },

          employment_type: {
            type: "string",
            description:
              "Employment type such as Salaried, Self Employed, Proprietorship, Partnership, or LLP.",
          },

          company_name: {
            type: "string",
            description:
              "Applicant employer/company name if relevant.",
          },
        },

        required: [
          "loan_type",
          "salary",
          "cibil",
          "existing_emi",
        ],

        additionalProperties: false,
      },
    },
  },

  {
    type: "function",
    function: {
      name: "web_search",

      description:
        "Search the external web using the configured Incraax search service when the required information is not available in the internal verified data. Use this for live or current company information when appropriate. Do not invent information if the search does not provide reliable evidence.",

      parameters: {
        type: "object",

        properties: {
          query: {
            type: "string",
            description:
              "Search query to send to the Incraax search service.",
          },
        },

        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

/* -------------------------------------------------------------------------- */
/*                              POLICY SEARCH                                 */
/* -------------------------------------------------------------------------- */

/**
 * Searches policy records in PostgreSQL.
 *
 * IMPORTANT:
 * This function intentionally does not invent policy values.
 *
 * Your database schema may contain different policy tables/columns.
 * This implementation first tries the policy structure used by the
 * deterministic eligibility engine.
 */
async function searchBankPolicy(
  bankName: string | undefined,
  query: string
): Promise<any> {
  if (!query?.trim()) {
    return {
      type: "policy",
      verified: false,
      found: false,
      message: "No policy question was provided.",
    };
  }

  const client = await pool.connect();

  try {
    /*
     * Search active policy rules.
     *
     * We do not fabricate missing rules.
     */

    const params: any[] = [];

    let sql = `
      SELECT
        b.id AS bank_id,
        b.name AS bank_name,
        b.code AS bank_code,
        pv.id AS policy_version_id,
        pv.version AS policy_version,
        pv.status AS policy_status,
        pr.*
      FROM banks b
      JOIN policy_versions pv
        ON pv.bank_id = b.id
      JOIN policy_rules pr
        ON pr.policy_version_id = pv.id
      WHERE b.is_active = true
        AND pv.status = 'active'
        AND pr.status IN ('active', 'review')
    `;

    if (bankName?.trim()) {
      params.push(`%${bankName.trim()}%`);

      sql += `
        AND LOWER(b.name) LIKE LOWER($${params.length})
      `;
    }

    /*
     * Search textual policy fields.
     *
     * We keep this conservative because policy schemas can vary.
     */

    params.push(`%${query.trim()}%`);

    const queryParam = `$${params.length}`;

    sql += `
      AND (
        LOWER(COALESCE(pr.loan_type, '')) LIKE LOWER(${queryParam})
        OR LOWER(COALESCE(pr.rule_type, '')) LIKE LOWER(${queryParam})
        OR LOWER(COALESCE(pr.rule_value::text, '')) LIKE LOWER(${queryParam})
      )
    `;

    sql += `
      ORDER BY
        b.name ASC,
        pv.version DESC
      LIMIT 50
    `;

    const result = await client.query(
      sql,
      params
    );

    return {
      type: "policy",
      verified: true,
      found: result.rows.length > 0,
      count: result.rows.length,
      data: result.rows,
    };
  } catch (error) {
    /*
     * Do NOT turn a database failure into a fake policy answer.
     */

    console.error(
      "[AI TOOLS] Policy search error:",
      error
    );

    return {
      type: "policy",
      verified: false,
      found: false,
      error:
        "Policy information could not be retrieved.",
    };
  } finally {
    client.release();
  }
}

/* -------------------------------------------------------------------------- */
/*                              TOOL EXECUTION                                */
/* -------------------------------------------------------------------------- */

export async function executeAITool(
  toolName: string,
  args: Record<string, any> = {},
  conversationId?: string
): Promise<any> {
  console.log(
    `[AI TOOLS] Executing: ${toolName}`,
    args
  );

  switch (toolName) {
    /* ---------------------------------------------------------------------- */
    /* COMPANY                                                                 */
    /* ---------------------------------------------------------------------- */

    case "search_company": {
      const companyName = String(
        args.company_name || ""
      ).trim();

      if (!companyName) {
        return {
          type: "company",
          verified: false,
          found: false,
          message:
            "Company name is required.",
        };
      }

      try {
        /*
         * searchCompany() is responsible for:
         *
         * 1. Identifying the requested company.
         * 2. Avoiding arbitrary partial database matches.
         * 3. Returning candidates when the request is ambiguous.
         * 4. Retrieving live company information when available.
         * 5. Returning verified bank/company-master records.
         *
         * No company-specific spelling mappings are added here.
         */

        const result =
          await searchCompany(companyName);

        return {
          type: "company",
          verified: true,
          found: Boolean(result?.found),

          /*
           * Preserve the complete structured company result.
           *
           * This can contain:
           * - selected company
           * - candidates
           * - overview
           * - basic information
           * - financial information
           * - bank records
           *
           * The agent uses this information to produce the final response.
           */
          data: result,
        };
      } catch (error) {
        console.error(
          "[AI TOOLS] Company search error:",
          error
        );

        return {
          type: "company",
          verified: false,
          found: false,
          error:
            "Company information could not be retrieved.",
        };
      }
    }

    /* ---------------------------------------------------------------------- */
    /* BANK MANAGER                                                            */
    /* ---------------------------------------------------------------------- */

    case "search_bank_manager": {
      try {
        const managers =
          await searchBankManager({
            bank_name: args.bank_name,
            city: args.city,
            branch_name:
              args.branch_name,
            manager_name:
              args.manager_name,
            query: args.query,
          });

        return {
          type: "bank_manager",
          verified: true,
          found:
            managers.length > 0,
          count: managers.length,
          data: managers,
        };
      } catch (error) {
        console.error(
          "[AI TOOLS] Bank manager search error:",
          error
        );

        return {
          type: "bank_manager",
          verified: false,
          found: false,
          error:
            "Bank manager information could not be retrieved.",
        };
      }
    }

    /* ---------------------------------------------------------------------- */
    /* BANK POLICY                                                             */
    /* ---------------------------------------------------------------------- */

    case "search_bank_policy": {
      return await searchBankPolicy(
        args.bank_name,
        String(args.query || "")
      );
    }

    /* ---------------------------------------------------------------------- */
    /* LOAN ELIGIBILITY                                                       */
    /* ---------------------------------------------------------------------- */

    case "calculate_loan_eligibility": {
      /*
       * THIS IS THE MOST IMPORTANT SAFETY BOUNDARY.
       *
       * The LLM supplies applicant facts.
       * The deterministic policy engine decides the result.
       *
       * The LLM must never replace this calculation.
       */

      try {
        const input = {
          bankName:
            args.bank_name || undefined,

          loanType:
            args.loan_type ||
            "Personal",

          salary:
            args.salary !== undefined
              ? Number(args.salary)
              : undefined,

          cibil:
            args.cibil !== undefined
              ? Number(args.cibil)
              : undefined,

          existingEmi:
            args.existing_emi !== undefined
              ? Number(args.existing_emi)
              : undefined,

          age:
            args.age !== undefined
              ? Number(args.age)
              : undefined,

          employmentType:
            args.employment_type ||
            undefined,

          companyName:
            args.company_name ||
            undefined,
        };

        const result =
          await calculateDeterministicEligibility(
            input,
            pool
          );

        return {
          type: "eligibility",

          /*
           * Verified means the result came from the
           * deterministic application logic.
           */
          verified: true,

          /*
           * Authoritative tells the final LLM that it
           * MUST NOT alter the eligibility result.
           */
          authoritative: true,

          data: result,
        };
      } catch (error) {
        console.error(
          "[AI TOOLS] Eligibility calculation error:",
          error
        );

        return {
          type: "eligibility",
          verified: false,
          authoritative: false,
          status:
            "Unable to Determine",
          error:
            "Eligibility could not be calculated because the policy engine failed.",
        };
      }
    }

    /* ---------------------------------------------------------------------- */
    /* WEB SEARCH                                                              */
    /* ---------------------------------------------------------------------- */

    case "web_search": {
      const query = String(
        args.query || ""
      ).trim();

      if (!query) {
        return {
          type: "web_search",
          verified: false,
          found: false,
          message:
            "Search query is required.",
        };
      }

      try {
        /*
         * Incraax is the configured live web-search provider.
         *
         * Keep the provider call centralized here.
         * Do not add company-specific hardcoded searches.
         */

        const results =
          await incraaxSearch(
            query,
            5
          );

        return {
          type: "web_search",
          verified: true,
          found:
            results.length > 0,
          count: results.length,
          data: results,
        };
      } catch (error) {
        console.error(
          "[AI TOOLS] Web search error:",
          error
        );

        return {
          type: "web_search",
          verified: false,
          found: false,
          error:
            "External web search is currently unavailable.",
        };
      }
    }

    /* ---------------------------------------------------------------------- */
    /* UNKNOWN TOOL                                                            */
    /* ---------------------------------------------------------------------- */

    default: {
      console.error(
        `[AI TOOLS] Unknown tool: ${toolName}`
      );

      throw new Error(
        `Unknown AI tool: ${toolName}`
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                         TOOL RESULT SANITIZATION                           */
/* -------------------------------------------------------------------------- */

/**
 * Prevent excessively large database results from being sent back to
 * the LLM.
 */
export function sanitizeToolResult(
  toolName: string,
  result: any
): any {
  if (!result) {
    return null;
  }

  /* ------------------------------------------------------------------------ */
  /* BANK MANAGER                                                             */
  /* ------------------------------------------------------------------------ */

  if (
    toolName ===
      "search_bank_manager" &&
    Array.isArray(result.data)
  ) {
    return {
      ...result,
      data:
        result.data.slice(0, 20),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* COMPANY                                                                  */
  /* ------------------------------------------------------------------------ */

  if (
    toolName === "search_company" &&
    result.data
  ) {
    return {
      ...result,

      /*
       * CompanySearchResult is already structured.
       *
       * Keep the complete result because the final answer may need:
       * - candidates
       * - selected company
       * - overview
       * - basicInfo
       * - financialInfo
       * - bankRecords
       */
      data: result.data,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* BANK POLICY                                                              */
  /* ------------------------------------------------------------------------ */

  if (
    toolName ===
      "search_bank_policy" &&
    Array.isArray(result.data)
  ) {
    return {
      ...result,
      data:
        result.data.slice(0, 50),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* WEB SEARCH                                                               */
  /* ------------------------------------------------------------------------ */

  if (
    toolName === "web_search" &&
    Array.isArray(result.data)
  ) {
    return {
      ...result,
      data:
        result.data.slice(0, 5),
    };
  }

  return result;
}