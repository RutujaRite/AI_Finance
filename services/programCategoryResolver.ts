export const RESOLVER_QUESTIONS = [
  { key: "companyName", label: "What is your employer or company name?" },
  { key: "employmentType", label: "Are you salaried or self-employed?" },
  { key: "monthlyIncome", label: "What is your monthly take-home salary (in ₹)?" },
  { key: "cibil", label: "What is your CIBIL score?" },
  { key: "existingEmi", label: "What is your current monthly EMI obligation (if any)?" },
  { key: "loanAmount", label: "What loan amount do you need (in ₹)?" },
  { key: "tenureMonths", label: "What is the preferred loan tenure in months?" },
  { key: "age", label: "What is your age?" },
];

export function getNextResolverQuestion(applicant: Record<string, any>) {
  const seen = new Set<string>();
  for (const key of Object.keys(applicant || {})) seen.add(key);
  return RESOLVER_QUESTIONS.find((question) => !seen.has(question.key)) || null;
}

export function isResolverComplete(applicant: Record<string, any>) {
  return RESOLVER_QUESTIONS.every((question) => !!applicant?.[question.key]);
}

const programCategoryResolver = {
  RESOLVER_QUESTIONS,
  getNextResolverQuestion,
  isResolverComplete,
};

export default programCategoryResolver;
