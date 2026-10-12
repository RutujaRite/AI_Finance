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

  console.log('Navigating to http://localhost:3001/eligibility ...');
  await page.goto('http://localhost:3001/eligibility');
  await page.waitForLoadState('networkidle');

  // Verify URL is /eligibility
  console.log('Current URL:', page.url());

  // Wait for the Repayment Schedule section
  const sectionTitle = await page.locator('.repayment-header .section-title').textContent();
  console.log('Found section title:', sectionTitle);

  // Click "Preview Statement" button
  console.log('Clicking Preview Statement button...');
  await page.click('button.rep-btn-preview');
  await page.waitForSelector('.preview-modal-backdrop');

  // Verify Preview Modal
  const modalTitle = await page.locator('.modal-title-text').textContent();
  console.log('Preview Modal Title:', modalTitle);

  const previewPagesCount = await page.locator('.preview-modal-scroll-continuum .pdf-page').count();
  console.log('Rendered PDF pages in modal:', previewPagesCount);

  // Take screenshot of preview modal
  await page.screenshot({ path: 'scripts/preview_modal_screenshot.png' });
  console.log('Screenshot saved to scripts/preview_modal_screenshot.png');

  await browser.close();
  console.log('Test completed successfully!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
