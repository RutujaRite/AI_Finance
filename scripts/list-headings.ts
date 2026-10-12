import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    {
      name: 'token',
      value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBnbWFpbC5jb20iLCJuYW1lIjoiQWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3OTE3ODU4NzIsImV4cCI6MTc5MTg3MjI3Mn0.Nnc_ig9bH0DbtVLqf-RTl61im-TNVbrrgt5NxfsHW0M',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    }
  ]);

  const page = await context.newPage();
  await page.goto('http://localhost:3001/eligibility', { waitUntil: 'networkidle' });

  // Get all buttons
  const buttons = await page.locator('button').allInnerTexts();
  console.log('All buttons on page:', buttons.map(b => b.trim()).filter(Boolean));

  // Get all h3 and h4 headers
  const headings = await page.locator('h1, h2, h3, h4').allInnerTexts();
  console.log('All headings on page:', headings.map(h => h.trim()).filter(Boolean));

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
