const { getAllMasterPolicies } = require('../lib/masterPolicies');

const policies = getAllMasterPolicies();
console.log(`Total master policies: ${policies.length}`);
policies.forEach((p, idx) => {
  console.log(`${idx + 1}. [${p.bank_code}] ${p.bank_name} -> File: ${p.file_name} (loan_type: ${p.loan_type})`);
});
