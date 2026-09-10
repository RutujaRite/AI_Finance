const fs = require('fs');
const path = require('path');
const policyDir = path.join(__dirname, '..', 'policy-master-files');

function getBankDetails(fname) {
  const content = fs.readFileSync(path.join(policyDir, fname), 'utf-8');
  const lines = content.split('\n');

  let inCibil = false;
  let inTenure = false;
  const cibilLines = [];
  const tenureLines = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^[=\-#\s]*\b(?:cibil|credit score|bureau)\b/i.test(l) && l.length < 50) {
      // Capture next 15 lines
      cibilLines.push(...lines.slice(i, Math.min(lines.length, i + 15)));
    }
    if (/^[=\-#\s]*\b(?:tenure|tenor|loan amount & tenure)\b/i.test(l) && l.length < 50) {
      // Capture next 15 lines
      tenureLines.push(...lines.slice(i, Math.min(lines.length, i + 15)));
    }
  }

  return { cibilLines, tenureLines };
}

const files = fs.readdirSync(policyDir).filter(f => f.endsWith('.txt')).sort();
for (const f of files) {
  console.log(`\n======================================================`);
  console.log(`FILE: ${f}`);
  const { cibilLines, tenureLines } = getBankDetails(f);
  console.log(`--- CIBIL (${cibilLines.length} lines) ---`);
  console.log(cibilLines.slice(0, 12).join('\n'));
  console.log(`--- TENURE (${tenureLines.length} lines) ---`);
  console.log(tenureLines.slice(0, 12).join('\n'));
}
