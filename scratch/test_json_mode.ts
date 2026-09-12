import dotenv from "dotenv";
dotenv.config();

async function test() {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: "Output JSON with a greeting key" }],
    }),
  });
  const d = await res.json();
  console.log("Status:", res.status);
  console.log("Output:", d.choices?.[0]?.message?.content);
}

test();
