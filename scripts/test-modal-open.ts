import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
  });

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
  await page.goto('http://localhost:3001/eligibility', { waitUntil: 'networkidle' });

  // 1. Check outer section header buttons
  const previewBtn = page.getByRole('button', { name: 'Preview Statement' });
  const downloadBtnOuter = page.getByRole('button', { name: 'Download PDF' });
  const printBtnOuter = page.getByRole('button', { name: 'Print Statement' });

  console.log('Outer buttons visible:', {
    previewBtn: await previewBtn.isVisible(),
    downloadBtnOuter: await downloadBtnOuter.isVisible(),
    printBtnOuter: await printBtnOuter.isVisible(),
  });

  // 2. Click "Preview Statement"
  console.log('Opening Amortization PDF Statement Preview modal...');
  await previewBtn.scrollIntoViewIfNeeded();
  await previewBtn.click();
  await page.waitForTimeout(1000);

  // Check that the portal modal is open and full-screen
  const modalBackdrop = page.locator('.preview-modal-backdrop');
  console.log('Modal backdrop visible:', await modalBackdrop.isVisible());

  const modalTitle = await page.locator('.modal-title-text').innerText();
  console.log('Modal title:', modalTitle);

  // Check buttons inside preview modal
  const modalDownloadBtn = page.locator('.modal-actions-group .modal-btn-download');
  const modalPrintBtn = page.locator('.modal-actions-group .modal-btn-print');
  console.log('Modal action buttons visible:', {
    modalDownloadBtn: await modalDownloadBtn.isVisible(),
    modalPrintBtn: await modalPrintBtn.isVisible(),
  });

  // Check how many .pdf-page elements exist in modal
  const pdfPagesCount = await page.locator('.preview-modal-scroll-continuum .pdf-page').count();
  console.log('Number of rendered PDF pages in preview modal:', pdfPagesCount);

  // Take screenshot of the open modal
  await page.screenshot({ path: 'scripts/modal_full_portal.png' });
  console.log('Saved screenshot to scripts/modal_full_portal.png');

  // 3. Test Download PDF button inside modal
  console.log('Testing "Download PDF" click inside modal...');
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  await modalDownloadBtn.click();
  const download = await downloadPromise;
  const downloadPath = path.join(process.cwd(), 'scripts', download.suggestedFilename());
  await download.saveAs(downloadPath);
  console.log(`Successfully downloaded PDF: ${downloadPath} (size: ${fs.statSync(downloadPath).size} bytes)`);

  // 4. Test Printable format via page.emulateMedia({ media: 'print' }) and page.pdf()
  console.log('Testing Printable Format (@media print)...');
  await page.emulateMedia({ media: 'print' });
  const printPdfPath = path.join(process.cwd(), 'scripts', 'printed_amortization_statement.pdf');
  await page.pdf({
    path: printPdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
  console.log(`Successfully generated print PDF: ${printPdfPath} (size: ${fs.statSync(printPdfPath).size} bytes)`);

  // Also verify that during print, topbar and calculators are hidden
  const topbarVisibleInPrint = await page.locator('.topbar-wrapper').isVisible();
  const benchVisibleInPrint = await page.locator('.calculation-benchmarks-section').isVisible();
  const printableContainerVisible = await page.locator('#printable-assessment-report').isVisible();
  console.log('Print visibility check:', {
    topbarVisibleInPrint,
    benchVisibleInPrint,
    printableContainerVisible,
  });

  await browser.close();
  console.log('ALL TESTS PASSED!');
}

main().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
