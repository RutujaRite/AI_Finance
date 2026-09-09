/**
 * Company Name Alias Resolution
 *
 * Resolves short/common company name variants to their canonical legal names
 * so that company_records matching uses exact (not broad substring) lookups.
 *
 * Examples:
 *   "TCS"  -> "TATA CONSULTANCY SERVICES LIMITED"
 *   "Tata" -> "TATA CONSULTANCY SERVICES LIMITED"
 *   "Infosys" -> "INFOSYS LIMITED"
 */

function normalizeCompanyName(value) {
  if (!value) return null;
  const cleaned = String(value)
    .replace(/[₹,\s]+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .toUpperCase();
  if (!cleaned) return null;
  return cleaned;
}

const COMPANY_ALIASES = {
  'TCS': 'TATA CONSULTANCY SERVICES LIMITED',
  'TATA CONSULTANCY SERVICES': 'TATA CONSULTANCY SERVICES LIMITED',
  'TCS LIMITED': 'TATA CONSULTANCY SERVICES LIMITED',
  'TATA CONSULTANCY SERVICES PVT LTD': 'TATA CONSULTANCY SERVICES LIMITED',
  'INFORMS': 'INFORMS LIMITED',
  'INFOSYS': 'INFOSYS LIMITED',
  'INFOSYS LTD': 'INFOSYS LIMITED',
  'WIPRO': 'WIPRO LIMITED',
  'WIPRO LTD': 'WIPRO LIMITED',
  'WIPRO LIMITED': 'WIPRO LIMITED',
  'HCL': 'HCL TECHNOLOGIES LIMITED',
  'HCL TECH': 'HCL TECHNOLOGIES LIMITED',
  'HCL TECHNOLOGIES': 'HCL TECHNOLOGIES LIMITED',
  'TECH MAHINDRA': 'TECH MAHINDRA LIMITED',
  'MAHINDRA': 'TECH MAHINDRA LIMITED',
  'MAHINDRA & MAHINDRA': 'MAHINDRA & MAHINDRA LIMITED',
  'M&M': 'MAHINDRA & MAHINDRA LIMITED',
  'RELIANCE': 'RELIANCE INDUSTRIES LIMITED',
  'RELIANCE INDUSTRIES': 'RELIANCE INDUSTRIES LIMITED',
  'LT': 'LARSEN & TOUBRO LIMITED',
  'L&T': 'LARSEN & TOUBRO LIMITED',
  'LARSEN AND TOUBRO': 'LARSEN & TOUBRO LIMITED',
  'ACCENTURE': 'ACCENTURE SOLUTIONS PVT LTD',
  'ACCENTURE LLP': 'ACCENTURE SOLUTIONS PVT LTD',
  'IBM': 'IBM INDIA PVT LTD',
  'IBM INDIA': 'IBM INDIA PVT LTD',
  'CAPGEMINI': 'CAPGEMINI TECHNOLOGY SERVICES INDIA LIMITED',
  'CAPGEMINI INDIA': 'CAPGEMINI TECHNOLOGY SERVICES INDIA LIMITED',
  'COGNIZANT': 'COGNIZANT TECHNOLOGY SOLUTIONS INDIA LIMITED',
  'COGNIZANT INDIA': 'COGNIZANT TECHNOLOGY SOLUTIONS INDIA LIMITED',
  'CTS': 'COGNIZANT TECHNOLOGY SOLUTIONS INDIA LIMITED',
  'WIPRO': 'WIPRO LIMITED',
  'TATA MOTORS': 'TATA MOTORS LIMITED',
  'TATA STEEL': 'TATA STEEL LIMITED',
  'TATA POWER': 'TATA POWER COMPANY LIMITED',
  'TATA CONSUMER': 'TATA CONSUMER PRODUCTS LIMITED',
  'TATA CAPITAL': 'TATA CAPITAL LIMITED',
  'TATA AIG': 'TATA AIG GENERAL INSURANCE COMPANY LIMITED',
  'TATA AIA': 'TATA AIA LIFE INSURANCE COMPANY LIMITED',
  'ADANI': 'ADANI ENTERPRISES LIMITED',
  'ADANI PORTS': 'ADANI PORTS AND SEZ LIMITED',
  'ADANI GREEN': 'ADANI GREEN ENERGY LIMITED',
  'ADANI TOTAL': 'ADANI TOTAL GAS LIMITED',
  'HUL': 'HINDUSTAN UNILEVER LIMITED',
  'HINDUSTAN UNILEVER': 'HINDUSTAN UNILEVER LIMITED',
  'UNILEVER': 'HINDUSTAN UNILEVER LIMITED',
  'ITC': 'ITC LIMITED',
  'ITC LIMITED': 'ITC LIMITED',
  'HDFC': 'HOUSING DEVELOPMENT FINANCE CORPORATION LIMITED',
  'HDFC BANK': 'HDFC BANK LIMITED',
  'HDFC LTD': 'HDFC LIMITED',
  'ICICI': 'ICICI BANK LIMITED',
  'ICICI BANK': 'ICICI BANK LIMITED',
  'AXIS': 'AXIS BANK LIMITED',
  'AXIS BANK': 'AXIS BANK LIMITED',
  'KOTAK': 'KOTAK MAHINDRA BANK LIMITED',
  'KOTAK MAHINDRA': 'KOTAK MAHINDRA BANK LIMITED',
  'INDUSIND': 'INDUSIND BANK LIMITED',
  'INDUSIND BANK': 'INDUSIND BANK LIMITED',
  'YES BANK': 'YES BANK LIMITED',
  'SBI': 'STATE BANK OF INDIA',
  'STATE BANK OF INDIA': 'STATE BANK OF INDIA',
  'PNB': 'PUNJAB NATIONAL BANK',
  'CANARA': 'CANARA BANK',
  'IDFC': 'IDFC FIRST BANK LIMITED',
  'IDFC FIRST': 'IDFC FIRST BANK LIMITED',
  'BAJAJ FINANCE': 'BAJAJ FINANCE LIMITED',
  'BAJAJ FINSERV': 'BAJAJ FINSERV LIMITED',
  'BAJAJ MARKETS': 'BAJAJ MARKETS LIMITED',
  'MARMAG': 'MARMAG LOGISTICS PRIVATE LIMITED',
  'AMAZON': 'AMAZON SELLER SERVICES INDIA PRIVATE LIMITED',
  'AMAZON INDIA': 'AMAZON SELLER SERVICES INDIA PRIVATE LIMITED',
  'FLIPKART': 'FLIPKART PRIVATE LIMITED',
  'ZOMATO': 'ZOMATO HYPERMARKET PRIVATE LIMITED',
  'OYI': 'OYI BOYS INDIA PRIVATE LIMITED',
  'OYO': 'OYO BOYS INDIA PRIVATE LIMITED',
  'OYO ROOMS': 'OYO ROOMS PRIVATE LIMITED',
  'PAYTM': 'ONE97 COMMUNICATIONS LIMITED',
  'PAYTM MALL': 'PAYTM MALL LIMITED',
  'PAYTM POSTPAID': 'ONE97 COMMUNICATIONS LIMITED',
  'PHONEPE': 'PHONEPE PE LIMITED',
  'PHONEPE MALL': 'PHONEPE MALL LIMITED',
  'SWIGGY': 'SWIGGY LIMITED',
  'NETFLIX': 'NETFLIX CONTENT INDIA LLP',
  'NETFLIX INDIA': 'NETFLIX CONTENT INDIA LLP',
  'STARBUCKS': 'TATA STARBUCKS JV PVT LTD',
  'DELIVEROO': 'DELIVEROO FOOD LIMITED',
  'DLT': 'DELIVEROO FOOD LIMITED',
  'NOKIA': 'NOKIA SOLUTIONS AND NETWORKS OY',
  'NOKIA INDIA': 'NOKIA NETWORKS INDIA PRIVATE LIMITED',
  'ERICSSON': 'ERICSSON INDIA GLOBAL SERVICES PRIVATE LIMITED',
  'ERICSSON INDIA': 'ERICSSON INDIA GLOBAL SERVICES PRIVATE LIMITED',
  'NOKIA': 'NOKIA NETWORKS INDIA PRIVATE LIMITED',
  'MICROSOFT': 'MICROSOFT INDIA DEVELOPMENT CENTRE PRIVATE LIMITED',
  'MICROSOFT INDIA': 'MICROSOFT INDIA DEVELOPMENT CENTRE PRIVATE LIMITED',
  'GOOGLE': 'GOOGLE INDIA PRIVATE LIMITED',
  'GOOGLE INDIA': 'GOOGLE INDIA PRIVATE LIMITED',
  'ALPHABET': 'GOOGLE INDIA PRIVATE LIMITED',
  'META': 'META PLATFORMS IRELAND LIMITED',
  'META INDIA': 'META PLATFORMS IRELAND LIMITED',
  'FACEBOOK': 'META PLATFORMS IRELAND LIMITED',
  'AMAZON.COM': 'AMAZON.COM INDIA PRIVATE LIMITED',
  'SALESFORCE': 'SALESFORCE.COM INDIA PRIVATE LIMITED',
  'SALESFORCE INDIA': 'SALESFORCE.COM INDIA PRIVATE LIMITED',
  'ADOBE': 'ADOBE SYSTEMS SOFTWARE INTERNATIONAL PRIVATE LIMITED',
  'ADOBE INDIA': 'ADOBE SYSTEMS SOFTWARE INTERNATIONAL PRIVATE LIMITED',
  'SAP': 'SAP INDIA PRIVATE LIMITED',
  'SAP INDIA': 'SAP INDIA PRIVATE LIMITED',
  'ORACLE': 'ORACLE INDIA PRIVATE LIMITED',
  'ORACLE INDIA': 'ORACLE INDIA PRIVATE LIMITED',
  'SAS': 'SAS INSTITUTE INDIA PRIVATE LIMITED',
  'SAS INDIA': 'SAS INSTITUTE INDIA PRIVATE LIMITED',
  'INTUIT': 'INTUIT INC',
  'INTUIT INDIA': 'INTUIT INC',
  'PAYPAL': 'PAYPAL INDIA PRIVATE LIMITED',
  'PAYPAL INDIA': 'PAYPAL INDIA PRIVATE LIMITED',
  'EBAY': 'EBAY INDIA PRIVATE LIMITED',
  'EBAY INDIA': 'EBAY INDIA PRIVATE LIMITED',
  'LINKEDIN': 'LINKEDIN INDIA PRIVATE LIMITED',
  'LINKEDIN INDIA': 'LINKEDIN INDIA PRIVATE LIMITED',
  'TWITTER': 'X CORP PRIVATE LIMITED',
  'TWITTER INDIA': 'X CORP PRIVATE LIMITED',
  'X CORP': 'X CORP PRIVATE LIMITED',
  'TCS': 'TATA CONSULTANCY SERVICES LIMITED',
  'CONTRACT': 'CONTRACT EMPLOYEE',
  'TATA CONSULTANCY SERVICES LIMITED': 'TATA CONSULTANCY SERVICES LIMITED',
  'Birla': 'ADITYA BIRLA GROUP LIMITED',
  'ADITYA BIRLA': 'ADITYA BIRLA FINANCE LIMITED',
  'ABFL': 'ADITYA BIRLA FINANCE LIMITED',
  'ADITYA BIRLA FINANCE': 'ADITYA BIRLA FINANCE LIMITED',
  'Tata Projects': 'Tata Projects Limited',
  'Tata Power': 'Tata Power Company Limited',
  'Tata Motors': 'Tata Motors Limited',
  'Tata Chemicals': 'Tata Chemicals Limited',
  'Tata Global': 'Tata Consumer Products Limited',
  'Tata Starbucks': 'Tata Starbucks Private Limited',
  'Tata AIG': 'Tata AIG General Insurance Company Limited',
  'Tata AIA': 'Tata AIA Life Insurance Company Limited',
  'Tata Capital': 'Tata Capital Limited',
   'Tata CLP': 'Tata CLP Limited',
};

const COMMON_ABBREVIATIONS = {
  'LTD': 'LIMITED',
  'PVT LTD': 'PRIVATE LIMITED',
  'PRIVATE LTD': 'PRIVATE LIMITED',
  'INDIA': 'INDIA',
  'IN': 'INDIA',
};

function normalizeForMatch(name) {
  if (!name) return null;
  let n = String(name).toUpperCase().trim();
  n = n.replace(/\./g, ' ').replace(/,/g, ' ');
  n = n.replace(/\s+/g, ' ').trim();
  n = n.replace(/^(?:M\.s|M\/s|mst|shri|shreem|mata|smt)\.?\s+/i, '');
  n = n.replace(/\s*-$|^-\s*/, '');
  n = n.replace(/\b(LTD|PVT|PRIVATE|LIMITED|INDIA|CO|COMPANY|CORPORATION|CORP)\b/g, (m) => {
    if (m === 'LTD') return 'LIMITED';
    if (m === 'PVT' || m === 'PRIVATE') return 'PRIVATE';
    if (m === 'INDIA' || m === 'IN' || m === 'CO') return m;
    if (m === 'COMPANY' || m === 'CORPORATION' || m === 'CORP') return m;
    return m;
  });
  return n;
}

function resolveCompanyAlias(companyName) {
  if (!companyName) return null;

  const normalized = normalizeCompanyName(companyName);
  if (!normalized) return null;

  if (COMPANY_ALIASES[normalized]) {
    return COMPANY_ALIASES[normalized];
  }

  for (const [alias, canonical] of Object.entries(COMPANY_ALIASES)) {
    if (normalizeCompanyName(alias) === normalized) {
      return canonical;
    }
  }

  const tokens = normalized.split(/[\s&]+/).filter(t => t.length > 0);
  for (const token of tokens) {
    if (token.length >= 3 && COMPANY_ALIASES[token]) {
      return COMPANY_ALIASES[token];
    }
  }

  const upperName = normalized.toUpperCase();
  for (const [alias, canonical] of Object.entries(COMPANY_ALIASES)) {
    const aliasNorm = normalizeCompanyName(alias);
    if (aliasNorm && upperName === aliasNorm) {
      return canonical;
    }
  }

  return normalizeCompanyName(companyName);
}

function getCompanyMatchPatterns(resolvedName) {
  const patterns = [];

  patterns.push({
    operator: '=',
    value: resolvedName,
    label: 'exact'
  });

  patterns.push({
    operator: 'ILIKE',
    value: `${resolvedName}%`,
    label: 'prefix'
  });

  patterns.push({
    operator: 'ILIKE',
    value: `% ${resolvedName}`,
    label: 'suffix'
  });

  patterns.push({
    operator: 'ILIKE',
    value: `% ${resolvedName.split(' ').slice(0, 3).join(' ')}%`,
    label: 'first_words'
  });

  return patterns;
}

function buildCompanyMatchConditions(resolvedName, paramOffset) {
  const patterns = [
    { op: '=', value: resolvedName },
    { op: 'ILIKE', value: resolvedName + '%' },
    { op: 'ILIKE', value: '%' + resolvedName },
  ];

  const conditions = [];
  const params = [];
  let offset = paramOffset;

  for (const p of patterns) {
    offset += 1;
    conditions.push(`company_name ${p.op} $${offset}`);
    params.push(p.value);
  }

  return { conditions: conditions.join(' OR '), params, nextOffset: offset };
}

module.exports = {
  normalizeCompanyName,
  resolveCompanyAlias,
  getCompanyMatchPatterns,
  buildCompanyMatchConditions,
  COMPANY_ALIASES,
};
