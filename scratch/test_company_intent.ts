export function isInvalidCompanyName(text: string): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < 2) return true;
  if (/^\d+$/.test(clean)) return true;

  // Single-word greetings, confirmations, general terms
  if (
    /^(yes|no|ok|sure|nope|none|nil|na|n\/a|hi|hello|hey|start|cancel|reset|restart|test|loan|loans|personal|salaried|emi|tenure|cibil|money|cash|please)$/i.test(
      clean
    )
  ) {
    return true;
  }

  // Loan intent statements and inquiries
  if (
    /(?:want|need|looking|interested|apply|check|get|avail|give|require|find)\s+(?:a\s+|for\s+)?(?:personal|home|business|car|auto|education)?\s*loans?/i.test(
      clean
    ) ||
    /^(?:i\s+)?(?:want|need|require|looking\s+for|apply\s+for)\s+(?:a\s+)?(?:personal|home|business|car|auto|education)?\s*loans?/i.test(
      clean
    ) ||
    /^(?:i\s+)?(?:want|need|require)\s+loans?/i.test(clean) ||
    /^(?:personal|home|business|car|auto|education)\s*loans?$/i.test(clean) ||
    /^loans?$/i.test(clean) ||
    /loans?\s*(?:eligibility|check|apply|needed|inquiry|options|calculator|details|rules)/i.test(clean) ||
    /\b(?:want|need)\s+(?:a\s+)?loans?\b/i.test(clean) ||
    /\bcan\s+i\s+get\s+(?:a\s+)?loans?/i.test(clean) ||
    /\bam\s+i\s+eligible/i.test(clean) ||
    /\bcheck\s+my\s+eligibility/i.test(clean) ||
    /^(?:i\s+)?want\s+personal\s*loans?$/i.test(clean) ||
    /^(?:i\s+)?need\s+personal\s*loans?$/i.test(clean) ||
    /^(?:i\s+)?need\s+(?:a\s+)?loans?$/i.test(clean)
  ) {
    return true;
  }

  return false;
}

const tests = [
  "I want personal loan",
  "I want a personal loan",
  "want personal loan",
  "need personal loan",
  "personal loan",
  "loan",
  "can i get a loan",
  "check eligibility",
  "Google India",
  "Tata Consultancy Services",
  "TCS",
  "Infosys Limited",
  "Wipro",
  "I work at Wipro"
];

for (const t of tests) {
  console.log(`"${t}": isInvalid = ${isInvalidCompanyName(t)}`);
}
