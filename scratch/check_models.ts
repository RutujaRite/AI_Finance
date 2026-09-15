import dotenv from "dotenv";
dotenv.config();

async function checkFreeModels() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json();
  const freeModels = (data.data || [])
    .filter((m: any) => m.id.endsWith(":free"))
    .map((m: any) => m.id);
  console.log("Free models found:", freeModels);

  // Test calling one with a simple prompt
  for (const m of freeModels.slice(0, 8)) {
    try {
      const testRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: "user", content: "Say hello" }],
          max_tokens: 50,
        }),
      });
      const testData = await testRes.json();
      console.log(`Model ${m}:`, testRes.status, testData.choices?.[0]?.message?.content || testData.error?.message);
    } catch (e: any) {
      console.log(`Model ${m} err:`, e.message);
    }
  }
}

checkFreeModels();
