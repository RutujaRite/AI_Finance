const fs = require("fs");
const path = require("path");

const dir = path.join(process.cwd(), "policy-master-files");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".txt"));

console.log(`Total files: ${files.length}`);

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), "utf-8");
  console.log(`\n==================================================`);
  console.log(`FILE: ${file} (${content.length} chars)`);
  
  // Look for CIBIL mentions
  const cibilMatches = content.match(/(?:cibil|score|bureau)[^\n]{0,80}/gi) || [];
  // Look for Salary / NTH mentions
  const salaryMatches = content.match(/(?:salary|nth|net monthly|income)[^\n]{0,80}/gi) || [];
  // Look for Age mentions
  const ageMatches = content.match(/(?:age)[^\n]{0,80}/gi) || [];
  // Look for Loan Amount mentions
  const loanMatches = content.match(/(?:loan amount|max fund|max loan|min loan)[^\n]{0,80}/gi) || [];
  // Look for Tenure mentions
  const tenureMatches = content.match(/(?:tenure|months)[^\n]{0,80}/gi) || [];
  // Look for FOIR mentions
  const foirMatches = content.match(/(?:foir)[^\n]{0,80}/gi) || [];
  // Look for ROI mentions
  const roiMatches = content.match(/(?:roi|rate|interest|pricing)[^\n]{0,80}/gi) || [];

  console.log(`- CIBIL matches (${cibilMatches.length}):`, cibilMatches.slice(0, 3).map(s => s.trim()));
  console.log(`- Salary matches (${salaryMatches.length}):`, salaryMatches.slice(0, 3).map(s => s.trim()));
  console.log(`- Age matches (${ageMatches.length}):`, ageMatches.slice(0, 3).map(s => s.trim()));
  console.log(`- Loan Amount matches (${loanMatches.length}):`, loanMatches.slice(0, 3).map(s => s.trim()));
  console.log(`- FOIR matches (${foirMatches.length}):`, foirMatches.slice(0, 3).map(s => s.trim()));
  console.log(`- ROI matches (${roiMatches.length}):`, roiMatches.slice(0, 3).map(s => s.trim()));
}
