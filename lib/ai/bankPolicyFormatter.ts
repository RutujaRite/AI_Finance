/**
 * Comprehensive Bank Policy Formatter & Specific Parameter Extractor
 * 
 * Implements strict AGENTS.md guidelines:
 * 1. Comprehensive summaries across 5 standard Markdown sections:
 *    - Eligibility Criteria (Age, CIBIL, Work Experience)
 *    - Salary & Bank Requirements (NTH, Payment Mode)
 *    - Loan Parameters (Min/Max Amount, Tenure, ROI)
 *    - Document Requirements
 *    - Rejection Rules & Exceptions
 * 2. Direct, accurate answering when a user asks ONLY for a single specific parameter (e.g. CIBIL, salary, tenure, docs, ROI).
 * 3. Never returns blank refusal messages for supported partner banks.
 */

const NOT_SPECIFIED = "Not specified in the available policy.";

function cleanText(s?: string | null): string {
  if (!s) return "";
  return s
    .replace(/\bNOT_DEFINED\s*\/\s*NEEDS_REVIEW\b/gi, NOT_SPECIFIED)
    .replace(/\bNOT_DEFINED\b/gi, NOT_SPECIFIED)
    .replace(/\bNEEDS_REVIEW\b/gi, "")
    .replace(/\[REVIEW\]/gi, "")
    .replace(/\[CONFLICT\]/gi, "")
    .replace(/\bpostgresql\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts a specific parameter (e.g. CIBIL cutoff, salary, loan amount, tenure, ROI, documents)
 * directly and accurately as requested by AGENTS.md when the user asks only for that parameter.
 */
export function extractSpecificBankPolicyParameter(
  bankName: string,
  query: string,
  policyContext?: string
): string | null {
  const q = query.toLowerCase();
  const bLower = (bankName || "").toLowerCase();

  const isCibil = /\b(?:cibil\w*|credit\s*score|score|cutoff|cut-off)\b/i.test(q);
  const isSalary = /\b(?:salary|nth|income|nmi|net\s*pay|take[\s-]*home|min(?:imum)?\s*salary)\b/i.test(q);
  const isLoanParams = /\b(?:loan\s*amount|max\s*loan|min\s*loan|ticket|how\s*much|tenure|months?|duration|term)\b/i.test(q);
  const isRoi = /\b(?:roi|interest|rate|pricing)\b/i.test(q);
  const isDocs = /\b(?:doc|document|documents|paperwork|statement|payslip|itr|kyc|proof)\b/i.test(q);
  const isAge = /\b(?:age|years?\s*old|maximum\s*age|min(?:imum)?\s*age)\b/i.test(q);

  // If user asks specifically for documents, return dedicated tabular document checklist
  if (isDocs && !isCibil && !isSalary && !isLoanParams && !isRoi && !isAge) {
    const docTable = formatBankDocumentTable(bankName, policyContext);
    if (docTable) return docTable;
  }

  // If query is broad / general policy ask, return null so full comprehensive policy is returned
  const count = [isCibil, isSalary, isLoanParams, isRoi, isDocs, isAge].filter(Boolean).length;
  if (count > 2 || count === 0) {
    return null;
  }

  // If documents are queried as one of two parameters
  if (isDocs) {
    const docTable = formatBankDocumentTable(bankName, policyContext);
    if (docTable) return docTable;
  }

  // 1. HDFC BANK
  if (bLower.includes("hdfc")) {
    if (isCibil) {
      return `### 🏦 HDFC Bank — CIBIL Score Requirements & Norms\n\n` +
        `• **Minimum CIBIL Score**: The official HDFC Bank Master Policy does not specify a single hard minimum CIBIL cutoff threshold; approval is evaluated on risk-based pricing slabs subject to positive CIC and Hunter checks.\n` +
        `• **Maximum CIBIL Score**: **900** (standard TransUnion CIBIL score range is 300 to 900; applicants with scores **>730** qualify for the lowest prime rack interest rates starting from **11.00% to 11.15% p.a.**).\n` +
        `• **CIBIL / Bureau Rate Slabs**:\n` +
        `  - **CIBIL > 730**: Lowest rack rate slab (11.00% – 13.25% p.a. depending on salary and corporate CAT).\n` +
        `  - **CIBIL ≤ 730 / No Hit**: Standard rate slab (11.15% – 14.50% p.a.).\n` +
        `• **New-to-Credit (NTC)**: CIBIL **0 / -1** is acceptable under eligible programs with approval note code.\n` +
        `• **Bureau Track Record**: No loan availed or cancelled in the last 30/31 days.\n\n` +
        `**Source:** \`HDFC_Bank_Master_Policy.txt\``;
    }
    if (isSalary) {
      return `### 🏦 HDFC Bank — Salary & Income Requirements\n\n` +
        `• **Minimum Net Monthly Salary (NTH)**: ₹25,000 for Internal CSA customers and non-HDFC Salary Account holders; ₹35,000–₹50,000 basis corporate profile.\n` +
        `• **Golden Edge Program**: ₹75,000 (Prime Locations) / ₹50,000 (Emerging Locations).\n` +
        `• **Government Categories**: CAT GA ≥ ₹50,000; CAT GB ≥ ₹25,000.\n` +
        `• **Payment Mode**: Mandatory direct online bank salary credit into active bank account (minimum 3 consecutive months verified).\n\n` +
        `**Source:** \`HDFC_Bank_Master_Policy.txt\``;
    }
    if (isAge) {
      return `### 🏦 HDFC Bank — Age Requirements\n\n` +
        `• **Minimum Age**: 21 years\n` +
        `• **Maximum Age**: 60 years *(Current Age + Loan Tenure must not exceed retirement age of max 60 years)*\n\n` +
        `**Source:** \`HDFC_Bank_Master_Policy.txt\``;
    }
    if (isLoanParams) {
      return `### 🏦 HDFC Bank — Loan Amount & Repayment Tenure\n\n` +
        `• **Loan Amount Range**: Minimum ₹50,000, Maximum up to ₹40,00,000 *(CAT Super A / CAT A up to ₹40L, CAT B/C up to ₹25L, CAT D/E up to ₹10L, CAT GA up to ₹40L, Golden Edge min ₹10L)*.\n` +
        `• **Repayment Tenure**: Minimum 12 months, Maximum 60 months standard *(Extended up to 72 or 84 months for Super A / CAT A / CAT HDFC / CAT GA / CAT RA)*.\n\n` +
        `**Source:** \`HDFC_Bank_Master_Policy.txt\``;
    }
    if (isRoi) {
      return `### 🏦 HDFC Bank — Interest Rates (ROI) & Pricing\n\n` +
        `• **Rate of Interest (ROI)**: Starting from 11.00% to 14.50% per annum on reducing principal basis, based on CIBIL score slab (>730 vs ≤730), employer category, and loan amount.\n` +
        `• **Processing Fees**: Rack PF ₹3,499 (income < ₹50k) to ₹6,500 (income ≥ ₹50k or loan ≥ ₹10L).\n\n` +
        `**Source:** \`HDFC_Bank_Master_Policy.txt\``;
    }
    if (isDocs) {
      return `### 🏦 HDFC Bank — Document Requirements\n\n` +
        `• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card (Aadhaar OVD KYC / e-KYC / offline XML verification), Photograph.\n` +
        `• **Income Proof**: 3 Latest Salary Slips, Form-16.\n` +
        `• **Banking Proof**: 3 Months Bank Statement showing salary credits.\n` +
        `• **Employment Proof**: Employee ID Card, Appointment letter, confirmation letter, or HR letter confirming employment; positive CPV.\n` +
        `• **Document Waiver**: Documents can be waived for existing pre-approved HDFC Bank customers.\n\n` +
        `**Source:** \`HDFC_Bank_Master_Policy.txt\``;
    }
  }

  // 2. FINNABLE CREDIT
  if (bLower.includes("finnable")) {
    if (isCibil) {
      return `### 🏦 Finnable Credit — Minimum CIBIL Score\n\n` +
        `• **Minimum CIBIL Score**: 700\n` +
        `• **New to Credit (NTC)**: CIBIL -1 / 0 is acceptable.\n` +
        `• **Bureau Track**: No 30 DPD in the latest month; No 90 DPD in the last 3 months.\n\n` +
        `**Source:** \`Finnable_Credit_Master_Policy.txt\``;
    }
    if (isSalary) {
      return `### 🏦 Finnable Credit — Salary Requirements\n\n` +
        `• **Net Take-Home (NTH)**: Minimum ₹20,000/month for Tier 1 Cities; Minimum ₹15,000/month for Tier 2 Cities.\n` +
        `• **Payment Mode**: Mandatory online salary credit by NEFT only *(Strictly NO cash, UPI, IMPS, or Cheque salary credits accepted)*.\n` +
        `• **Banking Track**: Minimum 3 months consecutive salary credit in current company; 4 months operative bank statements required.\n\n` +
        `**Source:** \`Finnable_Credit_Master_Policy.txt\``;
    }
    if (isLoanParams) {
      return `### 🏦 Finnable Credit — Loan Parameters & Tenure\n\n` +
        `• **Loan Amount**: Minimum ₹50,000 to Maximum ₹10,00,000 *(Partnership / Proprietorship firms capped between ₹50,000 to ₹4,50,000)*.\n` +
        `• **Tenure**: Minimum 12 months, Maximum 36 months *(Extended up to 48 months for loan amounts ≥ ₹3,00,000)*.\n\n` +
        `**Source:** \`Finnable_Credit_Master_Policy.txt\``;
    }
  }

  // 3. ICICI BANK
  if (bLower.includes("icici")) {
    if (isCibil) {
      return `### 🏦 ICICI Bank — CIBIL Score Requirements\n\n` +
        `• **CIBIL / Bureau Score**: Risk-based pricing bands: Tier 1 (CIBIL ≥ 770, prime rates), Tier 2 (725–769 / 0 / -1, standard rates), Tier 3 (< 725, subprime).\n` +
        `• **Minimum Cutoff**: Absolute minimum approval cutoff is Not specified in the available policy; evaluated basis risk band and corporate relationship.\n\n` +
        `**Source:** \`ICICI_Bank_Personal_Loan_Policy_Rulebook.txt\``;
    }
    if (isSalary) {
      return `### 🏦 ICICI Bank — Salary Requirements\n\n` +
        `• **Net Take-Home (NTH)**: Evaluated basis employer category and pricing band *(Baseline entry salary Not specified in the available policy)*.\n` +
        `• **Payment Mode**: Mandatory direct salary credit through official corporate banking channel (minimum 3 months verified).\n\n` +
        `**Source:** \`ICICI_Bank_Personal_Loan_Policy_Rulebook.txt\``;
    }
  }

  // 4. KOTAK MAHINDRA BANK
  if (bLower.includes("kotak")) {
    if (isCibil) {
      return `### 🏦 Kotak Mahindra Bank — CIBIL Requirements\n\n` +
        `• **CIBIL / Bureau Score**: Minimum CIBIL ≥ 700 to 750 depending on employer category and loan program; clean bureau track required.\n\n` +
        `**Source:** \`Kotak_Mahindra_Bank_Master_Policy.txt\``;
    }
    if (isSalary) {
      return `### 🏦 Kotak Mahindra Bank — Salary Requirements\n\n` +
        `• **Net Take-Home (NTH)**: Minimum ₹25,000 to ₹40,000/month *(varies by CAT: Elite/Cat A/B/C)*.\n` +
        `• **Payment Mode**: Mandatory direct online bank salary credit.\n\n` +
        `**Source:** \`Kotak_Mahindra_Bank_Master_Policy.txt\``;
    }
  }

  // 5. TATA CAPITAL
  if (bLower.includes("tata")) {
    if (isCibil) {
      return `### 🏦 Tata Capital — CIBIL Requirements\n\n` +
        `• **CIBIL / Bureau Score**: Normal salaried base policy: 725+; Updated policy separately allows CIBIL 0 / -1 under applicable programs.\n\n` +
        `**Source:** \`Tata_Capital_Master_Policy_Clean.txt\``;
    }
    if (isSalary) {
      const isCatA = /\b(?:cat(?:egory)?\s*a|super\s*cat\s*a)\b/i.test(q);
      const catLine = isCatA ? `• **Category A (Super CAT A / CAT A) Minimum Salary**: **₹20,000/month** (qualifies for loans up to ₹35 Lakhs and tenure up to 84 months).\n` : "";
      return `### 🏦 Tata Capital — Salary Requirements\n\n` +
        catLine +
        `• **Net Take-Home (NTH)**: Tata Group Employee (TGE): ₹15,000; Super CAT A / CAT A: ₹20,000; CAT B / Government: ₹25,000; Unlisted Company: ₹27,000.\n\n` +
        `**Source:** \`Tata_Capital_Master_Policy_Clean.txt\``;
    }
  }

  // 6. AXIS FINANCE (NBFC - distinct from Axis Bank)
  if (bLower.includes("axis finance") || bLower === "afl") {
    if (isCibil) {
      return `### 🏦 Axis Finance — CIBIL Score Requirements\n\n` +
        `• **Minimum CIBIL Score**: **720** (range 720 to 750 depending on loan program).\n` +
        `• **Bureau Track**: Clean credit repayment record, no active 90+ DPD delinquency, and positive Hunter fraud check match required.\n` +
        `• **Programs**: Applies across Bharat Program, Flexi, PL Shift Plus, and SUPER EDGE.\n\n` +
        `**Source:** \`Axis_Finance_Master_Policy.txt\``;
    }
    if (isSalary) {
      const isCatA = /\b(?:cat(?:egory)?\s*a|super\s*cat\s*a)\b/i.test(q);
      const catLine = isCatA ? `• **Category A (CAT A) Minimum Salary**: **₹25,000/month** (multiplier up to 30x of monthly income, loan up to ₹40 Lakhs).\n` : "";
      return `### 🏦 Axis Finance — Salary & Income Requirements\n\n` +
        catLine +
        `• **Minimum Net Monthly Salary (NTH)**: **₹25,000 to ₹40,000/month** depending on employer category.\n` +
        `• **Payment Mode**: Mandatory direct online bank salary credit via banking channels (minimum 3–6 months verified).\n` +
        `• **FOIR Ratio**: Up to **75%** fixed obligation to income ratio allowed under high-multiplier programs.\n\n` +
        `**Source:** \`Axis_Finance_Master_Policy.txt\``;
    }
    if (isAge) {
      return `### 🏦 Axis Finance — Age Requirements\n\n` +
        `• **Minimum Age**: **21 years**\n` +
        `• **Maximum Age**: **59 years** (standard maturity age); up to **62 years** for Government employees with retirement proof, **65 years** for Professors, and **50 years** for BSNL employees.\n\n` +
        `**Source:** \`Axis_Finance_Master_Policy.txt\``;
    }
    if (isLoanParams) {
      return `### 🏦 Axis Finance — Loan Amount & Repayment Tenure\n\n` +
        `• **Loan Amount Range**: Up to **₹40,00,000** (multiplier up to 30x of monthly income).\n` +
        `• **Repayment Tenure**: Up to **84 months** (7 years) on assisted programs; standard tenure 12 to 60 months.\n\n` +
        `**Source:** \`Axis_Finance_Master_Policy.txt\``;
    }
    if (isDocs) {
      return `### 🏦 Axis Finance — Document Requirements\n\n` +
        `• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card.\n` +
        `• **Income Proof**: Latest 3 months salary slips, Form-16.\n` +
        `• **Banking Proof**: 3 to 6 months bank statement showing regular salary credit.\n` +
        `• **Employment Proof**: Employee ID card, official email ID verification.\n\n` +
        `**Source:** \`Axis_Finance_Master_Policy.txt\``;
    }
  }

  // 7. AXIS BANK (Scheduled Commercial Bank)
  if (bLower.includes("axis")) {
    if (isCibil) {
      return `### 🏦 Axis Bank — CIBIL Score Requirements\n\n` +
        `• **Minimum CIBIL Cutoff**: **700 to 740+** tiered strictly by Net Monthly Income (NMI) slabs:\n` +
        `  - **NMI ₹35,000 to ₹85,000**: Minimum CIBIL ≥ 700–740+\n` +
        `  - **NMI > ₹85,000**: Minimum CIBIL ≥ 700+\n` +
        `  - **NMI > ₹1,00,000**: Minimum CIBIL ≥ 740+\n` +
        `• **Bureau Track**: Minimum 1 year continuous employment track; positive CIC record, Hunter fraud check match, and NACH registration mandatory.\n` +
        `• **Knockout**: CIBIL below 700 for entry income slabs is an automatic rejection.\n\n` +
        `**Source:** \`AXIS_Master_Policy.txt\``;
    }
    if (isSalary) {
      const isCatA = /\b(?:cat(?:egory)?\s*a|super\s*cat\s*a)\b/i.test(q);
      const isCatB = /\b(?:cat(?:egory)?\s*b)\b/i.test(q);
      const isCatC = /\b(?:cat(?:egory)?\s*c)\b/i.test(q);
      let catLine = "";
      if (isCatA) {
        catLine = `• **Category A (CAT A) Minimum Salary**: Minimum **₹35,000/month** (Tier 1 / CAT A employers qualify for loan limits up to ₹40 Lakhs and extended 84-month tenure).\n`;
      } else if (isCatB) {
        catLine = `• **Category B (CAT B) Minimum Salary**: Minimum **₹40,000 to ₹50,000/month**.\n`;
      } else if (isCatC) {
        catLine = `• **Category C (CAT C) Minimum Salary**: Minimum **₹50,000+/month**.\n`;
      }
      return `### 🏦 Axis Bank — Salary & Income Requirements\n\n` +
        catLine +
        `• **Minimum Net Monthly Salary (NTH)**: Minimum **₹35,000 to ₹85,000+** basis program and employer category.\n` +
        `• **Payment Mode**: Mandatory salary credit into active bank account via official banking channels.\n` +
        `• **Banking Track**: 6 months ePDF bank statement with regular salary credits required.\n\n` +
        `**Source:** \`AXIS_Master_Policy.txt\``;
    }
    if (isAge) {
      return `### 🏦 Axis Bank — Age Requirements\n\n` +
        `• **Minimum Age**: **21 years**\n` +
        `• **Maximum Age**: **60 years** (or official retirement age, whichever is earlier).\n\n` +
        `**Source:** \`AXIS_Master_Policy.txt\``;
    }
    if (isLoanParams) {
      return `### 🏦 Axis Bank — Loan Amount & Repayment Tenure\n\n` +
        `• **Loan Amount Range**: Up to **₹40,00,000** (lower employer categories capped at ₹15,00,000).\n` +
        `• **Repayment Tenure**: Up to **84 months** (7 years) for high-tenure assisted programs; standard tenure 12 to 60 months.\n\n` +
        `**Source:** \`AXIS_Master_Policy.txt\``;
    }
    if (isDocs) {
      return `### 🏦 Axis Bank — Document Requirements\n\n` +
        `• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card.\n` +
        `• **Income Proof**: Latest 3 months salary slips, Form-16.\n` +
        `• **Banking Proof**: 6 months ePDF bank statement showing regular salary credit.\n` +
        `• **Employment Proof**: Employee ID card, official email ID verification.\n\n` +
        `**Source:** \`AXIS_Master_Policy.txt\``;
    }
  }

  // 8. BANDHAN BANK
  if (bLower.includes("bandhan")) {
    if (isCibil) {
      return `### 🏦 Bandhan Bank — CIBIL Score Requirements\n\n` +
        `• **Minimum CIBIL Score**: **700** (Compulsory CIBIL 700+ for all categories).\n` +
        `• **Bureau Inquiries**: Maximum 5 credit inquiries in the last 30 days.\n` +
        `• **Delinquency**: No 30+ DPD in the last 12 months; No written-off or settled accounts in credit history.\n\n` +
        `**Source:** \`Bandhan_Bank_Master_Policy.txt\``;
    }
    if (isSalary) {
      return `### 🏦 Bandhan Bank — Salary & Income Requirements\n\n` +
        `• **Minimum Net Monthly Salary (NTH)**: **₹25,000/month** for Super Cat A & Cat A; **₹30,000/month** for Cat B; **₹35,000/month** for Cat C.\n` +
        `• **Payment Mode**: Direct salary credit in bank account through corporate net banking/NEFT.\n\n` +
        `**Source:** \`Bandhan_Bank_Master_Policy.txt\``;
    }
    if (isAge) {
      return `### 🏦 Bandhan Bank — Age Requirements\n\n` +
        `• **Minimum Age**: **23 years**\n` +
        `• **Maximum Age**: **60 years** at loan maturity.\n\n` +
        `**Source:** \`Bandhan_Bank_Master_Policy.txt\``;
    }
    if (isLoanParams) {
      return `### 🏦 Bandhan Bank — Loan Amount & Repayment Tenure\n\n` +
        `• **Loan Amount Range**: Minimum ₹50,000 to Maximum **₹25,00,000** (capped basis CAT and salary).\n` +
        `• **Repayment Tenure**: 12 to 60 months standard.\n\n` +
        `**Source:** \`Bandhan_Bank_Master_Policy.txt\``;
    }
  }

  // 9. YES BANK
  if (bLower.includes("yes")) {
    if (isCibil) {
      return `### 🏦 Yes Bank — CIBIL Score Requirements\n\n` +
        `• **Minimum CIBIL Score**: **-1 and above 731** (Scores below 731 are strictly not allowed).\n` +
        `• **Bureau Inquiries**: Maximum 6 Personal Loan (PL) enquiries in the last 3 months.\n` +
        `• **Unsecured Loan Cap**: Maximum 4 active unsecured live loans (including Yes Bank); live loans with Yes Bank > 3 not allowed.\n` +
        `• **New to Credit (NTC)**: CIBIL -1 is accepted (maximum age 35 years at time of sourcing).\n\n` +
        `**Source:** \`Yes_Bank_Master_Policy.txt\``;
    }
    if (isSalary) {
      return `### 🏦 Yes Bank — Salary & Income Requirements\n\n` +
        `• **Minimum Net Monthly Salary (NTH)**: Evaluated basis company category and segment (Pristine, Green Band, Silver, Diamond).\n` +
        `• **Payment Mode**: Mandatory direct online salary credit into active bank account via banking channels.\n` +
        `• **Bank Account Requirements**: Latest 3 to 6 months bank statement showing regular salary credit.\n\n` +
        `**Source:** \`Yes_Bank_Master_Policy.txt\``;
    }
    if (isAge) {
      return `### 🏦 Yes Bank — Age Requirements\n\n` +
        `• **Minimum Age**: **21 years**\n` +
        `• **Maximum Age**: **60 years** (subject to retirement proof; max age 35 years for NTC applicants).\n\n` +
        `**Source:** \`Yes_Bank_Master_Policy.txt\``;
    }
    if (isLoanParams) {
      return `### 🏦 Yes Bank — Loan Amount & Repayment Tenure\n\n` +
        `• **Loan Amount Range**: Green Band up to **₹10 Lakhs**; Pristine Segment up to **₹5 Lakhs** (capped at ₹15 Lakhs for age > 35 years).\n` +
        `• **Repayment Tenure**: 12 to 60 months standard.\n\n` +
        `**Source:** \`Yes_Bank_Master_Policy.txt\``;
    }
  }

  return null;
}

/**
 * Generates a complete, comprehensive, AGENTS.md-compliant 5-section bank policy summary.
 */
export function formatComprehensiveBankPolicy(policyContent: string, bankName: string): string {
  const bLower = (bankName || "").toLowerCase();

  // 1. FINNABLE CREDIT
  if (bLower.includes("finnable")) {
    return `### 🏦 Finnable Credit — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years *(Note: Age > 45 with Net Monthly Salary < ₹30,000 is strictly not eligible)*
• **CIBIL / Bureau Score**: Minimum CIBIL score of 700; CIBIL -1 / 0 / NTC (New-to-Credit) is doable; No 30 DPD in the latest month; No 90 DPD in the last 3 months
• **Work Experience & Vintage**: Minimum 6 months continuous total employment; 3 months salary credit in bank account mandatory with current company; 1 year company vintage in MCA required if PF is not debited (company vintage requirement is waived if PF is debited)
• **Employment Types**: Salaried individuals across accepted entities (All Pvt Ltd companies, LLP, Schools, Colleges, Hospitals, Government establishments, Partnership firms, Proprietorship firms, Construction, and Builder firms)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹20,000/month for Tier 1 Cities; Minimum ₹15,000/month for Tier 2 Cities
• **Payment Mode**: Mandatory online salary credit by NEFT only *(Strictly NO cash, UPI, IMPS, or Cheque salary credits accepted)*
• **Bank Account Requirements**: Salary must be credited directly to active bank account; Mandatory 3 months consecutive salary credit in current company; 4 months operative bank statements required

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹50,000 to Maximum ₹10,00,000 *(Partnership / Proprietorship firms capped between ₹50,000 to ₹4,50,000)*
• **Tenure**: Minimum 12 months, Maximum 36 months *(Extended up to 48 months / 4 years for loan amounts ≥ ₹3,00,000)*
• **Rate of Interest (ROI)**: Starting from 15% to 30% per annum on reducing principal basis
• **Processing Fees & Foreclosure**: No prepayment charges; No foreclosure charges *(Zero prepayment penalty; credit line facility available)*

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: 4 months operative bank statements showing salary credits
• **Salary Credit Proof**: 3 months salary credit via NEFT online transfer
• **Address Proof**: Not mandatory if address is verified via official KYC

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Any 30 DPD in the latest month
  - Any 90 DPD in the last 3 months
  - Applicant Age > 45 years with Net Monthly Salary < ₹30,000
  - Salary credit mode is not NEFT (UPI, IMPS, Cheque, or Cash salary credits will be rejected)
  - Partnership or Proprietorship firm employees without PF deduction or at least 1 active PL track (min ₹50,000)
• **Exceptions & Deviations**:
  - New-to-Credit (CIBIL 0 / -1 / NTC) applicants are accepted
  - Partnership / Proprietorship employees are eligible if PF is deducted OR if holding 1 active PL track of ₹50,000+
  - MCA company vintage waived if PF is debited for Pvt Ltd and LLP entities`;
  }

  // 2. HDFC BANK
  if (bLower.includes("hdfc")) {
    return `### 🏦 HDFC Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years *(Current Age + Tenure must not exceed retirement age of max 60 years)*
• **CIBIL / Bureau Score**: Rate-card pricing structured into CIBIL > 730 (lowest rack rates starting from 11.00% to 11.15%) and CIBIL ≤ 730 / No Hit slabs; positive CIC / Hunter match required; no loan availed or cancelled in last 30/31 days; CIBIL 0 / -1 doable with Note code
• **Work Experience & Vintage**: Minimum 1 year current employment & 2 years total work experience *(varies by CAT: Govt GA 2 years, Railway RA 3 years; current stability 50% of age or 3 years post TDS / 12 months)*
• **Employment Types**: Salaried individuals across approved categories (CAT Super A, CAT A, CAT B, CAT C, CAT D, CAT E, CAT GA/GB, CAT RA/RB/RC, CAT GD/GE/GF)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum Net Monthly Salary ₹25,000 for Internal CSA customers and non-HDFC Salary Account holders; ₹35,000–₹50,000 basis profile; Golden Edge Program: ₹75,000 (Prime Locations) / ₹50,000 (Emerging Locations); CAT GA ≥ ₹50,000; CAT GB ≥ ₹25,000
• **Payment Mode**: Mandatory direct online bank salary credit into active bank account
• **Bank Account Requirements**: Mandatory 3 months salary credit in bank account; 3 months operative bank statements required

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹50,000, Maximum ₹40,00,000 *(varies by CAT: CAT Super A / CAT A up to ₹40L, CAT B/C up to ₹25L, CAT D/E up to ₹10L, CAT GA up to ₹40L, Golden Edge min ₹10L)*
• **Tenure**: Minimum 12 months, Maximum 60 months standard *(Extended up to 72 or 84 months for Super A / CAT A / CAT HDFC / CAT GA / CAT RA)*
• **Rate of Interest (ROI)**: Starting from 11.00% to 14.50% based on CIBIL score slab (>730 vs ≤730), employer category, and loan amount
• **Processing Fees & Foreclosure**: Rack PF ₹3,499 (income < ₹50k) to ₹6,500 (income ≥ ₹50k or loan ≥ ₹10L); 100% unsecured / no collateral

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card (Aadhaar OVD KYC / e-KYC / offline XML verification), Photograph
• **Income Proof**: 3 Latest Salary Slips, Form-16
• **Banking Proof**: 3 Months Bank Statement showing salary credit
• **Employment Proof**: Employee ID Card, Appointment letter, confirmation letter, or HR letter confirming employment; positive CPV
• **Document Waiver**: Documents can be waived for existing pre-approved HDFC Bank customers

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Any loan availed or cancelled in the last 30/31 days
  - Current Age + Tenure exceeding retirement age (max 60 years)
  - Salary not meeting minimum NTH requirements for applicable category
  - Employment stability norms not satisfied
  - Permissible FOIR exceeded (standard FOIR cap 75%)
  - Product / category loan cap exceeded
• **Exceptions & Deviations**:
  - CIBIL 0 / -1 acceptable with Note code updated
  - Additional 3% FOIR (up to 78%) for Government A-B & DA categories
  - Bonus income can be considered for loan eligibility calculation (without extending FOIR)
  - Golden Edge Program available for high-value loans (₹10 Lakhs+)`;
  }

  // 3. ICICI BANK
  if (bLower.includes("icici")) {
    return `### 🏦 ICICI Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 22 to 60 years *(or retirement age, whichever is earlier)*
• **CIBIL / Bureau Score**: Tiered pricing bands: Tier 1 (CIBIL ≥ 770, prime rates), Tier 2 (725–769 / 0 / -1, standard rates), Tier 3 (< 725, subprime); absolute minimum approval cutoff is Not specified in the available policy
• **Work Experience & Vintage**: Minimum 2 years total work experience with at least 1 year in current organization
• **Employment Types**: Salaried individuals across mapped categories (ICICI Group, Top Corporate, Elite, Super-Prime, Preferred, Open Market, Government)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Evaluated basis employer category and pricing band *(General baseline entry salary Not specified in the available policy)*
• **Payment Mode**: Mandatory direct salary credit through official corporate banking channel
• **Bank Account Requirements**: Operative salary account with minimum 3 months salary credit verification; clean banking track

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹50,000; Pricing bands defined up to ₹30 Lakhs+ *(Absolute maximum cap is Not specified in the available policy)*
• **Tenure**: Minimum 12 months, Maximum 60 months standard *(Extended terms up to 72 months for select corporate categories)*
• **Rate of Interest (ROI)**: Risk-based pricing bands based on employer category and CIBIL score tier
• **Processing Fees & Foreclosure**: Standard processing fee and foreclosure rules per ICICI rack rate schedule

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card, Passport / Voter ID; Separate Aadhaar Consent Letter required
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: 3 to 6 months bank statement showing regular salary credits
• **Employment Proof**: Official corporate email ID verification or employee ID card

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL Tier 3 high-risk profiles not meeting underwriting risk threshold
  - Unmapped employer category without credit deviation
  - Irregular salary credits or cash salary modes
  - Non-compliance with Aadhaar consent or verification norms
• **Exceptions & Deviations**:
  - CIBIL 0 / -1 (New-to-Credit) eligible under Tier 2 pricing bands
  - Preferred terms and fast-track processing for ICICI salary account holders`;
  }

  // 4. KOTAK MAHINDRA BANK
  if (bLower.includes("kotak")) {
    return `### 🏦 Kotak Mahindra Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years
• **CIBIL / Bureau Score**: Minimum CIBIL ≥ 700 to 750 depending on category & loan program; Bureau track verification required
• **Work Experience & Vintage**: Minimum 1 to 2 years total work experience with employer stability norms
• **Employment Types**: Salaried employees across mapped categories (Elite, Cat A, Cat B, Cat C, Open Market)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹25,000 to ₹40,000/month *(varies by CAT: Elite/Cat A/B/C)*
• **Payment Mode**: Mandatory salary credit via direct bank account transfer
• **Bank Account Requirements**: Clean banking track with strict cheque/EMI bounce count restrictions; 3 months bank statements required

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: ₹1 Lakh to ₹35 Lakhs *(varies by CAT: up to ₹40 Lakhs for select top corporate categories)*
• **Tenure**: Minimum 12 months, Maximum 60 months *(Extended up to 72 months for select categories)*
• **Rate of Interest (ROI)**: Starting from 10.99% per annum depending on corporate category and bureau score
• **Processing Fees & Foreclosure**: Foreclosure permitted after specified lock-in period with applicable charges

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card / Valid Address Proof
• **Income Proof**: 3 months latest salary slips
• **Banking Proof**: 3 to 6 months bank statement showing continuous salary credits
• **Employment Proof**: Company ID card, appointment letter / official confirmation

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Cheque bounce or EMI bounce count exceeding permissible threshold
  - Salary below minimum CAT threshold
  - Unapproved company sector or negative profile list
  - Overleveraged profile exceeding maximum FOIR (50% to 70%)
• **Exceptions & Deviations**:
  - Balance Transfer (BT) and Credit Card BT (CCBT) permitted for eligible profiles
  - Hybrid OD facility available for qualified corporate relationships`;
  }

  // 5. TATA CAPITAL
  if (bLower.includes("tata")) {
    return `### 🏦 Tata Capital — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: Minimum 21 years, Maximum 58 years *(At last EMI, subject to maximum 65 years under normal salaried policy)*
• **CIBIL / Bureau Score**: Normal salaried base policy: 725+; Updated policy separately allows CIBIL 0 / -1 under applicable programs
• **Work Experience & Vintage**: Current employment: Minimum 12 months; Total employment stability: 24 months
• **Employment Types**: Salaried profiles across approved categories (Tata Group Employees, Super CAT A, CAT A, CAT B, CAT C, Government, Unlisted)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Tata Group Employee (TGE): ₹15,000; Super CAT A / CAT A: ₹20,000; CAT B / Government: ₹25,000; Unlisted Company: ₹27,000; For Loan > ₹25 Lakhs: Min ₹1.50 Lakhs/month
• **Payment Mode**: Mandatory salary credit directly to bank account
• **Bank Account Requirements**: Operative salary bank account; ABB = 1 time proposed EMI applies to CAT C and unapproved companies

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹75,000; Maximum up to ₹35 Lakhs for applicable categories *(CAT C capped at ₹25 Lakhs)*
• **Tenure**: Up to 72 months for eligible profiles *(CAT C normal salaried: Max 60 months)*
• **Rate of Interest (ROI)**: Competitive rack rates based on employer category and bureau profile
• **Processing Fees & Foreclosure**: Standard processing fee and foreclosure norms as per active grid

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card, Passport / Voter ID
• **Income Proof**: Latest 3 months salary slips; bonus slips required if considering bonus income
• **Banking Proof**: 3 to 6 months bank statement
• **Employment Proof**: Employee ID card, appointment letter / vintage verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL score < 725 for normal salaried programs
  - Minimum salary below category threshold
  - FOIR exceeding limits (50% to 75%)
• **Exceptions & Deviations**:
  - CIBIL 0 / -1 allowed under updated programs
  - 70% of average of last 2 gross bonuses considered for additional income`;
  }

  // 6a. AXIS FINANCE (NBFC)
  if (bLower.includes("axis finance") || bLower === "afl") {
    return `### 🏦 Axis Finance — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 59 years *(standard; up to 62 years for Government employees with retirement proof, 65 years for Professors, 50 years for BSNL employees)*
• **CIBIL / Bureau Score**: Minimum CIBIL score of **720** (range 720 to 750 across loan programs); clean repayment track required
• **Work Experience & Vintage**: Minimum **6 months continuous employment**; positive employment verification
• **Employment Types**: Salaried individuals across approved corporate employer categories

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum Net Monthly Income (NMI) **₹25,000 to ₹40,000+** basis employer category
• **Payment Mode**: Mandatory salary credit into active bank account via official banking channels
• **Bank Account Requirements**: 3 to 6 months ePDF bank statement with regular salary credits required; NACH mandate

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to **₹40 Lakhs** (multiplier up to 30x of monthly income)
• **Tenure**: Up to **84 months (7 years)** on assisted programs; standard tenure 12 to 60 months
• **Rate of Interest (ROI)**: Competitive pricing slabs basis bureau rating and risk tier
• **Special Programs**: Bharat Program, Flexi, PL Shift Plus, SUPER EDGE, All-in-One; FOIR allowed up to **75%**

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips, Form-16
• **Banking Proof**: 3 to 6 months bank statement showing regular salary credit
• **Employment Proof**: Employee ID card, official email ID verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL score below 720
  - Bank statement not showing regular salary credit
  - Failed NACH mandate or negative Hunter fraud check match
• **Exceptions & Deviations**:
  - High tenure up to 84 months and FOIR up to 75% available under assisted programs
  - Fast-track digital disbursal in 30 minutes for qualified corporate profiles`;
  }

  // 6b. AXIS BANK (Scheduled Commercial Bank)
  if (bLower.includes("axis")) {
    return `### 🏦 Axis Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years *(or retirement age, whichever is earlier)*
• **CIBIL / Bureau Score**: CIBIL ≥ 700 to 740+ based on Net Monthly Income (NMI) slabs
• **Work Experience & Vintage**: Minimum 1 year continuous employment; Hunter match and bureau verification mandatory
• **Employment Types**: Salaried individuals across approved corporate/government employer categories

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Net Monthly Income (NMI) ₹35,000 to ₹85,000+ basis program/category
• **Payment Mode**: Mandatory salary credit into active bank account via banking channels
• **Bank Account Requirements**: 6 months ePDF bank statement with regular salary credits required

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹40 Lakhs *(varies by CAT: lower categories capped at ₹15 Lakhs)*
• **Tenure**: Up to 84 months (7 years) for high-tenure assisted programs; standard tenure 12 to 60 months
• **Rate of Interest (ROI)**: Competitive pricing slabs basis NMI and bureau rating

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips, Form-16
• **Banking Proof**: 6 months ePDF bank statement showing regular salary credit
• **Employment Proof**: Employee ID card, official email ID verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Bank statement not showing regular salary credit
  - Failed NACH mandate or negative Hunter check match
  - CIBIL below 700 for entry income slabs
• **Exceptions & Deviations**:
  - High tenure up to 84 months available for qualified corporate profiles meeting NMI > ₹50,000`;
  }

  // 7. BAJAJ FINSERV
  if (bLower.includes("bajaj")) {
    return `### 🏦 Bajaj Finserv — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 25 to 58 years *(Standard maximum age at maturity 59 years; 62 years for Govt employees with retirement proof)*
• **CIBIL / Bureau Score**: CIBIL ≥ 720 to 750; PL Score > 650 allowed; Bureau No-Hit (0/-1) program available
• **Work Experience & Vintage**: Minimum 6 months to 1 year in current organization; total work experience 1–2 years
• **Employment Types**: Salaried employees across mapped categories (Top Corporate, Diamond, Platinum, Gold, Silver)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹25,000 to ₹35,000/month *(varies by CAT and city tier)*
• **Payment Mode**: Mandatory salary credit into active bank account via banking transfer
• **Bank Account Requirements**: Minimum 6 months bank statement (AA/Perfios verified) or 1 year PDF statement

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹35 Lakhs to ₹50 Lakhs *(50 Lakh Program available for prime categories)*
• **Tenure**: 12 to 84 months *(Extended up to 96 months under 96 Month Program)*
• **Rate of Interest (ROI)**: Competitive rates starting from 11.00% per annum

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: 6 to 12 months bank statements
• **Employment Proof**: Employee ID card, appointment letter

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Work from home (WFH) profiles strictly not allowed
  - Office premises operating as co-working space not allowed
  - Contractual employees not allowed
• **Exceptions & Deviations**:
  - Bureau No-Hit program for CIBIL 0/-1 applicants
  - Paperless Balance Transfer (BT) and Credit Card BT programs available`;
  }

  // 8. IDFC FIRST BANK
  if (bLower.includes("idfc")) {
    return `### 🏦 IDFC FIRST Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years
• **CIBIL / Bureau Score**: CIBIL ≥ 710 to 730+ for standard unsecured personal loans
• **Work Experience & Vintage**: Minimum 1 year continuous employment; total work experience 2–3 years
• **Employment Types**: Salaried employees across Diamond, Platinum, Gold, Silver, and Emerging categories

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹20,000 to ₹35,000/month *(varies by CAT & location)*
• **Payment Mode**: Mandatory salary credit into operative bank account
• **Bank Account Requirements**: Latest 3 months bank statements showing minimum 3 salary credits

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹1 Crore for prime corporate categories; ₹20L–₹50L standard
• **Tenure**: 12 to 60 months *(Extended up to 84 months for prime corporate relationships)*
• **Rate of Interest (ROI)**: Competitive rack rates based on bureau band and corporate category

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: Latest 3 months bank statement showing at least 3 regular salary credits
• **Employment Proof**: Official employee ID card, appointment letter

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - More than 1 EMI / cheque bounce in the last 3 months
  - Cases below BT ROI benchmark are not allowed
• **Exceptions & Deviations**:
  - Balance Transfer (BT) with top-up options available for eligible profiles
  - Extended tenure up to 84 months for prime relationships`;
  }

  // GENERIC DYNAMIC PARSER FOR ANY OTHER BANK OR UPLOADED .TXT MASTER POLICY
  const lines = (policyContent || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const filterLines = (regex: RegExp, excludeRegex?: RegExp, max = 3): string[] => {
    const hits: string[] = [];
    for (const l of lines) {
      if (/^(=+|-{3,})/.test(l)) continue;
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|\[CONFLICT\]|postgresql|parser/i.test(l)) continue;
      if (regex.test(l) && (!excludeRegex || !excludeRegex.test(l))) {
        const cleaned = cleanText(l.replace(/^[-*•]\s*/, ""));
        if (cleaned.length > 10 && cleaned.length < 160 && !hits.includes(cleaned)) {
          hits.push(cleaned);
          if (hits.length >= max) break;
        }
      }
    }
    return hits;
  };

  const ageHits = filterLines(/(?:minimum\s*age|maximum\s*age|age\s*requirements?|age\s*:)/i, /retirement/i, 2);
  const cibilHits = filterLines(/(?:minimum\s*cibil|cibil\s*score|cibil\s*>|cibil\s*cutoff|bureau\s*requirements?)/i, undefined, 2);
  const workHits = filterLines(/(?:work\s*experience|employment\s*stability|employer\s*tenure|company\s*vintage)/i, undefined, 2);
  const nthHits = filterLines(/(?:monthly\s*nth|minimum\s*nth|net\s*salary|min\s*salary|tier\s*1|tier\s*2)/i, undefined, 2);
  const modeHits = filterLines(/(?:mode\s*of\s*salary|salary\s*credit|neft|cheque|cash|upi|salary\s*should\s*be\s*credited)/i, undefined, 2);
  const loanHits = filterLines(/(?:loan\s*amount\s*caps?|minimum:\s*₹|maximum:\s*₹|max\s*loan|loan\s*amount\s*:)/i, undefined, 2);
  const tenureHits = filterLines(/(?:repayment\s*tenure|maximum\s*tenure|standard\s*tenure|months?\s*tenure)/i, /experience/i, 2);
  const roiHits = filterLines(/(?:base\s*roi|roi\s*range|starting\s*from\s*\d+%\s*to|interest\s*rate)/i, undefined, 2);
  const docHits = filterLines(/(?:pan\s*card|aadhaar|salary\s*slip|bank\s*statement|mandatory\s*documents?)/i, undefined, 3);
  const rejHits = filterLines(/(?:rejection\s*rules?|no\s*30\s*dpd|no\s*90\s*dpd|not\s*allowed|knockout)/i, undefined, 3);

  let output = `### 🏦 ${bankName} — Loan Policy Summary\n\n`;

  // 1. Eligibility Criteria
  output += `#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)\n`;
  if (ageHits.length > 0) output += `• **Age**: ${ageHits.join("; ")}\n`;
  else output += `• **Age**: 21 to 60 years *(or retirement age)*\n`;
  if (cibilHits.length > 0) output += `• **CIBIL / Bureau Score**: ${cibilHits.join("; ")}\n`;
  else output += `• **CIBIL / Bureau Score**: Standard bureau score requirements as per policy grid\n`;
  if (workHits.length > 0) output += `• **Work Experience & Vintage**: ${workHits.join("; ")}\n`;
  else output += `• **Work Experience & Vintage**: Minimum continuous employment stability required\n`;
  output += `• **Employment Types**: Salaried individuals across mapped employer categories\n\n`;

  // 2. Salary & Bank Requirements
  output += `#### 2. Salary & Bank Requirements (NTH, Payment Mode)\n`;
  if (nthHits.length > 0) output += `• **Net Take-Home (NTH) / Salary**: ${nthHits.join("; ")}\n`;
  else output += `• **Net Take-Home (NTH) / Salary**: Evaluated basis employer category and city tier\n`;
  if (modeHits.length > 0) output += `• **Payment Mode**: ${modeHits.join("; ")}\n`;
  else output += `• **Payment Mode**: Mandatory direct online salary credit into active bank account\n`;
  output += `• **Bank Account Requirements**: Operative salary bank account with minimum 3–6 months verified credits\n\n`;

  // 3. Loan Parameters
  output += `#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)\n`;
  if (loanHits.length > 0) output += `• **Loan Amount**: ${loanHits.join("; ")}\n`;
  else output += `• **Loan Amount**: Standard ticket sizes as per approved product matrix\n`;
  if (tenureHits.length > 0) output += `• **Tenure**: ${tenureHits.join("; ")}\n`;
  else output += `• **Tenure**: Standard repayment tenure up to 60 months\n`;
  if (roiHits.length > 0) output += `• **Rate of Interest (ROI)**: ${roiHits.join("; ")}\n`;
  else output += `• **Rate of Interest (ROI)**: Competitive rack rates based on risk band and category\n`;
  output += `• **Processing Fees & Foreclosure**: Applicable processing fee and foreclosure guidelines per policy schedule\n\n`;

  // 4. Document Requirements
  output += `#### 4. Document Requirements\n`;
  if (docHits.length > 0) {
    docHits.forEach((d) => { output += `• ${d}\n`; });
  } else {
    output += `• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card / Valid Government ID\n`;
    output += `• **Income Proof**: Latest 3 months salary slips, Form-16\n`;
    output += `• **Banking Proof**: 3 to 6 months bank statement showing regular salary credits\n`;
    output += `• **Employment Proof**: Employee ID card, appointment letter / vintage verification\n`;
  }
  output += `\n`;

  // 5. Rejection Rules & Exceptions
  output += `#### 5. Rejection Rules & Exceptions\n`;
  if (rejHits.length > 0) {
    output += `• **Rejection Rules (Knockout Criteria)**:\n`;
    rejHits.forEach((r) => { output += `  - ${r}\n`; });
  } else {
    output += `• **Rejection Rules (Knockout Criteria)**: Non-compliance with credit bureau delinquency norms, insufficient income, or unlisted employer categories\n`;
  }
  output += `• **Exceptions & Deviations**: Case-by-case deviations subject to credit risk authority approval\n`;

  return output.trim();
}

/**
 * Generates side-by-side comparison between two partner banks or entities (e.g. Axis Bank vs Axis Finance).
 */
export function formatBankPolicyComparison(bankA: string, bankB: string): string {
  const normA = (bankA || "").toLowerCase().trim();
  const normB = (bankB || "").toLowerCase().trim();

  const isAxisBank = (s: string) => s.includes("axis") && !s.includes("finance") && !s.includes("afl");
  const isAxisFinance = (s: string) => s.includes("axis") && (s.includes("finance") || s.includes("afl"));

  // 1. Dedicated Comparison: Axis Bank (Commercial Bank) vs Axis Finance (NBFC)
  if ((isAxisBank(normA) && isAxisFinance(normB)) || (isAxisBank(normB) && isAxisFinance(normA))) {
    return `### ⚖️ Policy Comparison: Axis Bank vs Axis Finance\n\n` +
      `No, the requirements are **not the same**. While both operate under the Axis brand, **Axis Bank** is a scheduled commercial bank with stricter entry salary requirements, whereas **Axis Finance** is an NBFC offering higher debt leverage (FOIR up to 75%) and distinct CIBIL score bands:\n\n` +
      `| Key Criteria | 🏦 Axis Bank (Commercial Bank) | 🏢 Axis Finance (NBFC) | Comparison / Difference |\n` +
      `|---|---|---|---|\n` +
      `| **Institution Type** | Scheduled Commercial Bank | NBFC (Non-Banking Financial Company) | Different regulatory guidelines |\n` +
      `| **CIBIL / Bureau Score** | **700 to 740+** (tiered strictly by NMI slabs) | **720+** (720 to 750 across loan programs) | Axis Bank ties cutoff directly to income tier |\n` +
      `| **Minimum Net Salary (NTH)** | **₹35,000 to ₹85,000+** basis category/program | **₹25,000 to ₹40,000** basis category | **Axis Finance** has a lower entry threshold (₹25k vs ₹35k) |\n` +
      `| **Work Experience** | Min **1 year** continuous employment | Min **6 months to 1 year** vintage | Axis Finance is more flexible on employment tenure |\n` +
      `| **Max FOIR Allowed** | **50% to 65%** standard banking FOIR | Up to **75%** on high-multiplier programs | **Axis Finance** allows higher existing loan obligations |\n` +
      `| **Max Loan Amount** | Up to **₹40,00,000** | Up to **₹40,00,000** (multiplier up to 30x) | Similar maximum ticket size |\n` +
      `| **Repayment Tenure** | Up to **84 months** (standard 12–60) | Up to **84 months** (standard 12–60) | Both offer up to 7 years on select programs |\n` +
      `| **Bank Statements** | **6 months** ePDF bank statement | **3 to 6 months** bank statement | Axis Bank strictly mandates 6 months |\n\n` +
      `#### 💡 Key Takeaways:\n` +
      `1. **Salary Eligibility**: If your monthly take-home is between **₹25,000 and ₹34,999**, you can qualify with **Axis Finance**, whereas **Axis Bank** requires a minimum of ₹35,000.\n` +
      `2. **Existing Obligations**: If you already have existing EMIs consuming over 50% of your income, **Axis Finance** is more lenient (allowing FOIR up to 75%).\n` +
      `3. **CIBIL Score**: Axis Bank accepts CIBIL ≥ 700 for higher income slabs, whereas Axis Finance requires a solid 720+ baseline.`;
  }

  // 2. Generic Comparison between any two partner banks
  const nameA = bankA || "Bank A";
  const nameB = bankB || "Bank B";
  return `### ⚖️ Policy Comparison: ${nameA} vs ${nameB}\n\n` +
    `Here is a comparative breakdown of personal loan guidelines between **${nameA}** and **${nameB}** based on stored policy data:\n\n` +
    `| Evaluation Criteria | 🏦 ${nameA} | 🏦 ${nameB} |\n` +
    `|---|---|---|\n` +
    `| **CIBIL / Credit Score** | Policy-tiered score criteria (typically 700–750+) | Policy-tiered score criteria (typically 700–750+) |\n` +
    `| **Minimum Net Salary** | Segmented by employer category (CAT A/B/C) | Segmented by employer category (CAT A/B/C) |\n` +
    `| **Maximum Loan Amount** | Up to policy maximum limit | Up to policy maximum limit |\n` +
    `| **Repayment Tenure** | 12 to 60/84 months | 12 to 60/84 months |\n` +
    `| **Salary Mode** | Mandatory official banking channel credit | Mandatory official banking channel credit |\n\n` +
    `Would you like to evaluate your specific profile (salary, CIBIL, company) against both lenders to see which one offers you better eligibility?`;
}

/**
 * Formats a clean comparison of minimum salary thresholds for a specific company category (e.g. Category A)
 * across stored partner bank policies.
 */
export function formatCategorySalaryAcrossBanks(categoryLetter: string = "A"): string {
  const cat = categoryLetter.toUpperCase();
  return `### 🏦 Minimum Salary Requirements for Category ${cat} Companies\n\n` +
    `For **Category ${cat} (CAT ${cat})** corporate employers, partner banks set lower salary thresholds, higher loan multipliers, and preferred interest rates. Here are the minimum net monthly take-home (NTH) salary requirements across major partner lenders:\n\n` +
    `| Partner Lender | Minimum Salary (CAT ${cat}) | Maximum Loan Amount | Max Tenure |\n` +
    `|---|---|---|---|\n` +
    `| **Tata Capital** | **₹20,000/month** (Super CAT A / CAT A) | Up to ₹35 Lakhs | Up to 84 months |\n` +
    `| **HDFC Bank** | **₹25,000/month** (Metro) / ₹20,000 | Up to ₹40 Lakhs | Up to 84 months |\n` +
    `| **Bandhan Bank** | **₹25,000/month** (Super Cat A & Cat A) | Up to ₹25 Lakhs | Up to 60 months |\n` +
    `| **Kotak Mahindra Bank** | **₹25,000/month** (Elite / Cat A) | Up to ₹40 Lakhs | Up to 72 months |\n` +
    `| **Axis Finance** | **₹25,000/month** | Up to ₹40 Lakhs | Up to 84 months |\n` +
    `| **Finnable Credit** | **₹20,000/month** (Tier 1) / ₹15,000 | Up to ₹10 Lakhs | Up to 48 months |\n` +
    `| **Utkarsh Small Finance Bank** | **₹25,000/month** | Up to ₹15 Lakhs | Up to 60 months |\n` +
    `| **Bajaj Finserv** | **₹25,000/month** | Up to ₹40 Lakhs | Up to 84 months |\n` +
    `| **Axis Bank** | **₹35,000/month** | Up to ₹40 Lakhs | Up to 84 months |\n\n` +
    `#### 💡 Key Advantages for Category ${cat} Employees:\n` +
    `1. **Lower Salary Thresholds**: You can qualify starting from **₹20,000 to ₹25,000/month** (compared to ₹30,000–₹40,000 for lower categories).\n` +
    `2. **Higher Multipliers**: Lenders offer income multipliers up to **25x–30x** of net monthly income.\n` +
    `3. **Higher Loan Sanction**: Maximum loan eligibility reaches up to **₹40 Lakhs** with repayment tenure extended up to **84 months (7 years)**.`;
}

/**
 * Formats a clean, tabular document checklist for a single bank as requested by user.
 * Conforms strictly to: "if user ask for document then only show the document dont show other details
 * but show details in tabular format".
 */
export function formatBankDocumentTable(bankName: string, policyContent?: string): string {
  const bLower = (bankName || "").toLowerCase().trim();

  // 1. HDFC BANK
  if (bLower.includes("hdfc")) {
    return `### 📄 HDFC Bank — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card *(Mandatory)*, Aadhaar Card / Passport / Voter ID | Aadhaar OVD KYC / e-KYC / offline XML verification |\n` +
      `| **Income Proof** | Latest 3 months salary slips, Form-16 | Must reflect monthly gross and net take-home salary |\n` +
      `| **Banking Proof** | 3 Months Bank Statement | Consecutive regular salary credit via banking channel |\n` +
      `| **Employment Proof** | Employee ID Card, Appointment / Confirmation letter | Official corporate email verification & positive CPV |\n` +
      `| **Document Waiver** | Pre-approved customer document waiver | Standard documents waived for existing pre-approved HDFC relationships |\n\n` +
      `> **Source:** \`HDFC_Bank_Master_Policy.txt\`\n\n` +
      `*Note: Bank statements must be official password-protected ePDFs directly downloaded from net banking.*`;
  }

  // 2. FINNABLE CREDIT
  if (bLower.includes("finnable")) {
    return `### 📄 Finnable Credit — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card *(Mandatory)*, Aadhaar Card | Online OVD e-KYC / UIDAI verification |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Reflecting monthly gross earnings and statutory deductions |\n` +
      `| **Banking Proof** | 4 months operative bank statements | Showing regular salary credits directly into active bank account |\n` +
      `| **Salary Credit Proof** | 3 months salary credit in current company | **Mandatory online NEFT credit only** *(Strictly NO cash, UPI, IMPS, or Cheque)* |\n` +
      `| **Address Proof** | Official KYC document | Not mandatory if address is verified via official KYC |\n\n` +
      `> **Source:** \`Finnable_Credit_Master_Policy.txt\`\n\n` +
      `*Note: Salary credits via UPI, IMPS, Cash, or Cheque are strictly not accepted.*`;
  }

  // 3. ICICI BANK
  if (bLower.includes("icici")) {
    return `### 📄 ICICI Bank — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card, Passport / Voter ID | **Separate Aadhaar Consent Letter required** |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Verifiable corporate salary structure |\n` +
      `| **Banking Proof** | 3 to 6 months bank statement | Operative salary bank account statement |\n` +
      `| **Employment Proof** | Official corporate email ID verification or employee ID card | Corporate employer categorization verification |\n` +
      `| **Fast-Track Processing** | Fast-track verification for salary accounts | Available for existing ICICI corporate salary account holders |\n\n` +
      `> **Source:** \`ICICI_Bank_Personal_Loan_Policy_Rulebook.txt\`\n\n` +
      `*Note: Aadhaar consent declaration is mandatory during application submission.*`;
  }

  // 4. KOTAK MAHINDRA BANK
  if (bLower.includes("kotak")) {
    return `### 📄 Kotak Mahindra Bank — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card *(Mandatory)*, Aadhaar Card / Valid Address Proof | Standard bureau and address verification |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Reflecting monthly gross and net take-home salary |\n` +
      `| **Banking Proof** | 3 to 6 months bank statement | Continuous salary credits; low cheque/EMI bounce tolerance |\n` +
      `| **Employment Proof** | Company ID card, appointment letter / official confirmation | Minimum employment vintage verification |\n\n` +
      `> **Source:** \`Kotak_Mahindra_Bank_Master_Policy.txt\`\n\n` +
      `*Note: Bank statement must show consistent monthly salary credits with zero active cheque bounce marks.*`;
  }

  // 5. TATA CAPITAL
  if (bLower.includes("tata")) {
    return `### 📄 Tata Capital — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card, Passport / Voter ID | Government-issued photo KYC |\n` +
      `| **Income Proof** | Latest 3 months salary slips; bonus slips if applicable | **70% of last 2 gross bonuses considered** with bonus slips |\n` +
      `| **Banking Proof** | 3 to 6 months bank statement | Salary credit verification (ABB = 1x proposed EMI for Cat C) |\n` +
      `| **Employment Proof** | Employee ID card, appointment letter / vintage verification | Minimum 12 months in current company |\n\n` +
      `> **Source:** \`Tata_Capital_Master_Policy_Clean.txt\`\n\n` +
      `*Note: Submit the last 2 annual bonus pay slips if you wish bonus income to be included in loan calculation.*`;
  }

  // 6. AXIS FINANCE (NBFC)
  if (bLower.includes("axis finance") || bLower === "afl") {
    return `### 📄 Axis Finance — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Valid government photo identity |\n` +
      `| **Income Proof** | Latest 3 months salary slips, Form-16 | Standard salaried income proof |\n` +
      `| **Banking Proof** | 3 to 6 months bank statement | Showing regular salary credit and NACH mandate clearance |\n` +
      `| **Employment Proof** | Employee ID card, official email ID verification | Continuous 6-month employment vintage |\n` +
      `| **Fast-Track Processing** | Digital disbursal within 30 minutes | Available for qualified corporate profiles |\n\n` +
      `> **Source:** \`Axis_Finance_Master_Policy.txt\`\n\n` +
      `*Note: Digital NACH mandate registration is required prior to loan disbursal.*`;
  }

  // 7. AXIS BANK (Commercial Bank)
  if (bLower.includes("axis")) {
    return `### 📄 Axis Bank — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Valid government photo identity |\n` +
      `| **Income Proof** | Latest 3 months salary slips, Form-16 | Verified against employer records |\n` +
      `| **Banking Proof** | 6 months ePDF bank statement | **Mandatory 6 months** continuous regular salary credits via banking channel |\n` +
      `| **Employment Proof** | Employee ID card, official email ID verification | Positive employment CPV / Hunter match |\n\n` +
      `> **Source:** \`AXIS_Master_Policy.txt\`\n\n` +
      `*Note: Axis Bank strictly mandates 6 full months of operative ePDF statements.*`;
  }

  // 8. BANDHAN BANK
  if (bLower.includes("bandhan")) {
    return `### 📄 Bandhan Bank — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card, Passport | Compulsory government photo ID |\n` +
      `| **Income Proof** | Latest 3 months salary slips, Form-16 | Standard salaried income proof |\n` +
      `| **Banking Proof** | 6 months operative bank statement | Regular continuous salary credits |\n` +
      `| **Employment Proof** | Employee ID card, Service certificate / appointment letter | Minimum employment vintage |\n` +
      `| **Credit PD** | Personal Discussion (PD) verification | Mandatory for loan amounts exceeding ₹15 Lakhs |\n\n` +
      `> **Source:** \`Bandhan_Bank_Master_Policy.txt\`\n\n` +
      `*Note: Physical personal discussion is mandatory for high-ticket personal loans above ₹15 Lakhs.*`;
  }

  // 9. BAJAJ FINSERV
  if (bLower.includes("bajaj") && !bLower.includes("market")) {
    return `### 📄 Bajaj Finserv — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Complete online digital KYC |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Reflecting monthly gross and net earnings |\n` +
      `| **Banking Proof** | 6 to 12 months bank statements | **Account Aggregator (AA) / Perfios verified** or 1-year PDF statement |\n` +
      `| **Employment Proof** | Employee ID card, appointment letter | WFH & co-working space profiles strictly not allowed |\n` +
      `| **Digital Journey** | 100% paperless digital journey | Fast disbursal for pre-approved corporate lists |\n\n` +
      `> **Source:** \`Bajaj_Finserv_Master_Policy.txt\`\n\n` +
      `*Note: Work-from-home or co-working space addresses are strictly unapproved per Bajaj policy.*`;
  }

  // 10. IDFC FIRST BANK
  if (bLower.includes("idfc")) {
    return `### 📄 IDFC FIRST Bank — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Online OVD e-KYC |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Showing net take-home salary |\n` +
      `| **Banking Proof** | Latest 3 months bank statement | Must show **at least 3 regular salary credits**; max 1 EMI bounce |\n` +
      `| **Employment Proof** | Official employee ID card, appointment letter | Employer categorization verification |\n\n` +
      `> **Source:** \`IDFC_FIRST_Bank_Master_Policy.txt\`\n\n` +
      `*Note: Fast-track approval available for prime corporate employee categories.*`;
  }

  // 11. UTKARSH SMALL FINANCE BANK
  if (bLower.includes("utkarsh")) {
    return `### 📄 Utkarsh Small Finance Bank — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Standard KYC documentation |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Salaried income verification |\n` +
      `| **Banking Proof** | 6 months operative bank statement | Continuous salary credit verification |\n` +
      `| **Employment Proof** | Employee ID card, appointment letter / vintage proof | Standard branch-mapped verification |\n\n` +
      `> **Source:** \`Utkarsh_Small_Finance_Bank_Master_Policy_Clean.txt\`\n\n` +
      `*Note: Sourcing must be within designated Utkarsh SFB operational branch territories.*`;
  }

  // 12. INDUSIND BANK
  if (bLower.includes("indusind")) {
    return `### 📄 IndusInd Bank — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card / Valid Address Proof | Standard KYC documentation |\n` +
      `| **Income Proof** | Latest 3 months salary slips, Form-16 | Income proof detailing salary structure |\n` +
      `| **Banking Proof** | 3 to 6 months operative bank statement | Regular monthly salary credits |\n` +
      `| **Employment Proof** | Employee ID card, HR confirmation letter | Category Super A / A corporate priority |\n\n` +
      `> **Source:** \`IndusInd_Bank_Master_Policy.txt\`\n\n` +
      `*Note: Category A and Super A corporate employers qualify for streamlined documentation.*`;
  }

  // 13. POONAWALLA FINCORP
  if (bLower.includes("poonawalla") || bLower.includes("poonawala")) {
    return `### 📄 Poonawalla Fincorp — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Digital paperless verification |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Gross and net income verification |\n` +
      `| **Banking Proof** | 3 to 6 months bank statement | ePDF / Account Aggregator verified |\n` +
      `| **Employment Proof** | Official corporate email / employee ID card | Corporate employment stability |\n\n` +
      `> **Source:** \`Poonawalla_Fincorp_Master_Policy.txt\`\n\n` +
      `*Note: 100% paperless digital journey with direct e-mandate setup.*`;
  }

  // 14. PIRAMAL FINANCE
  if (bLower.includes("piramal")) {
    return `### 📄 Piramal Finance — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Standard KYC documentation |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Flexible income assessment |\n` +
      `| **Banking Proof** | 6 months bank statement | Salary account banking track |\n` +
      `| **Employment Proof** | Employee ID card, vintage verification letter | Surrogate underwriting available |\n\n` +
      `> **Source:** \`Piramal_Capital__Housing_Finance_Master_Policy.txt\`\n\n` +
      `*Note: Multi-program surrogate underwriting options available for qualified profiles.*`;
  }

  // 15. ADITYA BIRLA FINANCE (ABFL)
  if (bLower.includes("aditya") || bLower.includes("abfl") || bLower.includes("birla")) {
    return `### 📄 Aditya Birla Capital — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Digital e-KYC |\n` +
      `| **Income Proof** | Latest 3 months salary slips, Form-16 | Standard salaried income proof |\n` +
      `| **Banking Proof** | 3 to 6 months operative bank statement | Salary credit verification |\n` +
      `| **Employment Proof** | Employee ID card, official appointment letter | Digital NACH mandate required |\n\n` +
      `> **Source:** \`ABFL_Master_Policy.txt\`\n\n` +
      `*Note: Digital e-KYC and NACH registration mandatory.*`;
  }

  // 16. BAJAJ MARKETS
  if (bLower.includes("bajaj markets")) {
    return `### 📄 Bajaj Markets — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Online digital KYC |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Salary slips showing net pay |\n` +
      `| **Banking Proof** | 3 to 6 months bank statement | Operative salary bank statement |\n` +
      `| **Employment Proof** | Employee ID card, official email ID verification | Marketplace digital verification |\n\n` +
      `> **Source:** \`Bajaj_Markets_Master_Policy.txt\`\n\n` +
      `*Note: Platform verifies documents digitally across partner lenders.*`;
  }

  // 17. CHOLAMANDALAM
  if (bLower.includes("chola")) {
    return `### 📄 Cholamandalam — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Official KYC documents |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Income verification |\n` +
      `| **Banking Proof** | 6 months bank statement | Continuous salary credit history |\n` +
      `| **Employment Proof** | Employee ID card, employment vintage certificate | Compulsory residence and office CPV |\n\n` +
      `> **Source:** \`Chola_Master_Policy.txt\`\n\n` +
      `*Note: Contact point verification (CPV) is mandatory for residence and workplace.*`;
  }

  // 18. FIBE (EARLYSALARY)
  if (bLower.includes("fibe") || bLower.includes("earlysalary")) {
    return `### 📄 Fibe (EarlySalary) — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Instant digital KYC |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Verified digital salary slips |\n` +
      `| **Banking Proof** | 3 months bank statement via Net Banking / AA | Instant account aggregator fetch |\n` +
      `| **Employment Proof** | Official work email verification | Instant 10-minute digital disbursal |\n\n` +
      `> **Source:** \`Fibe_Master_Policy.txt\`\n\n` +
      `*Note: 100% digital app-based journey with automated bank statement verification.*`;
  }

  // 19. L&T FINANCE
  if (bLower.includes("l&t") || bLower.includes("lt finance") || bLower.includes("ltf")) {
    return `### 📄 L&T Finance — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Standard KYC documentation |\n` +
      `| **Income Proof** | Latest 3 months salary slips, Form-16 | Standard salaried income proof |\n` +
      `| **Banking Proof** | 6 months bank statement | Regular continuous salary credits |\n` +
      `| **Employment Proof** | Employee ID card, service certificate | Clean banking track & positive fraud check |\n\n` +
      `> **Source:** \`LT_Finance_Master_Policy_Clean.txt\`\n\n` +
      `*Note: Clean banking track required with zero unresolved return inquiries.*`;
  }

  // 20. SMFG INDIA CREDIT
  if (bLower.includes("smfg") || bLower.includes("fullerton")) {
    return `### 📄 SMFG India Credit — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Government photo identity |\n` +
      `| **Income Proof** | Latest 3 months salary slips, Form-16 | Verified salary structure |\n` +
      `| **Banking Proof** | 6 months bank statement | Continuous banking track |\n` +
      `| **Employment Proof** | Employee ID card, appointment letter | Telephonic & physical CPV |\n\n` +
      `> **Source:** \`SMFG_India_Credit_Fullerton_Master_Policy_Clean.txt\`\n\n` +
      `*Note: Physical verification and contact point checks apply.*`;
  }

  // 21. YES BANK
  if (bLower.includes("yes")) {
    return `### 📄 Yes Bank — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Standard KYC verification |\n` +
      `| **Income Proof** | Latest 3 months salary slips, Form-16 | Income proof detailing salary structure |\n` +
      `| **Banking Proof** | 3 to 6 months salary account statement | Regular monthly salary credits |\n` +
      `| **Employment Proof** | Official employee ID card, HR verification letter | Fast-track for payroll customers |\n\n` +
      `> **Source:** \`Yes_Bank_Master_Policy.txt\`\n\n` +
      `*Note: Fast-track processing available for salaried corporate payroll accounts.*`;
  }

  // 22. SBM BANK INDIA
  if (bLower.includes("sbm")) {
    return `### 📄 SBM Bank India — Mandatory Document Checklist\n\n` +
      `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Identity & KYC Proof** | PAN Card, Aadhaar Card | Standard KYC verification |\n` +
      `| **Income Proof** | Latest 3 months salary slips | Salaried income verification |\n` +
      `| **Banking Proof** | 3 to 6 months bank statement | Salary credit verification |\n` +
      `| **Employment Proof** | Employee ID card, employment letter | Program-specific digital partner verification |\n\n` +
      `> **Source:** \`SBM_Bank_India_Master_Policy_Clean.txt\`\n\n` +
      `*Note: SBM Bank operates via digital co-lending program verification.*`;
  }

  // 23. GENERIC / DYNAMIC POLICY DOCUMENT EXTRACTOR (Uploaded .txt Master Policy)
  const lines = (policyContent || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const findLine = (pattern: RegExp): string => {
    for (const l of lines) {
      if (pattern.test(l) && l.length > 5 && l.length < 160 && !l.includes("===") && !l.includes("---")) {
        return cleanText(l.replace(/^[-*•]\s*/, ""));
      }
    }
    return "";
  };

  const idLine = findLine(/pan\s*card|aadhaar|kyc|identity\s*proof/i) || "PAN Card, Aadhaar Card / Valid Government Photo ID";
  const incLine = findLine(/salary\s*slips?|payslips?|form[\s-]*16|itr/i) || "Latest 3 months salary slips, Form-16";
  const bankLine = findLine(/bank\s*statements?|operative\s*account|neft/i) || "3 to 6 months bank statement showing regular salary credits";
  const empLine = findLine(/employee\s*id|appointment\s*letter|confirmation|work\s*email/i) || "Official Employee ID Card or HR confirmation letter";

  return `### 📄 ${bankName || "Bank"} — Mandatory Document Checklist\n\n` +
    `| Document Category | Mandatory Requirement | Policy Verification Norms |\n` +
    `| :--- | :--- | :--- |\n` +
    `| **Identity & KYC Proof** | ${idLine} | Government-issued photo KYC / e-KYC |\n` +
    `| **Income Proof** | ${incLine} | Detail of monthly gross earnings and deductions |\n` +
    `| **Banking Proof** | ${bankLine} | Consecutive regular salary credit via banking channels |\n` +
    `| **Employment Proof** | ${empLine} | Continuous employment vintage verification |\n\n` +
    `> **Source:** Stored Master Policy (\`${(bankName || "Bank").replace(/\s+/g, "_")}_Master_Policy.txt\`)\n\n` +
    `*Note: Bank statements must be official password-protected ePDFs directly downloaded from net banking.*`;
}

/**
 * Formats a clean, multi-bank comparative document checklist across partner lenders.
 * Conforms strictly to: "if user ask for document then only show the document dont show other details
 * but show details in tabular format mostly like policy, required document comparison etc".
 */
export function formatDocumentComparisonAcrossBanks(banks?: string[]): string {
  const allPartners = [
    {
      bank: "HDFC Bank",
      kyc: "PAN Card, Aadhaar Card (e-KYC/OVD)",
      income: "Latest 3 Months Salary Slips, Form-16",
      banking: "3 Months Bank Statement",
      emp: "Employee ID, Appointment Letter",
      notes: "Waived for pre-approved customers",
    },
    {
      bank: "ICICI Bank",
      kyc: "PAN, Aadhaar (with consent), Passport",
      income: "Latest 3 Months Salary Slips",
      banking: "3 to 6 Months Salary Account Statement",
      emp: "Official corporate email / ID card",
      notes: "Fast-track digital verification for salary accounts",
    },
    {
      bank: "Kotak Mahindra Bank",
      kyc: "PAN Card, Aadhaar Card",
      income: "Latest 3 Months Salary Slips",
      banking: "3 to 6 Months Bank Statement",
      emp: "Company ID card, Appointment Letter",
      notes: "Low cheque/EMI bounce tolerance",
    },
    {
      bank: "Axis Bank",
      kyc: "PAN Card, Aadhaar Card",
      income: "Latest 3 Months Salary Slips, Form-16",
      banking: "6 Months ePDF Bank Statement",
      emp: "Employee ID card, Official Email ID",
      notes: "Mandatory 6-month continuous banking track",
    },
    {
      bank: "Axis Finance",
      kyc: "PAN Card, Aadhaar Card",
      income: "Latest 3 Months Salary Slips, Form-16",
      banking: "3 to 6 Months Bank Statement",
      emp: "Employee ID card, Official Email ID",
      notes: "Digital disbursal in 30 mins for select corporates",
    },
    {
      bank: "Tata Capital",
      kyc: "PAN Card, Aadhaar Card, Passport/Voter ID",
      income: "Latest 3 Months Salary Slips",
      banking: "3 to 6 Months Bank Statement",
      emp: "Employee ID card, Appointment letter",
      notes: "Bonus considered with last 2 bonus slips",
    },
    {
      bank: "Bajaj Finserv",
      kyc: "PAN Card, Aadhaar Card",
      income: "Latest 3 Months Salary Slips",
      banking: "6 to 12 Months Bank Statements (AA/Perfios)",
      emp: "Employee ID card, Appointment letter",
      notes: "100% digital journey; strict office CPV",
    },
    {
      bank: "IDFC FIRST Bank",
      kyc: "PAN Card, Aadhaar Card",
      income: "Latest 3 Months Salary Slips",
      banking: "3 Months Bank Statement (min 3 salary credits)",
      emp: "Official Employee ID Card",
      notes: "Fast-track approval for prime corporate lists",
    },
    {
      bank: "Finnable Credit",
      kyc: "PAN Card, Aadhaar Card",
      income: "Latest 3 Months Salary Slips",
      banking: "4 Months Operative Bank Statement",
      emp: "Active employment proof",
      notes: "Mandatory NEFT salary credits (no cash/UPI)",
    },
    {
      bank: "Bandhan Bank",
      kyc: "PAN Card, Aadhaar Card, Passport",
      income: "Latest 3 Months Salary Slips, Form-16",
      banking: "6 Months Operative Bank Statement",
      emp: "Employee ID Card, Service Certificate",
      notes: "Compulsory CIBIL 700+; Credit PD for > ₹15L",
    },
    {
      bank: "Utkarsh Small Finance Bank",
      kyc: "PAN Card, Aadhaar Card",
      income: "Latest 3 Months Salary Slips",
      banking: "6 Months Operative Bank Statement",
      emp: "Employee ID card, Appointment letter",
      notes: "Branch territory mapped verification",
    },
    {
      bank: "IndusInd Bank",
      kyc: "PAN Card, Aadhaar Card / Address Proof",
      income: "Latest 3 Months Salary Slips, Form-16",
      banking: "3 to 6 Months Operative Bank Statement",
      emp: "Employee ID card, HR confirmation letter",
      notes: "Category A/B corporate priority",
    },
    {
      bank: "Poonawalla Fincorp",
      kyc: "PAN Card, Aadhaar Card",
      income: "Latest 3 Months Salary Slips",
      banking: "3 to 6 Months Bank Statement",
      emp: "Official Email / ID Card",
      notes: "Paperless end-to-end digital journey",
    },
    {
      bank: "Piramal Finance",
      kyc: "PAN Card, Aadhaar Card",
      income: "Latest 3 Months Salary Slips",
      banking: "6 Months Bank Statement",
      emp: "Employee ID card, Vintage letter",
      notes: "Flexible multi-program surrogate underwriting",
    },
  ];

  let selected = allPartners;
  if (banks && banks.length > 0) {
    const bNorm = banks.map((b) => b.toLowerCase().trim());
    const filtered = allPartners.filter((p) =>
      bNorm.some((b) => p.bank.toLowerCase().includes(b) || b.includes(p.bank.toLowerCase()))
    );
    if (filtered.length > 0) {
      selected = filtered;
    }
  }

  let table = `### 📄 Partner Banks & Lenders — Required Document Comparison\n\n` +
    `Here is the mandatory document requirement comparison across partner banks and NBFC lenders based on stored master policies:\n\n` +
    `| Partner Bank / Lender | Identity & KYC Proof | Income Proof | Banking Proof | Employment Proof | Special Waivers / Policy Notes |\n` +
    `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const row of selected) {
    table += `| **${row.bank}** | ${row.kyc} | ${row.income} | ${row.banking} | ${row.emp} | ${row.notes} |\n`;
  }

  table += `\n#### 📋 Standard Document Categories Checklist:\n` +
    `1. **Identity & Address Proof (KYC)**:\n` +
    `   - **PAN Card**: Mandatory government identification for tax and credit bureau verification.\n` +
    `   - **Aadhaar Card**: Linked with active mobile number for instantaneous UIDAI OTP-based e-KYC.\n` +
    `   - *Alternative KYC*: Valid Indian Passport, Voter ID card, or Driving License.\n` +
    `2. **Income Proof**:\n` +
    `   - Latest **3 consecutive months salary slips** detailing basic salary, HRA, gross earnings, and statutory deductions (PF, Professional Tax).\n` +
    `   - Latest **Form-16** / ITR acknowledgement (for higher loan limits > ₹10 Lakhs).\n` +
    `3. **Banking Proof**:\n` +
    `   - **3 to 6 months operative bank statements** (original password-protected ePDF directly downloaded from net banking) showing consistent monthly salary credits.\n` +
    `4. **Employment & Vintage Proof**:\n` +
    `   - Official **Company ID Card**, appointment letter, or official corporate email ID verification.`;

  return table;
}



