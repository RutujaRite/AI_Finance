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
      // Print context: 3 lines before, 5 lines after
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length - 1, i + 4);
      console.log(`--- Match at line ${i+1}:`);
      for (let j = start; j <= end; j++) {
        console.log(`  ${j+1}: ${lines[j]}`);
      }
      i = end; // Skip forward
    }
  }
}

// Check first batch
const filesBatch1 = [
  "ABFL_Master_Policy.txt",
  "AXIS_Master_Policy.txt",
  "Axis_Finance_Master_Policy.txt",
  "Bajaj_Finserv_Master_Policy.txt",
  "Bajaj_Markets_Master_Policy.txt",
  "Bandhan_Bank_Master_Policy.txt",
  "Chola_Master_Policy.txt"
];

for (const f of filesBatch1) {
  inspectBank(f, [/cibil/i, /scorecard/i, /tenure/i, /tenor/i]);
}
