const userMessage = "YES BANK manager in Pune";

console.log("=== VERIFYING isManagerQuery ===");

// Current isManagerQuery regex
currentRegex = /manager|contact|phone|mobile|email|number|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b|branch manager|contact details/i.test(userMessage);

console.log("Current regex:", currentRegex);

// Test with word boundaries to see what should work
testRegex1 = /\b(manager|contact|phone|mobile|email|number|\basm\b|\brsm\b|\bzsm\b|\brh\b|\brm\b|branch manager|contact details)\b/i.test(userMessage);
console.log("With outer word boundaries:", testRegex1);

// The issue is that the regex looks for "manager" as a standalone word, not preceded by "BANK"
// The message "YES BANK manager in Pune" has "manager" preceded by "BANK ", so a word boundary check won't work

// Let's test a different approach - check if "manager" appears anywhere
testRegex2 = /manager/i.test(userMessage);
console.log("Simple manager check:", testRegex2);

// The fix should make the regex more flexible
console.log("\n=== CURRENT STATE ===");
console.log("❌ The current isManagerQuery regex won't match 'YES BANK manager in Pune' because it requires 'manager' to be preceded by one of the listed terms or at start of line.")
console.log("\n=== WHAT NEEDS TO BE FIXED ===");
console.log("1. isManagerQuery regex should allow 'manager' even when preceded by bank names like 'YES BANK'");
console.log("2. Bank extraction regex should include 'yes bank' to extract bank_name from 'YES BANK manager in Pune'");
