import { test, expect } from '@playwright/test';
import { loginAsDemoUser, sendAssistantMessage } from './helpers';

test.describe('Assistant EMI Calculation & Invariant Enforcement Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page, '/home?section=assistant');
    const newChatBtn = page.locator('#chatNewConversation');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
    }
  });

  test('should accurately calculate EMI and strictly not confuse monthly salary with loan principal', async ({ page }) => {
    // Turn 1: User mentions monthly salary
    await sendAssistantMessage(page, 'My salary is 39000');

    // Turn 2: User requests EMI calculation with explicit principal
    await sendAssistantMessage(page, 'Calculate EMI for 500000 at 10.5% for 3 years');

    const lastReply = page.locator('.chat-message.ai .chat-bubble, .chat-message.assistant .chat-bubble').last();
    await expect(lastReply).toBeVisible();

    const text = await lastReply.innerText();

    // 1. Invariant Check: Loan principal MUST be ₹5,00,000, NOT ₹39,000
    expect(text).toMatch(/5,?00,?000/);
    expect(text).not.toMatch(/principal\s*(?:of|:)?\s*₹?\s*39,?000/i);

    // 2. Mathematical calculation check:
    // EMI for 500000 at 10.5% for 36 months is ₹16,251/month
    expect(text).toMatch(/16,?25[0-5]/);

    // 3. Verification of breakdown presence (monthly EMI, rate, tenure)
    expect(text).toMatch(/10\.5%/);
    expect(text).toMatch(/36\s*months|3\s*years/i);
  });
});
