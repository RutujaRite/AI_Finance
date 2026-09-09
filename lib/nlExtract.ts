// lib/nlExtract.ts
/**
 * Natural language extraction for bank manager searches.
 * Replaces Python extraction logic from ai_agent.py
 */

export async function extractBankName(message: string): Promise<string | null> {
  const patterns = [
    /(?:at|from|for|in)\s+(ICICI|SBI|HDFC|AXIS|CITI|BOI|PNB|CAN|BOB|UBI|BOB|PAY|FRC|HSBC|CITI|DBS|KOTAK|NABARD|PSB|RBI|SBP|SBH|SBIC|SBI|MCI|MCI|SBM|SBI|SBI)/i,
    /(?:bank\s+)?(ICICI|SBI|HDFC|AXIS|CITI|BOI|PNB|CAN|BOB|UBI|KOTAK|YES|INDUS|FED|INDN|BAR|ALL|AUBL|BNP|CIT|CORP|DEUT|FED|GRIN|HAMP|HSBC|ICICI|JIO|KKB|LDS|NDO|NIB|NYP|OTH|PNB|PSB|RES|SBP|SBH|SBIC|SBI|SC|SVC|SGB|SGS|SIA|SKB|SPK|STD|SUM|SVC|THE|TIM|UCO|UNI|UTB|VBL|VEN|WBI|YBL|YES|ULS)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
}

export async function extractLocation(message: string): Promise<string | null> {
  const cities = [
    'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad',
    'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal', 'Visakhapatnam',
    'Vijayawada', 'Warangal', 'Ranchi', 'Jamshedpur', 'Bhubaneswar', 'Chandigarh',
    'Ludhiana', 'Amritsar', 'Patna', 'Gaya', 'Dhanbad', 'Jodhpur', 'Udaipur', 'Ajmer',
    'Kota', 'Alwar', 'Bikaner', 'Hanumangarh', 'Sriganganagar', 'Barmer', 'Jaisalmer',
    'Nagaur', 'Khalkhara', 'Churu', 'Sardarshaar', 'Mandsaur', 'Neemuch', 'Mandu',
    'Khandwa', 'Burhanpur', 'Khargone', 'Barwani', 'Dhar', 'Indore', 'Ujjain', 'Ratlam',
    'Sailesh', 'Shajapur', 'Agar', 'Mandsaur', 'Neemuch', 'Mann',
  ];

  const lowerMessage = message.toLowerCase();
  
  for (const city of cities) {
    if (lowerMessage.includes(city.toLowerCase())) {
      return city;
    }
  }
  
  return null;
}

export async function extractBranch(message: string): Promise<string | null> {
  const branchPatterns = [
    /branch\s+(?:named\s+)?([A-Za-z\s]+)/i,
    /(?:in|at|of)\s+([A-Za-z\s]+(?:branch|location|office))/i,
    /(?:main|central|head)\s+(?:branch)?\s*[:\-]?\s*([A-Za-z\s]+)/i,
  ];

  for (const pattern of branchPatterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

export async function extractManagerName(message: string): Promise<string | null> {
  const managerPatterns = [
    /manager\s+(?:named\s+)?([A-Za-z\s]+)/i,
    /(?:Mr\.?|Ms\.?|Dr\.?)\s+([A-Za-z\s]+)/i,
    /(?:search|find|look)\s+(?:for\s+)?manager\s+([A-Za-z\s]+)/i,
  ];

  for (const pattern of managerPatterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}