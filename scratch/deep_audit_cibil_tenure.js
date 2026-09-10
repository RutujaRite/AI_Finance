const fs = require('fs');
const path = require('path');

const policyDir = path.join(__dirname, '..', 'policy-master-files');
const files = fs.readdirSync(policyDir).filter(f => f.endsWith('.txt'));

console.log(`Auditing ${files.length} policy files for CIBIL and Tenure:\n`);

for (const file of files) {
  const content = fs.readFileSync(path.join(policyDir, file), 'utf-8');
  console.log(`======================================================================`);
  console.log(`FILE: ${file}`);
  
  // Find lines or sections about CIBIL
  const lines = content.split('\n');
  const cibilMatches = [];
  const tenureMatches = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/(?:cibil|credit\s*score|bureau\s*score|score\s*cutoff|minimum\s*score)/i.test(line)) {
      cibilMatches.push(`L${i+1}: ${line.trim()}`);
    }
    if (/(?:tenure|tenor|repayment\s*period|max\s*tenure|min\s*tenure)/i.test(line)) {
      tenureMatches.push(`L${i+1}: ${line.trim()}`);
    }
  }

  console.log(`[CIBIL MENTIONS] (${cibilMatches.length}):`);
  cibilMatches.forEach(m => console.log('   ' + m));
  console.log(`[TENURE MENTIONS] (${tenureMatches.length}):`);
  tenureMatches.forEach(m => console.log('   ' + m));
}
