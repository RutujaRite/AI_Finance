function clean(input: string): string {
  if (!input) return "";
  let str = input.trim();
  str = str.replace(
    /^(?:can\s+(?:you|we)\s+|could\s+you\s+|please\s+|i\s+(?:want|need|wish|would\s+like)\s+(?:to\s+)?(?:check|see|know|search|find|get)?\s*)/i,
    ""
  );
  str = str.replace(
    /^(?:show\s+(?:me\s+)?(?:the\s+)?|display\s+(?:the\s+)?|list\s+(?:the\s+)?|get\s+(?:the\s+)?|where\s+(?:is|are)\s+(?:the\s+)?)?(?:matching\s+)?comp(?:any|anies|ny|nay|o|a|ies)?(?:\s+list)?\s+(?:of|for|in|about)\s+/i,
    ""
  );
  str = str.replace(
    /^(?:give\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)\s+(?:of|about|on|for|regarding)|show\s+(?:me\s+)?(?:the\s+)?(?:information|info|details|data|profile)?\s*(?:of|about|on|for)?|tell\s+me\s+about|provide\s+(?:me\s+)?(?:details|info|information)\s+(?:of|about|on|for)?|what\s+is\s+(?:the\s+)?(?:category|tier|rating|status|details|info|information)\s+(?:of|for|on)|how\s+is|check\s+(?:for\s+)?|search\s+(?:for\s+)?|verify|look\s*up|find|info\s+on|details\s+(?:of|for|about)|is|are)\s+/i,
    ""
  );
  str = str.replace(
    /^(?:(?:i\s*am|i['"]?m|i)\s+(?:working\s+)?(?:at|in|with|for)|(?:i\s+)?(?:work|works|working|employed)\s+(?:at|in|with|for|by)|(?:my\s+)?(?:employer|company)\s+is|employer\s*[:=-]|company\s*[:=-]|at|in|with|for)\s+/i,
    ""
  );
  str = str.replace(
    /^(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:search|serach|lookup|check|find|details|info|information)\s+(?:of|for|about|on)?\s*/i,
    ""
  );
  str = str.replace(
    /^(?:search|serach|check|find|lookup)\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:of|for|about|on)?\s*/i,
    ""
  );
  str = str.replace(/^(?:the\s+)?(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny|employer)\s+/i, "");
  str = str.replace(/(?:\s*[.,;!?]|\s+(?:and|with|so|now))\s*(?:(?:please\s+)?(?:give|show|tell|provide|check|display|find|get)\s+.*|what\s+.*|can\s+you\s+.*)$/i, "");
  str = str.replace(/\s+(?:is\s+)?(?:listed|categorized|approved)\s*(?:in\s+banks?|across\s+banks?)?$/i, "");
  str = str.replace(/\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)\s+(?:details|information|info|rating|tier|category|status|listing|list)$/i, "");
  str = str.replace(/\s+(?:details|information|info|rating|tier|category|status|listing|profile|list)$/i, "");
  str = str.replace(/\s+(?:not\s+(?:displaying|showing))$/i, "");
  str = str.replace(/\s+(?:comp(?:any|anies|ny|nay|o|a|ies)?|comapn(?:y|ies)?|cmpny)$/i, "");
  str = str.replace(/^[?.,!:\s]+|[?.,!:\s]+$/g, "").trim();
  if (/^(?:search|serach|company|compny|comapny|compies|employer|details|info|information|check|find|lookup|status|category|tier|rating|matching|list|matching\s+companies|matching\s+compies)$/i.test(str)) {
    return "";
  }
  return str;
}

const testCases = [
  "I am working at TCS. Give me information about that company",
  "I work at TCS",
  "I am working at Infosys",
  "Tell me about TCS",
  "My company is TCS",
  "I work at Tata Consultancy Services",
  "company search tata",
  "show matching companies for tata",
];

for (const t of testCases) {
  console.log(`"${t}" -> "${clean(t)}"`);
}
