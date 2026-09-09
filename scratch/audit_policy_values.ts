import fs from "fs";
import path from "path";
import { getAllMasterPolicies } from "../lib/masterPolicies";
import { getBankRulesForCategory } from "../lib/masterPolicyParser";

function auditAllPolicies() {
  const policies = getAllMasterPolicies();
  console.log(`Found ${policies.length} master policies to audit.\n`);

  for (const p of policies) {
    const filePath = path.join(process.cwd(), "policy-master-files", p.file_name);
    if (!fs.existsSync(filePath)) {
      console.error(`[ERROR] File missing: ${p.file_name}`);
      continue;
    }
    const content = fs.readFileSync(filePath, "utf-8");

    console.log(`================================================================================`);
    console.log(`🏦 BANK: ${p.bank_name} (${p.bank_code}) -> File: ${p.file_name} (${content.length} chars)`);

    // Test rules for Tier 1 and Standard
    const ruleTier1 = getBankRulesForCategory(p.bank_name, "Tier 1 Corporate");
    const ruleStandard = getBankRulesForCategory(p.bank_name, "Standard Corporate");

    console.log(`  • Tier 1 Rules:`);
    console.log(`      Salary: ₹${ruleTier1?.minSalary} | CIBIL: ${ruleTier1?.minCibil} | Age: ${ruleTier1?.minAge}-${ruleTier1?.maxAge} | Loan: ₹${ruleTier1?.minLoanAmount}-₹${ruleTier1?.maxLoanAmount} | Tenure: ${ruleTier1?.minTenureMonths}-${ruleTier1?.maxTenureMonths}m | FOIR: ${ruleTier1?.foirPercent}% | ROI: ${ruleTier1?.roi}% | Fee: ${ruleTier1?.processingFeePercent}%`);

    console.log(`  • Standard Rules:`);
    console.log(`      Salary: ₹${ruleStandard?.minSalary} | CIBIL: ${ruleStandard?.minCibil} | Age: ${ruleStandard?.minAge}-${ruleStandard?.maxAge} | Loan: ₹${ruleStandard?.minLoanAmount}-₹${ruleStandard?.maxLoanAmount} | Tenure: ${ruleStandard?.minTenureMonths}-${ruleStandard?.maxTenureMonths}m | FOIR: ${ruleStandard?.foirPercent}% | ROI: ${ruleStandard?.roi}% | Fee: ${ruleStandard?.processingFeePercent}%`);

    // Check occurrences in text
    const hasSalaryInText = content.includes(String(ruleTier1?.minSalary)) || content.includes(String(ruleStandard?.minSalary));
    const hasCibilInText = content.includes(String(ruleTier1?.minCibil));
    const hasAgeInText = content.includes(String(ruleTier1?.minAge));
    const hasRoiInText = content.includes(String(ruleTier1?.roi)) || content.includes(String(ruleStandard?.roi));

    console.log(`  • Content matches in text file:`);
    console.log(`      Salary found: ${hasSalaryInText} | CIBIL found: ${hasCibilInText} | Age found: ${hasAgeInText} | ROI found: ${hasRoiInText}`);
  }
}

auditAllPolicies();
