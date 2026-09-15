const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'policy-master-files');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && !f.includes('home_loan'));

for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf-8');
  console.log('================================================================');
  console.log(`FILE: ${f}`);
  
  // Find lines mentioning salary
  const salLines = text.split('\n').filter(l => /salary|nmi|net monthly/i.test(l)).slice(0, 4);
  console.log('  Salary:', salLines.map(l => l.trim()).join(' | '));

  // Find lines mentioning age
  const ageLines = text.split('\n').filter(l => /age/i.test(l)).slice(0, 3);
  console.log('  Age:', ageLines.map(l => l.trim()).join(' | '));

  // Find lines mentioning cibil
  const cibilLines = text.split('\n').filter(l => /cibil/i.test(l)).slice(0, 3);
  console.log('  CIBIL:', cibilLines.map(l => l.trim()).join(' | '));

  // Find lines mentioning foir
  const foirLines = text.split('\n').filter(l => /foir/i.test(l)).slice(0, 3);
  console.log('  FOIR:', foirLines.map(l => l.trim()).join(' | '));

  // Find lines mentioning tenure
  const tenureLines = text.split('\n').filter(l => /tenure|tenor/i.test(l)).slice(0, 3);
  console.log('  Tenure:', tenureLines.map(l => l.trim()).join(' | '));

  // Find lines mentioning ticket size / loan amount
  const amtLines = text.split('\n').filter(l => /loan amount|ticket size|max(?:imum)? funding|min(?:imum)? loan/i.test(l)).slice(0, 3);
  console.log('  Amount:', amtLines.map(l => l.trim()).join(' | '));

  // Find lines mentioning roi / interest rate / irr
  const roiLines = text.split('\n').filter(l => /roi|interest rate|irr/i.test(l)).slice(0, 3);
  console.log('  ROI:', roiLines.map(l => l.trim()).join(' | '));
}
