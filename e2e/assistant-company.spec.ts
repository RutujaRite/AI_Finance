import { test, expect } from '@playwright/test';
import { loginAsDemoUser, sendAssistantMessage } from './helpers';

test.describe('Assistant Company Search & Disambiguation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page, '/home?section=assistant');
    const newChatBtn = page.locator('#chatNewConversation');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
    }
  });

  test('should trigger company search and disambiguation for Infosys, then resolve to salary step', async ({ page }) => {
    // 1. User specifies company
    await sendAssistantMessage(page, 'I work at Infosys');

    // 2. Verify disambiguation or company match appears
    const firstReply = page.locator('.chat-message.ai .chat-bubble, .chat-message.assistant .chat-bubble').last();
    await expect(firstReply).toBeVisible();
    const text1 = await firstReply.innerText();
    expect(text1).toMatch(/Infosys/i);

    // If disambiguation list was presented, select option 1
    if (text1.includes('Matching Companies') || text1.includes('select your exact employer')) {
      await sendAssistantMessage(page, '1');

      // 3. Verify confirmation and next prompt for salary
      const secondReply = page.locator('.chat-message.ai .chat-bubble, .chat-message.assistant .chat-bubble').last();
      await expect(secondReply).toBeVisible();
      const text2 = await secondReply.innerText();
      expect(text2).toMatch(/Infosys/i);
      expect(text2).toMatch(/salary|income|take-home/i);
    } else {
      expect(text1).toMatch(/salary|income|take-home/i);
    }
  });
});
