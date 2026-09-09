import fs from "fs";
import path from "path";
import { getAllMasterPolicies } from "../lib/masterPolicies";

function inspectFirst10() {
  const policies = getAllMasterPolicies().slice(0, 10);
  for (const p of policies) {
    const filePath = path.join(process.cwd(), "policy-master-files", p.file_name);
    const content = fs.readFileSync(filePath, "utf-8");

    const cibilLines = content.split("\n").filter(l => /cibil|score|bureau/i.test(l) && /\d{3}/.test(l)).slice(0, 3);
    const ageLines = content.split("\n").filter(l => /age/i.test(l) && /\b(?:1[89]|[2-6]\d)\b/.test(l)).slice(0, 3);
    const salaryLines = content.split("\n").filter(l => /salary|nth|income/i.test(l) && /\b\d{2,3}(?:,\d{3}|k)?\b/i.test(l)).slice(0, 3);

    console.log(`================================================================================`);
    console.log(`🏦 ${p.bank_name} (${p.file_name})`);
    console.log(`  CIBIL:`, cibilLines.map(l => l.trim()));
    console.log(`  Age:`, ageLines.map(l => l.trim()));
    console.log(`  Salary:`, salaryLines.map(l => l.trim()));
  }
}

inspectFirst10();
