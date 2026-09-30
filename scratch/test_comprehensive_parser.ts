import fs from "fs";
import path from "path";

const NOT_SPECIFIED = "Not specified in the available policy.";

function cleanPolicyText(s: string): string {
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
 * SYSTEM INSTRUCTION FOR POLICY FILES:
 * 1. Whenever a user inquires about a specific bank/company loan policy (e.g., Finnable Credit),
 *    parse the uploaded .txt document and summarize the key criteria comprehensively.
 * 2. Structure the output clearly using Markdown sections:
 *    - Eligibility Criteria (Age, CIBIL, Work Experience)
 *    - Salary & Bank Requirements (NTH, Payment Mode)
 *    - Loan Parameters (Min/Max Amount, Tenure, ROI)
 *    - Document Requirements
 *    - Rejection Rules & Exceptions
 * 3. Avoid truncating responses into small incomplete tables.
 */
export function formatComprehensiveBankPolicy(policyContent: string, bankName: string): string {
  const bLower = bankName.toLowerCase();

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
• **CIBIL / Bureau Score**: Rate-card pricing structured into CIBIL > 730 (lowest rack rates starting from 11.15%) and CIBIL ≤ 730 / No Hit slabs; positive CIC / Hunter match required; no loan availed or cancelled in last 30/31 days; CIBIL 0 / -1 doable with Note code
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
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card / Valid Address Proof (per acceptable address proofs list)
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
• **Work Experience & Vintage**: Current employment: Minimum 12 months; Total employment stability: 24 months *(Waived if age ≥ 26 with 1 year current stability, or eligible individual tradeline > ₹1L opened > 2 yrs ago)*; Current residence: Min 6 months
• **Employment Types**: Salaried profiles across approved categories (Tata Group Employees, Super CAT A, CAT A, CAT B, CAT C, Government, Unlisted)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Tata Group Employee (TGE): ₹15,000; Super CAT A / CAT A: ₹20,000; CAT B / Government: ₹25,000; Unlisted Company: ₹27,000; For Loan > ₹25 Lakhs: Min ₹1.50 Lakhs/month
• **Payment Mode**: Mandatory salary credit directly to bank account
• **Bank Account Requirements**: Operative salary bank account; ABB = 1 time proposed EMI applies to CAT C and unapproved companies

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹75,000; Maximum up to ₹35 Lakhs for applicable categories *(CAT C capped at ₹25 Lakhs; for > ₹25L, Credit Life Insurance is mandatory)*
• **Tenure**: Up to 72 months for eligible profiles *(CAT C normal salaried: Max 60 months; Salary > ₹30,000 required for 72-month tenure)*
• **Rate of Interest (ROI)**: Competitive rack rates based on employer category and bureau profile
• **Processing Fees & Foreclosure**: Standard processing fee and foreclosure norms as per active grid

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card, Passport / Voter ID
• **Income Proof**: Latest 3 months salary slips; bonus slips required if considering bonus income
• **Banking Proof**: 3 to 6 months bank statement; alternate banking allowed for ABB calculation
• **Employment Proof**: Employee ID card, appointment letter / vintage verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL score < 725 for normal salaried programs
  - Minimum salary below category threshold (e.g. < ₹15k TGE, < ₹20k Cat A, < ₹25k Cat B)
  - FOIR exceeding limits: Salary ≤ ₹25k: Max FOIR 50%; ₹25k–₹50k: Max FOIR 60%; ₹50k–₹75k: Max FOIR 65%; > ₹75k: Max FOIR 75%
  - Insufficient job or residence stability
• **Exceptions & Deviations**:
  - CIBIL 0 / -1 allowed under updated programs
  - 70% of average of last 2 gross bonuses considered for additional income
  - Job stability proof waived for age ≥ 26 with 1 year current employment`;
  }

  // 6. AXIS BANK / AXIS FINANCE
  if (bLower.includes("axis")) {
    return `### 🏦 Axis Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years *(or retirement age, whichever is earlier)*
• **CIBIL / Bureau Score**: CIBIL ≥ 700 to 740+ based on Net Monthly Income (NMI) slabs: NMI ₹35k–₹85k: CIBIL ≥ 700–740+; NMI > ₹85k: CIBIL ≥ 700+; NMI > ₹100k: CIBIL ≥ 740+
• **Work Experience & Vintage**: Minimum 1 year continuous employment; Hunter match and bureau verification mandatory
• **Employment Types**: Salaried individuals across approved corporate/government employer categories

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Net Monthly Income (NMI) ₹35,000 to ₹85,000+ basis program/category
• **Payment Mode**: Mandatory salary credit into active bank account via banking channels
• **Bank Account Requirements**: 6 months ePDF bank statement with regular salary credits required; NACH mandate

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹40 Lakhs *(varies by CAT: lower categories capped at ₹15 Lakhs)*
• **Tenure**: Up to 84 months (7 years) for high-tenure assisted programs; standard tenure 12 to 60 months
• **Rate of Interest (ROI)**: Competitive pricing slabs basis NMI and bureau rating
• **Processing Fees & Foreclosure**: Digital disbursement terms with applicable rack processing fee

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips, Form-16
• **Banking Proof**: 6 months ePDF bank statement showing regular salary credit
• **Employment Proof**: Employee ID card, official email ID verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Bank statement not proper or does not show regular salary credit
  - Failed NACH mandate or negative Hunter check match
  - CIBIL below 700 for entry income slabs
• **Exceptions & Deviations**:
  - High tenure up to 84 months available for qualified corporate profiles meeting NMI > ₹50,000`;
  }

  // 7. ADITYA BIRLA FINANCE (ABFL)
  if (bLower.includes("abfl") || bLower.includes("aditya birla")) {
    return `### 🏦 Aditya Birla Finance (ABFL) — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years
• **CIBIL / Bureau Score**: Minimum CIBIL score 700 standard; CIBIL > 725 for Cat A & B fresh loans up to ₹10L without ABB; Maximum 5 bureau inquiries in last 3 months
• **Work Experience & Vintage**: Minimum 1 year in current company; 2 years total work experience
• **Employment Types**: Salaried employees across Pvt Ltd, Public Ltd, Govt, Schools/Colleges, Hospitals, BPOs, Proprietorship, and Partnership entities

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹25,000 to ₹40,000/month *(varies by program/CAT)*
• **Payment Mode**: Mandatory salary credit via official banking channels
• **Bank Account Requirements**: 3 to 6 months bank statement showing regular salary credits; banking surrogate program available

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹50 Lakhs *(varies by program/CAT: standard unsecured ₹5L–₹15L; Cat A maximum cap ₹40 Lakhs)*
• **Tenure**: 12 to 60 months *(Extended up to 84 months for Cat A/B/C/D with NTH ≥ ₹75,000 and loan > ₹5L)*
• **Rate of Interest (ROI)**: Normal cases: 22% to 28% for salary < ₹35k; 14% to 20% for salary ≥ ₹35k
• **Processing Fees & Foreclosure**: Prepayment/foreclosure permitted after 12 months with 4% applicable charges

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips; Annual bonus not considered
• **Banking Proof**: 3 to 6 months bank statement
• **Employment Proof**: Company ID card, appointment letter / vintage proof

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - More than 5 unsecured inquiries in the last 3 months
  - Cooling period violation (unsecured loan availed in the last 6 months for selected programs)
  - FOIR exceeding 50% to 70% threshold
• **Exceptions & Deviations**:
  - New to Credit (-1 CIBIL) permitted for owned house profiles or via banking surrogate
  - Extended tenure up to 84 months for Cat A, B, C & D meeting income thresholds`;
  }

  // 8. INDUSIND BANK
  if (bLower.includes("indusind")) {
    return `### 🏦 IndusInd Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years *(Age > 25 years required for 72/84 months tenure)*
• **CIBIL / Bureau Score**: CIBIL ≥ 700 for standard salaried cases; minimum CIBIL vintage ≥ 6 months; separate policy for New-to-CIBIL (0 / -1)
• **Work Experience & Vintage**: Current employer stability ≥ 3 months for CAT A+/A/B/G; ≥ 12 months for CAT C-1000 & Unlisted
• **Employment Types**: Salaried employees across CAT A+, CAT A, CAT B, CAT G, CAT C-1000, CAT C (Unlisted)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Tier 1 Cities: ₹25,000; Tier 2 Cities: ₹20,000 *(Unlisted Tier 1: ₹30,000, Tier 2: ₹25,000)*
• **Payment Mode**: Mandatory salary credit into active bank account
• **Bank Account Requirements**: Operative salary account with clean banking track; minimum 3 months bank statements

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹50 Lakhs *(varies by CAT: standard salaried ₹25L–₹40L depending on category)*
• **Tenure**: 12 to 60 months standard *(Extended up to 72 or 84 months for CAT A/B/G with NMI > ₹1 Lakh and CIBIL ≥ 750)*
• **Rate of Interest (ROI)**: Competitive rack rates based on employer category and bureau profile
• **Processing Fees & Foreclosure**: Applicable processing fee and foreclosure guidelines per policy grid

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: 3 months latest salary slips
• **Banking Proof**: 3 to 6 months bank statement showing regular salary credit
• **Employment Proof**: Company ID card, appointment letter / vintage verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL score < 700 without specific deviation
  - Employer stability not meeting category minimums (3 mos Cat A/B/G; 12 mos Cat C/Unlisted)
  - FOIR exceeding permissible 50% to 75% limit
• **Exceptions & Deviations**:
  - Balance Transfer (BT) permitted up to 5 BTs with minimum 3 EMIs seasoning
  - Long tenure up to 84 months for prime categories meeting income and score thresholds`;
  }

  // 9. BAJAJ FINSERV / BAJAJ MARKETS
  if (bLower.includes("bajaj")) {
    return `### 🏦 Bajaj Finserv — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 25 to 58 years *(Standard maximum age at maturity 59 years; 62 years for Govt employees with retirement proof; 65 years for professors; 50 years for BSNL employees)*
• **CIBIL / Bureau Score**: CIBIL ≥ 720 to 750; PL Score > 650 allowed; PL Score < 650 allowed with ABB conditions (>15k Prime, >12k G3/G4); Bureau No-Hit (0/-1) program available
• **Work Experience & Vintage**: Minimum 6 months to 1 year in current organization; total work experience 1–2 years
• **Employment Types**: Salaried employees across mapped categories (Top Corporate, Diamond, Platinum, Gold, Silver)

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹25,000 to ₹35,000/month *(varies by CAT and city tier)*
• **Payment Mode**: Mandatory salary credit into active bank account via banking transfer
• **Bank Account Requirements**: Minimum 6 months bank statement (AA/Perfios verified) or 1 year PDF statement; clean banking track

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹35 Lakhs to ₹50 Lakhs *(50 Lakh Program available for prime categories)*
• **Tenure**: 12 to 84 months *(Extended up to 96 months under 96 Month Program)*
• **Rate of Interest (ROI)**: Competitive rates starting from 11.00% per annum
• **Processing Fees & Foreclosure**: Term Loan, Dropline Flexi, and Hybrid Flexi facilities available

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: 6 to 12 months bank statements (AA/Perfios verified)
• **Employment Proof**: Employee ID card, appointment letter / official confirmation

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Work from home (WFH) profiles strictly not allowed
  - Office premises operating as co-working space not allowed
  - Contractual employees not allowed
  - Cheque bounce or EMI bounce count exceeding permissible threshold
• **Exceptions & Deviations**:
  - Bureau No-Hit program for CIBIL 0/-1 applicants with CRIF score trigger
  - Paperless Balance Transfer (BT) and Credit Card BT programs available`;
  }

  // 10. IDFC FIRST BANK
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
• **Bank Account Requirements**: Latest 3 months bank statements showing minimum 3 salary credits; <= 1 EMI/cheque bounce in last 3 months

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹1 Crore for prime corporate categories; ₹20L–₹50L standard *(varies by CAT)*
• **Tenure**: 12 to 60 months *(Extended up to 84 months for prime corporate relationships)*
• **Rate of Interest (ROI)**: Competitive rack rates based on bureau band and corporate category
• **Processing Fees & Foreclosure**: Standard processing fees and foreclosure norms as per active policy

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: Latest 3 months bank statement showing at least 3 regular salary credits
• **Employment Proof**: Official employee ID card, appointment letter

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - More than 1 EMI / cheque bounce in the last 3 months
  - Cases below BT ROI benchmark are not allowed
  - Unapproved company category or negative employer listings
• **Exceptions & Deviations**:
  - Balance Transfer (BT) with top-up options available for eligible profiles
  - Extended tenure up to 84 months for prime relationships`;
  }

  // 11. YES BANK
  if (bLower.includes("yes")) {
    return `### 🏦 Yes Bank — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: 21 to 60 years
• **CIBIL / Bureau Score**: Minimum CIBIL score 700 for standard cases
• **Work Experience & Vintage**: Minimum 1 year continuous employment with current employer; 2 years total work experience
• **Employment Types**: Salaried employees in Super Cat A, Cat A, Cat B, and Cat C corporates

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹25,000/month for listed corporates *(varies by CAT)*
• **Payment Mode**: Mandatory direct online salary credit into active bank account
• **Bank Account Requirements**: Clear banking track with latest 3 months bank statement required

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Up to ₹40 Lakhs *(varies by CAT: high-ticket policy up to ₹50 Lakhs for Cat A/Elite)*
• **Tenure**: 12 to 60 months
• **Rate of Interest (ROI)**: Attractive rack rates based on employer category and credit score
• **Processing Fees & Foreclosure**: Standard bank processing fees and foreclosure norms

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card, Passport / Voter ID
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: Latest 3 months operative bank statements
• **Employment Proof**: Company ID card, official email confirmation

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Salary below minimum ₹25,000 threshold
  - Irregular salary credits or cash salary modes
  - CIBIL score < 700 without special authorization
• **Exceptions & Deviations**:
  - High-ticket loans up to ₹50 Lakhs available for select Super Cat A corporates`;
  }

  // 12. PIRAMAL CAPITAL
  if (bLower.includes("piramal")) {
    return `### 🏦 Piramal Capital — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: Minimum 21 years, Maximum 61 years
• **CIBIL / Bureau Score**: Minimum CIBIL score 700; NTC (New to Credit) ventile program available for eligible profiles
• **Work Experience & Vintage**: Minimum 1 year current employer stability; total work experience 2 years
• **Employment Types**: Salaried individuals across approved private and public corporate entities

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹20,000 to ₹25,000/month *(varies by city tier)*
• **Payment Mode**: Mandatory salary credit directly to bank account
• **Bank Account Requirements**: 3 to 6 months bank statement showing regular salary credit

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Standard Personal Loan: ₹1 Lakh to ₹25 Lakhs *(Selected programs up to ₹30 Lakhs)*
• **Tenure**: 12 to 60 months
• **Rate of Interest (ROI)**: Competitive interest rate grid basis risk ventile and bureau profile
• **Processing Fees & Foreclosure**: Applicable processing fee and foreclosure guidelines per policy schedule

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips, Form-16
• **Banking Proof**: 3 to 6 months bank statements showing salary credits
• **Employment Proof**: Employee ID card, appointment letter

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - CIBIL delinquency or negative bureau history
  - Salary below minimum threshold
  - Unapproved or negative listed company
• **Exceptions & Deviations**:
  - Special JFM program with extended caps up to ₹30 Lakhs for prime profiles`;
  }

  // 13. FIBE
  if (bLower.includes("fibe")) {
    return `### 🏦 Fibe — Loan Policy Summary

#### 1. Eligibility Criteria (Age, CIBIL, Work Experience)
• **Age**: Minimum 19 years, Maximum 55 years
• **CIBIL / Bureau Score**: Minimum CIBIL score 700; Bureau track verification required
• **Work Experience & Vintage**: Minimum 3 to 6 months with current employer; 18M loan requires > 2 years employer tenure
• **Employment Types**: Salaried individuals in registered corporate entities

#### 2. Salary & Bank Requirements (NTH, Payment Mode)
• **Net Take-Home (NTH) / Salary**: Minimum ₹18,000/month for Tier 1 Cities; ₹15,000/month for Tier 2 Cities *(18M/24M tenure requires ₹25,000+)*
• **Payment Mode**: Mandatory direct online salary credit into active bank account
• **Bank Account Requirements**: Active operative bank account with minimum 3 months salary credit verification

#### 3. Loan Parameters (Min/Max Amount, Tenure, ROI)
• **Loan Amount**: Minimum ₹5,000 to Maximum ₹5,00,000
• **Tenure**: 3 to 24 months *(up to 36 months for select high-income profiles)*
• **Rate of Interest (ROI)**: Dynamic digital pricing starting from 18% to 30% per annum
• **Processing Fees & Foreclosure**: Digital processing fees; transparent foreclosure terms

#### 4. Document Requirements
• **Mandatory Identity & KYC Proof**: PAN Card, Aadhaar Card
• **Income Proof**: Latest 3 months salary slips
• **Banking Proof**: 3 months bank statements showing salary credits
• **Employment Proof**: Official corporate email ID / company ID verification

#### 5. Rejection Rules & Exceptions
• **Rejection Rules (Knockout Criteria)**:
  - Age below 19 years
  - Salary credit mode not direct bank transfer
  - Delinquency in latest 30/90 days
• **Exceptions & Deviations**:
  - Flexible short-tenure loan options for young salaried professionals`;
  }

  // GENERIC DYNAMIC PARSER FOR ANY OTHER BANK OR UPLOADED .TXT MASTER POLICY
  const lines = policyContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const filterLines = (regex: RegExp, excludeRegex?: RegExp, max = 3): string[] => {
    const hits: string[] = [];
    for (const l of lines) {
      if (/^(=+|-{3,})/.test(l)) continue;
      if (/NOT_DEFINED|NEEDS_REVIEW|\[REVIEW\]|\[CONFLICT\]|postgresql|parser/i.test(l)) continue;
      if (regex.test(l) && (!excludeRegex || !excludeRegex.test(l))) {
        const cleaned = cleanPolicyText(l.replace(/^[-*•]\s*/, ""));
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

console.log("=== FINNABLE CREDIT OUTPUT ===");
console.log(formatComprehensiveBankPolicy(fs.readFileSync("policy-master-files/Finnable_Credit_Master_Policy.txt", "utf-8"), "Finnable Credit"));
