import fs from "fs";
import path from "path";
import { BANK_MASTER_POLICIES } from "../lib/masterPolicies";

const dir = path.join(process.cwd(), "policy-master-files");

interface ParsedRules {
  bankName: string;
  fileName: string;
  minCibil: number | null;
  minAge: number | null;
  maxAge: number | null;
  minLoanAmount: number | null;
  maxLoanAmount: number | null;
  minTenureMonths: number | null;
  maxTenureMonths: number | null;
  minSalary: number | null;
  foirPercent: number | null;
  roi: number | null;
  processingFeePercent: number | null;
  categoriesFound: string[];
}

function parseFileText(fileName: string, text: string): ParsedRules {
  const result: ParsedRules = {
    bankName: "",
    fileName,
    minCibil: null,
    minAge: null,
    maxAge: null,
    minLoanAmount: null,
    maxLoanAmount: null,
    minTenureMonths: null,
    maxTenureMonths: null,
    minSalary: null,
    foirPercent: null,
    roi: null,
    processingFeePercent: null,
    categoriesFound: [],
  };

  // CIBIL
  const cibilM = text.match(/(?:cibil|bureau)\s*(?:score)?[:\s]*(?:>=|>)?\s*(\d{3})/i) ||
                 text.match(/cibil\s*(?:v\d+)?\s*(?:>=|>)\s*(\d{3})/i) ||
                 text.match(/cibil\s*score[:\s]*(\d{3})\+/i) ||
                 text.match(/(\d{3})\+?\s*(?:cibil|bureau)/i);
  if (cibilM) {
    const val = parseInt(cibilM[1], 10);
    if (val >= 600 && val <= 850) result.minCibil = val;
  }

  // Age
  const ageRangeM = text.match(/age[:\s]+(\d{2})\s*(?:to|-)\s*(\d{2})\s*years?/i) ||
                    text.match(/(\d{2})\s*(?:to|-)\s*(\d{2})\s*years?[\s\S]{0,20}age/i) ||
                    text.match(/age\s*(?:range)?[:\s]*(\d{2})\s*-\s*(\d{2})/i);
  if (ageRangeM) {
    result.minAge = parseInt(ageRangeM[1], 10);
    result.maxAge = parseInt(ageRangeM[2], 10);
  } else {
    const minAgeM = text.match(/min(?:imum)?\s*age[:\s]+(\d{2})/i) || text.match(/age[:\s]+min(?:imum)?[:\s]*(\d{2})/i);
    if (minAgeM) result.minAge = parseInt(minAgeM[1], 10);
    const maxAgeM = text.match(/max(?:imum)?\s*age[:\s]+(\d{2})/i) || text.match(/max(?:imum)?\s*age\s*(?:at\s*maturity)?[:\s]+(\d{2})/i);
    if (maxAgeM) result.maxAge = parseInt(maxAgeM[1], 10);
  }

  // Salary
  const salM = text.match(/min(?:imum)?\s*(?:net\s*)?(?:monthly\s*)?(?:salary|income|nth)[:\s]+(?:rs\.?|₹)?\s*([\d,]+)/i) ||
               text.match(/minimum\s*salary[:\s]*(?:rs\.?|₹)?\s*([\d,]+)/i) ||
               text.match(/minimum\s*nth[:\s]*(?:rs\.?|₹)?\s*([\d,]+)/i);
  if (salM) {
    const val = parseInt(salM[1].replace(/,/g, ""), 10);
    if (val >= 10000 && val <= 500000) result.minSalary = val;
  }

  // FOIR
  const foirM = text.match(/(?:standard\s*)?foir[:\s]+(?:up\s*to\s*)?(\d{2})%/i) ||
                text.match(/foir\s*(?:limits?)?[:\s]+(\d{2})%/i) ||
                text.match(/(\d{2})%\s*foir/i);
  if (foirM) {
    result.foirPercent = parseInt(foirM[1], 10);
  }

  // ROI
  const roiM = text.match(/roi[:\s]+(?:starting\s*from\s*)?(\d{1,2}(?:\.\d{1,2})?)\s*%/i) ||
               text.match(/interest\s*rate[:\s]+(?:starting\s*from\s*)?(\d{1,2}(?:\.\d{1,2})?)\s*%/i) ||
               text.match(/starting\s*(?:from\s*)?(\d{1,2}(?:\.\d{1,2})?)\s*%\s*p\.?a/i) ||
               text.match(/rack\s*rate[:\s]*(\d{1,2}(?:\.\d{1,2})?)\s*%/i);
  if (roiM) {
    result.roi = parseFloat(roiM[1]);
  }

  return result;
}

for (const b of BANK_MASTER_POLICIES) {
  const filePath = path.join(dir, b.file_name);
  if (fs.existsSync(filePath)) {
    const text = fs.readFileSync(filePath, "utf-8");
    const parsed = parseFileText(b.file_name, text);
    parsed.bankName = b.bank_name;
    console.log(`[${b.bank_name}] (${b.file_name}):`, parsed);
  } else {
    console.log(`MISSING: ${b.bank_name} -> ${b.file_name}`);
  }
}
