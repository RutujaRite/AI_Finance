export {};
async function testChatApi() {
  const url = "http://localhost:3001/api/chat";
  const convId = "100" + Math.floor(Math.random() * 899);

  const res1 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello", conversation_id: convId }),
  });
  console.log("Status:", res1.status);
  const text = await res1.text();
  console.log("Body preview:", text.slice(0, 300));
}

testChatApi().catch(console.error);
