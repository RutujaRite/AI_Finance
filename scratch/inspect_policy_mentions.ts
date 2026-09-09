import fs from "fs";
import path from "path";
import { getAllMasterPolicies } from "../lib/masterPolicies";

function inspectPolicyFiles() {
  const policies = getAllMasterPolicies();
  for (const p of policies) {
    const filePath = path.join(process.cwd(), "policy-master-files", p.file_name);
    const content = fs.readFileSync(filePath, "utf-8");

    // Search for CIBIL lines
    const cibilLines = content.split("\n").filter(l => /cibil|score|bureau/i.test(l) && /\d{3}/.test(l)).slice(0, 5);
    // Search for Age lines
    const ageLines = content.split("\n").filter(l => /age/i.test(l) && /\b(?:1[89]|[2-6]\d)\b/.test(l)).slice(0, 5);
    // Search for salary lines
    const salaryLines = content.split("\n").filter(l => /salary|nth|income|take home/i.test(l) && /\b\d{2,3}(?:,\d{3}|k)?\b/i.test(l)).slice(0, 5);

    console.log(`================================================================================`);
    console.log(`🏦 ${p.bank_name} (${p.file_name})`);
    console.log(`  CIBIL mentions:`);
    cibilLines.forEach(l => console.log(`    ${l.trim()}`));
    console.log(`  Age mentions:`);
    ageLines.forEach(l => console.log(`    ${l.trim()}`));
    console.log(`  Salary mentions:`);
    salaryLines.forEach(l => console.log(`    ${l.trim()}`));
  }
}

inspectPolicyFiles();
