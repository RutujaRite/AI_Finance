type Applicant = Record<string, any>;

type PolicyCheck = {
  criterion: string;
  result: string;
  actual?: string | number;
  required?: string | number;
};

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildPolicyChecks(rule: any, applicant: Applicant, context: any = {}) {
  const checks: PolicyCheck[] = [];
  const missingFields: string[] = [];
  const failureReasons: string[] = [];
  const reviewReasons: string[] = [];

  const requiredFields = [
    "cibil",
    "monthlyIncome",
    "existingEmi",
    "age",
    "employmentType",
    "loanAmount",
    "tenureMonths",
  ];

  for (const field of requiredFields) {
    if (applicant[field] === undefined || applicant[field] === null || applicant[field] === "") {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      status: "NEEDS_REVIEW",
      checks,
      missing_fields: missingFields,
      review_reasons: missingFields.map((f) => `Missing required field: ${f}`),
      failure_reasons: [],
      offered_terms: {
        roi: rule?.roi ?? null,
        max_loan_amount: rule?.max_loan_amount ?? null,
        max_tenure_months: rule?.max_tenure_months ?? null,
        foir_percent: rule?.foir_percent ?? null,
      },
      source: rule,
    };
  }

  const cibilValue = normalizeNumber(applicant.cibil);
  const minCibil = normalizeNumber(rule?.min_cibil);
  const maxCibil = normalizeNumber(rule?.max_cibil);
  if (cibilValue !== null) {
    const pass = (minCibil === null || cibilValue >= minCibil) && (maxCibil === null || cibilValue <= maxCibil);
    checks.push({ criterion: "CIBIL", result: pass ? "pass" : "fail", actual: cibilValue, required: `${minCibil ?? ""} - ${maxCibil ?? ""}`.replace(/\s*-\s*$/, "") });
    if (!pass) failureReasons.push(`CIBIL ${cibilValue} does not meet required range.`);
  }

  const salaryValue = normalizeNumber(applicant.monthlyIncome);
  const minSalary = normalizeNumber(rule?.min_salary);
  const maxSalary = normalizeNumber(rule?.max_salary);
  if (salaryValue !== null) {
    const pass = (minSalary === null || salaryValue >= minSalary) && (maxSalary === null || salaryValue <= maxSalary);
    checks.push({ criterion: "Salary", result: pass ? "pass" : "fail", actual: salaryValue, required: `${minSalary ?? ""} - ${maxSalary ?? ""}`.replace(/\s*-\s*$/, "") });
    if (!pass) failureReasons.push(`Monthly salary ${salaryValue} is outside the allowed range.`);
  }

  const ageValue = normalizeNumber(applicant.age);
  const minAge = normalizeNumber(rule?.min_age);
  const maxAge = normalizeNumber(rule?.max_age);
  if (ageValue !== null) {
    const pass = (minAge === null || ageValue >= minAge) && (maxAge === null || ageValue <= maxAge);
    checks.push({ criterion: "Age", result: pass ? "pass" : "fail", actual: ageValue, required: `${minAge ?? ""} - ${maxAge ?? ""}`.replace(/\s*-\s*$/, "") });
    if (!pass) failureReasons.push(`Age ${ageValue} is outside the valid working age range.`);
  }

  const employmentType = String(applicant.employmentType || "").toLowerCase();
  const allowedEmployment = String(rule?.employment_type || "").toLowerCase();
  if (employmentType) {
    const pass = !allowedEmployment || employmentType.includes(allowedEmployment.toLowerCase()) || allowedEmployment.includes(employmentType);
    checks.push({ criterion: "Employment", result: pass ? "pass" : "fail", actual: employmentType, required: allowedEmployment || "Any" });
    if (!pass) failureReasons.push(`Employment type ${applicant.employmentType} is not allowed for this rule.`);
  }

  const existingEmi = normalizeNumber(applicant.existingEmi) ?? 0;
  const salaryForFoir = salaryValue ?? 0;
  const foirPercent = normalizeNumber(rule?.foir_percent) ?? 0;
  const foirActual = salaryForFoir > 0 ? (existingEmi / salaryForFoir) * 100 : 0;
  const foirPass = foirActual <= foirPercent;
  checks.push({ criterion: "FOIR", result: foirPass ? "pass" : "fail", actual: `${foirActual.toFixed(1)}%`, required: `${foirPercent}%` });
  if (!foirPass) failureReasons.push(`FOIR ${foirActual.toFixed(1)}% exceeds max allowable FOIR ${foirPercent}%.`);

  const companyName = String(applicant.companyName || "");
  const companyRules = rule?.company_rules || {};
  if (companyName) {
    const categories = Array.isArray(companyRules.categories) ? companyRules.categories.map((c: any) => String(c).toLowerCase()) : [];
    const companyMatches = companyName.toLowerCase();
    const pass = categories.length === 0 || categories.some((entry: string) => companyMatches.includes(entry));
    checks.push({ criterion: "Company/Category", result: pass ? "pass" : "review", actual: companyName, required: categories.join(", ") || "Any" });
    if (!pass) reviewReasons.push(`Company category could not be confidently matched.`);
  }

  const location = String(applicant.location || "").toLowerCase();
  const locationRules = rule?.location_rules || {};
  const allowedLocations = Array.isArray(locationRules.locations) ? locationRules.locations.map((l: any) => String(l).toLowerCase()) : [];
  const allowedPincodes = Array.isArray(locationRules.pincodes) ? locationRules.pincodes.map((p: any) => String(p)) : [];
  const pincode = applicant.pincode ? String(applicant.pincode) : null;
  const locationPass = (!allowedLocations.length && !allowedPincodes.length) || (location && allowedLocations.includes(location)) || (pincode && allowedPincodes.includes(pincode));
  checks.push({ criterion: "Location/Pincode", result: locationPass ? "pass" : "fail", actual: location || pincode || "Not specified", required: [...allowedLocations, ...allowedPincodes].join(", ") || "Any" });
  if (!locationPass) failureReasons.push(`Location/pincode is not eligible under the active policy.`);

  const status = failureReasons.length > 0 ? "NOT_ELIGIBLE" : reviewReasons.length > 0 ? "NEEDS_REVIEW" : "ELIGIBLE";

  return {
    status,
    checks,
    missing_fields: [],
    review_reasons: reviewReasons,
    failure_reasons: failureReasons,
    offered_terms: {
      roi: rule?.roi ?? null,
      max_loan_amount: rule?.max_loan_amount ?? null,
      max_tenure_months: rule?.max_tenure_months ?? null,
      foir_percent: rule?.foir_percent ?? null,
      processing_fee_percent: rule?.processing_fee_percent ?? null,
      processing_fee_flat: rule?.processing_fee_flat ?? null,
    },
    source: rule,
    bank: rule?.bank_name || rule?.bank || "Bank",
    category: rule?.category ?? context?.company_category ?? null,
  };
}

async function evaluateApplicantAgainstPolicies(pool: any, applicant: Applicant) {
  if (!pool || !pool.query) return [];

  try {
    const result = await pool.query(`SELECT * FROM policy_rules WHERE status = 'ACTIVE' LIMIT 50`);
    return (result.rows || []).map((rule: any) => buildPolicyChecks(rule, applicant, {}));
  } catch (error) {
    console.warn("Unable to evaluate policies:", error);
    return [];
  }
}

function getActivePolicyRequirements() {
  return {
    requiredFields: ["companyName", "employmentType", "monthlyIncome", "cibil", "existingEmi", "loanAmount", "tenureMonths", "age"],
  };
}

function getApplicableMissingFields(applicant: Applicant) {
  const required = getActivePolicyRequirements().requiredFields;
  return required.filter((field) => applicant[field] === undefined || applicant[field] === null || applicant[field] === "");
}

const eligibilityService = {
  buildPolicyChecks,
  evaluateApplicantAgainstPolicies,
  getActivePolicyRequirements,
  getApplicableMissingFields,
};

export {
  buildPolicyChecks,
  evaluateApplicantAgainstPolicies,
  getActivePolicyRequirements,
  getApplicableMissingFields,
};

export default eligibilityService;
