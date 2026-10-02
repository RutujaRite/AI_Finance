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

  // 3. Guard against bank-specific policy queries that mention specific partner banks
  const bankMatch = /(?:axis\s*finance|axis\s*bank|\baxis\b|bajaj\s*markets?|bajaj\s*finserv|\bbajaj\b|tata\s*capital|hdfc|icici|sbi|kotak|idfc|indusind|bandhan|yes\s*bank|piramal|poonawalla|poonawala|chola|smfg|finnable|fibe|sbm|utkarsh|aditya|abfl|birla|l&t|ltf|lt\s*finance)/i.test(text);
  const isPolicyExplicit = /\b(?:policy|guidelines?|master\s*policy|rulebook)\b/i.test(text);
  if (bankMatch && isPolicyExplicit) {
    return false;
  }

  // 4. Core Informational / Educational Financial Topics
  const hasQuestionFraming =
    /^(?:what\s*(?:is|are|does|do|mean)|how\s*(?:is|does|do|can|to)|why\s*(?:is|are|do|does)|explain|can\s*you\s*explain|tell\s*me\s*(?:about|how)|meaning\s*of|definition\s*of|difference\s*between|is\s*(?:there|it|a)|does\s*(?:a|it)|who\s*(?:pays|charges))\b/i.test(text) ||
    /\b(?:what\s*(?:is|are|does|do)|how\s*(?:is|does|do|can)|explain|can\s*you\s*explain|tell\s*me\s*about|meaning\s*of|definition\s*of)\b/i.test(text) ||
    /\?$/.test(text);

  const hasFinancialTopic =
    /\b(?:processing\s*fees?|proc(?:essing)?\s*fee|\bpf\b|admin\s*fee|file\s*charge)/i.test(text) ||
    /\b(?:how\s*(?:is\s*)?interest\s*calculated|interest\s*calculat\w*|reducing\s*(?:balance|rate)|diminishing\s*(?:balance|rate)|flat\s*(?:rate|interest)|flat\s*vs\s*reducing|interest\s*formula)\b/i.test(text) ||
    /\b(?:foir|fixed\s*obligation|debt\s*to\s*income|\bdti\b|obligation\s*ratio)\b/i.test(text) ||
    /\b(?:what\s*is\s*(?:a\s*)?cibil|cibil\s*score|credit\s*score|bureau\s*score|experian|cibil\s*range|good\s*cibil)\b/i.test(text) ||
    /\b(?:foreclosure|pre-?closure|pre-?payment|part-?payment|prepaying|lock-?in\s*period|prepayment\s*penalty|foreclosure\s*charges?)\b/i.test(text) ||
    /\b(?:amortiz\w*|amortisation\s*schedule|what\s*is\s*(?:an?\s*)?emi|how\s*(?:does\s*)?emi\s*work|equated\s*monthly\s*installment)\b/i.test(text) ||
    /\b(?:apr\b|annual\s*percentage\s*rate|effective\s*interest\s*rate|true\s*cost\s*of\s*borrowing)\b/i.test(text) ||
    /\b(?:unsecured\s*loan|secured\s*vs\s*unsecured|collateral|why.*collateral)\b/i.test(text) ||
    /\b(?:balance\s*transfer|credit\s*card\s*bt|loan\s*bt|top-?up\s*loan)\b/i.test(text) ||
    /\b(?:bounce\s*charges?|late\s*payment\s*fee|penal\s*interest)\b/i.test(text) ||
    /\b(?:net\s*take\s*home|\bnth\b|gross\s*vs\s*net\s*salary)\b/i.test(text);

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
};

/**
 * Matches the query to a built-in topic or falls back to LLM / rule-based generation.
 */
export async function answerGeneralFinancialQuery(
  userQuery: string,
  modelOverride?: string
): Promise<string> {
  const norm = userQuery.toLowerCase().trim();

  // 1. Direct Knowledge Base Match
  if (/\b(?:processing\s*fees?|proc(?:essing)?\s*fee|\bpf\b|admin\s*fee|file\s*charge)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.PROCESSING_FEE;
  }

  if (/\b(?:interest\s*calculat\w*|how\s*(?:is\s*)?interest\s*calculated|reducing\s*(?:balance|rate)|diminishing\s*(?:balance|rate)|flat\s*(?:rate|interest)|flat\s*vs\s*reducing|interest\s*formula)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.INTEREST_CALCULATION;
  }

  if (/\b(?:foir|fixed\s*obligation|debt\s*to\s*income|\bdti\b|obligation\s*ratio)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.FOIR_EXPLANATION;
  }

  if (/\b(?:cibil|credit\s*score|bureau\s*score|experian)\b/i.test(norm)) {
    return FINANCIAL_KNOWLEDGE_BASE.CIBIL_SCORE;
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
          max_tokens: 800,
          temperature: 0.1,
          messages: [
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
          ],
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
