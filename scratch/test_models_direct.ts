import dotenv from "dotenv";
dotenv.config();

async function testOpenRouterDirect() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log("API Key:", apiKey?.slice(0, 15) + "...");

  const testModels = [
    "inclusionai/ling-3.0-flash-vl:free",
    "nex-agi/nex-n2.5-mini:free",
    "dots-studio/dots-3-note-preview:free",
    "liquid/lfm-2.5-2.6b:free",
    "thinkingmachines/inkling-small:free",
    "poolside/laguna-s-2.1:free",
    "cohere/north-mini-code:free",
    "google/gemma-4-26b-a4b-it:free",
    "google/gemma-4-31b-it:free"
  ];

  for (const m of testModels) {
    console.log(`\nTesting model: ${m}`);
    const start = Date.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "CreditWise AI",
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 500,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You are an assistant. Return a JSON object with key 'result': 'ok'." },
            { role: "user", content: "0" }
          ]
        })
      });

      console.log(`Status: ${res.status} in ${Date.now() - start}ms`);
      const bodyText = await res.text();
      console.log("Body preview:", bodyText.slice(0, 300));
    } catch (e: any) {
      console.log("Error:", e.message);
    }
  }
}

testOpenRouterDirect().catch(console.error);
