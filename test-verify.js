// Simulated function to check intent (mirrors logic in agent.ts)
function checkIntent(userMessage) {
  const isManagerQuery = /manager|contact|phone|mobile|email|number|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b|branch manager|contact details/i.test(userMessage);
  const isBasicLoanEmiQuery = /(emi|emi\s+calculator|calculate.*emi|emi.*amount|what.*emi|how.*emi)/i.test(userMessage) ||
    /(loan.*interest|interest.*rate|rate.*loan|loan.*rate)/i.test(userMessage) ||
    /(how.*much.*loan|loan.*how.*much|max.*loan|loan.*max)/i.test(userMessage) ||
    /(personal.*loan.*eligib|eligib.*personal.*loan)/i.test(userMessage) ||
    /(for\s+\d+\s+months?)/i.test(userMessage);
  const isCompanyQuery = /company|employer|category|rating|listing/i.test(userMessage) && !isManagerQuery && !isBasicLoanEmiQuery;
  const isPolicyQuery = /approval|eligibility|salary|cibil|emi|income|foir|interest|roi|tenure|policy|rate|multiplier|assessment|summary|criteria/i.test(userMessage) && !isManagerQuery && !isBasicLoanEmiQuery && !isCompanyQuery;
  
  const cityMatch = userMessage.match(/\bin\s+([A-Za-z\s]+?)\s*(?:for|$|\.|,|\b)/i);
  const city = cityMatch ? cityMatch[1].trim() : null;
  const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla|yes\s*bank/i.exec(userMessage);
  const bankName = bankMatch ? bankMatch[0].toUpperCase() : undefined;
  const isBankSearchQuery = (/find banks|banks in|show banks|which banks|list banks|all banks|bank list/i.test(userMessage) || bankName) && !isManagerQuery && !isCompanyQuery && !isPolicyQuery && !isBasicLoanEmiQuery;

  return {
    userMessage,
    isManagerQuery,
    isBasicLoanEmiQuery,
    isCompanyQuery,
    isPolicyQuery,
    city,
    bankName,
    isBankSearchQuery,
    routeTo: isManagerQuery ? 'manager search' : isBankSearchQuery ? 'bank search' : isCompanyQuery ? 'company search' : isPolicyQuery ? 'policy search' : 'fallback'
  };
}

const testCases = [
  "YES BANK manager in Pune",
  "Find HDFC bank in Pune",
  "ICICI Bank manager in Mumbai",
  "Show banks in Delhi",
  "List all banks in Bangalore",
  "Find banks in Pune",
  "Find companies in Pune",
  "YES BANK in",
  "HDFC bank in Pune",
];

console.log("=== TESTING BANK SEARCH INTENT ===\n");

for (const userMessage of testCases) {
  const result = checkIntent(userMessage);
  console.log(`Message: "${result.userMessage}"`);
  console.log(`  isManagerQuery: ${result.isManagerQuery}`);
  console.log(`  isBankSearchQuery: ${result.isBankSearchQuery}`);
  console.log(`  isCompanyQuery: ${result.isCompanyQuery}`);
  console.log(`  isPolicyQuery: ${result.isPolicyQuery}`);
  console.log(`  city: ${result.city}`);
  console.log(`  bankName: ${result.bankName}`);
  console.log(`  → Routes to: ${result.routeTo}`);
  console.log();
}