import dotenv from "dotenv";
dotenv.config();

async function findWorkingModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const mRes = await fetch("https://openrouter.ai/api/v1/models");
  const mData = await mRes.json();
  const freeModels = (mData.data || [])
    .filter((m: any) => m.id?.endsWith(":free"))
    .map((m: any) => m.id);

  console.log(`Checking ${freeModels.length} free models...`);

  for (const m of freeModels) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 10,
          messages: [{ role: "user", content: "hi" }]
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✅ WORKING MODEL: ${m}`);
        console.log("Response:", data?.choices?.[0]?.message?.content);
        return;
      } else {
        console.log(`❌ ${m}: HTTP ${res.status} - ${data?.error?.message?.slice(0, 70)}`);
      }
    } catch (e: any) {
      console.log(`❌ ${m}: fetch error - ${e.message}`);
    }
  }
}

findWorkingModel().catch(console.error);
