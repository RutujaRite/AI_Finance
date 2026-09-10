import { chromium, Download } from 'playwright';
import fs from 'fs';

async function testPdfInRealBrowser() {
  console.log('--- Launching Real Google Chrome ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // Listen to console and errors
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[PDF]') || text.includes('Error') || text.includes('error')) {
      console.log('BROWSER CONSOLE:', text);
    }
  });

  page.on('pageerror', (err) => {
    console.error('BROWSER PAGE ERROR:', err);
  });

  // 1. Navigate & Log in
  console.log('Step 1: Navigating to login...');
  await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin@gmail.com');
  await page.fill('#password', '12345');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/home*', { timeout: 15000 });
  await page.goto('http://localhost:3001/home?section=assistant', { waitUntil: 'networkidle' });
  console.log('✅ Logged in successfully, now on AI Assistant');

  // 2. Submit loan query
  console.log('Step 2: Submitting loan eligibility prompt...');
  await page.waitForSelector('.chat-input', { timeout: 10000 });
  await page.fill(
    '.chat-input',
    'I want a personal loan. I work at Infosys, salary is 90000, CIBIL is 780, need 500000 for 3 years, age 29, 0 EMIs'
  );
  await page.click('.chat-send-btn');

  // 3. Wait for eligibility report card
  console.log('Step 3: Waiting for AI eligibility report card...');
  await page.waitForSelector('.eligibility-card', { timeout: 40000 });
  console.log('✅ Eligibility report card rendered in UI!');

  // 4. Verify button positions
  const bannerBtn = await page.$('.eligibility-card-banner .btn-download-report');
  console.log('✅ Top-right "Download Report" button present in banner:', !!bannerBtn);

  const bottomActionContainer = await page.$('.eligibility-card-actions');
  console.log('✅ Duplicate bottom container (.eligibility-card-actions) is absent:', bottomActionContainer === null);

  const allDownloadBtns = await page.$$('.btn-download-report');
  console.log(`✅ Total download buttons in card: ${allDownloadBtns.length} (must be exactly 1)`);

  if (!bannerBtn) {
    throw new Error('Top-right download button not found');
  }
  if (allDownloadBtns.length !== 1) {
    throw new Error(`Expected exactly 1 download button, found ${allDownloadBtns.length}`);
  }

  // 5. Click the top-right Download Report button and intercept the downloaded file
  console.log('Step 4: Clicking Download Report button in Chrome...');
  
  const downloadPromise = page.waitForEvent('download', { timeout: 25000 });
  await bannerBtn.click();

  const download: Download = await downloadPromise;
  const suggestedFilename = download.suggestedFilename();
  console.log('✅ Download initiated! Suggested filename:', suggestedFilename);

  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error('Download path is null');
  }

  const fileStats = fs.statSync(downloadPath);
  console.log('✅ PDF file saved to disk! Size:', fileStats.size, 'bytes');

  const fileBuffer = fs.readFileSync(downloadPath);
  const pdfHeader = fileBuffer.slice(0, 5).toString('utf8');
  console.log('✅ File header signature:', pdfHeader);

  if (pdfHeader !== '%PDF-') {
    throw new Error(`File is not a valid PDF! Signature was: ${pdfHeader}`);
  }

  if (fileStats.size < 10000) {
    throw new Error(`PDF file size too small (${fileStats.size} bytes), likely blank!`);
  }

  // Inspect internal PDF structure
  const pdfText = fileBuffer.toString('latin1');
  const pageMatches = pdfText.match(/\/Type\s*\/Page/g);
  console.log('✅ Page count in PDF:', pageMatches ? pageMatches.length : 1);

  // Check if image stream exists and has significant byte size
  const streamMatches = pdfText.match(/\/Length\s+(\d+)/g);
  console.log('✅ Stream objects found:', streamMatches ? streamMatches.length : 0);
  if (streamMatches) {
    const lengths = streamMatches.map(s => parseInt(s.replace(/\/Length\s+/, ''), 10));
    const maxStream = Math.max(...lengths);
    console.log('✅ Largest stream size in PDF:', maxStream, 'bytes (rich rendered graphics)');
    if (maxStream < 5000) {
      throw new Error(`Largest stream is only ${maxStream} bytes, PDF appears to have blank content!`);
    }
  }

  console.log('\n======================================================');
  console.log('🎉 SUCCESS: REAL BROWSER DOWNLOADED NON-BLANK PDF!');
  console.log(`File: ${suggestedFilename} (${fileStats.size} bytes)`);
  console.log('======================================================');

  await browser.close();
}

testPdfInRealBrowser().catch(err => {
  console.error('❌ BROWSER TEST FAILED:', err);
  process.exit(1);
});
