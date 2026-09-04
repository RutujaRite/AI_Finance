const { OpenAI } = require('openai');
const apiKey = process.env.OPENROUTER_API_KEY;

console.log('OPENROUTER_API_KEY:', apiKey ? `Present (length: ${apiKey.length})` : 'Missing');

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: apiKey || '',
});

console.log('OpenAI client created successfully');
