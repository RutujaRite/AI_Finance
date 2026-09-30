/**
 * Test Suite: Incraax Live Search API & Company Corporate Intelligence
 * Verifies live Incraax Search API, Deep Search, and live company extraction.
 */

import {
  searchIncraax,
  fetchLiveCompanyIntelligence,
  isIncraaxSearchConfigured,
  INCRAAX_SEARCH_URL,
  INCRAAX_SEARCH_API_KEY,
} from "../lib/incraax";
import { searchCompany, formatCompanyResponse } from "../lib/companySearch";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runTests() {
  console.log("=================================================================");
  console.log("TESTING INCRAAX LIVE SEARCH API & CORPORATE INTELLIGENCE");
  console.log("=================================================================");

  // 1. Verify Configuration & Single Source of Truth
  console.log("\n--- 1. Testing Single Source of Truth & Configuration ---");
  console.log("API URL:", INCRAAX_SEARCH_URL);
  console.log("API Key configured:", isIncraaxSearchConfigured() ? "YES" : "NO");
  assert(isIncraaxSearchConfigured(), "Incraax Search is configured with valid API key");
  assert(
    INCRAAX_SEARCH_URL.includes("search.incraaxaiautomation.in"),
    "INCRAAX_SEARCH_URL points to official Incraax search instance"
  );

  // 2. Direct Live Search API Test
  console.log("\n--- 2. Testing Live Incraax Search API Call ---");
  const testResults = await searchIncraax("Tata Consultancy Services", { maxResults: 3 });
  console.log(`Received ${testResults.length} live search results`);
  assert(testResults.length > 0, "Live search returns non-empty result set");
  assert(Boolean(testResults[0].title), "Result 1 has title: " + testResults[0].title);
  assert(Boolean(testResults[0].url), "Result 1 has URL: " + testResults[0].url);
  assert(Boolean(testResults[0].snippet), "Result 1 has snippet");

  // 3. Live Deep Search Test (?deep=true)
  console.log("\n--- 3. Testing Incraax Deep Search (?deep=true) ---");
  const deepResults = await searchIncraax(
    "Infosys Limited company CIN revenue turnover headquarters",
    { maxResults: 5, deep: true }
  );
  console.log(`Deep search returned ${deepResults.length} live results`);
  assert(deepResults.length > 0, "Deep search returned results");

  // 4. Live Company Intelligence Extraction (Overview, Basic Info, Financials)
  console.log("\n--- 4. Testing fetchLiveCompanyIntelligence('Infosys') ---");
  const infosysIntel = await fetchLiveCompanyIntelligence("Infosys Limited");
  console.log("\nExtracted Live Overview:\n", infosysIntel.overview);
  console.log("\nExtracted Basic Info:\n", JSON.stringify(infosysIntel.basicInfo, null, 2));
  console.log("\nExtracted Financial Info:\n", JSON.stringify(infosysIntel.financialInfo, null, 2));

  assert(Boolean(infosysIntel.overview), "Overview introduction paragraph is present");
  assert((infosysIntel.overview?.length || 0) > 30, "Overview contains substantial company description");
  assert(Boolean(infosysIntel.basicInfo.company_name), "Basic info contains company_name");
  assert(Boolean(infosysIntel.basicInfo.industry), "Basic info contains industry");
  assert(Boolean(infosysIntel.basicInfo.country), "Basic info contains country");
  assert(Boolean(infosysIntel.basicInfo.address), "Basic info contains address");
  assert(Boolean(infosysIntel.financialInfo.turnover), "Financial info contains turnover / revenue");
  assert(Boolean(infosysIntel.financialInfo.employees), "Financial info contains employees / workforce");

  // 5. Integration with searchCompany('Tata Consultancy Services Limited') & formatCompanyResponse
  console.log("\n--- 5. Testing searchCompany('Tata Consultancy Services Limited') with Live Intelligence ---");
  const tcsRes = await searchCompany("Tata Consultancy Services Limited");
  assert(tcsRes.found, "searchCompany('TCS') found=true");
  assert(Boolean(tcsRes.overview), "tcsRes.overview is populated");
  assert(Boolean(tcsRes.basicInfo), "tcsRes.basicInfo is populated");
  assert(Boolean(tcsRes.financialInfo), "tcsRes.financialInfo is populated");
  assert(tcsRes.bankRecords.length > 0, "tcsRes.bankRecords contains database partner records");

  const formattedTcs = formatCompanyResponse(tcsRes);
  console.log("\nFormatted Output Preview:\n");
  console.log(formattedTcs.slice(0, 700) + "...\n");

  assert(formattedTcs.includes("Company Overview"), "Formatted response has Section 1: Company Overview");
  assert(formattedTcs.includes("Basic Information"), "Formatted response has Section 2: Basic Information");
  assert(formattedTcs.includes("Financial Information"), "Formatted response has Section 3: Financial Information");
  assert(formattedTcs.includes("Bank / Employer Records"), "Formatted response has Section 4: Bank / Employer Records");

  console.log("\n=================================================================");
  console.log("ALL INCRAAX LIVE SEARCH & INTELLIGENCE TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
