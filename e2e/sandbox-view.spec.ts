import { test, expect } from "@playwright/test";
import { loginAsDemoUser } from "./helpers";

test("AI Agent Sandbox professional search bar UI", async ({ page }) => {
  await loginAsDemoUser(page, "/agent-studio?tab=test");
  await page.waitForTimeout(1000);

  // 1. Verify right column search bar
  const panelSearch = page.getByPlaceholder("Search scenarios, policies & prompts...");
  await expect(panelSearch).toBeVisible();

  // 2. Open in-chat message search
  const searchBtn = page.getByRole("button", { name: "Search" }).first();
  await expect(searchBtn).toBeVisible();
  await searchBtn.click();
  await page.waitForTimeout(300);

  // 3. Verify in-chat search input and counter
  const chatSearch = page.getByPlaceholder("Search messages in this conversation...");
  await expect(chatSearch).toBeVisible();
  await expect(page.locator(".ai-chat-search-badge")).toBeVisible();

  // 4. Verify bottom chat input container
  const chatInput = page.getByPlaceholder("Ask a loan policy question, test eligibility, or type a message...");
  await expect(chatInput).toBeVisible();

  await page.screenshot({ path: "test-results/sandbox-view.png", fullPage: true });
});

