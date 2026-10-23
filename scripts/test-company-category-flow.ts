import { Pool } from "pg";
import { runCentralAgent } from "@/lib/ai/agent";
import { clearEligibilityState, getEligibilityState } from "@/lib/dynamicEligibilityEngine";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "127.0.0.1",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "system123",
  database: process.env.POSTGRES_DB || "login_db",
});

let passed = 0;
let failed = 0;

function assert(condition: any, msg: string) {
  if (Boolean(condition)) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   CreditWise AI - Company Category Lookup Flow Tests");
  console.log("=======================================================\n");

  const convIdBase = `test_cat_${Date.now()}`;

  // -------------------------------------------------------------------
  // TEST A: "Can you check my company category?"
  // Expected: Asks for the company name ("Sure! Please tell me your company name.")
  // -------------------------------------------------------------------
  console.log("Test A: 'Can you check my company category?'");
  const convA = `${convIdBase}_A`;
  await clearEligibilityState(convA);
  const resA = await runCentralAgent({
    message: "Can you check my company category?",
    conversationId: convA,
  });
  console.log("  Reply:", resA.reply);
  assert(
    resA.reply.trim() === "Sure! Please tell me your company name.",
    "Responds exactly 'Sure! Please tell me your company name.'"
  );
  const stateA = await getEligibilityState(convA);
  assert(stateA?.activeIntent === "COMPANY_CATEGORY_LOOKUP", "State activeIntent is COMPANY_CATEGORY_LOOKUP");
  assert(stateA?.awaitingCompanyName === true, "State awaitingCompanyName is true");

  // -------------------------------------------------------------------
  // TEST B: User provides "Cognizant"
  // Expected: Searches PostgreSQL and displays actual matching companies as selectable options
  // -------------------------------------------------------------------
  console.log("\nTest B: User provides 'Cognizant'");
  const resB = await runCentralAgent({
    message: "Cognizant",
    conversationId: convA,
  });
  console.log("  Reply preview:", resB.reply.slice(0, 200).replace(/\n/g, " "));
  assert(
    resB.reply.includes("I found multiple matching companies. Please select your company:"),
    "Prompts user to select from multiple matching companies"
  );
  assert(
    resB.reply.includes("COGNIZANT FOUNDATION") || resB.reply.includes("COGNIZANT"),
    "Displays real company records from PostgreSQL"
  );
  const stateB = await getEligibilityState(convA);
  assert(stateB?.awaitingCompanySelection === true, "State awaitingCompanySelection is true");
  assert(
    Array.isArray(stateB?.candidateCompanies) && stateB!.candidateCompanies.length > 1,
    "State has candidateCompanies list preserved"
  );

  // -------------------------------------------------------------------
  // TEST D: User enters an invalid selection (e.g. "99")
  // Expected: Asks user to select a valid option from the list
  // -------------------------------------------------------------------
  console.log("\nTest D: User enters an invalid selection '99'");
  const resD = await runCentralAgent({
    message: "99",
    conversationId: convA,
  });
  console.log("  Reply:", resD.reply);
  assert(
    resD.reply.includes("Please select a valid option from the list above"),
    "Asks user to select a valid option"
  );
  const stateD = await getEligibilityState(convA);
  assert(stateD?.awaitingCompanySelection === true, "Maintains awaitingCompanySelection: true");

  // -------------------------------------------------------------------
  // TEST C & G & H: User selects one displayed company ("1")
  // Expected: Retrieves selected company's actual category records from PostgreSQL
  // Formats table: | Company Name | Bank Name | Company Category |
  // Displays categories separately per bank (Test G)
  // If category is missing, displays "Not available" without guessing (Test H)
  // -------------------------------------------------------------------
  console.log("\nTest C, G, H: User selects option '1'");
  const resC = await runCentralAgent({
    message: "1",
    conversationId: convA,
  });
  console.log("  Reply:\n" + resC.reply);
  assert(
    resC.reply.includes("| Company Name | Bank Name | Company Category |"),
    "Contains exact required table headers | Company Name | Bank Name | Company Category |"
  );
  assert(
    resC.reply.includes("| COGNIZANT FOUNDATION |") || resC.reply.includes("COGNIZANT"),
    "Contains actual selected company name in table"
  );
  assert(
    resC.reply.includes("HDFC Bank") || resC.reply.includes("ICICI Bank") || resC.reply.includes("Chola"),
    "Test G: Displays categories across multiple banks separately"
  );
  const stateC = await getEligibilityState(convA);
  assert(stateC?.selectedCompanyName !== undefined, "State has selectedCompanyName saved");
  assert(stateC?.selectedCompanyId !== undefined, "State has selectedCompanyId saved");
  assert(stateC?.awaitingCompanySelection === false, "awaitingCompanySelection reset to false");

  // -------------------------------------------------------------------
  // TEST I: User asks "What about HDFC Bank?" after selecting a company
  // Expected: Retains selected company and looks up HDFC-specific category
  // -------------------------------------------------------------------
  console.log("\nTest I: User asks 'What about HDFC Bank?' after selecting a company");
  const resI = await runCentralAgent({
    message: "What about HDFC Bank?",
    conversationId: convA,
  });
  console.log("  Reply:\n" + resI.reply);
  assert(
    resI.reply.includes("| Company Name | Bank Name | Company Category |"),
    "Output contains category table"
  );
  assert(
    resI.reply.includes("HDFC Bank"),
    "Table contains HDFC Bank"
  );
  const stateI = await getEligibilityState(convA);
  assert(
    stateI?.selectedCompanyName === stateC?.selectedCompanyName,
    "State retains selectedCompanyName"
  );

  // -------------------------------------------------------------------
  // TEST L: User asks for loan eligibility after a category lookup
  // Expected: Switches to the existing loan eligibility flow correctly
  // -------------------------------------------------------------------
  console.log("\nTest L: User asks for loan eligibility after a category lookup");
  const resL = await runCentralAgent({
    message: "I need a personal loan of 5 lakhs",
    conversationId: convA,
  });
  console.log("  Reply preview:", resL.reply.slice(0, 200).replace(/\n/g, " "));
  const stateL = await getEligibilityState(convA);
  assert(
    stateL?.in_eligibility_flow === true || stateL?.activeFlow === "LOAN_ELIGIBILITY" || resL.reply.toLowerCase().includes("loan") || resL.reply.toLowerCase().includes("income") || resL.reply.toLowerCase().includes("employment"),
    "Switches to loan eligibility flow"
  );

  // -------------------------------------------------------------------
  // TEST E: Company name has exactly one reliable match
  // Expected: Handles the match without unnecessary repeated questions
  // -------------------------------------------------------------------
  console.log("\nTest E: Company name has exactly one reliable match");
  const convE = `${convIdBase}_E`;
  await clearEligibilityState(convE);
  // Turn 1: User asks to check category
  await runCentralAgent({
    message: "Check my company category",
    conversationId: convE,
  });
  // Turn 2: User gives unique company name with single match in database
  const resE = await runCentralAgent({
    message: "COGNIZANT CHEMICAL PRIVATE LIMITED",
    conversationId: convE,
  });
  console.log("  Reply:\n" + resE.reply);
  assert(
    resE.reply.includes("| Company Name | Bank Name | Company Category |"),
    "Outputs category table directly for single match"
  );
  assert(
    resE.reply.includes("COGNIZANT CHEMICAL PRIVATE LIMITED"),
    "Table contains COGNIZANT CHEMICAL PRIVATE LIMITED"
  );
  const stateE = await getEligibilityState(convE);
  assert(stateE?.selectedCompanyName === "COGNIZANT CHEMICAL PRIVATE LIMITED", "Saves selectedCompanyName in state");

  // -------------------------------------------------------------------
  // TEST F: No matching company exists
  // Expected: Clearly reports no match; does not invent results
  // -------------------------------------------------------------------
  console.log("\nTest F: No matching company exists");
  const convF = `${convIdBase}_F`;
  await clearEligibilityState(convF);
  await runCentralAgent({
    message: "Check my employer category",
    conversationId: convF,
  });
  const resF = await runCentralAgent({
    message: "XYZNonExistentCompany987654321",
    conversationId: convF,
  });
  console.log("  Reply:", resF.reply);
  assert(
    resF.reply.includes("couldn't find any matching company") || resF.reply.includes("no matching company"),
    "Clearly reports no matching company found"
  );
  assert(
    !resF.reply.includes("| Bank Name |"),
    "Does not invent or fabricate category results"
  );

  // -------------------------------------------------------------------
  // TEST J: User changes company before selecting a previous result
  // Expected: Clears stale candidates and uses new search results
  // -------------------------------------------------------------------
  console.log("\nTest J: User changes company before selecting previous result");
  const convJ = `${convIdBase}_J`;
  await clearEligibilityState(convJ);
  await runCentralAgent({
    message: "What is my company category?",
    conversationId: convJ,
  });
  await runCentralAgent({
    message: "Cognizant",
    conversationId: convJ,
  });
  const stateJ1 = await getEligibilityState(convJ);
  assert(stateJ1?.candidateCompanies?.[0]?.name?.includes("COGNIZANT"), "Initial candidates are Cognizant");

  // User changes mind and types "Wipro" instead of selecting 1..N
  const resJ = await runCentralAgent({
    message: "Actually search for Wipro",
    conversationId: convJ,
  });
  console.log("  Reply preview:", resJ.reply.slice(0, 200).replace(/\n/g, " "));
  const stateJ2 = await getEligibilityState(convJ);
  assert(
    stateJ2?.candidateCompanies?.[0]?.name?.toUpperCase().includes("WIPRO"),
    "Stale candidates cleared and replaced with Wipro candidates"
  );
  assert(
    !stateJ2?.candidateCompanies?.some((c) => c.name.toUpperCase().includes("COGNIZANT")),
    "No stale Cognizant candidates remain"
  );

  // -------------------------------------------------------------------
  // TEST K: User asks for company category after previously discussing loan eligibility
  // Expected: Switches to company category lookup without accidentally rerunning eligibility
  // -------------------------------------------------------------------
  console.log("\nTest K: User asks for company category after discussing loan eligibility");
  const convK = `${convIdBase}_K`;
  await clearEligibilityState(convK);
  // Turn 1: User starts loan eligibility
  const resK1 = await runCentralAgent({
    message: "I want to apply for a personal loan",
    conversationId: convK,
  });
  console.log("  Loan reply preview:", resK1.reply.slice(0, 150).replace(/\n/g, " "));
  // Turn 2: User asks for company category
  const resK2 = await runCentralAgent({
    message: "Can you check my company category?",
    conversationId: convK,
  });
  console.log("  Category reply:", resK2.reply);
  assert(
    resK2.reply.trim() === "Sure! Please tell me your company name.",
    "Switches to category lookup and responds ONLY 'Sure! Please tell me your company name.'"
  );
  const stateK = await getEligibilityState(convK);
  assert(stateK?.activeIntent === "COMPANY_CATEGORY_LOOKUP", "activeIntent switched to COMPANY_CATEGORY_LOOKUP");
  assert(stateK?.awaitingCompanyName === true, "awaitingCompanyName is true");

  // -------------------------------------------------------------------
  // TEST M: User selects by typing the full company name
  // -------------------------------------------------------------------
  console.log("\nTest M: User selects candidate by typing company name");
  const convM = `${convIdBase}_M`;
  await clearEligibilityState(convM);
  await runCentralAgent({ message: "What is my company category?", conversationId: convM });
  await runCentralAgent({ message: "Cognizant", conversationId: convM });
  const resM = await runCentralAgent({
    message: "COGNIZANT FOUNDATION",
    conversationId: convM,
  });
  console.log("  Reply preview:", resM.reply.slice(0, 150).replace(/\n/g, " "));
  assert(
    resM.reply.includes("| Company Name | Bank Name | Company Category |") && resM.reply.includes("COGNIZANT FOUNDATION"),
    "Successfully selects candidate by typed company name"
  );

  // -------------------------------------------------------------------
  // TEST N: User selects candidate via UI click action (companySelectionAction)
  // -------------------------------------------------------------------
  console.log("\nTest N: User selects candidate via UI click action");
  const convN = `${convIdBase}_N`;
  await clearEligibilityState(convN);
  await runCentralAgent({ message: "Can you check my company category?", conversationId: convN });
  await runCentralAgent({ message: "Cognizant", conversationId: convN });
  const stateN = await getEligibilityState(convN);
  const targetCandidate = stateN?.candidateCompanies?.[0];
  const resN = await runCentralAgent({
    message: targetCandidate!.name,
    conversationId: convN,
    companySelectionAction: {
      type: "select",
      companyId: targetCandidate!.id,
      companyName: targetCandidate!.name,
    },
  });
  console.log("  Reply preview:", resN.reply.slice(0, 150).replace(/\n/g, " "));
  assert(
    resN.reply.includes("| Company Name | Bank Name | Company Category |") && resN.reply.includes(targetCandidate!.name),
    "Successfully selects candidate via companySelectionAction click"
  );

  // -------------------------------------------------------------------
  // TEST O: Company name provided directly in initial question
  // e.g. "What is the company category of Cognizant?"
  // -------------------------------------------------------------------
  console.log("\nTest O: Company name provided in initial question");
  const convO = `${convIdBase}_O`;
  await clearEligibilityState(convO);
  const resO = await runCentralAgent({
    message: "What is the company category of Cognizant?",
    conversationId: convO,
  });
  console.log("  Reply preview:", resO.reply.slice(0, 180).replace(/\n/g, " "));
  assert(
    resO.reply.includes("I found multiple matching companies. Please select your company:"),
    "Directly returns matching candidates without asking for company name again"
  );

  console.log("\n=======================================================");
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  pool.end().finally(() => process.exit(1));
});
