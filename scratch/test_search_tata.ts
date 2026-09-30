import { searchCompany } from "../lib/companySearch";

async function main() {
  const comp = await searchCompany("tata");
  console.log("found:", comp.found);
  console.log("needsDisambiguation:", comp.needsDisambiguation);
  console.log("primaryName:", comp.primaryName);
  console.log("candidates:", comp.candidates);
  console.log("candidateOptions:", comp.candidateOptions);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
