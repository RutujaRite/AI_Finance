import dotenv from "dotenv";
dotenv.config();

async function getFreeModels() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const data = await res.json();
  const free = data.data
    .filter((m: any) => m.id.endsWith(":free"))
    .map((m: any) => ({ id: m.id, name: m.name, context_length: m.context_length }));
  console.log("Free models available on OpenRouter:", free);
  process.exit(0);
}

getFreeModels().catch(console.error);
