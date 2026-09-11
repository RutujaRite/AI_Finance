import { chromium } from 'playwright';
import path from 'path';

async function capture() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
  });

  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@gmail.com');
  await page.fill('#password', '12345');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/home*', { timeout: 15000 });
  await page.goto('http://localhost:3001/home?section=assistant', { waitUntil: 'networkidle' });

  // Submit loan eligibility prompt
  await page.waitForSelector('.chat-input', { timeout: 10000 });
  await page.fill(
    '.chat-input',
    'I want a personal loan. I work at Capgemini Technology Services India Limited, salary is 50000, CIBIL is 760, need 800000 for 29 months, age 26, 0 EMIs'
  );
  await page.click('.chat-send-btn');

  // Wait for eligibility dashboard
  await page.waitForSelector('.eligibility-dashboard', { timeout: 40000 });
  await page.waitForTimeout(2000);

  const dashEl = await page.$('.eligibility-dashboard');
  if (dashEl) {
    const screenshotPath = 'C:\\Users\\Akshada\\.gemini\\antigravity-ide\\brain\\38d2a7f9-8d06-4f3a-9030-880e50a520da\\redesigned_eligibility_dashboard.png';
    await dashEl.screenshot({ path: screenshotPath });
    console.log('✅ Dashboard screenshot captured at:', screenshotPath);
  } else {
    console.error('❌ Could not find .eligibility-dashboard');
  }

  await browser.close();
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
