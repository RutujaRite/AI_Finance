import { evaluateApplicantAgainstAllBanks, getRequiredPolicyFields, extractApplicantDetails } from '../lib/dynamicEligibilityEngine';

async function main() {
  console.log('--- TEST 1: Unemployed Applicant ---');
  let applicant: any = { loanType: 'Personal Loan', loanAmount: 500000 };
  applicant = extractApplicantDetails('I am not working anywhere', applicant);
  console.log('Applicant state:', JSON.stringify(applicant));
  const missing = getRequiredPolicyFields(applicant);
  console.log('Missing fields:', missing);
  if (missing.length === 0) {
    console.log('PASS: No blind question sequence or tenure asked!');
    const evalRes = await evaluateApplicantAgainstAllBanks(applicant, 'Personal Loan');
    console.log('Eligible banks count:', evalRes.eligibleBanks.length);
    console.log('Ineligible banks count:', evalRes.ineligibleBanks.length);
    console.log('Sample failure reason:', evalRes.ineligibleBanks[0]?.failureReasons);
  } else {
    console.log('FAIL: Still asked for:', missing);
  }

  console.log('\n--- TEST 2: Cognizant Applicant Policies (HDFC, ICICI, Axis) ---');
  const cogApplicant = {
    loanType: 'Personal Loan',
    companyName: 'Cognizant',
    monthlyIncome: 65000,
    loanAmount: 500000,
    tenureMonths: 36,
    cibil: 750,
    existingEmi: 0,
    age: 28
  };
  const cogEval = await evaluateApplicantAgainstAllBanks(cogApplicant, 'Personal Loan');
  const checkBanks = ['hdfc', 'icici', 'axis'];
  for (const b of cogEval.evaluations) {
    if (checkBanks.some(k => b.bankCode.toLowerCase().includes(k) || b.bankName.toLowerCase().includes(k))) {
      console.log('Bank:', b.bankName, '| Status:', b.status, '| CIBIL:', b.policyCibil, '| Tenure:', b.policyTenure, '| EMI:', b.monthlyEmi);
      if (b.policyCibil === '-' || b.policyTenure === '-') {
        console.error('FAIL: Found hyphen for', b.bankName);
      } else {
        console.log('PASS: Valid policy values for', b.bankName);
      }
    }
  }
}
main().catch(console.error);
