import { runCentralAgent } from "../lib/ai/agent";

async function main() {
  const queries = [
    "tata",
    "search company tata",
    "give me information of tata",
    "tell me about tata",
    "matching companies list",
    "matching compies list",
    "show matching companies for tata",
  ];

  for (const q of queries) {
    console.log(`\n==============================================`);
    console.log(`QUERY: "${q}"`);
    console.log(`==============================================`);
    const res = await runCentralAgent({
      message: q,
      conversationId: `test-q-${Date.now()}-${Math.random()}`,
    });
    console.log("REPLY FIRST 120 CHARS:", res.reply?.slice(0, 120));
    console.log("HAS COMPANY DATA:", Boolean(res.companyData));
    console.log("COMPANY FLOW:", res.companyData?.company_flow);
    console.log("NEEDS DISAMBIGUATION:", res.companyData?.needs_disambiguation);
    console.log("CANDIDATES COUNT:", res.companyData?.candidates?.length);
    console.log("CANDIDATE OPTIONS COUNT:", res.companyData?.candidateOptions?.length);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
