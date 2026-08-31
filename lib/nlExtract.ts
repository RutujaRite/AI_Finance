/**
 * Natural-language parsing for bank-manager queries.
 * Internal usage: chat API route extracts structured filters (bank, city, branch,
 * manager name) from free-text user messages before calling bankSearch.
 *
 * Ported from Python ai_agent.py → TypeScript.
 */

// Natural-language parsing for bank-manager queries (ported from ai_agent.py).
// Extracts bank name, city/state, branch and manager name from a free-text
// message so the DB lookup can be narrowed to exactly what the user typed.

const KNOWN_BANKS = [
  "state bank of india", "sbi", "icici", "hdfc", "axis", "kotak",
  "bank of baroda", "punjab national", "pnb", "yes bank", "idfc",
  "indusind", "union bank", "canara", "bank of india", "federal",
  "central bank", "indian bank", "uco", "indian overseas",
];

const INDIAN_LOCATIONS = [
  "Mumbai", "Delhi", "Bangalore", "Bengaluru", "Pune", "Hyderabad", "Chennai",
  "Kolkata", "Ahmedabad", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore",
  "Thane", "Bhopal", "Visakhapatnam", "Vizag", "Patna", "Vadodara", "Baroda",
  "Ludhiana", "Agra", "Nashik", "Ranchi", "Meerut", "Raipur", "Surat",
  "Coimbatore", "Gurgaon", "Gurugram", "Noida", "Faridabad", "Ghaziabad",
  "Varanasi", "Srinagar", "Amritsar", "Jamshedpur", "Allahabad", "Prayagraj",
  "Vijayawada", "Guwahati", "Gwalior", "Chandigarh", "Mysore", "Mysuru",
  "Mangalore", "Mangaluru", "Hubli", "Hubballi", "Aurangabad", "Kochi",
  "Cochin", "Trivandrum", "Thiruvananthapuram", "Bhubaneswar", "Cuttack",
  "Jabalpur", "Guntur", "Madurai", "Rajkot", "Jodhpur", "Udaipur", "Salem",
  "Tiruchirappalli", "Trichy", "Vapi", "Siliguri", "Kolhapur", "Solapur",
  "Maharashtra", "Karnataka", "Tamil Nadu", "Tamilnadu", "Gujarat",
  "Uttar Pradesh", "West Bengal", "Rajasthan", "Telangana", "Kerala",
  "Madhya Pradesh", "Bihar", "Punjab", "Haryana", "Goa", "Odisha",
  "Andhra Pradesh", "Assam", "Jharkhand", "Chhattisgarh",
];

const INDIAN_STATES = new Set([
  "Maharashtra", "Karnataka", "Tamil Nadu", "Tamilnadu", "Gujarat",
  "Uttar Pradesh", "West Bengal", "Rajasthan", "Telangana", "Kerala",
  "Madhya Pradesh", "Bihar", "Punjab", "Haryana", "Goa", "Odisha",
  "Andhra Pradesh", "Assam", "Jharkhand", "Chhattisgarh",
]);

const LOCATION_ALIASES: Record<string, string> = {
  banglore: "Bangalore",
  bengaluru: "Bangalore",
  calutta: "Kolkata",
  calcuta: "Kolkata",
  calcutta: "Kolkata",
  pondicherry: "Puducherry",
  tamilnadu: "Tamil Nadu",
  vizag: "Visakhapatnam",
  cochin: "Kochi",
  trichy: "Tiruchirappalli",
  mangaluru: "Mangalore",
};

const LOCATION_STOPWORDS = new Set([
  "location", "locations", "area", "areas", "region", "city", "state",
  "branch", "branches", "details", "detail", "near", "our", "database",
  "records", "record", "the", "my",
]);

const CITY_PATTERN = /\b(?:in|at|for|from|near|of)\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function correctLocation(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (LOCATION_STOPWORDS.has(lower)) return null;
  if (LOCATION_ALIASES[lower]) return LOCATION_ALIASES[lower];
  for (const loc of INDIAN_LOCATIONS) {
    if (loc.toLowerCase() === lower) return loc;
  }
  let best: string | null = null;
  let bestDist = Infinity;
  for (const loc of INDIAN_LOCATIONS) {
    const d = levenshtein(lower, loc.toLowerCase());
    const ratio = 1 - d / Math.max(lower.length, loc.length);
    if (ratio >= 0.7 && d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }
  return best;
}

export function extractBankName(message: string): string | null {
  const lowered = message.toLowerCase();
  for (const bank of KNOWN_BANKS) {
    if (lowered.includes(bank)) {
      if (bank === "state bank of india") return "SBI";
      return bank.toUpperCase();
    }
  }
  const match = message.match(/\b([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)\s+bank\b/);
  if (match) return match[1].trim();
  return null;
}

export function extractLocation(message: string): { value: string | null; isState: boolean } {
  const lowered = message.toLowerCase();
  for (const loc of INDIAN_LOCATIONS) {
    if (lowered.includes(loc.toLowerCase())) {
      return { value: loc, isState: INDIAN_STATES.has(loc) };
    }
  }
  const match = CITY_PATTERN.exec(message);
  if (match) {
    let token = match[1].trim();
    token = token.replace(
      new RegExp(`\\b(${Array.from(LOCATION_STOPWORDS).join("|")})\\b`, "i"),
      ""
    ).trim();
    const corr = correctLocation(token);
    if (corr) return { value: corr, isState: INDIAN_STATES.has(corr) };
  }
  return { value: null, isState: false };
}

export function extractBranch(message: string): string | null {
  const match = message.match(/\bbranch\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i);
  return match ? match[1].trim() : null;
}

export function extractManagerName(message: string): string | null {
  const matches = message.matchAll(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+))\b/g);
  for (const m of matches) {
    const candidate = m[1].trim();
    const lowered = candidate.toLowerCase();
    if (LOCATION_STOPWORDS.has(lowered)) continue;
    if (KNOWN_BANKS.some((b) => lowered.includes(b))) continue;
    if (INDIAN_LOCATIONS.some((l) => lowered.includes(l.toLowerCase()))) continue;
    return candidate;
  }
  return null;
}
