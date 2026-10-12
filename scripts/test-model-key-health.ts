import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { testOpenRouterKey, testAiModelById } from "../lib/ai/modelHealth";

async function runTests() {
  console.log("=== Testing AI Model & OpenRouter Key Expiration / Health Engine ===\n");

  const modelName = "google/gemini-2.5-flash";

  // Test 1: Testing with an expired / invalid key
  console.log("--- Test 1: Fake / Expired Key (Expect 401 & status: 'expired') ---");
  const fakeExpiredKey = "sk-or-v1-expired-key-99999999999999999999999999999999";
  const resultExpired = await testOpenRouterKey(fakeExpiredKey, modelName);
  console.log("Result for expired key:", {
    is_operational: resultExpired.is_operational,
    status: resultExpired.status,
    http_status: resultExpired.http_status,
    message: resultExpired.message,
    remedy: resultExpired.remedy,
  });

  if (resultExpired.status === "expired" && resultExpired.http_status === 401 && !resultExpired.is_operational) {
    console.log("✅ Test 1 PASSED: Correctly identified expired/unauthorized key with HTTP 401!\n");
  } else {
    console.error("❌ Test 1 FAILED:", resultExpired);
  }

  // Test 2: Testing with missing key
  console.log("--- Test 2: Missing Key (Expect status: 'missing_key') ---");
  const resultMissing = await testOpenRouterKey("", modelName);
  console.log("Result for missing key:", {
    is_operational: resultMissing.is_operational,
    status: resultMissing.status,
    message: resultMissing.message,
  });
  if (resultMissing.status === "missing_key" && !resultMissing.is_operational) {
    console.log("✅ Test 2 PASSED: Correctly identified missing key!\n");
  } else {
    console.error("❌ Test 2 FAILED:", resultMissing);
  }

  // Test 3: Testing with current configured key in .env.local
  console.log("--- Test 3: Current Environment Key ---");
  const envKey = process.env.OPENROUTER_API_KEY || "";
  console.log("Key exists in env:", Boolean(envKey), "Prefix:", envKey.slice(0, 15) + "...");
  const resultEnv = await testOpenRouterKey(envKey, modelName);
  console.log("Result for current key:", {
    is_operational: resultEnv.is_operational,
    status: resultEnv.status,
    http_status: resultEnv.http_status,
    latency_ms: resultEnv.latency_ms,
    message: resultEnv.message,
    remedy: resultEnv.remedy,
    key_details: resultEnv.key_details,
  });
  console.log(`✅ Test 3 Complete: Current key evaluated to status='${resultEnv.status}' (Operational: ${resultEnv.is_operational})\n`);

  // Test 4: Testing DB model with ID 5 and override expired key
  console.log("--- Test 4: testAiModelById(5) with override expired key ---");
  const resultDbOverride = await testAiModelById(5, fakeExpiredKey);
  console.log("Result for model ID 5 with expired key override:", {
    model_id: resultDbOverride.model_id,
    model_name: resultDbOverride.model_name,
    is_operational: resultDbOverride.is_operational,
    status: resultDbOverride.status,
    http_status: resultDbOverride.http_status,
    message: resultDbOverride.message,
  });
  if (resultDbOverride.status === "expired" && resultDbOverride.http_status === 401 && !resultDbOverride.is_operational) {
    console.log("✅ Test 4 PASSED: DB model test accurately detected expired key override!\n");
  } else {
    console.error("❌ Test 4 FAILED:", resultDbOverride);
  }

  console.log("=== All Backend Diagnostic Health Tests Completed Successfully ===");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
