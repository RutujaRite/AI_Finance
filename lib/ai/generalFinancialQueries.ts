// lib/ai/generalFinancialQueries.ts

import { normalizeBankName } from "@/lib/ai/intentClassifier";

const getApiKey = () => process.env.OPENROUTER_API_KEY || "";
const getModel = () => (process.env.OPENROUTER_MODEL || "openrouter/auto").replace(/^["']|["']$/g, "").trim();

export const RESUME_TRANSITION_LINE = "We can continue your loan eligibility check whenever you're ready. Would you like to proceed?";

/**
 * Determines whether a user message is an informational or educational general financial query
 * (e.g. "What is a processing fee?", "How is interest calculated?", "What is FOIR?", etc.)
 * rather than an active loan application, bank policy inquiry, or profile parameter input.
 */
export function isGeneralFinancialQuery(message: string): boolean {
  if (!message || typeof message !== "string") return false;
  const text = message.trim().toLowerCase();

  // 1. Guard against active personal loan intents / applications
  if (
    /^(?:i\s*(?:need|want|would\s*like|am\s*looking\s*for)\s*(?:a\s*)?loan|apply\s*for\s*(?:a\s*)?loan|check\s*(?:my|our)?\s*eligib\w*|am\s*i\s*eligible|can\s*i\s*(?:get|apply\s*for)\s*a\s*loan)\b/i.test(text)
  ) {
    return false;
  }

  // 2. Guard against standalone parameter updates / answers
  if (
    /^(?:rs\.?|inr|₹)?\s*[0-9]+(?:\.[0-9]+)?\s*(?:lakhs?|lacs?|lac|l|crores?|cr|thousand|k)?$/i.test(text) ||
    /^(?:salary|income|loan|tenure|cibil|age|emi)\s*is\s*[0-9]+/i.test(text) ||
    /^(?:yes|no|sure|ok|okay|skip|none|nil|n\/a|not\s*sure|don'?t\s*know)$/i.test(text)
  ) {
    return false;
  }

  // 3. Guard against bank-specific queries that mention specific partner banks
  // User Rule: "if i mention bank then go though that bank"
  const bankMatch = /(?:axis\s*finance|axis\s*bank|\baxis\b|bajaj\s*markets?|bajaj\s*finserv|\bbajaj\b|tata\s*capital|hdfc|icici|sbi|state\s*bank|kotak|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|l&t|ltf|lt\s*finance)/i.test(text);
  if (bankMatch) {
    return false;
  }

  // Guard against follow-up parameter queries referencing a previously selected bank or company
  if (
    /\b(?:its|their|this\s*bank'?s?|that\s*bank'?s?)\s+(?:minimum|cutoff|cibil|roi|interest|rate|tenure|salary|income|policy|requirements?|criteria)\b/i.test(text) ||
    /^(?:what|how\s*much)\s+is\s+(?:its|their)\s+(?:minimum\s+)?(?:cibil|score|cutoff|salary|income|tenure|roi|interest|rate|loan|limit|policy)/i.test(text)
  ) {
    return false;
  }

  // 4. Core Informational / Educational Financial Topics
  const hasQuestionFraming =
    /^(?:what\s*(?:is|are|does|do|mean)|how\s*(?:is|does|do|can|to)|why\s*(?:is|are|do|does)|explain|can\s*you\s*explain|tell\s*me\s*(?:about|how)|meaning\s*of|definition\s*of|difference\s*between|is\s*(?:there|it|a)|does\s*(?:a|it)|who\s*(?:pays|charges)|which\s*(?:are\s*the\s*)?documents?|what\s*(?:are\s*the\s*)?documents?)\b/i.test(text) ||
    /\b(?:what\s*(?:is|are|does|do)|how\s*(?:is|does|do|can)|explain|can\s*you\s*explain|tell\s*me\s*about|meaning\s*of|definition\s*of|which\s*documents?|what\s*documents?)\b/i.test(text) ||
    /\?$/.test(text);

  const hasFinancialTopic =
    /\b(?:processing\s*fees?|proc(?:essing)?\s*fee|\bpf\b|admin\s*fee|file\s*charge)/i.test(text) ||
    /\b(?:how\s*(?:is\s*)?interest\s*calculated|interest\s*calculat\w*|reducing\s*(?:balance|rate)|diminishing\s*(?:balance|rate)|flat\s*(?:rate|interest)|flat\s*vs\s*reducing|interest\s*formula)\b/i.test(text) ||
    /\b(?:foir|fixed\s*obligation|debt\s*to\s*income|\bdti\b|obligation\s*ratio)\b/i.test(text) ||
    /\b(?:what\s*is\s*(?:a\s*)?cibil\w*|cibil\w*|credit\s*score|bureau\s*score|experian|cibil\s*range|good\s*cibil)\b/i.test(text) ||
    /\b(?:foreclosure|pre-?closure|pre-?payment|part-?payment|prepaying|lock-?in\s*period|prepayment\s*penalty|foreclosure\s*charges?)\b/i.test(text) ||
    /\b(?:amortiz\w*|amortisation\s*schedule|what\s*is\s*(?:an?\s*)?emi|how\s*(?:does\s*)?emi\s*work|equated\s*monthly\s*installment)\b/i.test(text) ||
    /\b(?:apr\b|annual\s*percentage\s*rate|effective\s*interest\s*rate|true\s*cost\s*of\s*borrowing)\b/i.test(text) ||
    /\b(?:unsecured\s*loan|secured\s*vs\s*unsecured|collateral|why.*collateral)\b/i.test(text) ||
    /\b(?:balance\s*transfer|credit\s*card\s*bt|loan\s*bt|top-?up\s*loan)\b/i.test(text) ||
    /\b(?:bounce\s*charges?|late\s*payment\s*fee|penal\s*interest)\b/i.test(text) ||
    /\b(?:net\s*take\s*home|\bnth\b|gross\s*vs\s*net\s*salary)\b/i.test(text) ||
    /\b(?:doc|docs|document|documents|paperwork|papers?|kyc|checklist)\b/i.test(text);

  return hasQuestionFraming && hasFinancialTopic;
}

/**
 * Curated knowledge base of authoritative educational explanations for core personal loan concepts.
 */
export const FINANCIAL_KNOWLEDGE_BASE: Record<string, string> = {
  PROCESSING_FEE: `### 💳 Personal Loan Processing Fee Explained

A **processing fee** is a one-time, non-refundable administrative charge levied by banks and NBFCs to process, verify, and underwrite your loan application.

#### Key Details:
- **Typical Cost**: Usually ranges between **1% to 3%** of the sanctioned loan amount, subject to a minimum charge (typically ₹1,000 to ₹5,000) plus **18% GST**.
- **How It Is Deducted**: The fee is almost always deducted upfront directly from your disbursed loan amount. For example, on a ₹5,00,000 loan with a 2% fee (₹10,000 + GST), you will receive approximately ₹4,88,200 in your bank account, while servicing EMIs on the full ₹5,00,000 principal.
- **What It Covers**:
  - Credit bureau checks (CIBIL/Experian score retrieval)
  - KYC & applicant identity verification
  - Employer categorization and salary documentation verification
  - Administrative and legal underwriting costs
- **Refund Policy**: Processing fees are non-refundable once the application is processed, even if you decide not to proceed with disbursement.`,

  INTEREST_CALCULATION: `### 📊 How Personal Loan Interest is Calculated

In India, personal loan interest is almost universally calculated using the **Reducing Balance Method** (or Diminishing Balance Method). Under this method, interest is computed each month only on the remaining outstanding principal, not on the original borrowed amount.

#### 1. The Standard EMI Formula:
$$\\text{EMI} = \\frac{P \\times r \\times (1 + r)^n}{(1 + r)^n - 1}$$

- **P (Principal)**: The sanctioned loan amount borrowed.
- **r (Monthly Interest Rate)**: Annual rate of interest divided by 12 and then divided by 100 *(e.g., 12% per annum = 12 / 12 / 100 = 0.01 per month)*.
- **n (Tenure in Months)**: Total number of monthly installments *(e.g., 5 years = 60 months)*.

#### 2. The Amortization Breakdown:
Every monthly EMI consists of two parts:
- **Interest Component**: Calculated as $\\text{Outstanding Principal} \\times r$.
- **Principal Component**: Calculated as $\\text{EMI} - \\text{Interest Component}$.

*In the early months, a larger portion of your EMI goes towards interest. As the principal reduces over time, the interest component decreases and principal repayment increases.*

#### 3. Reducing Balance vs. Flat Rate:
- **Reducing Balance Rate (Standard)**: Interest reduces as you pay down the loan.
- **Flat Rate (Misleading)**: Interest is charged on the initial principal throughout the entire tenure. A flat rate of 8% is roughly equivalent to a **14%–15% reducing rate**! Always compare reducing balance rates or APR.`,

  FOIR_EXPLANATION: `### ⚖️ FOIR (Fixed Obligation to Income Ratio) Explained

**FOIR** (also referred to as Debt-to-Income or DTI ratio) is the primary underwriting metric lenders use to determine your maximum loan eligibility and repayment capacity.

#### 1. Formula:
$$\\text{FOIR (\\%)} = \\frac{\\text{Total Existing Monthly EMIs} + \\text{Proposed New Loan EMI}}{\\text{Net Monthly Take-Home Salary}} \\times 100$$

#### 2. Typical Bank Benchmarks:
- **Standard Benchmark**: Most institutional lenders cap FOIR between **40% and 55%**.
- **High-Income Earners (Salary > ₹1 Lakh/month)**: Tier-1 banks (e.g. HDFC, ICICI, Axis) may permit up to **60%–65%** FOIR.
- **Super-Cat / Cat A Corporate Employees**: May qualify for higher FOIR caps due to high job stability.

#### 3. Why It Matters:
Banks require you to retain at least **40% to 50%** of your monthly income for essential living expenses. If your existing EMIs already consume 40% of your income, your new loan eligibility will be capped by the remaining 10%–15% margin.`,

  CIBIL_SCORE: `### 📈 CIBIL & Credit Score Explained

A **CIBIL score** is a 3-digit numerical credit summary ranging from **300 to 900** issued by TransUnion CIBIL, representing your credit history and repayment reliability.

#### Score Tiers & Loan Approval Impact:
- **750 to 900 (Excellent)**: Highest approval rates, lowest interest rates (starting ~10.5%–11%), and processing fee discounts.
- **700 to 749 (Good)**: Eligible with most mainstream banks (HDFC, ICICI, Kotak, ABFL).
- **650 to 699 (Fair/Moderate)**: May require higher income, Cat A employer status, or NBFC lenders with higher interest rates.
- **Below 650 (Poor)**: High risk of rejection; unsecured personal loans are generally not sanctioned.
- **0 / -1 / NHA (New to Credit)**: No prior credit history. Several partner banks evaluate NTC applicants using baseline benchmarks (such as baseline CIBIL 700) along with salary and employer profile.

#### Key Factors Influencing Your Score:
- **Payment History (35%)**: Paying EMIs and credit card bills on time.
- **Credit Utilization Ratio (30%)**: Keeping credit card spending below 30% of total limit.
- **Credit Mix (10%)**: Having a healthy balance of secured and unsecured credit.
- **Recent Inquiries (10%)**: Avoiding multiple hard loan inquiries in short periods.`,

  PREPAYMENT_FORECLOSURE: `### 🔓 Prepayment & Foreclosure on Personal Loans Explained

Prepayment allows you to pay off your personal loan before the end of the agreed tenure, significantly reducing your overall interest expense.

#### 1. Foreclosure vs Part-Payment:
- **Foreclosure (Full Pre-closure)**: Paying off the entire outstanding principal balance in one go to completely close the loan account.
- **Part-Prepayment**: Paying a lump sum towards the principal to either lower your future EMI amount or shorten your remaining tenure.

#### 2. Key Terms & Charges:
- **Lock-in Period**: Most institutional banks (e.g., HDFC, ICICI, Kotak) mandate a minimum lock-in period of **6 to 12 months** before prepayment is permitted.
- **Foreclosure Charges**: Typically range from **2% to 5%** of the outstanding principal balance (+ 18% GST).
- **Zero Prepayment NBFCs**: Some digital NBFCs (such as Fibe or Finnable) offer zero foreclosure charges after a specified track record.`,

  AMORTIZATION_EXPLANATION: `### 📅 Loan Amortization Schedule Explained

An **amortization schedule** is a complete table showing every scheduled monthly payment throughout the tenure of your personal loan.

#### Key Components:
- **Installment Number**: Month 1 to Month N.
- **EMI Amount**: The fixed monthly installment paid.
- **Principal Paid**: The portion reducing your loan balance.
- **Interest Paid**: The monthly financing cost charged by the lender.
- **Ending Balance**: Remaining loan amount owed after each payment.

*Because interest is charged on the diminishing balance, the interest payment is highest in the first year and gradually declines to near zero towards the final installments.*`,

  APR_EXPLANATION: `### 🔍 APR (Annual Percentage Rate) Explained

**APR** (Annual Percentage Rate) represents the **true annual cost of borrowing**, accounting for both the nominal interest rate and all upfront mandatory fees (such as processing fees, documentation charges, and GST).

#### Why APR is Better Than Flat Interest Rates:
- A nominal interest rate of 11.5% with a 3% processing fee has an effective APR of approximately **12.8% to 13.2%**.
- Comparing APR gives you the exact cost comparison across different banks.`,

  UNSECURED_LOAN: `### 🛡️ Unsecured Personal Loans Explained

An **unsecured personal loan** is a loan sanctioned without requiring any collateral or security (such as property, gold, or fixed deposits).

#### Key Features:
- **No Collateral**: Approval depends entirely on your creditworthiness, net monthly salary, employer category, and CIBIL score.
- **End-Use Flexibility**: Funds can be used for any legitimate personal purpose (medical emergencies, weddings, home renovation, debt consolidation).
- **Disbursal Speed**: Typically disbursed within 24 to 48 hours for salaried applicants.`,

  PERSONAL_LOAN_BASICS: `### 🏦 Personal Loan Basics & How It Works

A **personal loan** is an unsecured credit facility provided by banks and NBFCs based on your income, employer reputation, and credit history.

#### 1. Core Parameters:
- **Loan Amount**: Typically from ₹50,000 up to ₹40–50 Lakhs depending on your net monthly salary and employer category.
- **Tenure**: Repayment tenure ranges from **12 to 84 months**.
- **Interest Rates**: Typically starting from **10.25% to 15.00% p.a.** on a reducing balance basis for prime salaried applicants.
- **Processing Time**: 24 to 48 hours with digital KYC and net banking salary verification.

#### 2. Key Eligibility Factors:
- **Age**: 21 to 60 years.
- **Minimum Net Take-Home (NTH)**: Starting from ₹15,000/month (digital NBFCs) to ₹25,000–₹50,000/month (Tier-1 private banks).
- **CIBIL Score**: 700+ preferred; 750+ qualifies for the best pricing.
- **FOIR (Fixed Obligation to Income Ratio)**: Total monthly EMIs capped between 40% and 65% of net income.`,

  HOME_LOAN_BASICS: `### 🏠 Home Loan Fundamentals Explained

A **home loan** is a secured loan used to purchase, construct, or renovate residential property, where the underlying property serves as collateral.

#### 1. Core Parameters:
- **Loan-to-Value (LTV) Ratio**:
  - Up to ₹30 Lakhs: Up to **90%** of property value.
  - ₹30 Lakhs to ₹75 Lakhs: Up to **80%** of property value.
  - Above ₹75 Lakhs: Up to **75%** of property value.
  - *The remaining 10%–25% represents the borrower's down payment.*
- **Repayment Tenure**: Up to **30 years (360 months)**.
- **Interest Rates**: Typically starting from **8.40% to 9.50% p.a.** linked to the RBI Repo Rate (EBLR/RLLR).
- **Tax Benefits**: Deductions available under **Section 80C** (principal repayment up to ₹1.5 Lakh/year) and **Section 24(b)** (interest payment up to ₹2 Lakh/year for self-occupied property).

#### 2. Home Loan vs. Personal Loan:
- **Secured vs. Unsecured**: Home loans require property mortgage; personal loans are 100% unsecured.
- **Interest Rate**: Home loans (8.4%–9.5%) are substantially lower than personal loans (10.25%–16%).
- **Tenure**: Home loans extend up to 30 years vs. 1 to 7 years for personal loans.`,

  GENERAL_DOCUMENTS: `### 📋 Standard Documents Required for Personal Loans

Across all banks and NBFCs in India, personal loan documentation is standardized into four core categories for salaried applicants:

#### 1. Identity Proof (Any One):
• **PAN Card** *(Mandatory for all financial transactions)*
• **Aadhaar Card**
• **Passport**
• **Voter ID Card** or **Driving License**

#### 2. Address / Residence Proof (Any One):
• **Aadhaar Card** *(with current residential address)*
• **Valid Passport**
• **Utility Bill** *(Electricity, Water, or Piped Gas bill not older than 2 months)*
• **Registered Rent Agreement** *(if residing in rented accommodation)*

#### 3. Income Proof:
• **Salary Slips**: Latest **3 consecutive months' pay slips** clearly showing Gross & Net Salary with statutory deductions (PF, Tax).
• **Form 16 / ITR**: Latest **Form 16** (Part A & B) or Income Tax Return for the last 1–2 assessment years.

#### 4. Banking & Employment Proof:
• **Bank Statements**: Latest **3 to 6 months' salary account bank statements** (in original PDF e-statement format with password, showing regular salary credits).
• **Company ID Card** or **Official Corporate Email Verification**.
• **Appointment / Increment Letter** *(if you joined your current employer less than 6 months ago)*.

---
💡 *Note: If you have a specific partner bank in mind (e.g., HDFC, ICICI, Axis, Kotak), I can provide that bank's exact documentation rules!*`,
};

/**
 * Matches the query to a built-in topic or falls back to LLM / rule-based generation.
 */
export async function answerGeneralFinancialQuery(
  userQuery: string,
  modelOverride?: string,
  options?: { onToken?: (token: string) => void; signal?: AbortSignal }
): Promise<string> {
  const norm = userQuery.toLowerCase().trim();

  // 1. Direct Knowledge Base Match
  if (/\b(?:home\s*loan|house\s*loan|mortgage|ltv|down\s*payment|property\s*valuation)\b/i.test(norm) && !/personal\s*loan/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.HOME_LOAN_BASICS;
  }

  if (/\b(?:what\s+is\s+(?:a\s+)?personal\s*loan|how\s+does\s+(?:a\s+)?personal\s*loan\s*work|explain\s+personal\s*loan|personal\s*loan\s*basics)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.PERSONAL_LOAN_BASICS;
  }

  if (/\b(?:processing\s*fees?|proc(?:essing)?\s*fee|\bpf\b|admin\s*fee|file\s*charge)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.PROCESSING_FEE;
  }

  if (/\b(?:interest\s*calculat\w*|how\s*(?:is\s*)?interest\s*calculated|reducing\s*(?:balance|rate)|diminishing\s*(?:balance|rate)|flat\s*(?:rate|interest)|flat\s*vs\s*reducing|interest\s*formula)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.INTEREST_CALCULATION;
  }

  if (/\b(?:foir|fixed\s*obligation|debt\s*to\s*income|\bdti\b|obligation\s*ratio)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.FOIR_EXPLANATION;
  }

  if (/\b(?:cibil\w*|credit\s*score|bureau\s*score|experian)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.CIBIL_SCORE;
  }

  if (/\b(?:doc|docs|document|documents|paperwork|papers?|checklist|kyc)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.GENERAL_DOCUMENTS;
  }

  if (/\b(?:foreclosure|pre-?closure|pre-?payment|part-?payment|prepaying|lock-?in\s*period|prepayment\s*penalty)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.PREPAYMENT_FORECLOSURE;
  }

  if (/\b(?:amortiz\w*|schedule)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.AMORTIZATION_EXPLANATION;
  }

  if (/\b(?:apr\b|annual\s*percentage\s*rate|effective\s*rate)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.APR_EXPLANATION;
  }

  if (/\b(?:unsecured|collateral)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.UNSECURED_LOAN;
  }

  // 2. OpenRouter LLM Call for Arbitrary Educational Queries
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const messages: any[] = [
        {
          role: "system",
          content:
            "You are CreditWise AI, an expert banking and loan education assistant. " +
            "The user is asking an informational or educational question about financial or personal loan concepts. " +
            "Answer the question directly, accurately, and clearly using structured markdown with bullet points. " +
            "Do NOT push corporate lookups, bank selections, or loan applications in your answer. " +
            "Do NOT include conversational sign-offs or questions at the end.",
        },
        {
          role: "user",
          content: userQuery,
        },
      ];

      if (options?.onToken) {
        const { openRouterChatStream } = await import("@/lib/openrouter");
        const streamedContent = await openRouterChatStream(messages, options.onToken, {
          model: modelOverride || getModel(),
          signal: options?.signal,
          max_tokens: 500,
          reasoningMaxTokens: 0,
        });
        if (streamedContent && streamedContent.trim().length > 30) {
          return streamedContent.trim();
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "CreditWise AI",
        },
        body: JSON.stringify({
          model: modelOverride || getModel(),
          max_tokens: 500,
          temperature: 0.1,
          reasoning: { max_tokens: 0 },
          messages,
        }),
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content && content.length > 50) {
          return content;
        }
      }
    } catch (err) {
      console.warn("[GeneralFinancialQuery] LLM call failed or timed out:", err);
    }
  }

  // 3. Fallback generic explanation for other loan terms
  return (
    `### 💡 Financial Concept Explanation\n\n` +
    `Regarding your question on **"${userQuery}"**:\n\n` +
    `- **General Rule**: In personal lending, terms and conditions are established by institutional bank policy and regulated by the Reserve Bank of India (RBI).\n` +
    `- **Key Consideration**: Lenders evaluate risk based on monthly income, employer category, existing EMI obligations (FOIR), and credit track record (CIBIL score).\n` +
    `- **Best Practice**: Always compare the Annual Percentage Rate (APR) including processing fees and tenure options across multiple partner banks to choose the most cost-effective loan.`
  );
}

export type GeneralLoanAssistanceType =
  | "LOAN_INTRO"
  | "DIFFERENT_LOAN_TYPE"
  | "OFFERS"
  | "BANK_PROCESSING"
  | "APPLICATION_STEPS"
  | "CONTEXTUAL_ISSUE";

export interface GeneralLoanAssistanceMatch {
  isMatch: boolean;
  type?: GeneralLoanAssistanceType;
  targetBank?: string;
  loanType?: string;
}

export function isGeneralLoanAssistanceQuery(message: string): GeneralLoanAssistanceMatch {
  if (!message || typeof message !== "string") return { isMatch: false };
  const text = message.trim().toLowerCase();
  const cleanText = text.replace(/[.!?]+$/, "").trim();

  // Guard against bank policy queries that ask for specific rules/cutoffs
  const isSpecificPolicyAsk = /\b(?:policy|guidelines?|rules?|criteria|cutoff|cut-off|foir|roi|minimum\s*salary|min\s*salary|work\s*exp)\b/i.test(text);

  // 1. Contextual Issue Query ("What is the issue?", "What is the problem?", "Why?", "What happened?")
  const strippedIssue = text.replace(/[?.,!]+$/, "").trim();
  if (/^(?:what\s+is\s+(?:the\s+)?(?:issue|problem|error)|why(?:\s+so|\s+this)?|what\s+happened|is\s+there\s+(?:an?\s+)?(?:issue|problem))$/i.test(strippedIssue)) {
    return { isMatch: true, type: "CONTEXTUAL_ISSUE" };
  }

  // 2. Application Steps / Process ("Give me steps to apply for a personal loan", "How to apply", "What is the process", "tell me the process")
  if (
    /(?:steps?\s+to\s+apply|how\s+to\s+apply|how\s+can\s+i\s+apply|how\s+do\s+i\s+apply|procedure\s+to\s+apply|process\s+to\s+apply|application\s+process|steps?\s+for\s+(?:a\s+)?loan|how\s+does\s+(?:a\s+)?personal\s+loan\s+work|don'?t\s+know\s+(?:the\s+)?process|tell\s+me\s+(?:the\s+)?process|explain\s+(?:the\s+)?process|what\s+is\s+(?:the\s+)?process)/i.test(text)
  ) {
    if (/education(?:al)?\s*loan|student\s*loan/i.test(text)) {
      return { isMatch: true, type: "DIFFERENT_LOAN_TYPE", loanType: "Education Loan" };
    }
    if (/home\s*loan|house\s*loan/i.test(text)) {
      return { isMatch: true, type: "DIFFERENT_LOAN_TYPE", loanType: "Home Loan" };
    }
    if (/business\s*loan|msme\s*loan/i.test(text)) {
      return { isMatch: true, type: "DIFFERENT_LOAN_TYPE", loanType: "Business Loan" };
    }
    if (/car\s*loan|auto\s*loan|vehicle\s*loan/i.test(text)) {
      return { isMatch: true, type: "DIFFERENT_LOAN_TYPE", loanType: "Auto / Vehicle Loan" };
    }
    if (/credit\s*card/i.test(text)) {
      return { isMatch: true, type: "DIFFERENT_LOAN_TYPE", loanType: "Credit Card" };
    }
    return { isMatch: true, type: "APPLICATION_STEPS" };
  }

  // 3. Offers / Deals / Discounts / Schemes ("Do you have any personal loan offers?", "Any loan offers?", "What offers do you have?")
  const isOfferQuery =
    /(?:(?:do\s+you\s+have|are\s+there|show\s+me|tell\s+me(?:\s+about)?|give\s+me|what\s+are|share)\s+(?:any\s+)?(?:the\s+)?(?:current\s+|latest\s+|best\s+|special\s+)?(?:personal\s*loan|loan|home\s*loan|instant\s*loan)?\s*(?:offers?|deals?|discounts?|schemes?)|(?:any|current|latest|best|special)\s+(?:personal\s*loan|loan|home\s*loan|instant\s*loan)?\s*offers?\b|what\s+(?:personal\s*loan\s+|loan\s+)?offers?\s+(?:do\s+you\s+have|are\s+(?:there|available))|^(?:personal\s*loan\s+|loan\s+)?offers?\??$|(?:personal\s*loan|loan)\s+offers?\b)/i.test(text) &&
    !/(?:my\s*salary|my\s*cibil|i\s*work\s*at)/i.test(text);

  if (isOfferQuery) {
    return { isMatch: true, type: "OFFERS" };
  }

  // 4. Bank-Specific Processing Inquiry ("Can you process a loan for ICICI Bank?", "Can I apply for ICICI Bank through CreditWise?")
  const bankMatch = /(?:axis\s*finance|axis\s*bank|\baxis\b|bajaj\s*markets?|bajaj\s*finserv|\bbajaj\b|tata\s*capital|hdfc\s*bank|\bhdfc\b|icici\s*bank|\bicici\b|sbi|state\s*bank\s*of\s*india|kotak\s*mahindra\s*bank|\bkotak\b|idfc\s*first\s*bank|\bidfc\b|indusind\s*bank|\bindusind\b|bandhan\s*bank|\bbandhan\b|yes\s*bank|piramal\s*finance|\bpiramal\b|poonawalla\s*fincorp|\bpoonawalla\b|chola(?:mandalam)?|smfg|finnable\s*credit|\bfinnable\b|fibe|sbm\s*bank|\bsbm\b|utkarsh)/i.exec(text);
  if (
    bankMatch &&
    /(?:can\s+(?:you|we)\s+process|do\s+you\s+process|can\s+i\s+process|can\s+i\s+apply\s+(?:for|with|through\s+you\s+for)|can\s+you\s+get\s+me\s+a\s+loan\s+(?:from|with|for)|process\s+(?:a\s+)?loan\s+for|apply\s+for\s+[a-z\s]+loan\s+here)/i.test(text) &&
    !isSpecificPolicyAsk
  ) {
    return { isMatch: true, type: "BANK_PROCESSING", targetBank: normalizeBankName(bankMatch[0]) };
  }

  // 5. Different Loan Types ("I need a home loan", "Can I get a car loan", "business loan", "education loan", "educational loan", "credit card")
  if (
    /(?:home\s*loan|house\s*loan|mortgage\s*loan|car\s*loan|auto\s*loan|vehicle\s*loan|business\s*loan|msme\s*loan|education(?:al)?\s*loan|student\s*loan|credit\s*card)/i.test(text) &&
    !/personal\s*loan/i.test(text)
  ) {
    let specificType = "Home Loan";
    if (/car\s*loan|auto\s*loan|vehicle\s*loan/i.test(text)) specificType = "Auto / Vehicle Loan";
    else if (/business\s*loan|msme\s*loan/i.test(text)) specificType = "Business Loan";
    else if (/education(?:al)?\s*loan|student\s*loan/i.test(text)) specificType = "Education Loan";
    else if (/credit\s*card/i.test(text)) specificType = "Credit Card";
    return { isMatch: true, type: "DIFFERENT_LOAN_TYPE", loanType: specificType };
  }

  // 6. Generic Loan Intent Introduction ("I want a personal loan", "I need a loan", "Can I get a loan?", "I want a loan")
  // Must NOT contain specific applicant details (like salary, CIBIL, company) and must NOT be an explicit eligibility check request
  const isGenericLoanIntent =
    /^(?:i\s*(?:need|want|require|would\s*like|am\s*looking\s*for)\s*(?:a\s*)?(?:personal\s*)?loan|can\s*i\s*get\s*(?:a\s*)?(?:personal\s*)?loan\??|i\s*want\s*to\s*apply\s*(?:for\s*(?:a\s*)?(?:personal\s*)?loan)?|looking\s*for\s*(?:a\s*)?(?:personal\s*)?loan|loan\s*chahiye|need\s*loan|get\s*me\s*a\s*(?:personal\s*)?loan|help\s*me\s*get\s*a\s*(?:personal\s*)?loan)$/i.test(cleanText);

  const hasExplicitEligibilityKeyword = /(?:check|calculat|evaluat|test)\s*(?:my|our)?\s*(?:loan\s*)?eligib\w*/i.test(cleanText);
  const hasNumbersOrParams = /(?:₹|rs\.?|\b[\d,]+k|\b[\d,]+lakh|\b[\d,]+lac|\d{5,})\b/i.test(cleanText) || /\b(?:salary|income|cibil|employed|work\s+at)\b/i.test(cleanText);

  if (isGenericLoanIntent && !hasExplicitEligibilityKeyword && !hasNumbersOrParams) {
    return { isMatch: true, type: "LOAN_INTRO" };
  }

  return { isMatch: false };
}

export function getGeneralLoanAssistanceReply(
  match: GeneralLoanAssistanceMatch,
  options?: { isEligibleFlowActive?: boolean; history?: Array<{ role: string; content: string }> }
): string {
  switch (match.type) {
    case "LOAN_INTRO":
      return (
        `### 🏦 Welcome to CreditWise Personal Loans!\n\n` +
        `Absolutely! 😊 I can help you explore loan options, understand bank requirements, check your eligibility, and find the right banking assistance.\n\n` +
        `Here is what we can do across our **23+ partner banks and NBFCs**:\n` +
        `• **Check Eligibility**: Instantly calculate your borrowing capacity and estimated EMI based on your employer category and salary.\n` +
        `• **Explore Bank Policies**: Compare interest rates (starting ~10.25% p.a.), CIBIL cutoffs, and tenure options.\n` +
        `• **Branch Manager Assistance**: Connect directly with bank managers in your city for quick application processing.\n\n` +
        `Would you like to explore loan options or check your eligibility?`
      );

    case "DIFFERENT_LOAN_TYPE": {
      const type = match.loanType || "Home Loan";
      if (type === "Education Loan") {
        return (
          `### 🎓 Education Loan Application Process (Step-by-Step)\n\n` +
          `Here is the complete, step-by-step process to apply for an **education loan** in India:\n\n` +
          `#### 1. Secure Admission & Collect Offer Letter\n` +
          `Ensure you have a confirmed admission or provisional offer letter from a recognized university or college (in India or abroad) with the complete course fee structure.\n\n` +
          `#### 2. Estimate Total Financing Needed\n` +
          `Calculate all eligible expenses: tuition fees, hostel/accommodation costs, examination fees, books, study equipment/laptop, and travel/passage expenses (for studies abroad).\n\n` +
          `#### 3. Prepare the Required Documents\n` +
          `• **Student Documents**: KYC (Aadhaar, PAN, Passport), mark sheets (10th, 12th, graduation), entrance scorecards (CAT, GRE, GMAT, IELTS, etc.), and official admission letter.\n` +
          `• **Co-Applicant Documents** (Parent/Guardian): KYC, address proof, last 3 months' salary slips or 2 years' ITR, and 6 months' bank statements.\n` +
          `• **Collateral** (if applicable): For loans above ₹7.5 Lakhs, tangible collateral (FD, residential/commercial property) or a third-party guarantor may be required depending on lender policy.\n\n` +
          `#### 4. Submit Your Application\n` +
          `You can apply online via the government **Vidya Lakshmi Portal** (vidyalakshmi.co.in) or directly through partner banks offering specialized student loans (e.g., SBI, HDFC Credila, ICICI Bank, Axis Bank, Bank of Baroda).\n\n` +
          `#### 5. Verification & Sanction\n` +
          `The lender assesses course credibility, employability, and co-applicant repayment capacity. Once approved, the bank issues an official loan sanction letter.\n\n` +
          `#### 6. Fee Disbursement & Moratorium Period\n` +
          `Tuition fees are disbursed directly to the college/university per semester. Repayment begins after the **moratorium period** (course duration + 6 to 12 months grace period).\n\n` +
          `*(Feel free to ask if you have questions about specific banks, interest rates, or documentation!)*`
        );
      }

      if (type === "Home Loan") {
        return (
          `### 🏠 Home Loan Application Process (Step-by-Step)\n\n` +
          `Here is how the **home loan** process works across leading lenders:\n\n` +
          `#### 1. Eligibility & Budget Check\n` +
          `Determine your borrowing capacity based on monthly income, existing EMIs, and CIBIL score (750+ offers best interest rates).\n\n` +
          `#### 2. Property Selection & Agreement\n` +
          `Finalize the property and obtain seller/builder documents (Allotment Letter, Sale Agreement, Title Deeds, Approved Building Plan).\n\n` +
          `#### 3. Document Submission\n` +
          `• **Applicant**: PAN, Aadhaar, last 3 months' payslips, Form 16 / 2 years ITR, 6 months' bank statements.\n` +
          `• **Property**: Chain of title documents, NOC from builder/society, occupancy/completion certificate.\n\n` +
          `#### 4. Legal & Technical Valuation\n` +
          `The bank appoints legal experts and engineers to verify property clear titles, permissions, and fair market valuation.\n\n` +
          `#### 5. Sanction & Disbursal\n` +
          `The bank sanctions up to 75%–90% of property cost. You pay your down payment contribution, execute loan agreements, and the bank disburses funds directly to the seller/builder.\n\n` +
          `*(Partner lenders like HDFC Bank, ICICI Bank, Axis Bank, and SBI offer competitive home loans starting ~8.40%–8.75% p.a.)*`
        );
      }

      if (type === "Business Loan") {
        return (
          `### 💼 Business Loan Application Process (Step-by-Step)\n\n` +
          `Here is the step-by-step process for unsecured or secured **business loans**:\n\n` +
          `#### 1. Assess Capital Requirement\n` +
          `Identify whether you need working capital, machinery/equipment finance, or expansion capital.\n\n` +
          `#### 2. Check Basic Eligibility Criteria\n` +
          `• Business vintage: Minimum 2 to 3 years of active operations.\n` +
          `• Annual turnover: Minimum ₹20 Lakhs to ₹40 Lakhs (varies by lender).\n` +
          `• Promoter CIBIL: 700+ preferred.\n\n` +
          `#### 3. Prepare Financial Documents\n` +
          `• GST returns (last 12 months).\n` +
          `• Audited Financials & ITR with computation (last 2 years).\n` +
          `• Business Current Account bank statements (last 6 to 12 months).\n` +
          `• Business registration proof (Udyam, GST, Shop Act, PAN of firm/company).\n\n` +
          `#### 4. Application & Sanction\n` +
          `Apply with partner NBFCs or banks (Bajaj Finserv, Tata Capital, L&T Finance, ICICI Bank). Loans are typically sanctioned in 48 to 72 hours.\n\n` +
          `*(Feel free to ask for specific lender criteria or documentation requirements!)*`
        );
      }

      if (type === "Credit Card") {
        return (
          `### 💳 Credit Card Application Process\n\n` +
          `Applying for a **credit card** through partner banks:\n\n` +
          `#### 1. Choose the Card Category\n` +
          `Select a card that matches your lifestyle: Cashback, Travel/Air Miles, Fuel, Rewards, or Lifetime Free.\n\n` +
          `#### 2. Check Cutoffs & Criteria\n` +
          `• Minimum Age: 21 years.\n` +
          `• Minimum Monthly Income: ₹25,000+ for entry cards, ₹50,000+ for premium cards.\n` +
          `• CIBIL Score: 730+ for pre-approved or instant approvals.\n\n` +
          `#### 3. Submit KYC & Video Verification\n` +
          `Provide PAN, Aadhaar, and complete instant Video KYC (V-KYC).\n\n` +
          `#### 4. Instant Virtual Card & Physical Delivery\n` +
          `Virtual credit card is generated for online shopping immediately; physical card is delivered within 3 to 5 business days.`
        );
      }

      return (
        `### 🏠 ${type} Assistance at CreditWise\n\n` +
        `CreditWise specializes primarily in **unsecured personal loans** across our 23+ partner lenders. However, several of our top partner banks (including **HDFC Bank, ICICI Bank, State Bank of India, Axis Bank, and Kotak Mahindra Bank**) offer excellent ${type.toLowerCase()} options with competitive interest rates.\n\n` +
        `#### How We Can Help:\n` +
        `• If you need an **unsecured personal loan** (for down payment assistance, home renovation, or initial expenses), I can evaluate your eligibility across all partner banks immediately.\n` +
        `• We can connect you with official branch managers at our partner banks who oversee retail loans in your city.\n\n` +
        `Would you like to check your **personal loan eligibility**, or connect with a partner bank branch manager in your city?`
      );
    }

    case "OFFERS":
      return (
        `### 🎁 Partner Bank Personal Loan Offers & Highlights\n\n` +
        `We partner with **23+ leading banks and NBFCs** to bring you prime corporate and pre-approved personal loan offers:\n\n` +
        `| Lender Tier | Benchmark Interest Rates | Processing Fee Offers | Key Feature |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **Top Private Banks** (HDFC, ICICI, Axis, Kotak) | **10.25% – 12.50% p.a.** | Flat ₹999 to 0.50% (special corporate waivers) | Instant disbursal for listed company employees |\n` +
        `| **Leading NBFCs** (Tata Capital, Bajaj Finserv, SMFG) | **11.00% – 14.50% p.a.** | 1.00% – 2.00% | Flexible tenure up to 72–84 months, fast approval |\n` +
        `| **Digital & Fintech Lenders** (Fibe, Finnable) | **12.50% – 16.00% p.a.** | Minimal documentation | Instant digital sanction within 24 hours |\n\n` +
        `> **Note:** Special rate discounts and zero-processing-fee benefits depend on your **employer category** (Super CAT A / CAT A) and **CIBIL credit score (750+)**.\n\n` +
        `Would you like to check which specific partner bank offers and category limits apply to you?`
      );

    case "BANK_PROCESSING": {
      const bank = match.targetBank || "Partner Bank";
      const hasAskedBankBefore = (options?.history || []).some(
        (m) =>
          (m.role === "assistant" || m.role === "ai") &&
          m.content.includes(`${bank} Loan Processing via CreditWise`)
      );

      if (hasAskedBankBefore) {
        return (
          `### 🏦 ${bank} Loan Facilitation\n\n` +
          `**Yes, we can definitely process and facilitate your personal loan with ${bank}!**\n\n` +
          `To check your specific eligibility and begin your application, could you please share:\n` +
          `• **Employer / Company Name** (e.g., TCS, Infosys, Wipro, or any other employer)\n` +
          `• **Net Monthly Salary** (e.g., ₹50,000)\n` +
          `• **Desired Loan Amount** (e.g., ₹5 Lakhs)\n` +
          `• **Approximate CIBIL Score** (e.g., 750, or type *'not sure'*)\n\n` +
          `Once you share these details, I will verify ${bank}'s exact policy criteria, calculate your eligible category limits, and connect you with authorized bank managers.`
        );
      }

      return (
        `### 🏦 ${bank} Loan Processing via CreditWise\n\n` +
        `**Yes, absolutely!** ${bank} is one of our verified partner lenders.\n\n` +
        `#### How CreditWise Facilitates Your ${bank} Loan:\n` +
        `1. **Deterministic Policy Check**: We verify your eligibility against ${bank}'s exact master policy (minimum salary, employer category, and CIBIL cutoffs).\n` +
        `2. **Document Checklist**: We guide you through the required KYC, salary slips, and bank statement verification.\n` +
        `3. **Direct Branch Manager Connect**: Once your preliminary eligibility is confirmed, we connect you directly with official ${bank} branch managers and retail loan liaisons in your city for expedited processing and disbursal.\n\n` +
        `Would you like to check your loan eligibility for **${bank}**, view its policy guidelines, or connect with a branch manager in your city?`
      );
    }

    case "APPLICATION_STEPS":
      return (
        `### 📋 Steps to Apply for a Personal Loan\n\n` +
        `Applying for a personal loan through CreditWise is straightforward and fully transparent:\n\n` +
        `#### 1. Instant Eligibility Evaluation\n` +
        `Share basic details: employer/company name, net monthly salary, existing EMIs, and approximate CIBIL score. We evaluate your profile deterministically across **23+ partner banks**.\n\n` +
        `#### 2. Lender & Offer Comparison\n` +
        `Compare eligible banks side-by-side on interest rates (ROI), maximum sanctioned loan amount, repayment tenure (12 to 84 months), and estimated monthly EMIs.\n\n` +
        `#### 3. Document Preparation\n` +
        `Gather basic KYC and income documents:\n` +
        `• **Identity & Address Proof**: PAN card, Aadhaar card, or Passport.\n` +
        `• **Income Proof**: Last 3 months' salary slips and latest Form 16.\n` +
        `• **Banking**: Latest 3 to 6 months' bank statements showing regular salary credit.\n\n` +
        `#### 4. Application Submission & Verification\n` +
        `Submit your application. The partner lender performs digital KYC, bureau verification, and employment verification.\n\n` +
        `#### 5. Manager Assistance & Sanction\n` +
        `We connect you with authorized bank managers in your city to assist with any exceptions and ensure smooth sanction. Once approved, the loan amount is disbursed directly into your bank account.\n\n` +
        `Would you like to start by **checking your eligibility across our partner lenders**?`
      );

    case "CONTEXTUAL_ISSUE": {
      const lastAssistantMsg = (options?.history || [])
        .filter((m) => m.role === "assistant" || m.role === "ai")
        .slice(-1)[0]?.content || "";

      let contextHint = "";
      if (lastAssistantMsg.includes("employer") || lastAssistantMsg.includes("company")) {
        contextHint = " In our previous turn, I inquired about your employer or company name because partner banks categorize companies into risk tiers (Super CAT A, CAT A, CAT B, etc.) to determine your eligible loan amount and interest rates.";
      } else if (lastAssistantMsg.includes("salary") || lastAssistantMsg.includes("income")) {
        contextHint = " In our previous turn, I asked for your monthly take-home salary so we can calculate your debt-to-income ratio (FOIR) and determine your borrowing limit.";
      } else if (lastAssistantMsg.includes("CIBIL") || lastAssistantMsg.includes("credit score")) {
        contextHint = " In our previous turn, I asked about your CIBIL score to check which partner bank cutoff guidelines you satisfy.";
      }

      return (
        `### 💬 Context & Assistance\n\n` +
        `There is no issue with your application or profile!${contextHint}\n\n` +
        `CreditWise is designed to help you compare personal loans, review bank policies, calculate EMIs, or connect with branch managers.\n\n` +
        `Please let me know what you would like to explore or if you have any questions!`
      );
    }

    default:
      return "I am here to help you with personal loan eligibility, bank policies, EMI calculations, and branch manager contacts. How can I assist you today?";
  }
}

export function buildContextualEligibilityResumptionBridge(
  applicant: any,
  nextField: string
): string {
  const parts: string[] = [];
  const emp =
    applicant?.companyName ||
    applicant?.employer ||
    applicant?.Employer_Name ||
    applicant?.employerConfirmationQuery ||
    applicant?.selectedCompanyName;
  if (emp) parts.push(`employer as **${emp}**`);
  if (applicant?.monthlyIncome) parts.push(`monthly salary as **₹${Number(applicant.monthlyIncome).toLocaleString("en-IN")}**`);
  if (applicant?.loanAmount) parts.push(`desired loan as **₹${Number(applicant.loanAmount).toLocaleString("en-IN")}**`);
  if (applicant?.existingEmi !== undefined) parts.push(`existing EMI as **₹${Number(applicant.existingEmi).toLocaleString("en-IN")}**`);
  if (applicant?.cibil !== undefined) parts.push(`CIBIL score as **${applicant.cibil}**`);
  if (applicant?.age) parts.push(`age as **${applicant.age}**`);

  const summary = parts.length > 0 ? ` I have your ${parts.join(" and ")} recorded.` : "";

  let prompt = "";
  switch (nextField) {
    case "company":
    case "companyName":
      if (emp) {
        prompt = "What is your **net monthly take-home salary** (e.g., ₹75,000)?";
      } else {
        prompt = "Could you please share the name of your **current employer or company** (e.g., TCS, Infosys, Wipro, or any other employer)?";
      }
      break;
    case "monthlyIncome":
      prompt = "What is your **net monthly take-home salary** (e.g., ₹75,000)?";
      break;
    case "existingEmi":
      prompt = "What is your approximate total **monthly EMI for any existing loans or credit cards** (or enter **0** if none)?";
      break;
    case "cibil":
    case "cibilScore":
      prompt = "What is your approximate **CIBIL credit score** (e.g., 750, or type *'not sure'* if you haven't checked)?";
      break;
    case "age":
      prompt = "What is your **age** in years?";
      break;
    case "loanAmount":
      prompt = "What **loan amount** would you like to apply for (e.g., ₹5 Lakhs)?";
      break;
    default:
      prompt = "Could you please share your **" + nextField + "**?";
      break;
  }

  return `\n\n---\n**Coming back to your loan eligibility check:**${summary}\n${prompt}`;
}
