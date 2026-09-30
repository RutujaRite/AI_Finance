function extractCleanCompanyName(input: string): string {
  if (!input) return "";
  let str = input.trim();

  // 1. Remove leading conversational and action prefixes
  str = str.replace(
    /^(?:can\s+(?:you|we)\s+|could\s+you\s+|please\s+|i\s+(?:want|need|wish|would\s+like)\s+(?:to\s+)?(?:check|see|know|search|find|get)?\s*)/i,
    ""
  );
  str = str.replace(
    /^(?:give\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)\s+(?:of|about|on|for|regarding)|show\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)?\s*(?:of|about|on|for)?|tell\s+me\s+about|provide\s+(?:me\s+)?(?:details|info|information)\s+(?:of|about|on|for)?|what\s+is\s+(?:the\s+)?(?:category|tier|rating|status|details|info|information)\s+(?:of|for|on)|how\s+is|check\s+(?:for\s+)?|search\s+(?:for\s+)?|verify|look\s*up|find|info\s+on|details\s+(?:of|for|about)|is|are)\s+/i,
    ""
  );

  // 2. Strip 'company search', 'company serach', 'search company', 'check company' prefixes/suffixes
  str = str.replace(
    /^(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach|lookup|check|find|details|info|information)\s+(?:of|for|about|on)?\s*/i,
    ""
  );
  str = str.replace(
    /^(?:search|serach|check|find|lookup)\s+(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)\s+(?:of|for|about|on)?\s*/i,
    ""
  );

  // 3. Remove leading 'company' / 'employer' if still at start
  str = str.replace(/^(?:the\s+)?(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny|employer)\s+/i, "");

  // 4. Remove trailing query phrases like 'company', 'company details', 'listing', 'category rating', 'is listed'
  str = str.replace(/\s+(?:is\s+)?(?:listed|categorized|approved)\s*(?:in\s+banks?|across\s+banks?)?$/i, "");
  str = str.replace(/\s+(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)\s+(?:details|information|info|rating|tier|category|status|listing)$/i, "");
  str = str.replace(/\s+(?:details|information|info|rating|tier|category|status|listing|profile)$/i, "");
  str = str.replace(/\s+(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)$/i, "");

  // 5. Clean punctuation
  str = str.replace(/^[?.,!:\s]+|[?.,!:\s]+$/g, "").trim();

  // If the result is just generic words like 'search', 'serach', 'company', etc., return empty
  if (/^(?:search|serach|company|compny|comapny|employer|details|info|information|check|find|lookup|status|category|tier|rating)$/i.test(str)) {
    return "";
  }

  return str;
}

const tests = [
  "give me information of infosys company",
  "give me information about infosys",
  "tell me about tcs",
  "what is category of wipro",
  "is accenture listed",
  "company search infosys",
  "company serach tcs",
  "search company google",
  "check company hcl",
  "infosys company",
  "infosys company details",
  "company search",
  "company serach",
  "search company",
  "tcs",
  "Tata Consultancy Services",
  "wipro",
  "infosys",
];

function isCompanyInfoOrSearchIntentCandidate(input: string): boolean {
  if (!input) return false;
  const norm = input.toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();
  if (/^(?:hi|hello|hey|good\s*(?:morning|afternoon|evening)|thanks|thank\s*you)$/i.test(norm)) return false;

  // 1. Generic company search or typo (e.g. "company search", "company serach", "search company")
  if (/^(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach|lookup|check|find|details|info|information)$/i.test(norm) ||
      /^(?:search|serach|check|find|lookup)\s+(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)$/i.test(norm) ||
      /^(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach)\b/i.test(norm)) {
    return true;
  }

  // 2. Clear inquiry patterns (e.g. "give me information of ...", "tell me about ...", "what is category of ...", "is ... listed")
  if (/(?:give\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)\s+(?:of|about|on|for|regarding)|tell\s+me\s+about|what\s+is\s+(?:the\s+)?(?:category|tier|rating|status|details|info|information)\s+(?:of|for|on)|show\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)?\s*(?:of|about|on|for)?|info\s+(?:on|about)|details\s+(?:of|for|about))/i.test(norm)) {
    return true;
  }

  // 3. Action + company (e.g. "check company ...", "search company ...", "company search ...", "company serach ...")
  if (/(?:check|search|serach|find|lookup|verify)\s+(?:for\s+)?(?:the\s+)?(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)/i.test(norm) ||
      /(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach|details|info|information|rating|tier|category|status|listing)/i.test(norm)) {
    return true;
  }

  // 4. Target company + company (e.g. "infosys company", "tcs company", "infosys company details")
  if (/\b(?:tcs|infosys|wipro|cognizant|accenture|capgemini|hcl|reliance|mahindra|google|microsoft|amazon)\s+(?:comp(?:any|anies|ny|nay|o|a)?|comapn(?:y|ies)?|cmpny)\b/i.test(norm)) {
    return true;
  }

  // 5. Explicit check on category/tier/listing
  if (/(?:category|tier|rating|listing)\s+(?:of|for|in)\b/i.test(norm) ||
      /\b(?:is|are)\s+.*\s+(?:listed|categorized|approved)\b/i.test(norm)) {
    return true;
  }

  return false;
}

function extractTargetCompanyFromMessageTest(text: string): string | undefined {
  if (!text) return undefined;
  const raw = text.trim();
  if (/^(?:hi|hello|hey|good\s*(?:morning|afternoon|evening)|thanks|thank\s*you)$/i.test(raw)) return undefined;

  const cleaned = extractCleanCompanyName(raw);
  if (cleaned && cleaned.length >= 2 && !/^(?:search|serach|company|compny|comapny|employer|details|info|information)$/i.test(cleaned)) {
    return cleaned;
  }
  return undefined;
}

tests.forEach((t) => {
  const clean = extractCleanCompanyName(t);
  const isIntent = isCompanyInfoOrSearchIntentCandidate(t);
  const target = extractTargetCompanyFromMessageTest(t);
  console.log(t, "===> clean:", JSON.stringify(clean), "target:", JSON.stringify(target), "isIntent:", isIntent);
});
