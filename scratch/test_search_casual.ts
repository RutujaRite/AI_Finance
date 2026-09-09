import { searchCompany } from "../lib/companySearch";

async function main() {
  const queries = ["how are you", "what can you do", "hi there", "hello there"];
  for (const q of queries) {
    const res = await searchCompany(q);
    console.log(`Query "${q}" -> found: ${res.found}, candidates: ${res.candidates?.length || 0}`);
  }
}

main().catch(console.error);
