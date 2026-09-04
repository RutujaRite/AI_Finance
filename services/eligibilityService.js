/**
 * Deterministic Personal Loan Eligibility Engine
 * Evaluates applicant data against active PostgreSQL bank policy rules.
 */

function formatIndianCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "₹0";
  return `₹${num.toLocaleString("en-IN")}`;
}

/**
 * Builds individual policy checks deterministically for a single policy rule.
 * 
 * @param {Object} rule - The policy_rules row (with joined version/bank/source info)
 * @param {Object} applicant - The applicant payload
 * @param {Object} [extraContext] - Optional resolved context (e.g., matched company_records)
 * @returns {Object} Evaluation result with status, checks, missing_fields, reasons, offered_terms
 */
function buildPolicyChecks(rule, applicant, extraContext = {}) {
  const checks = [];
  const missingFields = [];
  const failureReasons = [];
  const reviewReasons = [];

  const cibil = applicant.cibil != null && applicant.cibil !== "" ? Number(applicant.cibil) : null;
  const age = applicant.age != null && applicant.age !== "" ? Number(applicant.age) : null;
  const employmentType = applicant.employmentType ? String(applicant.employmentType).trim() : "";
  const monthlyIncome = applicant.monthlyIncome != null && applicant.monthlyIncome !== "" ? Number(applicant.monthlyIncome) : null;
  const existingEmi = applicant.existingEmi != null && applicant.existingEmi !== "" ? Number(applicant.existingEmi) : 0;
  const loanAmount = applicant.loanAmount != null && applicant.loanAmount !== "" ? Number(applicant.loanAmount) : null;
  const tenureMonths = applicant.tenureMonths != null && applicant.tenureMonths !== "" ? Number(applicant.tenureMonths) : null;
  const location = applicant.location ? String(applicant.location).trim() : "";
  const pincode = applicant.pincode ? String(applicant.pincode).trim() : "";
  const companyName = applicant.companyName ? String(applicant.companyName).trim() : "";

  const sourceRef = {
    rule_id: rule.id,
    policy_version_id: rule.policy_version_id,
    policy_version: rule.policy_version || `V${rule.policy_version_id || 1}`,
    category: rule.category || null,
    source_file: rule.source_file_name || rule.policy_source_file || null
  };

  const sourceLabel = `[Policy ${sourceRef.policy_version}${rule.category ? ` / ${rule.category}` : ""}]`;

  // ==============================
  // 1. CIBIL / CREDIT SCORE
  // ==============================
  if (rule.min_cibil != null || rule.max_cibil != null) {
    const band = `${rule.min_cibil ?? 300}${rule.max_cibil != null ? "–" + rule.max_cibil : "+"}`;

    if (cibil == null || isNaN(cibil)) {
      missingFields.push("cibil");
      const msg = `${sourceLabel} Policy requires CIBIL ${band}. Applicant CIBIL not provided.`;
      reviewReasons.push(msg);
      checks.push({
        criterion: "CIBIL",
        result: "review",
        required: band,
        actual: null,
        detail: msg,
        source: sourceRef
      });
    } else {
      const ok =
        (rule.min_cibil == null || cibil >= Number(rule.min_cibil)) &&
        (rule.max_cibil == null || cibil <= Number(rule.max_cibil));

      const msg = ok
        ? `${sourceLabel} CIBIL ${cibil} meets required score criteria (${band}).`
        : `${sourceLabel} CIBIL ${cibil} does not meet required criteria (${band}).`;

      if (!ok) failureReasons.push(msg);

      checks.push({
        criterion: "CIBIL",
        result: ok ? "pass" : "fail",
        required: band,
        actual: cibil,
        detail: msg,
        source: sourceRef
      });
    }
  }

  // ==============================
  // 2. NET MONTHLY SALARY / INCOME
  // ==============================
  if (rule.min_salary != null || rule.max_salary != null) {
    const minSal = rule.min_salary != null ? Number(rule.min_salary) : null;
    const maxSal = rule.max_salary != null ? Number(rule.max_salary) : null;
    const band = `${minSal != null ? formatIndianCurrency(minSal) : "₹0"} – ${maxSal != null ? formatIndianCurrency(maxSal) : "Unlimited"}`;

    if (monthlyIncome == null || isNaN(monthlyIncome) || monthlyIncome <= 0) {
      missingFields.push("monthlyIncome");
      const msg = `${sourceLabel} Policy requires net monthly salary ${band}. Applicant monthly income not provided.`;
      reviewReasons.push(msg);
      checks.push({
        criterion: "Salary",
        result: "review",
        required: band,
        actual: null,
        detail: msg,
        source: sourceRef
      });
    } else {
      const ok =
        (minSal == null || monthlyIncome >= minSal) &&
        (maxSal == null || monthlyIncome <= maxSal);

      const msg = ok
        ? `${sourceLabel} Monthly income ${formatIndianCurrency(monthlyIncome)} satisfies salary band (${band}).`
        : `${sourceLabel} Monthly income ${formatIndianCurrency(monthlyIncome)} is outside allowable band (${band}).`;

      if (!ok) failureReasons.push(msg);

      checks.push({
        criterion: "Salary",
        result: ok ? "pass" : "fail",
        required: band,
        actual: formatIndianCurrency(monthlyIncome),
        detail: msg,
        source: sourceRef
      });
    }
  }

  // ==============================
  // 3. APPLICANT AGE
  // ==============================
  if (rule.min_age != null || rule.max_age != null) {
    const minAge = rule.min_age != null ? Number(rule.min_age) : 21;
    const maxAge = rule.max_age != null ? Number(rule.max_age) : 60;
    const band = `${minAge}–${maxAge} years`;

    if (age == null || isNaN(age)) {
      missingFields.push("age");
      const msg = `${sourceLabel} Policy requires applicant age in ${band}. Applicant age not provided.`;
      reviewReasons.push(msg);
      checks.push({
        criterion: "Age",
        result: "review",
        required: band,
        actual: null,
        detail: msg,
        source: sourceRef
      });
    } else {
      const ok =
        (rule.min_age == null || age >= Number(rule.min_age)) &&
        (rule.max_age == null || age <= Number(rule.max_age));

      const msg = ok
        ? `${sourceLabel} Age ${age} years meets policy age criteria (${band}).`
        : `${sourceLabel} Age ${age} years is outside allowable range (${band}).`;

      if (!ok) failureReasons.push(msg);

      checks.push({
        criterion: "Age",
        result: ok ? "pass" : "fail",
        required: band,
        actual: `${age} years`,
        detail: msg,
        source: sourceRef
      });
    }
  }

  // ==============================
  // 4. EMPLOYMENT TYPE (STRICT MATCHING)
  // ==============================
  if (rule.employment_type && rule.employment_type !== "Any") {
    if (!employmentType) {
      missingFields.push("employmentType");
      const msg = `${sourceLabel} Policy requires '${rule.employment_type}' employment. Applicant employment type not provided.`;
      reviewReasons.push(msg);
      checks.push({
        criterion: "Employment",
        result: "review",
        required: rule.employment_type,
        actual: null,
        detail: msg,
        source: sourceRef
      });
    } else {
      // Normalize both for comparison
      const normApp = employmentType.toLowerCase().replace(/[^a-z]/g, "");
      const normRule = rule.employment_type.toLowerCase().replace(/[^a-z]/g, "");

      // Allow flexible matching for compound terms (e.g., "Salaried" matches "Salaried/Regular")
      const appParts = employmentType.toLowerCase().split(/[\s\/\-,]/);
      const ruleParts = rule.employment_type.toLowerCase().split(/[\s\/\-,]/);
      
      // Check if there's at least one matching part
      const hasMatchingPart = ruleParts.some(rulePart => 
        appParts.some(appPart => 
          appPart.replace(/[^a-z]/g, "") === rulePart.replace(/[^a-z]/g, "")
        )
      );

      // Do NOT map employment types between categories
      // e.g., Salaried should NOT match Self-Employed, PSU/Govt, etc.
      const isSalariedRule = /salaried|regular|permanent|employee/i.test(rule.employment_type);
      const isSelfEmpRule = /self|business|proprietor|freelance/i.test(rule.employment_type);
      const isPsuRule = /psu|govt|government|public/i.test(rule.employment_type);

      const isSalariedApp = /salaried|regular|permanent|employee/i.test(employmentType);
      const isSelfEmpApp = /self|business|proprietor|freelance/i.test(employmentType);
      const isPsuApp = /psu|govt|government|public/i.test(employmentType);

      let ok = false;
      // Exact category match
      if (isSalariedRule && isSalariedApp) ok = true;
      if (isSelfEmpRule && isSelfEmpApp) ok = true;
      if (isPsuRule && isPsuApp) ok = true;
      // Flexible part matching for same category
      if (!ok && hasMatchingPart && !(isSalariedRule && isSelfEmpApp) && !(isSalariedRule && isPsuApp) && 
          !(isSelfEmpRule && isSalariedApp) && !(isSelfEmpRule && isPsuApp) && 
          !(isPsuRule && isSalariedApp) && !(isPsuRule && isSelfEmpApp)) {
        ok = true;
      }

      const msg = ok
        ? `${sourceLabel} Employment '${employmentType}' matches required '${rule.employment_type}'.`
        : `${sourceLabel} Employment '${employmentType}' does not match required '${rule.employment_type}'.`;

      if (!ok) failureReasons.push(msg);

      checks.push({
        criterion: "Employment",
        result: ok ? "pass" : "fail",
        required: rule.employment_type,
        actual: employmentType,
        detail: msg,
        source: sourceRef
      });
    }
  }

  // ==============================
  // 5. REQUESTED LOAN AMOUNT
  // ==============================
  if (rule.min_loan_amount != null || rule.max_loan_amount != null) {
    const minAmt = rule.min_loan_amount != null ? Number(rule.min_loan_amount) : null;
    const maxAmt = rule.max_loan_amount != null ? Number(rule.max_loan_amount) : null;
    const band = `${minAmt != null ? formatIndianCurrency(minAmt) : "₹0"} – ${maxAmt != null ? formatIndianCurrency(maxAmt) : "Max"}`;

    if (loanAmount == null || isNaN(loanAmount) || loanAmount <= 0) {
      missingFields.push("loanAmount");
      const msg = `${sourceLabel} Policy loan ticket size is ${band}. Requested loan amount not provided.`;
      reviewReasons.push(msg);
      checks.push({
        criterion: "Loan Amount",
        result: "review",
        required: band,
        actual: null,
        detail: msg,
        source: sourceRef
      });
    } else {
      const ok =
        (minAmt == null || loanAmount >= minAmt) &&
        (maxAmt == null || loanAmount <= maxAmt);

      const msg = ok
        ? `${sourceLabel} Requested loan amount ${formatIndianCurrency(loanAmount)} is within permissible ticket size (${band}).`
        : `${sourceLabel} Requested loan amount ${formatIndianCurrency(loanAmount)} is outside permissible ticket size (${band}).`;

      if (!ok) failureReasons.push(msg);

      checks.push({
        criterion: "Loan Amount",
        result: ok ? "pass" : "fail",
        required: band,
        actual: formatIndianCurrency(loanAmount),
        detail: msg,
        source: sourceRef
      });
    }
  }

  // ==============================
  // 6. LOAN TENURE
  // ==============================
  if (rule.min_tenure_months != null || rule.max_tenure_months != null) {
    const minT = rule.min_tenure_months != null ? Number(rule.min_tenure_months) : 12;
    const maxT = rule.max_tenure_months != null ? Number(rule.max_tenure_months) : 60;
    const band = `${minT}–${maxT} months`;

    if (tenureMonths == null || isNaN(tenureMonths) || tenureMonths <= 0) {
      missingFields.push("tenureMonths");
      const msg = `${sourceLabel} Policy tenure limit is ${band}. Requested tenure not provided.`;
      reviewReasons.push(msg);
      checks.push({
        criterion: "Tenure",
        result: "review",
        required: band,
        actual: null,
        detail: msg,
        source: sourceRef
      });
    } else {
      const ok =
        (rule.min_tenure_months == null || tenureMonths >= Number(rule.min_tenure_months)) &&
        (rule.max_tenure_months == null || tenureMonths <= Number(rule.max_tenure_months));

      const msg = ok
        ? `${sourceLabel} Requested tenure of ${tenureMonths} months is within policy limits (${band}).`
        : `${sourceLabel} Requested tenure of ${tenureMonths} months is outside policy limits (${band}).`;

      if (!ok) failureReasons.push(msg);

      checks.push({
        criterion: "Tenure",
        result: ok ? "pass" : "fail",
        required: band,
        actual: `${tenureMonths} months`,
        detail: msg,
        source: sourceRef
      });
    }
  }

  // ==============================
  // 7. FOIR / OBLIGATION CAP
  // ==============================
  if (rule.foir_percent != null) {
    const maxFoir = Number(rule.foir_percent);

    if (monthlyIncome == null || isNaN(monthlyIncome) || monthlyIncome <= 0) {
      const msg = `${sourceLabel} Policy FOIR cap is ${maxFoir}%. Fixed obligation ratio cannot be calculated without monthly income.`;
      reviewReasons.push(msg);
      checks.push({
        criterion: "FOIR",
        result: "review",
        required: `Max ${maxFoir}%`,
        actual: null,
        detail: msg,
        source: sourceRef
      });
    } else {
      const userFoir = (existingEmi / monthlyIncome) * 100;
      const ok = userFoir <= maxFoir;

      const msg = ok
        ? `${sourceLabel} Obligation ratio ${userFoir.toFixed(1)}% is within max allowable FOIR cap of ${maxFoir}%.`
        : `${sourceLabel} Obligation ratio ${userFoir.toFixed(1)}% exceeds max allowable FOIR cap of ${maxFoir}%.`;

      if (!ok) failureReasons.push(msg);

      checks.push({
        criterion: "FOIR",
        result: ok ? "pass" : "fail",
        required: `Max ${maxFoir}%`,
        actual: `${userFoir.toFixed(1)}%`,
        detail: msg,
        source: sourceRef
      });
    }
  }
// ==============================
// 8. COMPANY / EMPLOYER CATEGORY
// ==============================

const companyRules = rule.company_rules;

const hasCompanyRules =
  companyRules &&
  (
    (Array.isArray(companyRules.categories) &&
      companyRules.categories.length > 0) ||
    (Array.isArray(companyRules.list) &&
      companyRules.list.length > 0)
  );

if (hasCompanyRules || rule.category) {
  const allowedCategories = [
    ...(companyRules?.categories || []),
    ...(companyRules?.list || []),
    ...(rule.category ? [rule.category] : [])
  ]
    .filter(Boolean)
    .map(value => String(value).trim());

  const coverageDesc =
    allowedCategories.join(", ") || "Approved Employer Category";

  if (!companyName) {
    const msg =
      `${sourceLabel} Employer/company name is required to verify category (${coverageDesc}).`;

    reviewReasons.push(msg);

    checks.push({
      criterion: "Company/Category",
      result: "review",
      required: coverageDesc,
      actual: null,
      detail: msg,
      source: sourceRef
    });
  } else {
    const matchedRecordCategory =
      extraContext.company_category
        ? String(extraContext.company_category).trim()
        : null;

    const isGeneralRule = allowedCategories.some(c => /general|all|open|standard|any/i.test(c));

    const matched =
      isGeneralRule ||
      Boolean(
        matchedRecordCategory &&
        (allowedCategories.some(category =>
          category.toLowerCase() === matchedRecordCategory.toLowerCase()
        ) || /super\s*a|elite|cat\s*a|cat\s*b|cat\s*c|approved|diamond|open\s*market|giga|mega/i.test(matchedRecordCategory))
      );

    const msg = matched
      ? `${sourceLabel} Employer '${companyName}' verified under policy category (${matchedRecordCategory || "General / Corporate"}).`
      : `${sourceLabel} Employer '${companyName}' could not be verified for policy category (${coverageDesc}).`;

    if (!matched) {
      reviewReasons.push(msg);
    }

    checks.push({
      criterion: "Company/Category",
      result: matched ? "pass" : "review",
      required: coverageDesc,
      actual: matchedRecordCategory
        ? `${companyName} [${matchedRecordCategory}]`
        : companyName,
      detail: msg,
      source: sourceRef
    });
  }
}
  // ==============================
  // 9. LOCATION & PINCODE COVERAGE
  // ==============================
  const locationRules = rule.location_rules;
  const hasLocationRules =
    locationRules &&
    ((Array.isArray(locationRules.pincodes) && locationRules.pincodes.length > 0) ||
     (Array.isArray(locationRules.locations) && locationRules.locations.length > 0) ||
     (Array.isArray(locationRules.cities) && locationRules.cities.length > 0));

  if (hasLocationRules) {
    const pins = locationRules.pincodes || [];
    const locs = [...(locationRules.locations || []), ...(locationRules.cities || [])];
    const coverage = [...pins, ...locs].join(", ");

    const appLoc = location || pincode;

    if (!appLoc) {
      const msg = `${sourceLabel} Policy specifies location coverage (${coverage}). Applicant city/pincode not provided.`;
      reviewReasons.push(msg);
      checks.push({
        criterion: "Location/Pincode",
        result: "review",
        required: coverage,
        actual: null,
        detail: msg,
        source: sourceRef
      });
    } else {
      const normLoc = appLoc.toLowerCase();

      const pinMatch = pins.some(p => normLoc.includes(String(p).toLowerCase()));
      const locMatch = locs.some(l => {
        const normL = String(l).toLowerCase();
        return normLoc.includes(normL) || normL.includes(normLoc);
      });

      const ok = pinMatch || locMatch;

      const msg = ok
        ? `${sourceLabel} Location '${appLoc}' is within bank coverage area.`
        : `${sourceLabel} Location '${appLoc}' is not found in approved location list (${coverage}).`;

      if (!ok) failureReasons.push(msg);

      checks.push({
        criterion: "Location/Pincode",
        result: ok ? "pass" : "fail",
        required: coverage,
        actual: appLoc,
        detail: msg,
        source: sourceRef
      });
    }
  }

  // ==============================
  // 10. OTHER CUSTOM CONDITIONS
  // ==============================
  const otherRules = rule.other_rules;
  if (otherRules && Array.isArray(otherRules.conditions) && otherRules.conditions.length > 0) {
    const condList = otherRules.conditions.join("; ");
    checks.push({
      criterion: "Other Conditions",
      result: "review",
      required: condList,
      actual: "Standard Review",
      detail: `${sourceLabel} Special policy conditions apply: ${condList}`,
      source: sourceRef
    });
  }

  // ==============================
  // OVERALL STATUS DETERMINATION
  // ==============================
  const hasFail = checks.some(c => c.result === "fail");
  const hasReview = checks.some(c => c.result === "review");

  let status = "ELIGIBLE";
  if (hasFail) {
    status = "NOT_ELIGIBLE";
  } else if (hasReview) {
    status = "NEEDS_REVIEW";
  }

  // ==============================
  // OFFERED TERMS / PRICING
  // ==============================
  const offeredTerms = {
    roi: rule.roi != null ? Number(rule.roi) : null,
    processing_fee_percent: rule.processing_fee_percent != null ? Number(rule.processing_fee_percent) : null,
    processing_fee_flat: rule.processing_fee_flat != null ? Number(rule.processing_fee_flat) : null,
    foir_percent: rule.foir_percent != null ? Number(rule.foir_percent) : null,
    max_tenure_months: rule.max_tenure_months != null ? Number(rule.max_tenure_months) : null,
    max_loan_amount: rule.max_loan_amount != null ? Number(rule.max_loan_amount) : null
  };

  return {
    status,
    checks,
    missing_fields: [...new Set(missingFields)],
    failure_reasons: failureReasons,
    review_reasons: reviewReasons,
    offered_terms: offeredTerms,
    source: sourceRef
  };
}

/**
 * Evaluates an applicant dynamically against all active Personal Loan policies in PostgreSQL.
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} applicant - The applicant details
 * @param {Object} [options] - Optional filters (e.g. bankId, loanType)
 * @returns {Promise<Array>} Array of bank evaluations
 */
/**
 * Aggregates all evaluated policy rules for a bank into one definitive bank decision.
 * 
 * Rules:
 * - Active rules with passing checks can determine bank ELIGIBILITY.
 * - Review rules do not independently approve an applicant as ELIGIBLE; they add review conditions / NEEDS_REVIEW status.
 * - If hard criteria in all active rules fail, the bank decision is NOT_ELIGIBLE.
 */
function aggregateBankEvaluations(bankData, applicant, companyContext) {
  const evaluatedRules = bankData.rules.map(rule => ({
    rule,
    evaluation: buildPolicyChecks(rule, applicant, companyContext)
  }));

  // Separate active rules vs review rules
  const activeEvaluations = evaluatedRules.filter(r => r.rule.rule_status === "active");
  const reviewEvaluations = evaluatedRules.filter(r => r.rule.rule_status === "review");

  // Filter passing / review / failing active rules
  const passingActive = activeEvaluations.filter(r => r.evaluation.status === "ELIGIBLE");
  const reviewActive = activeEvaluations.filter(r => r.evaluation.status === "NEEDS_REVIEW");
  const failingActive = activeEvaluations.filter(r => r.evaluation.status === "NOT_ELIGIBLE");

  let finalStatus = "NOT_ELIGIBLE";
  let primaryRuleEval = null;

  if (passingActive.length > 0) {
    // An active rule passed all checks -> Bank is ELIGIBLE
    finalStatus = "ELIGIBLE";
    primaryRuleEval = passingActive[0];
  } else if (reviewActive.length > 0) {
    // An active rule requires review -> Bank is NEEDS_REVIEW
    finalStatus = "NEEDS_REVIEW";
    primaryRuleEval = reviewActive[0];
  } else if (activeEvaluations.length === 0 && reviewEvaluations.some(r => r.evaluation.status === "ELIGIBLE" || r.evaluation.status === "NEEDS_REVIEW")) {
    // Only review rules exist and passed -> Review rules must NOT independently approve, set NEEDS_REVIEW
    finalStatus = "NEEDS_REVIEW";
    primaryRuleEval = reviewEvaluations.find(r => r.evaluation.status === "ELIGIBLE" || r.evaluation.status === "NEEDS_REVIEW");
  } else {
    // All active rules failed -> Bank is NOT_ELIGIBLE
    finalStatus = "NOT_ELIGIBLE";
    primaryRuleEval = activeEvaluations[0] || reviewEvaluations[0];
  }

  // Aggregate checks, prioritizing the primary matched rule
  const allChecks = [];
  const seenCriteria = new Set();

  if (primaryRuleEval) {
    primaryRuleEval.evaluation.checks.forEach(c => {
      allChecks.push(c);
      seenCriteria.add(c.criterion);
    });
  }

  // Include review conditions from secondary/review rules as review checks
  reviewEvaluations.forEach(r => {
    r.evaluation.checks.forEach(c => {
      if (c.result === "review" && !allChecks.some(existing => existing.detail === c.detail)) {
        allChecks.push(c);
      }
    });
  });

  const allFailureReasons = [...new Set(evaluatedRules.flatMap(r => r.evaluation.failure_reasons))];
  const allReviewReasons = [...new Set(evaluatedRules.flatMap(r => r.evaluation.review_reasons))];
  const allMissingFields = [...new Set(evaluatedRules.flatMap(r => r.evaluation.missing_fields))];
  const allSources = evaluatedRules.map(r => r.evaluation.source);

  const bestTerms = Object.assign({}, primaryRuleEval ? primaryRuleEval.evaluation.offered_terms : {});

  const matchedRuleDesc = primaryRuleEval
    ? `[${primaryRuleEval.rule.rule_status === "active" ? "Active" : "Review"} Rule #${primaryRuleEval.rule.id}] Policy ${primaryRuleEval.rule.policy_version || "V1"}${primaryRuleEval.rule.category ? ` / ${primaryRuleEval.rule.category}` : ""}`
    : "Default Active Policy";

  return {
    bank: bankData.bank_name,
    bank_id: bankData.bank_id,
    bank_code: bankData.bank_code,
    loan_type: "Personal",
    status: finalStatus,
    matched_rule: matchedRuleDesc,
    policy_version: primaryRuleEval?.rule?.policy_version || (allSources[0]?.policy_version) || "Active",
    checks: allChecks,
    missing_fields: allMissingFields,
    failure_reasons: finalStatus === "NOT_ELIGIBLE" ? (primaryRuleEval?.evaluation?.failure_reasons || allFailureReasons) : [],
    review_reasons: allReviewReasons,
    offered_terms: bestTerms,
    source: primaryRuleEval ? primaryRuleEval.evaluation.source : allSources[0],
    all_sources: allSources
  };
}

/**
 * Evaluates an applicant dynamically against all active Personal Loan policies in PostgreSQL.
 * Aggregates multiple rules per bank so each bank appears exactly once.
 * 
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} applicant - The applicant details
 * @param {Object} [options] - Optional filters (e.g. bankId, loanType)
 * @returns {Promise<Array>} Array of single aggregated bank evaluations
 */
async function evaluateApplicantAgainstPolicies(pool, applicant, options = {}) {
  const loanType = options.loanType || applicant.loanType || "Personal";
  const targetBankId = options.bankId ? Number(options.bankId) : null;
  const targetCategory = options.category || applicant.category || null;

  const sqlParams = [loanType];
  let bankFilterSql = "";
  let categoryFilterSql = "";

  if (targetBankId) {
    sqlParams.push(targetBankId);
    bankFilterSql = ` AND b.id = $${sqlParams.length}`;
  }

  if (targetCategory) {
    sqlParams.push(targetCategory);
    categoryFilterSql = ` AND pr.category = $${sqlParams.length}`;
  }

  // Dynamically fetch all active banks, their active policy versions, and active/review policy rules
  const query = `
    SELECT
      b.id AS bank_id,
      b.name AS bank_name,
      b.code AS bank_code,
      pv.id AS policy_version_id,
      pv.version AS policy_version,
      pv.status AS version_status,
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
      pr.source_references,
      pr.status AS rule_status,
      pa.file_name AS source_file_name,
      pa.file_path AS source_file_path,
      ps.file_name AS policy_source_file
    FROM banks b
    JOIN policy_versions pv
      ON pv.bank_id = b.id
    JOIN policy_rules pr
      ON pr.policy_version_id = pv.id
    LEFT JOIN policy_attachments pa
      ON pa.policy_rule_id = pr.id
    LEFT JOIN policy_sources ps
      ON ps.id = pv.source_id
    WHERE b.is_active = true
      AND pv.status = 'active'
      AND pr.status IN ('active', 'review')
      AND pr.loan_type = $1
      ${bankFilterSql}
      ${categoryFilterSql}
    ORDER BY b.name ASC, pr.id DESC
  `;

  const result = await pool.query(query, sqlParams);
  const rulesByBank = new Map();

  for (const row of result.rows) {
    if (!rulesByBank.has(row.bank_id)) {
      rulesByBank.set(row.bank_id, {
        bank_id: row.bank_id,
        bank_name: row.bank_name,
        bank_code: row.bank_code,
        rules: []
      });
    }
    rulesByBank.get(row.bank_id).rules.push(row);
  }

  const evaluations = [];

  for (const [, bankData] of rulesByBank.entries()) {
    let companyContext = {};

    // Check company category from bank_company_data with exact match prioritization and alias mapping
    if (applicant.companyName) {
      try {
        const rawComp = String(applicant.companyName).trim();
        const cleanComp = rawComp.replace(/(?:limited|pvt|private|ltd|inc|corp)/gi, "").trim();

        // Standard alias mappings for major Indian corporates
        let aliasPattern = cleanComp;
        if (/^tcs$/i.test(cleanComp)) aliasPattern = "TATA CONSULTANCY SERVICES";
        else if (/^infosys$/i.test(cleanComp)) aliasPattern = "INFOSYS";
        else if (/^wipro$/i.test(cleanComp)) aliasPattern = "WIPRO";
        else if (/^hcl$/i.test(cleanComp)) aliasPattern = "HCL";
        else if (/^cognizant|cts$/i.test(cleanComp)) aliasPattern = "COGNIZANT";

        const searchPattern = `%${aliasPattern}%`;

        const compRes = await pool.query(
          `SELECT company_name, company_category, other_info
           FROM bank_company_data
           WHERE (bank_name ILIKE $1 OR bank_name ILIKE $2)
             AND LOWER(company_name) LIKE LOWER($3)
           ORDER BY
             CASE
               WHEN LOWER(company_name) = LOWER($4) THEN 1
               WHEN LOWER(company_name) = LOWER($4 || ' limited') THEN 2
               WHEN LOWER(company_name) = LOWER($4 || ' ltd') THEN 3
               WHEN LOWER(company_name) = LOWER($4 || ' private limited') THEN 4
               WHEN LOWER(company_name) = LOWER($4 || ' pvt ltd') THEN 5
               WHEN LOWER(company_name) LIKE LOWER($4 || ' %') THEN 6
               WHEN LOWER(company_name) LIKE LOWER($4 || '%') THEN 7
               ELSE 8
             END,
             company_name ASC
           LIMIT 1`,
          [bankData.bank_name, `%${bankData.bank_code}%`, searchPattern, aliasPattern]
        );
        if (compRes.rowCount > 0) {
          companyContext.company_category = compRes.rows[0].company_category;
          companyContext.company_other_info = compRes.rows[0].other_info;
        } else {
          // Fallback lookup across bank_company_data with priority sorting
          const fallbackRes = await pool.query(
            `SELECT company_name, company_category, other_info
             FROM bank_company_data
             WHERE LOWER(company_name) LIKE LOWER($1)
             ORDER BY
               CASE
                 WHEN LOWER(company_name) = LOWER($2) THEN 1
                 WHEN LOWER(company_name) = LOWER($2 || ' limited') THEN 2
                 WHEN LOWER(company_name) = LOWER($2 || ' ltd') THEN 3
                 WHEN LOWER(company_name) = LOWER($2 || ' private limited') THEN 4
                 WHEN LOWER(company_name) = LOWER($2 || ' pvt ltd') THEN 5
                 WHEN LOWER(company_name) LIKE LOWER($2 || ' %') THEN 6
                 WHEN LOWER(company_name) LIKE LOWER($2 || '%') THEN 7
                 ELSE 8
               END,
               company_name ASC
             LIMIT 1`,
            [searchPattern, aliasPattern]
          );
          if (fallbackRes.rowCount > 0) {
            companyContext.company_category = fallbackRes.rows[0].company_category;
            companyContext.company_other_info = fallbackRes.rows[0].other_info;
          }
        }
      } catch (err) {
        console.warn(`[ELIGIBILITY] bank_company_data lookup warning for ${bankData.bank_name}:`, err.message);
      }
    }

    const bankEvaluation = aggregateBankEvaluations(
      bankData,
      applicant,
      companyContext
    );
    evaluations.push(bankEvaluation);
  }

  return evaluations;
}

/**
 * Retrieves the field requirement profile from active stored bank policies.
 */
async function getActivePolicyRequirements(pool, loanType = "Personal") {
  try {
    const res = await pool.query(
      `SELECT
         COUNT(CASE WHEN pr.min_cibil IS NOT NULL OR pr.max_cibil IS NOT NULL THEN 1 END)::int as cibil_count,
         COUNT(CASE WHEN pr.min_salary IS NOT NULL OR pr.max_salary IS NOT NULL THEN 1 END)::int as salary_count,
         COUNT(CASE WHEN pr.foir_percent IS NOT NULL THEN 1 END)::int as foir_count,
         COUNT(CASE WHEN pr.min_age IS NOT NULL OR pr.max_age IS NOT NULL THEN 1 END)::int as age_count,
         COUNT(CASE WHEN pr.min_loan_amount IS NOT NULL OR pr.max_loan_amount IS NOT NULL THEN 1 END)::int as loan_amount_count,
         COUNT(CASE WHEN pr.min_tenure_months IS NOT NULL OR pr.max_tenure_months IS NOT NULL THEN 1 END)::int as tenure_count,
         COUNT(CASE WHEN pr.employment_type IS NOT NULL AND pr.employment_type != 'Any' THEN 1 END)::int as employment_count,
         COUNT(CASE WHEN (pr.company_rules IS NOT NULL AND (pr.company_rules->>'categories' IS NOT NULL OR pr.company_rules->>'list' IS NOT NULL)) THEN 1 END)::int as company_count,
         COUNT(CASE WHEN (pr.location_rules IS NOT NULL AND (pr.location_rules->>'cities' IS NOT NULL OR pr.location_rules->>'locations' IS NOT NULL OR pr.location_rules->>'pincodes' IS NOT NULL)) THEN 1 END)::int as location_count
       FROM banks b
       JOIN policy_versions pv ON pv.bank_id = b.id
       JOIN policy_rules pr ON pr.policy_version_id = pv.id
       WHERE b.is_active = true
         AND pv.status = 'active'
         AND pr.status IN ('active', 'review')
         AND pr.loan_type = $1`,
      [loanType]
    );

    const row = res.rows[0] || {};
    return {
      requiresIncome: (row.salary_count > 0 || row.foir_count > 0),
      requiresExistingEmi: (row.foir_count > 0),
      requiresLoanAmount: (row.loan_amount_count > 0),
      requiresTenure: (row.tenure_count > 0),
      requiresCibil: (row.cibil_count > 0),
      requiresAge: (row.age_count > 0),
      requiresEmploymentType: (row.employment_count > 0),
      requiresCompany: (row.company_count > 0),
      requiresLocation: (row.location_count > 0)
    };
  } catch (err) {
    console.error("Failed to query policy requirements:", err);
    return {
      requiresIncome: true,
      requiresExistingEmi: true,
      requiresLoanAmount: true,
      requiresTenure: true,
      requiresCibil: true,
      requiresAge: true,
      requiresEmploymentType: true,
      requiresCompany: false,
      requiresLocation: false
    };
  }
}

/**
 * Returns the list of fields currently missing from the applicant payload
 * that are actually required by active stored bank policies.
 */
function getApplicableMissingFields(applicant, policyReqs) {
  const missing = [];

  if (policyReqs.requiresIncome && (applicant.monthlyIncome == null || applicant.monthlyIncome <= 0)) {
    missing.push("monthlyIncome");
  }
  if (policyReqs.requiresExistingEmi && applicant.existingEmi == null) {
    missing.push("existingEmi");
  }
  if (policyReqs.requiresLoanAmount && (applicant.loanAmount == null || applicant.loanAmount <= 0)) {
    missing.push("loanAmount");
  }
  if (policyReqs.requiresTenure && (applicant.tenureMonths == null || applicant.tenureMonths <= 0)) {
    missing.push("tenureMonths");
  }
  if (policyReqs.requiresCibil && applicant.cibil == null) {
    missing.push("cibil");
  }
  if (policyReqs.requiresAge && (applicant.age == null || applicant.age <= 0)) {
    missing.push("age");
  }
  if (policyReqs.requiresEmploymentType && !applicant.employmentType) {
    missing.push("employmentType");
  }
  if (policyReqs.requiresCompany && !applicant.companyName) {
    missing.push("companyName");
  }
  if (policyReqs.requiresLocation && !applicant.location && !applicant.pincode) {
    missing.push("location");
  }

  return missing;
}

const { normalizeCategory } = require("./bankSpecificResolver");
const { getMasterPolicyForBank } = require("./policyAssistantService");

const fs = require('fs');
const path = require('path');

const MASTER_POLICY_DIR = path.join(__dirname, '..', 'policy-master-files');

const BANK_FILE_MAP = {
  2: 'ABFL_Master_Policy.txt',
  3: 'AXIS_Master_Policy.txt',
  4: 'Axis_Finance_Master_Policy.txt',
  5: 'Bajaj_Finserv_Master_Policy.txt',
  6: 'Bajaj_Markets_Master_Policy.txt',
  7: 'Bandhan_Bank_Master_Policy.txt',
  8: 'Chola_Master_Policy.txt',
  9: 'Fibe_Master_Policy.txt',
  10: 'Finnable_Credit_Master_Policy.txt',
  11: 'HDFC_Bank_Master_Policy.txt',
  12: 'Home_Loan_Services_Master_Policy.txt',
  13: 'ICICI_Bank_Master_Policy.txt',
  14: 'IDFC_FIRST_Bank_Master_Policy.txt',
  15: 'IndusInd_Bank_Master_Policy.txt',
  16: 'Kotak_Mahindra_Bank_Master_Policy.txt',
  17: 'LT_Finance_Master_Policy.txt',
  18: 'Piramal_Capital__Housing_Finance_Master_Policy.txt',
  19: 'Poonawalla_Fincorp_Master_Policy.txt',
  20: 'SBM_Bank_India_Master_Policy.txt',
  21: 'SMFG_India_Credit_Fullerton_Master_Policy.txt',
  22: 'Tata_Capital_Master_Policy.txt',
  23: 'Utkarsh_Small_Finance_Bank_Master_Policy.txt',
  24: 'Yes_Bank_Master_Policy.txt',
};

const BANK_NAME_ALIASES = {
  'chola': 'Cholamandalam Investment & Finance',
  'cholamandalam': 'Cholamandalam Investment & Finance',
  'piramal': 'Piramal Capital & Housing Finance',
  'poonawalla': 'Poonawalla Fincorp',
  'fincare': 'Poonawalla Fincorp',
  'axis finance': 'Axis Finance',
  'axis bank': 'Axis Bank',
  'hdfc': 'HDFC Bank',
  'hdfc bank': 'HDFC Bank',
  'icici': 'ICICI Bank',
  'icici bank': 'ICICI Bank',
  'yes bank': 'Yes Bank',
  'kotak': 'Kotak Mahindra Bank',
  'kotak mahindra': 'Kotak Mahindra Bank',
  'indusind': 'IndusInd Bank',
  'indusind bank': 'IndusInd Bank',
  'bajaj': 'Bajaj Finserv',
  'bajaj finserv': 'Bajaj Finserv',
  'bajaj markets': 'Bajaj Markets',
  'idfc': 'IDFC FIRST Bank',
  'idfc first': 'IDFC FIRST Bank',
  'bandhan': 'Bandhan Bank',
  'bandhan bank': 'Bandhan Bank',
  'sbm': 'SBM Bank India',
  'sbm bank': 'SBM Bank India',
  'smfg': 'SMFG India Credit (Fullerton)',
  'fullerton': 'SMFG India Credit (Fullerton)',
  'tata capital': 'Tata Capital',
  'utkarsh': 'Utkarsh Small Finance Bank',
  'l&t': 'L&T Finance',
  'lt finance': 'L&T Finance',
  'fibe': 'Fibe (EarlySalary)',
  'earlysalary': 'Fibe (EarlySalary)',
  'finnable': 'Finnable Credit',
  'home loan services': 'Home Loan Services',
  'abfl': 'Aditya Birla Finance',
  'aditya birla': 'Aditya Birla Finance',
};

function getMasterPolicyTextFromFile(bankId) {
  const fileName = BANK_FILE_MAP[bankId];
  if (!fileName) return null;
  const filePath = path.join(MASTER_POLICY_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function parseIndianNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function isCompanyCategory(category) {
  const lower = String(category || "").toLowerCase().trim();
  const prefixes = [
    'lpc-', 'lps-', 'gov-', 'gdf-', 'rin-', 'hdc-',
    'unc-', 'sch-', 'naf-', 'oth-', 'cat ga', 'cat gb',
    'cat go', 'cat gp', 'cat pen', 'cat ra', 'cat rb',
    'cat rc', 'cat gd', 'cat ge', 'cat gf', 'cat nri'
  ];
  return prefixes.some(p => lower === p || lower.startsWith(p + '-') || lower.startsWith(p + ' '));
}

function findExplicitMapping(lines, category) {
  const lower = String(category || "").toLowerCase().trim();
  const programKeywords = [
    'super cat a', 'super edge', 'bharat program', 'cat a', 'cat b',
    'cat c', 'cat d', 'govt program', 'skilled worker', 'all-in-one',
    '96 month program', '50 lakh program', 'regular'
  ];
  const mappingKeywords = ['maps? to', 'treated as', 'classified as', 'falls under', 'belongs to', 'eligible for', '->', '→'];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (!lowerLine.includes(lower)) continue;

    for (const program of programKeywords) {
      if (!lowerLine.includes(program)) continue;

      const hasMapping = mappingKeywords.some(mk => lowerLine.includes(mk));
      if (!hasMapping) continue;

      const programRegex = new RegExp('(' + program.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i');
      const m = line.match(programRegex);
      if (m) return m[1].toLowerCase().trim();
    }
  }
  return null;
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
  const txtFound = !!getMasterPolicyTextFromFile(bankId);
  let masterPolicy = getMasterPolicyForBank(pool, bankId);
  let extractedText = masterPolicy?.extracted_text;

  if (!extractedText) {
    const fileText = getMasterPolicyTextFromFile(bankId);
    if (fileText) {
      extractedText = fileText;
    }
  }

  if (!extractedText) {
    return { txtFound: false, plSectionFound: false, categorySectionFound: false, missingFields: [], rule: null, error: "TXT file not found for bank_id=" + bankId };
  }

  const text = String(extractedText);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const catLower = String(category).toLowerCase().trim();
  const catWords = catLower.split(/\s+/).filter(w => w.length > 2);
  if (catWords.length === 0) {
    catLower.split(/\s+/).forEach(w => { if (w.length > 0) catWords.push(w); });
  }

  const CATEGORY_ALIAS_PATTERNS = {
    'super a': /super\s*(?:cat\s*)?a\b/i,
    'super cat a': /super\s*(?:cat\s*)?a\b/i,
    'super a/b': /super\s*(?:cat\s*)?a\b/i,
    'super a / b': /super\s*(?:cat\s*)?a\b/i,
    'super a/cat a/govt': /super\s*(?:cat\s*)?a\b/i,
    'cat super a': /super\s*(?:cat\s*)?a\b/i,
    'diamond': /\bdiamond\b/i,
    'platinum': /\bplatinum\b/i,
    'gold': /\bgold\b/i,
    'silver': /\bsilver\b/i,
    'bronze': /\bbronze\b/i,
    'blue': /\bblue\b/i,
    'normal': /\bnormal\b/i,
    'elite': /\belite\b/i,
    'cat a': /\bcat\s*a\b|\bcategory\s*a\b/i,
    'cat b': /\bcat\s*b\b|\bcategory\s*b\b/i,
    'cat c': /\bcat\s*c\b|\bcategory\s*c\b/i,
    'cat d': /\bcat\s*d\b|\bcategory\s*d\b/i,
    'cat e': /\bcat\s*e\b|\bcategory\s*e\b/i,
    'cat f': /\bcat\s*f\b|\bcategory\s*f\b/i,
    'lpc-a': /\blpc[\s-]*a\b/i,
    'lpcb': /\blpcb\b/i,
    'cat ga': /\bga\b/i,
    'cat gb': /\bgb\b/i,
    'cat go': /\bgo\b/i,
    'cat gp': /\bgp\b/i,
    'cat pen': /\bpen\b/i,
    'cat ra': /\bra\b/i,
    'cat rb': /\brb\b/i,
    'cat rc': /\brc\b/i,
    'cat gd': /\bgd\b/i,
    'cat ge': /\bge\b/i,
    'cat gf': /\bgf\b/i,
    'cat nri': /\bnri\b/i,
    'cat hdfc': /\bcat\s*hdfc\b/i,
    'super a/cat a': /super\s*(?:cat\s*)?a\b/i,
    'super a/cat a/govt': /super\s*(?:cat\s*)?a\b/i,
    'govt': /\bgovt\b|\bgovernment\b/i,
    'psu/govt': /\bpsu\b|\bgovt\b|\bgovernment\b/i,
    'self-employed': /\bself.?employed\b/i,
    'mnc': /\bmnc\b/i,
    'private limited': /\bprivate\s+limited\b/i,
    'startup': /\bstartup\b/i,
    'special': /\bspecial\b/i,
     '-1 cibil': /-1\s*cibil/i,
  };

  function getPlSectionRanges(lines) {
    const nonPlMarkers = [
      'bt / ccbt / app loan',
      'ccbt',
      'bt surrogate',
      'app loan rules',
      'credit card bt'
    ];

    const ranges = [];
    let currentStart = 0;
    let inPl = true;

    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      const isHeader = /^={3,}|^#{1,3}\s/.test(lines[i]);

      if (isHeader) {
        const isNonPl = nonPlMarkers.some(m => lower.includes(m));
        if (isNonPl && inPl) {
          if (i > currentStart) ranges.push({ start: currentStart, end: i });
          inPl = false;
        } else if (!isNonPl && !inPl) {
          inPl = true;
          currentStart = i;
        }
      }
    }

    if (inPl && lines.length > currentStart) {
      ranges.push({ start: currentStart, end: lines.length });
    }

    return ranges;
  }

  function findCategorySection(searchLower, searchWords) {
    let categoryIdx = -1;
    let categoryEnd = lines.length;

    const aliasPattern = CATEGORY_ALIAS_PATTERNS[searchLower.replace(/\s+/g, ' ')];
    const searchRegex = aliasPattern || (searchWords.length > 0
      ? new RegExp(searchWords.map(w => '\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').join('.*'), 'i')
      : new RegExp('\\b' + searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));

    const allCategoryMarkers = [
      'company/employer categories',
      'company categories',
      'employer categories',
      'category-wise',
      'category wise',
    ];
    const categoriesHeaderIdx = lines.findIndex(l => allCategoryMarkers.some(m => l.toLowerCase().includes(m)));

    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      if (searchRegex.test(lines[i])) {
        candidates.push(i);
      }
    }

    if (candidates.length > 0) {
      if (categoriesHeaderIdx >= 0) {
        const inCatSection = candidates.filter(i => i >= categoriesHeaderIdx);
        if (inCatSection.length > 0) {
          categoryIdx = inCatSection[0];
        }
      }
      if (categoryIdx === -1) {
        const preferred = candidates.filter(i => /^-\s|^\s*-\s|cat|category|elite|diamond|platinum|gold|silver|bronze|super|lpc/i.test(lines[i].toLowerCase()));
        categoryIdx = preferred.length > 0 ? preferred[0] : candidates[0];
      }
    }

    if (categoryIdx >= 0) {
      for (let i = categoryIdx + 1; i < lines.length; i++) {
        if (/^={3,}|^#{1,3}\s/.test(lines[i])) {
          categoryEnd = i;
          break;
        }
      }
      return { start: categoryIdx, end: categoryEnd, found: true, aliasMatch: !!aliasPattern, categoriesHeaderIdx };
    }

    return { start: -1, end: lines.length, found: false, categoriesHeaderIdx };
  }

   const plRanges = getPlSectionRanges(lines);
   const plSectionFound = plRanges.length > 0;
   const companyCategory = isCompanyCategory(category);
   let explicitMapping = null;
   if (companyCategory) {
    explicitMapping = findExplicitMapping(lines, category);
   }

   let effectiveLower = catLower;
   let effectiveWords = catWords;
   let effectiveCategory = category;

   if (companyCategory && explicitMapping) {
    effectiveCategory = explicitMapping;
    effectiveLower = explicitMapping.toLowerCase().trim();
    effectiveWords = effectiveLower.split(/\s+/).filter(w => w.length > 2);
    if (effectiveWords.length === 0) {
      effectiveLower.split(/\s+/).forEach(w => { if (w.length > 0) effectiveWords.push(w); });
    }
    console.log("[EXTRACT] Bank " + bankId + " (" + category + ") explicit program mapping -> " + effectiveCategory);
   } else if (companyCategory && !explicitMapping) {
    console.log("[EXTRACT] Bank " + bankId + " (" + category + ") company category with NO explicit program mapping");
   }

   const categorySection = findCategorySection(effectiveLower, effectiveWords);
   let categoryContextLines = [];
   let commonContextLines = [];
   const allowCommonFallback = !(companyCategory && !explicitMapping);

   if (categorySection.found) {
      categoryContextLines = lines.slice(categorySection.start, categorySection.end);
      console.log("[EXTRACT] Bank " + bankId + " (" + category + ")[" + effectiveCategory + "] category section at lines " + categorySection.start + "-" + categorySection.end);
    } else {
      console.log("[EXTRACT] Bank " + bankId + " (" + category + ")[" + effectiveCategory + "] category section NOT found, will use common Personal Loan rules");
    }

   const nonPlLineIndices = new Set();
   let inNonPlSection = false;
   for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      const isHeader = /^={3,}|^#{1,3}\s/.test(lines[i]);
      if (isHeader) {
        const isNonPl = ['bt / ccbt / app loan', 'ccbt', 'bt surrogate', 'app loan rules', 'credit card bt'].some(m => lower.includes(m));
        if (isNonPl) inNonPlSection = true;
        else inNonPlSection = false;
      }
      if (inNonPlSection) nonPlLineIndices.add(i);
    }

    const categoriesHeaderIdx = categorySection.categoriesHeaderIdx;

    if (categoriesHeaderIdx >= 0) {
      const nextHeaderIdx = lines.slice(categoriesHeaderIdx + 1).findIndex(l => /^={3,}|^#{1,3}\s|^\d+\)/.test(l));
      const catSectionEnd = nextHeaderIdx >= 0 ? categoriesHeaderIdx + 1 + nextHeaderIdx : lines.length;

      const allLinesExceptCategory = [];
      for (let i = 0; i < lines.length; i++) {
        if (categorySection.found && i >= categorySection.start && i < categorySection.end) {
          continue;
        }
        if (i >= categoriesHeaderIdx && i < catSectionEnd) {
          continue;
        }
        if (nonPlLineIndices.has(i)) {
          continue;
        }
        allLinesExceptCategory.push(lines[i]);
      }
      commonContextLines = allLinesExceptCategory.length > 0 ? allLinesExceptCategory : lines;
      console.log("[EXTRACT] Bank " + bankId + " common PL context: " + commonContextLines.length + " lines (excl categories + BT/CCBT)");
    } else {
      commonContextLines = [];
      for (let i = 0; i < lines.length; i++) {
        if (categorySection.found && i >= categorySection.start && i < categorySection.end) {
          continue;
        }
        if (nonPlLineIndices.has(i)) {
          continue;
        }
        commonContextLines.push(lines[i]);
      }
      console.log("[EXTRACT] Bank " + bankId + " common PL context (no categories header): " + commonContextLines.length + " lines");
    }

    if (commonContextLines.length === 0 && lines.length > 0 && allowCommonFallback) {
      commonContextLines = lines.filter((_, i) => !nonPlLineIndices.has(i));
    }

  const rule = {
    category: category,
    employment_type: "Salaried",
    source: "master_policy"
  };

  const extractionLog = [];

   function parseUnitValue(raw, sourceLine) {
    const parsed = parseIndianNumber(raw);
    if (parsed == null) return null;

    const lower = sourceLine.toLowerCase();

    const rawStr = String(raw).toLowerCase();

    const rawIdx = lower.indexOf(rawStr);
    if (rawIdx >= 0) {
      const afterRaw = lower.substring(rawIdx + rawStr.length, rawIdx + rawStr.length + 8);
      if (/\bcrore?\b|\bcr\b/i.test(afterRaw)) {
        return parsed * 10000000;
      }
      if (/\blac?h?s?\b|\blakhs?\b/i.test(afterRaw)) {
        return parsed * 100000;
      }
      if (/\bthousand\b|\bk\b/i.test(afterRaw)) {
        return parsed * 1000;
      }
      const beforeRaw = lower.substring(Math.max(0, rawIdx - 8), rawIdx);
      if (/\bcrore?\b|\bcr\b/i.test(beforeRaw)) {
        return parsed * 10000000;
      }
      if (/\blac?h?s?\b|\blakhs?\b/i.test(beforeRaw)) {
        return parsed * 100000;
      }
      if (/\bthousand\b|\bk\b/i.test(beforeRaw)) {
        return parsed * 1000;
      }
    }

    return parsed;
  }

  function looksLikeMonetarySalaryLine(value, sourceLine) {
    if (value == null || isNaN(Number(value))) return false;
    if (Number(value) < 1000) return false;
    const lower = String(sourceLine || "").toLowerCase();
    const hasMonetaryIndicator = /[₹]|\bRs\b|\blakh\b|\blac\b|\b[kK]\b|\d+[kK]|\bthousand\b|\bcrore\b|\bcr\b|\bnth\b|\bnmi\b|\bnet\s+monthly\b|\bnet\s+take\s+home\b|\bminimum\s+salary\b|\bmin\s+salary\b|\bsalary\s*:\s*[₹\s]*[\d,]/i.test(lower);
    return hasMonetaryIndicator;
  }

  function extractFromLines(fieldName, patterns, contextLines, validator) {
    for (const line of contextLines) {
      const lower = line.toLowerCase();
      for (const pattern of patterns) {
        const match = lower.match(pattern);
        if (match) {
          const raw = match[1] || match[2] || match[3] || match[4] || match[5];
          const parsed = parseUnitValue(raw, line);
          if (parsed != null) {
            if (validator && !validator(parsed, line)) {
              continue;
            }
            extractionLog.push({ field: fieldName, value: parsed, sourceLine: line });
            return parsed;
          }
        }
      }
    }
    return null;
  }

  function extractRawNumber(fieldName, patterns, contextLines) {
    for (const line of contextLines) {
      const lower = line.toLowerCase();
      for (const pattern of patterns) {
        const match = lower.match(pattern);
        if (match) {
          const raw = match[1] || match[2] || match[3] || match[4] || match[5];
          const parsed = parseIndianNumber(raw);
          if (parsed != null) {
            extractionLog.push({ field: fieldName, value: parsed, sourceLine: line });
            return parsed;
          }
        }
      }
    }
    return null;
  }

  function extractField(fieldName, patterns, useRaw, allowCommonFallback = true, validator) {
    const catResult = useRaw
      ? extractRawNumber(fieldName, patterns, categoryContextLines)
      : extractFromLines(fieldName, patterns, categoryContextLines, validator);
    if (catResult != null) return catResult;

    if (!allowCommonFallback) {
      extractionLog.push({ field: fieldName, value: null, sourceLine: null });
      return null;
    }

    const commonResult = useRaw
      ? extractRawNumber(fieldName, patterns, commonContextLines)
      : extractFromLines(fieldName, patterns, commonContextLines, validator);
    if (commonResult != null) return commonResult;

    extractionLog.push({ field: fieldName, value: null, sourceLine: null });
    return null;
  }

   rule.min_cibil = extractField('min_cibil', [
     /minimum\s+cibil[^\d]{0,30}(\d{3})/i,
     /min\s+cibil[^\d]{0,30}(\d{3})/i,
     /cibil[^\d]{0,10}(\d{3})/i,
     /credit\s+score[^\d]{0,10}(\d{3})/i,
     /bureau[^\d]{0,10}(\d{3})/i
   ], false, allowCommonFallback);

   rule.min_age = extractField('min_age', [
     /minimum\s+age[^\d]{0,30}(\d+)/i,
     /min\s+age[^\d]{0,30}(\d+)/i,
     /minimum\s+applicant[^\d]{0,30}(\d+)\s*years/i
   ], false, allowCommonFallback);

   rule.max_age = extractField('max_age', [
     /maximum\s+age[^\d]{0,30}(\d+)/i,
     /max\s+age[^\d]{0,30}(\d+)/i,
     /retirement[^\d]{0,30}(\d+)/i,
     /maximum\s+age[^\d]{0,30}(\d+)\s*years/i
   ], false, allowCommonFallback);

    rule.max_loan_amount = extractField('max_loan_amount', [
      /maximum\s+funding[^\d]{0,30}([\d,]+)\s*(?:lakh|lac|lakhs|cr|crore)/i,
      /max\s+funding[^\d]{0,30}([\d,]+)\s*(?:lakh|lac|lakhs|cr|crore)/i,
      /maximum\s+loan[^\d]{0,30}([\d,]+)\s*(?:lakh|lac|lakhs|cr|crore)/i,
      /max\s+loan[^\d]{0,30}([\d,]+)\s*(?:lakh|lac|lakhs|cr|crore)/i,
      /capping[^\d]{0,30}([\d,]+)\s*(?:lakh|lac|lakhs|cr|crore)/i,
      /upto[^\d]{0,30}[₹\s]*([\d,]+)\s*(?:lakh|lac|lakhs|cr|crore)/i,
      /maximum\s+loan[^\d]{0,30}[₹\s]*([\d,]+)\s*lakhs/i,
      /max\s+loan[^\d]{0,30}[₹\s]*([\d,]+)\s*lakhs/i,
      /loan[^\d]{0,30}[₹\s]*([\d,]+)\s*lakhs/i,
      /maximum\s+loan[^\d]{0,30}([\d,]+)\s*lac/i,
      /up\s*to\s+[₹\s]*([\d,]+)\s*lac/i,
      /up\s*to\s+[₹\s]*([\d,]+)\s*lakh/i,
      /capping[^\d]{0,30}[₹\s]*([\d,]+)\s*(?:lakh|lac|lakhs|cr|crore)/i,
      /capping[^\d]{0,30}([\d,]+)\s*lac/i,
      /loan\s+amount[^\d]{0,30}:\s*[\d,]*\s*lac\s*to\s*([₹\s]*[\d,]+)\s*lac/i,
      /loan\s+amount[^\d]{0,30}:\s*[\d,]*\s*lac\s*to\s*([₹\s]*[\d,]+)\s*lakhs/i,
      /loan\s+amount[^\d]{0,30}([\d,]+)\s*lac\s*to\s*([\d,]+)\s*lac/i,
      /maximum[^\d]{0,30}[₹\s]*([\d,]+)\s*[kK]\b/i,
      /capping[^\d]{0,30}[₹\s]*([\d,]+)\s*[kK]\b/i,
      /upto[^\d]{0,30}[₹\s]*([\d,]+)\s*[kK]\b/i,
      /loan\s+(?:amount|max)[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*[kK]\b/i,
      /max[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lakh/i,
      /loan\s+amount[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lakh/i,
      /₹\s*([\d,]+\.?\d*)\s*lakh/i,
      /₹\s*([\d,]+\.?\d*)\s*lac/i,
      /₹\s*([\d,]+\.?\d*)\s*lakhs/i,
      /₹\s*([\d,]+\.?\d*)\s*lacs/i,
      /₹\s*([\d,]+\.?\d*)\s*crore/i,
      /₹\s*([\d,]+\.?\d*)\s*cr\b/i,
      /fund[^a-z\s]*([\d,]+\.?\d*)\s*lakh/i,
      /loan[^a-z\s]{0,30}([\d,]+\.?\d*)\s*lakh/i
    ], false, allowCommonFallback);

   rule.min_loan_amount = extractField('min_loan_amount', [
     /minimum\s+loan[^\d]{0,30}([\d,]+)\s*(?:lakh|lac|lakhs)/i,
     /min\s+loan[^\d]{0,30}([\d,]+)\s*(?:lakh|lac|lakhs)/i,
     /minimum\s+loan[^\d]{0,30}[₹\s]*([\d,]+)/i,
     /min\s+loan[^\d]{0,30}[₹\s]*([\d,]+)/i,
     /loan\s+amount[^\d]{0,30}:\s*([₹\s]*[\d,]+)\s*lac\s*to/i,
     /loan\s+amount[^\d]{0,30}:\s*([₹\s]*[\d,]+)\s*lakhs/i,
     /^\s*-\s*minimum:\s*[₹\s]*([\d,]+)/i
   ], false, allowCommonFallback);

   const tenureRaw = extractField('max_tenure_months', [
      /tenure[^\d]{0,30}upto[^\d]{0,30}(\d+)\s*years/i,
      /tenure[^\d]{0,30}upto[^\d]{0,30}(\d+)\s*months/i,
      /tenure[^\d]{0,30}max[^\d]{0,30}(\d+)\s*years/i,
      /tenure[^\d]{0,30}max[^\d]{0,30}(\d+)\s*months/i,
      /tenure[^\d]{0,30}(\d+)\s*years/i,
      /tenure[^\d]{0,30}(\d+)\s*months/i,
      /tenure[^\d]{0,30}(\d+)\s*yrs/i,
      /tenure[^\d]{0,30}:\s*\d+\s*to\s*(\d+)\s*month/i,
      /tenure[^\d]{0,30}:\s*\d+\s*to\s*(\d+)\s*year/i,
      /(\d+)\s*months\s+for\s+/i,
      /(\d+)\s*years\s+for\s+/i
    ], true, allowCommonFallback);

   if (tenureRaw != null) {
     const sourceLine = extractionLog.find(e => e.field === 'max_tenure_months')?.sourceLine || '';
     const hasYearContext = /year|yrs?\b/.test(sourceLine.toLowerCase());
     rule.max_tenure_months = hasYearContext ? tenureRaw * 12 : tenureRaw;
   }

   if (bankId === 11 && /super\s*a/i.test(String(category))) {
     const superATenures = [];
     for (const line of lines) {
       const m = line.match(/(\d+)\s*months\s+for\s+super\s*a/i);
       if (m) superATenures.push(parseInt(m[1], 10));
     }
     if (superATenures.length > 0) {
       const maxSuperA = Math.max(...superATenures);
       if (rule.max_tenure_months == null || maxSuperA > rule.max_tenure_months) {
         rule.max_tenure_months = maxSuperA;
         console.log("[EXTRACT] HDFC Super A: adjusted max_tenure_months to " + maxSuperA + " months (highest for Super A)");
       }
     }
   }

   rule.foir_percent = extractField('foir_percent', [
     /foir[^\d]{0,30}(\d+)\s*%/i,
     /obligation[^\d]{0,30}(\d+)\s*%/i,
     /max\s+foir[^\d]{0,30}(\d+)/i,
     /maximum\s+foir[^\d]{0,30}(\d+)/i,
     /foir[^\d]{0,30}(\d+)\s*(?:per\s+cent|percent)?/i,
     /dbr[^\d]{0,30}(\d+)\s*%/i
   ], false, allowCommonFallback);

      rule.min_salary = extractField('min_salary', [
        /([\d,]+\.?\d*)\s*lakh[^\d]{0,20}salary/i,
        /[₹\s]*([\d,]+\.?\d*)[^\d]{0,20}salary/i,
        /minimum\s+(?:net\s+monthly\s+)?salary[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lakh/i,
        /min\s+(?:net\s+monthly\s+)?salary[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lakh/i,
        /minimum\s+(?:net\s+monthly\s+)?salary[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lac/i,
        /min\s+(?:net\s+monthly\s+)?salary[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lac/i,
        /minimum\s+(?:net\s+monthly\s+)?salary[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)/i,
        /min\s+(?:net\s+monthly\s+)?salary[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)/i,
        /nth[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lakh/i,
        /nth[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lac/i,
        /nth[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)/i,
        /nmi[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lakh/i,
        /nmi[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lac/i,
        /nmi[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)/i,
        /salary[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lakh/i,
        /salary[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lac/i,
        /salary[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)/i,
        /income[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lakh/i,
        /income[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)\s*lac/i,
        /income[^\d]{0,30}[₹\s]*([\d,]+\.?\d*)/i,
        /rs[^\d]{0,5}([\d,]+\.?\d*)\s*\/-/i,
        /salary[^\d]{0,30}([\d,]+\.?\d*)\s*\/-/i,
        /required[^\d]{0,30}([\d,]+\.?\d*)\s*\/-\s*(?:own|house)/i,
        /for[^\d]{0,30}(?:partnership|proprietor)[^\d]*([\d,]+\.?\d*)\s*\/-/i
      ], false, allowCommonFallback, looksLikeMonetarySalaryLine);

  console.log("[EXTRACT] Bank " + bankId + " (" + category + ") section lines " + (categorySection.found ? categorySection.start + "-" + categorySection.end : "N/A") + ":");
  extractionLog.forEach(entry => {
    if (entry.value != null) {
      console.log("[EXTRACT]   " + entry.field + " = " + entry.value + " (from: " + (entry.sourceLine ? entry.sourceLine.substring(0, 60) : "null") + ")");
    } else {
      console.log("[EXTRACT]   " + entry.field + " = MISSING");
    }
  });

    const mandatoryFields = ['max_age', 'max_loan_amount', 'max_tenure_months', 'foir_percent', 'min_salary'];
    const missingMandatory = mandatoryFields.filter(f => rule[f] == null);

   const extractionStatus = missingMandatory.length > 0 ? 'FAILED' : 'PASSED';

   console.log("[EXTRACT] === FINAL MERGED RULE for Bank " + bankId + " (" + category + ") ===");
   console.log("[EXTRACT]   Status: " + extractionStatus + (missingMandatory.length > 0 ? " (missing: " + missingMandatory.join(', ') + ")" : " (all mandatory fields present)"));
   console.log("[EXTRACT]   category: " + (rule.category || 'N/A'));
   console.log("[EXTRACT]   employment_type: " + (rule.employment_type || 'N/A'));
   console.log("[EXTRACT]   min_cibil: " + (rule.min_cibil != null ? rule.min_cibil : 'N/A'));
   console.log("[EXTRACT]   min_age: " + (rule.min_age != null ? rule.min_age : 'N/A'));
   console.log("[EXTRACT]   max_age: " + (rule.max_age != null ? rule.max_age : 'N/A'));
   console.log("[EXTRACT]   max_loan_amount: " + (rule.max_loan_amount != null ? rule.max_loan_amount : 'N/A'));
   console.log("[EXTRACT]   min_loan_amount: " + (rule.min_loan_amount != null ? rule.min_loan_amount : 'N/A (optional)'));
   console.log("[EXTRACT]   max_tenure_months: " + (rule.max_tenure_months != null ? rule.max_tenure_months : 'N/A'));
   console.log("[EXTRACT]   foir_percent: " + (rule.foir_percent != null ? rule.foir_percent : 'N/A'));
   console.log("[EXTRACT]   min_salary: " + (rule.min_salary != null ? rule.min_salary : 'N/A'));
   console.log("[EXTRACT]   Source: " + (categorySection.found ? 'category-context + common' : 'common-only'));
   console.log("[EXTRACT] === END FINAL MERGED RULE ===");

     if (missingMandatory.length > 0) {
       console.log("[EXTRACT] Bank " + bankId + " (" + category + ") FAILED: missing mandatory fields: " + missingMandatory.join(', '));
       return { txtFound, plSectionFound, categorySectionFound: categorySection.found, missingFields: missingMandatory, rule, error: "Incomplete extraction: missing " + missingMandatory.join(', ') };
     }

     console.log("[EXTRACT] Bank " + bankId + " (" + category + ") PASSED all mandatory checks");
     return { txtFound, plSectionFound, categorySectionFound: categorySection.found, missingFields: [], rule, error: null };
  }
async function evaluateWithBankSpecificCategories(pool, applicant) {
  /**
   * COMPANY-RECORDS-FIRST ELIGIBILITY ENGINE:
   * 
   * For each bank, this function:
   * 1. Uses company_records to find which banks SUPPORT the user's company
   * 2. Gets the exact bank-specific category from company_records
   * 3. Evaluates ONLY that exact category's rules (CIBIL, salary, age, loan amount, tenure, FOIR)
   * 4. Does NOT evaluate banks that don't have the company in company_records
   * 5. Does NOT map Salaried users to Self-Employed or PSU/Govt unless policy explicitly says so
   * 
   * KEY RULES:
   * - Employment type matching is STRICT: Salaried does not match Self-Employed or PSU/Govt
   * - Only evaluates banks explicitly listed in company_records for the given company
   * - Each category has its own set of rules; we evaluate only the resolved category
   */
  if (!pool || !applicant?.companyName) {
    return [];
  }

  const evaluations = [];

  try {
    const normalizedCompany = String(applicant.companyName || '').replace(/\s+/g, ' ').trim();
    console.log("[HANDOFF] COMPANY: " + normalizedCompany);

     const companyRes = await pool.query(
       `SELECT DISTINCT cr.bank_name, cr.company_category
        FROM company_records cr
        WHERE LOWER(TRIM(cr.company_name)) = LOWER(TRIM($1))
        ORDER BY cr.bank_name`,
       [normalizedCompany]
     );

     console.log("[HANDOFF] Raw company_records rows: " + companyRes.rowCount);
     companyRes.rows.forEach(r => {
       console.log("[HANDOFF]   RAW: bank=" + r.bank_name + " | category=" + r.company_category);
     });

      const banksRes = await pool.query(
        `SELECT DISTINCT b.id AS bank_id, b.name AS bank_name, b.code AS bank_code
         FROM banks b
         WHERE b.is_active = true
           AND (
             EXISTS (
               SELECT 1
               FROM policy_versions pv
               JOIN policy_rules pr ON pr.policy_version_id = pv.id
               WHERE pv.bank_id = b.id
                 AND pv.status = 'active'
                 AND pr.loan_type = 'Personal'
                 AND pr.status IN ('active', 'review')
             )
             OR EXISTS (
               SELECT 1
               FROM bank_policy_files bpf
               WHERE bpf.bank_id = b.id
                 AND (bpf.metadata->>'is_master_policy')::boolean = true
             )
           )
         ORDER BY b.name ASC`
      );

      const allBanks = banksRes.rows;
      const banksMap = new Map();
      const bankAliasMap = new Map();

      for (const bank of allBanks) {
        const normBankName = bank.bank_name.toLowerCase().trim();
        banksMap.set(normBankName, bank);
        if (bank.code) {
          banksMap.set(bank.code.toLowerCase().trim(), bank);
        }
      }

      for (const [alias, targetName] of Object.entries(BANK_NAME_ALIASES)) {
        const targetBank = allBanks.find(b => b.bank_name.toLowerCase().trim() === targetName.toLowerCase().trim());
        if (targetBank) {
          bankAliasMap.set(alias, targetBank);
        }
      }

      const bankRecordsMap = new Map();

      for (const bank of allBanks) {
        bankRecordsMap.set(bank.bank_id, { bank, categories: new Set(), rawCategories: [] });
      }

      for (const record of companyRes.rows) {
        const recordBankName = String(record.bank_name || '').trim();
        const recordBankLower = recordBankName.toLowerCase();
        let bank = banksMap.get(recordBankLower) || bankAliasMap.get(recordBankLower);

        if (!bank) {
          const firstWord = recordBankLower.split(/[^a-z0-9]+/).filter(w => w.length > 0)[0];
          if (firstWord) {
            bank = banksMap.get(firstWord) || bankAliasMap.get(firstWord);
          }
        }

        if (!bank) {
          for (const [alias, candidate] of bankAliasMap.entries()) {
            if (recordBankLower.includes(alias) || alias.includes(recordBankLower)) {
              bank = candidate;
              break;
            }
          }
        }

        if (!bank) {
          console.log("[HANDOFF]   SKIP unmapped bank: " + recordBankName);
          continue;
        }

        const rawCategory = record.company_category;
        const category = rawCategory ? normalizeCategory(String(rawCategory)) : null;

        console.log("[HANDOFF]   MAP: " + normalizedCompany + " → " + recordBankName + " → " + (category || 'null') + " → bank_id=" + bank.bank_id + " → TXT=" + (BANK_FILE_MAP[bank.bank_id] || 'not mapped'));

        const entry = bankRecordsMap.get(bank.bank_id);
        if (category) {
          entry.categories.add(category);
          entry.rawCategories.push({ raw: rawCategory, normalized: category });
        }
      }

      for (const [bankId, entry] of bankRecordsMap) {
        const bank = entry.bank;
        const uniqueCategories = [...entry.categories];

        if (uniqueCategories.length === 0) {
          const masterPolicyText = getMasterPolicyTextFromFile(bank.bank_id);
          let mappedCategory = null;

          if (masterPolicyText) {
            const lines = masterPolicyText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const lowerCompany = normalizedCompany.toLowerCase();
            const companyWords = lowerCompany.split(/\s+/).filter(w => w.length > 2);
            const companyRegex = companyWords.length > 0
              ? new RegExp(companyWords.map(w => '\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').join('.*'), 'i')
              : new RegExp('\\b' + lowerCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');

            for (const line of lines) {
              if (!companyRegex.test(line)) continue;
              const categoryMatch = line.match(/(?:category|program|maps?\s+to|treated\s+as|classified\s+as|falls\s+under|belongs\s+to|eligible\s+for)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\s\-]+?)(?:\s*[.,;]|$)/i);
              if (categoryMatch) {
                mappedCategory = normalizeCategory(categoryMatch[1].trim());
                break;
              }
            }

            if (!mappedCategory) {
              const explicitMapping = findExplicitMapping(lines, normalizedCompany);
              if (explicitMapping) {
                mappedCategory = normalizeCategory(explicitMapping);
              }
            }
          }

          if (mappedCategory) {
            entry.categories.add(mappedCategory);
            entry.rawCategories.push({ raw: mappedCategory, normalized: mappedCategory });
            console.log("[HANDOFF]   MASTER POLICY MAPPING: " + normalizedCompany + " → " + mappedCategory + " → bank_id=" + bank.bank_id);
          }
        }
      }

     for (const [bankId, entry] of bankRecordsMap) {
       const bank = entry.bank;
       const uniqueCategories = [...entry.categories];

       if (uniqueCategories.length === 0) {
         evaluations.push({
           bank: bank.bank_name,
           bank_id: bank.bank_id,
           bank_code: bank.bank_code,
           loan_type: "Personal",
           program: "Personal Loan",
           status: "NEEDS_REVIEW",
           matched_rule: "Category Not Resolved",
           policy_version: "N/A",
           checks: [],
           missing_fields: ["company_category"],
           failure_reasons: [],
           review_reasons: [
             `Company "${applicant.companyName}" is not listed in ${bank.bank_name} company records and no verified category mapping was found in the bank's Personal Loan master policy`
           ],
           offered_terms: {},
           source: null,
           all_sources: [],
           category: null,
           resolution_status: "needs_review"
         });
         continue;
       }

      if (uniqueCategories.length > 1) {
        evaluations.push({
          bank: bank.bank_name,
          bank_id: bank.bank_id,
          bank_code: bank.bank_code,
          loan_type: "Personal",
          program: "Personal Loan",
          status: "NEEDS_REVIEW",
          matched_rule: "Conflicting Categories",
          policy_version: "N/A",
          checks: [],
          missing_fields: ["company_category"],
          failure_reasons: [],
          review_reasons: [
            `Company "${applicant.companyName}" has multiple categories in ${bank.bank_name} company records: ${uniqueCategories.join(', ')}`
          ],
          offered_terms: {},
          source: null,
          all_sources: [],
          category: null,
          resolution_status: "needs_review"
        });
        continue;
      }

      const category = uniqueCategories[0];

      console.log("[EVAL] Bank: " + bank.bank_name + " | Category: " + category + " | TXT: " + (BANK_FILE_MAP[bank.bank_id] || 'not mapped'));

      let rules = [];
      try {
        const result = await pool.query(
          `SELECT
             b.id AS bank_id,
             b.name AS bank_name,
             b.code AS bank_code,
             pv.id AS policy_version_id,
             pv.version AS policy_version,
             pv.status AS version_status,
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
             pr.status AS rule_status,
             pa.file_name AS source_file_name,
             pa.file_path AS source_file_path,
             ps.file_name AS policy_source_file
           FROM banks b
           JOIN policy_versions pv ON pv.bank_id = b.id
           JOIN policy_rules pr ON pr.policy_version_id = pv.id
           LEFT JOIN policy_attachments pa ON pa.policy_rule_id = pr.id
           LEFT JOIN policy_sources ps ON ps.id = pv.source_id
           WHERE b.id = $1
             AND pv.status = 'active'
             AND pr.status IN ('active', 'review')
             AND pr.loan_type = $2
             AND LOWER(TRIM(pr.category)) = LOWER(TRIM($3))
           ORDER BY pr.id DESC`,
          [bank.bank_id, "Personal", category]
        );

        console.log("[EVAL] Bank " + bank.bank_name + " DB rules found: " + result.rows.length);
        rules = result.rows;
      } catch (err) {
        console.error("Failed to load policy rules for " + bank.bank_name + " category " + category + ":", err);
        evaluations.push({
          bank: bank.bank_name,
          bank_id: bank.bank_id,
          bank_code: bank.bank_code,
          loan_type: "Personal",
          program: "Personal Loan",
          status: "NEEDS_REVIEW",
          matched_rule: `Rule Query Failed for Category: ${category}`,
          policy_version: "N/A",
          checks: [],
          missing_fields: ["policy_rules"],
          failure_reasons: [],
          review_reasons: [`Unable to load policy rules for category "${category}" in ${bank.bank_name}`],
          offered_terms: {},
          source: null,
          all_sources: [],
          category: category,
          resolution_status: "resolved",
          resolution_category: category
        });
        continue;
      }

      if (!rules.length) {
        let extractionResult = null;
        try {
          extractionResult = await extractRuleFromMasterPolicy(pool, bank.bank_id, category);
        } catch (err) {
          console.warn("[MASTER_POLICY_FALLBACK] Failed to extract rules for " + bank.bank_name + ":", err.message);
          extractionResult = { txtFound: false, plSectionFound: false, categorySectionFound: false, missingFields: [], rule: null, error: err.message };
        }

        console.log("[TXT_EVAL] Bank=" + bank.bank_name + " | Category=" + category + " | TXT=" + (BANK_FILE_MAP[bank.bank_id] || 'not mapped') + " | txtFound=" + (extractionResult?.txtFound ?? false) + " | plSectionFound=" + (extractionResult?.plSectionFound ?? false) + " | categorySectionFound=" + (extractionResult?.categorySectionFound ?? false) + " | rule_created=" + (extractionResult?.rule != null) + " | missingFields=" + JSON.stringify(extractionResult?.missingFields ?? []) + " | error=" + (extractionResult?.error ?? null));

        const syntheticRule = extractionResult?.rule || null;
        const txtExisted = extractionResult?.txtFound || false;
        const missingMandatory = extractionResult?.missingFields || [];

        if (syntheticRule) {
          const mandatoryFields = ['max_age', 'max_loan_amount', 'max_tenure_months', 'foir_percent', 'min_salary'];
          const ruleMissing = mandatoryFields.filter(f => syntheticRule[f] == null);

          if (ruleMissing.length > 0) {
            evaluations.push({
              bank: bank.bank_name,
              bank_id: bank.bank_id,
              bank_code: bank.bank_code,
              loan_type: "Personal",
              program: "Personal Loan",
              status: "NEEDS_REVIEW",
              matched_rule: `Incomplete Policy Data for Category: ${category}`,
              policy_version: "Master Policy",
              checks: [],
              missing_fields: ruleMissing,
              failure_reasons: [],
              review_reasons: [
                `Master policy for ${bank.bank_name} category "${category}" is missing required fields: ${ruleMissing.join(', ')}`,
                `TXT file: ${txtExisted ? 'found' : 'not found'} | PL section: ${extractionResult?.plSectionFound ? 'found' : 'not found'} | Category section: ${extractionResult?.categorySectionFound ? 'found' : 'not found'}`
              ],
              offered_terms: {},
              source: null,
              all_sources: [],
              category: category,
              resolution_status: "resolved",
              resolution_category: category
            });
            continue;
          }

          rules = [{
            ...syntheticRule,
            bank_id: bank.bank_id,
            bank_name: bank.bank_name,
            bank_code: bank.bank_code,
            id: `master-${bank.bank_id}-${category}`,
            loan_type: "Personal",
            policy_version: "Master Policy",
            version_status: "active",
            rule_status: "active",
            source_file_name: "Master Policy TXT",
            source_file_path: null,
            policy_source_file: "Master Policy"
          }];

          console.log("[TXT_RULE] Bank=" + bank.bank_name + " | Category=" + category + " | Merged Rule: " +
            "min_cibil=" + (syntheticRule.min_cibil != null ? syntheticRule.min_cibil : 'N/A') +
            " | min_age=" + (syntheticRule.min_age != null ? syntheticRule.min_age : 'N/A') +
            " | max_age=" + (syntheticRule.max_age != null ? syntheticRule.max_age : 'N/A') +
            " | max_loan_amount=" + (syntheticRule.max_loan_amount != null ? syntheticRule.max_loan_amount : 'N/A') +
            " | min_loan_amount=" + (syntheticRule.min_loan_amount != null ? syntheticRule.min_loan_amount : 'N/A') +
            " | max_tenure_months=" + (syntheticRule.max_tenure_months != null ? syntheticRule.max_tenure_months : 'N/A') +
            " | foir_percent=" + (syntheticRule.foir_percent != null ? syntheticRule.foir_percent : 'N/A') +
            " | min_salary=" + (syntheticRule.min_salary != null ? syntheticRule.min_salary : 'N/A'));
        } else {
          if (txtExisted) {
            evaluations.push({
              bank: bank.bank_name,
              bank_id: bank.bank_id,
              bank_code: bank.bank_code,
              loan_type: "Personal",
              program: "Personal Loan",
              status: "NEEDS_REVIEW",
              matched_rule: `Incomplete Policy Data for Category: ${category}`,
              policy_version: "Master Policy",
              checks: [],
              missing_fields: missingMandatory.length > 0 ? missingMandatory : ["policy_rules"],
              failure_reasons: [],
              review_reasons: [
                `Master policy TXT exists for ${bank.bank_name} but no structured rule object was produced for category "${category}"`,
                ...(missingMandatory.length > 0 ? [`Parser fields that could not be extracted: ${missingMandatory.join(', ')}`] : []),
                `TXT file: found | PL section: ${extractionResult?.plSectionFound ? 'found' : 'not found'} | Category section: ${extractionResult?.categorySectionFound ? 'found' : 'not found'}`
              ],
              offered_terms: {},
              source: null,
              all_sources: [],
              category: category,
              resolution_status: "resolved",
              resolution_category: category
            });
          } else {
            evaluations.push({
              bank: bank.bank_name,
              bank_id: bank.bank_id,
              bank_code: bank.bank_code,
              loan_type: "Personal",
              program: "Personal Loan",
              status: "NEEDS_REVIEW",
              matched_rule: `No Applicable Policy for Category: ${category}`,
              policy_version: "N/A",
              checks: [],
              missing_fields: ["policy_rules"],
              failure_reasons: [],
              review_reasons: [
                `No active policy rules found for category "${category}" in ${bank.bank_name}`,
                "Master policy TXT file does not exist for this bank"
              ],
              offered_terms: {},
              source: null,
              all_sources: [],
              category: category,
              resolution_status: "resolved",
              resolution_category: category
            });
          }
          continue;
        }
      }

      const bankData = {
        bank_id: bank.bank_id,
        bank_name: bank.bank_name,
        bank_code: bank.bank_code,
        rules: rules
      };

      let bankEvaluation;
      try {
        bankEvaluation = aggregateBankEvaluations(bankData, applicant, { company_category: category });
      } catch (err) {
        console.error(`Failed to evaluate bank ${bank.bank_name} for category ${category}:`, err);
        evaluations.push({
          bank: bank.bank_name,
          bank_id: bank.bank_id,
          bank_code: bank.bank_code,
          loan_type: "Personal",
          program: "Personal Loan",
          status: "NEEDS_REVIEW",
          matched_rule: `Evaluation Failed for Category: ${category}`,
          policy_version: "N/A",
          checks: [],
          missing_fields: ["evaluation"],
          failure_reasons: [],
          review_reasons: [`Policy evaluation failed for category "${category}" in ${bank.bank_name}`],
          offered_terms: {},
          source: null,
          all_sources: [],
          category: category,
          resolution_status: "resolved",
          resolution_category: category
        });
        continue;
      }

      console.log("[EVAL] Bank " + bank.bank_name + " final status: " + bankEvaluation.status);

      if (bankEvaluation.status !== "ELIGIBLE") {
        const failedChecks = (bankEvaluation.checks || []).filter(c => c.result === "fail");
        const reviewChecks = (bankEvaluation.checks || []).filter(c => c.result === "review");
        if (failedChecks.length > 0) {
          console.log("[EVAL] " + bank.bank_name + " FAILED ELIGIBILITY CHECKS:");
          failedChecks.forEach(c => {
            console.log("[EVAL]   " + c.criterion + ": required=" + c.required + " actual=" + c.actual + " detail=" + c.detail);
          });
        }
        if (reviewChecks.length > 0) {
          console.log("[EVAL] " + bank.bank_name + " REVIEW CHECKS:");
          reviewChecks.forEach(c => {
            console.log("[EVAL]   " + c.criterion + ": required=" + c.required + " actual=" + c.actual + " detail=" + c.detail);
          });
        }
      }

      bankEvaluation.program = "Personal Loan";
      bankEvaluation.category = category;
      bankEvaluation.resolution_status = "resolved";
      bankEvaluation.resolution_category = category;

      evaluations.push(bankEvaluation);
    }
  } catch (err) {
    console.error("Failed to evaluate with company records:", err);
    return [];
  }

  evaluations.sort((a, b) => {
    const statusOrder = { "ELIGIBLE": 0, "NEEDS_REVIEW": 1, "NOT_ELIGIBLE": 2 };
    return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
  });

  return evaluations;
}

module.exports = {
  buildPolicyChecks,
  evaluateApplicantAgainstPolicies,
  evaluateWithBankSpecificCategories,
  getActivePolicyRequirements,
  getApplicableMissingFields,
  extractRuleFromMasterPolicy
};