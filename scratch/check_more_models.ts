import dotenv from "dotenv";
dotenv.config();

async function checkMoreModels() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const models = [
    'thinkingmachines/inkling-small:free',
    'poolside/laguna-s-2.1:free',
    'thinkingmachines/inkling:free',
    'poolside/laguna-xs-2.1:free',
    'cohere/north-mini-code:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'google/gemma-4-26b-a4b-it:free',
    'google/gemma-4-31b-it:free',
  ];

  for (const m of models) {
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

checkMoreModels();
