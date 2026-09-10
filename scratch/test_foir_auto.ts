import "dotenv/config";

async function testFoirAuto() {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "CreditWise AI",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are CreditWise AI, an expert banking and financial intelligence assistant. " +
            "Answer the user's banking or loan question clearly, accurately, and naturally. " +
            "For concepts like FOIR, give a natural, clear explanation of what FOIR stands for (Fixed Obligation to Income Ratio), how it is calculated, and what lenders look for, without generic eligibility percentages. " +
            "Format your answer cleanly in GitHub Markdown. Do not include thinking or analysis preambles.",
        },
        { role: "user", content: "What is FOIR?" },
      ],
    }),
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Content:\n", data.choices?.[0]?.message?.content);
}

testFoirAuto();
