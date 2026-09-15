const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'policy-master-files');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && !f.includes('home_loan'));

console.log(`Found ${files.length} personal loan policy files.`);

const results = {};

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  results[file] = {
    length: content.length,
    hasAge: /age/i.test(content),
    hasSalary: /salary|income|nmi/i.test(content),
    hasCibil: /cibil/i.test(content),
    hasTenure: /tenure/i.test(content),
    hasFoir: /foir/i.test(content),
    hasRoi: /roi|interest\s*rate/i.test(content),
  };
}

console.log(JSON.stringify(results, null, 2));
