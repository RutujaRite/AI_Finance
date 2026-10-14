import { test, expect } from "@playwright/test";
import { loginAsDemoUser } from "./helpers";

test("AI instructions uses the reference configuration layout", async ({ page }) => {
  await loginAsDemoUser(page, "/agent-studio?tab=instructions");

  await expect(page.getByRole("heading", { name: "Configure AI Instructions" })).toBeVisible();
  await expect(page.getByText("Agent Identity & Persona")).toBeVisible();
  await expect(page.getByText("Instructions for the AI Agent")).toBeVisible();
  await expect(page.getByText("Quick settings")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Instructions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Test assistant" })).toBeVisible();
  await expect(page.getByText("Upload Knowledge Base")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose Files" })).toBeVisible();
  await expect(page.getByText("From URL")).toBeVisible();
  await expect(page.getByText("From Text")).toBeVisible();
  await expect(page.getByText("From Knowledge Base Library")).toBeVisible();
  await expect(page.getByText("Uploaded Knowledge Base Files")).toBeVisible();

  await page.evaluate(() => {
    window.scrollTo({ top: 0 });
    document.querySelector("main")?.scrollTo({ top: 0 });
  });
  await page.screenshot({ path: "test-results/ai-instructions-reference.png" });

  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight))
    .toBe(true);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
  await expect(page.getByText(/Showing \d+ to \d+ of \d+ files|0 files/)).toBeVisible();
});
