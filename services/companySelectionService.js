/**
 * Company Selection Service
 * 
 * Handles company name fuzzy search, exact company selection, and auto-discovery
 * of all banks tied to that company with their specific categories.
 * 
 * Flow:
 * 1. searchCompanyNames() - Fuzzy search for similar company names (discovery)
 * 2. selectAndResolveCompany() - After user selects exact company, resolve all banks + categories
 * 3. getCompanyCategoryForBank() - Get specific category for a company-bank pair
 */

function normalizeCompanyName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Search for DISTINCT company names similar to user input (fuzzy/partial match)
 * Returns unique company names only, not individual records
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @param {string} companyInput - User input (partial company name)
 * @param {number} limit - Max results to return (default: 10)
 * @returns {Promise<Array>} Array of distinct company names: ["TCS", "Tata Capital", ...]
 */
async function searchCompanyNames(pool, companyInput, limit = 10) {
  if (!companyInput || !pool) {
    return [];
  }

  const normalized = normalizeCompanyName(companyInput);
  if (!normalized) {
    return [];
  }

  try {
    const searchTerm = `%${normalized}%`;
    
    const result = await pool.query(
      `SELECT DISTINCT company_name
       FROM company_records
       WHERE company_name ILIKE $1
       ORDER BY company_name ASC
       LIMIT $2`,
      [searchTerm, limit]
    );

    return result.rows.map(row => normalizeText(row.company_name)).filter(Boolean);
  } catch (err) {
    console.error("[Company Search] Database query error:", err.message);
    return [];
  }
}

/**
 * After user selects exact company, resolve all banks + categories for that company
 * Returns unique bank entries with their company categories
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @param {string} selectedCompanyName - Exact company name selected by user
 * @returns {Promise<Object>} {selectedCompanyName, supportedBanks: [{bank_id, bank_name, company_category, other_info}, ...]}
 */
async function selectAndResolveCompany(pool, selectedCompanyName) {
  if (!selectedCompanyName || !pool) {
    return { selectedCompanyName: null, supportedBanks: [] };
  }

  const normalized = normalizeCompanyName(selectedCompanyName);
  if (!normalized) {
    return { selectedCompanyName: null, supportedBanks: [] };
  }

  try {
    // Query company_records with exact normalized match to get all banks for this company
    const result = await pool.query(
      `SELECT DISTINCT
        bank_name,
        company_category,
        other_info
       FROM company_records
       WHERE LOWER(TRIM(company_name)) = $1
       ORDER BY bank_name ASC`,
      [normalized]
    );

    if (result.rowCount === 0) {
      return { selectedCompanyName: normalizeText(selectedCompanyName), supportedBanks: [] };
    }

    // Resolve bank IDs from banks table for each unique bank_name
    const supportedBanks = [];
    const seenBankNames = new Set();

    for (const row of result.rows) {
      const bankName = normalizeText(row.bank_name);
      if (seenBankNames.has(bankName)) {
        continue;
      }
      seenBankNames.add(bankName);

      try {
        const bankResult = await pool.query(
          `SELECT id, name FROM banks
           WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
           LIMIT 1`,
          [bankName]
        );

        if (bankResult.rowCount > 0) {
          const bankId = bankResult.rows[0].id;
          const category = normalizeText(row.company_category);

          supportedBanks.push({
            bank_id: bankId,
            bank_name: bankName,
            company_category: category || null,
            other_info: row.other_info || null
          });
        }
      } catch (err) {
        console.warn(`[Company Selection] Failed to resolve bank_id for "${bankName}":`, err.message);
      }
    }

    return {
      selectedCompanyName: normalizeText(selectedCompanyName),
      supportedBanks: supportedBanks
    };
  } catch (err) {
    console.error("[Company Selection] selectAndResolveCompany error:", err.message);
    return { selectedCompanyName: normalizeText(selectedCompanyName), supportedBanks: [] };
  }
}

/**
 * Get company category for a specific company + bank pair
 * Returns the exact category from company_records, or null if no match
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @param {string} selectedCompanyName - Exact company name
 * @param {string} bankName - Bank name
 * @returns {Promise<string|null>} Company category or null
 */
async function getCompanyCategoryForBank(pool, selectedCompanyName, bankName) {
  if (!selectedCompanyName || !bankName || !pool) {
    return null;
  }

  const normCompany = normalizeCompanyName(selectedCompanyName);
  const normBank = normalizeText(bankName);

  if (!normCompany || !normBank) {
    return null;
  }

  try {
    const result = await pool.query(
      `SELECT company_category
       FROM company_records
       WHERE LOWER(TRIM(company_name)) = $1
         AND LOWER(TRIM(bank_name)) = LOWER(TRIM($2))
       LIMIT 1`,
      [normCompany, normBank]
    );

    if (result.rowCount > 0) {
      const category = normalizeText(result.rows[0].company_category);
      return category || null;
    }

    return null;
  } catch (err) {
    console.error("[Company Selection] getCompanyCategoryForBank error:", err.message);
    return null;
  }
}

/**
 * Validate if supportedBanks array has complete and consistent data
 * 
 * @param {Array} supportedBanks - Array of {bank_id, bank_name, company_category}
 * @returns {Object} {isValid: boolean, errors: [...]}
 */
function validateSupportedBanks(supportedBanks) {
  const errors = [];

  if (!Array.isArray(supportedBanks)) {
    return { isValid: false, errors: ["supportedBanks is not an array"] };
  }

  if (supportedBanks.length === 0) {
    return { isValid: true, errors: [] };
  }

  for (let i = 0; i < supportedBanks.length; i++) {
    const bank = supportedBanks[i];
    
    if (!bank.bank_id || !Number.isInteger(bank.bank_id)) {
      errors.push(`Row ${i}: Missing or invalid bank_id`);
    }
    if (!bank.bank_name || typeof bank.bank_name !== "string") {
      errors.push(`Row ${i}: Missing or invalid bank_name`);
    }
    if (bank.company_category === undefined) {
      errors.push(`Row ${i}: company_category is undefined (should be string or null)`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

module.exports = {
  searchCompanyNames,
  selectAndResolveCompany,
  getCompanyCategoryForBank,
  validateSupportedBanks,
  normalizeCompanyName,
  normalizeText
};
