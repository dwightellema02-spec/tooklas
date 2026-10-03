/**
 * Tuklas AI - Document Extractor & Semantic Chunker Service
 * 
 * Supports:
 * - PDF extraction (pdf-parse v2) with scanned document detection and Gemini multimodal OCR
 * - DOCX extraction (mammoth) with table formatting
 * - PPTX presentation slides extraction (JSZip OpenXML)
 * - XLSX spreadsheet extraction (JSZip OpenXML) with Markdown table conversion
 * - CSV / TSV tabular datasets with Markdown table formatting
 * - Plain text / Markdown (.txt, .text, .md, .markdown)
 * - Image OCR (.png, .jpg, .jpeg) via Gemini Multimodal API when configured
 * - Complex nested table preservation (multi-column space/tab detection to GitHub Flavored Markdown)
 * - LaTeX math preservation ($...$, $$...$$, |x|, \frac, etc.)
 * - Logical semantic chunking preserving headings and formulas
 * - Ranked relevance retrieval (findRelevantDocumentChunks)
 */

import { GoogleGenAI } from "@google/genai";
import JSZip from "jszip";

export interface DocumentChunk {
  id: string;
  heading: string;
  content: string;
  charCount: number;
  sequenceOrder: number;
  isTable?: boolean;
}

export interface ExtractedDocumentData {
  extractionStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  charCount: number;
  wordCount: number;
  sectionCount: number;
  previewText: string;
  extractedText: string;
  chunks: DocumentChunk[];
  extractedAt: string;
  error?: string | null;
  fileType?: string;
  isScanned?: boolean;
  ocrApplied?: boolean;
  tablesDetected?: number;
}

export interface ExtractDocumentInput {
  buffer: Buffer | Uint8Array;
  fileName: string;
  mimeType?: string;
}

export interface ExtractDocumentResult {
  success: boolean;
  status: "READY" | "FAILED";
  data?: ExtractedDocumentData;
  error?: string;
}

/**
 * Converts a 2D array of string cells into a standard GitHub Flavored Markdown table
 */
export function tableToMarkdown(rows: string[][]): string {
  if (!rows || rows.length === 0) return "";
  const numCols = Math.max(...rows.map((r) => r.length));
  if (numCols === 0) return "";

  const paddedRows = rows.map((r) => {
    const copy = [...r];
    while (copy.length < numCols) copy.push("");
    return copy.map((cell) => cell.replace(/\|/g, "\\|").trim());
  });

  const header = paddedRows[0];
  const separator = new Array(numCols).fill(":---");
  const dataRows = paddedRows.slice(1);

  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...dataRows.map((r) => `| ${r.join(" | ")} |`),
  ];

  return lines.join("\n");
}

/**
 * Detects multi-column tabular lines in unstructured text (lines separated by 2+ spaces or tabs)
 * and formats them into clean GitHub Flavored Markdown tables.
 */
export function formatTableLines(rawText: string): { formattedText: string; tablesCount: number } {
  if (!rawText) return { formattedText: "", tablesCount: 0 };

  const lines = rawText.split("\n");
  const resultLines: string[] = [];
  let tableBuffer: string[][] = [];
  let tablesCount = 0;

  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      const mdTable = tableToMarkdown(tableBuffer);
      resultLines.push("");
      resultLines.push(mdTable);
      resultLines.push("");
      tablesCount++;
    } else if (tableBuffer.length === 1) {
      resultLines.push(tableBuffer[0].join("  "));
    }
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushTable();
      resultLines.push("");
      continue;
    }

    // Skip markdown headings, quotes, or existing markdown tables
    if (line.startsWith("#") || line.startsWith(">") || (line.startsWith("|") && line.endsWith("|"))) {
      flushTable();
      resultLines.push(line);
      continue;
    }

    // Detect column separation by tab or 2+ consecutive spaces
    const parts = line.split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);

    // If 2 or more distinct columns detected and line doesn't look like normal prose
    const looksLikeColumns = parts.length >= 2 && line.length < 250 && !line.endsWith(".");

    if (looksLikeColumns) {
      tableBuffer.push(parts);
    } else {
      flushTable();
      resultLines.push(line);
    }
  }

  flushTable();

  return {
    formattedText: resultLines.join("\n"),
    tablesCount,
  };
}

/**
 * Normalizes extracted text:
 * - Cleans pagination markers (-- 1 of 1 --, Page X of Y)
 * - Standardizes line endings to \n
 * - Strips unprintable control characters while preserving math symbols and line breaks
 * - Converts multi-column tabular lines into structured Markdown tables
 * - Preserves LaTeX and mathematical notation ($...$, |x|, +, -, =, etc.)
 */
export function normalizeText(rawText: string): string {
  if (!rawText) return "";

  let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove PDF page markers like "-- 1 of 5 --" or "Page 1 of 3"
  text = text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "\n");
  text = text.replace(/(?:Page|Pahina)\s+\d+(?:\s*(?:of|\/)\s*\d+)?/gi, "");

  // Remove non-printable control characters except \n and \t
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Detect and format tables
  const { formattedText } = formatTableLines(text);
  text = formattedText;

  // Collapse 3+ consecutive newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Splits extracted document text into logical, semantic chunks preserving headings and LaTeX math.
 */
export function splitIntoChunks(text: string, maxChunkChars: number = 1000): DocumentChunk[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: DocumentChunk[] = [];
  const paragraphs = text.split(/\n\s*\n/);

  let currentHeading = "Overview";
  let currentBuffer: string[] = [];
  let currentChars = 0;
  let chunkIndex = 1;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect heading patterns (# Heading, Chapter 1, Section 2, Lesson 1)
    const headingMatch = trimmed.match(/^(?:#{1,4}\s+|(?:\d+\.|\b(?:Section|Chapter|Part|Lesson|Aralin)\b\s+\d+[:.]?)\s*)([^\n]+)/i);
    const isExplicitHeading = Boolean(headingMatch && trimmed.length < 100 && !trimmed.endsWith("."));

    if (isExplicitHeading) {
      if (currentBuffer.length > 0) {
        const chunkContent = currentBuffer.join("\n\n").trim();
        chunks.push({
          id: `chunk_${chunkIndex}`,
          heading: currentHeading,
          content: chunkContent,
          charCount: chunkContent.length,
          sequenceOrder: chunkIndex,
          isTable: chunkContent.includes("| :---"),
        });
        chunkIndex++;
        currentBuffer = [];
        currentChars = 0;
      }
      currentHeading = (headingMatch ? headingMatch[1] : trimmed).replace(/^[#\s]+/, "").trim();
      currentBuffer.push(trimmed);
      currentChars += trimmed.length;
      continue;
    }

    if (currentChars + trimmed.length > maxChunkChars && currentBuffer.length > 0) {
      const chunkContent = currentBuffer.join("\n\n").trim();
      chunks.push({
        id: `chunk_${chunkIndex}`,
        heading: currentHeading,
        content: chunkContent,
        charCount: chunkContent.length,
        sequenceOrder: chunkIndex,
        isTable: chunkContent.includes("| :---"),
      });
      chunkIndex++;
      currentBuffer = [trimmed];
      currentChars = trimmed.length;
    } else {
      currentBuffer.push(trimmed);
      currentChars += trimmed.length;
    }
  }

  if (currentBuffer.length > 0) {
    const chunkContent = currentBuffer.join("\n\n").trim();
    chunks.push({
      id: `chunk_${chunkIndex}`,
      heading: currentHeading,
      content: chunkContent,
      charCount: chunkContent.length,
      sequenceOrder: chunkIndex,
      isTable: chunkContent.includes("| :---"),
    });
  }

  return chunks;
}

/**
 * Searches and ranks document chunks relevant to a student query or mathematical topic.
 */
export function findRelevantDocumentChunks(
  query: string,
  chunks: DocumentChunk[],
  maxChunks: number = 3
): DocumentChunk[] {
  if (!chunks || chunks.length === 0) return [];
  if (!query || query.trim().length === 0) return chunks.slice(0, maxChunks);

  const cleanQuery = query.toLowerCase();
  const queryTokens = cleanQuery
    .split(/[\s,?.!()\-+/*=]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);

  const mathConcepts = [
    { name: "integer", keywords: ["integer", "integers", "signed", "buong numero"] },
    { name: "negative", keywords: ["negative", "negatibo", "minus", "< 0", "left"] },
    { name: "positive", keywords: ["positive", "positibo", "plus", "> 0", "right"] },
    { name: "addition", keywords: ["addition", "add", "sum", "dagdag", "pagsasama"] },
    { name: "subtraction", keywords: ["subtraction", "subtract", "difference", "bawas", "minus"] },
    { name: "additive_inverse", keywords: ["additive inverse", "opposite", "kabaligtaran", "zero pair"] },
    { name: "absolute_value", keywords: ["absolute value", "distance", "magnitude", "|x|"] },
    { name: "number_line", keywords: ["number line", "guhit bilang", "left", "right", "arrow"] },
    { name: "rules", keywords: ["rule", "rules", "same sign", "unlike signs", "tuntunin"] },
  ];

  const matchedConcepts = mathConcepts.filter((c) =>
    c.keywords.some((kw) => cleanQuery.includes(kw))
  );

  const scoredChunks = chunks.map((chunk) => {
    let score = 0;
    const chunkLower = (chunk.heading + " " + chunk.content).toLowerCase();

    for (const token of queryTokens) {
      if (chunkLower.includes(token)) score += 2;
      if (chunk.heading.toLowerCase().includes(token)) score += 4;
    }

    for (const concept of matchedConcepts) {
      for (const kw of concept.keywords) {
        if (chunkLower.includes(kw)) score += 3;
        if (chunk.heading.toLowerCase().includes(kw)) score += 5;
      }
    }

    if (chunk.content.includes("$")) score += 1;
    if (chunk.isTable) score += 2;

    return { chunk, score };
  });

  scoredChunks.sort((a, b) => b.score - a.score || a.chunk.sequenceOrder - b.chunk.sequenceOrder);

  const relevant = scoredChunks.filter((sc) => sc.score > 0).map((sc) => sc.chunk);
  if (relevant.length === 0) return chunks.slice(0, maxChunks);

  return relevant.slice(0, maxChunks);
}

/**
 * Extracts text and slides from PowerPoint (.pptx) presentation files using JSZip
 */
export async function extractPptxText(buffer: Buffer | Uint8Array): Promise<string> {
  const zip = new JSZip();
  const loaded = await zip.loadAsync(buffer);
  const slideFiles: { name: string; num: number; file: JSZip.JSZipObject }[] = [];

  loaded.forEach((path, file) => {
    const match = path.match(/ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideFiles.push({ name: path, num: parseInt(match[1], 10), file });
    }
  });

  if (slideFiles.length === 0) {
    throw new Error("No PowerPoint presentation slides found in file.");
  }

  // Sort slides in natural numeric sequence
  slideFiles.sort((a, b) => a.num - b.num);

  const slideTexts: string[] = [];

  for (const { num, file } of slideFiles) {
    const xml = await file.async("string");
    // Extract text elements <a:t>...</a:t>
    const textMatches = xml.match(/<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/gi) || [];
    const rawParagraphs: string[] = [];

    // Extract by paragraphs <a:p>
    const pMatches = xml.match(/<a:p(?:\s+[^>]*)?>([\s\S]*?)<\/a:p>/gi) || [];
    for (const pXml of pMatches) {
      const pTextMatches = pXml.match(/<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/gi) || [];
      const pClean = pTextMatches
        .map((t) => t.replace(/<[^>]+>/g, "").trim())
        .filter(Boolean)
        .join(" ");
      if (pClean) rawParagraphs.push(pClean);
    }

    if (rawParagraphs.length > 0) {
      const title = rawParagraphs[0];
      const body = rawParagraphs.slice(1).map((p) => `- ${p}`).join("\n");
      slideTexts.push(`## Slide ${num}: ${title}\n\n${body || title}`);
    } else if (textMatches.length > 0) {
      const text = textMatches.map((t) => t.replace(/<[^>]+>/g, "").trim()).filter(Boolean).join(" ");
      slideTexts.push(`## Slide ${num}\n\n${text}`);
    }
  }

  return slideTexts.join("\n\n");
}

/**
 * Extracts data and sheets from Excel (.xlsx) spreadsheets using JSZip, converting to Markdown tables
 */
export async function extractXlsxText(buffer: Buffer | Uint8Array): Promise<string> {
  const zip = new JSZip();
  const loaded = await zip.loadAsync(buffer);

  // 1. Extract shared strings if present
  const sharedStrings: string[] = [];
  const sstFile = loaded.file("xl/sharedStrings.xml");
  if (sstFile) {
    const sstXml = await sstFile.async("string");
    const siMatches = sstXml.match(/<si(?:\s+[^>]*)?>([\s\S]*?)<\/si>/gi) || [];
    for (const si of siMatches) {
      const tMatches = si.match(/<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/gi) || [];
      sharedStrings.push(tMatches.map((t) => t.replace(/<[^>]+>/g, "")).join(""));
    }
  }

  // 2. Extract worksheets
  const sheetFiles: { name: string; file: JSZip.JSZipObject }[] = [];
  loaded.forEach((path, file) => {
    if (path.match(/xl\/worksheets\/sheet\d+\.xml$/i)) {
      sheetFiles.push({ name: path, file });
    }
  });

  if (sheetFiles.length === 0) {
    throw new Error("No Excel worksheet data found in file.");
  }

  const sheetOutputs: string[] = [];

  for (let idx = 0; idx < sheetFiles.length; idx++) {
    const { file } = sheetFiles[idx];
    const xml = await file.async("string");

    // Match rows <row ...> ... </row>
    const rowMatches = xml.match(/<row(?:\s+[^>]*)?>([\s\S]*?)<\/row>/gi) || [];
    const tableData: string[][] = [];

    for (const rowXml of rowMatches) {
      const cellMatches = rowXml.match(/<c(?:\s+[^>]*)?>([\s\S]*?)<\/c>/gi) || [];
      const rowCells: string[] = [];

      for (const cellXml of cellMatches) {
        const isString = cellXml.includes('t="s"');
        const vMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/i);
        let cellVal = "";

        if (vMatch) {
          const val = vMatch[1].trim();
          if (isString) {
            const strIdx = parseInt(val, 10);
            cellVal = sharedStrings[strIdx] ?? val;
          } else {
            cellVal = val;
          }
        }
        rowCells.push(cellVal);
      }

      if (rowCells.some((c) => c.length > 0)) {
        tableData.push(rowCells);
      }
    }

    if (tableData.length > 0) {
      const mdTable = tableToMarkdown(tableData);
      sheetOutputs.push(`## Sheet ${idx + 1}\n\n${mdTable}`);
    }
  }

  return sheetOutputs.join("\n\n");
}

/**
 * Extracts tabular data from CSV or TSV files into Markdown tables
 */
export function extractCsvText(rawText: string, delimiter: string = ","): string {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";

  const rows: string[][] = [];
  for (const line of lines) {
    // Parse delimiter respecting quotes
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }

  return tableToMarkdown(rows);
}

/**
 * Calls Gemini Multimodal document understanding for scanned PDFs or images
 */
export async function extractWithGeminiMultimodal(
  buffer: Buffer | Uint8Array,
  mimeType: string
): Promise<{ text: string; success: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    return { text: "", success: false };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = Buffer.from(buffer).toString("base64");

    const prompt = `You are an expert DepEd MATATAG educational OCR assistant. 
Carefully extract all text, headings, mathematical formulas (format in LaTeX $...$ or $$...$$), and tables (format as Markdown tables | col | col |) from this document.
Maintain exact numerical signs (+, -), equations, and step-by-step mathematical examples.
Do not add conversational commentary or hallucinate text that is not visible in the document.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
          ],
        },
      ],
    });

    const extracted = response.text?.trim() || "";
    return { text: extracted, success: extracted.length > 0 };
  } catch (err) {
    console.warn("Gemini multimodal OCR fallback error:", err);
    return { text: "", success: false };
  }
}

/**
 * Primary Document Content Extractor
 */
export async function extractDocumentContent(input: ExtractDocumentInput): Promise<ExtractDocumentResult> {
  const { buffer, fileName, mimeType } = input;

  if (!buffer || buffer.length === 0) {
    return {
      success: false,
      status: "FAILED",
      error: "Empty or invalid document buffer received.",
    };
  }

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  let rawText = "";
  let isScanned = false;
  let ocrApplied = false;
  let detectedFileType = ext.toUpperCase();

  try {
    // =========================================================================
    // 1. PDF EXTRACTION
    // =========================================================================
    if (ext === "pdf" || mimeType === "application/pdf") {
      detectedFileType = "PDF";
      const { PDFParse } = await import("pdf-parse");
      const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const parser = new PDFParse({ data: uint8 });
      const pdfData = await parser.getText();
      rawText = pdfData?.text || "";

      // Check if document is scanned (zero or minimal text with non-trivial file size)
      if (rawText.trim().length < 30 && buffer.length > 2048) {
        isScanned = true;
        // Attempt Gemini Multimodal OCR if available
        const geminiOcr = await extractWithGeminiMultimodal(buffer, "application/pdf");
        if (geminiOcr.success) {
          rawText = geminiOcr.text;
          ocrApplied = true;
        } else {
          return {
            success: false,
            status: "FAILED",
            error: "Scanned / image-only PDF detected with no digital text layer. Upload a digital PDF with selectable text or configure Gemini API key for OCR.",
          };
        }
      }
    }
    // =========================================================================
    // 2. DOCX EXTRACTION
    // =========================================================================
    else if (
      ext === "docx" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      detectedFileType = "DOCX";
      const mammoth = await import("mammoth");
      const mammothAny = mammoth as any;
      const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

      // Attempt HTML conversion first to capture tables cleanly
      if (typeof mammothAny.convertToHtml === "function") {
        const htmlRes = await mammothAny.convertToHtml({ buffer: nodeBuffer });
        let html = htmlRes?.value || "";

        // Convert HTML tables to Markdown
        html = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m: string, tableInner: string) => {
          const rowMatches = tableInner.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
          const tableRows: string[][] = [];
          for (const row of rowMatches) {
            const cellMatches = row.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi) || [];
            const cells = cellMatches.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
            if (cells.length > 0) tableRows.push(cells);
          }
          return "\n\n" + tableToMarkdown(tableRows) + "\n\n";
        });

        // Strip remaining HTML tags
        rawText = html
          .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n\n## $1\n\n")
          .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
          .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
          .replace(/<[^>]+>/g, "");
      } else {
        const result = await mammoth.extractRawText({ buffer: nodeBuffer });
        rawText = result?.value || "";
      }
    }
    // =========================================================================
    // 3. PPTX PRESENTATION EXTRACTION
    // =========================================================================
    else if (
      ext === "pptx" ||
      mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      detectedFileType = "PPTX";
      rawText = await extractPptxText(buffer);
    }
    // =========================================================================
    // 4. XLSX SPREADSHEET EXTRACTION
    // =========================================================================
    else if (
      ext === "xlsx" ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      detectedFileType = "XLSX";
      rawText = await extractXlsxText(buffer);
    }
    // =========================================================================
    // 5. CSV / TSV TABULAR EXTRACTION
    // =========================================================================
    else if (ext === "csv" || ext === "tsv" || mimeType === "text/csv" || mimeType === "text/tab-separated-values") {
      detectedFileType = ext.toUpperCase();
      const raw = Buffer.from(buffer).toString("utf-8");
      rawText = extractCsvText(raw, ext === "tsv" ? "\t" : ",");
    }
    // =========================================================================
    // 6. PLAIN TEXT & MARKDOWN (.txt, .text, .md, .markdown)
    // =========================================================================
    else if (
      ext === "txt" ||
      ext === "text" ||
      ext === "md" ||
      ext === "markdown" ||
      mimeType === "text/plain" ||
      mimeType === "text/markdown"
    ) {
      detectedFileType = ext === "md" || ext === "markdown" ? "MARKDOWN" : "TEXT";
      rawText = Buffer.from(buffer).toString("utf-8");
    }
    // =========================================================================
    // 7. IMAGES (.png, .jpg, .jpeg) VIA GEMINI MULTIMODAL OCR
    // =========================================================================
    else if (
      ["png", "jpg", "jpeg", "webp"].includes(ext) ||
      (mimeType && mimeType.startsWith("image/"))
    ) {
      detectedFileType = "IMAGE";
      isScanned = true;
      const imgMime = mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`;
      const geminiOcr = await extractWithGeminiMultimodal(buffer, imgMime);
      if (geminiOcr.success) {
        rawText = geminiOcr.text;
        ocrApplied = true;
      } else {
        return {
          success: false,
          status: "FAILED",
          error: "Image document uploaded without active OCR key. Configure Gemini API key for automatic image text and equation extraction.",
        };
      }
    }
    // =========================================================================
    // 8. LEGACY .DOC (Word 97-2003 Binary)
    // =========================================================================
    else if (ext === "doc" || mimeType === "application/msword") {
      detectedFileType = "DOC";
      // Legacy binary .doc format notice
      return {
        success: false,
        status: "FAILED",
        error: "Legacy Word 97-2003 (.doc) binary format is not supported. Please save or export your document as modern Word (.docx) or PDF format.",
      };
    } else {
      return {
        success: false,
        status: "FAILED",
        error: `Unsupported file format (.${ext}). Supported formats: PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, PNG, JPG.`,
      };
    }

    // 2. Normalization & Table formatting
    const normalized = normalizeText(rawText);

    if (!normalized || normalized.trim().length === 0) {
      return {
        success: false,
        status: "FAILED",
        error: "Extracted document contains zero readable characters or empty content.",
      };
    }

    // 3. Semantic Chunking
    const chunks = splitIntoChunks(normalized);
    const words = normalized.split(/\s+/).filter(Boolean);
    const preview = normalized.substring(0, 300).trim() + (normalized.length > 300 ? "..." : "");
    const tablesDetected = (normalized.match(/\| :---/g) || []).length;

    const data: ExtractedDocumentData = {
      extractionStatus: "READY",
      charCount: normalized.length,
      wordCount: words.length,
      sectionCount: Math.max(1, chunks.length),
      previewText: preview,
      extractedText: normalized,
      chunks,
      extractedAt: new Date().toISOString(),
      fileType: detectedFileType,
      isScanned,
      ocrApplied,
      tablesDetected,
    };

    return {
      success: true,
      status: "READY",
      data,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Failed to extract text from document";
    return {
      success: false,
      status: "FAILED",
      error: errorMsg,
    };
  }
}

