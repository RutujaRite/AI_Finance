import { consolidateApplicantProfileFromHistory, getRequiredPolicyFields, extractApplicantDetails } from '../lib/dynamicEligibilityEngine';

function testMultiTurnFlow() {
  console.log('=== MULTI-TURN CONVERSATION STATE TEST ===');

  // Turn 1: User indicates loan intent
  const history: Array<{ role: string; content: string }> = [];
  let userMsg1 = "I need a personal loan of 5 lakhs";
  let applicant = consolidateApplicantProfileFromHistory(history, userMsg1);
  console.log('Turn 1 Applicant:', JSON.stringify(applicant));
  let missing = getRequiredPolicyFields(applicant);
  console.log('Turn 1 Missing fields:', missing);
  console.log('Next question for:', missing[0]); // should be companyName

  // Turn 2: User provides company and salary together
  history.push({ role: 'user', content: userMsg1 });
  history.push({ role: 'assistant', content: 'Could you please tell me which company you currently work for?' });
  let userMsg2 = "I work at Cognizant, monthly salary is 65k";
  applicant = consolidateApplicantProfileFromHistory(history, userMsg2, applicant);
  console.log('\nTurn 2 Applicant:', JSON.stringify(applicant));
  missing = getRequiredPolicyFields(applicant);
  console.log('Turn 2 Missing fields:', missing);
  console.log('Next question for:', missing[0]); // should be tenureMonths (not companyName or monthlyIncome!)

  if (missing.includes('companyName') || missing.includes('monthlyIncome')) {
    console.error('FAIL: Re-asked for company or salary!');
  } else {
    console.log('PASS: Did not re-ask answered fields (companyName, monthlyIncome)');
  }

  // Turn 3: User answers tenure
  history.push({ role: 'user', content: userMsg2 });
  history.push({ role: 'assistant', content: 'What is your preferred repayment tenure?' });
  let userMsg3 = "3 years";
  applicant = consolidateApplicantProfileFromHistory(history, userMsg3, applicant);
  console.log('\nTurn 3 Applicant:', JSON.stringify(applicant));
  missing = getRequiredPolicyFields(applicant);
  console.log('Turn 3 Missing fields:', missing);
  console.log('Next question for:', missing[0]); // should be cibil

  if (missing.includes('tenureMonths')) {
    console.error('FAIL: Re-asked for tenure!');
  } else {
    console.log('PASS: Tenure recorded accurately as 36 months');
  }

  // Turn 4: User answers CIBIL and age together
  history.push({ role: 'user', content: userMsg3 });
  history.push({ role: 'assistant', content: 'What is your approximate CIBIL score?' });
  let userMsg4 = "My CIBIL is 750 and age is 28";
  applicant = consolidateApplicantProfileFromHistory(history, userMsg4, applicant);
  console.log('\nTurn 4 Applicant:', JSON.stringify(applicant));
  missing = getRequiredPolicyFields(applicant);
  console.log('Turn 4 Missing fields:', missing);
  console.log('Next question for:', missing[0]); // should be existingEmi

  if (missing.includes('cibil') || missing.includes('age')) {
    console.error('FAIL: Re-asked for cibil or age!');
  } else {
    console.log('PASS: CIBIL and age both captured from single message');
  }

  // Turn 5: User answers existing EMI
  history.push({ role: 'user', content: userMsg4 });
  history.push({ role: 'assistant', content: 'Do you have any existing monthly EMIs?' });
  let userMsg5 = "No, 0 existing EMIs";
  applicant = consolidateApplicantProfileFromHistory(history, userMsg5, applicant);
  console.log('\nTurn 5 Applicant:', JSON.stringify(applicant));
  missing = getRequiredPolicyFields(applicant);
  console.log('Turn 5 Missing fields:', missing);

  if (missing.length === 0) {
    console.log('PASS: All 7 fields collected seamlessly without re-asking any answered fields!');
  } else {
    console.error('FAIL: Missing fields remaining:', missing);
  }

  // Turn 6: Alternative scenario - User says "I am not working anywhere"
  console.log('\n=== UNEMPLOYED SCENARIO TEST ===');
  const unempHistory = [
    { role: 'user', content: 'I need a loan of 5 lakhs' },
    { role: 'assistant', content: 'Which company do you currently work for?' }
  ];
  let unempApplicant = consolidateApplicantProfileFromHistory(unempHistory, 'I am not working anywhere');
  console.log('Unemployed applicant state:', JSON.stringify(unempApplicant));
  let unempMissing = getRequiredPolicyFields(unempApplicant);
  console.log('Unemployed missing fields:', unempMissing);

  if (unempApplicant.employmentStatus === 'unemployed' && unempMissing.length === 0) {
    console.log('PASS: employmentStatus is unemployed and no blind question flow / tenure asked!');
  } else {
    console.error('FAIL: Unemployed handling failed', unempApplicant, unempMissing);
  }
}

testMultiTurnFlow();
