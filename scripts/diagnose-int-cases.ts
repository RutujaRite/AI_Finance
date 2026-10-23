import fetch from 'node-fetch';
import { signToken } from '../lib/auth';

const BASE_URL = 'http://localhost:3001';
const adminToken = signToken({ id: 2, email: 'admin@gmail.com', name: 'Rutuja Rite', role: 'admin' });

async function sendChat(message: string, conversationId?: string, history: any[] = []) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `token=${adminToken}`,
    },
    body: JSON.stringify({
      message,
      conversationId,
      conversationHistory: history,
      userId: 1,
    }),
  });
  const data: any = await res.json();
  return data;
}

async function run() {
  console.log('=== RUNNING DIAGNOSTIC ON INT-01 TO INT-10 ===\n');

  function getContent(res: any) {
    return res.message?.content || res.ai_message?.content || res.reply || JSON.stringify(res);
  }

  // INT-01: What is an education loan?
  console.log('--- INT-01: "What is an education loan?" ---');
  const res1 = await sendChat('What is an education loan?');
  console.log('Intent:', res1.retrieval_intent, 'Docs:', res1.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(res1).slice(0, 350), '...\n');

  // INT-02: What is SBI's education loan interest rate?
  console.log("--- INT-02: \"What is SBI's education loan interest rate?\" ---");
  const res2 = await sendChat("What is SBI's education loan interest rate?");
  console.log('Intent:', res2.retrieval_intent, 'Docs:', res2.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(res2).slice(0, 350), '...\n');

  // INT-03: What is the collateral requirement for SBI education loans?
  console.log('--- INT-03: "What is the collateral requirement for SBI education loans?" ---');
  const res3 = await sendChat('What is the collateral requirement for SBI education loans?');
  console.log('Intent:', res3.retrieval_intent, 'Docs:', res3.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(res3).slice(0, 350), '...\n');

  // INT-04: What is the minimum CIBIL score required by SBI?
  console.log('--- INT-04: "What is the minimum CIBIL score required by SBI?" ---');
  const res4 = await sendChat('What is the minimum CIBIL score required by SBI?');
  console.log('Intent:', res4.retrieval_intent, 'Docs:', res4.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(res4).slice(0, 350), '...\n');

  // INT-05: Which documents are required by SBI?
  console.log('--- INT-05: "Which documents are required by SBI?" ---');
  const res5 = await sendChat('Which documents are required by SBI?');
  console.log('Intent:', res5.retrieval_intent, 'Docs:', res5.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(res5).slice(0, 350), '...\n');

  // INT-06 & INT-07: Conversation Thread
  console.log('--- INT-06 & INT-07: Conversation Thread ---');
  const convId = 'test_int_thread_' + Date.now();
  const threadHistory: any[] = [];

  const turn1 = await sendChat("What is SBI's education loan interest rate?", convId, threadHistory);
  threadHistory.push({ role: 'user', content: "What is SBI's education loan interest rate?" });
  threadHistory.push({ role: 'assistant', content: getContent(turn1) });

  console.log('Turn 2 (INT-06): "What about HDFC Bank?"');
  const turn2 = await sendChat('What about HDFC Bank?', convId, threadHistory);
  console.log('Intent:', turn2.retrieval_intent, 'Docs:', turn2.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(turn2).slice(0, 350), '...\n');
  threadHistory.push({ role: 'user', content: 'What about HDFC Bank?' });
  threadHistory.push({ role: 'assistant', content: getContent(turn2) });

  console.log('Turn 3 (INT-07): "What about the repayment period?"');
  const turn3 = await sendChat('What about the repayment period?', convId, threadHistory);
  console.log('Intent:', turn3.retrieval_intent, 'Docs:', turn3.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(turn3).slice(0, 350), '...\n');

  // INT-08: Tell me the interest rate. I don't know the bank.
  console.log('--- INT-08: "Tell me the interest rate. I don\'t know the bank." ---');
  const res8 = await sendChat("Tell me the interest rate. I don't know the bank.");
  console.log('Intent:', res8.retrieval_intent, 'Docs:', res8.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(res8).slice(0, 350), '...\n');

  // INT-09: SBI gives education loans at 4% for everyone, right?
  console.log('--- INT-09: "SBI gives education loans at 4% for everyone, right?" ---');
  const res9 = await sendChat('SBI gives education loans at 4% for everyone, right?');
  console.log('Intent:', res9.retrieval_intent, 'Docs:', res9.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(res9).slice(0, 350), '...\n');

  // INT-10: Ask about a bank whose policy is not uploaded (e.g. Moon Bank)
  console.log('--- INT-10: "What is Moon Bank\'s education loan interest rate?" ---');
  const res10 = await sendChat("What is Moon Bank's education loan interest rate?");
  console.log('Intent:', res10.retrieval_intent, 'Docs:', res10.message?.used_knowledge_documents);
  console.log('Response:\n', getContent(res10).slice(0, 350), '...\n');
}

run().catch(console.error);
