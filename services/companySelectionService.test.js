/**
 * Phase 1 Unit Tests: Company Selection Service
 * 
 * Test: searchCompanyNames(), selectAndResolveCompany(), state management
 * 
 * Run with: npm test -- services/companySelectionService.test.js
 */

const assert = require('assert');
const pool = require('../db');
const {
  searchCompanyNames,
  selectAndResolveCompany,
  getCompanyCategoryForBank,
  validateSupportedBanks,
  normalizeCompanyName,
  normalizeText
} = require('./companySelectionService');

const {
  getConversationStateWithCompanyInfo,
  updateCompanySelectionState
} = require('./assistantConversationService');

const {
  detectCompanySearchIntent,
  formatCompanySearchResults,
  formatSupportedBanksConfirmation
} = require('./assistantFlowService');

describe('Phase 1: Company Selection Service', () => {

  describe('normalizeCompanyName()', () => {
    it('should trim and lowercase company names', () => {
      assert.strictEqual(normalizeCompanyName('  TCS  '), 'tcs');
      assert.strictEqual(normalizeCompanyName('Tata Consultancy Services'), 'tata consultancy services');
    });

    it('should handle empty input', () => {
      assert.strictEqual(normalizeCompanyName(''), '');
      assert.strictEqual(normalizeCompanyName(null), '');
    });
  });

  describe('normalizeText()', () => {
    it('should normalize multiple spaces', () => {
      assert.strictEqual(normalizeText('TCS   Inc   Ltd'), 'TCS Inc Ltd');
    });

    it('should trim whitespace', () => {
      assert.strictEqual(normalizeText('  Company Name  '), 'Company Name');
    });
  });

  describe('searchCompanyNames()', () => {
    it('should return empty array for null input', async () => {
      const result = await searchCompanyNames(pool, null);
      assert(Array.isArray(result));
      assert.strictEqual(result.length, 0);
    });

    it('should return empty array for empty input', async () => {
      const result = await searchCompanyNames(pool, '');
      assert(Array.isArray(result));
      assert.strictEqual(result.length, 0);
    });

    it('should perform case-insensitive fuzzy search', async () => {
      const result = await searchCompanyNames(pool, 'TCS', 10);
      assert(Array.isArray(result));
      
      if (result.length > 0) {
        result.forEach(name => {
          assert(typeof name === 'string');
          assert(name.length > 0);
        });
      }
    });

    it('should return distinct company names only', async () => {
      const result = await searchCompanyNames(pool, 'Infosys', 10);
      
      if (result.length > 0) {
        const uniqueNames = new Set(result);
        assert.strictEqual(result.length, uniqueNames.size, 'Should return only distinct names');
      }
    });

    it('should respect limit parameter', async () => {
      const result = await searchCompanyNames(pool, '%', 5);
      assert(result.length <= 5);
    });
  });

  describe('selectAndResolveCompany()', () => {
    it('should return empty supportedBanks for non-existent company', async () => {
      const result = await selectAndResolveCompany(pool, 'XYZ_NON_EXISTENT_COMPANY_12345');
      assert.strictEqual(result.selectedCompanyName, 'xyz_non_existent_company_12345');
      assert(Array.isArray(result.supportedBanks));
      assert.strictEqual(result.supportedBanks.length, 0);
    });

    it('should resolve banks for valid company', async () => {
      // First, search for a real company
      const searchResults = await searchCompanyNames(pool, 'TCS', 5);
      
      if (searchResults.length > 0) {
        const selectedCompany = searchResults[0];
        const result = await selectAndResolveCompany(pool, selectedCompany);
        
        assert.strictEqual(result.selectedCompanyName, normalizeCompanyName(selectedCompany));
        assert(Array.isArray(result.supportedBanks));
        
        if (result.supportedBanks.length > 0) {
          result.supportedBanks.forEach(bank => {
            assert(Number.isInteger(bank.bank_id), 'bank_id should be integer');
            assert(typeof bank.bank_name === 'string', 'bank_name should be string');
            assert(bank.bank_name.length > 0, 'bank_name should not be empty');
            assert(bank.company_category === null || typeof bank.company_category === 'string');
          });
        }
      }
    });

    it('should not return duplicate banks', async () => {
      const searchResults = await searchCompanyNames(pool, 'TCS', 5);
      
      if (searchResults.length > 0) {
        const result = await selectAndResolveCompany(pool, searchResults[0]);
        
        if (result.supportedBanks.length > 0) {
          const bankIds = result.supportedBanks.map(b => b.bank_id);
          const uniqueIds = new Set(bankIds);
          assert.strictEqual(bankIds.length, uniqueIds.size, 'Should not return duplicate banks');
        }
      }
    });
  });

  describe('getCompanyCategoryForBank()', () => {
    it('should return null for non-existent company', async () => {
      const result = await getCompanyCategoryForBank(pool, 'XYZ_NON_EXISTENT', 'ICICI Bank');
      assert.strictEqual(result, null);
    });

    it('should return null for non-existent bank', async () => {
      const result = await getCompanyCategoryForBank(pool, 'TCS', 'NONEXISTENT_BANK_XYZ');
      assert.strictEqual(result, null);
    });

    it('should return category or null for valid company-bank pair', async () => {
      const searchResults = await searchCompanyNames(pool, 'TCS', 5);
      
      if (searchResults.length > 0) {
        const companyResolve = await selectAndResolveCompany(pool, searchResults[0]);
        
        if (companyResolve.supportedBanks.length > 0) {
          const bankInfo = companyResolve.supportedBanks[0];
          const category = await getCompanyCategoryForBank(pool, searchResults[0], bankInfo.bank_name);
          
          assert(category === null || typeof category === 'string');
        }
      }
    });

    it('should be case-insensitive', async () => {
      const searchResults = await searchCompanyNames(pool, 'TCS', 5);
      
      if (searchResults.length > 0) {
        const companyResolve = await selectAndResolveCompany(pool, searchResults[0]);
        
        if (companyResolve.supportedBanks.length > 0) {
          const bankInfo = companyResolve.supportedBanks[0];
          const cat1 = await getCompanyCategoryForBank(pool, searchResults[0].toUpperCase(), bankInfo.bank_name.toUpperCase());
          const cat2 = await getCompanyCategoryForBank(pool, searchResults[0].toLowerCase(), bankInfo.bank_name.toLowerCase());
          
          assert.strictEqual(cat1, cat2, 'Case should not affect result');
        }
      }
    });
  });

  describe('validateSupportedBanks()', () => {
    it('should return isValid=false for non-array', () => {
      const result = validateSupportedBanks(null);
      assert.strictEqual(result.isValid, false);
    });

    it('should return isValid=true for empty array', () => {
      const result = validateSupportedBanks([]);
      assert.strictEqual(result.isValid, true);
    });

    it('should validate bank_id is integer', () => {
      const invalid = [{ bank_id: 'not_integer', bank_name: 'Bank', company_category: 'CAT A' }];
      const result = validateSupportedBanks(invalid);
      assert.strictEqual(result.isValid, false);
    });

    it('should validate bank_name is string', () => {
      const invalid = [{ bank_id: 1, bank_name: null, company_category: 'CAT A' }];
      const result = validateSupportedBanks(invalid);
      assert.strictEqual(result.isValid, false);
    });

    it('should accept valid structure', () => {
      const valid = [
        { bank_id: 1, bank_name: 'ICICI Bank', company_category: 'MNC' },
        { bank_id: 2, bank_name: 'HDFC Bank', company_category: null }
      ];
      const result = validateSupportedBanks(valid);
      assert.strictEqual(result.isValid, true);
    });
  });

  describe('detectCompanySearchIntent()', () => {
    it('should detect company search intent', () => {
      const result = detectCompanySearchIntent('I work at TCS');
      assert.strictEqual(result.shouldInitiateCompanySearch, true);
      assert(result.companyInput.toLowerCase().includes('tcs'));
    });

    it('should not detect loan intent as company search', () => {
      const result = detectCompanySearchIntent('I need a personal loan for 5 lakhs');
      assert.strictEqual(result.shouldInitiateCompanySearch, false);
    });

    it('should handle empty message', () => {
      const result = detectCompanySearchIntent('');
      assert.strictEqual(result.shouldInitiateCompanySearch, false);
    });

    it('should extract company name', () => {
      const result = detectCompanySearchIntent('My employer is Infosys Ltd');
      if (result.shouldInitiateCompanySearch) {
        assert(result.companyInput.length > 0);
      }
    });
  });

  describe('formatCompanySearchResults()', () => {
    it('should format empty results', () => {
      const result = formatCompanySearchResults([], 'test');
      assert(result.includes("couldn't find"));
    });

    it('should format single result', () => {
      const result = formatCompanySearchResults(['TCS'], 'TCS');
      assert(result.includes('TCS'));
    });

    it('should format multiple results', () => {
      const companies = ['TCS', 'Tata Capital', 'Tata Motors'];
      const result = formatCompanySearchResults(companies, 'Tata');
      assert(result.includes('1. TCS'));
      assert(result.includes('2. Tata Capital'));
      assert(result.includes('3. Tata Motors'));
    });
  });

  describe('formatSupportedBanksConfirmation()', () => {
    it('should show message for no supported banks', () => {
      const result = formatSupportedBanksConfirmation('Test Company', []);
      assert(result.includes('no supporting bank policies'));
    });

    it('should list supported banks with categories', () => {
      const banks = [
        { bank_id: 1, bank_name: 'ICICI Bank', company_category: 'MNC' },
        { bank_id: 2, bank_name: 'HDFC Bank', company_category: 'IT Professional' }
      ];
      const result = formatSupportedBanksConfirmation('TCS', banks);
      assert(result.includes('TCS'));
      assert(result.includes('ICICI Bank'));
      assert(result.includes('HDFC Bank'));
      assert(result.includes('2 bank'));
    });
  });

  describe('State Management Integration', () => {
    it('should save and retrieve company selection state', async () => {
      const testConvId = Math.floor(Math.random() * 100000);
      const testCompanyData = {
        selectedCompanyName: 'Test Company',
        supportedBanks: [
          { bank_id: 1, bank_name: 'Test Bank 1', company_category: 'CAT A' }
        ]
      };

      // Save state
      await updateCompanySelectionState(pool, testConvId, testCompanyData);

      // Retrieve state
      const retrieved = await getConversationStateWithCompanyInfo(pool, testConvId);
      
      if (retrieved) {
        assert.strictEqual(retrieved.selectedCompanyName, 'Test Company');
        assert(Array.isArray(retrieved.supportedBanks));
        assert.strictEqual(retrieved.supportedBanks.length, 1);
        assert.strictEqual(retrieved.supportedBanks[0].bank_name, 'Test Bank 1');
      }
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Phase 1 Tests: Company Selection Service\n');
  console.log('To run tests: npm test -- services/companySelectionService.test.js');
  console.log('Or use: mocha services/companySelectionService.test.js --exit');
}

module.exports = {
  // Test helper functions can be exported if needed
};
