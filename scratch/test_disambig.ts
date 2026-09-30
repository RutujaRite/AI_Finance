import { runCentralAgent } from "../lib/ai/agent";

async function main() {
  console.log("--- TEST 1: standalone 'tata' ---");
  const r1 = await runCentralAgent({
    message: "tata",
    conversationId: "test-conv-disambig-1",
  });
  console.log("r1 reply:\n", r1.reply);
  console.log("r1 companyData:\n", JSON.stringify(r1.companyData, null, 2));

  console.log("\n--- TEST 2: 'company search' followed by 'tata' ---");
  const r2a = await runCentralAgent({
    message: "company search",
    conversationId: "test-conv-disambig-2",
  });
  console.log("r2a reply:\n", r2a.reply);
  console.log("r2a companyData:\n", JSON.stringify(r2a.companyData, null, 2));

  const r2b = await runCentralAgent({
    message: "tata",
    conversationId: "test-conv-disambig-2",
  });
  console.log("r2b reply:\n", r2b.reply);
  console.log("r2b companyData:\n", JSON.stringify(r2b.companyData, null, 2));

  console.log("\n--- TEST 3: Loan eligibility flow employer 'tata' ---");
  const r3a = await runCentralAgent({
    message: "I want a personal loan",
    conversationId: "test-conv-disambig-3",
  });
  console.log("r3a reply:\n", r3a.reply);

  const r3b = await runCentralAgent({
    message: "tata",
    conversationId: "test-conv-disambig-3",
  });
  console.log("r3b reply:\n", r3b.reply);
  console.log("r3b companyData:\n", JSON.stringify(r3b.companyData, null, 2));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
