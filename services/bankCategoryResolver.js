/**
 * Bank-Specific Category Resolver
 *
 * Resolves the applicant's employer/category for each bank using:
 * 1. company_records lookup (company_name + bank match)
 * 2. Master policy text extraction (keyword matching near company mentions)
 *
 * Never uses CIBIL/salary to guess the category.
 * If category cannot be resolved, returns null (caller should mark NEEDS_REVIEW).
 */

const {
  getMasterPolicyForBank
} = require("./policyAssistantService");

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const CATEGORY_KEYWORDS = [
  "normal",
  "bt surrogate",
  "home loan surrogate",
  "auto loan surrogate",
  "banking surrogate",
  "-1 cibil",
  "cat a",
  "cat b",
  "cat c",
  "cat d",
  "category a",
  "category b",
  "category c",
  "category d",
  "psu",
  "govt",
  "government",
  "self-employed",
  "salaried elite",
  "mnc",
  "private limited",
  "startup"
];

async function resolveBankCategory(pool, bankId, bankName, companyName, employmentType) {
  if (!companyName) return null;

  const normCompany = normalizeText(companyName).toLowerCase();
  const normBank = normalizeText(bankName).toLowerCase();

  // 1. Try company_records lookup
  try {
    const compRes = await pool.query(
      `SELECT company_category, other_info
       FROM company_records
       WHERE (bank_name ILIKE $1 OR bank_name ILIKE $2)
         AND company_name ILIKE $3
       LIMIT 1`,
      [bankName, `%${bankName}%`, `%${companyName}%`]
    );

    if (compRes.rowCount > 0) {
      const category = compRes.rows[0].company_category;
      if (category && normalizeText(category)) {
        return normalizeText(category);
      }
    }
  } catch (err) {
    console.warn(`[RESOLVER] company_records lookup warning for ${bankName}:`, err.message);
  }

  // 2. Try master policy text extraction
  try {
    const masterPolicy = await getMasterPolicyForBank(pool, bankId);
    if (!masterPolicy || !masterPolicy.extracted_text) {
      return null;
    }

    const text = String(masterPolicy.extracted_text);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Find lines mentioning the company name
    const companyLines = lines.filter(line => {
      const lower = line.toLowerCase();
      return lower.includes(normCompany) || normCompany.split(/\s+/).some(word => word.length > 3 && lower.includes(word));
    });

    // Search for category keywords in nearby lines
    const searchWindow = companyLines.length > 0 ? companyLines : lines.slice(0, 100);

    for (const line of searchWindow) {
      const lower = line.toLowerCase();
      for (const keyword of CATEGORY_KEYWORDS) {
        if (lower.includes(keyword)) {
          // Found a category mention near company context
          const matchedCategory = keyword
            .replace(/cat\s*([a-d])/i, (_, letter) => `CAT ${letter.toUpperCase()}`)
            .replace(/category\s*([a-d])/i, (_, letter) => `CAT ${letter.toUpperCase()}`)
            .replace(/^-1\s*cibil$/, "-1 CIBIL/Owned House")
            .replace(/^psu$/, "PSU")
            .replace(/^govt$/, "PSU/Govt")
            .replace(/^government$/, "PSU/Govt")
            .replace(/^self-employed$/, "Self-Employed")
            .replace(/^normal$/, "Normal")
            .replace(/^mnc$/, "MNC")
            .replace(/^private\s+limited$/, "Private Limited")
            .replace(/^startup$/, "Startup")
            .replace(/^salaried\s+elite$/, "Normal");

          if (matchedCategory !== keyword) {
            return matchedCategory;
          }
        }
      }
    }

    // If company name appears in text but no category found, check if employmentType gives us a clue
    if (employmentType) {
      const employmentLower = employmentType.toLowerCase();
      if (/self|business|proprietor|freelance/i.test(employmentLower)) {
        return "Self-Employed";
      }
      if (/salaried/i.test(employmentLower)) {
        // For salaried, we need more info from company records or master policy
        // Don't guess - return null to trigger NEEDS_REVIEW
        return null;
      }
    }
  } catch (err) {
    console.warn(`[RESOLVER] master policy lookup warning for ${bankName}:`, err.message);
  }

  return null;
}

async function resolveAllBankCategories(pool, banks, applicant) {
  const resolutions = new Map();

  for (const bank of banks) {
    const category = await resolveBankCategory(
      pool,
      bank.bank_id,
      bank.bank_name,
      applicant.companyName,
      applicant.employmentType
    );
    resolutions.set(bank.bank_id, category);
  }

  return resolutions;
}

module.exports = {
  resolveBankCategory,
  resolveAllBankCategories,
  CATEGORY_KEYWORDS
};
