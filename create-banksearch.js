const fs = require('fs');

// Read bankSearch.ts
const tsContent = fs.readFileSync('lib/bankSearch.ts', 'utf8');

// Convert TypeScript to JavaScript
let jsContent = tsContent;

// Remove export keyword and fix exports
jsContent = jsContent.replace(/export\s+/g, '');

// Add module.exports at the end
if ('module.exports' not in jsContent) {
  jsContent += '\n\nmodule.exports = {\n';
  jsContent += '  BANK_MANAGER_TOOLS,\n';
  jsContent += '  searchBankManager,\n';
  jsContent += '  formatManagers,\n';
  jsContent += '  BankManagerRecord,\n';
  jsContent += '};';
}

// Write to bankSearch.js
fs.writeFileSync('lib/bankSearch.js', jsContent);
console.log('Created lib/bankSearch.js');
