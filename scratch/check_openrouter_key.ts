import "dotenv/config";

async function check() {
  const r = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
  });
  const data = await r.json();
  console.log("Auth key data:", JSON.stringify(data, null, 2));

  // Also fetch list of free models available
  const mRes = await fetch("https://openrouter.ai/api/v1/models");
  const mData = await mRes.json();
  const freeModels = (mData.data || [])
    .filter((m: any) => m.id?.endsWith(":free") || m.pricing?.prompt === "0")
    .map((m: any) => m.id);
  console.log("Free models count:", freeModels.length);
  console.log("Sample free models:", freeModels.slice(0, 15));
}
check();
