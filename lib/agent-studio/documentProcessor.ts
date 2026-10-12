// lib/agent-studio/documentProcessor.ts
import pool from "@/lib/db";
import { generateQueryEmbedding } from "@/lib/policyRetrieval";
import { DocumentProcessingStatus } from "./types";
import path from "path";
import fs from "fs/promises";

// Safe dynamic imports for document parsers
async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  fileType: string
): Promise<string> {
  const ext = (fileType || path.extname(fileName).replace(".", "")).toLowerCase();

  try {
    if (ext === "pdf") {
      const pdfModule = require("pdf-parse");
      if (typeof pdfModule === "function") {
        const data = await pdfModule(buffer);
        return data.text || "";
      } else if (pdfModule?.PDFParse) {
        const uint8 = new Uint8Array(buffer);
        const parser = new pdfModule.PDFParse(uint8);
        const res = await parser.getText();
        return typeof res === "string" ? res : res?.text || "";
      } else if (pdfModule?.default && typeof pdfModule.default === "function") {
        const data = await pdfModule.default(buffer);
        return data.text || "";
      } else if (pdfModule?.default?.PDFParse) {
        const uint8 = new Uint8Array(buffer);
        const parser = new pdfModule.default.PDFParse(uint8);
        const res = await parser.getText();
        return typeof res === "string" ? res : res?.text || "";
      }
      throw new Error("Unable to initialize PDF parser from pdf-parse module");
    }

    if (ext === "docx" || ext === "doc") {
      const mammoth = require("mammoth");
      const res = await mammoth.extractRawText({ buffer });
      return res.value || "";
    }

    if (ext === "xlsx" || ext === "xls") {
      const xlsx = require("xlsx");
      const workbook = xlsx.read(buffer, { type: "buffer" });
      let combined = "";
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        combined += `\n--- Sheet: ${sheetName} ---\n`;
        combined += xlsx.utils.sheet_to_csv(sheet);
      }
      return combined;
    }

    if (ext === "json") {
      const str = buffer.toString("utf-8");
      try {
        const parsed = JSON.parse(str);
        return typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : str;
      } catch {
        return str;
      }
    }

    // Default for txt, csv, and all safe plain text files
    return buffer.toString("utf-8");
  } catch (err: any) {
    console.error(`[DOCUMENT_PROCESSOR_EXTRACTION_ERROR] ${fileName}:`, err);
    throw new Error(`Failed to extract text from ${ext.toUpperCase()} file: ${err.message}`);
  }
}

/**
 * Splits text into readable, semantically bounded chunks with metadata.
 */
function chunkDocumentText(
  text: string,
  targetCharSize = 1600,
  overlap = 200
): Array<{ index: number; content: string; charCount: number }> {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  // Split on paragraphs first
  const paragraphs = clean.split(/\n\s*\n/);
  const chunks: Array<{ index: number; content: string; charCount: number }> = [];

  let currentChunk = "";
  let chunkIdx = 0;

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 <= targetCharSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    } else {
      if (currentChunk) {
        chunks.push({
          index: chunkIdx++,
          content: currentChunk,
          charCount: currentChunk.length,
        });
      }
      // If single paragraph is larger than target, split by sentences or slice
      if (trimmed.length > targetCharSize) {
        let start = 0;
        while (start < trimmed.length) {
          const slice = trimmed.slice(start, start + targetCharSize);
          chunks.push({
            index: chunkIdx++,
            content: slice,
            charCount: slice.length,
          });
          start += targetCharSize - overlap;
        }
        currentChunk = "";
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) {
    chunks.push({
      index: chunkIdx++,
      content: currentChunk,
      charCount: currentChunk.length,
    });
  }

  return chunks;
}

export async function processDocumentFile(
  documentId: string,
  agentId: string,
  buffer: Buffer,
  fileName: string,
  fileType: string,
  fileSize?: string
): Promise<{ success: boolean; chunkCount: number; error?: string }> {
  const client = await pool.connect();
  try {
    const sizeStr = fileSize || `${Math.max(1, Math.round(buffer.length / 1024))} KB`;
    // 1. Ensure row exists & mark as PROCESSING / EXTRACTING
    await client.query(
      `INSERT INTO knowledge_documents (id, agent_id, name, file_type, file_size, status, status_message, uploaded_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'EXTRACTING', 'Extracting document text...', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         status = 'EXTRACTING', status_message = 'Extracting document text...', updated_at = NOW()`,
      [documentId, agentId, fileName, fileType, sizeStr]
    );

    // 2. Extract text
    const extractedText = await extractTextFromBuffer(buffer, fileName, fileType);
    if (!extractedText || !extractedText.trim()) {
      throw new Error("Document is empty or no readable text could be extracted.");
    }

    // 3. Mark as CHUNKING
    await client.query(
      `UPDATE knowledge_documents
       SET status = 'CHUNKING', status_message = 'Segmenting document into semantic chunks...', raw_text = $2, updated_at = NOW()
       WHERE id = $1`,
      [documentId, extractedText]
    );

    const chunks = chunkDocumentText(extractedText);
    if (chunks.length === 0) {
      throw new Error("No valid text chunks generated from document.");
    }

    // 4. Mark as INDEXING
    await client.query(
      `UPDATE knowledge_documents
       SET status = 'INDEXING', status_message = 'Generating embeddings and vector indexing...', chunk_count = $2, updated_at = NOW()
       WHERE id = $1`,
      [documentId, chunks.length]
    );

    // Clear old chunks if any
    await client.query(`DELETE FROM knowledge_chunks WHERE document_id = $1`, [documentId]);

    // 5. Generate embeddings and store chunks
    let indexedVectors = 0;
    for (const chunk of chunks) {
      let embeddingVector: number[] | null = null;
      try {
        embeddingVector = await generateQueryEmbedding(chunk.content.slice(0, 1000));
      } catch (embErr) {
        // Fallback: embedding can be generated later or handled via lexical search
        console.warn(`[CHUNK_EMBEDDING_WARNING] document ${documentId} chunk ${chunk.index}:`, embErr);
      }

      const chunkId = `${documentId}_c${chunk.index}`;
      const metadata = {
        documentName: fileName,
        fileType,
        chunkIndex: chunk.index,
        charCount: chunk.charCount,
      };

      if (embeddingVector && Array.isArray(embeddingVector)) {
        await client.query(
          `INSERT INTO knowledge_chunks (id, document_id, agent_id, chunk_index, content, embedding, char_count, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, NOW())`,
          [
            chunkId,
            documentId,
            agentId,
            chunk.index,
            chunk.content,
            `[${embeddingVector.join(",")}]`,
            chunk.charCount,
            JSON.stringify(metadata),
          ]
        );
        indexedVectors++;
      } else {
        await client.query(
          `INSERT INTO knowledge_chunks (id, document_id, agent_id, chunk_index, content, char_count, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            chunkId,
            documentId,
            agentId,
            chunk.index,
            chunk.content,
            chunk.charCount,
            JSON.stringify(metadata),
          ]
        );
      }
    }

    // 6. Mark COMPLETED
    await client.query(
      `UPDATE knowledge_documents
       SET status = 'COMPLETED',
           status_message = 'Document processed and indexed successfully.',
           chunk_count = $2,
           vector_status = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [documentId, chunks.length, indexedVectors > 0 ? "Indexed" : "Pending"]
    );

    return { success: true, chunkCount: chunks.length };
  } catch (err: any) {
    console.error(`[DOCUMENT_PIPELINE_ERROR] ${documentId}:`, err);
    await client.query(
      `UPDATE knowledge_documents
       SET status = 'FAILED',
           status_message = $2,
           vector_status = 'Failed',
           updated_at = NOW()
       WHERE id = $1`,
      [documentId, err.message || "Failed to process document."]
    );
    return { success: false, chunkCount: 0, error: err.message };
  } finally {
    client.release();
  }
}
