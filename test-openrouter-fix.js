require('dotenv').config();
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Present' : 'Missing');
console.log('OPENROUTER_MODEL:', process.env.OPENROUTER_MODEL);

const { openRouterChat, processUserMessage } = require('./lib/openrouter');

async function test() {
  try {
    console.log('Testing basic OpenRouter functionality...');
    
    // Test processUserMessage
    const result = await processUserMessage('Hello, can you help me with banking information?');
    console.log('Result:', result.substring(0, 100) + '...');
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

test();
