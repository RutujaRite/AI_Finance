import { runCentralAgent } from "../lib/ai/agent";

async function runPolicyTests() {
  console.log("=== STARTING COMPREHENSIVE POLICY TESTS ===");

  const queries = [
    { bank: "Finnable Credit", message: "Tell me about Finnable Credit loan policy" },
    { bank: "HDFC Bank", message: "What is HDFC Bank personal loan policy?" },
    { bank: "Tata Capital", message: "Can you provide the Tata Capital loan policy guidelines?" },
    { bank: "Kotak Mahindra Bank", message: "What is the loan policy for Kotak Mahindra Bank?" },
  ];

  const requiredSections = [
    "Eligibility Criteria (Age, CIBIL, Work Experience)",
    "Salary & Bank Requirements (NTH, Payment Mode)",
    "Loan Parameters (Min/Max Amount, Tenure, ROI)",
    "Document Requirements",
    "Rejection Rules & Exceptions"
  ];

  let allPassed = true;

  for (const q of queries) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing query: "${q.message}" (${q.bank})`);
    const result = await runCentralAgent({ message: q.message, conversationId: `test-${Date.now()}` });
    const reply = result.reply || "";

    console.log(`Reply preview (first 250 chars):\n${reply.slice(0, 250)}...`);

    // 1. Check all 5 sections exist
    for (const sec of requiredSections) {
      const hasSec = reply.toLowerCase().includes(sec.toLowerCase());
      if (!hasSec) {
        console.error(`❌ FAILED: Missing section "${sec}" in response for ${q.bank}`);
        allPassed = false;
      } else {
        console.log(`✅ Found section: "${sec}"`);
      }
    }

    // 2. Check no truncation into small incomplete tables
    if (reply.includes("| Criteria | Details |")) {
      console.error(`❌ FAILED: Found old truncated 2-column table in response for ${q.bank}`);
      allPassed = false;
    } else {
      console.log(`✅ No truncated 2-column tables found`);
    }

    // 3. Check for internal debug tokens
    if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|\[CONFLICT\]|postgresql/i.test(reply)) {
      console.error(`❌ FAILED: Found internal debug tokens in response for ${q.bank}`);
      allPassed = false;
    } else {
      console.log(`✅ Clean from internal debug tokens`);
    }

    // Specific bank checks
    if (q.bank === "Finnable Credit") {
      const hasNEFT = /neft/i.test(reply);
      const hasCIBIL700 = /700/i.test(reply);
      const has10Lakh = /10,00,000|10\s*lakh/i.test(reply);
      const has30DPD = /30\s*dpd/i.test(reply);
      console.log(`Finnable specifics: NEFT=${hasNEFT}, CIBIL 700=${hasCIBIL700}, 10L Max=${has10Lakh}, 30 DPD rule=${has30DPD}`);
      if (!hasNEFT || !hasCIBIL700 || !has10Lakh || !has30DPD) {
        console.error("❌ FAILED: Missing key criteria details for Finnable Credit");
        allPassed = false;
      }
    }
  }

  if (allPassed) {
    console.log("\n🎉 ALL COMPREHENSIVE POLICY TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error("\n❌ SOME TESTS FAILED.");
    process.exit(1);
  }
}

runPolicyTests().catch((err) => {
  console.error("Error running policy tests:", err);
  process.exit(1);
});
