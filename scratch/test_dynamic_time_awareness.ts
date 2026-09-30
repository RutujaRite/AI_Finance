import assert from "node:assert";
import { POST } from "../app/api/chat/route";
import { NextRequest } from "next/server";
import { runCentralAgent } from "../lib/ai/agent";
import { getCreditWiseSystemPrompt } from "../lib/ai/prompts";
import pool from "../lib/db";

async function runTimeAwarenessTests() {
  console.log("================================================================================");
  console.log("TESTING DYNAMIC TIME AWARENESS & SYSTEM PROMPT IN CHAT ROUTE HANDLER");
  console.log("================================================================================\n");

  // 1. Verify Dynamic IST Time Computation
  console.log("--- 1. Testing Dynamic IST Time Computation ---");
  const currentTime = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  console.log("Computed Current IST Time:", currentTime);
  assert.ok(currentTime.length > 0, "Current time must not be empty");
  assert.ok(/(?:AM|PM)/i.test(currentTime), "Must contain AM or PM");
  console.log("✅ Dynamic IST time computation passed!\n");

  // 2. Verify System Prompt Template Structure
  console.log("--- 2. Testing System Prompt Template ---");
  const prompt = getCreditWiseSystemPrompt(currentTime);
  console.log("Generated System Prompt:\n", prompt);

  assert.ok(prompt.includes("You are CreditWise AI"), "Must contain persona");
  assert.ok(prompt.includes("### DYNAMIC CONTEXT:"), "Must contain DYNAMIC CONTEXT header");
  assert.ok(prompt.includes(`- Current Local Time: ${currentTime}`), "Must inject current local time");
  assert.ok(prompt.includes("### BEHAVIOR RULES:"), "Must contain BEHAVIOR RULES header");
  assert.ok(prompt.includes("- TIME AWARENESS: Always use the provided Current Local Time."), "Must contain TIME AWARENESS rule");
  assert.ok(prompt.includes("- NATURAL & ADAPTIVE:"), "Must contain NATURAL & ADAPTIVE rule");
  assert.ok(prompt.includes("- ACCURACY:"), "Must contain ACCURACY rule");
  console.log("✅ System prompt template structure passed!\n");

  // 3. Test Greeting with Contradictory Time Handling
  console.log("--- 3. Testing Contradictory Greeting Handling ---");
  const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const currentHour = istDate.getHours();
  console.log(`Current IST Hour: ${currentHour} (0-23)`);

  // Send a greeting: if it's evening/night (>= 17 or < 4), send "Good morning"
  // If it's morning (4 to 12), send "Good evening"
  const contradictoryGreeting = (currentHour >= 17 || currentHour < 4) ? "Good morning" : "Good evening";
  console.log(`Sending contradictory greeting for this hour: "${contradictoryGreeting}"`);

  const agentRes = await runCentralAgent({
    message: contradictoryGreeting,
    conversationId: `time_test_${Date.now()}`,
    currentTime,
  });

  console.log("Assistant Response to Contradictory Greeting:\n", agentRes.reply);
  assert.ok(agentRes.reply && agentRes.reply.length > 0, "Must return a reply");

  // If currently night/evening and user said "Good morning", it should politely acknowledge evening/night
  if (currentHour >= 17 || currentHour < 4) {
    const mentionsEveningOrNight = /good evening|late night|evening|night/i.test(agentRes.reply);
    console.log(`Acknowledge evening/night when said "Good morning" at night: ${mentionsEveningOrNight ? "YES" : "NO"}`);
    assert.ok(mentionsEveningOrNight, "Must politely acknowledge current evening/night time");
  } else if (currentHour >= 4 && currentHour < 12) {
    const mentionsMorning = /good morning|morning/i.test(agentRes.reply);
    console.log(`Acknowledge morning when said "Good evening" in morning: ${mentionsMorning ? "YES" : "NO"}`);
    assert.ok(mentionsMorning, "Must politely acknowledge current morning time");
  }
  console.log("✅ Contradictory greeting time awareness passed!\n");

  // 4. Test Chat Route Handler (app/api/chat/route.ts) directly with NextRequest
  console.log("--- 4. Testing Next.js Route Handler directly via POST ---");
  const testReq = new NextRequest("http://localhost:3001/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "Hello, what services does CreditWise AI provide?",
      conversation_id: "test_conv_time_123",
    }),
  });

  const response = await POST(testReq);
  const data = await response.json();
  console.log("Route Handler Status:", response.status);
  console.log("Route Handler Response:", {
    success: data.success,
    conversation_id: data.conversation_id,
    title: data.title,
    replyPreview: data.ai_message?.content?.slice(0, 150) + "...",
  });

  assert.strictEqual(response.status, 200, "Route must return status 200");
  assert.strictEqual(data.success, true, "Response must be success: true");
  assert.ok(data.ai_message?.content, "Must contain ai_message content");
  console.log("✅ Route handler POST test passed!\n");

  console.log("================================================================================");
  console.log("ALL DYNAMIC TIME AWARENESS & SYSTEM PROMPT TESTS PASSED SUCCESSFULLY! 🎯");
  console.log("================================================================================");
}

runTimeAwarenessTests()
  .then(() => pool.end())
  .catch((err) => {
    console.error("FATAL ERROR in time awareness tests:", err);
    pool.end();
    process.exit(1);
  });
