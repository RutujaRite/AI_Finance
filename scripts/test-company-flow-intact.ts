// scripts/test-company-flow-intact.ts

import { runCentralAgent } from "../lib/ai/agent";
import assert from "assert";

async function testCompanyFlowIntact() {
  console.log("================================================================================");
  console.log("🧪 TESTING COMPANY FLOW WHEN EXPLICITLY ASKED OR SPECIFIED");
  console.log("================================================================================\n");

  const convId = `test-comp-${Date.now()}`;

  // Step 1: User asks for a loan
  console.log("Step 1: User says 'I need a loan'");
  const step1 = await runCentralAgent({
    conversationId: convId,
    message: "I need a loan",
  });
  console.log("Assistant:", step1.reply);
  assert.ok(
    /employer|company/i.test(step1.reply),
    "Expected assistant to ask for employer/company"
  );

  // Step 2: User provides company name "Infosys" (matches multiple records: Infosys Limited, Infosys BPM, etc.)
  console.log("\nStep 2: User says 'Infosys'");
  const step2 = await runCentralAgent({
    conversationId: convId,
    message: "Infosys",
  });
  console.log("Assistant:\n" + step2.reply);
  assert.ok(
    /Infosys/i.test(step2.reply),
    "Expected assistant to recognize Infosys"
  );
  assert.ok(
    /multiple companies matching|select your exact employer|salary/i.test(step2.reply),
    "Expected assistant to either disambiguate matching employers or ask for salary"
  );

  // Step 2b: User selects exact employer "Infosys Limited"
  console.log("\nStep 2b: User says 'Infosys Limited'");
  const step2b = await runCentralAgent({
    conversationId: convId,
    message: "Infosys Limited",
  });
  console.log("Assistant:\n" + step2b.reply);
  assert.ok(
    /Infosys/i.test(step2b.reply),
    "Expected assistant to confirm Infosys"
  );
  assert.ok(
    /salary|take-home|income/i.test(step2b.reply),
    "Expected assistant to ask for salary/income as the next step"
  );

  console.log("\n✅ Company flow works as expected when expectedField is companyName!");

  // Step 3: Explicit company phrase in fresh session
  console.log("\nStep 3: User says 'I work at Google' in a fresh session");
  const freshConvId = `test-google-${Date.now()}`;
  const step3 = await runCentralAgent({
    conversationId: freshConvId,
    message: "I work at Google",
  });
  console.log("Assistant:\n" + step3.reply);
  assert.ok(
    /Google/i.test(step3.reply),
    "Expected assistant to recognize Google"
  );

  if (/confirm this is your employer/i.test(step3.reply)) {
    console.log("\nStep 3b: User confirms 'yes'");
    const step3b = await runCentralAgent({
      conversationId: freshConvId,
      message: "yes",
    });
    console.log("Assistant:\n" + step3b.reply);
    assert.ok(
      /salary|take-home|income/i.test(step3b.reply),
      "Expected assistant to advance to salary"
    );
  } else {
    assert.ok(
      /salary|take-home|income/i.test(step3.reply),
      "Expected assistant to advance to salary"
    );
  }

  console.log("\n✅ Explicit employment phrase 'I work at Google' works perfectly in fresh session!");
  console.log("\n🎉 ALL TESTS PASSED!");
  process.exit(0);
}

testCompanyFlowIntact().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
