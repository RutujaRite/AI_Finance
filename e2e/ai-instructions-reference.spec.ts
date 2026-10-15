import { test, expect } from "@playwright/test";
import { loginAsDemoUser } from "./helpers";

test("AI instructions uses the reference configuration layout", async ({ page }) => {
  await loginAsDemoUser(page, "/agent-studio?tab=instructions");

  await expect(page.getByRole("heading", { name: "Configure AI Instructions" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Active" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Instructions" }).first()).toBeVisible();

  // Verify removed buttons are gone
  await expect(page.getByRole("button", { name: "Deactivate", exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Activate", exact: true })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).not.toBeVisible();

  // Test switchable active button toggle
  const activeBtn = page.getByRole("button", { name: "Active" });
  await activeBtn.click();
  await expect(page.getByRole("button", { name: "Inactive" })).toBeVisible();
  await page.getByRole("button", { name: "Inactive" }).click();
  await expect(page.getByRole("button", { name: "Active" })).toBeVisible();

  await expect(page.getByText("Agent Identity & Persona")).toBeVisible();
  await expect(page.getByText("Instructions for the AI Agent")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prompt Engine" })).toBeVisible();
  await expect(page.getByText("Upload Knowledge Base")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose Files" })).toBeVisible();
  await expect(page.getByText("From URL")).toBeVisible();
  await expect(page.getByText("From Text")).toBeVisible();
  await expect(page.getByText("From Knowledge Base Library")).toBeVisible();
  await expect(page.getByText("Uploaded Knowledge Base Files")).toBeVisible();

  await page.evaluate(() => {
    const pane = document.querySelector(".ai-scroll-pane");
    if (pane) pane.scrollTop = 0;
  });
  await page.screenshot({ path: "test-results/ai-instructions-reference.png" });

  const tableHeading = page.getByText("Uploaded Knowledge Base Files");
  await tableHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/ai-instructions-lower.png" });

  await expect(page.getByText(/Showing \d+-\d+ of \d+ files|Showing \d+ to \d+ of \d+ files|5 files/)).toBeVisible();
});
