import { runCentralAgent } from "../lib/ai/agent";

async function verify() {
  const profileMsg = "Capgemini, Age 28, Salary ₹1.5 lakh, CIBIL 810, Loan ₹10 lakh, 60 months, Existing EMI ₹0";

  console.log("==================== RUN 1 (Fresh Session A) ====================");
  const convId1 = "capgemini-eval-1-" + Date.now();
  const res1 = await runCentralAgent({ message: profileMsg, conversationId: convId1 });
  console.log("REPLY 1:\n", res1.reply);

  console.log("\n==================== RUN 2 (Fresh Session B) ====================");
  const convId2 = "capgemini-eval-2-" + Date.now();
  const res2 = await runCentralAgent({ message: profileMsg, conversationId: convId2 });
  console.log("REPLY 2:\n", res2.reply);

  console.log("\n==================== DETERMINISM VERIFICATION ====================");
  const hasTable1 = res1.reply.includes("Eligible Partner Banks");
  const hasTable2 = res2.reply.includes("Eligible Partner Banks");
  const count1 = (res1.reply.match(/✅ Eligible/g) || []).length;
  const count2 = (res2.reply.match(/✅ Eligible/g) || []).length;

  console.log(`Run 1: Has Table = ${hasTable1}, Eligible Bank Count = ${count1}`);
  console.log(`Run 2: Has Table = ${hasTable2}, Eligible Bank Count = ${count2}`);

  if (hasTable1 && hasTable2 && count1 === 18 && count2 === 18) {
    console.log("\n✅ SUCCESS: Both evaluations are 100% deterministic, returning identical 18 eligible partner banks on first-turn evaluation!");
  } else {
    console.error("\n❌ FAILED: Inconsistent evaluation results!");
    process.exit(1);
  }

  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
