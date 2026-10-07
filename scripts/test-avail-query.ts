function isBankAvailabilityQuery(message: string): {
  isAvailableBanksList: boolean;
  isSpecificBankAvailability: boolean;
  bankName?: string;
} {
  const norm = message.toLowerCase().trim();
  const clean = norm.replace(/[?.,!]/g, "").trim();

  // 1. General available banks list query
  const isAvailableBanksList =
    /^(?:tell\s+me\s+|show\s+|list\s+|what\s+are\s+|which\s+|display\s+|get\s+)?(?:all\s+)?(?:the\s+)?available\s+(?:partner\s+)?banks?$/i.test(clean) ||
    /^(?:tell\s+me\s+|show\s+|list\s+|what\s+are\s+|which\s+)?(?:partner\s+banks?|banks?\s+available|available\s+bank\s+policies)$/i.test(clean) ||
    /^(?:which|what)\s+banks?\s+(?:have|has|do\s+have)\s+(?:loan\s+)?polic(?:y|ies)\s*(?:available|stored)?$/i.test(clean) ||
    /^(?:which|what)\s+bank\s+policies\s+are\s+available$/i.test(clean) ||
    /^(?:show|tell\s+me|list|give\s+me)\s+(?:available\s+)?partner\s+banks?$/i.test(clean) ||
    /^(?:list\s+of\s+available\s+banks|list\s+of\s+partner\s+banks)$/i.test(clean) ||
    /^(?:which|what)\s+banks\s+are\s+available$/i.test(clean);

  if (isAvailableBanksList) {
    return { isAvailableBanksList: true, isSpecificBankAvailability: false };
  }

  // 2. Specific bank policy availability query: e.g. "is Bandhan Bank policy available?", "is SBI policy available?"
  const specificMatch =
    /^(?:is|are|does)\s+(?:the\s+)?(.+?)\s*(?:loan\s*)?polic(?:y|ies)\s*(?:available|stored|supported|present)$/i.exec(clean) ||
    /^(?:is\s+)(.+?)\s*(?:policy\s*)?available$/i.exec(clean) ||
    /^(?:can\s+i\s+check\s+)(.+?)\s*(?:loan\s*)?polic(?:y|ies)$/i.exec(clean);

  if (specificMatch) {
    const rawBank = specificMatch[1]?.trim();
    if (rawBank && !/^(?:all|any|our|your|the|what|which|a|an)$/i.test(rawBank)) {
      return { isAvailableBanksList: false, isSpecificBankAvailability: true, bankName: rawBank };
    }
  }

  return { isAvailableBanksList: false, isSpecificBankAvailability: false };
}

const testPhrases = [
  "tell me available banks",
  "tell me the available banks",
  "which banks have policy available?",
  "what banks are available?",
  "show available partner banks",
  "which bank policies are available?",
  "is Bandhan Bank policy available?",
  "is SBI policy available?",
  "is Citibank policy available?",
  "available banks",
  "what is Bandhan Bank CIBIL requirement?",
  "I work at Infosys. Check my company category."
];

testPhrases.forEach(p => {
  console.log(`"${p}" =>`, isBankAvailabilityQuery(p));
});
