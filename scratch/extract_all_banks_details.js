const fs = require('fs');
const path = require('path');

const policyDir = path.join(__dirname, '..', 'policy-master-files');
const files = [
  "ABFL_Master_Policy.txt",
  "AXIS_Master_Policy.txt",
  "Axis_Finance_Master_Policy.txt",
  "Bajaj_Finserv_Master_Policy.txt",
  "Bajaj_Markets_Master_Policy.txt",
  "Bandhan_Bank_Master_Policy.txt",
  "Chola_Master_Policy.txt",
  "Fibe_Master_Policy.txt",
  "Finnable_Credit_Master_Policy.txt",
  "HDFC_Bank_Master_Policy_CIBIL_Updated.txt",
  "home_loan_eligibility_policy_rules.txt",
  "ICICI_Bank_Personal_Loan_Policy_Rulebook.txt",
  "IDFC_FIRST_Bank_Master_Policy.txt",
  "IndusInd_Bank_Master_Policy.txt",
  "Kotak_Mahindra_Bank_Master_Policy.txt",
  "LT_Finance_Master_Policy_Clean.txt",
  "Piramal_Capital__Housing_Finance_Master_Policy.txt",
  "Poonawalla_Fincorp_Master_Policy.txt",
  "SBM_Bank_India_Master_Policy_Clean.txt",
  "SMFG_India_Credit_Fullerton_Master_Policy_Clean.txt",
  "Tata_Capital_Master_Policy_Clean.txt",
  "Utkarsh_Small_Finance_Bank_Master_Policy_Clean.txt",
  "Yes_Bank_Master_Policy.txt"
];

const results = [];

for (const f of files) {
  const filePath = path.join(policyDir, f);
  if (!fs.existsSync(filePath)) {
    results.push({ file: f, error: 'File not found' });
    continue;
  }
  const text = fs.readFileSync(filePath, 'utf-8');
  
  // Find all lines with CIBIL or score
  const cibilLines = text.split('\n')
    .map((l, i) => ({ line: i + 1, text: l.trim() }))
    .filter(x => /cibil|credit\s*score|scorecard|bureau/i.test(x.text) && !/enquir|bounce|dpd/i.test(x.text));

  // Find all lines with Tenure or Tenor
  const tenureLines = text.split('\n')
    .map((l, i) => ({ line: i + 1, text: l.trim() }))
    .filter(x => /(?:tenure|tenor)\b/i.test(x.text));

  results.push({
    file: f,
    cibilLines: cibilLines.slice(0, 15),
    tenureLines: tenureLines.slice(0, 15)
  });
}

fs.writeFileSync(path.join(__dirname, 'detailed_cibil_tenure.json'), JSON.stringify(results, null, 2), 'utf-8');
console.log('Done writing detailed_cibil_tenure.json');
