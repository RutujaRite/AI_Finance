import { runCentralAgent } from "../lib/ai/agent";

async function main() {
  const convId = `test-select-${Date.now()}`;
  console.log("=== TURN 1: 'search company tata' ===");
  const t1 = await runCentralAgent({
    message: "search company tata",
    conversationId: convId,
  });
  console.log("T1 Candidates count:", t1.companyData?.candidates?.length);

  console.log("\n=== TURN 2: Select candidate 1 ('TATA LIMITED') ===");
  const t2 = await runCentralAgent({
    message: "TATA LIMITED",
    conversationId: convId,
    companySelectionAction: {
      type: "select",
      companyName: "TATA LIMITED",
    },
  });
  console.log("T2 Reply:\n", t2.reply?.slice(0, 300));
  console.log("T2 companyData company_name:", t2.companyData?.company_name);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
