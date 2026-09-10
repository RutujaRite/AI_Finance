import "dotenv/config";

async function debugFetch() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const rawModel = process.env.OPENROUTER_MODEL || "openrouter/free";
  const model = rawModel.replace(/^["']|["']$/g, "");
  console.log("API Key exists:", !!apiKey, "Prefix:", apiKey?.slice(0, 10));
  console.log("Raw Model:", rawModel, "Cleaned Model:", model);

  const modelsToTry = [model, "openrouter/free", "google/gemini-2.0-flash-lite-preview:free"];

  for (const m of modelsToTry) {
    console.log(`\nAttempting with model: ${m}...`);
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "CreditWise AI",
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 450,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "You are CreditWise AI, an expert banking and financial intelligence assistant. Answer the user's banking or loan question clearly and naturally without generic eligibility percentages.",
            },
            { role: "user", content: "What is FOIR?" },
          ],
        }),
      });
      clearTimeout(timeoutId);
      console.log(`Status: ${res.status} in ${Date.now() - start}ms`);
      const bodyText = await res.text();
      console.log("Response length:", bodyText.length);
      try {
        const json = JSON.parse(bodyText);
        console.log("Choices:", json.choices?.[0]?.message?.content?.slice(0, 200));
        if (json.error) console.log("Error object:", json.error);
      } catch {
        console.log("Raw body:", bodyText.slice(0, 300));
      }
    } catch (e: any) {
      console.log(`Failed after ${Date.now() - start}ms:`, e.name, e.message);
    }
  }
}

debugFetch();
