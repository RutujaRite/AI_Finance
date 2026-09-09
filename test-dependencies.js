const fs = require('fs');
const path = require('path');

// List all TypeScript files
console.log('TypeScript files in lib/:');
fs.readdirSync('lib').forEach(file => {
  if (file.endsWith('.ts')) {
    console.log('  ', file);
  }
});

// Try to require bankSearch
console.log('\nTrying to require bankSearch...');
try {
  const bankSearch = require('./lib/bankSearch');
  console.log('Success! bankSearch exports:', Object.keys(bankSearch));
} catch (error) {
  console.log('Failed:', error.message);
}

// Check if we can run a simple server
console.log('\nChecking server.js...');
try {
  require('./server');
  console.log('server.js loaded successfully');
} catch (error) {
  console.log('server.js error:', error.message);
}
