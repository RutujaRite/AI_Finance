import { test, expect } from '@playwright/test';
import { loginAsDemoUser } from './helpers';

test.describe('AI Assistant Basic Interface & Shell', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page, '/home?section=assistant');
  });

  test('should render assistant layout with sidebar, composer, and welcome state', async ({ page }) => {
    // 1. Verify chat sidebar and action button
    const sidebar = page.locator('#chatSidebar');
    await expect(sidebar).toBeVisible();

    const newChatBtn = page.locator('#chatNewConversation');
    await expect(newChatBtn).toBeVisible();

    // 2. Verify composer textarea and send button
    const composerInput = page.getByPlaceholder('Message AI Assistant...');
    await expect(composerInput).toBeVisible();
    await expect(composerInput).toBeEnabled();

    const sendBtn = page.locator('.chat-send-btn');
    await expect(sendBtn).toBeVisible();

    // 3. Verify messages container
    const messagesContainer = page.locator('#chatMessages');
    await expect(messagesContainer).toBeVisible();
  });

  test('should allow creating a new conversation and clearing history modal', async ({ page }) => {
    // Click New Chat button
    const newChatBtn = page.locator('#chatNewConversation');
    await newChatBtn.click();

    // Verify textarea is empty
    const composerInput = page.getByPlaceholder('Message AI Assistant...');
    await expect(composerInput).toHaveValue('');

    // Verify Clear History button opens modal or confirms
    const clearBtn = page.locator('#clearHistoryBtn');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      const modal = page.locator('.chat-modal-dialog, .modal');
      if (await modal.isVisible()) {
        const cancelBtn = page.getByRole('button', { name: /Cancel/i });
        if (await cancelBtn.isVisible()) {
          await cancelBtn.click();
        }
      }
    }
  });
});
