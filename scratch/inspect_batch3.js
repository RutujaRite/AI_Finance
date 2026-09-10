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

const filesBatch3 = [
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

for (const f of filesBatch3) {
  inspectBank(f, [/cibil/i, /scorecard/i, /tenure/i, /tenor/i]);
}
