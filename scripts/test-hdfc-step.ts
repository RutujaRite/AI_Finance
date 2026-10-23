import { resolvePolicyTarget, answerPolicyWithRag } from "../lib/policyRag";

async function main() {
  const target = await resolvePolicyTarget("HDFC Bank");
  console.log("Target:", target);

  const res = await answerPolicyWithRag({
    query: "give me hdfc bank policy",
    policyFileId: target!.policyFileId,
    bankId: target!.bankId,
    bankName: target!.bankName,
    bankCode: target!.bankCode,
    fileName: target!.fileName,
    topK: 6,
  });

  console.log("\n=== FULL ANSWER ===");
  console.log(res.answer);
  console.log("=== END ANSWER ===");
  process.exit(0);
}

main().catch(console.error);
