const fs = require("fs");
const path = require("path");

const dir = path.join(process.cwd(), "policy-master-files");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".txt"));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), "utf-8");
  console.log(`\n============================================================`);
  console.log(`BANK FILE: ${file}`);

  // Find lines mentioning categories
  const catLines = content.split("\n").filter(l => 
    /(?:cat|category|tier|diamond|platinum|prime|elite|govt|government|listed)\b/i.test(l) &&
    /(?:salary|lakh|lac|roi|rate|tenure|foir|cap|limit|max|min|nth)/i.test(l)
  );

  console.log(`Found ${catLines.length} category-rule lines. Sample:`);
  catLines.slice(0, 15).forEach(l => console.log("  •", l.trim().substring(0, 100)));
}
