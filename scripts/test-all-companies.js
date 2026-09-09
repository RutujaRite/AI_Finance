require('dotenv').config();
const { fetchLiveCompanySummary } = require('../services/companyResearchService.js');
const { COMPANY_ALIASES } = require('../services/companyAliases.js');

const SKIP = new Set([
  'CONTRACT EMPLOYEE',
]);

const companies = Object.values(COMPANY_ALIASES)
  .map(c => c.trim())
  .filter(c => c && !SKIP.has(c))
  .filter((c, i, arr) => arr.indexOf(c) === i);

async function main() {
  const companies = Object.values(COMPANY_ALIASES);
  console.log(`Testing fetchLiveCompanySummary for ${companies.length} companies...\n`);

  let success = 0;
  let failed = 0;
  const failures = [];

  for (const company of companies) {
    try {
      const result = await fetchLiveCompanySummary(company);
      if (result && result.length > 0) {
        success++;
        console.log(`✓ ${company} (${result.length} chars)`);
      } else {
        failed++;
        failures.push({ company, reason: 'empty result' });
        console.log(`✗ ${company} (empty result)`);
      }
    } catch (e) {
      failed++;
      failures.push({ company, reason: e.message });
      console.log(`✗ ${company} (${e.message})`);
    }
  }

  console.log(`\n${success} succeeded, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f.company}: ${f.reason}`));
  }
}

main().catch(e => console.error(e));