const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_banks_cibil_tenure_extracted.json'), 'utf-8'));

for (const item of data) {
  console.log(`================================================================`);
  console.log(`FILE: ${item.file}`);
  console.log(`CIBIL (${item.cibilInfo.length}):`);
  item.cibilInfo.slice(0, 8).forEach(c => console.log('  ' + c));
  console.log(`TENURE (${item.tenureInfo.length}):`);
  item.tenureInfo.slice(0, 8).forEach(t => console.log('  ' + t));
}
