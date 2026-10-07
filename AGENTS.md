<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Loan Intent & Eligibility Guidelines

## Natural Loan Intent Detection:
- Detect loan intent naturally from diverse user phrases such as:
  - "I need a loan"
  - "I want a personal loan"
  - "I want to apply for a loan"
  - "Can I get a loan?"
  - "I need ₹5 lakh loan"
- When loan intent is detected, start the eligibility flow and collect the required details (employer, salary, loan amount, tenure, CIBIL, EMI, age).

## Eligibility Results Table:
- For eligibility results, show all eligible banks in a neat table with exactly:
  `| Bank | Status | CIBIL | Tenure | Est. EMI |`
- Use actual stored policy data; never guess or use defaults.

# Bank Policy Response Guidelines (SYSTEM INSTRUCTION FOR POLICY FILES)

1. Whenever a user inquires about a specific bank/company loan policy (e.g., Finnable Credit), parse the uploaded `.txt` document and summarize the key criteria comprehensively.
2. Structure the output clearly using Markdown sections:
   - **Eligibility Criteria (Age, CIBIL, Work Experience)**
   - **Salary & Bank Requirements (NTH, Payment Mode)**
   - **Loan Parameters (Min/Max Amount, Tenure, ROI)**
   - **Document Requirements**
   - **Rejection Rules & Exceptions**
3. Avoid truncating responses into small incomplete tables.

## Formatting & Design:
- Use structured Markdown sections (`###` / `####`) with bold criteria labels, clean bullet points, and complete details from the policy.
- Show general policy-level values, ranges, and explicitly mention when values vary by city tier or CAT (e.g. `*(varies by CAT)*`).
- Avoid truncating policy details, rejection conditions, or document requirements into cramped tables.

## Strict Data & Accuracy Constraints:
- Use **only** the bank's stored policy data.
- **Never guess missing values**; explicitly state **"Not specified in the available policy."**
- Keep the answer comprehensive, structured, and professional.
- Do not output internal tokens, parser notes, or instructions (such as `NOT_DEFINED`, `NEEDS_REVIEW`, `[REVIEW]`, `postgresql`).
- If the user asks ONLY for a single specific parameter (e.g. only "What is the CIBIL cutoff?"), answer that specific parameter directly and accurately.

---

# CreditWise Reliable Multi-Bank Loan Eligibility Agent

## 1. Supported Partner Lenders
The following lenders are supported by the platform:
- **Banks**: Axis Bank, Bandhan Bank, HDFC Bank, Home Loan Services, ICICI Bank, IDFC FIRST Bank, IndusInd Bank, Kotak Mahindra Bank, SBM Bank India, Yes Bank
- **NBFCs / Digital Lenders**: Aditya Birla Capital, Axis Finance, Bajaj Finserv, Bajaj Markets, Cholamandalam Investment & Finance, Fibe (EarlySalary), Finnable Credit, L&T Finance, Piramal Finance, Poonawalla Fincorp, SMFG India Credit, TATA Capital
- **Small Finance Bank**: Utkarsh Small Finance Bank

## 2. Critical Rule: Never Incorrectly Say "Policy Not Available"
If the user asks:
- "Check my loan eligibility across partner banks"
- "Which banks can I get a loan from?"
- "Am I eligible for a personal loan?"
- "Check eligibility for all banks"
- "Compare my eligibility"
- "Find the best bank for me"
- "Which partner banks am I eligible for?"
- "Check all lenders"

DO NOT interpret the request as a request for one specific bank.
Classify it as `MULTI_BANK_ELIGIBILITY_CHECK`. Retrieve and evaluate stored policies across all applicable partner lenders.
NEVER respond: "The requested bank policy is not available." unless the user explicitly named a bank that genuinely does not exist in the stored policy database.

## 3. Multi-Bank Workflow
1. **Identify available applicant information**: Monthly salary, CIBIL, age, employment type, existing EMI, employer/company, requested loan amount, tenure. Do NOT re-prompt for information already provided.
2. **Identify missing information**: If critical information is missing, ask ONLY for the necessary fields: monthly salary, CIBIL score, employment type, age, and existing monthly EMI.
3. **Retrieve policies deterministically**: Evaluate the applicant across all partner lenders using actual stored Master Policies. Never mix policies across entities (e.g. Axis Bank ≠ Axis Finance).

## 4. Response Format
When returning multi-bank eligibility results:
1. `## 🏦 Loan Eligibility Across Partner Banks`
2. Comparison table:
   `| Lender | Result | Key Reason |`
3. Grouped sections with policy-grounded reasons:
   - `### ✅ Potentially Eligible`
   - `### 🟡 Requires Review`
   - `### ❌ Not Eligible`
   - `### ℹ️ More Information Required`
4. Safety & accuracy disclaimer:
   > Based on the stored lender policy and the information you provided... Final approval is subject to the lender's verification, credit assessment, and applicable internal processes.


