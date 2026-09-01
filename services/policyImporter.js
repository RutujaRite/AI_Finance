const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const xlsx = require('xlsx');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');
const { parse: parseCsvSync } = require('csv-parse/sync');

// Known bank metadata and canonical names
const BANK_CATALOG = {
  'adityabirla': { name: 'Aditya Birla Finance', code: 'ABFL' },
  'axis bank': { name: 'Axis Bank', code: 'AXIS' },
  'axis finance': { name: 'Axis Finance', code: 'AFL' },
  'bajaj finserv': { name: 'Bajaj Finserv', code: 'BAJAJ_FINSERV' },
  'bajaj markets': { name: 'Bajaj Markets', code: 'BAJAJ_MARKETS' },
  'bandhan bank': { name: 'Bandhan Bank', code: 'BANDHAN' },
  'chola': { name: 'Cholamandalam Investment & Finance', code: 'CHOLA' },
  'fibe': { name: 'Fibe (EarlySalary)', code: 'FIBE' },
  'finnable': { name: 'Finnable Credit', code: 'FINNABLE' },
  'hdfc': { name: 'HDFC Bank', code: 'HDFC' },
  'home loan': { name: 'Home Loan Services', code: 'HOME_LOAN' },
  'icici': { name: 'ICICI Bank', code: 'ICICI' },
  'idfc': { name: 'IDFC FIRST Bank', code: 'IDFC' },
  'indusind': { name: 'IndusInd Bank', code: 'INDUSIND' },
  'kotak': { name: 'Kotak Mahindra Bank', code: 'KOTAK' },
  'l& t finance': { name: 'L&T Finance', code: 'LTF' },
  'l&t finance': { name: 'L&T Finance', code: 'LTF' },
  'piramal': { name: 'Piramal Capital & Housing Finance', code: 'PIRAMAL' },
  'poonawalla': { name: 'Poonawalla Fincorp', code: 'POONAWALLA' },
  'sbm bank': { name: 'SBM Bank India', code: 'SBM' },
  'smfg': { name: 'SMFG India Credit (Fullerton)', code: 'SMFG' },
  'tata capital': { name: 'Tata Capital', code: 'TATA_CAPITAL' },
  'utkarsh small finance bank': { name: 'Utkarsh Small Finance Bank', code: 'UTKARSH' },
  'yes bank': { name: 'Yes Bank', code: 'YES_BANK' },
};

function detectBankFromPath(folderName, fileName) {
  const normFolder = (folderName || '').toLowerCase().trim();
  const normFile = (fileName || '').toLowerCase().trim();

  // Direct match in catalog
  if (BANK_CATALOG[normFolder]) {
    return BANK_CATALOG[normFolder];
  }

  // Substring match in catalog
  for (const [key, val] of Object.entries(BANK_CATALOG)) {
    if (normFolder.includes(key) || normFile.includes(key)) {
      return val;
    }
  }

  // Fallback format
  const cleanName = folderName
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const cleanCode = cleanName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return { name: cleanName, code: cleanCode };
}

async function extractTextFromFile(filePath, ext) {
  const normalizedExt = (ext || '').toLowerCase();

  try {
    if (normalizedExt === '.txt') {
      const text = await fs.promises.readFile(filePath, 'utf8');
      const doc = createStructuredDocument('txt');
      doc.rawText = text;
      doc.lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      doc.paragraphs = text.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
      return doc;
    }

    if (normalizedExt === '.csv') {
      return await extractCsvText(filePath);
    }

    if (normalizedExt === '.pdf') {
      return await extractPdfText(filePath);
    }

    if (['.xlsx', '.xls', '.xlsb'].includes(normalizedExt)) {
      return await extractExcelText(filePath);
    }

    if (normalizedExt === '.docx') {
      return await extractDocxText(filePath);
    }

    if (normalizedExt === '.doc') {
      const text = await fs.promises.readFile(filePath, 'utf8');
      const doc = createStructuredDocument('doc');
      doc.rawText = text;
      doc.paragraphs = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      return doc;
    }

    if (['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'].includes(normalizedExt)) {
      return await extractImageText(filePath);
    }

    return null;
  } catch (err) {
    console.warn(`Failed to extract text from ${filePath}:`, err.message);
    return null;
  }
}

async function extractPdfText(filePath) {
  try {
    const imported = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfjsLib = imported.default || imported;
    const data = new Uint8Array(await fs.promises.readFile(filePath));
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const structured = createStructuredDocument('pdf');
    const allTextParts = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageData = { paragraphs: [], tables: [], raw: '' };

      const lines = new Map();
      for (const item of content.items) {
        const y = Math.round(item.transform[5] * 10) / 10;
        if (!lines.has(y)) lines.set(y, []);
        lines.get(y).push(item.str);
      }

      const sortedLines = Array.from(lines.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, words]) => words.join(' '));

      const pageText = sortedLines.join('\n');
      pageData.raw = pageText;
      allTextParts.push(pageText);

      const paragraphs = pageText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      if (paragraphs.length > 0) {
        pageData.paragraphs = paragraphs;
      } else if (sortedLines.length > 0) {
        pageData.paragraphs = sortedLines;
      }

      structured.pages.push(pageData);
    }

    structured.rawText = allTextParts.join('\n\n').trim();
    return structured;
  } catch (pdfjsErr) {
    console.warn(`PDF extraction failed for ${filePath}:`, pdfjsErr.message);
    return null;
  }
}

async function extractExcelText(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const workbook = xlsx.read(buffer, { type: 'buffer', cellStyles: false, cellFormula: false, cellDates: true });
  const structured = createStructuredDocument('excel');
  const allRows = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet['!ref']) continue;

    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length === 0) continue;

    const sheetData = {
      name: sheetName,
      rows: rows.map(row => row.map(cell => String(cell ?? '').trim())),
      cells: [],
    };

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const val = String(rows[r][c] ?? '').trim();
        if (val) {
          sheetData.cells.push({ row: r + 1, col: c + 1, value: val });
        }
      }
    }

    structured.sheets.push(sheetData);
    allRows.push(...sheetData.rows);
  }

  structured.lines = allRows.map(row => row.join(' | ')).filter(Boolean);
  structured.rawText = structured.lines.join('\n');
  return structured;
}

async function extractCsvText(filePath) {
  const content = await fs.promises.readFile(filePath, 'utf8');
  const structured = createStructuredDocument('csv');
  structured.rawText = content;
  structured.lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  try {
    const records = parseCsvSync(content, { columns: true, skip_empty_lines: true, trim: true });
    if (records.length > 0) {
      structured.rows = records.map(record => {
        const row = {};
        for (const [k, v] of Object.entries(record)) {
          row[k] = v;
        }
        return row;
      });
      structured.paragraphs = records.map(record =>
        Object.entries(record).map(([k, v]) => `${k}: ${v}`).join(' | ')
      );
    }
  } catch (csvErr) {
    console.warn(`CSV parse failed for ${filePath}:`, csvErr.message);
  }

  return structured;
}

async function extractDocxText(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const structured = createStructuredDocument('docx');

  try {
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;

    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const rows = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
        const cells = [];
        const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
        }
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) structured.tables.push(rows);
    }

    const textWithoutTables = html.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '\n\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    structured.paragraphs = textWithoutTables.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    structured.rawText = structured.paragraphs.join('\n');
    if (structured.tables.length > 0) {
      structured.rawText += '\n\n' + structured.tables.map((t, i) => `--- Table ${i + 1} ---\n${t.map(r => r.join(' | ')).join('\n')}`).join('\n\n');
    }
    return structured;
  } catch (htmlErr) {
    console.warn(`DOCX HTML extraction failed for ${filePath}:`, htmlErr.message);
  }

  try {
    const result = await mammoth.extractRawText({ buffer });
    structured.rawText = result.value || '';
    structured.paragraphs = structured.rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return structured;
  } catch (rawErr) {
    console.warn(`DOCX raw text extraction failed for ${filePath}:`, rawErr.message);
  }

  return structured;
}

async function extractImageText(filePath) {
  try {
    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(filePath);
      const text = (data.text || '').trim();
      const structured = createStructuredDocument('image');
      structured.rawText = text;
      structured.lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      structured.paragraphs = text.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
      structured.metadata = { ocrConfidence: data.confidence };
      return structured;
    } finally {
      await worker.terminate();
    }
  } catch (ocrErr) {
    console.warn(`OCR failed for ${filePath}:`, ocrErr.message);
    return null;
  }
}

function parseAmountValue(str) {
  if (!str) return null;
  const clean = String(str).replace(/[₹,\s]/gi, '').toLowerCase();
  
  if (clean.includes('cr') || clean.includes('crore')) {
    const num = parseFloat(clean.replace(/(cr|crore|crores)/g, ''));
    return isNaN(num) ? null : num * 10000000;
  }
  if (clean.includes('lac') || clean.includes('lakh') || clean.includes('l')) {
    const num = parseFloat(clean.replace(/(lac|lacs|lakh|lakhs|l)/g, ''));
    return isNaN(num) ? null : num * 100000;
  }
  if (clean.includes('k') || clean.includes('thousand')) {
    const num = parseFloat(clean.replace(/(k|thousand)/g, ''));
    return isNaN(num) ? null : num * 1000;
  }
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function createStructuredDocument(format, sourceType) {
  return {
    format,
    sourceType: sourceType || 'Other',
    rawText: '',
    paragraphs: [],
    lines: [],
    tables: [],
    sheets: [],
    pages: [],
    cells: [],
    metadata: {},
  };
}

function structuredToText(doc) {
  if (!doc || typeof doc !== 'object') return doc || '';
  const parts = [];
  if (doc.rawText) parts.push(doc.rawText);
  if (doc.paragraphs && doc.paragraphs.length) parts.push(doc.paragraphs.join('\n'));
  if (doc.lines && doc.lines.length) parts.push(doc.lines.join('\n'));
  if (doc.tables && doc.tables.length) {
    doc.tables.forEach((table, i) => {
      parts.push(`--- Table ${i + 1} ---`);
      table.forEach(row => parts.push(row.join(' | ')));
    });
  }
  if (doc.sheets && doc.sheets.length) {
    doc.sheets.forEach((sheet, i) => {
      parts.push(`--- Sheet: ${sheet.name || i + 1} ---`);
      if (sheet.rows && sheet.rows.length) {
        sheet.rows.forEach(row => parts.push(row.join(' | ')));
      }
    });
  }
  if (doc.pages && doc.pages.length) {
    doc.pages.forEach((page, i) => {
      parts.push(`--- Page ${i + 1} ---`);
      if (page.paragraphs && page.paragraphs.length) parts.push(page.paragraphs.join('\n'));
      if (page.tables && page.tables.length) {
        page.tables.forEach((table, ti) => {
          parts.push(`  Table ${ti + 1}:`);
          table.forEach(row => parts.push('  ' + row.join(' | ')));
        });
      }
    });
  }
  return parts.join('\n').trim();
}

function getTextFromStructured(doc) {
  if (!doc || typeof doc !== 'object') return doc || '';
  return doc.rawText || structuredToText(doc) || '';
}

function extractLoanType(text, fileName, folderName) {
  const combined = (text + ' ' + fileName + ' ' + folderName).toLowerCase();
  if (combined.includes('home loan') || combined.includes('housing')) return 'Home';
  if (combined.includes('auto loan') || combined.includes('car loan') || combined.includes('vehicle')) return 'Auto';
  if (combined.includes('education') || combined.includes('student')) return 'Education';
  if (combined.includes('business loan') || combined.includes('bl policy') || combined.includes('doctor')) return 'Business';
  return 'Personal';
}

function extractRulesFromText(text, fileName, folderName, explicitCategory) {
  const doc = typeof text === 'object' && text !== null ? text : null;
  const plainText = doc ? getTextFromStructured(doc) : (text || '');
  if (!plainText) return null;

  const loanType = extractLoanType(plainText, fileName, folderName);
  const rules = {
    loan_type: loanType,
    category: explicitCategory || null,
    min_cibil: null,
    max_cibil: null,
    min_salary: null,
    max_salary: null,
    employment_type: null,
    min_age: null,
    max_age: null,
    min_loan_amount: null,
    max_loan_amount: null,
    min_tenure_months: null,
    max_tenure_months: null,
    foir_percent: null,
    roi: null,
    roi_min: null,
    roi_max: null,
    location_coverage: null,
  };

  const normalizedText = plainText.replace(/\s+/g, ' ').trim();

  // 0. Category / Condition detection
  if (!rules.category) {
    const lowerText = normalizedText.toLowerCase();
    if (lowerText.includes('-1 cibil') || lowerText.includes('minus one cibil') || lowerText.includes('owned house')) {
      rules.category = '-1 CIBIL/Owned House';
    } else if (lowerText.includes('banking surrogate') || lowerText.includes('banking & repayment surrogate')) {
      rules.category = 'Banking Surrogate';
    } else if (lowerText.includes('auto loan surrogate')) {
      rules.category = 'Auto Loan Surrogate';
    } else if (lowerText.includes('home loan surrogate')) {
      rules.category = 'Home Loan Surrogate';
    } else if (lowerText.includes('bt surrogate') || lowerText.includes('bt program') || lowerText.includes('balance transfer surrogate')) {
      rules.category = 'BT Surrogate';
    } else if (lowerText.includes('normal cases') || lowerText.includes('normal case')) {
      rules.category = 'Normal';
    } else if (lowerText.includes('salaried elite') || lowerText.includes('salary emerging')) {
      rules.category = 'Normal';
    } else {
      const catMatch = normalizedText.match(/(?:cat(?:egory)?\s*[a-d]|company\s*categor|pricing\s*categor|eligible\s*compan(?:y|ies)?\s*(?:list|type|category)?)\s*[:\-]?\s*([^\n,;]{1,100})/i);
      if (catMatch) {
        rules.category = catMatch[1].trim().slice(0, 100);
      } else {
        const catOnly = normalizedText.match(/\b(?:CAT\s*[A-D]|Category\s*[A-D])\b/i);
        if (catOnly) {
          rules.category = catOnly[0].trim();
        }
      }
    }
  }

  // 1. CIBIL score - patterns: "700 compulsory", ">725", "725+", "700 to 750", "720 above"
  const cibilCompulsoryMatch = normalizedText.match(/cibil\s*(\d{3})\s*compulsory/i);
  if (cibilCompulsoryMatch) {
    rules.min_cibil = parseInt(cibilCompulsoryMatch[1], 10);
  } else {
    const cibilAboveMatch = normalizedText.match(/cibil\s*(?:score\s*)?(?:require[sd]?\s*)?[:\-]?\s*(\d{3})\s+above/i);
    if (cibilAboveMatch) {
      rules.min_cibil = parseInt(cibilAboveMatch[1], 10);
    } else {
      const cibilPlusMatch = normalizedText.match(/cibil\s*(?:score\s*)?(?:require[sd]?\s*)?[:\-]?\s*[>]\s*(\d{3})/i);
      if (cibilPlusMatch) {
        rules.min_cibil = parseInt(cibilPlusMatch[1], 10);
      } else {
        const cibilRangeMatch = normalizedText.match(/cibil\s*(?:score\s*)?(?:require[sd]?\s*)?[:\-]?\s*(\d{3})\s*(?:to|-|–|\+)\s*(\d{3})?/i);
        if (cibilRangeMatch) {
          rules.min_cibil = parseInt(cibilRangeMatch[1], 10);
          if (cibilRangeMatch[2]) rules.max_cibil = parseInt(cibilRangeMatch[2], 10);
        } else {
          const cibilPlainMatch = normalizedText.match(/(?:cibil|cibil score)\s*(?:of|is|require[sd]?)?\s*[:\-]?\s*(\d{3})\s*\+/i);
          if (cibilPlainMatch) {
            rules.min_cibil = parseInt(cibilPlainMatch[1], 10);
          }
        }
      }
    }
  }

  // 2. Salary / Income - must NOT match ROI percentages like 14% or 22%
  const salaryRangeMatch = normalizedText.match(/(?:salary|nmi|net salary|income|nth)\s*(?:range|required|norms)?\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)\s*(?:to|-|–)\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i);
  if (salaryRangeMatch && !normalizedText.substring(salaryRangeMatch.index, salaryRangeMatch.index + salaryRangeMatch[0].length).includes('%')) {
    const afterMatch = normalizedText.substring(salaryRangeMatch.index + salaryRangeMatch[0].length, salaryRangeMatch.index + salaryRangeMatch[0].length + 5);
    if (!/^\d/.test(afterMatch)) {
      rules.min_salary = parseAmountValue(salaryRangeMatch[1]);
      rules.max_salary = parseAmountValue(salaryRangeMatch[2]);
    }
  } else {
    const minSalaryMatch = normalizedText.match(/(?:min(?:imum)?\s*(?:net\s*)?salary|nmi|minimum income|salary|nth)\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i);
    if (minSalaryMatch && !normalizedText.substring(minSalaryMatch.index, minSalaryMatch.index + minSalaryMatch[0].length).includes('%')) {
      const afterMatch = normalizedText.substring(minSalaryMatch.index + minSalaryMatch[0].length, minSalaryMatch.index + minSalaryMatch[0].length + 5);
      if (!/^\d/.test(afterMatch)) {
        const val = parseAmountValue(minSalaryMatch[1]);
        if (val !== null && val < 1000000) {
          rules.min_salary = val;
        }
      }
    }
  }
  const salaryTierMatch = normalizedText.match(/(?:salary|tier)\s+(?:elite|emerging|tier\s*\d|standard|premium)\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i);
  if (salaryTierMatch && !normalizedText.substring(salaryTierMatch.index, salaryTierMatch.index + salaryTierMatch[0].length).includes('%')) {
    const afterMatch = normalizedText.substring(salaryTierMatch.index + salaryTierMatch[0].length, salaryTierMatch.index + salaryTierMatch[0].length + 5);
    if (!/^\d/.test(afterMatch)) {
      const val = parseAmountValue(salaryTierMatch[1]);
      if (val !== null) {
        if (rules.min_salary === null || val < rules.min_salary) rules.min_salary = val;
       if (rules.max_salary === null || val > rules.max_salary) rules.max_salary = val;
      }
    }
  }
  const salaryAboveMatch = normalizedText.match(/(?:salary|nmi|income)\s+(?:above|over)\s+(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i);
  if (salaryAboveMatch && !normalizedText.substring(salaryAboveMatch.index, salaryAboveMatch.index + salaryAboveMatch[0].length).includes('%')) {
    const val = parseAmountValue(salaryAboveMatch[1]);
    if (val !== null && (rules.min_salary === null || val < rules.min_salary)) {
      rules.min_salary = val;
    }
  }
  const salaryBelowMatch = normalizedText.match(/(?:salary|nmi|income)\s+(?:below|under)\s+(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i);
  if (salaryBelowMatch && !normalizedText.substring(salaryBelowMatch.index, salaryBelowMatch.index + salaryBelowMatch[0].length).includes('%')) {
    const val = parseAmountValue(salaryBelowMatch[1]);
    if (val !== null && (rules.max_salary === null || val > rules.max_salary)) {
      rules.max_salary = val;
    }
  }

  // 3. Loan Amount - ranges and caps in lac/lakh/cr
  const amountRangeMatch = normalizedText.match(/(?:loan\s*amount|amount|funding|max\s*fund)\s*(?:range|cap)?\s*[:\-]?\s*(?:min\s*)?(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)\s*(?:to|-|–)\s*(?:max\s*)?(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)/i);
  if (amountRangeMatch) {
    rules.min_loan_amount = parseAmountValue(amountRangeMatch[1]);
    rules.max_loan_amount = parseAmountValue(amountRangeMatch[2]);
  } else {
    const maxAmountMatch = normalizedText.match(/(?:max(?:imum)?\s*(?:loan\s*)?(?:amount|cap|funding)|loan max|upto\s*(?:funding)?|max\s*fund)\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)/i);
    if (maxAmountMatch) {
      rules.max_loan_amount = parseAmountValue(maxAmountMatch[1]);
    }
    const minAmountMatch = normalizedText.match(/(?:min(?:imum)?\s*(?:loan\s*)?(?:amount|cap|funding)|loan min|minimum\s*loan\s*amount)\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)/i);
    if (minAmountMatch) {
      rules.min_loan_amount = parseAmountValue(minAmountMatch[1]);
    }
    const loanAboveMatch = normalizedText.match(/(?:loan\s*amount|amount)\s+(?:above|over|minimum|min)\s+(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)/i);
    if (loanAboveMatch) {
      const val = parseAmountValue(loanAboveMatch[1]);
      if (val !== null && (rules.min_loan_amount === null || val < rules.min_loan_amount)) {
        rules.min_loan_amount = val;
      }
    }
  }

  // 4. Age norms - "Age 23 - 60 years" or "Age norms- 23 - 60 years"
  const ageRangeMatch = normalizedText.match(/(?:age\s*(?:norms|limit|criteria)?)\s*[:\-]?\s*(?:min\s*)?(\d{2})\s*(?:to|-|–)\s*(?:max\s*)?(\d{2})\s*(?:years?|yrs?)?/i);
  if (ageRangeMatch) {
    rules.min_age = parseInt(ageRangeMatch[1], 10);
    rules.max_age = parseInt(ageRangeMatch[2], 10);
  } else {
    const ageOnlyMatch = normalizedText.match(/age\s*[:\-]?\s*(\d{2})\s*(?:to|-|–)\s*(\d{2})\s*(?:years?|yrs?)?/i);
    if (ageOnlyMatch) {
      rules.min_age = parseInt(ageOnlyMatch[1], 10);
      rules.max_age = parseInt(ageOnlyMatch[2], 10);
    } else {
      const minAgeMatch = normalizedText.match(/min(?:imum)?\.?\s*age\s*[:\-]?\s*(\d{2})/i);
      if (minAgeMatch) rules.min_age = parseInt(minAgeMatch[1], 10);
      const maxAgeMatch = normalizedText.match(/max(?:imum)?\.?\s*(?:below\s*)?age\s*[:\-]?\s*(\d{2})/i);
      if (maxAgeMatch) rules.max_age = parseInt(maxAgeMatch[1], 10);
    }
  }

  // 4b. Tenure / Tenor in months or years - prefer range matches over single-value matches
  const tenureYearRange = normalizedText.match(/(?:tenure|tenor)\s*[:\-]?\s*(?:min\s*)?(\d+)\s*(?:years?|yrs?)\s*(?:to|-|–)\s*(?:max\s*)?(\d+)\s*(?:years?|yrs?)/i);
  if (tenureYearRange) {
    rules.min_tenure_months = parseInt(tenureYearRange[1], 10) * 12;
    rules.max_tenure_months = parseInt(tenureYearRange[2], 10) * 12;
  } else {
    const tenureMonthRange = normalizedText.match(/(?:tenure|tenor)\s*[:\-]?\s*(?:min\s*)?(\d+)\s*(?:months?|m)\s*(?:to|-|–)\s*(?:max\s*)?(\d+)\s*(?:months?|m)/i);
    if (tenureMonthRange) {
      rules.min_tenure_months = parseInt(tenureMonthRange[1], 10);
      rules.max_tenure_months = parseInt(tenureMonthRange[2], 10);
    } else {
      const leadingMonthsMatch = normalizedText.match(/^(\d+)\s*months?\s+(?:salary|loan|tenure|tenor)/i);
      if (leadingMonthsMatch) {
        rules.min_tenure_months = parseInt(leadingMonthsMatch[1], 10);
      }
      const tenureYearSingle = normalizedText.match(/(?:tenure|tenor)\s*[:\-]?\s*(?:min\s*)?(\d+)\s*(?:years?|yrs?)/i);
      if (tenureYearSingle) {
        rules.min_tenure_months = parseInt(tenureYearSingle[1], 10) * 12;
      }
      const tenureMonthSingle = normalizedText.match(/(?:tenure|tenor)\s*[:\-]?\s*(?:min\s*)?(\d+)\s*(?:months?|m)/i);
      if (tenureMonthSingle) {
        const val = parseInt(tenureMonthSingle[1], 10);
        rules.min_tenure_months = rules.min_tenure_months === null ? val : Math.min(rules.min_tenure_months, val);
      }
      const tenureMaxMatch = normalizedText.match(/(?:max(?:imum)?\s*(?:tenure|tenor))\s*[:\-]?\s*(\d+)\s*(?:months?|m|years?|yrs?)/i);
      if (tenureMaxMatch) {
        const val = parseInt(tenureMaxMatch[1], 10);
        rules.max_tenure_months = val < 10 ? val * 12 : val;
      }
      const tenureMinMatch = normalizedText.match(/(?:min(?:imum)?\s*(?:tenure|tenor))\s*[:\-]?\s*(\d+)\s*(?:months?|m|years?|yrs?)/i);
      if (tenureMinMatch) {
        const val = parseInt(tenureMinMatch[1], 10);
        rules.min_tenure_months = rules.min_tenure_months === null ? val : Math.min(rules.min_tenure_months, val);
      }
    }
  }

  // 5. Max FOIR / DBR %
  const foirMatch = normalizedText.match(/(?:foir|dbr)\s*(?:cal|norms|max|up to|percentage)?\s*[:\-]?\s*(?:up to\s*)?(\d+(?:\.\d+)?)\s*%/i);
  if (foirMatch) {
    rules.foir_percent = parseFloat(foirMatch[1]);
  } else {
    const foirRangeMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*%\s*(?:foir|dbr)/i);
    if (foirRangeMatch) {
      rules.foir_percent = parseFloat(foirRangeMatch[2]);
    }
  }

  // 6. ROI / Rate of interest - must NOT match salary amounts
  const roiRangeMatch = normalizedText.match(/(?:rate|roi|interest\s*rate)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%(?:\s*(?:to|-|–|and)\s*)(\d+(?:\.\d+)?)\s*%/i);
  if (roiRangeMatch) {
    rules.roi_min = parseFloat(roiRangeMatch[1]);
    rules.roi_max = parseFloat(roiRangeMatch[2]);
    rules.roi = rules.roi_min + '% - ' + rules.roi_max + '%';
  } else {
    const roiSingleMatch = normalizedText.match(/(?:rate|roi|interest\s*rate)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
    if (roiSingleMatch) {
      rules.roi = parseFloat(roiSingleMatch[1]) + '%';
    }
  }

  // 7. Employment Type
  const hasSalaried = /salaried|company\s*3\s*years|pvt\s*company|ltd\s*company|govt|government|school|college|hospital|bpo/i.test(normalizedText);
  const hasSelfEmployed = /self-employed|proprietorship|partnership|llp|business/i.test(normalizedText);
  if (hasSalaried && !hasSelfEmployed) {
    rules.employment_type = 'Salaried';
  } else if (hasSelfEmployed && !hasSalaried) {
    rules.employment_type = 'Self-Employed';
  } else if (hasSalaried && hasSelfEmployed) {
    rules.employment_type = 'Any';
  }

  // 8. Location / Coverage - capture conditions even without city names
  const locationConditions = [];
  if (/slum|negative\s*area/i.test(normalizedText)) {
    locationConditions.push('No SLUM/Negative area');
  }
  if (/abfl\s*location/i.test(normalizedText)) {
    locationConditions.push('ABFL location');
  }
  if (/joint\s*account.*can'?t\s*consider|joint\s*account.*not\s*allowed/i.test(normalizedText)) {
    locationConditions.push('No joint account');
  }
  if (/od\s*account.*can'?t\s*consider|od\s*account.*not\s*allowed/i.test(normalizedText)) {
    locationConditions.push('No OD account');
  }
  const cityListMatch = normalizedText.match(/\b(?:mumbai|delhi|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|surat|jaipur|lucknow|kanpur|nagpur|indore|bhopal|visakhapatnam|vijayawada|coimbatore|madurai|mangalore|mysore|goa|chandigarh|ludhiana|amritsar|jalandhar|patna|ranchi|guwahati|bhubaneswar|raipur|jamshedpur|dehradun|shimla|jammu|srinagar|varanasi|agra|meerut|bareilly|gwalior|jabalpur|noida|ghaziabad|faridabad|gurgaon|kochi|tirupati|cochin)\b/gi);
  if (cityListMatch) {
    const uniqueCities = [...new Set(cityListMatch.map(c => c.toLowerCase()))];
    locationConditions.push('Cities: ' + uniqueCities.slice(0, 20).join(', '));
  }
  if (locationConditions.length > 0) {
    rules.location_coverage = { conditions: locationConditions, raw: normalizedText.substring(0, 500) };
  }

  return rules;
}

const VALIDATION_CONFIG = {
  salary: { min: 1000, max: 10000000 },
  cibil: { min: 300, max: 900 },
  age: { min: 18, max: 70 },
  tenure_months: { min: 1, max: 360 },
  loan_amount: { min: 1, max: 100000000 },
  foir_percent: { min: 0, max: 100 },
  roi_percent: { min: 0, max: 50 },
};

function normalizeAndValidateRules(rules, sourceText) {
  const validationLog = [];
  const normalized = { ...rules };
  const text = (sourceText || '').replace(/\s+/g, ' ').trim();

  const reject = (field, reason) => {
    validationLog.push({
      field,
      reason,
      originalValue: normalized[field],
      sourceSnippet: text.substring(0, 500),
    });
    normalized[field] = null;
  };

  const inRange = (value, min, max) => value !== null && value !== undefined && value >= min && value <= max;

  // Salary validation - reject if value looks like it came from ROI percentage
  if (normalized.min_salary !== null && normalized.min_salary !== undefined) {
    if (normalized.min_salary < VALIDATION_CONFIG.salary.min || normalized.min_salary > VALIDATION_CONFIG.salary.max) {
      reject('min_salary', `Salary ${normalized.min_salary} outside realistic range [${VALIDATION_CONFIG.salary.min}, ${VALIDATION_CONFIG.salary.max}]`);
    } else if (normalized.min_salary < 1000) {
      const nearbyRoi = text.match(/\d+(?:\.\d+)?\s*%/i);
      if (nearbyRoi) {
        const roiVal = parseFloat(nearbyRoi[1]);
        if (Math.abs(roiVal - normalized.min_salary) < 1) {
          reject('min_salary', `Salary ${normalized.min_salary} likely misread from ROI ${roiVal}% in nearby text`);
        }
      }
    }
  }

  if (normalized.max_salary !== null && normalized.max_salary !== undefined) {
    if (normalized.max_salary < VALIDATION_CONFIG.salary.min || normalized.max_salary > VALIDATION_CONFIG.salary.max) {
      reject('max_salary', `Salary ${normalized.max_salary} outside realistic range [${VALIDATION_CONFIG.salary.min}, ${VALIDATION_CONFIG.salary.max}]`);
    }
  }

  // CIBIL validation
  if (normalized.min_cibil !== null && normalized.min_cibil !== undefined) {
    if (!inRange(normalized.min_cibil, VALIDATION_CONFIG.cibil.min, VALIDATION_CONFIG.cibil.max)) {
      reject('min_cibil', `CIBIL ${normalized.min_cibil} outside valid range [${VALIDATION_CONFIG.cibil.min}, ${VALIDATION_CONFIG.cibil.max}]`);
    }
  }

  if (normalized.max_cibil !== null && normalized.max_cibil !== undefined) {
    if (!inRange(normalized.max_cibil, VALIDATION_CONFIG.cibil.min, VALIDATION_CONFIG.cibil.max)) {
      reject('max_cibil', `CIBIL ${normalized.max_cibil} outside valid range [${VALIDATION_CONFIG.cibil.min}, ${VALIDATION_CONFIG.cibil.max}]`);
    }
  }

  // Age validation
  if (normalized.min_age !== null && normalized.min_age !== undefined) {
    if (!inRange(normalized.min_age, VALIDATION_CONFIG.age.min, VALIDATION_CONFIG.age.max)) {
      reject('min_age', `Age ${normalized.min_age} outside realistic range [${VALIDATION_CONFIG.age.min}, ${VALIDATION_CONFIG.age.max}]`);
    }
  }

  if (normalized.max_age !== null && normalized.max_age !== undefined) {
    if (!inRange(normalized.max_age, VALIDATION_CONFIG.age.min, VALIDATION_CONFIG.age.max)) {
      reject('max_age', `Age ${normalized.max_age} outside realistic range [${VALIDATION_CONFIG.age.min}, ${VALIDATION_CONFIG.age.max}]`);
    }
  }

  // Tenure validation (already converted to months)
  if (normalized.min_tenure_months !== null && normalized.min_tenure_months !== undefined) {
    if (!inRange(normalized.min_tenure_months, VALIDATION_CONFIG.tenure_months.min, VALIDATION_CONFIG.tenure_months.max)) {
      reject('min_tenure_months', `Tenure ${normalized.min_tenure_months} months outside realistic range [${VALIDATION_CONFIG.tenure_months.min}, ${VALIDATION_CONFIG.tenure_months.max}]`);
    }
  }

  if (normalized.max_tenure_months !== null && normalized.max_tenure_months !== undefined) {
    if (!inRange(normalized.max_tenure_months, VALIDATION_CONFIG.tenure_months.min, VALIDATION_CONFIG.tenure_months.max)) {
      reject('max_tenure_months', `Tenure ${normalized.max_tenure_months} months outside realistic range [${VALIDATION_CONFIG.tenure_months.min}, ${VALIDATION_CONFIG.tenure_months.max}]`);
    }
  }

  // Loan amount validation (already in absolute INR)
  if (normalized.min_loan_amount !== null && normalized.min_loan_amount !== undefined) {
    if (!inRange(normalized.min_loan_amount, VALIDATION_CONFIG.loan_amount.min, VALIDATION_CONFIG.loan_amount.max)) {
      reject('min_loan_amount', `Loan amount ${normalized.min_loan_amount} outside realistic range [${VALIDATION_CONFIG.loan_amount.min}, ${VALIDATION_CONFIG.loan_amount.max}]`);
    }
  }

  if (normalized.max_loan_amount !== null && normalized.max_loan_amount !== undefined) {
    if (!inRange(normalized.max_loan_amount, VALIDATION_CONFIG.loan_amount.min, VALIDATION_CONFIG.loan_amount.max)) {
      reject('max_loan_amount', `Loan amount ${normalized.max_loan_amount} outside realistic range [${VALIDATION_CONFIG.loan_amount.min}, ${VALIDATION_CONFIG.loan_amount.max}]`);
    }
  }

  // FOIR validation - reject > 100% unless explicitly supported by source
  if (normalized.foir_percent !== null && normalized.foir_percent !== undefined) {
    if (normalized.foir_percent > VALIDATION_CONFIG.foir_percent.max) {
      const explicitHighFoir = text.match(/(?:foir|dbr)\s*(?:up\s*to|upto|max|maximum|allowed)\s*(\d+(?:\.\d+)?)\s*%/i);
      if (explicitHighFoir && parseFloat(explicitHighFoir[1]) >= normalized.foir_percent) {
        // Explicitly supported by source
      } else {
        reject('foir_percent', `FOIR ${normalized.foir_percent}% exceeds realistic max ${VALIDATION_CONFIG.foir_percent.max}% and not explicitly supported by source`);
      }
    }
  }

  // ROI validation
  if (normalized.roi_min !== null && normalized.roi_min !== undefined) {
    if (!inRange(normalized.roi_min, VALIDATION_CONFIG.roi_percent.min, VALIDATION_CONFIG.roi_percent.max)) {
      reject('roi_min', `ROI ${normalized.roi_min}% outside realistic range [${VALIDATION_CONFIG.roi_percent.min}, ${VALIDATION_CONFIG.roi_percent.max}]`);
    }
  }

  if (normalized.roi_max !== null && normalized.roi_max !== undefined) {
    if (!inRange(normalized.roi_max, VALIDATION_CONFIG.roi_percent.min, VALIDATION_CONFIG.roi_percent.max)) {
      reject('roi_max', `ROI ${normalized.roi_max}% outside realistic range [${VALIDATION_CONFIG.roi_percent.min}, ${VALIDATION_CONFIG.roi_percent.max}]`);
    }
  }

  return { rules: normalized, validationLog };
}


async function convertBankDocumentsToText(pool, bankId) {
  const client = await pool.connect();
  try {
    const bankResult = await client.query('SELECT id, name, code FROM banks WHERE id = $1', [bankId]);
    if (bankResult.rowCount === 0) {
      throw new Error('Bank not found');
    }
    const bank = bankResult.rows[0];

    const filesResult = await client.query(
      'SELECT id, file_name, file_path, file_type, extracted_text FROM bank_policy_files WHERE bank_id = $1 ORDER BY id',
      [bankId]
    );

    if (filesResult.rowCount === 0) {
      throw new Error('No policy documents found for this bank');
    }

    const unifiedParts = [];
    const fileStatuses = [];
    let totalSourceFiles = 0;
    let convertedFiles = 0;
    let failedFiles = 0;

    for (const file of filesResult.rows) {
      totalSourceFiles++;
      let text = file.extracted_text;

      if (!text && file.file_path) {
        const ext = path.extname(file.file_name || file.file_path).toLowerCase();
        const extracted = await extractTextFromFile(file.file_path, ext);
        if (extracted && extracted.rawText) {
          text = extracted.rawText;
        }
      }

      if (text && text.trim()) {
        const header = `\n${'='.repeat(80)}\nSOURCE FILE: ${file.file_name}\nTYPE: ${file.file_type || 'unknown'}\n${'='.repeat(80)}\n\n`;
        unifiedParts.push(header + text.trim());
        convertedFiles++;
        fileStatuses.push({ fileId: file.id, fileName: file.file_name, status: 'converted' });
      } else {
        failedFiles++;
        fileStatuses.push({ fileId: file.id, fileName: file.file_name, status: 'failed_or_empty' });
      }
    }

    const unifiedText = unifiedParts.join('\n\n');
    const validation = validateUnifiedText(unifiedText, fileStatuses, convertedFiles, totalSourceFiles);

    return {
      bankId: bank.id,
      bankName: bank.name,
      bankCode: bank.code,
      unifiedText,
      validation,
      stats: {
        totalSourceFiles,
        convertedFiles,
        failedFiles
      }
    };
  } finally {
    client.release();
  }
}

function validateUnifiedText(unifiedText, fileStatuses, convertedFiles, totalSourceFiles) {
  const issues = [];
  const warnings = [];

  if (!unifiedText || unifiedText.trim().length === 0) {
    issues.push('Unified text is empty');
  }

  if (convertedFiles === 0 && totalSourceFiles > 0) {
    issues.push('No files could be converted to text');
  }

  if (convertedFiles < totalSourceFiles) {
    const failed = fileStatuses.filter(s => s.status === 'failed_or_empty');
    warnings.push('Some files could not be converted: ' + failed.map(f => f.fileName).join(', '));
  }

  const hasReasonableLength = unifiedText && unifiedText.length > 100;
  if (!hasReasonableLength && convertedFiles > 0) {
    warnings.push('Converted text is very short, may indicate extraction issues');
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    characterCount: unifiedText ? unifiedText.length : 0,
    convertedFiles,
    totalSourceFiles
  };
}

async function saveUnifiedBankDocument(pool, bankId, unifiedText, validation, stats) {
  const client = await pool.connect();
  try {
    const bankResult = await client.query('SELECT name, code FROM banks WHERE id = $1', [bankId]);
    const bankName = bankResult.rows[0]?.name || 'Unknown';
    const bankCode = bankResult.rows[0]?.code || 'BANK';

    const fileName = `${bankCode}_Unified_Policy_${new Date().toISOString().slice(0, 10)}.txt`;
    const description = `Unified text conversion for ${bankName}. Original files: ${stats.convertedFiles}/${stats.totalSourceFiles}. Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`;
    const syntheticPath = `unified://${bankCode}/${fileName}`;

    const existing = await client.query(
      'SELECT id FROM bank_policy_files WHERE bank_id = $1 AND description = $2',
      [bankId, description]
    );

    if (existing.rowCount > 0) {
      await client.query(
        'UPDATE bank_policy_files SET extracted_text = $1, metadata = $2 WHERE id = $3',
        [
          unifiedText,
          {
            is_unified_text: true,
            validation,
            stats,
            converted_at: new Date().toISOString()
          },
          existing.rows[0].id
        ]
      );
      return existing.rows[0].id;
    }

    const result = await client.query(
      `INSERT INTO bank_policy_files 
       (bank_id, file_name, file_path, file_type, description, extracted_text, metadata, uploaded_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
      [
        bankId,
        fileName,
        syntheticPath,
        '.txt',
        description,
        unifiedText,
        {
          is_unified_text: true,
          validation,
          stats,
          converted_at: new Date().toISOString()
        },
        1
      ]
    );

    return result.rows[0].id;
  } finally {
    client.release();
  }
}



async function getNextVersionLabel(client, bankId, loanType) {
  const res = await client.query(
    `SELECT version FROM policy_versions WHERE bank_id = $1 AND loan_type = $2 ORDER BY id ASC`,
    [bankId, loanType]
  );
  if (res.rowCount === 0) {
    return 'V1';
  }
  let maxV = 0;
  for (const row of res.rows) {
    const vStr = String(row.version || '').trim();
    const vMatch = vStr.match(/^v?(\d+)/i);
    if (vMatch) {
      const num = parseInt(vMatch[1], 10);
      if (num > maxV) maxV = num;
    }
  }
  return `V${maxV + 1}`;
}

async function getOrCreateBank(client, bankInfo) {
  let res = await client.query(
    `SELECT * FROM banks WHERE LOWER(name) = LOWER($1) OR (code IS NOT NULL AND code = $2)`,
    [bankInfo.name, bankInfo.code]
  );
  if (res.rowCount > 0) {
    return res.rows[0];
  }

  res = await client.query(
    `INSERT INTO banks (name, code, is_active) VALUES ($1, $2, true) RETURNING *`,
    [bankInfo.name, bankInfo.code]
  );
  return res.rows[0];
}

async function importPolicyFiles(pool, options = {}) {
  const policyFilesRoot = options.rootDir || path.join(__dirname, '..', 'Policy-files');
  const userId = options.userId || null;
  const dryRun = options.dryRun === true;
  const client = await pool.connect();

  const stats = {
    startedAt: new Date(),
    completedAt: null,
    totalFilesScanned: 0,
    banksDetected: 0,
    banksCreated: 0,
    banksUpdated: 0,
    filesRegistered: 0,
    filesSkipped: 0,
    extractedFiles: 0,
    extractionErrors: 0,
    errors: [],
    banks: []
  };

  try {
    if (!fs.existsSync(policyFilesRoot)) {
      throw new Error(`Policy directory does not exist: ${policyFilesRoot}`);
    }

    function scanDirectory(dirPath) {
      let results = [];
      try {
        const list = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of list) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            results = results.concat(scanDirectory(fullPath));
          } else if (entry.isFile()) {
            results.push({
              fullPath,
              fileName: entry.name,
              ext: path.extname(entry.name).toLowerCase(),
              sizeBytes: fs.statSync(fullPath).size,
              relativeDir: path.relative(policyFilesRoot, dirPath),
              folderName: path.basename(dirPath),
            });
          }
        }
      } catch (err) {
        stats.errors.push(`Failed to scan directory ${dirPath}: ${err.message}`);
      }
      return results;
    }

    const allFiles = scanDirectory(policyFilesRoot);
    stats.totalFilesScanned = allFiles.length;

    const bankGroups = new Map();
    for (const file of allFiles) {
      let bankFolder = file.folderName;
      if (bankFolder.toLowerCase() === 'bank policy' || bankFolder.toLowerCase() === 'policy-files') {
        bankFolder = path.basename(path.dirname(file.fullPath));
      }
      if (file.relativeDir.includes(path.sep)) {
        const parts = file.relativeDir.split(path.sep);
        if (parts.length > 1 && parts[0].toLowerCase() === 'bank policy') {
          bankFolder = parts[1];
        }
      }

      const bankInfo = detectBankFromPath(bankFolder, file.fileName);
      const groupKey = bankInfo.name;
      if (!bankGroups.has(groupKey)) {
        bankGroups.set(groupKey, { bankInfo, files: [] });
      }
      bankGroups.get(groupKey).files.push(file);
    }

    stats.banksDetected = bankGroups.size;

    for (const [bankName, group] of bankGroups.entries()) {
      let bankRecord = null;
      const existingBank = await client.query(
        `SELECT * FROM banks WHERE LOWER(name) = LOWER($1) OR (code IS NOT NULL AND code = $2)`,
        [group.bankInfo.name, group.bankInfo.code]
      );

      if (existingBank.rowCount > 0) {
        bankRecord = existingBank.rows[0];
        stats.banksUpdated++;
      } else {
        const inserted = await client.query(
          `INSERT INTO banks (name, code, is_active) VALUES ($1, $2, true) RETURNING *`,
          [group.bankInfo.name, group.bankInfo.code]
        );
        bankRecord = inserted.rows[0];
        stats.banksCreated++;
      }

      const bankDetail = {
        bankName: bankRecord.name,
        bankCode: bankRecord.code,
        totalFiles: group.files.length,
        registeredFiles: 0,
        skippedFiles: 0,
        extractedFiles: 0,
        errors: []
      };

      for (const file of group.files) {
        const ext = file.ext;
        if (!['.pdf', '.xlsx', '.xls', '.xlsb', '.csv', '.txt', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'].includes(ext)) {
          stats.filesSkipped++;
          bankDetail.skippedFiles++;
          continue;
        }

        const existing = await client.query(
          `SELECT id, extracted_text FROM bank_policy_files WHERE bank_id = $1 AND file_path = $2`,
          [bankRecord.id, file.fullPath]
        );

        if (existing.rowCount > 0 && existing.rows[0].extracted_text) {
          stats.filesRegistered++;
          bankDetail.registeredFiles++;
          continue;
        }

        if (dryRun) {
          stats.filesScanned++;
          continue;
        }

        try {
          const extracted = await extractTextFromFile(file.fullPath, file.ext);
          const extractedText = getTextFromStructured(extracted);
          if (extractedText) {
            const meta = { extraction_format: extracted && extracted.format ? extracted.format : 'text' };
            if (extracted && extracted.sourceType) meta.document_type = extracted.sourceType;

            if (existing.rowCount > 0) {
              await client.query(
                `UPDATE bank_policy_files SET extracted_text = $1, metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb WHERE id = $3`,
                [extractedText, JSON.stringify(meta), existing.rows[0].id]
              );
            } else {
              await client.query(
                `INSERT INTO bank_policy_files (bank_id, file_name, file_path, file_type, file_size_bytes, uploaded_by, description, extracted_text, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  bankRecord.id,
                  file.fileName,
                  file.fullPath,
                  file.ext,
                  file.sizeBytes,
                  userId,
                  `Registered from policy documents folder`,
                  extractedText,
                  JSON.stringify(meta)
                ]
              );
            }
            stats.extractedFiles = (stats.extractedFiles || 0) + 1;
            bankDetail.registeredFiles++;
            stats.filesRegistered++;
          } else {
            bankDetail.skippedFiles++;
            stats.filesSkipped++;
          }
        } catch (extErr) {
          console.warn(`Extraction failed for ${file.fullPath}:`, extErr.message);
          stats.extractionErrors = (stats.extractionErrors || 0) + 1;
          bankDetail.skippedFiles++;
          stats.filesSkipped++;
        }
      }

      stats.banks.push(bankDetail);
    }

    stats.completedAt = new Date();
    return stats;
  } finally {
    client.release();
  }
}

async function scanPolicyFiles(options = {}) {
  const policyFilesRoot = options.rootDir || path.join(__dirname, '..', 'Policy-files');
  
  if (!fs.existsSync(policyFilesRoot)) {
    return { error: `Policy directory does not exist: ${policyFilesRoot}` };
  }

  function scanDirectory(dirPath) {
    let results = [];
    try {
      const list = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of list) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(scanDirectory(fullPath));
        } else if (entry.isFile()) {
          results.push({
            fullPath,
            fileName: entry.name,
            ext: path.extname(entry.name).toLowerCase(),
            sizeBytes: fs.statSync(fullPath).size,
            relativeDir: path.relative(policyFilesRoot, dirPath),
            folderName: path.basename(dirPath),
          });
        }
      }
    } catch (err) {
      // ignore scan errors
    }
    return results;
  }

  const allFiles = scanDirectory(policyFilesRoot);
  const supportedExts = new Set(['.pdf', '.xlsx', '.xls', '.xlsb', '.csv', '.txt', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif']);
  const supported = allFiles.filter(f => supportedExts.has(f.ext));
  const unsupported = allFiles.filter(f => !supportedExts.has(f.ext));

  return {
    totalFilesScanned: allFiles.length,
    supportedFiles: supported.length,
    unsupportedFiles: unsupported.length,
    supported: supported.map(f => ({
      fileName: f.fileName,
      ext: f.ext,
      sizeBytes: f.sizeBytes,
      folder: f.folderName,
      relativePath: f.relativeDir
    })),
    unsupported: unsupported.map(f => ({
      fileName: f.fileName,
      ext: f.ext,
      sizeBytes: f.sizeBytes,
      folder: f.folderName
    }))
  };
}

async function registerPolicyDocuments(pool, options = {}) {
  const policyFilesRoot = options.rootDir || path.join(__dirname, '..', 'Policy-files');
  const userId = options.userId || null;
  const client = await pool.connect();

  const supportedExtensions = new Set([
    '.pdf', '.xlsx', '.xls', '.xlsb', '.csv', '.txt', '.doc', '.docx',
    '.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'
  ]);

  const stats = {
    startedAt: new Date(),
    completedAt: null,
    totalFilesScanned: 0,
    supportedFiles: 0,
    unsupportedFiles: 0,
    banksCreated: 0,
    banksUpdated: 0,
    filesRegistered: 0,
    filesSkipped: 0,
    extractedFiles: 0,
    extractionErrors: 0,
    errors: [],
    banks: []
  };

  try {
    if (!fs.existsSync(policyFilesRoot)) {
      throw new Error(`Policy directory does not exist: ${policyFilesRoot}`);
    }

    function scanDirectory(dirPath) {
      let results = [];
      try {
        const list = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of list) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            results = results.concat(scanDirectory(fullPath));
          } else if (entry.isFile()) {
            results.push({
              fullPath,
              fileName: entry.name,
              ext: path.extname(entry.name).toLowerCase(),
              sizeBytes: fs.statSync(fullPath).size,
              relativeDir: path.relative(policyFilesRoot, dirPath),
              folderName: path.basename(dirPath),
            });
          }
        }
      } catch (err) {
        stats.errors.push(`Failed to scan directory ${dirPath}: ${err.message}`);
      }
      return results;
    }

    const allFiles = scanDirectory(policyFilesRoot);
    stats.totalFilesScanned = allFiles.length;

    const bankGroups = new Map();
    for (const file of allFiles) {
      let bankFolder = file.folderName;
      if (bankFolder.toLowerCase() === 'bank policy' || bankFolder.toLowerCase() === 'policy-files') {
        bankFolder = path.basename(path.dirname(file.fullPath));
      }
      if (file.relativeDir.includes(path.sep)) {
        const parts = file.relativeDir.split(path.sep);
        if (parts.length > 1 && parts[0].toLowerCase() === 'bank policy') {
          bankFolder = parts[1];
        }
      }

      const bankInfo = detectBankFromPath(bankFolder, file.fileName);
      const groupKey = bankInfo.name;
      if (!bankGroups.has(groupKey)) {
        bankGroups.set(groupKey, { bankInfo, files: [] });
      }
      bankGroups.get(groupKey).files.push(file);
    }

    for (const [bankName, group] of bankGroups.entries()) {
      let bankRecord = null;
      const existingBank = await client.query(
        `SELECT * FROM banks WHERE LOWER(name) = LOWER($1) OR (code IS NOT NULL AND code = $2)`,
        [group.bankInfo.name, group.bankInfo.code]
      );

      if (existingBank.rowCount > 0) {
        bankRecord = existingBank.rows[0];
        stats.banksUpdated++;
      } else {
        const inserted = await client.query(
          `INSERT INTO banks (name, code, is_active) VALUES ($1, $2, true) RETURNING *`,
          [group.bankInfo.name, group.bankInfo.code]
        );
        bankRecord = inserted.rows[0];
        stats.banksCreated++;
      }

      const bankDetail = {
        bankName: bankRecord.name,
        bankCode: bankRecord.code,
        totalFiles: group.files.length,
        registeredFiles: 0,
        skippedFiles: 0,
        extractedFiles: 0,
        errors: []
      };

      for (const file of group.files) {
        if (!supportedExtensions.has(file.ext)) {
          stats.unsupportedFiles++;
          bankDetail.skippedFiles++;
          continue;
        }

        const existing = await client.query(
          `SELECT id, extracted_text FROM bank_policy_files WHERE bank_id = $1 AND file_path = $2`,
          [bankRecord.id, file.fullPath]
        );

        if (existing.rowCount > 0 && existing.rows[0].extracted_text) {
          stats.filesRegistered++;
          bankDetail.registeredFiles++;
          continue;
        }

        try {
          const extracted = await extractTextFromFile(file.fullPath, file.ext);
          const extractedText = getTextFromStructured(extracted);
          if (extractedText) {
            const meta = { extraction_format: extracted && extracted.format ? extracted.format : 'text' };
            if (extracted && extracted.sourceType) meta.document_type = extracted.sourceType;

            if (existing.rowCount > 0) {
              await client.query(
                `UPDATE bank_policy_files SET extracted_text = $1, metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb WHERE id = $3`,
                [extractedText, JSON.stringify(meta), existing.rows[0].id]
              );
            } else {
              await client.query(
                `INSERT INTO bank_policy_files (bank_id, file_name, file_path, file_type, file_size_bytes, uploaded_by, description, extracted_text, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  bankRecord.id,
                  file.fileName,
                  file.fullPath,
                  file.ext,
                  file.sizeBytes,
                  userId,
                  `Registered from policy documents folder`,
                  extractedText,
                  JSON.stringify(meta)
                ]
              );
            }
            stats.extractedFiles = (stats.extractedFiles || 0) + 1;
            bankDetail.registeredFiles++;
            stats.filesRegistered++;
          } else {
            bankDetail.skippedFiles++;
            stats.filesSkipped++;
          }
        } catch (extErr) {
          console.warn(`Extraction failed for ${file.fullPath}:`, extErr.message);
          stats.extractionErrors = (stats.extractionErrors || 0) + 1;
          bankDetail.skippedFiles++;
          stats.filesSkipped++;
        }
      }

      stats.banks.push(bankDetail);
    }

    stats.completedAt = new Date();
    return stats;
  } finally {
    client.release();
  }
}

function classifyDocument(fileName, extractedText) {
  const name = (fileName || '').toLowerCase();
  const text = (extractedText || '').toLowerCase();

  const filenameHints = {
    'BT/Surrogate Program': /bt\s*surrogate|balance\s*transfer|surrogate|stp|spend\s*the\s*payment|top.?up/i,
    'FOIR Grid': /foir|dbr|obligation\s*ratio|income\s*ratio/i,
    'ROI/Pricing Grid': /roi|rate\s*of\s*interest|pricing|interest\s*rate\s*grid|rate\s*grid/i,
    'Location/Pincode List': /location|pincode|pin.?code|branch\s*list|active\s*loc|city\s*master|zone/i,
    'Company List': /company\s*list|vendor\s*list|employer\s*list|co.?brand|approved\s*company|company\s*catalog/i,
    'KYC/Process document': /kyc|process|undertaking|declaration|indemnity|mail\s*format|ovd|address\s*proof|document\s*checklist/i,
    'Main Eligibility Policy': /policy|eligibility|norm|guideline|master\s*policy/i,
  };

  const contentHints = {
    'Main Eligibility Policy': /eligibility|norm|cibil|salary|tenure|loan\s*amount|age\s*limit|foir\s*norm|rate\s*of\s*interest|processing\s*fee/i,
    'Company List': /company\s*name|employer\s*code|vendor|co.?brand|approved\s*company|organization\s*list/i,
    'Location/Pincode List': /pincode|pin.?code|branch\s*name|city|state|zone|region|location\s*master/i,
    'FOIR Grid': /foir\s*%|dbr\s*%|obligation\s*to\s*income|income\s*deduction|monthly\s*obligation/i,
    'ROI/Pricing Grid': /roi\s*%|rate\s*of\s*interest|pricing\s*sheet|interest\s*rate\s*grid| slab\s*rate/i,
    'BT/Surrogate Program': /bt\s*surrogate|balance\s*transfer|surrogate\s*program|stp|spend\s*the\s*payment|top.?up\s*loan/i,
    'KYC/Process document': /kyc|know\s*your\s*customer|undertaking|declaration|indemnity|mail\s*format|ovd|address\s*proof/i,
  };

  let bestType = 'Other';
  let bestScore = 0;

  for (const [type, regex] of Object.entries(filenameHints)) {
    const matches = name.match(regex);
    if (matches) {
      const score = matches.length * 2;
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
  }

  for (const [type, regex] of Object.entries(contentHints)) {
    const matches = text.match(regex);
    if (matches) {
      const score = matches.length;
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
  }

  if (bestType === 'Other' && /\.xlsx?$/.test(name)) {
    if (/loc|pincode|pin|branch|city/.test(name)) bestType = 'Location/Pincode List';
    else if (/company|employer|vendor/.test(name)) bestType = 'Company List';
    else if (/roi|rate|pricing/.test(name)) bestType = 'ROI/Pricing Grid';
    else if (/foir|dbr/.test(name)) bestType = 'FOIR Grid';
  }

  return bestType;
}

async function classifyBankDocuments(pool, bankId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, file_name, extracted_text FROM bank_policy_files WHERE bank_id = $1',
      [bankId]
    );

    const counts = {};
    const updates = [];

    for (const file of result.rows) {
      const docType = classifyDocument(file.file_name, file.extracted_text);
      counts[docType] = (counts[docType] || 0) + 1;
      updates.push({ id: file.id, fileName: file.file_name, docType });
    }

    for (const update of updates) {
      await client.query(
        'UPDATE bank_policy_files SET metadata = $1 WHERE id = $2',
        [{ document_type: update.docType, classified_at: new Date().toISOString() }, update.id]
      );
    }

    return { counts, total: result.rows.length };
  } finally {
    client.release();
  }
}



async function rebuildABFLUnifiedDocument(pool, bankId) {
  const client = await pool.connect();
  try {
    const bankResult = await client.query('SELECT id, name, code FROM banks WHERE id = $1', [bankId]);
    if (bankResult.rowCount === 0) {
      throw new Error('Bank not found');
    }
    const bank = bankResult.rows[0];

    const filesResult = await client.query(
      'SELECT id, file_name, file_path, file_type, extracted_text FROM bank_policy_files WHERE bank_id = $1 ORDER BY id',
      [bankId]
    );

    if (filesResult.rowCount === 0) {
      throw new Error('No policy documents found for this bank');
    }

    const locationFileNames = [
      'ABFL ACTIVE LOC 22-08-24.xlsx',
      "Aditya birla Jan'25 Pin-code allocation with additional branches v2.xlsx"
    ];

    const locationPatterns = [
      /active\s*loc/i,
      /pin.?code/i,
      /pincode/i,
      /branch\s*allocation/i,
      /serviceable\s*location/i,
      /location\s*list/i,
      /city\s*list/i
    ];

    function isLocationFile(fileName, filePath) {
      const name = (fileName || '').toLowerCase();
      const path = (filePath || '').toLowerCase();
      
      for (const locName of locationFileNames) {
        if (name === locName.toLowerCase()) return true;
      }
      
      for (const pattern of locationPatterns) {
        if (pattern.test(name) || pattern.test(path)) return true;
      }
      
      const ext = path.split('.').pop();
      if (['.xlsx', '.xls', '.xlsb'].includes('.' + ext)) {
        const hasLocationKeywords = /location|pincode|pin.?code|branch|city|serviceable/i.test(name);
        if (hasLocationKeywords) return true;
      }
      
      return false;
    }

    const unifiedParts = [];
    const includedFiles = [];
    const excludedFiles = [];
    let totalSourceFiles = 0;
    let convertedFiles = 0;
    let failedFiles = 0;

    for (const file of filesResult.rows) {
      totalSourceFiles++;
      
      if (isLocationFile(file.file_name, file.file_path)) {
        excludedFiles.push({ id: file.id, fileName: file.file_name, reason: 'location_data' });
        continue;
      }

      let text = file.extracted_text;

      if (!text && file.file_path) {
        const ext = path.extname(file.file_name || file.file_path).toLowerCase();
        const extracted = await extractTextFromFile(file.file_path, ext);
        if (extracted && extracted.rawText) {
          text = extracted.rawText;
        }
      }

      if (text && text.trim()) {
        const header = `\n${'='.repeat(80)}\nSOURCE FILE: ${file.file_name}\nTYPE: ${file.file_type || 'unknown'}\n${'='.repeat(80)}\n\n`;
        unifiedParts.push(header + text.trim());
        convertedFiles++;
        includedFiles.push({ id: file.id, fileName: file.file_name, textLength: text.trim().length });
      } else {
        failedFiles++;
      }
    }

    const unifiedText = unifiedParts.join('\n\n');
    const validation = validateUnifiedText(unifiedText, includedFiles, convertedFiles, totalSourceFiles - excludedFiles.length);

    return {
      bankId: bank.id,
      bankName: bank.name,
      bankCode: bank.code,
      unifiedText,
      validation,
      stats: {
        totalSourceFiles: totalSourceFiles - excludedFiles.length,
        convertedFiles,
        failedFiles,
        excludedFiles: excludedFiles.length
      },
      includedFiles,
      excludedFiles
    };
  } finally {
    client.release();
  }
}

async function replaceABFLUnifiedDocument(pool, bankId, conversionResult) {
  const client = await pool.connect();
  try {
    const unifiedText = conversionResult.unifiedText;
    const validation = conversionResult.validation;
    const stats = conversionResult.stats;
    const includedFiles = conversionResult.includedFiles;
    const excludedFiles = conversionResult.excludedFiles;

    const bankResult = await client.query('SELECT name, code FROM banks WHERE id = $1', [bankId]);
    const bankName = bankResult.rows[0]?.name || 'Unknown';
    const bankCode = bankResult.rows[0]?.code || 'BANK';

    const fileName = `${bankCode}_Unified_Policy_${new Date().toISOString().slice(0, 10)}.txt`;
    const description = `Unified text conversion for ${bankName}. Original files: ${stats.convertedFiles}/${stats.totalSourceFiles}. Excluded: ${stats.excludedFiles} location files. Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`;

    const existing = await client.query(
      'SELECT id FROM bank_policy_files WHERE bank_id = $1 AND metadata @> $2',
      [bankId, JSON.stringify({ is_unified_text: true })]
    );

    let unifiedDocId;
    if (existing.rowCount > 0) {
      await client.query(
        'UPDATE bank_policy_files SET extracted_text = $1, metadata = $2, file_name = $3, description = $4 WHERE id = $5',
        [
          unifiedText,
          {
            is_unified_text: true,
            validation,
            stats,
            included_files: includedFiles.map(f => f.fileName),
            excluded_files: excludedFiles.map(f => f.fileName),
            converted_at: new Date().toISOString()
          },
          fileName,
          description,
          existing.rows[0].id
        ]
      );
      unifiedDocId = existing.rows[0].id;
    } else {
      const result = await client.query(
        `INSERT INTO bank_policy_files 
         (bank_id, file_name, file_path, file_type, description, extracted_text, metadata, uploaded_by, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
        [
          bankId,
          fileName,
          `unified://${bankCode}/${fileName}`,
          '.txt',
          description,
          unifiedText,
          {
            is_unified_text: true,
            validation,
            stats,
            included_files: includedFiles.map(f => f.fileName),
            excluded_files: excludedFiles.map(f => f.fileName),
            converted_at: new Date().toISOString()
          },
          1
        ]
      );
      unifiedDocId = result.rows[0].id;
    }

    const allSourceIds = (await client.query(
      'SELECT id FROM bank_policy_files WHERE bank_id = $1 AND id != $2',
      [bankId, unifiedDocId]
    )).rows.map(r => r.id);

    for (const sourceId of allSourceIds) {
      await client.query('DELETE FROM bank_policy_files WHERE id = $1', [sourceId]);
    }

    const policyRules = await client.query(`
      SELECT pr.id FROM policy_rules pr
      JOIN policy_versions pv ON pv.id = pr.policy_version_id
      WHERE pv.bank_id = $1 AND pr.status = 'active'
    `, [bankId]);

    for (const rule of policyRules.rows) {
      await client.query('DELETE FROM policy_attachments WHERE policy_rule_id = $1', [rule.id]);
      
      await client.query(
        `INSERT INTO policy_attachments 
         (policy_rule_id, file_name, file_path, file_type, file_size_bytes, extracted_text, uploaded_by, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          rule.id,
          fileName,
          `unified://${bankCode}/${fileName}`,
          '.txt',
          Buffer.byteLength(unifiedText, 'utf8'),
          unifiedText,
          1
        ]
      );
    }

    return {
      unifiedDocumentId: unifiedDocId,
      includedFiles: includedFiles.length,
      excludedFiles: excludedFiles.length,
      deletedSourceRecords: allSourceIds.length,
      validation
    };
  } finally {
    client.release();
  }
}

async function rebuildABFLUnifiedDocument(pool, bankId) {
  const client = await pool.connect();
  try {
    const bankResult = await client.query('SELECT id, name, code FROM banks WHERE id = $1', [bankId]);
    if (bankResult.rowCount === 0) {
      throw new Error('Bank not found');
    }
    const bank = bankResult.rows[0];

    const filesResult = await client.query(
      'SELECT id, file_name, file_path, file_type, extracted_text FROM bank_policy_files WHERE bank_id = $1 ORDER BY id',
      [bankId]
    );

    if (filesResult.rowCount === 0) {
      throw new Error('No policy documents found for this bank');
    }

    const locationFileNames = [
      'ABFL ACTIVE LOC 22-08-24.xlsx',
      "Aditya birla Jan'25 Pin-code allocation with additional branches v2.xlsx"
    ];

    const locationPatterns = [
      /active\s*loc/i,
      /pin.?code/i,
      /pincode/i,
      /branch\s*allocation/i,
      /serviceable\s*location/i,
      /location\s*list/i,
      /city\s*list/i
    ];

    function isLocationFile(fileName, filePath) {
      const name = (fileName || '').toLowerCase();
      const path = (filePath || '').toLowerCase();
      
      for (const locName of locationFileNames) {
        if (name === locName.toLowerCase()) return true;
      }
      
      for (const pattern of locationPatterns) {
        if (pattern.test(name) || pattern.test(path)) return true;
      }
      
      const ext = path.split('.').pop();
      if (['.xlsx', '.xls', '.xlsb'].includes('.' + ext)) {
        const hasLocationKeywords = /location|pincode|pin.?code|branch|city|serviceable/i.test(name);
        if (hasLocationKeywords) return true;
      }
      
      return false;
    }

    const unifiedParts = [];
    const includedFiles = [];
    const excludedFiles = [];
    let totalSourceFiles = 0;
    let convertedFiles = 0;
    let failedFiles = 0;

    for (const file of filesResult.rows) {
      totalSourceFiles++;
      
      if (isLocationFile(file.file_name, file.file_path)) {
        excludedFiles.push({ id: file.id, fileName: file.file_name, reason: 'location_data' });
        continue;
      }

      let text = file.extracted_text;

      if (!text && file.file_path) {
        const ext = path.extname(file.file_name || file.file_path).toLowerCase();
        const extracted = await extractTextFromFile(file.file_path, ext);
        if (extracted && extracted.rawText) {
          text = extracted.rawText;
        }
      }

      if (text && text.trim()) {
        const header = `\n${'='.repeat(80)}\nSOURCE FILE: ${file.file_name}\nTYPE: ${file.file_type || 'unknown'}\n${'='.repeat(80)}\n\n`;
        unifiedParts.push(header + text.trim());
        convertedFiles++;
        includedFiles.push({ id: file.id, fileName: file.file_name, textLength: text.trim().length });
      } else {
        failedFiles++;
      }
    }

    const unifiedText = unifiedParts.join('\n\n');
    const validation = validateUnifiedText(unifiedText, includedFiles, convertedFiles, totalSourceFiles - excludedFiles.length);

    return {
      bankId: bank.id,
      bankName: bank.name,
      bankCode: bank.code,
      unifiedText,
      validation,
      stats: {
        totalSourceFiles: totalSourceFiles - excludedFiles.length,
        convertedFiles,
        failedFiles,
        excludedFiles: excludedFiles.length
      },
      includedFiles,
      excludedFiles
    };
  } finally {
    client.release();
  }
}

async function replaceABFLUnifiedDocument(pool, bankId, conversionResult) {
  const client = await pool.connect();
  try {
    const unifiedText = conversionResult.unifiedText;
    const validation = conversionResult.validation;
    const stats = conversionResult.stats;
    const includedFiles = conversionResult.includedFiles;
    const excludedFiles = conversionResult.excludedFiles;

    const bankResult = await client.query('SELECT name, code FROM banks WHERE id = $1', [bankId]);
    const bankName = bankResult.rows[0]?.name || 'Unknown';
    const bankCode = bankResult.rows[0]?.code || 'BANK';

    const fileName = `${bankCode}_Unified_Policy_${new Date().toISOString().slice(0, 10)}.txt`;
    const description = `Unified text conversion for ${bankName}. Original files: ${stats.convertedFiles}/${stats.totalSourceFiles}. Excluded: ${stats.excludedFiles} location files. Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`;

    const existing = await client.query(
      'SELECT id FROM bank_policy_files WHERE bank_id = $1 AND metadata @> $2',
      [bankId, JSON.stringify({ is_unified_text: true })]
    );

    let unifiedDocId;
    if (existing.rowCount > 0) {
      await client.query(
        'UPDATE bank_policy_files SET extracted_text = $1, metadata = $2, file_name = $3, description = $4 WHERE id = $5',
        [
          unifiedText,
          {
            is_unified_text: true,
            validation,
            stats,
            included_files: includedFiles.map(f => f.fileName),
            excluded_files: excludedFiles.map(f => f.fileName),
            converted_at: new Date().toISOString()
          },
          fileName,
          description,
          existing.rows[0].id
        ]
      );
      unifiedDocId = existing.rows[0].id;
    } else {
      const result = await client.query(
        `INSERT INTO bank_policy_files 
         (bank_id, file_name, file_path, file_type, description, extracted_text, metadata, uploaded_by, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id`,
        [
          bankId,
          fileName,
          `unified://${bankCode}/${fileName}`,
          '.txt',
          description,
          unifiedText,
          {
            is_unified_text: true,
            validation,
            stats,
            included_files: includedFiles.map(f => f.fileName),
            excluded_files: excludedFiles.map(f => f.fileName),
            converted_at: new Date().toISOString()
          },
          1
        ]
      );
      unifiedDocId = result.rows[0].id;
    }

    const allSourceIds = (await client.query(
      'SELECT id FROM bank_policy_files WHERE bank_id = $1 AND id != $2',
      [bankId, unifiedDocId]
    )).rows.map(r => r.id);

    for (const sourceId of allSourceIds) {
      await client.query('DELETE FROM bank_policy_files WHERE id = $1', [sourceId]);
    }

    const policyRules = await client.query(`
      SELECT pr.id FROM policy_rules pr
      JOIN policy_versions pv ON pv.id = pr.policy_version_id
      WHERE pv.bank_id = $1 AND pr.status = 'active'
    `, [bankId]);

    for (const rule of policyRules.rows) {
      await client.query('DELETE FROM policy_attachments WHERE policy_rule_id = $1', [rule.id]);
      
      await client.query(
        `INSERT INTO policy_attachments 
         (policy_rule_id, file_name, file_path, file_type, file_size_bytes, extracted_text, uploaded_by, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          rule.id,
          fileName,
          `unified://${bankCode}/${fileName}`,
          '.txt',
          Buffer.byteLength(unifiedText, 'utf8'),
          unifiedText,
          1
        ]
      );
    }

    return {
      unifiedDocumentId: unifiedDocId,
      includedFiles: includedFiles.length,
      excludedFiles: excludedFiles.length,
      deletedSourceRecords: allSourceIds.length,
      validation
    };
  } finally {
    client.release();
  }
}

module.exports = {
  BANK_CATALOG,
  detectBankFromPath,
  extractTextFromFile,
  extractRulesFromText,
  normalizeAndValidateRules,
  VALIDATION_CONFIG,
  getNextVersionLabel,
  getOrCreateBank,
  importPolicyFiles,
  scanPolicyFiles,
  registerPolicyDocuments,
  classifyDocument,
  classifyBankDocuments,
  createStructuredDocument,
  structuredToText,
  getTextFromStructured,
  convertBankDocumentsToText,
  validateUnifiedText,
  saveUnifiedBankDocument,
  rebuildABFLUnifiedDocument,
  replaceABFLUnifiedDocument
};