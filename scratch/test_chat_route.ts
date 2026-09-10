async function testChatApi() {
  const url = "http://localhost:3001/api/chat";
  const convId = "conv-" + Date.now();

  console.log("Testing POST /api/chat ...");

  // 1. Initial greeting
  const res1 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello", conversation_id: convId }),
  });
  const data1 = await res1.json();
  console.log("Turn 1 (Hello) Status:", res1.status);
  console.log("Turn 1 Reply:\n", data1.ai_message?.content);

  // 2. Loan inquiry
  const res2 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "I want to apply for a personal loan", conversation_id: convId }),
  });
  const data2 = await res2.json();
  console.log("\nTurn 2 (Loan Request) Status:", res2.status);
  console.log("Turn 2 Reply:\n", data2.ai_message?.content);

  // 3. Side question mid-flow: What is the EMI for 8 lakhs for 3 years at 12%?
  const res3 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "What is the EMI for 8 lakhs for 3 years at 12%?",
      conversation_id: convId,
    }),
  });
  const data3 = await res3.json();
  console.log("\nTurn 3 (Mid-Flow EMI Question) Status:", res3.status);
  console.log("Turn 3 Reply:\n", data3.ai_message?.content);

  // 4. Resume flow
  const res4 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Tata Consultancy Services",
      conversation_id: convId,
    }),
  });
  const data4 = await res4.json();
  console.log("\nTurn 4 (Company Name) Status:", res4.status);
  console.log("Turn 4 Reply:\n", data4.ai_message?.content);
}

testChatApi().catch(console.error);
