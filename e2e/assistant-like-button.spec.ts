import { test, expect } from '@playwright/test';
import { loginAsDemoUser, sendAssistantMessage } from './helpers';

test.describe('AI Assistant Message Like/Dislike UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page, '/home?section=assistant');
    // Wait for chat to be ready
    await page.waitForTimeout(1000);
  });

  test('should render like/dislike buttons on AI assistant messages', async ({ page }) => {
    // Send a message to get an AI response
    await sendAssistantMessage(page, 'What is a personal loan?');

    // Find the AI message actions container
    const aiMessage = page.locator('.chat-message.ai, .chat-message.assistant').first();
    await expect(aiMessage).toBeVisible({ timeout: 15000 });

    // Verify like button exists
    const likeButton = aiMessage.locator('.message-action-btn').filter({ has: page.locator('.bi-hand-thumbs-up') });
    await expect(likeButton).toBeVisible();

    // Verify dislike button exists
    const dislikeButton = aiMessage.locator('.message-action-btn').filter({ has: page.locator('.bi-hand-thumbs-down') });
    await expect(dislikeButton).toBeVisible();
  });

  test('should toggle like state when like button is clicked', async ({ page }) => {
    await sendAssistantMessage(page, 'Tell me about loan eligibility');

    const aiMessage = page.locator('.chat-message.ai, .chat-message.assistant').first();
    const likeButton = aiMessage.locator('.message-action-btn').filter({ has: page.locator('.bi-hand-thumbs-up') });

    // Verify initial state is not active
    await expect(likeButton).not.toHaveClass(/active-like/);

    // Click like button
    await likeButton.click();

    // Verify active state is applied
    await expect(likeButton).toHaveClass(/active-like/);
  });

  test('should toggle dislike state when dislike button is clicked', async ({ page }) => {
    await sendAssistantMessage(page, 'What documents are needed?');

    const aiMessage = page.locator('.chat-message.ai, .chat-message.assistant').first();
    const dislikeButton = aiMessage.locator('.message-action-btn').filter({ has: page.locator('.bi-hand-thumbs-down') });

    // Verify initial state is not active
    await expect(dislikeButton).not.toHaveClass(/active-dislike/);

    // Click dislike button
    await dislikeButton.click();

    // Verify active state is applied
    await expect(dislikeButton).toHaveClass(/active-dislike/);
  });

  test('should clear dislike when like is clicked and vice versa', async ({ page }) => {
    await sendAssistantMessage(page, 'Explain CIBIL score');

    const aiMessage = page.locator('.chat-message.ai, .chat-message.assistant').first();
    const likeButton = aiMessage.locator('.message-action-btn').filter({ has: page.locator('.bi-hand-thumbs-up') });
    const dislikeButton = aiMessage.locator('.message-action-btn').filter({ has: page.locator('.bi-hand-thumbs-down') });

    // Click dislike first
    await dislikeButton.click();
    await expect(dislikeButton).toHaveClass(/active-dislike/);
    await expect(likeButton).not.toHaveClass(/active-like/);

    // Click like - dislike should clear
    await likeButton.click();
    await expect(likeButton).toHaveClass(/active-like/);
    await expect(dislikeButton).not.toHaveClass(/active-dislike/);
  });

  test('should toggle like off when clicked again', async ({ page }) => {
    await sendAssistantMessage(page, 'What is EMI?');

    const aiMessage = page.locator('.chat-message.ai, .chat-message.assistant').first();
    const likeButton = aiMessage.locator('.message-action-btn').filter({ has: page.locator('.bi-hand-thumbs-up') });

    // Click to activate
    await likeButton.click();
    await expect(likeButton).toHaveClass(/active-like/);

    // Click again to deactivate
    await likeButton.click();
    await expect(likeButton).not.toHaveClass(/active-like/);
  });

  test('should not show like/dislike buttons on user messages', async ({ page }) => {
    await sendAssistantMessage(page, 'Hello there');

    // Find user message
    const userMessage = page.locator('.chat-message.user').first();
    await expect(userMessage).toBeVisible();

    // Verify no message actions container exists for user messages
    const actionsContainer = userMessage.locator('.message-actions');
    await expect(actionsContainer).not.toBeVisible();
  });

  test('should show like/dislike buttons on multiple AI messages independently', async ({ page }) => {
    // First message
    await sendAssistantMessage(page, 'Question one about loans');
    const firstAiMessage = page.locator('.chat-message.ai, .chat-message.assistant').first();
    const firstLikeButton = firstAiMessage.locator('.message-action-btn').filter({ has: page.locator('.bi-hand-thumbs-up') });
    await firstLikeButton.click();
    await expect(firstLikeButton).toHaveClass(/active-like/);

    // Second message
    await sendAssistantMessage(page, 'Question two about credit score');
    const secondAiMessage = page.locator('.chat-message.ai, .chat-message.assistant').last();
    const secondLikeButton = secondAiMessage.locator('.message-action-btn').filter({ has: page.locator('.bi-hand-thumbs-up') });
    await secondLikeButton.click();
    await expect(secondLikeButton).toHaveClass(/active-like/);

    // First message should still be liked
    await expect(firstLikeButton).toHaveClass(/active-like/);
  });
});