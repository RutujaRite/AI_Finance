const fs = require('fs');
const path = require('path');
const policyDir = path.join(__dirname, '..', 'policy-master-files');
const files = fs.readdirSync(policyDir).filter(f => f.endsWith('.txt')).sort();

let out = '';

for (const file of files) {
  const text = fs.readFileSync(path.join(policyDir, file), 'utf-8');
  out += '================================================================\n';
  out += `FILE: ${file}\n`;
  
  const paragraphs = text.split(/\n\s*\n/);
  for (const p of paragraphs) {
    if (/(?:cibil|credit\s*score|scorecard|bureau)/i.test(p) && /(?:minimum|min|cutoff|>=|>|allowed|band|score)/i.test(p)) {
      out += `[CIBIL SECTION]:\n${p.trim().split('\n').slice(0, 10).join('\n')}\n\n`;
    }
    if (/(?:tenure|tenor)/i.test(p) && /(?:month|year|min|max|up to|allowed|range)/i.test(p)) {
      out += `[TENURE SECTION]:\n${p.trim().split('\n').slice(0, 10).join('\n')}\n\n`;
    }
  }
}

fs.writeFileSync(path.join(__dirname, 'extracted_sections_utf8.txt'), out, 'utf-8');
console.log('Written utf-8 extracted sections');
