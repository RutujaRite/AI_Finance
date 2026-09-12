// scratch/test_safe_parse.ts
function robustParseMasterAnalysis(rawContent: string): any {
  let cleaned = rawContent
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Attempt to replace unescaped control characters inside string literals
    try {
      const sanitized = cleaned.replace(/(:\s*"[^"]*?)\n([^"]*")/g, "$1\\n$2");
      return JSON.parse(sanitized);
    } catch (e2) {
      console.warn("JSON.parse failed, recovering via regex from LLM output...");
      // Regex extraction fallback from raw LLM output
      const getStr = (key: string) => {
        const m = rawContent.match(new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*[,}\\]])`, "i"));
        return m ? m[1] : null;
      };
      const getNum = (key: string) => {
        const m = rawContent.match(new RegExp(`"${key}"\\s*:\\s*([0-9.]+)`, "i"));
        return m ? Number(m[1]) : null;
      };
      const getBool = (key: string) => {
        const m = rawContent.match(new RegExp(`"${key}"\\s*:\\s*(true|false)`, "i"));
        return m ? m[1].toLowerCase() === "true" : false;
      };

      return {
        userIntent: getStr("userIntent") || "LOAN_ELIGIBILITY",
        isLoanIntent: getBool("isLoanIntent"),
        hasQuestionOrObjection: getBool("hasQuestionOrObjection"),
        questionAnswer: getStr("questionAnswer"),
        extractedDetails: {
          companyName: getStr("companyName"),
          monthlyIncome: getNum("monthlyIncome"),
          loanAmount: getNum("loanAmount"),
          tenureMonths: getNum("tenureMonths"),
          cibil: getNum("cibil"),
          existingEmi: getNum("existingEmi"),
          age: getNum("age"),
          employmentType: getStr("employmentType"),
        },
        isCorrection: getBool("isCorrection"),
        correctedFields: [],
        targetBank: getStr("targetBank"),
        emiDetails: null,
        managerSearch: null,
        companyQuery: getStr("companyQuery"),
        webSearchQuery: getStr("webSearchQuery"),
        naturalResponse: getStr("naturalResponse") || "",
      };
    }
  }
}

const malformed = `{
  "userIntent": "LOAN_ELIGIBILITY",
  "isLoanIntent": true,
  "hasQuestionOrObjection": false,
  "questionAnswer": null,
  "extractedDetails": {
    "companyName": "Tata Consultancy Services",
    "monthlyIncome": 120000,
    "loanAmount": 500000,
    "tenureMonths": 36,
  },
  "naturalResponse": "Great! You work at TCS and earn 1.2 lakhs."
}`;

console.log("Parsed malformed:", robustParseMasterAnalysis(malformed));
