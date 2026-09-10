import fs from "fs";
import path from "path";

const banks = [
  { name: "Bajaj Markets", file: "Bajaj_Markets_Master_Policy.txt" },
  { name: "ICICI Bank", file: "ICICI_Bank_Personal_Loan_Policy_Rulebook.txt" },
  { name: "Axis Bank", file: "AXIS_Master_Policy.txt" },
  { name: "HDFC Bank", file: "HDFC_Bank_Master_Policy_CIBIL_Updated.txt" },
  { name: "IDFC FIRST Bank", file: "IDFC_FIRST_Bank_Master_Policy.txt" },
  { name: "Kotak Mahindra Bank", file: "Kotak_Mahindra_Bank_Master_Policy.txt" },
  { name: "Yes Bank", file: "Yes_Bank_Master_Policy.txt" },
  { name: "SBM Bank India", file: "SBM_Bank_India_Master_Policy_Clean.txt" },
  { name: "Bajaj Finserv", file: "Bajaj_Finserv_Master_Policy.txt" },
  { name: "Axis Finance", file: "Axis_Finance_Master_Policy.txt" },
  { name: "Tata Capital", file: "Tata_Capital_Master_Policy_Clean.txt" },
  { name: "Poonawalla Fincorp", file: "Poonawalla_Fincorp_Master_Policy.txt" }
];

for (const b of banks) {
  const p = path.join(process.cwd(), "policy-master-files", b.file);
  console.log(`================================================================================`);
  console.log(`BANK: ${b.name} | FILE: ${b.file}`);
  console.log(`================================================================================`);
  if (!fs.existsSync(p)) {
    console.log("FILE NOT FOUND!");
    continue;
  }
  const content = fs.readFileSync(p, "utf-8");
  const lines = content.split("\n");
  console.log(`Total Lines: ${lines.length}`);

  // Search for CIBIL, Tenure, Salary, Age, Loan Amount, FOIR, Category sections
  const cibilLines = lines.filter(l => /cibil|credit score|score/i.test(l)).slice(0, 5);
  const tenureLines = lines.filter(l => /tenure|months|years/i.test(l)).slice(0, 5);
  const salaryLines = lines.filter(l => /salary|net take home|nth|income/i.test(l)).slice(0, 5);
  const ageLines = lines.filter(l => /age/i.test(l)).slice(0, 5);
  const amountLines = lines.filter(l => /loan amount|ticket size|max.*loan|min.*loan/i.test(l)).slice(0, 5);
  const foirLines = lines.filter(l => /foir|multiplier/i.test(l)).slice(0, 5);
  const catLines = lines.filter(l => /category|categories|super a|cat a|tata|tcs/i.test(l)).slice(0, 6);

  console.log("--- CIBIL Mentions ---");
  cibilLines.forEach(l => console.log("  " + l.trim()));
  console.log("--- Tenure Mentions ---");
  tenureLines.forEach(l => console.log("  " + l.trim()));
  console.log("--- Salary Mentions ---");
  salaryLines.forEach(l => console.log("  " + l.trim()));
  console.log("--- Age Mentions ---");
  ageLines.forEach(l => console.log("  " + l.trim()));
  console.log("--- Loan Amount Mentions ---");
  amountLines.forEach(l => console.log("  " + l.trim()));
  console.log("--- FOIR Mentions ---");
  foirLines.forEach(l => console.log("  " + l.trim()));
  console.log("--- Category Mentions ---");
  catLines.forEach(l => console.log("  " + l.trim()));
  console.log("\n");
}
