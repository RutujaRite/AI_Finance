import { PolicyPgVectorRetriever } from "../lib/policyRetrieval";
import { buildPolicyContext, POLICY_RAG_SYSTEM_PROMPT } from "../lib/policyRag";
import { resolveDynamicApiKey, sanitizeApiKey } from "../lib/ai/keyResolution";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

async function main() {
  const query = "give me hdfc bank policy";
  const retriever = new PolicyPgVectorRetriever({
    policyFileId: 16,
    bankId: 5,
    bankName: "HDFC Bank",
    bankCode: "HDFC",
    fileName: "HDFC_Bank_Master_Policy.txt",
    topK: 6,
  });

  const rawDocs = await retriever.invoke(query);
  console.log("rawDocs count:", rawDocs.length);
  rawDocs.forEach((d, idx) => {
    console.log(`[Chunk ${idx}] len=${d.pageContent.length} meta=`, d.metadata);
    console.log(`Snippet: ${d.pageContent.slice(0, 150).replace(/\n/g, ' ')}\n`);
  });

  const { context: policyContext, sources } = buildPolicyContext(rawDocs, {
    bankName: "HDFC Bank",
    policyFileId: 16,
  });
  console.log("\npolicyContext total length:", policyContext.length);
  console.log("=== POLICY CONTEXT PREVIEW (first 1000 chars) ===");
  console.log(policyContext.slice(0, 1000));
  console.log("=== END PREVIEW ===\n");

  const resolved = await resolveDynamicApiKey("openrouter");
  const apiKey = sanitizeApiKey(resolved?.apiKey);
  console.log("API Key found?", Boolean(apiKey));
  console.log("Model from env or fallback:", process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free");

  const model = new ChatOpenAI({
    apiKey,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "CreditWise AI",
      },
    },
    model: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free",
    temperature: 0.1,
    maxTokens: 800,
    modelKwargs: {
      reasoning: { max_tokens: 0 },
    },
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", POLICY_RAG_SYSTEM_PROMPT],
    ["human", "{query}"],
  ]);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  console.log("Calling LLM chain directly...");
  const rawAnswer = await chain.invoke({
    query: query.trim(),
    policy_context: policyContext.trim(),
  });

  console.log("\n=== RAW ANSWER FROM LLM ===");
  console.log(rawAnswer);
  console.log("=== END RAW ANSWER ===");

  process.exit(0);
}

main().catch(console.error);
