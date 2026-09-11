import { chromium } from 'playwright';

async function captureFullCard() {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 1600 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3001/login');
  await page.fill('#email', 'admin@gmail.com');
  await page.fill('#password', '12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/home*');
  await page.goto('http://localhost:3001/home?section=assistant');
  await page.waitForSelector('.chat-input');
  await page.fill('.chat-input', 'I want a personal loan. I work at Capgemini Technology Services India Limited, salary is 50000, CIBIL is 760, need 800000 for 29 months, age 26, 0 EMIs');
  await page.click('.chat-send-btn');
  await page.waitForSelector('.eligibility-dashboard', { timeout: 40000 });
  await page.waitForTimeout(2000);

  // Scroll the chat container so the dashboard is fully visible
  await page.evaluate(() => {
    const dash = document.querySelector('.eligibility-dashboard');
    if (dash) {
      dash.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });
  await page.waitForTimeout(1000);

  const dashEl = await page.$('.eligibility-dashboard');
  if (dashEl) {
    const screenshotPath = 'C:\\\\Users\\\\Akshada\\\\.gemini\\\\antigravity-ide\\\\brain\\\\38d2a7f9-8d06-4f3a-9030-880e50a520da\\\\full_dashboard_scrolled.png';
    await dashEl.screenshot({ path: screenshotPath });
    console.log('✅ Captured full_dashboard_scrolled.png');
  }

  await browser.close();
}

captureFullCard().catch(e => {
  console.error(e);
  process.exit(1);
});
