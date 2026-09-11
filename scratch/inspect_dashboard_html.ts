import { chromium } from 'playwright';

async function check() {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const context = await browser.newContext();
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

  const banner = await page.$('.eligibility-dashboard-banner');
  console.log('Banner exists:', !!banner);
  const applicantSummary = await page.$('.applicant-summary-card');
  console.log('Applicant summary exists:', !!applicantSummary);
  const topBank = await page.$('.top-recommended-bank-card');
  console.log('Top bank exists:', !!topBank);
  const table = await page.$('.eligible-banks-table-card');
  console.log('Table exists:', !!table);
  const nextStep = await page.$('.eligibility-next-step-card');
  console.log('Next step exists:', !!nextStep);

  // Take screenshot of each card individually
  if (banner) {
    await banner.screenshot({ path: 'C:\\Users\\Akshada\\.gemini\\antigravity-ide\\brain\\38d2a7f9-8d06-4f3a-9030-880e50a520da\\card_1_banner.png' });
    console.log('Saved card_1_banner.png');
  }
  if (applicantSummary) {
    await applicantSummary.screenshot({ path: 'C:\\Users\\Akshada\\.gemini\\antigravity-ide\\brain\\38d2a7f9-8d06-4f3a-9030-880e50a520da\\card_2_applicant.png' });
    console.log('Saved card_2_applicant.png');
  }
  if (topBank) {
    await topBank.screenshot({ path: 'C:\\Users\\Akshada\\.gemini\\antigravity-ide\\brain\\38d2a7f9-8d06-4f3a-9030-880e50a520da\\card_3_topbank.png' });
    console.log('Saved card_3_topbank.png');
  }
  if (table) {
    await table.screenshot({ path: 'C:\\Users\\Akshada\\.gemini\\antigravity-ide\\brain\\38d2a7f9-8d06-4f3a-9030-880e50a520da\\card_4_table.png' });
    console.log('Saved card_4_table.png');
  }

  // Also full page screenshot
  await page.screenshot({ path: 'C:\\Users\\Akshada\\.gemini\\antigravity-ide\\brain\\38d2a7f9-8d06-4f3a-9030-880e50a520da\\full_page_dashboard.png', fullPage: true });
  console.log('Saved full_page_dashboard.png');

  await browser.close();
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
