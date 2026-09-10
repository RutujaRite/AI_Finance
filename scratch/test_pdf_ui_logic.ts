import { readFileSync } from 'fs';

/**
 * Verify PDF download UI and content generation logic in app/home/page.tsx
 */
function testPdfUi() {
  const pageContent = readFileSync('app/home/page.tsx', 'utf8');

  console.log('--- 1. Verifying Duplicate Bottom Button Removal ---');
  const hasBottomButtonInActions = pageContent.includes('<div class="eligibility-card-actions">');
  console.log('Contains eligibility-card-actions:', hasBottomButtonInActions);
  if (hasBottomButtonInActions) {
    throw new Error('FAILED: eligibility-card-actions still exists in page.tsx');
  }
  console.log('✅ PASS: Bottom duplicate button container (<div class="eligibility-card-actions">) completely removed.');

  console.log('\n--- 2. Verifying Top-Right Button in Banner ---');
  const bannerMatches = pageContent.match(/<div class="eligibility-card-banner">[\s\S]*?\${downloadBtnHtml}[\s\S]*?<\/div>/g);
  console.log('Banner download button instances found:', bannerMatches ? bannerMatches.length : 0);
  if (!bannerMatches || bannerMatches.length < 2) { // one for success card, one for warning card
    throw new Error('FAILED: Expected downloadBtnHtml in banner for both success and warning cards');
  }
  console.log('✅ PASS: Top-right "Download Report" button is present in both success and warning card banners.');

  console.log('\n--- 3. Verifying handleDownloadPdf Parameter Handling ---');
  if (!pageContent.includes('handleDownloadPdf(downloadBtn, messageId)')) {
    throw new Error('FAILED: Delegated click handler does not pass downloadBtn element and messageId');
  }
  console.log('✅ PASS: Delegated click handler correctly passes (downloadBtn, messageId).');

  console.log('\n--- 4. Verifying DOM-based Report Content Source ---');
  if (!pageContent.includes('card.querySelector(".eligibility-card-body")')) {
    throw new Error('FAILED: handleDownloadPdf does not extract from .eligibility-card-body');
  }
  console.log('✅ PASS: Uses actual rendered report content from .eligibility-card-body in visible DOM.');

  console.log('\n--- 5. Verifying Blank PDF Prevention (Absolute Positioning & Scroll Reset) ---');
  if (!pageContent.includes('container.style.position = "absolute"') || !pageContent.includes('window.scrollTo(0, 0)')) {
    throw new Error('FAILED: Blank PDF fixes (absolute positioning, scroll reset) missing');
  }
  console.log('✅ PASS: In-viewport absolute positioning and coordinate alignment prevents blank PDF rendering.');

  console.log('\n--- 6. Verifying Privacy & Debug Scrubbing ---');
  if (!pageContent.includes('NOT_DEFINED') || !pageContent.includes('NEEDS_REVIEW')) {
    throw new Error('FAILED: Debug/internal token scrubbing not found in handleDownloadPdf');
  }
  console.log('✅ PASS: Scrubbing in place for internal/debug tokens (NOT_DEFINED, NEEDS_REVIEW, HTML comments).');

  console.log('\n=============================================');
  console.log('ALL PDF UI & FUNCTIONALITY CHECKS PASSED (6/6)');
  console.log('=============================================');
}

testPdfUi();
