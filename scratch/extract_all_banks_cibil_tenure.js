const fs = require('fs');
const path = require('path');
const policyDir = path.join(__dirname, '..', 'policy-master-files');

const files = fs.readdirSync(policyDir).filter(f => f.endsWith('.txt')).sort();

const summary = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(policyDir, file), 'utf-8');
  const lines = content.split('\n');

  // Let's find CIBIL cutoffs
  const cibilInfo = [];
  const tenureInfo = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/cibil|credit\s*score|scorecard|bureau/i.test(l)) {
      if (/(?:minimum|min|cutoff|>=|>|allowed|band|\d{3})/i.test(l) && !/inquir|bounce|dpd|charge/i.test(l)) {
        cibilInfo.push(`L${i+1}: ${l}`);
      }
    }
    if (/(?:tenure|tenor)\b/i.test(l)) {
      if (/(?:month|year|min|max|up to|\d+)/i.test(l) && !/enquir|bounce/i.test(l)) {
        tenureInfo.push(`L${i+1}: ${l}`);
      }
    }
  }

  summary.push({
    file,
    cibilInfo,
    tenureInfo
  });
}

fs.writeFileSync(path.join(__dirname, 'all_banks_cibil_tenure_extracted.json'), JSON.stringify(summary, null, 2), 'utf-8');
console.log('Saved all_banks_cibil_tenure_extracted.json');
