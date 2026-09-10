const fs = require('fs');
const path = require('path');

const policyDir = path.join(__dirname, '..', 'policy-master-files');
const files = fs.readdirSync(policyDir).filter(f => f.endsWith('.txt'));

console.log(`Found ${files.length} policy files.`);

for (const file of files) {
  const content = fs.readFileSync(path.join(policyDir, file), 'utf-8');
  const lines = content.split('\n');
  
  const cibilLines = lines.filter(l => /cibil|credit\s*score|bureau|score/i.test(l)).slice(0, 10);
  const tenureLines = lines.filter(l => /tenure|tenor|months|years/i.test(l)).slice(0, 10);

  console.log(`\n======================================================`);
  console.log(`FILE: ${file}`);
  console.log(`--- CIBIL Lines (${cibilLines.length}) ---`);
  cibilLines.forEach(l => console.log('  ' + l.trim()));
  console.log(`--- Tenure Lines (${tenureLines.length}) ---`);
  tenureLines.forEach(l => console.log('  ' + l.trim()));
}
