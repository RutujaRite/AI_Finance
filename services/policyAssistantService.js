const {
  BANK_CATALOG
} = require("./policyImporter");


function normalizeAssistantText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}


function escapeRegExp(value) {
  return String(value || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


// =====================================================
// DETECT BANK
// =====================================================

function detectBankFromText(text) {
  const normalized =
    normalizeAssistantText(text).toLowerCase();

  if (!normalized) {
    return null;
  }

  // Check specific bank names FIRST.
  // This prevents Axis Finance being detected as Axis Bank.
  const bankNamePatterns = [
    {
      pattern: /axis\s*finance/i,
      bank: BANK_CATALOG["axis finance"]
    },
    {
      pattern: /axis\s*bank/i,
      bank: BANK_CATALOG["axis bank"]
    },
    {
      pattern: /aditya\s*birla/i,
      bank: BANK_CATALOG["adityabirla"]
    },
    {
      pattern: /bajaj\s*finserv/i,
      bank: BANK_CATALOG["bajaj finserv"]
    },
    {
      pattern: /bajaj\s*markets/i,
      bank: BANK_CATALOG["bajaj markets"]
    },
    {
      pattern: /bandhan\s*bank/i,
      bank: BANK_CATALOG["bandhan bank"]
    },
    {
      pattern: /tata\s*capital/i,
      bank: BANK_CATALOG["tata capital"]
    },
    {
      pattern: /yes\s*bank/i,
      bank: BANK_CATALOG["yes bank"]
    },
    {
      pattern: /hdfc/i,
      bank: BANK_CATALOG["hdfc"]
    },
    {
      pattern: /icici/i,
      bank: BANK_CATALOG["icici"]
    },
    {
      pattern: /idfc/i,
      bank: BANK_CATALOG["idfc"]
    },
    {
      pattern: /indusind/i,
      bank: BANK_CATALOG["indusind"]
    },
    {
      pattern: /kotak/i,
      bank: BANK_CATALOG["kotak"]
    },
    {
      pattern: /piramal/i,
      bank: BANK_CATALOG["piramal"]
    }
  ];

  for (const { pattern, bank } of bankNamePatterns) {
    if (pattern.test(normalized) && bank) {
      return bank;
    }
  }

  const normalizedNoSpaces =
    normalized.replace(/\s+/g, "");

  for (const [key, bankInfo] of Object.entries(BANK_CATALOG)) {
    const keyNoSpaces =
      key.replace(/\s+/g, "");

    if (
      normalized.includes(key) ||
      normalizedNoSpaces.includes(keyNoSpaces)
    ) {
      return bankInfo;
    }

    if (bankInfo && bankInfo.code) {
      const code =
        String(bankInfo.code).toLowerCase();

      // Axis Finance must never be caught by AXIS Bank code.
      if (
        code === "axis" &&
        /axis\s*finance/i.test(normalized)
      ) {
        continue;
      }

      const codeRegex =
        new RegExp(`\\b${escapeRegExp(code)}\\b`, "i");

      if (codeRegex.test(normalized)) {
        return bankInfo;
      }
    }
  }

  return null;
}


// =====================================================
// POLICY QUESTION INTENT
// =====================================================

function isPolicyQaIntent(text) {
  const normalized =
    normalizeAssistantText(text).toLowerCase();

  if (!normalized) {
    return false;
  }

  const policyKeywords =
    /(salary|income|cibil|credit score|foir|tenure|tenor|roi|interest rate|loan amount|age|eligibility|policy|minimum|maximum|max|min|tier|slab|grid|pricing|processing fee|documents|kyc|company list|location|pincode|branch|employment)/i;

  const questionWords =
    /(what|how much|how many|tell me|show|list|give|what is|what are|is there|any|minimum|maximum|range|criteria|requirements|norms|guidelines)/i;

  return (
    policyKeywords.test(normalized) &&
    questionWords.test(normalized)
  );
}


// =====================================================
// PERSONAL LOAN ELIGIBILITY INTENT
// =====================================================

function isPersonalLoanEligibilityIntent(text) {
  const normalized =
    normalizeAssistantText(text).toLowerCase();

  if (!normalized) {
    return false;
  }

  return /(check eligibility|verify eligibility|am i eligible|eligible for|loan eligibility|personal loan eligibility|apply for personal loan|want to apply|need a loan|check my eligibility)/i.test(
    normalized
  );
}


// =====================================================
// MASTER POLICY
// =====================================================

async function getMasterPolicyForBank(
  pool,
  bankId
) {
  const result = await pool.query(
    `SELECT
       id,
       file_name,
       extracted_text,
       metadata
     FROM bank_policy_files
     WHERE bank_id = $1
       AND (
         metadata->>'is_master_policy' = 'true'
         OR metadata->>'is_unified_text' = 'true'
       )
     ORDER BY id DESC
     LIMIT 1`,
    [bankId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}


// =====================================================
// MASTER POLICY FALLBACK ANSWER
// =====================================================

function answerFromMasterPolicy(
  masterPolicy,
  question,
  bankName
) {
  if (
    !masterPolicy ||
    !masterPolicy.extracted_text
  ) {
    return (
      `I don't have access to the master policy document for ` +
      `${bankName || "this bank"}.`
    );
  }

  const text =
    String(masterPolicy.extracted_text);

  const q =
    normalizeAssistantText(question).toLowerCase();

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const keywords = [];

  if (/cibil|credit score|bureau/i.test(q)) {
    keywords.push(
      "cibil",
      "credit score",
      "bureau"
    );
  }

  if (/salary|income|nmi|nth|net take home/i.test(q)) {
    keywords.push(
      "salary",
      "income",
      "nmi",
      "nth",
      "net take home"
    );
  }

  if (/foir|dbr/i.test(q)) {
    keywords.push(
      "foir",
      "dbr"
    );
  }

  if (/tenure|tenor/i.test(q)) {
    keywords.push(
      "tenure",
      "tenor"
    );
  }

  if (/roi|interest|pricing/i.test(q)) {
    keywords.push(
      "roi",
      "interest",
      "pricing"
    );
  }

  if (/loan amount|max loan|minimum loan/i.test(q)) {
    keywords.push(
      "loan amount",
      "maximum loan",
      "minimum loan"
    );
  }

  if (/age/i.test(q)) {
    keywords.push(
      "age"
    );
  }

  if (/processing fee/i.test(q)) {
    keywords.push(
      "processing fee"
    );
  }

  if (/document|kyc/i.test(q)) {
    keywords.push(
      "document",
      "kyc"
    );
  }

  if (/location|pincode|city|branch/i.test(q)) {
    keywords.push(
      "location",
      "pincode",
      "city",
      "branch"
    );
  }

  if (keywords.length === 0) {
    return (
      `I found the master policy for ${bankName || "this bank"}, ` +
      `but I could not identify the specific policy criterion you are asking about.`
    );
  }

  const relevantLines =
    lines.filter(line => {
      const lower =
        line.toLowerCase();

      return keywords.some(keyword =>
        lower.includes(keyword)
      );
    });

  if (relevantLines.length === 0) {
    return (
      `I couldn't find a clear answer for ` +
      `"${normalizeAssistantText(question)}" in the ` +
      `${bankName || "bank"} master policy.`
    );
  }

  const cleanedLines =
    relevantLines
      .slice(0, 8)
      .map(line =>
        line.length > 240
          ? line.slice(0, 240) + "..."
          : line
      );

  return (
    `Based on the master policy for ${bankName || "this bank"}:\n\n` +
    cleanedLines
      .map(line => `• ${line}`)
      .join("\n")
  );
}


// =====================================================
// HELPERS FOR STRUCTURED POLICY RULES
// =====================================================

function detectLoanType(question) {
  const q =
    normalizeAssistantText(question).toLowerCase();

  if (/business loan|\bbl\b/i.test(q)) {
    return "Business";
  }

  if (/home loan|housing loan|mortgage/i.test(q)) {
    return "Home";
  }

  if (/car loan|auto loan|vehicle loan/i.test(q)) {
    return "Car";
  }

  if (/education loan|student loan/i.test(q)) {
    return "Education";
  }

  // Current assistant defaults to Personal Loan.
  return "Personal";
}


function formatIndianMoney(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return `₹${number.toLocaleString("en-IN")}`;
}


function formatPercent(value) {
  let number =
    Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  // Supports values stored as 0.75 or 75.
  if (
    number > 0 &&
    number <= 1
  ) {
    number =
      number * 100;
  }

  return `${Number(number.toFixed(2))}%`;
}


function getRuleName(rule) {
  if (
    rule.category &&
    String(rule.category).trim()
  ) {
    return String(rule.category).trim();
  }

  if (
    rule.employment_type &&
    String(rule.employment_type).trim()
  ) {
    return String(rule.employment_type).trim();
  }

  if (
    rule.policy_version &&
    String(rule.policy_version).trim()
  ) {
    return `Policy ${rule.policy_version}`;
  }

  return `Policy Rule ${rule.id}`;
}


function removeDuplicateResults(items) {
  const seen =
    new Set();

  return items.filter(item => {
    const key =
      `${item.name}|${item.value}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}


// =====================================================
// ALL-BANK STRUCTURED POLICY ANSWER
// =====================================================

async function answerPolicyQuestion(
  pool,
  bankInfo,
  question
) {
  if (
    !bankInfo ||
    !bankInfo.name
  ) {
    return "Please specify the bank name.";
  }

  const bankResult =
    await pool.query(
      `SELECT id, name, code
       FROM banks
       WHERE LOWER(name) = LOWER($1)
          OR UPPER(code) = UPPER($2)
       LIMIT 1`,
      [
        bankInfo.name,
        bankInfo.code || ""
      ]
    );

  if (bankResult.rowCount === 0) {
    return (
      `I don't have policy information for ` +
      `${bankInfo.name} in the system yet.`
    );
  }

  const bank =
    bankResult.rows[0];

  const requestedLoanType =
    detectLoanType(question);

  // Read only ACTIVE policy version.
  const rulesResult =
    await pool.query(
      `SELECT
         pr.id,
         pr.loan_type,
         pr.category,
         pr.min_cibil,
         pr.max_cibil,
         pr.min_salary,
         pr.max_salary,
         pr.employment_type,
         pr.min_age,
         pr.max_age,
         pr.min_loan_amount,
         pr.max_loan_amount,
         pr.min_tenure_months,
         pr.max_tenure_months,
         pr.foir_percent,
         pr.roi,
         pr.processing_fee_percent,
         pr.processing_fee_flat,
         pr.company_rules,
         pr.location_rules,
         pr.other_rules,
         pr.status,
         pv.version AS policy_version,
         pv.status AS version_status
       FROM policy_rules pr
       JOIN policy_versions pv
         ON pv.id = pr.policy_version_id
       WHERE pv.bank_id = $1
         AND pv.status = 'active'
         AND pr.status IN ('active', 'review')
         AND LOWER(COALESCE(pr.loan_type, ''))
             LIKE LOWER($2)
       ORDER BY
         CASE WHEN pr.status = 'active' THEN 0 ELSE 1 END,
         pr.id`,
      [
        bank.id,
        `%${requestedLoanType}%`
      ]
    );

  const rules =
    rulesResult.rows;

  // If there are no structured rules, use master policy fallback.
  if (rules.length === 0) {
    const masterPolicy =
      await getMasterPolicyForBank(
        pool,
        bank.id
      );

    if (masterPolicy) {
      return answerFromMasterPolicy(
        masterPolicy,
        question,
        bank.name
      );
    }

    return (
      `No active ${requestedLoanType} Loan policy rules were found ` +
      `for ${bank.name}.`
    );
  }

  const q =
    normalizeAssistantText(question).toLowerCase();

  const wantsMaximum =
    /\b(maximum|max|highest|up to)\b/i.test(q);

  const wantsMinimum =
    /\b(minimum|min|lowest|starting)\b/i.test(q);


  // ===================================================
  // CIBIL
  // ===================================================

  if (/cibil|credit score|bureau score/i.test(q)) {
    const field =
      wantsMaximum
        ? "max_cibil"
        : "min_cibil";

    let results =
      rules
        .filter(rule =>
          rule[field] != null
        )
        .map(rule => ({
          name: getRuleName(rule),
          value: Number(rule[field]),
          status: rule.status
        }));

    results =
      removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy =
        await getMasterPolicyForBank(
          pool,
          bank.id
        );

      return answerFromMasterPolicy(
        masterPolicy,
        question,
        bank.name
      );
    }

    let response =
      `${bank.name} — ${requestedLoanType} Loan CIBIL Criteria\n\n`;

    if (results.length > 1) {
      response +=
        `There is no single universal CIBIL requirement across all active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach(item => {
      response +=
        `• ${item.name}: ` +
        `${wantsMaximum ? "Maximum" : "Minimum"} CIBIL ` +
        `${item.value}${wantsMaximum ? "" : "+"}`;

      if (item.status === "review") {
        response += " (Review)";
      }

      response += "\n";
    });

    response +=
      `\nThe applicable CIBIL depends on the exact program and applicant profile.`;

    return response;
  }


  // ===================================================
  // SALARY / INCOME / NTH
  // ===================================================

  if (/salary|income|nmi|nth|net take home/i.test(q)) {
    const field =
      wantsMaximum
        ? "max_salary"
        : "min_salary";

    let results =
      rules
        .filter(rule =>
          rule[field] != null
        )
        .map(rule => ({
          name: getRuleName(rule),
          value: formatIndianMoney(
            rule[field]
          ),
          status: rule.status
        }))
        .filter(item => item.value);

    results =
      removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy =
        await getMasterPolicyForBank(
          pool,
          bank.id
        );

      return answerFromMasterPolicy(
        masterPolicy,
        question,
        bank.name
      );
    }

    let response =
      `${bank.name} — ${requestedLoanType} Loan Income Criteria\n\n`;

    if (results.length > 1) {
      response +=
        `Income requirements vary across active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach(item => {
      response +=
        `• ${item.name}: ` +
        `${wantsMaximum ? "Maximum income" : "Minimum income"} ` +
        `${item.value}`;

      if (!wantsMaximum) {
        response += "+";
      }

      if (item.status === "review") {
        response += " (Review)";
      }

      response += "\n";
    });

    return response;
  }


  // ===================================================
  // FOIR
  // ===================================================

  if (/foir|dbr/i.test(q)) {
    let results =
      rules
        .filter(rule =>
          rule.foir_percent != null
        )
        .map(rule => ({
          name: getRuleName(rule),
          value: formatPercent(
            rule.foir_percent
          ),
          status: rule.status
        }))
        .filter(item => item.value);

    results =
      removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy =
        await getMasterPolicyForBank(
          pool,
          bank.id
        );

      return answerFromMasterPolicy(
        masterPolicy,
        question,
        bank.name
      );
    }

    let response =
      `${bank.name} — ${requestedLoanType} Loan FOIR Criteria\n\n`;

    if (results.length > 1) {
      response +=
        `FOIR limits vary across active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach(item => {
      response +=
        `• ${item.name}: Maximum FOIR ${item.value}`;

      if (item.status === "review") {
        response += " (Review)";
      }

      response += "\n";
    });

    return response;
  }


  // ===================================================
  // TENURE
  // ===================================================

  if (/tenure|tenor/i.test(q)) {
    const field =
      wantsMinimum
        ? "min_tenure_months"
        : "max_tenure_months";

    let results =
      rules
        .filter(rule =>
          rule[field] != null
        )
        .map(rule => ({
          name: getRuleName(rule),
          value: Number(rule[field]),
          status: rule.status
        }));

    results =
      removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy =
        await getMasterPolicyForBank(
          pool,
          bank.id
        );

      return answerFromMasterPolicy(
        masterPolicy,
        question,
        bank.name
      );
    }

    let response =
      `${bank.name} — ${requestedLoanType} Loan Tenure Criteria\n\n`;

    if (results.length > 1) {
      response +=
        `Tenure varies across active policy rules.\n\n`;
    }

    results.slice(0, 12).forEach(item => {
      response +=
        `• ${item.name}: ` +
        `${wantsMinimum ? "Minimum" : "Maximum"} tenure ` +
        `${item.value} months`;

      if (item.status === "review") {
        response += " (Review)";
      }

      response += "\n";
    });

    return response;
  }


  // ===================================================
  // AGE
  // ===================================================

  if (/\bage\b|age limit/i.test(q)) {
    const field =
      wantsMaximum
        ? "max_age"
        : "min_age";

    let results =
      rules
        .filter(rule =>
          rule[field] != null
        )
        .map(rule => ({
          name: getRuleName(rule),
          value: Number(rule[field]),
          status: rule.status
        }));

    results =
      removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy =
        await getMasterPolicyForBank(
          pool,
          bank.id
        );

      return answerFromMasterPolicy(
        masterPolicy,
        question,
        bank.name
      );
    }

    let response =
      `${bank.name} — ${requestedLoanType} Loan Age Criteria\n\n`;

    results.slice(0, 12).forEach(item => {
      response +=
        `• ${item.name}: ` +
        `${wantsMaximum ? "Maximum" : "Minimum"} age ` +
        `${item.value} years`;

      if (item.status === "review") {
        response += " (Review)";
      }

      response += "\n";
    });

    return response;
  }


  // ===================================================
  // LOAN AMOUNT
  // ===================================================

  if (/loan amount|maximum loan|max loan|minimum loan|min loan/i.test(q)) {
    const field =
      wantsMinimum
        ? "min_loan_amount"
        : "max_loan_amount";

    let results =
      rules
        .filter(rule =>
          rule[field] != null
        )
        .map(rule => ({
          name: getRuleName(rule),
          value: formatIndianMoney(
            rule[field]
          ),
          status: rule.status
        }))
        .filter(item => item.value);

    results =
      removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy =
        await getMasterPolicyForBank(
          pool,
          bank.id
        );

      return answerFromMasterPolicy(
        masterPolicy,
        question,
        bank.name
      );
    }

    let response =
      `${bank.name} — ${requestedLoanType} Loan Amount Criteria\n\n`;

    results.slice(0, 12).forEach(item => {
      response +=
        `• ${item.name}: ` +
        `${wantsMinimum ? "Minimum" : "Maximum"} loan amount ` +
        `${item.value}`;

      if (item.status === "review") {
        response += " (Review)";
      }

      response += "\n";
    });

    return response;
  }


  // ===================================================
  // ROI / INTEREST
  // ===================================================

  if (/roi|interest rate|pricing/i.test(q)) {
    let results =
      rules
        .filter(rule =>
          rule.roi != null &&
          String(rule.roi).trim() !== ""
        )
        .map(rule => ({
          name: getRuleName(rule),
          value:
            Number.isFinite(Number(rule.roi))
              ? formatPercent(rule.roi)
              : String(rule.roi),
          status: rule.status
        }))
        .filter(item => item.value);

    results =
      removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy =
        await getMasterPolicyForBank(
          pool,
          bank.id
        );

      return answerFromMasterPolicy(
        masterPolicy,
        question,
        bank.name
      );
    }

    let response =
      `${bank.name} — ${requestedLoanType} Loan Interest / ROI\n\n`;

    results.slice(0, 12).forEach(item => {
      response +=
        `• ${item.name}: ${item.value}`;

      if (item.status === "review") {
        response += " (Review)";
      }

      response += "\n";
    });

    return response;
  }


  // ===================================================
  // PROCESSING FEE
  // ===================================================

  if (/processing fee|fee/i.test(q)) {
    let results =
      rules
        .filter(rule =>
          rule.processing_fee_percent != null ||
          rule.processing_fee_flat != null
        )
        .map(rule => {
          const parts = [];

          if (rule.processing_fee_percent != null) {
            parts.push(
              formatPercent(
                rule.processing_fee_percent
              )
            );
          }

          if (rule.processing_fee_flat != null) {
            const flat =
              formatIndianMoney(
                rule.processing_fee_flat
              );

            if (flat) {
              parts.push(flat);
            }
          }

          return {
            name: getRuleName(rule),
            value: parts.filter(Boolean).join(" + "),
            status: rule.status
          };
        })
        .filter(item => item.value);

    results =
      removeDuplicateResults(results);

    if (results.length === 0) {
      const masterPolicy =
        await getMasterPolicyForBank(
          pool,
          bank.id
        );

      return answerFromMasterPolicy(
        masterPolicy,
        question,
        bank.name
      );
    }

    let response =
      `${bank.name} — ${requestedLoanType} Loan Processing Fee\n\n`;

    results.slice(0, 12).forEach(item => {
      response +=
        `• ${item.name}: ${item.value}`;

      if (item.status === "review") {
        response += " (Review)";
      }

      response += "\n";
    });

    return response;
  }


  // ===================================================
  // GENERAL ELIGIBILITY / POLICY QUESTION
  // ===================================================

  if (/eligibility|criteria|requirements|policy/i.test(q)) {
    const activeRules =
      rules.filter(rule =>
        rule.status === "active"
      );

    const sourceRules =
      activeRules.length > 0
        ? activeRules
        : rules;

    let response =
      `${bank.name} — ${requestedLoanType} Loan Policy Summary\n\n`;

    const cibilValues =
      [...new Set(
        sourceRules
          .filter(rule => rule.min_cibil != null)
          .map(rule => Number(rule.min_cibil))
      )];

    const salaryValues =
      [...new Set(
        sourceRules
          .filter(rule => rule.min_salary != null)
          .map(rule => Number(rule.min_salary))
      )];

    const maxLoanValues =
      [...new Set(
        sourceRules
          .filter(rule => rule.max_loan_amount != null)
          .map(rule => Number(rule.max_loan_amount))
      )];

    const maxTenureValues =
      [...new Set(
        sourceRules
          .filter(rule => rule.max_tenure_months != null)
          .map(rule => Number(rule.max_tenure_months))
      )];

    const foirValues =
      [...new Set(
        sourceRules
          .filter(rule => rule.foir_percent != null)
          .map(rule => formatPercent(rule.foir_percent))
          .filter(Boolean)
      )];

    if (cibilValues.length > 0) {
      response +=
        `• Minimum CIBIL values: ${cibilValues.join(", ")}\n`;
    }

    if (salaryValues.length > 0) {
      response +=
        `• Minimum income values: ` +
        `${salaryValues.map(formatIndianMoney).join(", ")}\n`;
    }

    if (maxLoanValues.length > 0) {
      response +=
        `• Maximum loan amounts: ` +
        `${maxLoanValues.map(formatIndianMoney).join(", ")}\n`;
    }

    if (maxTenureValues.length > 0) {
      response +=
        `• Maximum tenure values: ` +
        `${maxTenureValues.join(", ")} months\n`;
    }

    if (foirValues.length > 0) {
      response +=
        `• FOIR limits: ${foirValues.join(", ")}\n`;
    }

    response +=
      `\nDifferent programs may have different eligibility conditions.`;

    return response;
  }


  // ===================================================
  // MASTER POLICY FALLBACK
  // ===================================================

  const masterPolicy =
    await getMasterPolicyForBank(
      pool,
      bank.id
    );

  if (masterPolicy) {
    return answerFromMasterPolicy(
      masterPolicy,
      question,
      bank.name
    );
  }

  return (
    `I found active policy rules for ${bank.name}, ` +
    `but I could not identify the specific criterion requested.`
  );
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  detectBankFromText,
  isPolicyQaIntent,
  isPersonalLoanEligibilityIntent,
  getMasterPolicyForBank,
  answerFromMasterPolicy,
  answerPolicyQuestion
};