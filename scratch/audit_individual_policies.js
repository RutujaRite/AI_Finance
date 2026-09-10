const fs = require('fs');
const path = require('path');
const policyDir = path.join(__dirname, '..', 'policy-master-files');

function dumpLines(fname, re) {
  const p = path.join(policyDir, fname);
  const text = fs.readFileSync(p, 'utf-8');
  console.log(`\n======================================================`);
  console.log(`FILE: ${fname}`);
  const lines = text.split('\n');
  lines.forEach((l, i) => {
    if (re.test(l)) {
      console.log(`L${i+1}: ${l.trim()}`);
    }
  });
}

dumpLines("Fibe_Master_Policy.txt", /cibil|tenure|tenor/i);
dumpLines("Finnable_Credit_Master_Policy.txt", /cibil|tenure|tenor/i);
dumpLines("IndusInd_Bank_Master_Policy.txt", /tenure|tenor/i);
dumpLines("Kotak_Mahindra_Bank_Master_Policy.txt", /cibil\s*score|tenure/i);
dumpLines("Piramal_Capital__Housing_Finance_Master_Policy.txt", /cibil|tenure|tenor/i);
dumpLines("Utkarsh_Small_Finance_Bank_Master_Policy_Clean.txt", /cibil|tenure|tenor/i);
