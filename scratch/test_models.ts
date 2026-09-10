import "dotenv/config";

async function testModels() {
  const models = [
    "inclusionai/ling-3.0-flash-fin:free",
    "liquid/lfm-2.5-2.6b:free",
    "nex-agi/nex-n2.5-mini:free",
    "thinkingmachines/inkling:free",
    "openrouter/auto",
    "openrouter/free"
  ];
  for (const m of models) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: m,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    console.log(m, "status:", res.status);
    if (res.ok) {
      const data = await res.json();
      console.log("Success with", m, data.choices?.[0]?.message?.content);
      break;
    }
  }
}
testModels();
