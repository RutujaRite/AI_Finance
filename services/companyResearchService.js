function normalizeAssistantText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
function cleanSearchText(value) {
  return normalizeAssistantText(value).replace(/https?:\/\/\S+/gi, ' ').replace(/[^a-zA-Z0-9\s]/g, ' ');
}

function cleanTavilyText(str) {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\d+\]/g, '')
    .replace(/\[edit\]/gi, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/##+/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x27;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateBullet(text, maxLen = 100) {
  let cleaned = cleanTavilyText(text)
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/^(and|with|it|which|who|also|that|as)\s+/i, '')
    .trim();
  if (!cleaned) return '';
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (cleaned.length <= maxLen) return cleaned;
  const cut = cleaned.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + '...';
}

function filterRelevantPassages(companyName, tavilyData) {
  const companyTokens = companyName.toLowerCase().split(/\s+/).filter(t => t.length > 2 && !/^(company|solutions|technologies|services|pvt|ltd|limited|inc|corp|corporation|group|india|international)$/i.test(t));
  const coreName = companyTokens.length > 0 ? companyTokens[0] : companyName.toLowerCase().slice(0, 4);

  const answer = cleanTavilyText(tavilyData.answer || '');
  const results = Array.isArray(tavilyData.results) ? tavilyData.results : [];

  const relevantPassages = [];
  if (answer) {
    relevantPassages.push(answer);
  }

  results.forEach((r, idx) => {
    const title = cleanTavilyText(r.title || '');
    const content = cleanTavilyText(r.content || '');
    const url = (r.url || '').toLowerCase();
    
    const isDirectMatch = title.toLowerCase().includes(coreName) || url.includes(coreName) || idx < 2;
    if (isDirectMatch) {
      if (title) relevantPassages.push(title);
      if (content) relevantPassages.push(content);
    } else {
      if (content.toLowerCase().includes(coreName)) {
        relevantPassages.push(content);
      }
    }
  });

  return { answer, results, relevantPassages };
}

function detectIndustry(fullText, companyName) {
  const text = fullText.toLowerCase();
  const name = companyName.toLowerCase();
  
  const itScore = (text.match(/\b(it services|information technology|technology company|software development|consulting company|digital services|cloud computing|artificial intelligence|enterprise software|tech consulting|it infrastructure)\b/gi) || []).length;
  const finScore = (text.match(/\b(fintech|nbfc|loan provider|lending platform|credit solutions|personal loans|home loans|business loans|mortgage lending|peer to peer lending|wealth management firm)\b/gi) || []).length;
  
  if (/\b(incredit|bajaj finance|muthoot|cred|paytm|lendingkart|moneytap|tata capital)\b/i.test(name) || (finScore > itScore && finScore >= 2)) {
    return 'Financial Services & Fintech / Lending';
  }

  if (/\b(tcs|tata consultancy|ibm|infosys|wipro|cognizant|accenture|hcl|tech mahindra|capgemini|oracle|microsoft|google|amazon|salesforce)\b/i.test(name) || (itScore >= finScore && itScore > 0)) {
    return 'Information Technology & Consulting Services';
  }

  if (/\b(fintech|lending|loan|loans|mortgage|credit|nbfc|banking|wealth management|financial services)\b/i.test(text)) {
    return 'Financial Services & Banking / Lending';
  }
  if (/\b(it services|technology|software|cloud|digital transformation|cybersecurity|ai)\b/i.test(text)) {
    return 'Information Technology & Digital Services';
  }
  return 'Enterprise & Business Services';
}

function extractWebsite(companyName, results, answer, passages) {
  const nameTokens = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length >= 2 && !/^(company|solutions|technologies|services|pvt|ltd|limited|inc|corp|corporation|group|india|international)$/i.test(t));
  const coreToken = nameTokens[0] || companyName.toLowerCase().slice(0, 3);
  const excludedDomains = /google|bing|yahoo|wikipedia|scribd|zoominfo|linkedin|facebook|twitter|instagram|youtube|github|tracxn|crunchbase|glassdoor|indeed|cbinsights|globaldata|reuters|bloomberg|forbes|highperformr|tradewindsdr|clay\.com|bccresearch/i;

  if (answer) {
    const directUrlMatch = answer.match(/\b(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.(?:com|in|org|net|io|co|ai|tech))\b/i);
    if (directUrlMatch) {
      const domain = directUrlMatch[1].toLowerCase();
      if (!excludedDomains.test(domain)) {
        return directUrlMatch[0].startsWith('http') ? directUrlMatch[0] : `https://${directUrlMatch[0]}`;
      }
    }
  }

  for (const r of results) {
    if (r.url) {
      try {
        const u = new URL(r.url);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        if (!excludedDomains.test(host) && (host.includes(coreToken) || (nameTokens[1] && host.includes(nameTokens[1])))) {
          return `${u.protocol}//${u.hostname}`;
        }
      } catch (e) {}
    }
  }

  for (const r of results) {
    if (r.url) {
      try {
        const u = new URL(r.url);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        if (!excludedDomains.test(host)) {
          return `${u.protocol}//${u.hostname}`;
        }
      } catch (e) {}
    }
  }

  return null;
}

function extractHQ(text, passages) {
  const combined = (text + ' ' + passages.join(' '));
  const m1 = combined.match(/(?:headquartered|based|hq|registered office|corporate office)\s+(?:in|at)\s+([A-Za-z0-9\s,.-]+?(?:Mumbai|Bengaluru|Bangalore|Armonk|New York|Delhi|Pune|Hyderabad|Chennai|California|India|USA|United States))/i);
  if (m1 && m1[1]) {
    const loc = cleanTavilyText(m1[1]).replace(/^(in|at)\s+/i, '').replace(/\s*(and|operating|with|is|reachable|\().*$/i, '').trim();
    if (loc.length > 2 && loc.length < 80) return loc;
  }
  const m2 = combined.match(/headquartered\s+(?:at|in)\s+([^;.,\n]+(?:,\s*[^;.,\n]+){0,2})/i);
  if (m2 && m2[1]) {
    const loc = cleanTavilyText(m2[1]).replace(/\s*(and|operating|with|is|reachable|\().*$/i, '').trim();
    if (loc.length > 2 && loc.length < 80) return loc;
  }
  return 'Not specified in live search';
}

function extractOverview(name, answer, passages) {
  if (answer) {
    const firstSent = answer.split(/[;.]/)[0].replace(/\s*\([^)]*\)/g, ' ');
    return truncateBullet(firstSent, 160);
  }
  for (const p of passages) {
    if (new RegExp(`${name}.{0,30}(is|provides|offers)`, 'i').test(p)) {
      return truncateBullet(p, 160);
    }
  }
  return `${name} is an active enterprise organization.`;
}

function extractLeadership(text, passages) {
  const items = [];
  const seen = new Set();
  const combined = (text + ' ' + passages.join(' '));

  if (text) {
    const m = text.match(/(?:led by|headed by|leadership (?:team )?is headed by|under the leadership of)\s+([^;.,\n]+(?:,\s*[^;.,\n]+){0,2})/i);
    if (m && m[1]) {
      const clean = truncateBullet(m[1].replace(/\s*(who|which|and)\s*$/i, ''), 80);
      if (clean.length > 4) {
        items.push(clean);
        seen.add(clean.toLowerCase().slice(0, 15));
      }
    }
  }

  const leadMatches = combined.matchAll(/(?:Chairman|CEO|Managing Director|MD|President|Founder|Chief Executive Officer)\s*[:-]?\s*([A-Z][a-zA-Z.\s]{2,25})/gi);
  for (const match of leadMatches) {
    const full = truncateBullet(match[0].replace(/\s+(and|who|with|is)$/i, ''), 50);
    const key = full.toLowerCase().slice(0, 15);
    if (full.length > 6 && !seen.has(key) && !/company|details|overview|snapshot|report|history|public|management|services|products/i.test(full)) {
      seen.add(key);
      items.push(full);
      if (items.length >= 2) break;
    }
  }

  return items.slice(0, 2);
}

function extractServicesProducts(name, text, passages) {
  const items = [];
  const seen = new Set();

  if (text) {
    const servMatch = text.match(/(?:portfolio of|suite of|offers|delivers|products like|products such as)\s+([^;.\n]+)/i);
    if (servMatch && servMatch[1]) {
      const parts = servMatch[1].split(/,\s*(?:with proprietary|including|such as|and)\s*/i);
      for (const pt of parts) {
        const item = truncateBullet(pt, 90);
        const key = item.toLowerCase().slice(0, 20);
        if (item.length > 8 && !seen.has(key) && !item.toLowerCase().includes(name.toLowerCase() + ' is') && !/view|overview|snapshot/i.test(item)) {
          seen.add(key);
          items.push(item);
          if (items.length >= 3) break;
        }
      }
    }
  }

  if (items.length < 2) {
    for (const p of passages) {
      if (/\b(services|products|solutions|offerings|consulting|platforms|cloud|loans|lending|software)\b/i.test(p)) {
        const item = truncateBullet(p, 90);
        const key = item.toLowerCase().slice(0, 20);
        if (item.length > 15 && !seen.has(key) && !item.toLowerCase().includes(name.toLowerCase() + ' is') && !/view|snapshot|overview|report/i.test(item)) {
          seen.add(key);
          items.push(item);
          if (items.length >= 3) break;
        }
      }
    }
  }

  return items.slice(0, 3);
}

function extractLocationsScale(text, passages) {
  const items = [];
  const combined = (text + ' ' + passages.join(' '));

  const m1 = combined.match(/(?:operates in|presence in|locations across|footprint of)\s+([0-9]+\s+(?:locations|countries|cities)[^;.,\n]*)/i);
  if (m1 && m1[0]) {
    items.push(truncateBullet(m1[0], 90));
  }

  const m2 = combined.match(/(?:workforce of|employs (?:roughly|over)?)\s+([0-9,]+\s+(?:employees|people|professionals)[^;.,\n]*)/i);
  if (m2 && m2[0]) {
    items.push(truncateBullet(m2[0], 90));
  }

  return items.slice(0, 2);
}

function extractBusinessInfo(text, passages) {
  const items = [];
  const combined = (text + ' ' + passages.join(' '));

  const revMatch = combined.match(/(?:reported revenue of|revenues of|market capitali[sz]ation (?:of|near|around))\s+([^;.,\n]+)/i);
  if (revMatch && revMatch[0]) {
    items.push(truncateBullet(revMatch[0], 90));
  }

  const listMatch = combined.match(/(?:traded as|publicly traded on|listed on)\s+([^;.,\n]+)/i);
  if (listMatch && listMatch[0]) {
    items.push(truncateBullet(listMatch[0], 80));
  }

  if (items.length === 0) {
    const fMatch = combined.match(/(?:founded in [0-9]{4}|trusted .* since [0-9]{4})/i);
    if (fMatch) items.push(truncateBullet(fMatch[0], 60));
  }

  return items.slice(0, 2);
}

function extractRecentDevelopments(text, passages) {
  const items = [];
  if (text) {
    const recMatch = text.match(/(?:recent developments (?:highlight|focus on)|recently (?:oversaw|launched|announced|expanded)|recent initiatives [^;.\n]+)\s+([^;.\n]+)/i);
    if (recMatch && recMatch[0]) {
      items.push(truncateBullet(recMatch[0], 100));
    }
  }

  for (const p of passages) {
    if (items.length >= 2) break;
    if (/\b(recently launched|announced|partnered with|acquired|expanded|new business units|new platform)\b/i.test(p)) {
      const item = truncateBullet(p, 90);
      if (item.length > 20 && !items.includes(item) && !/overview|snapshot|view/i.test(item)) {
        items.push(item);
      }
    }
  }

  return items.slice(0, 2);
}

async function fetchLiveCompanySummary(companyName) {
  const query = cleanSearchText(companyName).trim();
  if (!query) return '';

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log('[TAVILY] missing_api_key');
    return '';
  }

  const url = 'https://api.tavily.com/search';
  const searchQuery = `${query} company overview headquarters website products services leadership locations business recent developments`;
  console.log('[TAVILY] searchQuery=' + searchQuery);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; LoanAssistant/1.0)'
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: searchQuery,
        search_depth: 'advanced',
        include_answer: 'advanced',
        include_raw_content: false,
        max_results: 10
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.log('[TAVILY] status=' + response.status + ' ok=' + response.ok + ' body_len=' + text.length);
      return '';
    }

    const data = await response.json();
    const summary = buildCompanyProfileFromTavilyData(query, data);
    console.log('[TAVILY] summary_len=' + (summary || '').length);
    return summary;
  } catch (error) {
    console.error('[TAVILY] error=' + (error && error.message ? error.message : error));
    return '';
  }
}

function buildCompanyProfileFromTavilyData(companyName, tavilyData) {
  const name = String(companyName || '').trim();
  if (!name) return '';

  const { answer, results, relevantPassages } = filterRelevantPassages(name, tavilyData);
  const allText = relevantPassages.join(' ');

  // 1. Overview
  const overview = extractOverview(name, answer, relevantPassages);

  // 2. Industry
  const industry = detectIndustry(allText, name);

  // 3. Website
  const website = extractWebsite(name, results, answer, relevantPassages) || 'Not specified in live search';

  // 4. Headquarters
  const hq = extractHQ(answer, relevantPassages);

  // 5. Services & Products (2-3 concise bullets)
  const services = extractServicesProducts(name, answer, relevantPassages);

  // 6. Leadership (1-2 concise bullets)
  const leadership = extractLeadership(answer, relevantPassages);

  // 7. Locations & Scale (1-2 concise bullets)
  const locations = extractLocationsScale(answer, relevantPassages);

  // 8. Business Information (1-2 concise bullets)
  const businessInfo = extractBusinessInfo(answer, relevantPassages);

  // 9. Recent Developments (1-2 concise bullets)
  const recentDevelopments = extractRecentDevelopments(answer, relevantPassages);

  // 10. Sources (2-3 links max)
  const sources = [];
  const seenUrls = new Set();
  results.forEach(r => {
    if (r.url && /^https?:\/\//i.test(r.url) && !seenUrls.has(r.url)) {
      seenUrls.add(r.url);
      sources.push(r.url);
    }
  });

  const profile = {
    name,
    industry,
    overview,
    website,
    headquarters: hq,
    services,
    leadership,
    locations,
    businessInfo,
    recentDevelopments,
    sources: sources.slice(0, 3)
  };

  return formatCompanyProfile(profile);
}

function formatCompanyProfile(profile) {
  if (!profile) return '';

  const lines = [];
  lines.push(`🏢 COMPANY PROFILE: ${profile.name.toUpperCase()}`);
  lines.push(`• Industry: ${profile.industry}`);
  lines.push(`• Headquarters: ${profile.headquarters}`);
  lines.push(`• Website: ${profile.website}`);
  lines.push('');

  lines.push(`📌 Overview:`);
  lines.push(`- ${profile.overview}`);
  lines.push('');

  lines.push(`💼 Services & Products:`);
  if (profile.services && profile.services.length > 0) {
    profile.services.forEach(s => lines.push(`- ${s}`));
  } else {
    lines.push(`- Not specifically detailed in live search.`);
  }
  lines.push('');

  lines.push(`👥 Leadership:`);
  if (profile.leadership && profile.leadership.length > 0) {
    profile.leadership.forEach(l => lines.push(`- ${l}`));
  } else {
    lines.push(`- Not specifically detailed in live search.`);
  }
  lines.push('');

  lines.push(`📍 Locations & Scale:`);
  if (profile.locations && profile.locations.length > 0) {
    profile.locations.forEach(loc => lines.push(`- ${loc}`));
  } else {
    lines.push(`- Not specifically detailed in live search.`);
  }
  lines.push('');

  lines.push(`📊 Business Information:`);
  if (profile.businessInfo && profile.businessInfo.length > 0) {
    profile.businessInfo.forEach(b => lines.push(`- ${b}`));
  } else {
    lines.push(`- Not specifically detailed in live search.`);
  }
  lines.push('');

  lines.push(`🚀 Recent Developments:`);
  if (profile.recentDevelopments && profile.recentDevelopments.length > 0) {
    profile.recentDevelopments.forEach(r => lines.push(`- ${r}`));
  } else {
    lines.push(`- Not specifically detailed in live search.`);
  }
  lines.push('');

  if (profile.sources && profile.sources.length > 0) {
    lines.push(`🔗 Sources:`);
    profile.sources.forEach(src => lines.push(`- ${src}`));
  }

  return lines.join('\n');
}
module.exports = {
  fetchLiveCompanySummary
};