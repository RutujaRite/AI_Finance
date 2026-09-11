const fs = require('fs');
const path = require('path');

const agentFile = path.join(__dirname, 'lib', 'ai', 'agent.ts');
let content = fs.readFileSync(agentFile, 'utf8');

// Find and replace ONLY the bank regex to include "yes bank"
// We need to find the line: const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
// And replace it with: const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla|yes\s*bank/i.exec(userMessage);

content = content.replace(
  /const bankMatch = \/icici\|hdfc\|axis\|sbi\|kotak\|indusind\|idfc\|bajaj\|piramal\|tata\|poonawalla\/i\.exec\(userMessage\);/,
  '    const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla|yes\\s*bank/i.exec(userMessage);'
);

fs.writeFileSync(agentFile, content, 'utf8');
console.log('Applied correct minimal fix');
