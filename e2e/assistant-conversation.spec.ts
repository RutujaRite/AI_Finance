import { test, expect } from '@playwright/test';
import { loginAsDemoUser, sendAssistantMessage } from './helpers';

test.describe('Assistant Multi-Turn Conversation & Session Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page, '/home?section=assistant');
    const newChatBtn = page.locator('#chatNewConversation');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
    }
  });

  test('should retain multi-turn state without repeating previously captured fields', async ({ page }) => {
    // Turn 1: Employer
    await sendAssistantMessage(page, 'I work at Infosys');
    let lastBubble = page.locator('.chat-message.ai .chat-bubble, .chat-message.assistant .chat-bubble').last();
    let text1 = await lastBubble.innerText();

    if (text1.includes('Matching Companies') || text1.includes('select your exact employer')) {
      await sendAssistantMessage(page, '1');
      lastBubble = page.locator('.chat-message.ai .chat-bubble, .chat-message.assistant .chat-bubble').last();
      text1 = await lastBubble.innerText();
    }
    expect(text1).toMatch(/Infosys/i);

    // Turn 2: Monthly income
    await sendAssistantMessage(page, '75000');
    lastBubble = page.locator('.chat-message.ai .chat-bubble, .chat-message.assistant .chat-bubble').last();
    const text2 = await lastBubble.innerText();

    // Verify known state is acknowledged and NOT asked again
    expect(text2).toMatch(/Infosys/i);
    expect(text2).toMatch(/75,?000/);

    // Verifies it does NOT repeat the employer question
    expect(text2).not.toMatch(/what is the name of your current employer/i);
    expect(text2).not.toMatch(/what is the exact name of your current employer/i);
  });

  test('should support deleting a conversation from the sidebar history', async ({ page }) => {
    // Send a message so that a conversation exists
    await sendAssistantMessage(page, 'UniqueTestMessage123');

    const convItem = page.locator('.chat-conversation-item').first();
    await expect(convItem).toBeVisible({ timeout: 10000 });

    // Open options dropdown via Options button
    const menuBtn = convItem.locator('.chat-conversation-menu-btn');
    await menuBtn.click({ force: true });

    const deleteMenuOption = page.locator('.chat-action-menu-item.danger, button:has-text("Delete")').first();
    await expect(deleteMenuOption).toBeVisible({ timeout: 5000 });
    await deleteMenuOption.click();

    // Confirmation modal appears
    const confirmModal = page.locator('.modal-content');
    await expect(confirmModal).toBeVisible({ timeout: 5000 });
    await expect(confirmModal.getByText(/Delete conversation\?/i)).toBeVisible();

    // Click confirm delete in modal
    const confirmBtn = confirmModal.locator('.btn-danger');
    await confirmBtn.click();

    // Wait for modal to close
    await expect(confirmModal).toBeHidden({ timeout: 10000 });

    // Verify session reset and welcome prompt state rendered
    await expect(page.locator('#chatWelcomeMessage, .chat-welcome')).toBeVisible({ timeout: 15000 });
  });
});
