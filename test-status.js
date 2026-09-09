require('dotenv').config();

console.log('Environment variables check:');
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Present' : 'Missing');
console.log('INCRAAX_SEARCH_API_KEY:', process.env.INCRAAX_SEARCH_API_KEY ? 'Present' : 'Missing');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Present' : 'Missing');

// Check if bankSearch exports exist
try {
  const bankSearch = require('./lib/bankSearch');
  console.log('bankSearch exports:', Object.keys(bankSearch));
} catch (error) {
  console.log('Failed to load bankSearch:', error.message);
}
