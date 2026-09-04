const { routeToWorkflow } = require("./services/assistantFlowService");
const { looksLikeCompanyQuery } = require("./services/assistantFlowService");
const { isLoanIntent } = require("./services/assistantFlowService");

console.log("=== Testing isLoanIntent ===");
const loanTests = [
  { input: "I want personal loan", expected: true },
  { input: "Apply for a home loan", expected: true },
  { input: "Need a personal loan for 10 lakhs", expected: true },
  { input: "What are my loan options?", expected: true },
  { input: "TCS", expected: false },
  { input: "Hello", expected: false },
];

loanTests.forEach(test => {
  const result = isLoanIntent(test.input);
  console.log(`${test.input} -> ${result} (expected: ${test.expected}) ${result === test.expected ? '✓' : '✗'}`);
});

console.log("\n=== Testing looksLikeCompanyQuery ===");
const companyTests = [
  { input: "I want personal loan", expected: false },
  { input: "TCS", expected: true },
  { input: "Infosys Ltd", expected: true },
  { input: "Hello, tell me about your company", expected: false },
  { input: "Hi there", expected: false },
  { input: "Tell me about XYZ Company", expected: true },
  { input: "My employer is Reliance Industries", expected: true },
];

companyTests.forEach(test => {
  const result = looksLikeCompanyQuery(test.input);
  console.log(`${test.input} -> ${result} (expected: ${test.expected}) ${result === test.expected ? '✓' : '✗'}`);
});

console.log("\n=== Testing routeToWorkflow ===");
const routeTests = [
  { input: "I want personal loan", expected: "loan" },
  { input: "Apply for a home loan", expected: "loan" },
  { input: "Need a personal loan for 10 lakhs", expected: "loan" },
  { input: "TCS", expected: "company" },
  { input: "Infosys Ltd", expected: "company" },
  { input: "Hello, tell me about your company", expected: "general" },
  { input: "Hi there", expected: "general" },
  { input: "What is the weather today?", expected: "general" },
  { input: "I work at Reliance Industries", expected: "company" },
  { input: "Can you help me with my application", expected: "general" },
];

routeTests.forEach(test => {
  const result = routeToWorkflow(test.input);
  console.log(`${test.input} -> ${result} (expected: ${test.expected}) ${result === test.expected ? '✓' : '✗'}`);
});
