// test-openrouter-integration.js
require('dotenv').config();
const { openRouterChat, processUserMessage } = require('./lib/openrouter');

async function testOpenRouterConnection() {
  console.log('🔍 Testing OpenRouter API Integration...\n');

  // Check environment variables
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'liquid/lfm-2.5-embedding-350m:free';

  console.log('📋 Configuration Status:');
  console.log(`✅ OPENROUTER_API_KEY: ${apiKey ? 'Set (Length: ' + apiKey.length + ' chars)' : '❌ MISSING'}`);
  console.log(`✅ OPENROUTER_MODEL: ${model}`);
  console.log();

  if (!apiKey) {
    console.log('❌ CRITICAL: OPENROUTER_API_KEY is not configured!');
    console.log('\n📝 To fix this:');
    console.log('1. Visit https://openrouter.ai/');
    console.log('2. Create an account and get your API key');
    console.log('3. Add to your .env file:');
    console.log('   OPENROUTER_API_KEY=your_api_key_here');
    console.log('4. Restart the application');
    return false;
  }

  try {
    console.log('🔄 Testing OpenRouter API connection...');

    const testMessages = [
      { role: 'user', content: 'Hello, can you help me with banking information?' }
    ];

    const response = await openRouterChat(testMessages);

    console.log('✅ OpenRouter API Connection Successful!');
    console.log(`📊 Model Used: ${response.model}`);
    console.log(`📝 Response Length: ${response.choices[0].message.content?.length || 0} characters`);
    console.log(`🎯 Finish Reason: ${response.choices[0].finish_reason}`);
    console.log();

    if (response.usage) {
      console.log('📈 Usage Statistics:');
      console.log(`   Prompt Tokens: ${response.usage.prompt_tokens}`);
      console.log(`   Completion Tokens: ${response.usage.completion_tokens}`);
      console.log(`   Total Tokens: ${response.usage.total_tokens}`);
    }

    console.log('🎉 OpenRouter Integration Test PASSED!');
    return true;

  } catch (error) {
    console.log('❌ OpenRouter API Connection Failed!');
    console.log(`📋 Error Details: ${error.message}`);
    console.log();

    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('🔧 Troubleshooting - Authentication Issue:');
      console.log('   1. Verify API key is correct');
      console.log('   2. Check if API key has expired');
      console.log('   3. Ensure API key has proper permissions');
      console.log('   4. Visit https://openrouter.ai/account to verify');
    } else if (error.message.includes('404') || error.message.includes('Model not found')) {
      console.log('🔧 Troubleshooting - Model Issue:');
      console.log('   1. Check if model name is available');
      console.log('   2. Try alternative model: gpt-4, gpt-3.5-turbo');
      console.log('   3. Verify model availability in your OpenRouter account');
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      console.log('🔧 Troubleshooting - Rate Limiting:');
      console.log('   1. Wait and retry (rate limits reset periodically)');
      console.log('   2. Upgrade OpenRouter plan for higher limits');
      console.log('   3. Implement retry logic with exponential backoff');
    } else {
      console.log('🔧 Troubleshooting - General Issue:');
      console.log('   1. Check internet connection');
      console.log('   2. Verify service status at https://status.openrouter.ai/');
      console.log('   3. Check firewall/proxy settings');
    }

    return false;
  }
}

async function testOpenRouterWithBankManager() {
  console.log('\n🔍 Testing OpenRouter with Bank Manager Tool...');

  try {
    const response = await processUserMessage('Find me ICICI bank managers in Mumbai');

    console.log('✅ Bank Manager Tool Test Successful!');
    console.log('📝 Response Preview:', response.substring(0, 200) + '...');
    return true;
  } catch (error) {
    console.log('❌ Bank Manager Tool Test Failed:', error.message);
    return false;
  }
}

async function testOpenRouterWithCompanyQuery() {
  console.log('\n🔍 Testing OpenRouter with Company Query...');

  try {
    const response = await processUserMessage('Tell me about Tata Consultancy Services');

    console.log('✅ Company Query Tool Test Successful!');
    console.log('📝 Response Preview:', response.substring(0, 200) + '...');
    return true;
  } catch (error) {
    console.log('❌ Company Query Tool Test Failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 OpenRouter Integration Test Suite');
  console.log('='.repeat(60));
  console.log('Testing the migrated OpenRouter AI assistant...\n');

  const connectionTest = await testOpenRouterConnection();
  const bankManagerTest = await testOpenRouterWithBankManager();
  const companyQueryTest = await testOpenRouterWithCompanyQuery();

  console.log('\n' + '='.repeat(60));
  console.log('📊 Integration Test Summary:');
  console.log(`🔌 API Connection: ${connectionTest ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`🏦 Bank Manager Tool: ${bankManagerTest ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`🏢 Company Query Tool: ${companyQueryTest ? '✅ WORKING' : '❌ FAILED'}`);

  const allPassed = connectionTest && bankManagerTest && companyQueryTest;

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 SUCCESS: All OpenRouter integration tests passed!');
    console.log('✅ The migrated services are working correctly.');
    console.log('✅ The Python to Next.js migration was successful!');
  } else {
    console.log('⚠️  WARNING: Some tests failed.');
    console.log('🔧 Please check the configuration and troubleshoot the issues.');
  }

  return allPassed;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  testOpenRouterConnection, 
  testOpenRouterWithBankManager, 
  testOpenRouterWithCompanyQuery 
};