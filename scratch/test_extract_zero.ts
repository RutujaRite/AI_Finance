import { extractApplicantFromText } from "../lib/ai/agent";

console.log("extractApplicantFromText('0'):", extractApplicantFromText("0"));
console.log("extractApplicantFromText('none'):", extractApplicantFromText("none"));
console.log("extractApplicantFromText('no emi'):", extractApplicantFromText("no emi"));
console.log("extractApplicantFromText('0 emi'):", extractApplicantFromText("0 emi"));
