require("dotenv").config();

async function testEmbedding() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.EMBEDDING_MODEL;
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS);

  console.log("Model:", model);
  console.log("Expected dimensions:", dimensions);

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: "What is the minimum CIBIL score required for a personal loan?",
      dimensions,
    }),
  });

  const body = await response.text();

  console.log("HTTP Status:", response.status);
  console.log(body);

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status}`);
  }

  const result = JSON.parse(body);
  const vector = result?.data?.[0]?.embedding;

  console.log("Vector received:", !!vector);
  console.log("Vector length:", vector?.length);

  if (vector?.length !== dimensions) {
    throw new Error(
      `Dimension mismatch. Expected ${dimensions}, received ${vector?.length}`
    );
  }

  console.log("✅ Embedding test PASSED");
}

testEmbedding().catch((error) => {
  console.error("❌ Embedding test FAILED");
  console.error(error.message);
  process.exit(1);
});
