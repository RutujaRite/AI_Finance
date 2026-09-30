import { runCentralAgent } from "../lib/ai/agent";

async function main() {
  const convId = `test-multiturn-${Date.now()}`;
  console.log("=== TURN 1: 'search company tata' ===");
  const t1 = await runCentralAgent({
    message: "search company tata",
    conversationId: convId,
  });
  console.log("T1 Reply:\n", t1.reply?.slice(0, 100));
  console.log("T1 Candidates count:", t1.companyData?.candidates?.length);

  console.log("\n=== TURN 2: 'matching compies list not displaying' ===");
  const t2 = await runCentralAgent({
    message: "matching compies list not displaying",
    conversationId: convId,
  });
  console.log("T2 Reply:\n", t2.reply?.slice(0, 150));
  console.log("T2 CompanyData:", JSON.stringify(t2.companyData, null, 2));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
