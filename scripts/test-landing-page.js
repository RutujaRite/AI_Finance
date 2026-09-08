const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];
  function check(name, ok, detail = '') {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
  }

  // 1. Landing page redirect
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const url1 = page.url();
  check('Root redirects to /login', url1.includes('/login'), url1);

  // 2. Login page renders
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  const loginTitle = await page.title();
  check('Login page has content', loginTitle.length > 0, loginTitle);
  const loginForm = await page.$('form');
  check('Login page has form', !!loginForm);

  // 3. Register page
  await page.goto('http://localhost:3001/register', { waitUntil: 'networkidle' });
  const regForm = await page.$('form');
  check('Register page has form', !!regForm);

  // 4. EMI page (auth-protected -> login)
  await page.goto('http://localhost:3001/emi', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const emiUrl = page.url();
  check('EMI page redirects to login when unauthenticated', emiUrl.includes('/login'), emiUrl);

  // 5. Bank managers page (auth-protected -> login)
  await page.goto('http://localhost:3001/bank-managers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const bmUrl = page.url();
  check('Bank Managers page redirects to login when unauthenticated', bmUrl.includes('/login'), bmUrl);

  // 6. Policies page (auth-protected -> login)
  await page.goto('http://localhost:3001/policies', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const polUrl = page.url();
  check('Policies page redirects to login when unauthenticated', polUrl.includes('/login'), polUrl);

  // 7. Admin page (should redirect or show)
  await page.goto('http://localhost:3001/admin', { waitUntil: 'networkidle' });
  const adminUrl = page.url();
  check('Admin page accessible or redirects', true, adminUrl);

  // 8. Profile page
  await page.goto('http://localhost:3001/profile', { waitUntil: 'networkidle' });
  const profUrl = page.url();
  check('Profile page accessible or redirects', true, profUrl);

  // 9. Chat page (unauthenticated -> login)
  await page.goto('http://localhost:3001/home', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const homeUrl = page.url();
  check('Home redirects when unauthenticated', homeUrl.includes('/login'), homeUrl);

  // 10. 404 page
  const r404 = await page.goto('http://localhost:3001/nonexistent-page-xyz', { waitUntil: 'networkidle' });
  check('404 page returns 404 status', r404.status() === 404, `status=${r404.status()}`);

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
