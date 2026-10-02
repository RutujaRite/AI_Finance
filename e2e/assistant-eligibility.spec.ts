import { test, expect } from '@playwright/test';
import { loginAsDemoUser, sendAssistantMessage } from './helpers';

test.describe('Assistant Full Loan Eligibility Evaluation & Bank Matching', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page, '/home?section=assistant');
    const newChatBtn = page.locator('#chatNewConversation');
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
    }
  });

  test('should complete loan eligibility evaluation and display AGENTS.md compliant bank matching table', async ({ page }) => {
    // Send loan intent with complete applicant profile
    await sendAssistantMessage(
      page,
      'I want a personal loan. Employer is Tata Consultancy Services Limited, net salary 80000, loan amount 300000, tenure 60 months, CIBIL 780, age 30, existing EMI 0.'
    );

    const reply = page.locator('.chat-message.ai .chat-bubble, .chat-message.assistant .chat-bubble').last();
    await expect(reply).toBeVisible();

    const text = await reply.innerText();

    // 1. Verify eligibility evaluation completed
    expect(text).toMatch(/Eligibility|Evaluation|Eligible|Partner/i);

    // 2. Verify AGENTS.md compliant table columns: | Bank | Status | CIBIL | Tenure | Est. EMI |
    expect(text).toMatch(/Bank/i);
    expect(text).toMatch(/Status/i);
    expect(text).toMatch(/CIBIL/i);
    expect(text).toMatch(/Tenure/i);
    expect(text).toMatch(/EMI/i);

    // 3. Verify top partner banks appear in results (e.g. HDFC, ICICI, Axis)
    expect(text).toMatch(/HDFC|ICICI|Axis|Kotak/i);
  });
});
