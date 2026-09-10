const fs = require('fs');
const path = require('path');
const policyDir = path.join(__dirname, '..', 'policy-master-files');

const banks = [
  { key: "abfl", name: "Aditya Birla Finance", file: "ABFL_Master_Policy.txt" },
  { key: "axis", name: "Axis Bank", file: "AXIS_Master_Policy.txt" },
  { key: "axisfinance", name: "Axis Finance", file: "Axis_Finance_Master_Policy.txt" },
  { key: "bajajfinserv", name: "Bajaj Finserv", file: "Bajaj_Finserv_Master_Policy.txt" },
  { key: "bajajmarkets", name: "Bajaj Markets", file: "Bajaj_Markets_Master_Policy.txt" },
  { key: "bandhan", name: "Bandhan Bank", file: "Bandhan_Bank_Master_Policy.txt" },
  { key: "chola", name: "Cholamandalam Investment & Finance", file: "Chola_Master_Policy.txt" },
  { key: "fibe", name: "Fibe (EarlySalary)", file: "Fibe_Master_Policy.txt" },
  { key: "finnable", name: "Finnable Credit", file: "Finnable_Credit_Master_Policy.txt" },
  { key: "hdfc", name: "HDFC Bank", file: "HDFC_Bank_Master_Policy_CIBIL_Updated.txt" },
  { key: "homeloan", name: "Home Loan Services", file: "home_loan_eligibility_policy_rules.txt" },
  { key: "icici", name: "ICICI Bank", file: "ICICI_Bank_Personal_Loan_Policy_Rulebook.txt" },
  { key: "idfc", name: "IDFC FIRST Bank", file: "IDFC_FIRST_Bank_Master_Policy.txt" },
  { key: "indusind", name: "IndusInd Bank", file: "IndusInd_Bank_Master_Policy.txt" },
  { key: "kotak", name: "Kotak Mahindra Bank", file: "Kotak_Mahindra_Bank_Master_Policy.txt" },
  { key: "ltfinance", name: "L&T Finance", file: "LT_Finance_Master_Policy_Clean.txt" },
  { key: "piramal", name: "Piramal Capital & Housing Finance", file: "Piramal_Capital__Housing_Finance_Master_Policy.txt" },
  { key: "poonawalla", name: "Poonawalla Fincorp", file: "Poonawalla_Fincorp_Master_Policy.txt" },
  { key: "sbm", name: "SBM Bank India", file: "SBM_Bank_India_Master_Policy_Clean.txt" },
  { key: "smfg", name: "SMFG India Credit (Fullerton)", file: "SMFG_India_Credit_Fullerton_Master_Policy_Clean.txt" },
  { key: "tatacapital", name: "Tata Capital", file: "Tata_Capital_Master_Policy_Clean.txt" },
  { key: "utkarsh", name: "Utkarsh Small Finance Bank", file: "Utkarsh_Small_Finance_Bank_Master_Policy_Clean.txt" },
  { key: "yesbank", name: "Yes Bank", file: "Yes_Bank_Master_Policy.txt" }
];

console.log("Analyzing all banks...\n");

for (const b of banks) {
  const filePath = path.join(policyDir, b.file);
  if (!fs.existsSync(filePath)) {
    console.log(`[MISSING] ${b.name}: ${b.file}`);
    continue;
  }
  const text = fs.readFileSync(filePath, 'utf-8');
  console.log(`================================================================`);
  console.log(`🏦 ${b.name} (${b.file})`);

  // Print lines with CIBIL or score
  const cibilLines = text.split('\n').filter(l => /cibil|credit\s*score|scorecard|bureau/i.test(l) && !/inquir|bounce|dpd/i.test(l));
  console.log(`  [CIBIL]:`);
  cibilLines.slice(0, 5).forEach(l => console.log(`    ${l.trim()}`));

  // Print lines with Tenure or Tenor
  const tenureLines = text.split('\n').filter(l => /tenure|tenor/i.test(l));
  console.log(`  [TENURE]:`);
  tenureLines.slice(0, 5).forEach(l => console.log(`    ${l.trim()}`));
}
