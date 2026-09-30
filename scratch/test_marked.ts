import { formatCompanyCandidateList } from "../lib/companySearch";
// @ts-ignore
import { marked } from "marked";

const sampleList = formatCompanyCandidateList(["TATA LIMITED", "TATA AG", "TATA SKY"], "tata");
console.log("RAW MARKDOWN:\n", sampleList);
console.log("\n--- PARSED HTML ---:\n", marked.parse(sampleList));
