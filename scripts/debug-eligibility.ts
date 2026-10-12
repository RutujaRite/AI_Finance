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
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:3001/eligibility ...');
  await page.goto('http://localhost:3001/eligibility', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('Current URL:', page.url());
  const bodyText = await page.locator('body').innerText();
  console.log('Body text preview:', bodyText.substring(0, 300));

  await page.screenshot({ path: 'scripts/page_debug.png' });
  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
