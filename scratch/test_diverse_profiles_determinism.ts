import { runCentralAgent } from "../lib/ai/agent";

async function runDiverseTest() {
  const profiles = [
    {
      name: "TCS Profile",
      msg: "TCS, Age 32, Salary ₹1.2 lakh, CIBIL 770, Loan ₹8 lakh, 48 months, Existing EMI ₹0",
    },
    {
      name: "Infosys Profile",
      msg: "Infosys, Age 26, Salary ₹90,000, CIBIL 790, Loan ₹5 lakh, 36 months, Existing EMI ₹10,000",
    },
    {
      name: "Wipro Profile",
      msg: "Wipro, Age 30, Salary ₹2 lakh, CIBIL 820, Loan ₹15 lakh, 60 months, Existing EMI ₹0",
    }
  ];

  for (const p of profiles) {
    console.log(`\n================ Testing ${p.name} ================`);
    const convId1 = "diverse-1-" + Date.now();
    const res1 = await runCentralAgent({ message: p.msg, conversationId: convId1 });
    const isEligible1 = res1.reply.includes("Eligible Partner Banks");
    console.log(`Run 1: isEligible=${isEligible1}`);

    const convId2 = "diverse-2-" + Date.now();
    const res2 = await runCentralAgent({ message: p.msg, conversationId: convId2 });
    const isEligible2 = res2.reply.includes("Eligible Partner Banks");
    console.log(`Run 2: isEligible=${isEligible2}`);

    if (isEligible1 !== isEligible2 || !isEligible1) {
      console.error(`FAILED determinism for ${p.name}!`);
      process.exit(1);
    }
    console.log(`PASSED: ${p.name} is deterministic and immediately evaluated!`);
  }

  console.log("\nALL DIVERSE PROFILES PASSED DETERMINISTICALLY!");
  process.exit(0);
}

runDiverseTest().catch(err => {
  console.error(err);
  process.exit(1);
});
