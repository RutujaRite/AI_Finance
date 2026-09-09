/**
 * Bank-Specific Category Resolver
 *
 * Resolves the correct bank-specific Program and Category using:
 * - company_records lookup (company_name + bank match)
 * - Bank master policy text extraction (keyword matching near company mentions)
 *
 * Uses only Company Name + Employment Type for resolution.
 * Never uses CIBIL/salary/age to guess the category.
 * If category cannot be resolved for a bank, returns null (caller should mark NEEDS_REVIEW).
 */

const { getMasterPolicyForBank } = require("./policyAssistantService");

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

function normalizeCategory(raw) {
  const lower = String(raw || "").toLowerCase().trim();
  if (!lower) return null;

  if (/\bcat\s*a\b/.test(lower) || /\bcategory\s*a\b/.test(lower)) return "CAT A";
  if (/\bcat\s*b\b/.test(lower) || /\bcategory\s*b\b/.test(lower)) return "CAT B";
  if (/\bcat\s*c\b/.test(lower) || /\bcategory\s*c\b/.test(lower)) return "CAT C";
  if (/\bcat\s*d\b/.test(lower) || /\bcategory\s*d\b/.test(lower)) return "CAT D";
  if (/self-employed/.test(lower)) return "Self-Employed";
  if (/psu|govt|government/.test(lower)) return "PSU/Govt";
  if (/mnc/.test(lower)) return "MNC";
  if (/private\s+limited/.test(lower)) return "Private Limited";
  if (/startup/.test(lower)) return "Startup";
  if (/normal/.test(lower)) return "Normal";
  if (/-1\s*cibil|bt surrogate|home loan surrogate|auto loan surrogate|banking surrogate/.test(lower)) return "Special";
  if (lower.length >= 1 && lower.length <= 40) return lower.replace(/\b\w/g, c => c.toUpperCase());

  return null;
}

async function resolveBankCategory(pool, bankId, bankName, companyName, employmentType, companyRecordBankName) {
  if (!companyName) return null;

  const normCompany = normalizeText(companyName).toLowerCase();
  const normBank = normalizeText(bankName).toLowerCase();
  const firstWord = normBank.split(/\s+/)[0];
  const recordBankName = companyRecordBankName || bankName;

  // 1. Try company_records lookup
  try {
    const compRes = await pool.query(
      `SELECT company_category, other_info
       FROM company_records
       WHERE (bank_name ILIKE $1 OR bank_name ILIKE $2 OR bank_name ILIKE $3 OR bank_name ILIKE $4)
         AND company_name ILIKE $5
       LIMIT 1`,
       [recordBankName, `%${recordBankName}%`, bankName, `%${firstWord}%`, `%${companyName}%`]
    );

    if (compRes.rowCount > 0) {
      const category = compRes.rows[0].company_category;
      if (category && normalizeText(category)) {
        return normalizeCategory(category);
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

    const companyWords = normCompany.split(/\s+/).filter(w => w.length > 3);
    const uniqueWords = companyWords.filter(w => !["limited", "private", "services", "consultancy", "international", "foundation", "builders", "solutions", "hospitality", "systems"].includes(w));

    const companyLines = lines.filter(line => {
      const lower = line.toLowerCase();
      if (lower.includes(normCompany)) return true;
      const matchCount = uniqueWords.filter(w => lower.includes(w)).length;
      return matchCount >= Math.min(2, uniqueWords.length);
    });

    if (companyLines.length === 0) {
      return null;
    }

    for (const line of companyLines) {
      const lower = line.toLowerCase();
      for (const keyword of CATEGORY_KEYWORDS) {
        if (lower.includes(keyword)) {
          return normalizeCategory(keyword);
        }
      }
    }
  } catch (err) {
    console.warn(`[RESOLVER] master policy lookup warning for ${bankName}:`, err.message);
  }

  return null;
}

async function resolveAllBankCategories(pool, banks, applicant) {
  const resolutions = new Map();
  const needsReviewBanks = [];

  if (!applicant?.companyName) {
    for (const bank of banks) {
      resolutions.set(bank.bank_id, { category: null, status: "needs_review", reason: "Company name not provided" });
      needsReviewBanks.push(bank);
    }
    return { resolutions, needsReviewBanks };
  }

   let companyRecords = [];
  try {
    const companyRes = await pool.query(
      `SELECT DISTINCT cr.bank_name, cr.company_category
       FROM company_records cr
       WHERE cr.company_name ILIKE $1
       ORDER BY cr.bank_name`,
       [`%${applicant.companyName}%`]
    );

    companyRecords = companyRes.rows;
  } catch (err) {
    console.warn("[RESOLVER] company_records lookup failed:", err.message);
  }

  const supportedBanks = [];
  for (const bank of banks) {
    const normBankName = bank.bank_name.toLowerCase().trim();
    const bankWords = normBankName.split(/[^a-z0-9]+/).filter(w => w.length > 0);
    
    const match = companyRecords.find(record => {
      const normSupported = record.bank_name.toLowerCase().trim();
      return normBankName === normSupported ||
        normBankName.includes(normSupported) ||
        normSupported.includes(normBankName) ||
        (bankWords[0] && normSupported.includes(bankWords[0])) ||
        (bankWords[0] && normBankName.includes(normSupported));
    });

    if (match) {
      console.log(`[RESOLVER] Supported bank: ${bank.bank_name} (matched via company_records: ${match.bank_name})`);
      supportedBanks.push({ ...bank, companyRecordBankName: match.bank_name, companyCategory: match.company_category });
    } else {
      console.log(`[RESOLVER] Unsupported bank: ${bank.bank_name}`);
    }
  }

  for (const bank of supportedBanks) {
    let category = null;
    try {
      category = await resolveBankCategory(
        pool,
        bank.bank_id,
        bank.bank_name,
        applicant.companyName,
        applicant.employmentType,
        bank.companyRecordBankName
      );
    } catch (err) {
      console.error(`[RESOLVER] Error resolving ${bank.bank_name}:`, err.message);
    }
    console.log(`[RESOLVER] Bank ${bank.bank_name} resolved category: ${category}`);

    if (category) {
      resolutions.set(bank.bank_id, { category, status: "resolved" });
    } else {
      resolutions.set(bank.bank_id, { category: null, status: "needs_review", reason: "Unable to resolve employer category from bank records or master policy" });
      needsReviewBanks.push(bank);
    }
  }

  for (const bank of banks) {
    if (!supportedBanks.find(b => b.bank_id === bank.bank_id)) {
      resolutions.set(bank.bank_id, { category: null, status: "unsupported", reason: `Company "${applicant.companyName}" not found in ${bank.bank_name} company_records` });
    }
  }

  return { resolutions, needsReviewBanks };
}


function parseIndianNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}


function extractValueFromLines(lines, category, patterns) {
  const catLower = String(category).toLowerCase();
  const catWords = catLower.split(/\s+/).filter(w => w.length > 2);

  let categoryIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (catWords.length > 0 && catWords.every(w => lower.includes(w))) {
      categoryIdx = i;
      break;
    }
  }

  const windowStart = Math.max(0, categoryIdx - 3);
  const windowEnd = Math.min(lines.length - 1, categoryIdx + 15);
  const window = categoryIdx >= 0 ? lines.slice(windowStart, windowEnd + 1) : lines;

  for (const line of window) {
    const lower = line.toLowerCase();
    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        const raw = match[1] || match[2] || match[3] || match[4] || match[5];
        const parsed = parseIndianNumber(raw);
        if (parsed != null) {
          return parsed;
        }
      }
    }
  }

  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        const raw = match[1] || match[2] || match[3] || match[4] || match[5];
        const parsed = parseIndianNumber(raw);
        if (parsed != null) {
          return parsed;
        }
      }
    }
  }

  return null;
}


async function extractRuleFromMasterPolicy(pool, bankId, category) {
const { getMasterPolicyForBank } = require("./policyAssistantService");
  const masterPolicy = await getMasterPolicyForBank(pool, bankId);
  if (!masterPolicy || !masterPolicy.extracted_text) {
    return null;
  }

  const text = String(masterPolicy.extracted_text);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const rule = {
    category: category,
    employment_type: "Salaried",
    source: "master_policy"
  };

  rule.min_cibil = extractValueFromLines(lines, category, [
    /minimum\s+cibil[^\d]*(\d+)/i,
    /min\s+cibil[^\d]*(\d+)/i,
    /cibil[^\d]{0,10}(\d{3})/i
  ]);

  rule.min_age = extractValueFromLines(lines, category, [
    /minimum\s+age[^\d]*(\d+)/i,
    /min\s+age[^\d]*(\d+)/i,
    /age[^\d]{0,10}min[^\d]*(\d+)/i
  ]);

  rule.max_age = extractValueFromLines(lines, category, [
    /maximum\s+age[^\d]*(\d+)/i,
    /max\s+age[^\d]*(\d+)/i,
    /age[^\d]{0,10}max[^\d]*(\d+)/i,
    /retirement[^\d]{0,10}(\d+)/i
  ]);

  rule.max_loan_amount = (() => {
    const val = extractValueFromLines(lines, category, [
      /maximum[^\d]{0,30}[₹\s]*([\d,]+)\s*(?:lakh|lac|l|cr|crore)/i,
      /max[^\d]{0,30}[₹\s]*([\d,]+)\s*(?:lakh|lac|l|cr|crore)/i,
      /capping[^\d]{0,30}([\d,]+)\s*(?:lakh|lac|l|cr|crore)/i,
      /funding[^\d]{0,30}([\d,]+)\s*(?:lakh|lac|l|cr|crore)/i,
      /upto[^\d]{0,30}[₹\s]*([\d,]+)\s*(?:lakh|lac|l|cr|crore)/i,
      /loan\s+amount[^\d]{0,30}[₹\s]*([\d,]+)\s*(?:lakh|lac|l|cr|crore)/i,
      /(?:upto|up\s+to|max|maximum)[^\d]{0,30}[₹\s]*([\d,]+)/i
    ]);
    if (val != null && val < 100000) {
      const multipliers = { 'lac': 100000, 'l': 100000, 'lakh': 100000, 'cr': 10000000, 'crore': 10000000 };
      const textLower = lines.join(' ').toLowerCase();
      for (const [unit, mult] of Object.entries(multipliers)) {
        if (textLower.includes(unit)) return val * mult;
      }
    }
    return val;
  })();

  rule.min_loan_amount = extractValueFromLines(lines, category, [
    /minimum[^\d]{0,20}[₹\s]*([\d,]+)\s*lakh/i,
    /min[^\d]{0,20}[₹\s]*([\d,]+)\s*lakh/i
  ]);

  const tenureValue = extractValueFromLines(lines, category, [
    /tenure[^\d]{0,30}upto[^\d]{0,20}(\d+)\s*years/i,
    /tenure[^\d]{0,30}upto[^\d]{0,20}(\d+)\s*months/i,
    /tenure[^\d]{0,30}max[^\d]{0,20}(\d+)\s*years/i,
    /tenure[^\d]{0,30}max[^\d]{0,20}(\d+)\s*months/i,
    /tenure[^\d]{0,30}(\d+)\s*years/i,
    /tenure[^\d]{0,30}(\d+)\s*months/i
  ]);

  if (tenureValue != null) {
    const hasYearContext = lines.some(l => /tenure.*year|year.*tenure/i.test(l));
    rule.max_tenure_months = hasYearContext ? tenureValue * 12 : tenureValue;
  }

  rule.foir_percent = extractValueFromLines(lines, category, [
    /foir[^\d]{0,20}(\d+)\s*%/i,
    /foir[^\d]{0,20}(\d+)/i,
    /obligation[^\d]{0,20}(\d+)\s*%/i
  ]);

  rule.min_salary = (() => {
    const val = extractValueFromLines(lines, category, [
      /minimum\s+(?:net\s+monthly\s+)?salary[^\d]{0,30}[₹\s]*([\d,]+)/i,
      /min\s+(?:net\s+monthly\s+)?salary[^\d]{0,30}[₹\s]*([\d,]+)/i,
      /nth[^\d]{0,30}[₹\s]*([\d,]+)/i,
      /nmi[^\d]{0,30}[₹\s]*([\d,]+)/i,
      /salary[^\d]{0,30}[₹\s]*([\d,]+)/i,
      /income[^\d]{0,30}[₹\s]*([\d,]+)/i
    ]);
    if (val != null && val < 1000) return null;
    return val;
  })();

  const hasValues = [rule.min_cibil, rule.max_age, rule.max_loan_amount, rule.min_loan_amount, rule.max_tenure_months, rule.foir_percent, rule.min_salary].some(v => v != null);
  if (!hasValues) {
    return null;
  }

  return rule;
}

module.exports = {
  resolveBankCategory,
  resolveAllBankCategories,
  normalizeCategory,
  CATEGORY_KEYWORDS,
  extractRuleFromMasterPolicy
};
