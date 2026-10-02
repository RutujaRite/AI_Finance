import { test, expect } from '@playwright/test';

test.describe('Authentication & Session Persistence Flow', () => {
  test('should display validation error on invalid login attempt', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible();

    await page.getByLabel(/Email address/i).fill('invalid-user@creditwise.com');
    await page.getByLabel(/Password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Verify error alert appears
    const errorAlert = page.locator('.alert.alert-danger');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Invalid email or password/i);
  });

  test('should successfully log in with demo credentials and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/Email address/i).fill('admin@gmail.com');
    await page.getByLabel(/Password/i).fill('12345');
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Verify redirection to /home
    await page.waitForURL(/\/home/);
    await expect(page).toHaveURL(/\/home/);

    // Verify dashboard banner and action buttons
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Launch AI Assistant/i })).toBeVisible();

    // Verify session cookie persistence
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === 'token');
    expect(authCookie).toBeDefined();
    expect(authCookie?.value.length).toBeGreaterThan(10);
  });
});
