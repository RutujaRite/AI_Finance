const userMessage = "YES BANK manager in Pune";

console.log("=== TESTING CURRENT REGEX ===");
const currentBankRegex = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla/i.exec(userMessage);
console.log("Current regex matches:", currentBankRegex);

console.log("\n=== TESTING PROPOSED FIX ===");
const fixedBankRegex = /icici|hdfc|axis|sbi|kotak|indusind|idfc|bajaj|piramal|tata|poonawalla|yes\s*bank/i.exec(userMessage);
console.log("Fixed regex matches:", fixedBankRegex);

console.log("\n=== VERIFYING THE FIX ===");
if (fixedBankRegex) {
  const bankName = fixedBankRegex[0].toUpperCase();
  console.log("✅ Bank name extracted:", bankName);
  console.log("✅ Fix resolves the issue for 'YES BANK manager in Pune'");
} else {
  console.log("❌ Fix does not resolve the issue");
}
