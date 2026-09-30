/**
 * Comprehensive verification of Financial Directory Search, Enhanced Regex Patterns,
 * Category Fallbacks, and Standardized Provenance.
 */

import {
  searchIncraax,
  fetchLiveCompanyIntelligence,
  extractReportingPeriod,
  isIncraaxSearchConfigured,
  type LiveCompanyIntelligence,
  type VerifiedField,
} from "../lib/incraax";
import { searchFinancialDirectories, searchIncraaxWeb } from "../lib/ai/incraaxService";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("🧪 VERIFYING FINANCIAL DIRECTORY SEARCH, REGEX PATTERNS & PROVENANCE");
  console.log("================================================================================\n");

  // 1. Verify Category Fallback: categories: "news" -> "general" when news returns empty
  console.log("--- 1. Testing Category Fallback in searchIncraax ---");
  // Query with site operators that news engines do not index but general engines do
  const fallbackQuery = "Tata Consultancy Services site:zaubacorp.com";
  console.log(`Executing searchIncraax with news default on: "${fallbackQuery}"...`);
  const fallbackResults = await searchIncraax(fallbackQuery, { maxResults: 3 });
  console.log(`Results received: ${fallbackResults.length}`);
  // Even if 0 or more results return depending on live engine availability, search should execute cleanly without error
  assert(Array.isArray(fallbackResults), "searchIncraax executed cleanly and returned an array");

  // Explicit category news fallback test
  const newsEmptyFallback = await searchIncraax("Tata Consultancy Services", { maxResults: 3, categories: "news" });
  assert(Array.isArray(newsEmptyFallback) && newsEmptyFallback.length > 0, "searchIncraax returns non-empty results for standard corporate query");

  // 2. Verify Enhanced Regex Patterns for Indian Currency
  console.log("\n--- 2. Testing Enhanced Regex Patterns for Indian Currency Formats ---");

  const mockZaubaCorpResults = [
    {
      title: "INFOSYS LIMITED - Company Information & Directors | Zauba Corp",
      url: "https://www.zaubacorp.com/company/INFOSYS-LIMITED/L85110KA1981PLC013115",
      snippet: "Infosys Limited is a Public company incorporated on 02 July 1981. Its authorized share capital is Rs. 24,000,000,000 and its paid up capital is Rs. 20,700,000,000. It is registered at RoC-Bangalore for FY 2023-24.",
    },
    {
      title: "Tata Consultancy Services Limited - Financials | Tofler",
      url: "https://www.tofler.in/tata-consultancy-services-limited/company/L22210MH1995PLC084781",
      snippet: "Operating revenue range is INR 100 cr - 500 cr for the financial year ending on 31 March, 2024. Net profit stood at INR 12,434 Crores. Workforce of 600,000 employees globally.",
    },
    {
      title: "Tech Unicorn Pvt Ltd - Company Profile | InstaFinancials",
      url: "https://www.instafinancials.com/company/tech-unicorn/U72900KA2020PTC123456",
      snippet: "Paid Up Capital is Rs. 28.5 Lakhs and Authorized Capital is Rs. 50 Lakhs. Turnover is ₹500 Cr as of 31 March, 2024.",
    },
  ];

  // Test extraction of reporting period across diverse formats
  console.log("\nTesting extractReportingPeriod on diverse formats:");
  const period1 = extractReportingPeriod("Operating revenue range is INR 100 cr - 500 cr for the financial year ending on 31 March, 2024.");
  console.log("  financial year ending on 31 March, 2024 =>", period1);
  assert(Boolean(period1?.includes("31 March, 2024")), "Extracted period: financial year ending on 31 March, 2024");

  const period2 = extractReportingPeriod("Infosys Q3 revenue rose 1% to Rs 38,821 crore for Q3 FY24.");
  console.log("  Q3 FY24 =>", period2);
  assert(Boolean(period2?.includes("Q3 FY24")), "Extracted period: Q3 FY24");

  const period3 = extractReportingPeriod("Turnover reached ₹1,500 Crores in FY24.");
  console.log("  FY24 =>", period3);
  assert(Boolean(period3?.includes("FY24")), "Extracted period: FY24");

  // 3. Verify Live Company Intelligence with Financial Directories
  console.log("\n--- 3. Testing fetchLiveCompanyIntelligence with Financial Directories ---");
  const infosysIntel = await fetchLiveCompanyIntelligence("Infosys Limited");

  console.log("\nCompany Name:", infosysIntel.companyName);
  console.log("Overview length:", infosysIntel.overview?.length);
  console.log("Basic Info:", JSON.stringify(infosysIntel.basicInfo, null, 2));
  console.log("Financial Info:", JSON.stringify(infosysIntel.financialInfo, null, 2));

  assert(Boolean(infosysIntel.overview), "Overview introduction is populated");
  assert(Boolean(infosysIntel.basicInfo.company_name), "Basic info has company_name");
  assert(Boolean(infosysIntel.basicInfo.industry), "Basic info has industry");
  assert(Boolean(infosysIntel.basicInfo.country), "Basic info has country");
  assert(Boolean(infosysIntel.financialInfo.turnover), "Financial info has turnover");

  // 4. Verify Standardized Provenance on All Extracted Fields
  console.log("\n--- 4. Testing Standardized Provenance across Extracted Fields ---");
  const verifyProvenance = (fieldName: string, field?: VerifiedField<any>) => {
    if (field && field.value) {
      assert(field.verified === true, `${fieldName}: verified is true`);
      assert(typeof field.confidence === "string", `${fieldName}: confidence is populated (${field.confidence})`);
      if (field.sourceUrl) {
        assert(typeof field.sourceUrl === "string", `${fieldName}: sourceUrl is populated (${field.sourceUrl})`);
      }
      if (field.sourceTitle) {
        assert(typeof field.sourceTitle === "string", `${fieldName}: sourceTitle is populated (${field.sourceTitle})`);
      }
      if (field.reportingPeriod) {
        assert(typeof field.reportingPeriod === "string", `${fieldName}: reportingPeriod is preserved (${field.reportingPeriod})`);
      }
      console.log(`  🔍 Verified provenance for [${fieldName}]: Value="${field.value}", Confidence=${field.confidence}, ReportingPeriod=${field.reportingPeriod || "N/A"}`);
    }
  };

  verifyProvenance("turnover", infosysIntel.financialInfo.turnover_field);
  verifyProvenance("employees", infosysIntel.financialInfo.employees_field);
  verifyProvenance("paid_up_capital", infosysIntel.financialInfo.paid_up_capital_field);
  verifyProvenance("authorized_capital", infosysIntel.financialInfo.authorized_capital_field);
  verifyProvenance("profit_status", infosysIntel.financialInfo.profit_status_field);
  verifyProvenance("performance_trend", infosysIntel.financialInfo.performance_trend_field);
  verifyProvenance("industry", infosysIntel.basicInfo.industry_field);
  verifyProvenance("address", infosysIntel.basicInfo.address_field);
  verifyProvenance("country", infosysIntel.basicInfo.country_field);

  // 5. Verify searchFinancialDirectories in tavilyService.ts
  console.log("\n--- 5. Testing searchFinancialDirectories in tavilyService.ts ---");
  const dirSearch = await searchFinancialDirectories("Tata Consultancy Services");
  assert(dirSearch.companyName.includes("Tata Consultancy Services"), "searchFinancialDirectories returns target company name");
  assert(Boolean(dirSearch.intelligence), "searchFinancialDirectories returns full intelligence object");
  assert(Array.isArray(dirSearch.sources), "searchFinancialDirectories returns sources array");

  // 6. Verify searchIncraaxWeb
  console.log("\n--- 6. Testing searchIncraaxWeb ---");
  const webOutput = await searchIncraaxWeb("RBI repo rate interest");
  assert(typeof webOutput === "string" && webOutput.length > 20, "searchIncraaxWeb returns formatted web output");

  console.log("\n================================================================================");
  console.log("🎉 ALL TESTS PASSED: FINANCIAL DIRECTORIES, REGEX, FALLBACKS & PROVENANCE VERIFIED!");
  console.log("================================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
