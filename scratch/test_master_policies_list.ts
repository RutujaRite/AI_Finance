import { getAllMasterPolicies } from "../lib/masterPolicies";
import { getAllBankRulesForCategory } from "../lib/masterPolicyParser";

const policies = getAllMasterPolicies();
console.log("Total Master Policies registered:", policies.length);
policies.forEach((p, i) => {
  console.log(`${i + 1}. [ID: ${p.bank_id}] ${p.bank_name} (${p.bank_code}) -> ${p.file_name} | Loan: ${p.loan_type} | Supported: ${p.supported_loan_types?.join(", ")}`);
});

console.log("\n=== TESTING getBankRulesForCategory FOR TATA CONSULTANCY SERVICES (Super A) ===");
const rules = getAllBankRulesForCategory({
  searchedName: "Tata Consultancy Services",
  matchedName: "Tata Consultancy Services Ltd",
  isFound: true,
  overallCategoryTier: "Tier 1 / Super A",
  overallCategoryDisplay: "Tier 1 / Super A",
  bankCategories: {
    hdfc: "CAT Super A",
    icici: "Top Corporate",
    axis: "CAT Super A",
    kotak: "CAT A",
    bajaj: "Super A",
    tatacapital: "Super CAT A",
    idfc: "CAT SA",
    abfl: "Cat Super A"
  },
  rawRecords: []
});

console.log(`\nReturned rules count: ${rules.length}`);
rules.forEach((r, idx) => {
  console.log(`[${idx + 1}] ${r.bankName}: Category: ${r.resolvedCategory} | MinSal: ₹${r.minSalary} | CIBIL: ${r.minCibil} | Age: ${r.minAge}-${r.maxAge} | Loan: ₹${r.minLoanAmount}-₹${r.maxLoanAmount} | Tenure: ${r.minTenureMonths}-${r.maxTenureMonths}m | FOIR: ${r.foirPercent}% | ROI: ${r.roi}%`);
});
