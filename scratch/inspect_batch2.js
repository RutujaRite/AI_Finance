const fs = require('fs');
const path = require('path');
const policyDir = path.join(__dirname, '..', 'policy-master-files');

function inspectBank(fileName, keywords) {
  const p = path.join(policyDir, fileName);
  if (!fs.existsSync(p)) {
    console.log(`[NOT FOUND] ${fileName}`);
    return;
  }
  const text = fs.readFileSync(p, 'utf-8');
  console.log(`\n================================================================`);
  console.log(`FILE: ${fileName}`);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (keywords.some(k => k.test(line))) {
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length - 1, i + 4);
      console.log(`--- Match at line ${i+1}:`);
      for (let j = start; j <= end; j++) {
        console.log(`  ${j+1}: ${lines[j]}`);
      }
      i = end;
    }
  }
}

const filesBatch2 = [
  "Fibe_Master_Policy.txt",
  "Finnable_Credit_Master_Policy.txt",
  "HDFC_Bank_Master_Policy_CIBIL_Updated.txt",
  "home_loan_eligibility_policy_rules.txt",
  "ICICI_Bank_Personal_Loan_Policy_Rulebook.txt",
  "IDFC_FIRST_Bank_Master_Policy.txt",
  "IndusInd_Bank_Master_Policy.txt"
];

for (const f of filesBatch2) {
  inspectBank(f, [/cibil/i, /scorecard/i, /tenure/i, /tenor/i]);
}
