const fs = require('fs');
const path = require('path');

// Check if bankSearch.ts exists
const bankSearchTsPath = path.join(__dirname, 'lib', 'bankSearch.ts');
const bankSearchJsPath = path.join(__dirname, 'lib', 'bankSearch.js');

console.log('bankSearch.ts exists:', fs.existsSync(bankSearchTsPath));
console.log('bankSearch.js exists:', fs.existsSync(bankSearchJsPath));

if (fs.existsSync(bankSearchTsPath)) {
  const content = fs.readFileSync(bankSearchTsPath, 'utf8');
  console.log('bankSearch.ts has export statements:', content.includes('export'));
}
