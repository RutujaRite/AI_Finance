import { runCentralAgent } from '../lib/ai/agent';

async function test() {
  const convId = 'debug_flow_' + Date.now();
  console.log('--- Step 1: Initial Loan Request ---');
  const res1 = await runCentralAgent({
    message: 'I want a personal loan. I work at Infosys, monthly salary is 90000, need 5 lakhs for 3 years',
    conversationId: convId,
  });
  console.log('Res 1:', res1.reply);

  console.log('\n--- Step 2: Side Question ---');
  const res2 = await runCentralAgent({
    message: 'Wait, calculate EMI for 4 lakhs at 11% for 2 years',
    conversationId: convId,
  });
  console.log('Res 2:', res2.reply);

  console.log('\n--- Step 3: Resuming with CIBIL, Age, EMI ---');
  const res3 = await runCentralAgent({
    message: 'Thanks! My CIBIL is 780, age is 29, and I have 0 existing EMIs',
    conversationId: convId,
  });
  console.log('Res 3:', res3.reply);
  process.exit(0);
}

test().catch(err => {
  console.error('Debug error:', err);
  process.exit(1);
});
