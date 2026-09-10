const fs = require('fs');
const path = require('path');

const policyDir = path.join(__dirname, '..', 'policy-master-files');
const files = fs.readdirSync(policyDir).filter(f => f.endsWith('.txt')).sort();

let out = '# Policy CIBIL and Tenure Audit\n\n';

for (const file of files) {
  const content = fs.readFileSync(path.join(policyDir, file), 'utf-8');
  out += `## File: ${file}\n\n`;

  const lines = content.split('\n');
  const cibilMatches = [];
  const tenureMatches = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/(?:cibil|credit\s*score|bureau\s*score|score\s*cutoff|minimum\s*score)/i.test(line)) {
      // capture +/- 2 lines context
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length - 1, i + 1);
      const ctx = lines.slice(start, end + 1).map(l => l.trim()).join(' | ');
      cibilMatches.push(`- L${i+1}: ${ctx}`);
    }
    if (/(?:tenure|tenor|repayment\s*period|max\s*tenure|min\s*tenure)/i.test(line)) {
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length - 1, i + 1);
      const ctx = lines.slice(start, end + 1).map(l => l.trim()).join(' | ');
      tenureMatches.push(`- L${i+1}: ${ctx}`);
    }
  }

  out += `### CIBIL Mentions (${cibilMatches.length})\n`;
  if (cibilMatches.length === 0) {
    out += `*NO CIBIL MENTIONS FOUND*\n\n`;
  } else {
    out += cibilMatches.join('\n') + '\n\n';
  }

  out += `### Tenure Mentions (${tenureMatches.length})\n`;
  if (tenureMatches.length === 0) {
    out += `*NO TENURE MENTIONS FOUND*\n\n`;
  } else {
    out += tenureMatches.join('\n') + '\n\n';
  }
}

fs.writeFileSync(path.join(__dirname, 'policy_cibil_tenure_audit.md'), out);
console.log('Saved to scratch/policy_cibil_tenure_audit.md');
