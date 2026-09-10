import dotenv from "dotenv";
dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

async function testModel(modelName: string) {
  console.log("Testing:", modelName);
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "CreditWise AI",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 100,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: "Say hello and return {\"status\": \"ok\"}"
          }
        ]
      })
    });
    clearTimeout(timer);
    const duration = Date.now() - start;
    console.log(`Model: ${modelName} -> Status: ${res.status} in ${duration}ms`);
    const data = await res.json();
    console.log("Content:", data?.choices?.[0]?.message?.content);
  } catch (e: any) {
    console.error(`Model: ${modelName} Error:`, e.message);
  }
}

async function main() {
  const models = [
    "openrouter/free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "qwen/qwen-2.5-72b-instruct:free"
  ];
  for (const m of models) {
    await testModel(m);
  }
}

main();
