import dotenv from "dotenv";
dotenv.config();

async function testReasoningControl() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = "inclusionai/ling-3.0-flash-vl:free";

  // Test 1: with reasoning: { max_tokens: 0 }
  const res1 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Say hi in JSON: {\"reply\":\"hi\"}" }],
      max_tokens: 300,
      reasoning: { max_tokens: 0 },
    }),
  });
  console.log("Status with reasoning max_tokens 0:", res1.status);
  const data1 = await res1.json();
  console.log("Usage details 1:", data1?.usage);
  console.log("Content 1:", data1?.choices?.[0]?.message?.content);

  // Test 2: with reasoning: { effort: "low" }
  const res2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Say hi in JSON: {\"reply\":\"hi\"}" }],
      max_tokens: 300,
      reasoning: { effort: "low" },
    }),
  });
  console.log("Status with effort low:", res2.status);
  const data2 = await res2.json();
  console.log("Usage details 2:", data2?.usage);
  console.log("Content 2:", data2?.choices?.[0]?.message?.content);

  process.exit(0);
}

testReasoningControl().catch(console.error);
