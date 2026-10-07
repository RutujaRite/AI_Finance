/**
 * Header-Aware and Metadata-Enriched Policy Text Chunker
 * 
 * Implements:
 * 1. Markdown / Section-Header aware splitting (never splits tables or bullet blocks mid-criteria).
 * 2. Token target: 400 - 600 tokens (~1,600 - 2,400 characters) with 50-token (~200 chars) overlap.
 * 3. Prepends structured metadata headers directly into chunk text prior to embedding:
 *    [Metadata: Bank_Name, Document_Type, Section, Eligibility_Domain]
 * 4. Preserves table structures (Markdown or key-value grids) intact.
 */

export interface PolicyMetadata {
  bankName: string;
  documentType: string;
  section: string;
  eligibilityDomain: string;
  [key: string]: any;
}

export interface EnrichedChunk {
  index: number;
  content: string; // Text with prepended metadata header (used for embedding & retrieval)
  rawContent: string; // Text without metadata header
  metadata: PolicyMetadata;
  charCount: number;
}

export interface ChunkerOptions {
  bankName: string;
  targetCharSize?: number; // Default 1800 chars (~450 tokens)
  overlapCharSize?: number; // Default 200 chars (~50 tokens)
}

/**
 * Classifies a policy section title into canonical eligibility domains.
 */
export function classifyEligibilityDomain(sectionTitle: string): string {
  const s = sectionTitle.toLowerCase();
  if (s.includes("cibil") || s.includes("credit score")) return "CIBIL";
  if (s.includes("salary") || s.includes("nth") || s.includes("income") || s.includes("nmi")) return "Salary_Income";
  if (s.includes("age") || s.includes("employment") || s.includes("vintage") || s.includes("experience") || s.includes("stability")) return "Age_Employment";
  if (s.includes("category") || s.includes("categories") || s.includes("employer")) return "Company_Category";
  if (s.includes("loan parameter") || s.includes("loan amount") || s.includes("tenure")) return "Loan_Parameters";
  if (s.includes("pricing") || s.includes("roi") || s.includes("interest") || s.includes("fee") || s.includes("charge")) return "Pricing_ROI";
  if (s.includes("foir") || s.includes("multiplier") || s.includes("obligation")) return "FOIR_Obligations";
  if (s.includes("doc") || s.includes("kyc") || s.includes("paperwork") || s.includes("statement") || s.includes("slip")) return "Documents";
  if (s.includes("bt") || s.includes("balance transfer") || s.includes("top up") || s.includes("ccbt")) return "Balance_Transfer";
  if (s.includes("exception") || s.includes("deviation") || s.includes("foreclosure") || s.includes("part payment")) return "Exceptions_Deviations";
  if (s.includes("conflict") || s.includes("review")) return "Review_Conflicts";
  if (s.includes("overview") || s.includes("program") || s.includes("product")) return "Program_Overview";
  return "General_Eligibility";
}

/**
 * Parses raw master policy text into header-delimited sections, preserving tables.
 */
export function splitIntoHeaderSections(text: string): { title: string; body: string }[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  const sections: { title: string; body: string }[] = [];
  let currentTitle = "DOCUMENT OVERVIEW";
  let currentLines: string[] = [];

  const isHeaderLine = (line: string): string | null => {
    const t = line.trim();
    if (!t) return null;

    // Pattern 1: Numbered major section: "1. PROGRAM OVERVIEW" or "2. ELIGIBILITY CRITERIA"
    const numMatch = t.match(/^(?:===+\s*)?([0-9]{1,2}\.\s+[A-Z0-9\s/&,()_-]{3,60})(?:\s*===+)?$/);
    if (numMatch) return numMatch[1].trim();

    // Pattern 2: Markdown headers: "## ELIGIBILITY CRITERIA" or "### Age Requirements"
    const mdMatch = t.match(/^#{1,3}\s+([A-Za-z0-9\s/&,()_-]{3,60})$/);
    if (mdMatch) return mdMatch[1].trim();

    // Pattern 3: All-caps major headers bracketed by '=' or '-'
    if (/^[A-Z0-9\s/&,()_-]{4,50}:?$/.test(t) && !t.includes(":") && t.length > 5) {
      if (
        t.includes("ELIGIBILITY") ||
        t.includes("CRITERIA") ||
        t.includes("SALARY") ||
        t.includes("REQUIREMENT") ||
        t.includes("PRICING") ||
        t.includes("PARAMETER") ||
        t.includes("DOCUMENT") ||
        t.includes("EXCEPTION") ||
        t.includes("CONFLICT")
      ) {
        return t.replace(/:$/, "").trim();
      }
    }

    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const header = isHeaderLine(line);

    if (header) {
      if (currentLines.length > 0) {
        const body = currentLines.join("\n").trim();
        if (body) {
          sections.push({ title: currentTitle, body });
        }
        currentLines = [];
      }
      currentTitle = header;
    } else {
      // Filter out long divider lines of just '====' or '----'
      if (!/^[=\-─_]{5,}$/.test(line.trim())) {
        currentLines.push(line);
      }
    }
  }

  if (currentLines.length > 0) {
    const body = currentLines.join("\n").trim();
    if (body) {
      sections.push({ title: currentTitle, body });
    }
  }

  return sections;
}

/**
 * Splits a long section body into chunks targeting 400 - 600 tokens (~1,600 - 2,400 chars)
 * with 50-token (~200 chars) overlap, keeping tables intact.
 */
function chunkSectionBody(body: string, targetSize: number, overlap: number): string[] {
  if (body.length <= targetSize) {
    return [body];
  }

  // Split section body by double newlines or table blocks
  const blocks = body.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    if (!currentChunk) {
      currentChunk = block;
    } else if (currentChunk.length + 2 + block.length <= targetSize) {
      currentChunk += "\n\n" + block;
    } else {
      // Finalize current chunk
      chunks.push(currentChunk.trim());

      // Calculate overlap
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapSlice = currentChunk.slice(-overlap);
        const boundaryIdx = overlapSlice.search(/[\n.!?]\s+/);
        const overlapText = boundaryIdx !== -1 ? overlapSlice.slice(boundaryIdx + 1).trim() : overlapSlice.trim();
        if (overlapText.length >= 50) {
          currentChunk = overlapText + "\n\n" + block;
        } else {
          currentChunk = block;
        }
      } else {
        currentChunk = block;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Header-aware, metadata-enriched chunking pipeline.
 * Prepends canonical metadata headers directly to each text chunk before embedding.
 */
export function chunkPolicyWithMetadata(text: string, options: ChunkerOptions): EnrichedChunk[] {
  const { bankName, targetCharSize = 1800, overlapCharSize = 200 } = options;
  const sections = splitIntoHeaderSections(text);

  const enrichedChunks: EnrichedChunk[] = [];
  let chunkIndex = 0;

  for (const sec of sections) {
    const domain = classifyEligibilityDomain(sec.title);
    const subChunks = chunkSectionBody(sec.body, targetCharSize, overlapCharSize);

    for (const sub of subChunks) {
      const metadataHeader = `[Metadata: Bank_Name: ${bankName} | Document_Type: Master_Policy | Section: ${sec.title} | Eligibility_Domain: ${domain}]\n\n`;
      const enrichedText = metadataHeader + sub;

      enrichedChunks.push({
        index: chunkIndex++,
        content: enrichedText,
        rawContent: sub,
        metadata: {
          bankName,
          documentType: "Master_Policy",
          section: sec.title,
          eligibilityDomain: domain,
        },
        charCount: enrichedText.length,
      });
    }
  }

  return enrichedChunks;
}
