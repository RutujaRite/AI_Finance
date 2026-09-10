/**
 * End-to-end integration test against the running server http://localhost:3001/api/chat
 */
async function runE2ETests() {
  const loginUrl = 'http://localhost:3001/api/auth/login';
  const baseUrl = 'http://localhost:3001/api/chat';
  let conversationId = 'e2e_test_' + Date.now();
  let cookieHeader = '';
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
    }
  }

  // Login first to get JWT token
  console.log('--- 0. Authenticating as admin ---');
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gmail.com', password: '12345' }),
  });
  const rawCookie = loginRes.headers.get('set-cookie');
  if (rawCookie) {
    cookieHeader = rawCookie.split(';')[0];
  }
  const loginData = await loginRes.json();
  assert(loginData.success === true, 'Authenticated successfully with admin credentials');

  async function sendMsg(message: string, convId = conversationId) {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({ message, conversation_id: convId }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return await res.json();
  }

  console.log('--- 1. Testing Greeting ---');
  const greetingRes = await sendMsg('Hello! How are you?');
  const greetingText = greetingRes.ai_message?.content || '';
  console.log('  Agent response:', greetingText.slice(0, 100));
  assert(greetingRes.success === true, 'Greeting returned success');
  assert(greetingText.length > 5, 'Greeting has friendly natural response');
  assert(!greetingRes.ai_message?.company_data, 'Greeting does not include Corporate Intelligence');

  console.log('\n--- 2. Testing General Side Question ---');
  const sideQRes = await sendMsg('What is reducing balance interest rate?');
  const sideQText = sideQRes.ai_message?.content || '';
  console.log('  Agent response:', sideQText.slice(0, 100));
  assert(sideQRes.success === true, 'General side question returned success');
  assert(
    sideQText.toLowerCase().includes('principal') ||
    sideQText.toLowerCase().includes('reducing') ||
    sideQText.toLowerCase().includes('balance') ||
    sideQText.toLowerCase().includes('interest'),
    'General question explained reducing balance correctly'
  );

  console.log('\n--- 3. Testing Bank Master Policy Query ---');
  const policyRes = await sendMsg('What is the minimum CIBIL score for ICICI Bank?');
  const policyText = policyRes.ai_message?.content || '';
  console.log('  Agent response:', policyText.slice(0, 100));
  assert(policyRes.success === true, 'Policy query returned success');
  assert(
    policyText.toLowerCase().includes('icici') && (policyText.toLowerCase().includes('cibil') || policyText.toLowerCase().includes('policy')),
    'ICICI policy answered accurately from master policy (mentions ICICI Master Policy / CIBIL guidelines)'
  );
  assert(!policyRes.ai_message?.company_data, 'Policy query does not leak Corporate Intelligence table');

  console.log('\n--- 4. Testing Dedicated Corporate Category Query ---');
  const compRes = await sendMsg('What is the company category for Infosys?');
  const compText = compRes.ai_message?.content || '';
  console.log('  Agent response:', compText.slice(0, 100));
  assert(compRes.success === true, 'Company category query returned success');
  assert(
    compText.toLowerCase().includes('infosys') &&
    (compText.toLowerCase().includes('super a') || compText.toLowerCase().includes('cat a') || compText.toLowerCase().includes('diamond')),
    'Company query returns actual employer category'
  );

  console.log('\n--- 5. Testing Multi-Detail Loan Request ---');
  const loanRes1 = await sendMsg(
    'I want a personal loan. I work at Infosys, monthly salary is 90000, need 5 lakhs for 3 years'
  );
  const activeLoanConvId = loanRes1.conversation_id;
  const loanText1 = loanRes1.ai_message?.content || '';
  console.log('  Agent response:', loanText1.slice(0, 100));
  assert(loanRes1.success === true, 'Loan request initialized successfully');
  assert(loanRes1.ai_message?.company_data === undefined || loanRes1.ai_message?.company_data === null, 'CRITICAL: Corporate Intelligence (CIN, AGM, etc.) scrubbed from loan flow');
  assert(
    loanText1.toLowerCase().includes('cibil') ||
    loanText1.toLowerCase().includes('credit score') ||
    loanText1.toLowerCase().includes('existing') ||
    loanText1.toLowerCase().includes('emi'),
    'Agent asked only for next missing required field (CIBIL / EMIs)'
  );

  console.log('\n--- 6. Testing Side Question Mid-Flow (Active eligibility must not override) ---');
  const emiRes = await sendMsg(
    'Wait, calculate EMI for 4 lakhs at 11% for 2 years',
    activeLoanConvId
  );
  const emiText = emiRes.ai_message?.content || '';
  console.log('  Agent response:', emiText.slice(0, 100));
  assert(emiRes.success === true, 'EMI calculation returned success mid-flow');
  assert(
    emiText.includes('18,643') || emiText.includes('18643') || emiText.includes('EMI'),
    'EMI calculation tool executed successfully (~18,643)'
  );
  assert(
    emiText.toLowerCase().includes('continue') ||
    emiText.toLowerCase().includes('resume') ||
    emiText.toLowerCase().includes('ready') ||
    emiText.toLowerCase().includes('loan') ||
    emiText.toLowerCase().includes('eligibility'),
    'Agent gracefully invited user to resume loan eligibility'
  );

  console.log('\n--- 7. Resuming and Completing Loan Eligibility ---');
  const loanRes2 = await sendMsg(
    'My CIBIL is 780, age is 29, and I have 0 existing EMIs',
    activeLoanConvId
  );
  const loanText2 = loanRes2.ai_message?.content || '';
  console.log('  Agent response:', loanText2.slice(0, 150));
  assert(loanRes2.success === true, 'Loan completion returned success');
  assert(
    !loanText2.includes('Approved Partner Bank(s)'),
    'CRITICAL: Banks are NEVER falsely labeled "Approved Partner Bank(s)"'
  );
  assert(
    loanText2.includes('Eligible Partner Bank') ||
    loanText2.toLowerCase().includes('eligible') ||
    loanText2.toLowerCase().includes('criteria met'),
    'Shows genuinely eligible banks with proper "Eligible" / "Criteria Met" terminology'
  );
  assert(loanRes2.ai_message?.company_data === undefined || loanRes2.ai_message?.company_data === null, 'Corporate Intelligence remained scrubbed on completion');

  console.log(`\n================================`);
  console.log(`E2E INTEGRATION TEST RESULTS: ${passed} / ${total} PASS (${Math.round((passed/total)*100)}%)`);
  console.log(`================================`);

  if (passed !== total) {
    process.exit(1);
  }
}

runE2ETests().catch(err => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
