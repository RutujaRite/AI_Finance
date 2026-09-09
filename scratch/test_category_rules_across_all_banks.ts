import { getAllMasterPolicies } from "../lib/masterPolicies";
import { getBankRulesForCategory } from "../lib/masterPolicyParser";

const categoriesToTest = [
  { name: "Tier 1 / Super A", catAxis: "CAT Super A", catHdfc: "CAT Super A", catKotak: "CAT A", catIdfc: "CAT SA", catSbm: "Listed Company", catSmfg: "Private Ltd / Public Ltd / Government", catTata: "Super CAT A" },
  { name: "Tier 2 / Cat B", catAxis: "CAT B", catHdfc: "CAT B", catKotak: "CAT B", catIdfc: "CAT B", catSbm: "Non-Listed Company", catSmfg: "LLP / Proprietorship / Partnership", catTata: "CAT B" },
  { name: "Government", catAxis: "Government / Public Sector", catHdfc: "CAT GA", catKotak: "Government", catIdfc: "Government cases", catSbm: "Government", catSmfg: "Government", catTata: "Government Employee" },
  { name: "Standard / Open Market", catAxis: "Open Market", catHdfc: "CAT D", catKotak: "CAT C", catIdfc: "CAT D", catSbm: "Non-Listed Company", catSmfg: "LLP", catTata: "Unapproved Company" },
];

const allPolicies = getAllMasterPolicies();
console.log(`Auditing ${allPolicies.length} partner bank policies across 4 category tiers...\n`);

let anyErrors = false;

for (const tier of categoriesToTest) {
  console.log(`========================================================================`);
  console.log(`TESTING CATEGORY TIER: ${tier.name}`);
  console.log(`========================================================================`);

  for (const b of allPolicies) {
    let specificCat: string = tier.name;
    const s = b.bank_code.toLowerCase();
    if (s.includes("axis")) specificCat = tier.catAxis;
    else if (s.includes("hdfc")) specificCat = tier.catHdfc;
    else if (s.includes("kotak")) specificCat = tier.catKotak;
    else if (s.includes("idfc")) specificCat = tier.catIdfc;
    else if (s.includes("sbm")) specificCat = tier.catSbm;
    else if (s.includes("smfg")) specificCat = tier.catSmfg;
    else if (s.includes("tata")) specificCat = tier.catTata;

    const rule = getBankRulesForCategory(b.bank_name, specificCat, "Personal Loan");
    if (!rule) {
      console.error(`❌ [${b.bank_name}] FAILED TO LOAD RULE for category: ${specificCat}`);
      anyErrors = true;
      continue;
    }

    const issues: string[] = [];
    if (!rule.minSalary || rule.minSalary <= 0) issues.push(`minSalary invalid: ${rule.minSalary}`);
    if (!rule.minCibil || rule.minCibil <= 0) issues.push(`minCibil invalid: ${rule.minCibil}`);
    if (!rule.minAge || rule.minAge <= 0) issues.push(`minAge invalid: ${rule.minAge}`);
    if (!rule.maxAge || rule.maxAge <= rule.minAge) issues.push(`maxAge invalid: ${rule.maxAge}`);
    if (!rule.minLoanAmount || rule.minLoanAmount <= 0) issues.push(`minLoanAmount invalid: ${rule.minLoanAmount}`);
    if (!rule.maxLoanAmount || rule.maxLoanAmount < rule.minLoanAmount) issues.push(`maxLoanAmount invalid: ${rule.maxLoanAmount}`);
    if (!rule.minTenureMonths || rule.minTenureMonths <= 0) issues.push(`minTenureMonths invalid: ${rule.minTenureMonths}`);
    if (!rule.maxTenureMonths || rule.maxTenureMonths < rule.minTenureMonths) issues.push(`maxTenureMonths invalid: ${rule.maxTenureMonths}`);
    if (!rule.foirPercent || rule.foirPercent <= 0) issues.push(`foirPercent invalid: ${rule.foirPercent}`);
    if (!rule.roi || rule.roi <= 0) issues.push(`roi invalid: ${rule.roi}`);

    if (issues.length > 0) {
      console.error(`❌ [${b.bank_name}] Issues: ${issues.join(", ")}`);
      anyErrors = true;
    } else {
      console.log(`✓ [${b.bank_name}] Cat: ${rule.resolvedCategory} | Sal: ₹${rule.minSalary} | CIBIL: ${rule.minCibil} | Loan: ₹${rule.minLoanAmount}-₹${rule.maxLoanAmount} | Tenure: ${rule.minTenureMonths}-${rule.maxTenureMonths}m | FOIR: ${rule.foirPercent}% | ROI: ${rule.roi}%`);
    }
  }
}

if (!anyErrors) {
  console.log("\n✅ ALL BANK RULES RETURN COMPLETE, NON-EMPTY POLICY RULES!");
} else {
  console.log("\n❌ SOME RULES ARE INCOMPLETE OR FAILED TO LOAD.");
}
