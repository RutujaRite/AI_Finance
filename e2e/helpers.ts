import { Page, expect } from '@playwright/test';

/**
 * Reusable helper to authenticate demo user and navigate to target page/section.
 * Uses the landing page auth modal triggered by URL parameters.
 */
export async function loginAsDemoUser(page: Page, targetUrl: string = '/home?section=assistant') {
  // First, go to landing page with auth=login parameter to trigger login modal
  await page.goto('/?auth=login&from=/home');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // Wait for login modal to appear - look for the auth backdrop
  const authBackdrop = page.locator('.auth-backdrop').first();
  await expect(authBackdrop).toBeVisible({ timeout: 10000 });

  // Use the 1-click demo login button for faster authentication
  const demoLoginBtn = page.locator('.primary-demo-chip, button:has-text("Admin Login")').first();
  if (await demoLoginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await demoLoginBtn.click();
  } else {
    // Fallback: fill the form manually
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill('admin@gmail.com');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('12345');

    // Submit login form
    const submitBtn = page.locator('.submit-btn, button[type="submit"]').first();
    await submitBtn.click();
  }

  // Wait for redirect to home page
  await page.waitForURL((url) => url.pathname.includes('/home'), { timeout: 15000 });

  // Navigate to target URL
  await page.goto(targetUrl);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
}

/**
 * Helper to send a message in the assistant chat and wait for the response.
 * Uses native prototype value dispatch to guarantee React state synchronization instantly.
 */
export async function sendAssistantMessage(page: Page, message: string) {
  // Wait for chat input to be visible
  const input = page.getByPlaceholder('Message AI Assistant...').or(page.getByRole('textbox', { name: /Message AI Assistant/i }));
  await expect(input).toBeVisible({ timeout: 15000 });

  // Count existing AI messages
  const initialAiCount = await page.locator('.chat-message.ai, .chat-message.assistant').count();

  // Focus and type the message
  await input.click();
  await input.fill(message);

  // Submit via Enter key or send button
  const sendBtn = page.locator('.chat-send-btn, button[type="submit"]').first();
  if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await sendBtn.click();
  } else {
    await input.press('Enter');
  }

  // Wait for the new AI message bubble to arrive and have non-empty text
  const nextAiMessage = page.locator('.chat-message.ai, .chat-message.assistant').nth(initialAiCount);
  await expect(nextAiMessage).toBeVisible({ timeout: 60000 });
  const bubble = nextAiMessage.locator('.chat-bubble');
  await expect(bubble).not.toHaveText('', { timeout: 60000 });
  await page.waitForTimeout(500);
}