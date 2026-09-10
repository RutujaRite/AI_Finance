import "dotenv/config";
import { getResolvedMasterPolicies } from "../lib/masterPolicies";
import { getMasterPolicyFileContent } from "../lib/masterPolicyParser";

async function testBankPolicy() {
  const bankName = "HDFC";
  const userMessage = "What is HDFC's maximum tenure for Super A?";
  const all = getResolvedMasterPolicies();
  const bank = all.find(b => b.bank_name.toLowerCase().includes(bankName.toLowerCase()));
  console.log("Matched bank:", bank?.bank_name, "File:", bank?.file_name);

  const policyContent = getMasterPolicyFileContent(bank!.file_name);
  console.log("Policy content length:", policyContent.length);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "CreditWise AI",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      max_tokens: 450,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            `You are CreditWise AI, a verified banking intelligence assistant.\n` +
            `The user is asking: "${userMessage}".\n` +
            `Answer strictly and only based on the official ${bank!.bank_name} Master Policy text provided below.\n` +
            `Do NOT guess, invent values, or borrow rules from any other bank.\n` +
            `If a value (like absolute minimum CIBIL cutoff) is not explicitly defined in this policy, clearly state that it is not specified in the Master Policy and note whether pricing bands exist.\n\n` +
            `--- ${bank!.bank_name.toUpperCase()} MASTER POLICY ---\n` +
            policyContent.slice(0, 12000),
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response:\n", data.choices?.[0]?.message?.content);
}

testBankPolicy();
