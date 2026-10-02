import { test, expect } from '@playwright/test';
import { loginAsDemoUser, sendAssistantMessage } from './helpers';

test.describe('Assistant Concept & Policy RAG Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page, '/home?section=assistant');
    const newChatBtn = page.locator('#chatNewConversation');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
    }
  });

  test('should explain FOIR concept directly without forcing loan eligibility flow', async ({ page }) => {
    // User asks conceptual question
    await sendAssistantMessage(page, 'What is FOIR?');

    const reply = page.locator('.chat-message.ai .chat-bubble, .chat-message.assistant .chat-bubble').last();
    await expect(reply).toBeVisible();

    const text = await reply.innerText();

    // 1. Must contain definition / explanation of FOIR
    expect(text).toMatch(/FOIR|Fixed Obligation to Income Ratio/i);

    // 2. Invariant: Must NOT hijack the conversation into demanding salary or applicant details
    expect(text).not.toMatch(/To proceed, please enter your monthly salary/i);
    expect(text).not.toMatch(/What is your net monthly take-home salary\?/i);
  });
});
