import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import * as xlsx from 'xlsx';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import { parse as parseCsvSync } from 'csv-parse/sync';

// =====================================================
// TYPES
// =====================================================

export interface BankInfo {
  name: string;
  code: string;
}

export interface PolicyFile {
  id: number;
  file_name: string;
  file_path: string | null;
  file_type: string | null;
  extracted_text: string | null;
}

export interface ScannedFile {
  fullPath: string;
  fileName: string;
  ext: string;
  sizeBytes: number;
  relativeDir: string;
  folderName: string;
}

export interface StructuredSheet {
  name: string;
  rows: string[][];
  cells: Array<{
    row: number;
    col: number;
    value: string;
  }>;
}

export interface StructuredPage {
  paragraphs: string[];
  tables: string[][][];
  raw: string;
}

export interface StructuredDocument {
  format: string;
  sourceType: string;
  rawText: string;
  paragraphs: string[];
  lines: string[];
  tables: string[][][];
  sheets: StructuredSheet[];
  pages: StructuredPage[];
  cells: Array<{
    row: number;
    col: number;
    value: string;
  }>;
  rows?: Array<Record<string, string>>;
  metadata: Record<string, unknown>;
}

export interface LocationCoverage {
  conditions: string[];
  raw: string;
}

export interface PolicyRules {
  loan_type: string;
  category: string | null;
  min_cibil: number | null;
  max_cibil: number | null;
  min_salary: number | null;
  max_salary: number | null;
  employment_type: string | null;
  min_age: number | null;
  max_age: number | null;
  min_loan_amount: number | null;
  max_loan_amount: number | null;
  min_tenure_months: number | null;
  max_tenure_months: number | null;
  foir_percent: number | null;
  roi: string | null;
  roi_min: number | null;
  roi_max: number | null;
  location_coverage: LocationCoverage | null;
}

export interface ValidationLogEntry {
  field: string;
  reason: string;
  originalValue: unknown;
  sourceSnippet: string;
}

export interface NormalizedRulesResult {
  rules: PolicyRules;
  validationLog: ValidationLogEntry[];
}

export interface FileStatus {
  fileId: number;
  fileName: string;
  status: 'converted' | 'failed_or_empty';
}

export interface UnifiedValidation {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  characterCount: number;
  convertedFiles: number;
  totalSourceFiles: number;
}

export interface ImportBankDetail {
  bankName: string;
  bankCode: string;
  totalFiles: number;
  registeredFiles: number;
  skippedFiles: number;
  extractedFiles: number;
  errors: string[];
}

export interface ImportStats {
  startedAt: Date;
  completedAt: Date | null;
  totalFilesScanned: number;
  banksDetected: number;
  banksCreated: number;
  banksUpdated: number;
  filesRegistered: number;
  filesSkipped: number;
  extractedFiles: number;
  extractionErrors: number;
  errors: string[];
  banks: ImportBankDetail[];
}

export interface ScanFileResult {
  fileName: string;
  ext: string;
  sizeBytes: number;
  folder: string;
  relativePath: string;
}

export interface ScanPolicyResult {
  totalFilesScanned: number;
  supportedFiles: number;
  unsupportedFiles: number;
  supported: ScanFileResult[];
  unsupported: ScanFileResult[];
}

export interface RegisterStats {
  startedAt: Date;
  completedAt: Date | null;
  totalFilesScanned: number;
  supportedFiles: number;
  unsupportedFiles: number;
  banksCreated: number;
  banksUpdated: number;
  filesRegistered: number;
  filesSkipped: number;
  extractedFiles: number;
  extractionErrors: number;
  errors: string[];
  banks: ImportBankDetail[];
}

export interface ClassificationResult {
  counts: Record<string, number>;
  total: number;
}

export interface IncludedFile {
  id: number;
  fileName: string;
  textLength: number;
}

export interface ExcludedFile {
  id: number;
  fileName: string;
  reason: string;
}

export interface UnifiedStats {
  totalSourceFiles: number;
  convertedFiles: number;
  failedFiles: number;
  excludedFiles: number;
}

export interface ABFLConversionResult {
  bankId: number;
  bankName: string;
  bankCode: string;
  unifiedText: string;
  validation: UnifiedValidation;
  stats: UnifiedStats;
  includedFiles: IncludedFile[];
  excludedFiles: ExcludedFile[];
}

export interface ReplaceUnifiedResult {
  unifiedDocumentId: number;
  includedFiles: number;
  excludedFiles: number;
  deletedSourceRecords: number;
  validation: UnifiedValidation;
}

export interface ImportPolicyOptions {
  rootDir?: string;
  userId?: number | null;
  dryRun?: boolean;
}

// =====================================================
// KNOWN BANK METADATA
// =====================================================

export const BANK_CATALOG: Record<string, BankInfo> = {
  adityabirla: {
    name: 'Aditya Birla Finance',
    code: 'ABFL',
  },
  'axis bank': {
    name: 'Axis Bank',
    code: 'AXIS',
  },
  'axis finance': {
    name: 'Axis Finance',
    code: 'AFL',
  },
  'bajaj finserv': {
    name: 'Bajaj Finserv',
    code: 'BAJAJ_FINSERV',
  },
  'bajaj markets': {
    name: 'Bajaj Markets',
    code: 'BAJAJ_MARKETS',
  },
  'bandhan bank': {
    name: 'Bandhan Bank',
    code: 'BANDHAN',
  },
  chola: {
    name: 'Cholamandalam Investment & Finance',
    code: 'CHOLA',
  },
  fibe: {
    name: 'Fibe (EarlySalary)',
    code: 'FIBE',
  },
  finnable: {
    name: 'Finnable Credit',
    code: 'FINNABLE',
  },
  hdfc: {
    name: 'HDFC Bank',
    code: 'HDFC',
  },
  'home loan': {
    name: 'Home Loan Services',
    code: 'HOME_LOAN',
  },
  icici: {
    name: 'ICICI Bank',
    code: 'ICICI',
  },
  idfc: {
    name: 'IDFC FIRST Bank',
    code: 'IDFC',
  },
  indusind: {
    name: 'IndusInd Bank',
    code: 'INDUSIND',
  },
  kotak: {
    name: 'Kotak Mahindra Bank',
    code: 'KOTAK',
  },
  'l& t finance': {
    name: 'L&T Finance',
    code: 'LTF',
  },
  'l&t finance': {
    name: 'L&T Finance',
    code: 'LTF',
  },
  piramal: {
    name: 'Piramal Capital & Housing Finance',
    code: 'PIRAMAL',
  },
  poonawalla: {
    name: 'Poonawalla Fincorp',
    code: 'POONAWALLA',
  },
  'sbm bank': {
    name: 'SBM Bank India',
    code: 'SBM',
  },
  smfg: {
    name: 'SMFG India Credit (Fullerton)',
    code: 'SMFG',
  },
  'tata capital': {
    name: 'Tata Capital',
    code: 'TATA_CAPITAL',
  },
  'utkarsh small finance bank': {
    name: 'Utkarsh Small Finance Bank',
    code: 'UTKARSH',
  },
  'yes bank': {
    name: 'Yes Bank',
    code: 'YES_BANK',
  },
};

// =====================================================
// BANK DETECTION
// =====================================================

export function detectBankFromPath(
  folderName: string = '',
  fileName: string = '',
): BankInfo {
  const normFolder = folderName.toLowerCase().trim();
  const normFile = fileName.toLowerCase().trim();

  if (BANK_CATALOG[normFolder]) {
    return BANK_CATALOG[normFolder];
  }

  for (const [key, val] of Object.entries(BANK_CATALOG)) {
    if (normFolder.includes(key) || normFile.includes(key)) {
      return val;
    }
  }

  const cleanName = folderName
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase(),
    )
    .join(' ');

  const cleanCode = cleanName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);

  return {
    name: cleanName,
    code: cleanCode,
  };
}

// =====================================================
// STRUCTURED DOCUMENT
// =====================================================

export function createStructuredDocument(
  format: string,
  sourceType?: string,
): StructuredDocument {
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

// =====================================================
// FILE TEXT EXTRACTION
// =====================================================

export async function extractTextFromFile(
  filePath: string,
  ext: string,
): Promise<StructuredDocument | null> {
  const normalizedExt = (ext || '').toLowerCase();

  try {
    if (normalizedExt === '.txt') {
      const text = await fs.promises.readFile(filePath, 'utf8');

      const doc = createStructuredDocument('txt');

      doc.rawText = text;

      doc.lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      doc.paragraphs = text
        .split(/\r?\n\s*\r?\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

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

      doc.paragraphs = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      return doc;
    }

    if (
      ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'].includes(
        normalizedExt,
      )
    ) {
      return await extractImageText(filePath);
    }

    return null;
  } catch (err) {
    const error = err as Error;

    console.warn(
      `Failed to extract text from ${filePath}:`,
      error.message,
    );

    return null;
  }
}

// =====================================================
// PDF
// =====================================================

async function extractPdfText(
  filePath: string,
): Promise<StructuredDocument | null> {
  try {
    const pdfPkg = 'pdfjs-dist/legacy/build/pdf.mjs';
    // @ts-ignore
    const imported: any = await import(/* webpackIgnore: true */ pdfPkg);

    const pdfjsLib = imported.default || imported;

    const data = new Uint8Array(
      await fs.promises.readFile(filePath),
    );

    const doc = await pdfjsLib.getDocument({ data }).promise;

    const structured = createStructuredDocument('pdf');

    const allTextParts: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();

      const pageData: StructuredPage = {
        paragraphs: [],
        tables: [],
        raw: '',
      };

      const lines = new Map<number, string[]>();

      for (const item of content.items) {
        if (!('transform' in item) || !('str' in item)) {
          continue;
        }

        const y = Math.round(item.transform[5] * 10) / 10;

        if (!lines.has(y)) {
          lines.set(y, []);
        }

        lines.get(y)!.push(item.str);
      }

      const sortedLines = Array.from(lines.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, words]) => words.join(' '));

      const pageText = sortedLines.join('\n');

      pageData.raw = pageText;

      allTextParts.push(pageText);

      const paragraphs = pageText
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

      if (paragraphs.length > 0) {
        pageData.paragraphs = paragraphs;
      } else if (sortedLines.length > 0) {
        pageData.paragraphs = sortedLines;
      }

      structured.pages.push(pageData);
    }

    structured.rawText = allTextParts.join('\n\n').trim();

    return structured;
  } catch (err) {
    const error = err as Error;

    console.warn(
      `PDF extraction failed for ${filePath}:`,
      error.message,
    );

    return null;
  }
}

// =====================================================
// EXCEL
// =====================================================

async function extractExcelText(
  filePath: string,
): Promise<StructuredDocument> {
  const buffer = await fs.promises.readFile(filePath);

  const workbook = xlsx.read(buffer, {
    type: 'buffer',
    cellStyles: false,
    cellFormula: false,
    cellDates: true,
  });

  const structured = createStructuredDocument('excel');

  const allRows: string[][] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet['!ref']) {
      continue;
    }

    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][];

    if (rows.length === 0) {
      continue;
    }

    const normalizedRows: string[][] = rows.map((row) =>
      row.map((cell) => String(cell ?? '').trim()),
    );

    const sheetData: StructuredSheet = {
      name: sheetName,
      rows: normalizedRows,
      cells: [],
    };

    for (let r = 0; r < normalizedRows.length; r++) {
      for (let c = 0; c < normalizedRows[r].length; c++) {
        const value = normalizedRows[r][c];

        if (value) {
          sheetData.cells.push({
            row: r + 1,
            col: c + 1,
            value,
          });
        }
      }
    }

    structured.sheets.push(sheetData);

    allRows.push(...normalizedRows);
  }

  structured.lines = allRows
    .map((row) => row.join(' | '))
    .filter(Boolean);

  structured.rawText = structured.lines.join('\n');

  return structured;
}

// =====================================================
// CSV
// =====================================================

async function extractCsvText(
  filePath: string,
): Promise<StructuredDocument> {
  const content = await fs.promises.readFile(
    filePath,
    'utf8',
  );

  const structured = createStructuredDocument('csv');

  structured.rawText = content;

  structured.lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  try {
    const records = parseCsvSync(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, unknown>>;

    if (records.length > 0) {
      structured.rows = records.map((record) => {
        const row: Record<string, string> = {};

        for (const [key, value] of Object.entries(record)) {
          row[key] = String(value ?? '');
        }

        return row;
      });

      structured.paragraphs = records.map((record) =>
        Object.entries(record)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | '),
      );
    }
  } catch (err) {
    const error = err as Error;

    console.warn(
      `CSV parse failed for ${filePath}:`,
      error.message,
    );
  }

  return structured;
}

// =====================================================
// DOCX
// =====================================================

async function extractDocxText(
  filePath: string,
): Promise<StructuredDocument> {
  const buffer = await fs.promises.readFile(filePath);

  const structured = createStructuredDocument('docx');

  try {
    const result = await mammoth.convertToHtml({ buffer });

    const html = result.value;

    const tableRegex =
      /<table[^>]*>([\s\S]*?)<\/table>/gi;

    let tableMatch: RegExpExecArray | null;

    while (
      (tableMatch = tableRegex.exec(html)) !== null
    ) {
      const rows: string[][] = [];

      const rowRegex =
        /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

      let rowMatch: RegExpExecArray | null;

      while (
        (rowMatch = rowRegex.exec(tableMatch[1])) !== null
      ) {
        const cells: string[] = [];

        const cellRegex =
          /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;

        let cellMatch: RegExpExecArray | null;

        while (
          (cellMatch = cellRegex.exec(rowMatch[1])) !== null
        ) {
          cells.push(
            cellMatch[1]
              .replace(/<[^>]+>/g, '')
              .trim(),
          );
        }

        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length > 0) {
        structured.tables.push(rows);
      }
    }

    const textWithoutTables = html
      .replace(
        /<table[^>]*>[\s\S]*?<\/table>/gi,
        '\n\n',
      )
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    structured.paragraphs = textWithoutTables
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    structured.rawText =
      structured.paragraphs.join('\n');

    if (structured.tables.length > 0) {
      structured.rawText +=
        '\n\n' +
        structured.tables
          .map(
            (table, index) =>
              `--- Table ${index + 1} ---\n${table
                .map((row) => row.join(' | '))
                .join('\n')}`,
          )
          .join('\n\n');
    }

    return structured;
  } catch (err) {
    const error = err as Error;

    console.warn(
      `DOCX HTML extraction failed for ${filePath}:`,
      error.message,
    );
  }

  try {
    const result =
      await mammoth.extractRawText({ buffer });

    structured.rawText = result.value || '';

    structured.paragraphs = structured.rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return structured;
  } catch (err) {
    const error = err as Error;

    console.warn(
      `DOCX raw text extraction failed for ${filePath}:`,
      error.message,
    );
  }

  return structured;
}

// =====================================================
// IMAGE / OCR
// =====================================================

async function extractImageText(
  filePath: string,
): Promise<StructuredDocument | null> {
  try {
    const worker = await createWorker('eng');

    try {
      const { data } = await worker.recognize(filePath);

      const text = (data.text || '').trim();

      const structured =
        createStructuredDocument('image');

      structured.rawText = text;

      structured.lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      structured.paragraphs = text
        .split(/\r?\n\s*\r?\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

      structured.metadata = {
        ocrConfidence: data.confidence,
      };

      return structured;
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    const error = err as Error;

    console.warn(
      `OCR failed for ${filePath}:`,
      error.message,
    );

    return null;
  }
}

// =====================================================
// AMOUNT PARSER
// =====================================================

export function parseAmountValue(
  str: string | null | undefined,
): number | null {
  if (!str) {
    return null;
  }

  const clean = String(str)
    .replace(/[₹,\s]/gi, '')
    .toLowerCase();

  if (
    clean.includes('cr') ||
    clean.includes('crore')
  ) {
    const num = parseFloat(
      clean.replace(/(cr|crore|crores)/g, ''),
    );

    return Number.isNaN(num)
      ? null
      : num * 10000000;
  }

  if (
    clean.includes('lac') ||
    clean.includes('lakh') ||
    clean.includes('l')
  ) {
    const num = parseFloat(
      clean.replace(
        /(lac|lacs|lakh|lakhs|l)/g,
        '',
      ),
    );

    return Number.isNaN(num)
      ? null
      : num * 100000;
  }

  if (
    clean.includes('k') ||
    clean.includes('thousand')
  ) {
    const num = parseFloat(
      clean.replace(/(k|thousand)/g, ''),
    );

    return Number.isNaN(num)
      ? null
      : num * 1000;
  }

  const num = parseFloat(clean);

  return Number.isNaN(num) ? null : num;
}

// =====================================================
// STRUCTURED TO TEXT
// =====================================================

export function structuredToText(
  doc: StructuredDocument | null | undefined,
): string {
  if (!doc || typeof doc !== 'object') {
    return doc || '';
  }

  const parts: string[] = [];

  if (doc.rawText) {
    parts.push(doc.rawText);
  }

  if (doc.paragraphs?.length) {
    parts.push(doc.paragraphs.join('\n'));
  }

  if (doc.lines?.length) {
    parts.push(doc.lines.join('\n'));
  }

  if (doc.tables?.length) {
    doc.tables.forEach((table, index) => {
      parts.push(`--- Table ${index + 1} ---`);

      table.forEach((row) => {
        parts.push(row.join(' | '));
      });
    });
  }

  if (doc.sheets?.length) {
    doc.sheets.forEach((sheet, index) => {
      parts.push(
        `--- Sheet: ${sheet.name || index + 1} ---`,
      );

      if (sheet.rows?.length) {
        sheet.rows.forEach((row) => {
          parts.push(row.join(' | '));
        });
      }
    });
  }

  if (doc.pages?.length) {
    doc.pages.forEach((page, index) => {
      parts.push(`--- Page ${index + 1} ---`);

      if (page.paragraphs?.length) {
        parts.push(page.paragraphs.join('\n'));
      }

      if (page.tables?.length) {
        page.tables.forEach((table, tableIndex) => {
          parts.push(`  Table ${tableIndex + 1}:`);

          table.forEach((row) => {
            parts.push(`  ${row.join(' | ')}`);
          });
        });
      }
    });
  }

  return parts.join('\n').trim();
}

export function getTextFromStructured(
  doc: StructuredDocument | null | undefined,
): string {
  if (!doc || typeof doc !== 'object') {
    return doc || '';
  }

  return doc.rawText || structuredToText(doc) || '';
}

// =====================================================
// LOAN TYPE
// =====================================================

export function extractLoanType(
  text: string,
  fileName: string,
  folderName: string,
): string {
  const combined = (
    text +
    ' ' +
    fileName +
    ' ' +
    folderName
  ).toLowerCase();

  if (
    combined.includes('home loan') ||
    combined.includes('housing')
  ) {
    return 'Home';
  }

  if (
    combined.includes('auto loan') ||
    combined.includes('car loan') ||
    combined.includes('vehicle')
  ) {
    return 'Auto';
  }

  if (
    combined.includes('education') ||
    combined.includes('student')
  ) {
    return 'Education';
  }

  if (
    combined.includes('business loan') ||
    combined.includes('bl policy') ||
    combined.includes('doctor')
  ) {
    return 'Business';
  }

  return 'Personal';
}

// =====================================================
// RULE EXTRACTION
// =====================================================

export function extractRulesFromText(
  text: string | StructuredDocument,
  fileName: string,
  folderName: string,
  explicitCategory?: string | null,
): PolicyRules | null {
  const plainText: string =
    typeof text === 'string'
      ? text
      : text && typeof text === 'object'
      ? getTextFromStructured(text)
      : '';

  if (!plainText) {
    return null;
  }

  const loanType = extractLoanType(
    plainText,
    fileName,
    folderName,
  );

  const rules: PolicyRules = {
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

  const normalizedText = plainText
    .replace(/\s+/g, ' ')
    .trim();

  // ===================================================
  // 0. CATEGORY
  // ===================================================

  if (!rules.category) {
    const lowerText =
      normalizedText.toLowerCase();

    if (
      lowerText.includes('-1 cibil') ||
      lowerText.includes('minus one cibil') ||
      lowerText.includes('owned house')
    ) {
      rules.category =
        '-1 CIBIL/Owned House';
    } else if (
      lowerText.includes('banking surrogate') ||
      lowerText.includes(
        'banking & repayment surrogate',
      )
    ) {
      rules.category = 'Banking Surrogate';
    } else if (
      lowerText.includes('auto loan surrogate')
    ) {
      rules.category = 'Auto Loan Surrogate';
    } else if (
      lowerText.includes('home loan surrogate')
    ) {
      rules.category = 'Home Loan Surrogate';
    } else if (
      lowerText.includes('bt surrogate') ||
      lowerText.includes('bt program') ||
      lowerText.includes(
        'balance transfer surrogate',
      )
    ) {
      rules.category = 'BT Surrogate';
    } else if (
      lowerText.includes('normal cases') ||
      lowerText.includes('normal case')
    ) {
      rules.category = 'Normal';
    } else if (
      lowerText.includes('salaried elite') ||
      lowerText.includes('salary emerging')
    ) {
      rules.category = 'Normal';
    } else {
      const catMatch = normalizedText.match(
        /(?:cat(?:egory)?\s*[a-d]|company\s*categor|pricing\s*categor|eligible\s*compan(?:y|ies)?\s*(?:list|type|category)?)\s*[:\-]?\s*([^\n,;]{1,100})/i,
      );

      if (catMatch) {
        rules.category = catMatch[1]
          .trim()
          .slice(0, 100);
      } else {
        const catOnly = normalizedText.match(
          /\b(?:CAT\s*[A-D]|Category\s*[A-D])\b/i,
        );

        if (catOnly) {
          rules.category = catOnly[0].trim();
        }
      }
    }
  }

  // ===================================================
  // 1. CIBIL
  // ===================================================

  const cibilCompulsoryMatch =
    normalizedText.match(
      /cibil\s*(\d{3})\s*compulsory/i,
    );

  if (cibilCompulsoryMatch) {
    rules.min_cibil = parseInt(
      cibilCompulsoryMatch[1],
      10,
    );
  } else {
    const cibilAboveMatch =
      normalizedText.match(
        /cibil\s*(?:score\s*)?(?:require[sd]?\s*)?[:\-]?\s*(\d{3})\s+above/i,
      );

    if (cibilAboveMatch) {
      rules.min_cibil = parseInt(
        cibilAboveMatch[1],
        10,
      );
    } else {
      const cibilPlusMatch =
        normalizedText.match(
          /cibil\s*(?:score\s*)?(?:require[sd]?\s*)?[:\-]?\s*[>]\s*(\d{3})/i,
        );

      if (cibilPlusMatch) {
        rules.min_cibil = parseInt(
          cibilPlusMatch[1],
          10,
        );
      } else {
        const cibilRangeMatch =
          normalizedText.match(
            /cibil\s*(?:score\s*)?(?:require[sd]?\s*)?[:\-]?\s*(\d{3})\s*(?:to|-|–|\+)\s*(\d{3})?/i,
          );

        if (cibilRangeMatch) {
          rules.min_cibil = parseInt(
            cibilRangeMatch[1],
            10,
          );

          if (cibilRangeMatch[2]) {
            rules.max_cibil = parseInt(
              cibilRangeMatch[2],
              10,
            );
          }
        } else {
          const cibilPlainMatch =
            normalizedText.match(
              /(?:cibil|cibil score)\s*(?:of|is|require[sd]?)?\s*[:\-]?\s*(\d{3})\s*\+/i,
            );

          if (cibilPlainMatch) {
            rules.min_cibil = parseInt(
              cibilPlainMatch[1],
              10,
            );
          }
        }
      }
    }
  }

  // ===================================================
  // 2. SALARY
  // ===================================================

  const salaryRangeMatch =
    normalizedText.match(
      /(?:salary|nmi|net salary|income|nth)\s*(?:range|required|norms)?\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)\s*(?:to|-|–)\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i,
    );

  if (
    salaryRangeMatch &&
    !normalizedText
      .substring(
        salaryRangeMatch.index!,
        salaryRangeMatch.index! +
          salaryRangeMatch[0].length,
      )
      .includes('%')
  ) {
    const afterMatch = normalizedText.substring(
      salaryRangeMatch.index! +
        salaryRangeMatch[0].length,
      salaryRangeMatch.index! +
        salaryRangeMatch[0].length +
        5,
    );

    if (!/^\d/.test(afterMatch)) {
      rules.min_salary = parseAmountValue(
        salaryRangeMatch[1],
      );

      rules.max_salary = parseAmountValue(
        salaryRangeMatch[2],
      );
    }
  } else {
    const minSalaryMatch =
      normalizedText.match(
        /(?:min(?:imum)?\s*(?:net\s*)?salary|nmi|minimum income|salary|nth)\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i,
      );

    if (
      minSalaryMatch &&
      !normalizedText
        .substring(
          minSalaryMatch.index!,
          minSalaryMatch.index! +
            minSalaryMatch[0].length,
        )
        .includes('%')
    ) {
      const afterMatch = normalizedText.substring(
        minSalaryMatch.index! +
          minSalaryMatch[0].length,
        minSalaryMatch.index! +
          minSalaryMatch[0].length +
          5,
      );

      if (!/^\d/.test(afterMatch)) {
        const val = parseAmountValue(
          minSalaryMatch[1],
        );

        if (val !== null && val < 1000000) {
          rules.min_salary = val;
        }
      }
    }
  }

  const salaryTierMatch =
    normalizedText.match(
      /(?:salary|tier)\s+(?:elite|emerging|tier\s*\d|standard|premium)\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i,
    );

  if (
    salaryTierMatch &&
    !normalizedText
      .substring(
        salaryTierMatch.index!,
        salaryTierMatch.index! +
          salaryTierMatch[0].length,
      )
      .includes('%')
  ) {
    const afterMatch = normalizedText.substring(
      salaryTierMatch.index! +
        salaryTierMatch[0].length,
      salaryTierMatch.index! +
        salaryTierMatch[0].length +
        5,
    );

    if (!/^\d/.test(afterMatch)) {
      const val = parseAmountValue(
        salaryTierMatch[1],
      );

      if (val !== null) {
        if (
          rules.min_salary === null ||
          val < rules.min_salary
        ) {
          rules.min_salary = val;
        }

        if (
          rules.max_salary === null ||
          val > rules.max_salary
        ) {
          rules.max_salary = val;
        }
      }
    }
  }

  const salaryAboveMatch =
    normalizedText.match(
      /(?:salary|nmi|income)\s+(?:above|over)\s+(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i,
    );

  if (
    salaryAboveMatch &&
    !normalizedText
      .substring(
        salaryAboveMatch.index!,
        salaryAboveMatch.index! +
          salaryAboveMatch[0].length,
      )
      .includes('%')
  ) {
    const val = parseAmountValue(
      salaryAboveMatch[1],
    );

    if (
      val !== null &&
      (rules.min_salary === null ||
        val < rules.min_salary)
    ) {
      rules.min_salary = val;
    }
  }

  const salaryBelowMatch =
    normalizedText.match(
      /(?:salary|nmi|income)\s+(?:below|under)\s+(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac))?)(?!%)/i,
    );

  if (
    salaryBelowMatch &&
    !normalizedText
      .substring(
        salaryBelowMatch.index!,
        salaryBelowMatch.index! +
          salaryBelowMatch[0].length,
      )
      .includes('%')
  ) {
    const val = parseAmountValue(
      salaryBelowMatch[1],
    );

    if (
      val !== null &&
      (rules.max_salary === null ||
        val > rules.max_salary)
    ) {
      rules.max_salary = val;
    }
  }

  // ===================================================
  // 3. LOAN AMOUNT
  // ===================================================

  const amountRangeMatch =
    normalizedText.match(
      /(?:loan\s*amount|amount|funding|max\s*fund)\s*(?:range|cap)?\s*[:\-]?\s*(?:min\s*)?(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)\s*(?:to|-|–)\s*(?:max\s*)?(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)/i,
    );

  if (amountRangeMatch) {
    rules.min_loan_amount =
      parseAmountValue(amountRangeMatch[1]);

    rules.max_loan_amount =
      parseAmountValue(amountRangeMatch[2]);
  } else {
    const maxAmountMatch =
      normalizedText.match(
        /(?:max(?:imum)?\s*(?:loan\s*)?(?:amount|cap|funding)|loan max|upto\s*(?:funding)?|max\s*fund)\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)/i,
      );

    if (maxAmountMatch) {
      rules.max_loan_amount =
        parseAmountValue(maxAmountMatch[1]);
    }

    const minAmountMatch =
      normalizedText.match(
        /(?:min(?:imum)?\s*(?:loan\s*)?(?:amount|cap|funding)|loan min|minimum\s*loan\s*amount)\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)/i,
      );

    if (minAmountMatch) {
      rules.min_loan_amount =
        parseAmountValue(minAmountMatch[1]);
    }

    const loanAboveMatch =
      normalizedText.match(
        /(?:loan\s*amount|amount)\s+(?:above|over|minimum|min)\s+(?:₹|rs\.?)?\s*([\d,]+(?:\s*(?:[kK]|lakh|lac|l|cr))?)/i,
      );

    if (loanAboveMatch) {
      const val = parseAmountValue(
        loanAboveMatch[1],
      );

      if (
        val !== null &&
        (rules.min_loan_amount === null ||
          val < rules.min_loan_amount)
      ) {
        rules.min_loan_amount = val;
      }
    }
  }

  // ===================================================
  // 4. AGE
  // ===================================================

  const ageRangeMatch =
    normalizedText.match(
      /(?:age\s*(?:norms|limit|criteria)?)\s*[:\-]?\s*(?:min\s*)?(\d{2})\s*(?:to|-|–)\s*(?:max\s*)?(\d{2})\s*(?:years?|yrs?)?/i,
    );

  if (ageRangeMatch) {
    rules.min_age = parseInt(
      ageRangeMatch[1],
      10,
    );

    rules.max_age = parseInt(
      ageRangeMatch[2],
      10,
    );
  } else {
    const ageOnlyMatch =
      normalizedText.match(
        /age\s*[:\-]?\s*(\d{2})\s*(?:to|-|–)\s*(\d{2})\s*(?:years?|yrs?)?/i,
      );

    if (ageOnlyMatch) {
      rules.min_age = parseInt(
        ageOnlyMatch[1],
        10,
      );

      rules.max_age = parseInt(
        ageOnlyMatch[2],
        10,
      );
    } else {
      const minAgeMatch =
        normalizedText.match(
          /min(?:imum)\.?\s*age\s*[:\-]?\s*(\d{2})/i,
        );

      if (minAgeMatch) {
        rules.min_age = parseInt(
          minAgeMatch[1],
          10,
        );
      }

      const maxAgeMatch =
        normalizedText.match(
          /max(?:imum)\.?\s*(?:below\s*)?age\s*[:\-]?\s*(\d{2})/i,
        );

      if (maxAgeMatch) {
        rules.max_age = parseInt(
          maxAgeMatch[1],
          10,
        );
      }
    }
  }

  // ===================================================
  // 4B. TENURE
  // ===================================================

  const tenureYearRange =
    normalizedText.match(
      /(?:tenure|tenor)\s*[:\-]?\s*(?:min\s*)?(\d+)\s*(?:years?|yrs?)\s*(?:to|-|–)\s*(?:max\s*)?(\d+)\s*(?:years?|yrs?)/i,
    );

  if (tenureYearRange) {
    rules.min_tenure_months =
      parseInt(tenureYearRange[1], 10) * 12;

    rules.max_tenure_months =
      parseInt(tenureYearRange[2], 10) * 12;
  } else {
    const tenureMonthRange =
      normalizedText.match(
        /(?:tenure|tenor)\s*[:\-]?\s*(?:min\s*)?(\d+)\s*(?:months?|m)\s*(?:to|-|–)\s*(?:max\s*)?(\d+)\s*(?:months?|m)/i,
      );

    if (tenureMonthRange) {
      rules.min_tenure_months = parseInt(
        tenureMonthRange[1],
        10,
      );

      rules.max_tenure_months = parseInt(
        tenureMonthRange[2],
        10,
      );
    } else {
      const leadingMonthsMatch =
        normalizedText.match(
          /^(\d+)\s*months?\s+(?:salary|loan|tenure|tenor)/i,
        );

      if (leadingMonthsMatch) {
        rules.min_tenure_months =
          parseInt(
            leadingMonthsMatch[1],
            10,
          );
      }

      const tenureYearSingle =
        normalizedText.match(
          /(?:tenure|tenor)\s*[:\-]?\s*(?:min\s*)?(\d+)\s*(?:years?|yrs?)/i,
        );

      if (tenureYearSingle) {
        rules.min_tenure_months =
          parseInt(
            tenureYearSingle[1],
            10,
          ) * 12;
      }

      const tenureMonthSingle =
        normalizedText.match(
          /(?:tenure|tenor)\s*[:\-]?\s*(?:min\s*)?(\d+)\s*(?:months?|m)/i,
        );

      if (tenureMonthSingle) {
        const val = parseInt(
          tenureMonthSingle[1],
          10,
        );

        rules.min_tenure_months =
          rules.min_tenure_months === null
            ? val
            : Math.min(
                rules.min_tenure_months,
                val,
              );
      }

      const tenureMaxMatch =
        normalizedText.match(
          /(?:max(?:imum)?\s*(?:tenure|tenor))\s*[:\-]?\s*(\d+)\s*(?:months?|m|years?|yrs?)/i,
        );

      if (tenureMaxMatch) {
        const val = parseInt(
          tenureMaxMatch[1],
          10,
        );

        rules.max_tenure_months =
          val < 10 ? val * 12 : val;
      }

      const tenureMinMatch =
        normalizedText.match(
          /(?:min(?:imum)\s*(?:tenure|tenor))\s*[:\-]?\s*(\d+)\s*(?:months?|m|years?|yrs?)/i,
        );

      if (tenureMinMatch) {
        const val = parseInt(
          tenureMinMatch[1],
          10,
        );

        rules.min_tenure_months =
          rules.min_tenure_months === null
            ? val
            : Math.min(
                rules.min_tenure_months,
                val,
              );
      }
    }
  }

  // ===================================================
  // 5. FOIR / DBR
  // ===================================================

  const foirMatch = normalizedText.match(
    /(?:foir|dbr)\s*(?:cal|norms|max|up to|percentage)?\s*[:\-]?\s*(?:up to\s*)?(\d+(?:\.\d+)?)\s*%/i,
  );

  if (foirMatch) {
    rules.foir_percent = parseFloat(
      foirMatch[1],
    );
  } else {
    const foirRangeMatch =
      normalizedText.match(
        /(\d+(?:\.\d+)?)\s*%\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*%\s*(?:foir|dbr)/i,
      );

    if (foirRangeMatch) {
      rules.foir_percent = parseFloat(
        foirRangeMatch[2],
      );
    }
  }

  // ===================================================
  // 6. ROI
  // ===================================================

  const roiRangeMatch =
    normalizedText.match(
      /(?:rate|roi|interest\s*rate)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%(?:\s*(?:to|-|–|and)\s*)(\d+(?:\.\d+)?)\s*%/i,
    );

  if (roiRangeMatch) {
    rules.roi_min = parseFloat(
      roiRangeMatch[1],
    );

    rules.roi_max = parseFloat(
      roiRangeMatch[2],
    );

    rules.roi =
      rules.roi_min +
      '% - ' +
      rules.roi_max +
      '%';
  } else {
    const roiSingleMatch =
      normalizedText.match(
        /(?:rate|roi|interest\s*rate)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i,
      );

    if (roiSingleMatch) {
      rules.roi =
        parseFloat(roiSingleMatch[1]) + '%';
    }
  }

  // ===================================================
  // 7. EMPLOYMENT TYPE
  // ===================================================

  const hasSalaried =
    /salaried|company\s*3\s*years|pvt\s*company|ltd\s*company|govt|government|school|college|hospital|bpo/i.test(
      normalizedText,
    );

  const hasSelfEmployed =
    /self-employed|proprietorship|partnership|llp|business/i.test(
      normalizedText,
    );

  if (hasSalaried && !hasSelfEmployed) {
    rules.employment_type = 'Salaried';
  } else if (
    hasSelfEmployed &&
    !hasSalaried
  ) {
    rules.employment_type =
      'Self-Employed';
  } else if (
    hasSalaried &&
    hasSelfEmployed
  ) {
    rules.employment_type = 'Any';
  }

  // ===================================================
  // 8. LOCATION
  // ===================================================

  const locationConditions: string[] = [];

  if (/slum|negative\s*area/i.test(normalizedText)) {
    locationConditions.push(
      'No SLUM/Negative area',
    );
  }

  if (/abfl\s*location/i.test(normalizedText)) {
    locationConditions.push('ABFL location');
  }

  if (
    /joint\s*account.*can'?t\s*consider|joint\s*account.*not\s*allowed/i.test(
      normalizedText,
    )
  ) {
    locationConditions.push(
      'No joint account',
    );
  }

  if (
    /od\s*account.*can'?t\s*consider|od\s*account.*not\s*allowed/i.test(
      normalizedText,
    )
  ) {
    locationConditions.push(
      'No OD account',
    );
  }

  const cityListMatch =
    normalizedText.match(
      /\b(?:mumbai|delhi|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|surat|jaipur|lucknow|kanpur|nagpur|indore|bhopal|visakhapatnam|vijayawada|coimbatore|madurai|mangalore|mysore|goa|chandigarh|ludhiana|amritsar|jalandhar|patna|ranchi|guwahati|bhubaneswar|raipur|jamshedpur|dehradun|shimla|jammu|srinagar|varanasi|agra|meerut|bareilly|gwalior|jabalpur|noida|ghaziabad|faridabad|gurgaon|kochi|tirupati|cochin)\b/gi,
    );

  if (cityListMatch) {
    const uniqueCities = [
      ...new Set(
        cityListMatch.map((city) =>
          city.toLowerCase(),
        ),
      ),
    ];

    locationConditions.push(
      'Cities: ' +
        uniqueCities
          .slice(0, 20)
          .join(', '),
    );
  }

  if (locationConditions.length > 0) {
    rules.location_coverage = {
      conditions: locationConditions,
      raw: normalizedText.substring(0, 500),
    };
  }

  return rules;
}

// =====================================================
// VALIDATION CONFIG
// =====================================================

export const VALIDATION_CONFIG = {
  salary: {
    min: 1000,
    max: 10000000,
  },
  cibil: {
    min: 300,
    max: 900,
  },
  age: {
    min: 18,
    max: 70,
  },
  tenure_months: {
    min: 1,
    max: 360,
  },
  loan_amount: {
    min: 1,
    max: 100000000,
  },
  foir_percent: {
    min: 0,
    max: 100,
  },
  roi_percent: {
    min: 0,
    max: 50,
  },
} as const;

// =====================================================
// NORMALIZE + VALIDATE RULES
// =====================================================

export function normalizeAndValidateRules(
  rules: PolicyRules,
  sourceText: string,
): NormalizedRulesResult {
  const validationLog: ValidationLogEntry[] = [];

  const normalized: PolicyRules = {
    ...rules,
  };

  const text = (sourceText || '')
    .replace(/\s+/g, ' ')
    .trim();

  const reject = (
    field: keyof PolicyRules,
    reason: string,
  ): void => {
    validationLog.push({
      field,
      reason,
      originalValue: normalized[field],
      sourceSnippet: text.substring(0, 500),
    });

    normalized[field] = null as never;
  };

  const inRange = (
    value: number | null,
    min: number,
    max: number,
  ): boolean =>
    value !== null &&
    value !== undefined &&
    value >= min &&
    value <= max;

  // Salary

  if (
    normalized.min_salary !== null &&
    normalized.min_salary !== undefined
  ) {
    if (
      normalized.min_salary <
        VALIDATION_CONFIG.salary.min ||
      normalized.min_salary >
        VALIDATION_CONFIG.salary.max
    ) {
      reject(
        'min_salary',
        `Salary ${normalized.min_salary} outside realistic range [${VALIDATION_CONFIG.salary.min}, ${VALIDATION_CONFIG.salary.max}]`,
      );
    } else if (normalized.min_salary < 1000) {
      const nearbyRoi =
        text.match(
          /\d+(?:\.\d+)?\s*%/i,
        );

      if (nearbyRoi) {
        const roiVal = parseFloat(
          nearbyRoi[0],
        );

        if (
          Math.abs(
            roiVal -
              normalized.min_salary,
          ) < 1
        ) {
          reject(
            'min_salary',
            `Salary ${normalized.min_salary} likely misread from ROI ${roiVal}% in nearby text`,
          );
        }
      }
    }
  }

  if (
    normalized.max_salary !== null &&
    normalized.max_salary !== undefined
  ) {
    if (
      normalized.max_salary <
        VALIDATION_CONFIG.salary.min ||
      normalized.max_salary >
        VALIDATION_CONFIG.salary.max
    ) {
      reject(
        'max_salary',
        `Salary ${normalized.max_salary} outside realistic range [${VALIDATION_CONFIG.salary.min}, ${VALIDATION_CONFIG.salary.max}]`,
      );
    }
  }

  // CIBIL

  if (
    normalized.min_cibil !== null &&
    normalized.min_cibil !== undefined
  ) {
    if (
      !inRange(
        normalized.min_cibil,
        VALIDATION_CONFIG.cibil.min,
        VALIDATION_CONFIG.cibil.max,
      )
    ) {
      reject(
        'min_cibil',
        `CIBIL ${normalized.min_cibil} outside valid range [${VALIDATION_CONFIG.cibil.min}, ${VALIDATION_CONFIG.cibil.max}]`,
      );
    }
  }

  if (
    normalized.max_cibil !== null &&
    normalized.max_cibil !== undefined
  ) {
    if (
      !inRange(
        normalized.max_cibil,
        VALIDATION_CONFIG.cibil.min,
        VALIDATION_CONFIG.cibil.max,
      )
    ) {
      reject(
        'max_cibil',
        `CIBIL ${normalized.max_cibil} outside valid range [${VALIDATION_CONFIG.cibil.min}, ${VALIDATION_CONFIG.cibil.max}]`,
      );
    }
  }

  // Age

  if (
    normalized.min_age !== null &&
    normalized.min_age !== undefined
  ) {
    if (
      !inRange(
        normalized.min_age,
        VALIDATION_CONFIG.age.min,
        VALIDATION_CONFIG.age.max,
      )
    ) {
      reject(
        'min_age',
        `Age ${normalized.min_age} outside realistic range [${VALIDATION_CONFIG.age.min}, ${VALIDATION_CONFIG.age.max}]`,
      );
    }
  }

  if (
    normalized.max_age !== null &&
    normalized.max_age !== undefined
  ) {
    if (
      !inRange(
        normalized.max_age,
        VALIDATION_CONFIG.age.min,
        VALIDATION_CONFIG.age.max,
      )
    ) {
      reject(
        'max_age',
        `Age ${normalized.max_age} outside realistic range [${VALIDATION_CONFIG.age.min}, ${VALIDATION_CONFIG.age.max}]`,
      );
    }
  }

  // Tenure

  if (
    normalized.min_tenure_months !== null &&
    normalized.min_tenure_months !== undefined
  ) {
    if (
      !inRange(
        normalized.min_tenure_months,
        VALIDATION_CONFIG.tenure_months.min,
        VALIDATION_CONFIG.tenure_months.max,
      )
    ) {
      reject(
        'min_tenure_months',
        `Tenure ${normalized.min_tenure_months} months outside realistic range [${VALIDATION_CONFIG.tenure_months.min}, ${VALIDATION_CONFIG.tenure_months.max}]`,
      );
    }
  }

  if (
    normalized.max_tenure_months !== null &&
    normalized.max_tenure_months !== undefined
  ) {
    if (
      !inRange(
        normalized.max_tenure_months,
        VALIDATION_CONFIG.tenure_months.min,
        VALIDATION_CONFIG.tenure_months.max,
      )
    ) {
      reject(
        'max_tenure_months',
        `Tenure ${normalized.max_tenure_months} months outside realistic range [${VALIDATION_CONFIG.tenure_months.min}, ${VALIDATION_CONFIG.tenure_months.max}]`,
      );
    }
  }

  // Loan amount

  if (
    normalized.min_loan_amount !== null &&
    normalized.min_loan_amount !== undefined
  ) {
    if (
      !inRange(
        normalized.min_loan_amount,
        VALIDATION_CONFIG.loan_amount.min,
        VALIDATION_CONFIG.loan_amount.max,
      )
    ) {
      reject(
        'min_loan_amount',
        `Loan amount ${normalized.min_loan_amount} outside realistic range [${VALIDATION_CONFIG.loan_amount.min}, ${VALIDATION_CONFIG.loan_amount.max}]`,
      );
    }
  }

  if (
    normalized.max_loan_amount !== null &&
    normalized.max_loan_amount !== undefined
  ) {
    if (
      !inRange(
        normalized.max_loan_amount,
        VALIDATION_CONFIG.loan_amount.min,
        VALIDATION_CONFIG.loan_amount.max,
      )
    ) {
      reject(
        'max_loan_amount',
        `Loan amount ${normalized.max_loan_amount} outside realistic range [${VALIDATION_CONFIG.loan_amount.min}, ${VALIDATION_CONFIG.loan_amount.max}]`,
      );
    }
  }

  // FOIR

  if (
    normalized.foir_percent !== null &&
    normalized.foir_percent !== undefined
  ) {
    if (
      normalized.foir_percent >
      VALIDATION_CONFIG.foir_percent.max
    ) {
      const explicitHighFoir =
        text.match(
          /(?:foir|dbr)\s*(?:up\s*to|upto|max|maximum|allowed)\s*(\d+(?:\.\d+)?)\s*%/i,
        );

      if (
        !explicitHighFoir ||
        parseFloat(explicitHighFoir[1]) <
          normalized.foir_percent
      ) {
        reject(
          'foir_percent',
          `FOIR ${normalized.foir_percent}% exceeds realistic max ${VALIDATION_CONFIG.foir_percent.max}% and not explicitly supported by source`,
        );
      }
    }
  }

  // ROI

  if (
    normalized.roi_min !== null &&
    normalized.roi_min !== undefined
  ) {
    if (
      !inRange(
        normalized.roi_min,
        VALIDATION_CONFIG.roi_percent.min,
        VALIDATION_CONFIG.roi_percent.max,
      )
    ) {
      reject(
        'roi_min',
        `ROI ${normalized.roi_min}% outside realistic range [${VALIDATION_CONFIG.roi_percent.min}, ${VALIDATION_CONFIG.roi_percent.max}]`,
      );
    }
  }

  if (
    normalized.roi_max !== null &&
    normalized.roi_max !== undefined
  ) {
    if (
      !inRange(
        normalized.roi_max,
        VALIDATION_CONFIG.roi_percent.min,
        VALIDATION_CONFIG.roi_percent.max,
      )
    ) {
      reject(
        'roi_max',
        `ROI ${normalized.roi_max}% outside realistic range [${VALIDATION_CONFIG.roi_percent.min}, ${VALIDATION_CONFIG.roi_percent.max}]`,
      );
    }
  }

  return {
    rules: normalized,
    validationLog,
  };
}

// =====================================================
// CONVERT BANK DOCUMENTS TO UNIFIED TEXT
// =====================================================

export async function convertBankDocumentsToText(
  pool: Pool,
  bankId: number,
): Promise<{
  bankId: number;
  bankName: string;
  bankCode: string;
  unifiedText: string;
  validation: UnifiedValidation;
  stats: {
    totalSourceFiles: number;
    convertedFiles: number;
    failedFiles: number;
  };
}> {
  const client: PoolClient =
    await pool.connect();

  try {
    const bankResult = await client.query<{
      id: number;
      name: string;
      code: string;
    }>(
      'SELECT id, name, code FROM banks WHERE id = $1',
      [bankId],
    );

    if (bankResult.rowCount! === 0) {
      throw new Error('Bank not found');
    }

    const bank = bankResult.rows[0];

    const filesResult =
      await client.query<PolicyFile>(
        `SELECT id, file_name, file_path, file_type, extracted_text
         FROM bank_policy_files
         WHERE bank_id = $1
         ORDER BY id`,
        [bankId],
      );

    if (filesResult.rowCount! === 0) {
      throw new Error(
        'No policy documents found for this bank',
      );
    }

    const unifiedParts: string[] = [];
    const fileStatuses: FileStatus[] = [];

    let totalSourceFiles = 0;
    let convertedFiles = 0;
    let failedFiles = 0;

    for (const file of filesResult.rows) {
      totalSourceFiles++;

      let text = file.extracted_text;

      if (!text && file.file_path) {
        const ext = path
          .extname(
            file.file_name ||
              file.file_path,
          )
          .toLowerCase();

        const extracted =
          await extractTextFromFile(
            file.file_path,
            ext,
          );

        if (
          extracted &&
          extracted.rawText
        ) {
          text = extracted.rawText;
        }
      }

      if (text && text.trim()) {
        const header =
          `\n${'='.repeat(80)}\n` +
          `SOURCE FILE: ${file.file_name}\n` +
          `TYPE: ${file.file_type || 'unknown'}\n` +
          `${'='.repeat(80)}\n\n`;

        unifiedParts.push(
          header + text.trim(),
        );

        convertedFiles++;

        fileStatuses.push({
          fileId: file.id,
          fileName: file.file_name,
          status: 'converted',
        });
      } else {
        failedFiles++;

        fileStatuses.push({
          fileId: file.id,
          fileName: file.file_name,
          status: 'failed_or_empty',
        });
      }
    }

    const unifiedText =
      unifiedParts.join('\n\n');

    const validation =
      validateUnifiedText(
        unifiedText,
        fileStatuses,
        convertedFiles,
        totalSourceFiles,
      );

    return {
      bankId: bank.id,
      bankName: bank.name,
      bankCode: bank.code,
      unifiedText,
      validation,
      stats: {
        totalSourceFiles,
        convertedFiles,
        failedFiles,
      },
    };
  } finally {
    client.release();
  }
}

// =====================================================
// VALIDATE UNIFIED TEXT
// =====================================================

export function validateUnifiedText(
  unifiedText: string,
  fileStatuses: FileStatus[],
  convertedFiles: number,
  totalSourceFiles: number,
): UnifiedValidation {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (
    !unifiedText ||
    unifiedText.trim().length === 0
  ) {
    issues.push(
      'Unified text is empty',
    );
  }

  if (
    convertedFiles === 0 &&
    totalSourceFiles > 0
  ) {
    issues.push(
      'No files could be converted to text',
    );
  }

  if (
    convertedFiles < totalSourceFiles
  ) {
    const failed = fileStatuses.filter(
      (status) =>
        status.status ===
        'failed_or_empty',
    );

    warnings.push(
      'Some files could not be converted: ' +
        failed
          .map((file) => file.fileName)
          .join(', '),
    );
  }

  const hasReasonableLength =
    !!unifiedText &&
    unifiedText.length > 100;

  if (
    !hasReasonableLength &&
    convertedFiles > 0
  ) {
    warnings.push(
      'Converted text is very short, may indicate extraction issues',
    );
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    characterCount:
      unifiedText
        ? unifiedText.length
        : 0,
    convertedFiles,
    totalSourceFiles,
  };
}

// =====================================================
// SAVE UNIFIED DOCUMENT
// =====================================================

export async function saveUnifiedBankDocument(
  pool: Pool,
  bankId: number,
  unifiedText: string,
  validation: UnifiedValidation,
  stats: {
    totalSourceFiles: number;
    convertedFiles: number;
    failedFiles: number;
  },
): Promise<number> {
  const client: PoolClient =
    await pool.connect();

  try {
    const bankResult = await client.query<{
      name: string;
      code: string;
    }>(
      'SELECT name, code FROM banks WHERE id = $1',
      [bankId],
    );

    const bankName =
      bankResult.rows[0]?.name ||
      'Unknown';

    const bankCode =
      bankResult.rows[0]?.code ||
      'BANK';

    const fileName =
      `${bankCode}_Unified_Policy_` +
      `${new Date()
        .toISOString()
        .slice(0, 10)}.txt`;

    const description =
      `Unified text conversion for ${bankName}. ` +
      `Original files: ${stats.convertedFiles}/` +
      `${stats.totalSourceFiles}. ` +
      `Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`;

    const syntheticPath =
      `unified://${bankCode}/${fileName}`;

    const existing =
      await client.query<{
        id: number;
      }>(
        `SELECT id
         FROM bank_policy_files
         WHERE bank_id = $1
           AND description = $2`,
        [bankId, description],
      );

    if (existing.rowCount! > 0) {
      await client.query(
        `UPDATE bank_policy_files
         SET extracted_text = $1,
             metadata = $2
         WHERE id = $3`,
        [
          unifiedText,
          {
            is_unified_text: true,
            validation,
            stats,
            converted_at:
              new Date().toISOString(),
          },
          existing.rows[0].id,
        ],
      );

      return existing.rows[0].id;
    }

    const result =
      await client.query<{
        id: number;
      }>(
        `INSERT INTO bank_policy_files
         (
           bank_id,
           file_name,
           file_path,
           file_type,
           description,
           extracted_text,
           metadata,
           uploaded_by,
           uploaded_at
         )
         VALUES
         (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           NOW()
         )
         RETURNING id`,
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
            converted_at:
              new Date().toISOString(),
          },
          1,
        ],
      );

    return result.rows[0].id;
  } finally {
    client.release();
  }
}

// =====================================================
// VERSION
// =====================================================

export async function getNextVersionLabel(
  client: PoolClient,
  bankId: number,
  loanType: string,
): Promise<string> {
  const res =
    await client.query<{
      version: string | null;
    }>(
      `SELECT version
       FROM policy_versions
       WHERE bank_id = $1
         AND loan_type = $2
       ORDER BY id ASC`,
      [bankId, loanType],
    );

  if (res.rowCount! === 0) {
    return 'V1';
  }

  let maxV = 0;

  for (const row of res.rows) {
    const vStr = String(
      row.version || '',
    ).trim();

    const vMatch =
      vStr.match(/^v?(\d+)/i);

    if (vMatch) {
      const num = parseInt(
        vMatch[1],
        10,
      );

      if (num > maxV) {
        maxV = num;
      }
    }
  }

  return `V${maxV + 1}`;
}

// =====================================================
// GET OR CREATE BANK
// =====================================================

export async function getOrCreateBank(
  client: PoolClient,
  bankInfo: BankInfo,
): Promise<Record<string, unknown>> {
  let res =
    await client.query(
      `SELECT *
       FROM banks
       WHERE LOWER(name) = LOWER($1)
          OR (
            code IS NOT NULL
            AND code = $2
          )`,
      [
        bankInfo.name,
        bankInfo.code,
      ],
    );

  if (res.rowCount! > 0) {
    return res.rows[0];
  }

  res =
    await client.query(
      `INSERT INTO banks
       (name, code, is_active)
       VALUES
       ($1, $2, true)
       RETURNING *`,
      [
        bankInfo.name,
        bankInfo.code,
      ],
    );

  return res.rows[0];
}

// =====================================================
// IMPORT POLICY FILES
// =====================================================

export async function importPolicyFiles(
  pool: Pool,
  options: ImportPolicyOptions = {},
): Promise<ImportStats> {
  const policyFilesRoot =
    options.rootDir ||
    path.join(
      __dirname,
      '..',
      'Policy-files',
    );

  const userId =
    options.userId ?? null;

  const dryRun =
    options.dryRun === true;

  const client: PoolClient =
    await pool.connect();

  const stats: ImportStats = {
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
    banks: [],
  };

  try {
    if (!fs.existsSync(policyFilesRoot)) {
      throw new Error(
        `Policy directory does not exist: ${policyFilesRoot}`,
      );
    }

    function scanDirectory(
      dirPath: string,
    ): ScannedFile[] {
      let results: ScannedFile[] = [];

      try {
        const list =
          fs.readdirSync(
            dirPath,
            {
              withFileTypes: true,
            },
          );

        for (const entry of list) {
          const fullPath =
            path.join(
              dirPath,
              entry.name,
            );

          if (entry.isDirectory()) {
            results =
              results.concat(
                scanDirectory(
                  fullPath,
                ),
              );
          } else if (
            entry.isFile()
          ) {
            results.push({
              fullPath,
              fileName:
                entry.name,
              ext: path
                .extname(
                  entry.name,
                )
                .toLowerCase(),
              sizeBytes:
                fs.statSync(
                  fullPath,
                ).size,
              relativeDir:
                path.relative(
                  policyFilesRoot,
                  dirPath,
                ),
              folderName:
                path.basename(
                  dirPath,
                ),
            });
          }
        }
      } catch (err) {
        const error =
          err as Error;

        stats.errors.push(
          `Failed to scan directory ${dirPath}: ${error.message}`,
        );
      }

      return results;
    }

    const allFiles =
      scanDirectory(
        policyFilesRoot,
      );

    stats.totalFilesScanned =
      allFiles.length;

    const bankGroups =
      new Map<
        string,
        {
          bankInfo: BankInfo;
          files: ScannedFile[];
        }
      >();

    for (const file of allFiles) {
      let bankFolder =
        file.folderName;

      if (
        bankFolder.toLowerCase() ===
          'bank policy' ||
        bankFolder.toLowerCase() ===
          'policy-files'
      ) {
        bankFolder =
          path.basename(
            path.dirname(
              file.fullPath,
            ),
          );
      }

      if (
        file.relativeDir.includes(
          path.sep,
        )
      ) {
        const parts =
          file.relativeDir.split(
            path.sep,
          );

        if (
          parts.length > 1 &&
          parts[0].toLowerCase() ===
            'bank policy'
        ) {
          bankFolder =
            parts[1];
        }
      }

      const bankInfo =
        detectBankFromPath(
          bankFolder,
          file.fileName,
        );

      const groupKey =
        bankInfo.name;

      if (
        !bankGroups.has(
          groupKey,
        )
      ) {
        bankGroups.set(
          groupKey,
          {
            bankInfo,
            files: [],
          },
        );
      }

      bankGroups
        .get(groupKey)!
        .files.push(file);
    }

    stats.banksDetected =
      bankGroups.size;

    for (const group of bankGroups.values()) {
      let bankRecord:
        | {
            id: number;
            name: string;
            code: string;
          }
        | null = null;

      const existingBank =
        await client.query<{
          id: number;
          name: string;
          code: string;
        }>(
          `SELECT *
           FROM banks
           WHERE LOWER(name) = LOWER($1)
              OR (
                code IS NOT NULL
                AND code = $2
              )`,
          [
            group.bankInfo.name,
            group.bankInfo.code,
          ],
        );

      if (
        existingBank.rowCount! > 0
      ) {
        bankRecord =
          existingBank.rows[0];

        stats.banksUpdated++;
      } else {
        const inserted =
          await client.query<{
            id: number;
            name: string;
            code: string;
          }>(
            `INSERT INTO banks
             (name, code, is_active)
             VALUES
             ($1, $2, true)
             RETURNING *`,
            [
              group.bankInfo.name,
              group.bankInfo.code,
            ],
          );

        bankRecord =
          inserted.rows[0];

        stats.banksCreated++;
      }

      const bankDetail:
        ImportBankDetail = {
        bankName:
          bankRecord.name,
        bankCode:
          bankRecord.code,
        totalFiles:
          group.files.length,
        registeredFiles: 0,
        skippedFiles: 0,
        extractedFiles: 0,
        errors: [],
      };

      for (const file of group.files) {
        const ext =
          file.ext;

        if (
          ![
            '.pdf',
            '.xlsx',
            '.xls',
            '.xlsb',
            '.csv',
            '.txt',
            '.doc',
            '.docx',
            '.jpg',
            '.jpeg',
            '.png',
            '.bmp',
            '.webp',
            '.gif',
          ].includes(ext)
        ) {
          stats.filesSkipped++;
          bankDetail.skippedFiles++;
          continue;
        }

        const existing =
          await client.query<{
            id: number;
            extracted_text: string | null;
          }>(
            `SELECT id, extracted_text
             FROM bank_policy_files
             WHERE bank_id = $1
               AND file_path = $2`,
            [
              bankRecord.id,
              file.fullPath,
            ],
          );

        if (
          existing.rowCount! > 0 &&
          existing.rows[0]
            .extracted_text
        ) {
          stats.filesRegistered++;
          bankDetail.registeredFiles++;
          continue;
        }

        if (dryRun) {
          // Original code used stats.filesScanned,
          // but that field did not exist.
          // In dry-run mode we simply skip
          // database modification.
          continue;
        }

        try {
          const extracted =
            await extractTextFromFile(
              file.fullPath,
              file.ext,
            );

          const extractedText =
            getTextFromStructured(
              extracted,
            );

          if (extractedText) {
            const meta: Record<
              string,
              unknown
            > = {
              extraction_format:
                extracted?.format ||
                'text',
            };

            if (
              extracted?.sourceType
            ) {
              meta.document_type =
                extracted.sourceType;
            }

            if (
              existing.rowCount! > 0
            ) {
              await client.query(
                `UPDATE bank_policy_files
                 SET extracted_text = $1,
                     metadata =
                       COALESCE(
                         metadata,
                         '{}'::jsonb
                       )
                       || $2::jsonb
                 WHERE id = $3`,
                [
                  extractedText,
                  JSON.stringify(
                    meta,
                  ),
                  existing.rows[0].id,
                ],
              );
            } else {
              await client.query(
                `INSERT INTO bank_policy_files
                 (
                   bank_id,
                   file_name,
                   file_path,
                   file_type,
                   file_size_bytes,
                   uploaded_by,
                   description,
                   extracted_text,
                   metadata
                 )
                 VALUES
                 (
                   $1,
                   $2,
                   $3,
                   $4,
                   $5,
                   $6,
                   $7,
                   $8,
                   $9
                 )`,
                [
                  bankRecord.id,
                  file.fileName,
                  file.fullPath,
                  file.ext,
                  file.sizeBytes,
                  userId,
                  'Registered from policy documents folder',
                  extractedText,
                  JSON.stringify(
                    meta,
                  ),
                ],
              );
            }

            stats.extractedFiles++;
            bankDetail.extractedFiles++;

            bankDetail.registeredFiles++;
            stats.filesRegistered++;
          } else {
            bankDetail.skippedFiles++;
            stats.filesSkipped++;
          }
        } catch (err) {
          const error =
            err as Error;

          console.warn(
            `Extraction failed for ${file.fullPath}:`,
            error.message,
          );

          stats.extractionErrors++;
          bankDetail.skippedFiles++;
          stats.filesSkipped++;
        }
      }

      stats.banks.push(
        bankDetail,
      );
    }

    stats.completedAt =
      new Date();

    return stats;
  } finally {
    client.release();
  }
}

// =====================================================
// SCAN POLICY FILES
// =====================================================

export async function scanPolicyFiles(
  options: {
    rootDir?: string;
  } = {},
): Promise<
  ScanPolicyResult | { error: string }
> {
  const policyFilesRoot =
    options.rootDir ||
    path.join(
      __dirname,
      '..',
      'Policy-files',
    );

  if (
    !fs.existsSync(
      policyFilesRoot,
    )
  ) {
    return {
      error: `Policy directory does not exist: ${policyFilesRoot}`,
    };
  }

  function scanDirectory(
    dirPath: string,
  ): ScannedFile[] {
    let results: ScannedFile[] = [];

    try {
      const list =
        fs.readdirSync(
          dirPath,
          {
            withFileTypes: true,
          },
        );

      for (const entry of list) {
        const fullPath =
          path.join(
            dirPath,
            entry.name,
          );

        if (
          entry.isDirectory()
        ) {
          results =
            results.concat(
              scanDirectory(
                fullPath,
              ),
            );
        } else if (
          entry.isFile()
        ) {
          results.push({
            fullPath,
            fileName:
              entry.name,
            ext: path
              .extname(
                entry.name,
              )
              .toLowerCase(),
            sizeBytes:
              fs.statSync(
                fullPath,
              ).size,
            relativeDir:
              path.relative(
                policyFilesRoot,
                dirPath,
              ),
            folderName:
              path.basename(
                dirPath,
              ),
          });
        }
      }
    } catch {
      // Preserve original behavior:
      // ignore scan errors.
    }

    return results;
  }

  const allFiles =
    scanDirectory(
      policyFilesRoot,
    );

  const supportedExts =
    new Set([
      '.pdf',
      '.xlsx',
      '.xls',
      '.xlsb',
      '.csv',
      '.txt',
      '.doc',
      '.docx',
      '.jpg',
      '.jpeg',
      '.png',
      '.bmp',
      '.webp',
      '.gif',
    ]);

  const supported =
    allFiles.filter((file) =>
      supportedExts.has(
        file.ext,
      ),
    );

  const unsupported =
    allFiles.filter(
      (file) =>
        !supportedExts.has(
          file.ext,
        ),
    );

  return {
    totalFilesScanned:
      allFiles.length,

    supportedFiles:
      supported.length,

    unsupportedFiles:
      unsupported.length,

    supported:
      supported.map(
        (file) => ({
          fileName:
            file.fileName,
          ext: file.ext,
          sizeBytes:
            file.sizeBytes,
          folder:
            file.folderName,
          relativePath:
            file.relativeDir,
        }),
      ),

    unsupported:
      unsupported.map(
        (file) => ({
          fileName:
            file.fileName,
          ext: file.ext,
          sizeBytes:
            file.sizeBytes,
          folder:
            file.folderName,
          relativePath:
            file.relativeDir,
        }),
      ),
  };
}

// =====================================================
// REGISTER POLICY DOCUMENTS
// =====================================================

export async function registerPolicyDocuments(
  pool: Pool,
  options: {
    rootDir?: string;
    userId?: number | null;
  } = {},
): Promise<RegisterStats> {
  const policyFilesRoot =
    options.rootDir ||
    path.join(
      __dirname,
      '..',
      'Policy-files',
    );

  const userId =
    options.userId ?? null;

  const client: PoolClient =
    await pool.connect();

  const supportedExtensions =
    new Set([
      '.pdf',
      '.xlsx',
      '.xls',
      '.xlsb',
      '.csv',
      '.txt',
      '.doc',
      '.docx',
      '.jpg',
      '.jpeg',
      '.png',
      '.bmp',
      '.webp',
      '.gif',
    ]);

  const stats: RegisterStats = {
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
    banks: [],
  };

  try {
    if (
      !fs.existsSync(
        policyFilesRoot,
      )
    ) {
      throw new Error(
        `Policy directory does not exist: ${policyFilesRoot}`,
      );
    }

    function scanDirectory(
      dirPath: string,
    ): ScannedFile[] {
      let results: ScannedFile[] = [];

      try {
        const list =
          fs.readdirSync(
            dirPath,
            {
              withFileTypes: true,
            },
          );

        for (const entry of list) {
          const fullPath =
            path.join(
              dirPath,
              entry.name,
            );

          if (
            entry.isDirectory()
          ) {
            results =
              results.concat(
                scanDirectory(
                  fullPath,
                ),
              );
          } else if (
            entry.isFile()
          ) {
            results.push({
              fullPath,
              fileName:
                entry.name,
              ext: path
                .extname(
                  entry.name,
                )
                .toLowerCase(),
              sizeBytes:
                fs.statSync(
                  fullPath,
                ).size,
              relativeDir:
                path.relative(
                  policyFilesRoot,
                  dirPath,
                ),
              folderName:
                path.basename(
                  dirPath,
                ),
            });
          }
        }
      } catch (err) {
        const error =
          err as Error;

        stats.errors.push(
          `Failed to scan directory ${dirPath}: ${error.message}`,
        );
      }

      return results;
    }

    const allFiles =
      scanDirectory(
        policyFilesRoot,
      );

    stats.totalFilesScanned =
      allFiles.length;

    stats.supportedFiles =
      allFiles.filter(
        (file) =>
          supportedExtensions.has(
            file.ext,
          ),
      ).length;

    stats.unsupportedFiles =
      allFiles.length -
      stats.supportedFiles;

    const bankGroups =
      new Map<
        string,
        {
          bankInfo: BankInfo;
          files: ScannedFile[];
        }
      >();

    for (const file of allFiles) {
      let bankFolder =
        file.folderName;

      if (
        bankFolder.toLowerCase() ===
          'bank policy' ||
        bankFolder.toLowerCase() ===
          'policy-files'
      ) {
        bankFolder =
          path.basename(
            path.dirname(
              file.fullPath,
            ),
          );
      }

      if (
        file.relativeDir.includes(
          path.sep,
        )
      ) {
        const parts =
          file.relativeDir.split(
            path.sep,
          );

        if (
          parts.length > 1 &&
          parts[0].toLowerCase() ===
            'bank policy'
        ) {
          bankFolder =
            parts[1];
        }
      }

      const bankInfo =
        detectBankFromPath(
          bankFolder,
          file.fileName,
        );

      const groupKey =
        bankInfo.name;

      if (
        !bankGroups.has(
          groupKey,
        )
      ) {
        bankGroups.set(
          groupKey,
          {
            bankInfo,
            files: [],
          },
        );
      }

      bankGroups
        .get(groupKey)!
        .files.push(file);
    }

    for (const group of bankGroups.values()) {
      let bankRecord:
        | {
            id: number;
            name: string;
            code: string;
          }
        | null = null;

      const existingBank =
        await client.query<{
          id: number;
          name: string;
          code: string;
        }>(
          `SELECT *
           FROM banks
           WHERE LOWER(name) = LOWER($1)
              OR (
                code IS NOT NULL
                AND code = $2
              )`,
          [
            group.bankInfo.name,
            group.bankInfo.code,
          ],
        );

      if (
        existingBank.rowCount! > 0
      ) {
        bankRecord =
          existingBank.rows[0];

        stats.banksUpdated++;
      } else {
        const inserted =
          await client.query<{
            id: number;
            name: string;
            code: string;
          }>(
            `INSERT INTO banks
             (name, code, is_active)
             VALUES
             ($1, $2, true)
             RETURNING *`,
            [
              group.bankInfo.name,
              group.bankInfo.code,
            ],
          );

        bankRecord =
          inserted.rows[0];

        stats.banksCreated++;
      }

      const bankDetail:
        ImportBankDetail = {
        bankName:
          bankRecord.name,
        bankCode:
          bankRecord.code,
        totalFiles:
          group.files.length,
        registeredFiles: 0,
        skippedFiles: 0,
        extractedFiles: 0,
        errors: [],
      };

      for (const file of group.files) {
        if (
          !supportedExtensions.has(
            file.ext,
          )
        ) {
          stats.unsupportedFiles++;
          bankDetail.skippedFiles++;
          continue;
        }

        const existing =
          await client.query<{
            id: number;
            extracted_text: string | null;
          }>(
            `SELECT id, extracted_text
             FROM bank_policy_files
             WHERE bank_id = $1
               AND file_path = $2`,
            [
              bankRecord.id,
              file.fullPath,
            ],
          );

        if (
          existing.rowCount! > 0 &&
          existing.rows[0]
            .extracted_text
        ) {
          stats.filesRegistered++;
          bankDetail.registeredFiles++;
          continue;
        }

        try {
          const extracted =
            await extractTextFromFile(
              file.fullPath,
              file.ext,
            );

          const extractedText =
            getTextFromStructured(
              extracted,
            );

          if (extractedText) {
            const meta: Record<
              string,
              unknown
            > = {
              extraction_format:
                extracted?.format ||
                'text',
            };

            if (
              extracted?.sourceType
            ) {
              meta.document_type =
                extracted.sourceType;
            }

            if (
              existing.rowCount! > 0
            ) {
              await client.query(
                `UPDATE bank_policy_files
                 SET extracted_text = $1,
                     metadata =
                       COALESCE(
                         metadata,
                         '{}'::jsonb
                       )
                       || $2::jsonb
                 WHERE id = $3`,
                [
                  extractedText,
                  JSON.stringify(
                    meta,
                  ),
                  existing.rows[0].id,
                ],
              );
            } else {
              await client.query(
                `INSERT INTO bank_policy_files
                 (
                   bank_id,
                   file_name,
                   file_path,
                   file_type,
                   file_size_bytes,
                   uploaded_by,
                   description,
                   extracted_text,
                   metadata
                 )
                 VALUES
                 (
                   $1,
                   $2,
                   $3,
                   $4,
                   $5,
                   $6,
                   $7,
                   $8,
                   $9
                 )`,
                [
                  bankRecord.id,
                  file.fileName,
                  file.fullPath,
                  file.ext,
                  file.sizeBytes,
                  userId,
                  'Registered from policy documents folder',
                  extractedText,
                  JSON.stringify(
                    meta,
                  ),
                ],
              );
            }

            stats.extractedFiles++;
            bankDetail.extractedFiles++;

            bankDetail.registeredFiles++;
            stats.filesRegistered++;
          } else {
            bankDetail.skippedFiles++;
            stats.filesSkipped++;
          }
        } catch (err) {
          const error =
            err as Error;

          console.warn(
            `Extraction failed for ${file.fullPath}:`,
            error.message,
          );

          stats.extractionErrors++;
          bankDetail.skippedFiles++;
          stats.filesSkipped++;
        }
      }

      stats.banks.push(
        bankDetail,
      );
    }

    stats.completedAt =
      new Date();

    return stats;
  } finally {
    client.release();
  }
}

// =====================================================
// DOCUMENT CLASSIFICATION
// =====================================================

export function classifyDocument(
  fileName: string,
  extractedText: string | null,
): string {
  const name =
    (fileName || '').toLowerCase();

  const text =
    (extractedText || '').toLowerCase();

  const filenameHints: Record<
    string,
    RegExp
  > = {
    'BT/Surrogate Program':
      /bt\s*surrogate|balance\s*transfer|surrogate|stp|spend\s*the\s*payment|top.?up/i,

    'FOIR Grid':
      /foir|dbr|obligation\s*ratio|income\s*ratio/i,

    'ROI/Pricing Grid':
      /roi|rate\s*of\s*interest|pricing|interest\s*rate\s*grid|rate\s*grid/i,

    'Location/Pincode List':
      /location|pincode|pin.?code|branch\s*list|active\s*loc|city\s*master|zone/i,

    'Company List':
      /company\s*list|vendor\s*list|employer\s*list|co.?brand|approved\s*company|company\s*catalog/i,

    'KYC/Process document':
      /kyc|process|undertaking|declaration|indemnity|mail\s*format|ovd|address\s*proof|document\s*checklist/i,

    'Main Eligibility Policy':
      /policy|eligibility|norm|guideline|master\s*policy/i,
  };

  const contentHints: Record<
    string,
    RegExp
  > = {
    'Main Eligibility Policy':
      /eligibility|norm|cibil|salary|tenure|loan\s*amount|age\s*limit|foir\s*norm|rate\s*of\s*interest|processing\s*fee/i,

    'Company List':
      /company\s*name|employer\s*code|vendor|co.?brand|approved\s*company|organization\s*list/i,

    'Location/Pincode List':
      /pincode|pin.?code|branch\s*name|city|state|zone|region|location\s*master/i,

    'FOIR Grid':
      /foir\s*%|dbr\s*%|obligation\s*to\s*income|income\s*deduction|monthly\s*obligation/i,

    'ROI/Pricing Grid':
      /roi\s*%|rate\s*of\s*interest|pricing\s*sheet|interest\s*rate\s*grid| slab\s*rate/i,

    'BT/Surrogate Program':
      /bt\s*surrogate|balance\s*transfer|surrogate\s*program|stp|spend\s*the\s*payment|top.?up\s*loan/i,

    'KYC/Process document':
      /kyc|know\s*your\s*customer|undertaking|declaration|indemnity|mail\s*format|ovd|address\s*proof/i,
  };

  let bestType = 'Other';
  let bestScore = 0;

  for (const [
    type,
    regex,
  ] of Object.entries(
    filenameHints,
  )) {
    const matches =
      name.match(regex);

    if (matches) {
      const score =
        matches.length * 2;

      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
  }

  for (const [
    type,
    regex,
  ] of Object.entries(
    contentHints,
  )) {
    const matches =
      text.match(regex);

    if (matches) {
      const score =
        matches.length;

      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }
  }

  if (
    bestType === 'Other' &&
    /\.xlsx?$/.test(name)
  ) {
    if (
      /loc|pincode|pin|branch|city/.test(
        name,
      )
    ) {
      bestType =
        'Location/Pincode List';
    } else if (
      /company|employer|vendor/.test(
        name,
      )
    ) {
      bestType = 'Company List';
    } else if (
      /roi|rate|pricing/.test(
        name,
      )
    ) {
      bestType =
        'ROI/Pricing Grid';
    } else if (
      /foir|dbr/.test(name)
    ) {
      bestType = 'FOIR Grid';
    }
  }

  return bestType;
}

// =====================================================
// CLASSIFY BANK DOCUMENTS
// =====================================================

export async function classifyBankDocuments(
  pool: Pool,
  bankId: number,
): Promise<ClassificationResult> {
  const client: PoolClient =
    await pool.connect();

  try {
    const result =
      await client.query<{
        id: number;
        file_name: string;
        extracted_text: string | null;
      }>(
        `SELECT
           id,
           file_name,
           extracted_text
         FROM bank_policy_files
         WHERE bank_id = $1`,
        [bankId],
      );

    const counts: Record<
      string,
      number
    > = {};

    const updates: Array<{
      id: number;
      fileName: string;
      docType: string;
    }> = [];

    for (const file of result.rows) {
      const docType =
        classifyDocument(
          file.file_name,
          file.extracted_text,
        );

      counts[docType] =
        (counts[docType] || 0) + 1;

      updates.push({
        id: file.id,
        fileName:
          file.file_name,
        docType,
      });
    }

    for (const update of updates) {
      await client.query(
        `UPDATE bank_policy_files
         SET metadata = $1
         WHERE id = $2`,
        [
          {
            document_type:
              update.docType,
            classified_at:
              new Date().toISOString(),
          },
          update.id,
        ],
      );
    }

    return {
      counts,
      total:
        result.rows.length,
    };
  } finally {
    client.release();
  }
}

// =====================================================
// ABFL UNIFIED DOCUMENT
// =====================================================

export async function rebuildABFLUnifiedDocument(
  pool: Pool,
  bankId: number,
): Promise<ABFLConversionResult> {
  const client: PoolClient =
    await pool.connect();

  try {
    const bankResult =
      await client.query<{
        id: number;
        name: string;
        code: string;
      }>(
        `SELECT id, name, code
         FROM banks
         WHERE id = $1`,
        [bankId],
      );

    if (
      bankResult.rowCount! === 0
    ) {
      throw new Error(
        'Bank not found',
      );
    }

    const bank =
      bankResult.rows[0];

    const filesResult =
      await client.query<PolicyFile>(
        `SELECT
           id,
           file_name,
           file_path,
           file_type,
           extracted_text
         FROM bank_policy_files
         WHERE bank_id = $1
         ORDER BY id`,
        [bankId],
      );

    if (
      filesResult.rowCount! === 0
    ) {
      throw new Error(
        'No policy documents found for this bank',
      );
    }

    const locationFileNames = [
      'ABFL ACTIVE LOC 22-08-24.xlsx',
      "Aditya birla Jan'25 Pin-code allocation with additional branches v2.xlsx",
    ];

    const locationPatterns: RegExp[] = [
      /active\s*loc/i,
      /pin.?code/i,
      /pincode/i,
      /branch\s*allocation/i,
      /serviceable\s*location/i,
      /location\s*list/i,
      /city\s*list/i,
    ];

    function isLocationFile(
      fileName: string,
      filePath: string | null,
    ): boolean {
      const name =
        (fileName || '').toLowerCase();

      const filePathLower =
        (filePath || '').toLowerCase();

      for (const locName of locationFileNames) {
        if (
          name ===
          locName.toLowerCase()
        ) {
          return true;
        }
      }

      for (const pattern of locationPatterns) {
        if (
          pattern.test(name) ||
          pattern.test(
            filePathLower,
          )
        ) {
          return true;
        }
      }

      const extension =
        path.extname(name);

      if (
        ['.xlsx', '.xls', '.xlsb'].includes(
          extension,
        )
      ) {
        const hasLocationKeywords =
          /location|pincode|pin.?code|branch|city|serviceable/i.test(
            name,
          );

        if (
          hasLocationKeywords
        ) {
          return true;
        }
      }

      return false;
    }

    const unifiedParts: string[] = [];
    const includedFiles: IncludedFile[] = [];
    const excludedFiles: ExcludedFile[] = [];

    let totalSourceFiles = 0;
    let convertedFiles = 0;
    let failedFiles = 0;

    for (const file of filesResult.rows) {
      totalSourceFiles++;

      if (
        isLocationFile(
          file.file_name,
          file.file_path,
        )
      ) {
        excludedFiles.push({
          id: file.id,
          fileName:
            file.file_name,
          reason:
            'location_data',
        });

        continue;
      }

      let text =
        file.extracted_text;

      if (
        !text &&
        file.file_path
      ) {
        const ext =
          path
            .extname(
              file.file_name ||
                file.file_path,
            )
            .toLowerCase();

        const extracted =
          await extractTextFromFile(
            file.file_path,
            ext,
          );

        if (
          extracted &&
          extracted.rawText
        ) {
          text =
            extracted.rawText;
        }
      }

      if (text && text.trim()) {
        const header =
          `\n${'='.repeat(80)}\n` +
          `SOURCE FILE: ${file.file_name}\n` +
          `TYPE: ${file.file_type || 'unknown'}\n` +
          `${'='.repeat(80)}\n\n`;

        unifiedParts.push(
          header + text.trim(),
        );

        convertedFiles++;

        includedFiles.push({
          id: file.id,
          fileName:
            file.file_name,
          textLength:
            text.trim().length,
        });
      } else {
        failedFiles++;
      }
    }

    const unifiedText =
      unifiedParts.join('\n\n');

    const validation =
      validateUnifiedText(
        unifiedText,
        includedFiles.map(
          (file) => ({
            fileId: file.id,
            fileName:
              file.fileName,
            status:
              'converted',
          }),
        ),
        convertedFiles,
        totalSourceFiles -
          excludedFiles.length,
      );

    return {
      bankId: bank.id,
      bankName: bank.name,
      bankCode: bank.code,
      unifiedText,
      validation,
      stats: {
        totalSourceFiles:
          totalSourceFiles -
          excludedFiles.length,
        convertedFiles,
        failedFiles,
        excludedFiles:
          excludedFiles.length,
      },
      includedFiles,
      excludedFiles,
    };
  } finally {
    client.release();
  }
}

// =====================================================
// REPLACE ABFL UNIFIED DOCUMENT
// =====================================================

export async function replaceABFLUnifiedDocument(
  pool: Pool,
  bankId: number,
  conversionResult: ABFLConversionResult,
): Promise<ReplaceUnifiedResult> {
  const client: PoolClient =
    await pool.connect();

  try {
    const {
      unifiedText,
      validation,
      stats,
      includedFiles,
      excludedFiles,
    } = conversionResult;

    const bankResult =
      await client.query<{
        name: string;
        code: string;
      }>(
        `SELECT name, code
         FROM banks
         WHERE id = $1`,
        [bankId],
      );

    const bankName =
      bankResult.rows[0]?.name ||
      'Unknown';

    const bankCode =
      bankResult.rows[0]?.code ||
      'BANK';

    const fileName =
      `${bankCode}_Unified_Policy_` +
      `${new Date()
        .toISOString()
        .slice(0, 10)}.txt`;

    const description =
      `Unified text conversion for ${bankName}. ` +
      `Original files: ${stats.convertedFiles}/` +
      `${stats.totalSourceFiles}. ` +
      `Excluded: ${stats.excludedFiles} location files. ` +
      `Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`;

    const existing =
      await client.query<{
        id: number;
      }>(
        `SELECT id
         FROM bank_policy_files
         WHERE bank_id = $1
           AND metadata @> $2`,
        [
          bankId,
          JSON.stringify({
            is_unified_text: true,
          }),
        ],
      );

    let unifiedDocId: number;

    if (
      existing.rowCount! > 0
    ) {
      await client.query(
        `UPDATE bank_policy_files
         SET extracted_text = $1,
             metadata = $2,
             file_name = $3,
             description = $4
         WHERE id = $5`,
        [
          unifiedText,
          {
            is_unified_text: true,
            validation,
            stats,
            included_files:
              includedFiles.map(
                (file) =>
                  file.fileName,
              ),
            excluded_files:
              excludedFiles.map(
                (file) =>
                  file.fileName,
              ),
            converted_at:
              new Date().toISOString(),
          },
          fileName,
          description,
          existing.rows[0].id,
        ],
      );

      unifiedDocId =
        existing.rows[0].id;
    } else {
      const result =
        await client.query<{
          id: number;
        }>(
          `INSERT INTO bank_policy_files
           (
             bank_id,
             file_name,
             file_path,
             file_type,
             description,
             extracted_text,
             metadata,
             uploaded_by,
             uploaded_at
           )
           VALUES
           (
             $1,
             $2,
             $3,
             $4,
             $5,
             $6,
             $7,
             $8,
             NOW()
           )
           RETURNING id`,
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
              included_files:
                includedFiles.map(
                  (file) =>
                    file.fileName,
                ),
              excluded_files:
                excludedFiles.map(
                  (file) =>
                    file.fileName,
                ),
              converted_at:
                new Date().toISOString(),
            },
            1,
          ],
        );

      unifiedDocId =
        result.rows[0].id;
    }

    // Delete source file records,
    // keeping the unified document.
    const allSourceIds =
      (
        await client.query<{
          id: number;
        }>(
          `SELECT id
           FROM bank_policy_files
           WHERE bank_id = $1
             AND id != $2`,
          [
            bankId,
            unifiedDocId,
          ],
        )
      ).rows.map(
        (row) => row.id,
      );

    for (const sourceId of allSourceIds) {
      await client.query(
        `DELETE
         FROM bank_policy_files
         WHERE id = $1`,
        [sourceId],
      );
    }

    // Re-attach unified document to
    // active policy rules.
    const policyRules =
      await client.query<{
        id: number;
      }>(
        `SELECT pr.id
         FROM policy_rules pr
         JOIN policy_versions pv
           ON pv.id =
              pr.policy_version_id
         WHERE pv.bank_id = $1
           AND pr.status = 'active'`,
        [bankId],
      );

    for (const rule of policyRules.rows) {
      await client.query(
        `DELETE
         FROM policy_attachments
         WHERE policy_rule_id = $1`,
        [rule.id],
      );

      await client.query(
        `INSERT INTO policy_attachments
         (
           policy_rule_id,
           file_name,
           file_path,
           file_type,
           file_size_bytes,
           extracted_text,
           uploaded_by,
           uploaded_at
         )
         VALUES
         (
           $1,
           $2,
           $3,
           $4,
           $5,
           $6,
           $7,
           NOW()
         )`,
        [
          rule.id,
          fileName,
          `unified://${bankCode}/${fileName}`,
          '.txt',
          Buffer.byteLength(
            unifiedText,
            'utf8',
          ),
          unifiedText,
          1,
        ],
      );
    }

    return {
      unifiedDocumentId:
        unifiedDocId,
      includedFiles:
        includedFiles.length,
      excludedFiles:
        excludedFiles.length,
      deletedSourceRecords:
        allSourceIds.length,
      validation,
    };
  } finally {
    client.release();
  }
}

// =====================================================
// EXPORTS
// =====================================================

export default {
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
  replaceABFLUnifiedDocument,
};