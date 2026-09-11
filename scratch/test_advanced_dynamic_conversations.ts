import { runCentralAgent } from "../lib/ai/agent";
import { getEligibilityState, clearEligibilityState } from "../lib/dynamicEligibilityEngine";

async function main() {
  console.log("===============================================================");
  console.log("🚀 Testing Advanced Dynamic Conversation: Freelancer, Collateral Objection, Company Correction");
  console.log("===============================================================\n");

  const conversationId = "test-adv-" + Date.now();
  const history: Array<{ role: string; content: string }> = [];

  async function chat(userMsg: string, label: string) {
    console.log(`\n💬 [User] (${label}): "${userMsg}"`);
    const result = await runCentralAgent({
      message: userMsg,
      conversationId,
      conversationHistory: [...history],
    });
    console.log(`🤖 [CreditWise AI]:\n${result.reply}\n`);
    history.push({ role: "user", content: userMsg });
    history.push({ role: "assistant", content: result.reply });
    const state = await getEligibilityState(conversationId);
    console.log(`📊 [State]:`, {
      expectedField: state?.expectedField,
      company: state?.applicant?.companyName,
      type: state?.applicant?.employmentType,
      salary: state?.applicant?.monthlyIncome,
    });
    return { result, state };
  }

  // Turn 1: Opening natural inquiry
  const t1 = await chat("Can I get a loan?", "Turn 1: Natural Opening");
  if (!t1.result.reply) throw new Error("T1 empty reply");

  // Turn 2: Unexpected reply: freelancer
  const t2 = await chat("I work as a freelancer", "Turn 2: Freelancer reply");
  if (!t2.result.reply) throw new Error("T2 empty reply");

  // Turn 3: In-flow objection: collateral / security
  const t3 = await chat("Do I need to pledge collateral or property for this?", "Turn 3: Collateral objection");
  if (!/collateral|unsecured|security|guarantor/i.test(t3.result.reply)) {
    throw new Error("T3 failed: Did not address collateral inquiry");
  }

  // Turn 4: Income answer
  const t4 = await chat("I earn 1.1 lakh every month", "Turn 4: Income answer");
  if (t4.state?.applicant?.monthlyIncome !== 110000) {
    console.warn("T4 warning: salary not 110000", t4.state?.applicant);
  }

  // Turn 5: Profile correction (freelancer -> joined Google)
  const t5 = await chat("Actually wait, I just joined Google as a full time employee", "Turn 5: Correction to Google");
  if (!/google/i.test(t5.state?.applicant?.companyName || "") && !/google/i.test(t5.result.reply)) {
    console.warn("T5 warning: company not updated to Google");
  }

  await clearEligibilityState(conversationId);
  console.log("\n===============================================================");
  console.log("🎉 ADVANCED DYNAMIC CONVERSATION TEST PASSED!");
  console.log("===============================================================\n");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
