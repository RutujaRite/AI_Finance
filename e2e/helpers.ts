import { Page, expect } from '@playwright/test';

/**
 * Reusable helper to authenticate demo user and navigate to target page/section.
 * Ensures a fresh page state and valid authentication session.
 */
export async function loginAsDemoUser(page: Page, targetUrl: string = '/home?section=assistant') {
  await page.goto(targetUrl);

  // If redirected to /login, authenticate
  if (page.url().includes('/login')) {
    const emailInput = page.getByLabel(/Email address/i);
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill('admin@gmail.com');
    await page.getByLabel(/Password/i).fill('12345');

    const loginResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/auth/login') && resp.status() === 200,
      { timeout: 15000 }
    );
    await page.getByRole('button', { name: /Sign In/i }).click();
    await loginResponse;

    await page.waitForURL((url) => url.pathname.includes('/home'), { timeout: 15000 });

    if (targetUrl.includes('section=assistant') && !page.url().includes('section=assistant')) {
      await page.goto(targetUrl);
    }
  }

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(300);
}

/**
 * Helper to send a message in the assistant chat drawer and wait for the response.
 * Uses native prototype value dispatch to guarantee React 19 state synchronization instantly.
 */
export async function sendAssistantMessage(page: Page, message: string) {
  const initialAiCount = await page.locator('.chat-message.ai, .chat-message.assistant').count();
  const input = page.getByPlaceholder('Message AI Assistant...');
  await expect(input).toBeVisible({ timeout: 15000 });
  await input.click();

  // Ensure React 19 state update via native prototype setter
  await input.evaluate((el: HTMLTextAreaElement, val: string) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, message);

  await page.waitForTimeout(100);

  // Submit via Enter key or send button
  const sendBtn = page.locator('.chat-send-btn');
  await expect(sendBtn).toBeEnabled({ timeout: 10000 });
  await sendBtn.click();

  // Wait for the new AI message bubble to arrive and have non-empty text
  const nextAiMessage = page.locator('.chat-message.ai, .chat-message.assistant').nth(initialAiCount);
  await expect(nextAiMessage).toBeVisible({ timeout: 60000 });
  const bubble = nextAiMessage.locator('.chat-bubble');
  await expect(bubble).not.toHaveText('', { timeout: 60000 });
  await page.waitForTimeout(500);
}
