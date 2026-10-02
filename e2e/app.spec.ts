import { test, expect } from '@playwright/test';

test.describe('CreditWise AI Application & Health Verification', () => {
  test('should load login page successfully', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/CreditWise|Login|Loan/i);
  });

  test('should render registration page', async ({ page }) => {
    const response = await page.goto('/register');
    expect(response?.status()).toBe(200);
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });
});
