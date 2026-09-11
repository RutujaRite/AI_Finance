const userMessage = "Find banks in Pune";

console.log("=== ANALYZING 'Find banks in Pune' ===");

// Test current regex patterns
console.log("\n1. Testing isManagerQuery regex:");
const isManagerQuery = /manager|contact|phone|mobile|email|number|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b|branch manager|contact details/i.test(userMessage);
console.log("   isManagerQuery:", isManagerQuery);

console.log("\n2. Testing bank regex pattern:");
const bankMatch = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla|yes\s*bank/i.exec(userMessage);
console.log("   bankMatch:", bankMatch);

console.log("\n3. Testing isCompanyQuery logic:");
const isBasicLoanEmiQuery = false; // Simplified for test
const isCompanyQuery = /company|employer|category|rating|listing/i.test(userMessage) && !isManagerQuery && !isBasicLoanEmiQuery;
console.log("   isCompanyQuery:", isCompanyQuery);

console.log("\n4. Testing isPolicyQuery logic:");
const isPolicyQuery = /approval|eligibility|salary|cibil|emi|income|foir|interest|roi|tenure|policy|rate|multiplier|assessment|summary|criteria/i.test(userMessage) && !isManagerQuery && !isBasicLoanEmiQuery && !isCompanyQuery;
console.log("   isPolicyQuery:", isPolicyQuery);

console.log("\n=== ANALYSIS ===");
if (isCompanyQuery) {
  console.log("❌ PROBLEM: 'Find banks in Pune' incorrectly matches isCompanyQuery")
  console.log("   This causes it to go to company search instead of bank search")
}

console.log("\n=== EXPECTED BEHAVIOR ===");
console.log("✅ 'Find banks in Pune' should route to bank search (city='Pune')")
console.log("✅ 'Find HDFC bank in Pune' should route to bank search (city='Pune', bank_name='HDFC')")
console.log("✅ 'YES BANK manager in Pune' should route to bank manager search")
console.log("✅ 'Find companies in Pune' should route to company search")
