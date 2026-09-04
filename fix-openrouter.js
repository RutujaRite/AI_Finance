const fs = require('fs');

// Read the current openrouter.js
let content = fs.readFileSync('lib/openrouter.js', 'utf8');

// Check if it has the OpenAI import
if (!content.includes('require(\'openai\')')) {
  console.log('Adding OpenAI import to openrouter.js...');
  
  // Find a good place to add the import
  const importLine = 'const { OpenAI } = require(\'openai\');';
  
  // Check if it's already there
  if (!content.includes(importLine)) {
    // Add the import after the header comment
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('// ') && i > 5) {
        // Insert after the last comment line
        lines.splice(i, 0, importLine);
        content = lines.join('\n');
        console.log('Added OpenAI import');
        break;
      }
    }
  }
}

// Write the fixed content
fs.writeFileSync('lib/openrouter.js', content);
console.log('Fixed openrouter.js');
