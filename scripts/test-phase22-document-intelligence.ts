/**
 * Tuklas AI - Phase 22: Teacher Material Intelligence, Document Understanding & Grounded AI Tutor
 * 
 * Comprehensive automated verification suite testing all required scenarios:
 * 
 * DOCUMENT TESTS:
 * 1. PDF upload
 * 2. PDF extraction (text, counts, preview)
 * 3. DOCX upload
 * 4. DOCX extraction & table conversion
 * 5. Malformed file rejection (honest status = FAILED)
 * 6. Unsupported file rejection (HTTP 400)
 * 7. File size limit rejection (HTTP 400 on >25MB)
 * 8. Extraction failure handling
 * 9. Lesson association
 * 10. Document persistence
 * 
 * EXPANDED DOCUMENT INTELLIGENCE TESTS:
 * 10b. PPTX presentation slide extraction (JSZip OpenXML)
 * 10c. XLSX spreadsheet table extraction to Markdown tables
 * 10d. CSV / TSV tabular dataset conversion to Markdown tables
 * 10e. Plain text / Markdown (.txt, .md) extraction with LaTeX math preservation
 * 10f. Complex nested table detection (aligned space/tab rows to Markdown tables)
 * 10g. Scanned PDF / OCR detection and honest reporting
 * 
 * AI GROUNDING & PEDAGOGICAL TESTS:
 * 11. AI retrieves lesson content
 * 12. AI retrieves teacher document content
 * 13. AI uses relevant document section (findRelevantDocumentChunks)
 * 14. AI does not claim inaccessible content
 * 15. AI does not hallucinate document content
 * 16. AI remembers previous response (intermediate acknowledgement)
 * 17. AI avoids identical repeated responses
 * 18. AI adapts to student mistake (SIGN_ERROR)
 * 19. AI adapts to mastery state (MASTERED -> TRY_HARDER)
 * 20. AI generates lesson-specific questions
 * 21. AI avoids recent duplicate questions
 * 22. AI remains Socratic (refuses direct answer demands)
 * 23. AI responds appropriately to "I don't know"
 * 24. AI responds differently after repeated confusion (representation shift)
 * 25. Voice and text share conversation context
 * 26. Student cannot access another student's material (IDOR)
 * 27. Student cannot modify teacher documents
 * 28. Unauthorized teacher cannot access another teacher's private material
 */

import { buildAITutorContext } from "../src/lib/ai/context";
import { AITutorService } from "../src/lib/ai/tutor";
import { PracticeQuestionGenerator } from "../src/lib/ai/practice-generator";
import { LocalTutorEngine } from "../src/lib/ai/provider";
import {
  extractDocumentContent,
  normalizeText,
  splitIntoChunks,
  findRelevantDocumentChunks,
  tableToMarkdown,
  formatTableLines,
  extractCsvText,
  extractPptxText,
  extractXlsxText,
} from "../src/lib/documents/document-extractor";
import { dbService, prisma, fallbackStore } from "../src/lib/db";
import { createSessionToken } from "../src/lib/auth/session";
import JSZip from "jszip";

const BASE_URL = "http://localhost:3000";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function request(path: string, options: RequestInit = {}): Promise<{ status: number; json: any; text: string }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON
    }
    return { status: res.status, json, text };
  } catch (err: any) {
    console.error(`Fetch error on ${path}:`, err);
    throw err;
  }
}

/**
 * Creates a minimal valid synthetic PDF with text stream for testing
 */
function createValidTestPdfBuffer(textContent: string): Buffer {
  const contentStream = `BT /F1 12 Tf 50 700 Td (${textContent.replace(/[()]/g, "")}) Tj ET`;
  const streamLength = contentStream.length;

  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${streamLength} >>
stream
${contentStream}
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000300 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
390
%%EOF`;

  return Buffer.from(pdf, "utf-8");
}

/**
 * Creates a minimal valid test DOCX package using JSZip
 */
async function createValidTestDocxBuffer(bodyXmlText: string): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${bodyXmlText}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`
  );

  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

/**
 * Creates a minimal valid test PPTX package using JSZip
 */
async function createValidTestPptxBuffer(slideTitle: string, bulletPoints: string[]): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`
  );

  const bulletsXml = bulletPoints.map((bp) => `<a:p><a:r><a:t>${bp}</a:t></a:r></a:p>`).join("");

  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:bodyPr/>
          <a:p><a:r><a:t>${slideTitle}</a:t></a:r></a:p>
          ${bulletsXml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

/**
 * Creates a minimal valid test XLSX package using JSZip
 */
async function createValidTestXlsxBuffer(rows: string[][]): Promise<Buffer> {
  const zip = new JSZip();

  const sharedStrings: string[] = [];
  const rowsXml = rows
    .map((row, rIdx) => {
      const cellsXml = row
        .map((cell, cIdx) => {
          const strIdx = sharedStrings.length;
          sharedStrings.push(cell);
          const colLetter = String.fromCharCode(65 + cIdx);
          return `<c r="${colLetter}${rIdx + 1}" t="s"><v>${strIdx}</v></c>`;
        })
        .join("");
      return `<row r="${rIdx + 1}">${cellsXml}</row>`;
    })
    .join("");

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
  ${sharedStrings.map((s) => `<si><t>${s}</t></si>`).join("")}
</sst>`;

  zip.file("xl/sharedStrings.xml", sharedStringsXml);
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rowsXml}
  </sheetData>
</worksheet>`
  );

  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

async function runPhase22Suite() {
  console.log("=================================================================");
  console.log("📄 TUKLAS AI — PHASE 22 DOCUMENT INTELLIGENCE & GROUNDED AI TUTOR");
  console.log("=================================================================");
  console.log(`Target Server: ${BASE_URL}\n`);

  // Tokens
  const teacherToken = createSessionToken({
    id: "usr_teacher_01",
    email: "teacher1@deped.gov.ph",
    name: "Teacher Maria Santos",
    role: "TEACHER",
  });

  const teacher2Token = createSessionToken({
    id: "usr_teacher_02",
    email: "teacher2@deped.gov.ph",
    name: "Teacher Juan Dela Cruz",
    role: "TEACHER",
  });

  const studentToken = createSessionToken({
    id: "usr_student_01",
    email: "student1@deped.gov.ph",
    name: "Student Juan",
    role: "STUDENT",
  });

  const student2Token = createSessionToken({
    id: "usr_student_02",
    email: "student2@deped.gov.ph",
    name: "Student Pedro",
    role: "STUDENT",
  });

  // =========================================================================
  // DOCUMENT TEST 1: PDF UPLOAD
  // =========================================================================
  console.log("\n--- Document Test 1: PDF Upload ---");
  const samplePdfText = "DepEd MATATAG Grade 7 Mathematics. Integers and Absolute Values. Opposite of 5 is -5.";
  const validPdfBuf = createValidTestPdfBuffer(samplePdfText);

  const uploadPdfRes = await request("/api/lessons/lsn_01/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: "Teacher Guide: Integers & Absolute Value",
      fileName: "grade7_integers_guide.pdf",
      fileSize: validPdfBuf.length,
      fileContent: validPdfBuf.toString("base64"),
      mimeType: "application/pdf",
      description: "Comprehensive teacher guide for integer operations and models.",
    }),
  });

  assert(uploadPdfRes.status === 201, `Teacher can upload PDF document (HTTP ${uploadPdfRes.status})`);
  assert(uploadPdfRes.json?.success === true, "Response reports success = true");
  assert(Boolean(uploadPdfRes.json?.data?.id), "Returned resource has a valid ID");
  const createdPdfResourceId = uploadPdfRes.json?.data?.id;

  // =========================================================================
  // DOCUMENT TEST 2: PDF EXTRACTION
  // =========================================================================
  console.log("\n--- Document Test 2: PDF Extraction ---");
  const pdfExtraction = uploadPdfRes.json?.extraction;
  assert(pdfExtraction?.extractionStatus === "READY", "PDF extraction status is READY");
  assert(pdfExtraction?.charCount > 0, `Extracted character count is positive (${pdfExtraction?.charCount})`);
  assert(pdfExtraction?.wordCount > 0, `Extracted word count is positive (${pdfExtraction?.wordCount})`);
  assert(pdfExtraction?.sectionCount >= 1, `Extracted section count >= 1 (${pdfExtraction?.sectionCount})`);
  assert(Boolean(pdfExtraction?.previewText), "Extracted preview text is non-empty");

  // =========================================================================
  // DOCUMENT TEST 3: DOCX UPLOAD
  // =========================================================================
  console.log("\n--- Document Test 3: DOCX Upload ---");
  const sampleDocxText = "Lesson Plan: Additive Inverse and Subtracting Signed Numbers. Rule: a - b = a + (-b).";
  const validDocxBuf = await createValidTestDocxBuffer(sampleDocxText);

  const uploadDocxRes = await request("/api/lessons/lsn_01/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: "Lesson Plan: Additive Inverse",
      fileName: "additive_inverse_plan.docx",
      fileSize: validDocxBuf.length,
      fileContent: validDocxBuf.toString("base64"),
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      description: "Teacher lesson plan for additive inverse.",
    }),
  });

  assert(uploadDocxRes.status === 201, `Teacher can upload DOCX document (HTTP ${uploadDocxRes.status})`);
  assert(uploadDocxRes.json?.success === true, "DOCX upload reports success = true");

  // =========================================================================
  // DOCUMENT TEST 4: DOCX EXTRACTION
  // =========================================================================
  console.log("\n--- Document Test 4: DOCX Extraction ---");
  const docxExtraction = uploadDocxRes.json?.extraction;
  assert(docxExtraction?.extractionStatus === "READY", "DOCX extraction status is READY");
  assert(docxExtraction?.charCount > 0, `DOCX character count is positive (${docxExtraction?.charCount})`);
  assert(
    docxExtraction?.extractedText?.includes("Additive Inverse"),
    "DOCX extracted text contains 'Additive Inverse'"
  );

  // =========================================================================
  // DOCUMENT TEST 5: MALFORMED FILE REJECTION
  // =========================================================================
  console.log("\n--- Document Test 5: Malformed File Rejection ---");
  const corruptPdfPayload = Buffer.from("NOT_A_VALID_PDF_HEADER_DATA_CORRUPT").toString("base64");
  const corruptUploadRes = await request("/api/lessons/lsn_01/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: "Corrupt Document",
      fileName: "corrupt.pdf",
      fileSize: 100,
      fileContent: corruptPdfPayload,
    }),
  });

  assert(
    corruptUploadRes.status === 201 && corruptUploadRes.json?.data?.status === "FAILED",
    "Malformed document is processed honestly with status = FAILED"
  );
  assert(
    Boolean(corruptUploadRes.json?.extraction?.error),
    "Failure record contains informative error description"
  );

  // =========================================================================
  // DOCUMENT TEST 6: UNSUPPORTED FILE REJECTION
  // =========================================================================
  console.log("\n--- Document Test 6: Unsupported File Rejection ---");
  const unsupportedUploadRes = await request("/api/lessons/lsn_01/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: "Malicious Executable",
      fileName: "script.exe",
      fileSize: 500,
      fileContent: Buffer.from("MZ").toString("base64"),
    }),
  });

  assert(
    unsupportedUploadRes.status === 400,
    `Unsupported file format is rejected with HTTP 400 (got ${unsupportedUploadRes.status})`
  );
  assert(
    unsupportedUploadRes.json?.error?.includes("Unsupported file format"),
    "Error specifies unsupported file format"
  );

  // =========================================================================
  // DOCUMENT TEST 7: FILE SIZE LIMIT (25MB)
  // =========================================================================
  console.log("\n--- Document Test 7: File Size Limit ---");
  const oversizedRes = await request("/api/lessons/lsn_01/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: "Giant Document",
      fileName: "huge.pdf",
      fileSize: 30 * 1024 * 1024,
      fileContent: Buffer.from("%PDF-1.4 dummy").toString("base64"),
    }),
  });

  assert(oversizedRes.status === 400, `Oversized file is rejected with HTTP 400 (got ${oversizedRes.status})`);
  assert(oversizedRes.json?.error?.includes("25MB limit"), "Error specifies 25MB limit exceeded");

  // =========================================================================
  // DOCUMENT TEST 8: EXTRACTION FAILURE HANDLING
  // =========================================================================
  console.log("\n--- Document Test 8: Extraction Failure Handling ---");
  const directExtract = await extractDocumentContent({
    buffer: Buffer.from("GARBAGE_ZIP_STREAM"),
    fileName: "bad.docx",
  });
  assert(directExtract.success === false, "Direct extractor handles corrupt docx safely");
  assert(directExtract.status === "FAILED", "Extractor sets status to FAILED");

  // =========================================================================
  // DOCUMENT TEST 9: LESSON ASSOCIATION
  // =========================================================================
  console.log("\n--- Document Test 9: Lesson Association ---");
  const lessonDocsRes = await request("/api/lessons/lsn_01/documents", {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });

  assert(lessonDocsRes.status === 200, `List lesson documents returns 200 (got ${lessonDocsRes.status})`);
  assert(Array.isArray(lessonDocsRes.json?.data), "Data is an array of documents");
  const foundPdf = lessonDocsRes.json?.data?.find((d: any) => d.id === createdPdfResourceId);
  assert(foundPdf !== undefined, "Created PDF is associated with lesson lsn_01");
  assert(foundPdf?.lessonId === "lsn_01", "Document lessonId strictly equals lsn_01");

  // =========================================================================
  // DOCUMENT TEST 10: PERSISTENCE
  // =========================================================================
  console.log("\n--- Document Test 10: Document Persistence ---");
  const singleDocRes = await request(`/api/lessons/lsn_01/documents/${createdPdfResourceId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });

  assert(singleDocRes.status === 200, `Fetch single document returns 200 (got ${singleDocRes.status})`);
  assert(singleDocRes.json?.data?.id === createdPdfResourceId, "Persisted document ID matches");
  assert(singleDocRes.json?.data?.charCount > 0, "Persisted document retains character count");
  assert(singleDocRes.json?.data?.status === "READY", "Persisted document retains status READY");

  // =========================================================================
  // EXPANDED DOCUMENT TESTS (10b - 10g): PPTX, XLSX, CSV, TXT, TABLES, SCANNED
  // =========================================================================
  console.log("\n--- Document Test 10b: PPTX Presentation Slide Extraction ---");
  const pptxBuf = await createValidTestPptxBuffer("Integers in Everyday Life", [
    "Temperatures below zero degrees",
    "Depths below sea level",
    "Financial debt and balances",
  ]);
  const pptxExtract = await extractDocumentContent({
    buffer: pptxBuf,
    fileName: "grade7_integers_presentation.pptx",
  });
  assert(pptxExtract.success === true, "PPTX extractor succeeds");
  assert(pptxExtract.status === "READY", "PPTX status is READY");
  assert(pptxExtract.data?.fileType === "PPTX", "Detected file type is PPTX");
  assert(
    Boolean(pptxExtract.data?.extractedText.includes("Integers in Everyday Life")),
    "PPTX slide title extracted"
  );
  assert(
    Boolean(pptxExtract.data?.extractedText.includes("Temperatures below zero")),
    "PPTX bullet points extracted"
  );

  console.log("\n--- Document Test 10c: XLSX Spreadsheet Extraction ---");
  const xlsxBuf = await createValidTestXlsxBuffer([
    ["City", "Elevation", "Integer Representation"],
    ["Baguio", "1500m", "+1500"],
    ["Dead Sea", "-430m", "-430"],
  ]);
  const xlsxExtract = await extractDocumentContent({
    buffer: xlsxBuf,
    fileName: "elevation_data.xlsx",
  });
  assert(xlsxExtract.success === true, "XLSX extractor succeeds");
  assert(xlsxExtract.data?.fileType === "XLSX", "Detected file type is XLSX");
  assert(Boolean(xlsxExtract.data?.extractedText.includes("| City | Elevation |")), "XLSX converted to Markdown table");

  console.log("\n--- Document Test 10d: CSV Tabular Dataset Extraction ---");
  const csvRaw = `Integer,Additive Inverse,Absolute Value
-7,+7,7
+12,-12,12
0,0,0`;
  const csvExtract = await extractDocumentContent({
    buffer: Buffer.from(csvRaw, "utf-8"),
    fileName: "integer_properties.csv",
  });
  assert(csvExtract.success === true, "CSV extractor succeeds");
  assert(Boolean(csvExtract.data?.extractedText.includes("| Integer | Additive Inverse |")), "CSV formatted as Markdown table");
  assert(Boolean(csvExtract.data?.extractedText.includes("| -7 | +7 | 7 |")), "CSV rows formatted cleanly");

  console.log("\n--- Document Test 10e: Plain Text & Markdown with LaTeX Preservation ---");
  const mdRaw = `# Understanding Additive Inverses
Every integer $a$ has an opposite $-a$ such that:
$$a + (-a) = 0$$
For example, for $x = -4$:
$$-(-4) = +4$$`;
  const mdExtract = await extractDocumentContent({
    buffer: Buffer.from(mdRaw, "utf-8"),
    fileName: "notes.md",
  });
  assert(mdExtract.success === true, "Markdown text extraction succeeds");
  assert(Boolean(mdExtract.data?.extractedText.includes("$$a + (-a) = 0$$")), "LaTeX equation $$...$$ strictly preserved");
  assert(Boolean(mdExtract.data?.extractedText.includes("$x = -4$")), "Inline LaTeX math $...$ strictly preserved");

  console.log("\n--- Document Test 10f: Complex Nested Table Parsing ---");
  const unformattedTable = `Number    Opposite    Absolute_Value
-10       10          10
25        -25         25
-3        3           3`;
  const tableResult = formatTableLines(unformattedTable);
  assert(tableResult.tablesCount === 1, "Detects tabular columns in unstructured text");
  assert(tableResult.formattedText.includes("| Number | Opposite | Absolute_Value |"), "Generates Markdown header");
  assert(tableResult.formattedText.includes("| :--- | :--- | :--- |"), "Generates Markdown column alignment separators");

  console.log("\n--- Document Test 10g: Scanned PDF Detection & Honest Reporting ---");
  // PDF with zero readable characters
  const emptyPdfBuf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n100\n%%EOF" +
    "A".repeat(4000)
  );
  const scannedResult = await extractDocumentContent({
    buffer: emptyPdfBuf,
    fileName: "scanned_handwritten_quiz.pdf",
  });
  assert(scannedResult.success === false, "Scanned PDF without text layer safely intercepted");
  assert(
    Boolean(scannedResult.error?.includes("Scanned / image-only PDF detected") || scannedResult.error?.includes("OCR")),
    "Honestly identifies scanned document requiring OCR or selectable text"
  );

  // =========================================================================
  // AI TEST 11: AI RETRIEVES LESSON CONTENT
  // =========================================================================
  console.log("\n--- AI Test 11: AI Retrieves Lesson Content ---");
  const tutorContext = await buildAITutorContext({
    studentId: "usr_student_01",
    lessonId: "lsn_01",
    studentQuery: "What is an integer?",
  });

  assert(tutorContext.groundedLesson !== undefined, "Tutor context contains groundedLesson");
  assert(Boolean(tutorContext.groundedLesson?.title.includes("Integers")), "Grounded lesson title is Integers");
  assert((tutorContext.groundedLesson?.contentBlocks?.length || 0) > 0, "Lesson content blocks are present");

  // =========================================================================
  // AI TEST 12: AI RETRIEVES TEACHER DOCUMENT CONTENT
  // =========================================================================
  console.log("\n--- AI Test 12: AI Retrieves Teacher Document Content ---");
  assert(tutorContext.groundedLesson?.teacherMaterials !== undefined, "Teacher materials are retrieved in AI context");
  const hasGroundedDoc = tutorContext.groundedLesson?.teacherMaterials.some(
    (m) => m.type === "PDF" || m.type === "DOCUMENT"
  );
  assert(Boolean(hasGroundedDoc), "AI Tutor context includes teacher PDF/DOCX material");

  // =========================================================================
  // AI TEST 13: AI USES RELEVANT DOCUMENT SECTION
  // =========================================================================
  console.log("\n--- AI Test 13: AI Uses Relevant Document Section ---");
  const testChunks = [
    { id: "c1", heading: "Introduction to Whole Numbers", content: "Whole numbers include 0, 1, 2, 3...", charCount: 35, sequenceOrder: 1 },
    { id: "c2", heading: "Subtraction and Additive Inverse", content: "Subtracting an integer is the same as adding its opposite. For example, a - b = a + (-b).", charCount: 88, sequenceOrder: 2 },
    { id: "c3", heading: "Multiplication Rules", content: "Multiplying like signs gives a positive product.", charCount: 48, sequenceOrder: 3 },
  ];

  const matched = findRelevantDocumentChunks("Why do we change subtraction to additive inverse?", testChunks, 1);
  assert(matched.length === 1, "Relevance filter returns top matching chunk");
  assert(Boolean(matched[0]?.heading.includes("Additive Inverse")), `Relevance filter matched correct section '${matched[0]?.heading}'`);

  // =========================================================================
  // AI TEST 14: AI DOES NOT CLAIM INACCESSIBLE CONTENT
  // =========================================================================
  console.log("\n--- AI Test 14: AI Does Not Claim Inaccessible Content ---");
  const engine = new LocalTutorEngine();
  const honestResp = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "Can you tell me what is inside the corrupted failed pdf document?"',
  });
  const parsedHonest = JSON.parse(honestResp.text);
  assert(
    parsedHonest.message.includes("couldn't extract its text") || parsedHonest.message.includes("failed"),
    "AI Tutor honestly states it could not extract text from the failed document"
  );
  assert(
    !parsedHonest.message.includes("The document says that"),
    "AI Tutor never claims to have read an unextracted file"
  );

  // =========================================================================
  // AI TEST 15: AI DOES NOT HALLUCINATE DOCUMENT CONTENT
  // =========================================================================
  console.log("\n--- AI Test 15: AI Does Not Hallucinate Document Content ---");
  const hallucinationResp = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "Quote page 99 of the teacher guide which does not exist."',
  });
  const parsedHallucination = JSON.parse(hallucinationResp.text);
  assert(
    !parsedHallucination.message.includes("Page 99 states"),
    "AI refuses to hallucinate details for failed documents"
  );

  // =========================================================================
  // AI TEST 16: AI REMEMBERS PREVIOUS RESPONSE
  // =========================================================================
  console.log("\n--- AI Test 16: AI Remembers Previous Response ---");
  const memoryResp = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "Student Turn 2: -5 is the first number. What next?"',
    conversationHistory: [
      { role: "student", content: "I want to solve -5 + 8." },
      { role: "assistant", content: "Let's begin! What is the first number you see on the left?" },
    ],
  });
  const parsedMemory = JSON.parse(memoryResp.text);
  assert(
    parsedMemory.message.toLowerCase().includes("-5") || parsedMemory.message.includes("first number"),
    "AI acknowledges intermediate student answer ('-5 is the first number')"
  );
  assert(
    parsedMemory.message.includes("+8") || parsedMemory.message.includes("8 units") || parsedMemory.message.includes("next step") || parsedMemory.message.includes("second number"),
    "AI asks the next logical Socratic step rather than repeating step 1"
  );

  // =========================================================================
  // AI TEST 17: AI AVOIDS IDENTICAL REPEATED RESPONSES
  // =========================================================================
  console.log("\n--- AI Test 17: AI Avoids Identical Repeated Responses ---");
  const turn1 = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "I don\'t get -7 + 3."',
  });
  const turn2 = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "I still don\'t get -7 + 3."',
    conversationHistory: [
      { role: "student", content: "I don't get -7 + 3." },
      { role: "assistant", content: JSON.parse(turn1.text).message },
    ],
  });
  const t1Parsed = JSON.parse(turn1.text);
  const t2Parsed = JSON.parse(turn2.text);
  assert(t1Parsed.message !== t2Parsed.message, "Turn 1 and Turn 2 responses are distinct");
  assert(
    t2Parsed.message.includes("counters") || t2Parsed.message.includes("different way") || t2Parsed.message.includes("chips"),
    "Turn 2 shifts pedagogical strategy to concrete representation"
  );

  // =========================================================================
  // AI TEST 18: AI ADAPTS TO STUDENT MISTAKE
  // =========================================================================
  console.log("\n--- AI Test 18: AI Adapts to Student Mistake ---");
  const mistakeResp = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "I think -5 + 3 = -8."',
  });
  const parsedMistake = JSON.parse(mistakeResp.text);
  assert(parsedMistake.detectedIssue === "SIGN_ERROR", "AI detected SIGN_ERROR issue");
  assert(
    parsedMistake.message.includes("opposite signs") || parsedMistake.message.includes("subtract"),
    "AI explains the sign error rule"
  );

  // =========================================================================
  // AI TEST 19: AI ADAPTS TO MASTERY
  // =========================================================================
  console.log("\n--- AI Test 19: AI Adapts to Mastery ---");
  const masteryResp = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "I have mastered integer addition. Give me a challenge!"',
  });
  const parsedMastery = JSON.parse(masteryResp.text);
  assert(parsedMastery.suggestedAction === "TRY_HARDER", "AI suggests TRY_HARDER for mastered student");
  assert(
    parsedMastery.message.includes("challenge") || parsedMastery.message.includes("multi-step"),
    "AI presents extension challenge"
  );

  // =========================================================================
  // AI TEST 20: AI GENERATES LESSON-SPECIFIC QUESTIONS
  // =========================================================================
  console.log("\n--- AI Test 20: AI Generates Lesson-Specific Questions ---");
  const generator = new PracticeQuestionGenerator();
  const generatedResult = await generator.generateQuestion({
    lessonId: "lsn_01",
    skillId: "skl_01",
    studentMistakePattern: "SIGN_ERROR",
  });
  assert(generatedResult.success === true, "Question generation succeeded");
  assert(generatedResult.question !== null, "Question payload is generated");
  const exp = generatedResult.question?.explainability;
  assert(Boolean(exp), "Explainability metadata is present");
  assert(
    Boolean(exp?.source?.includes("Teacher") || exp?.source?.includes("Lesson")),
    "Source is grounded"
  );
  assert(
    Boolean(exp?.reason?.includes("SIGN_ERROR")),
    "Reason references student mistake target"
  );

  // =========================================================================
  // AI TEST 21: AI AVOIDS RECENT DUPLICATE QUESTIONS
  // =========================================================================
  console.log("\n--- AI Test 21: AI Avoids Recent Duplicate Questions ---");
  const firstPrompt = generatedResult.question?.prompt || "";
  const diverseResult = await generator.generateQuestion({
    lessonId: "lsn_01",
    skillId: "skl_01",
    recentQuestionPrompts: [firstPrompt],
  });
  assert(diverseResult.success === true, "Diverse question generation succeeded");
  assert(diverseResult.question?.prompt !== firstPrompt, "Generator produces an alternate non-duplicate prompt");

  // =========================================================================
  // AI TEST 22: AI REMAINS SOCRATIC
  // =========================================================================
  console.log("\n--- AI Test 22: AI Remains Socratic ---");
  const directDemandResp = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "Just tell me the answer to -10 + 4 right now."',
  });
  const parsedDirect = JSON.parse(directDemandResp.text);
  assert(
    parsedDirect.type === "GUIDING_QUESTION" || parsedDirect.responseType === "GUIDING_QUESTION",
    "AI responds with GUIDING_QUESTION to direct answer demand"
  );
  assert(!parsedDirect.message.includes("-6"), "AI does not leak the final numerical answer");

  // =========================================================================
  // AI TEST 23: AI RESPONDS APPROPRIATELY TO 'I DON'T KNOW'
  // =========================================================================
  console.log("\n--- AI Test 23: AI Responds Appropriately to 'I don't know' ---");
  const idkResp = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "I don\'t know."',
  });
  const parsedIdk = JSON.parse(idkResp.text);
  assert(
    parsedIdk.type === "GUIDING_QUESTION" || parsedIdk.responseType === "GUIDING_QUESTION",
    "AI responds with gentle guiding question"
  );
  assert(
    parsedIdk.message.includes("completely okay") || parsedIdk.message.includes("together"),
    "AI provides supportive encouragement"
  );

  // =========================================================================
  // AI TEST 24: AI RESPONDS DIFFERENTLY AFTER REPEATED CONFUSION
  // =========================================================================
  console.log("\n--- AI Test 24: AI Responds Differently After Repeated Confusion ---");
  const repeatedConfusionResp = await engine.generateTutorResponse({
    systemPrompt: "You are Tuklas AI.",
    userPrompt: 'Student Query: "I am still confused and completely lost."',
    conversationHistory: [
      { role: "student", content: "I don't understand." },
      { role: "assistant", content: "Let's start small. Do you see the numbers?" },
      { role: "student", content: "I still don't get it." },
      { role: "assistant", content: "Think of money. What happens when you owe debt?" },
    ],
  });
  const parsedConfusion = JSON.parse(repeatedConfusionResp.text);
  assert(parsedConfusion.suggestedAction === "TRY_EASIER", "AI shifts suggested action to TRY_EASIER");
  assert(
    parsedConfusion.message.includes("counters") || parsedConfusion.message.includes("different representation"),
    "AI introduces concrete counters model"
  );

  // =========================================================================
  // AI TEST 25: VOICE AND TEXT SHARE CONTEXT
  // =========================================================================
  console.log("\n--- AI Test 25: Voice and Text Share Context ---");
  const textTutorRes = await request("/api/ai/tutor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      lessonId: "lsn_01",
      message: "What is an integer?",
    }),
  });

  const conversationId = textTutorRes.json?.data?.conversationId || textTutorRes.json?.conversationId;
  assert(Boolean(conversationId), "Text interaction created/returned a conversationId");

  const voiceTutorRes = await request("/api/ai/tutor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      lessonId: "lsn_01",
      conversationId,
      message: "How does the number line show that?",
    }),
  });
  const voiceConversationId = voiceTutorRes.json?.data?.conversationId || voiceTutorRes.json?.conversationId;
  assert(voiceConversationId === conversationId, "Voice and text interact using the identical conversation ID");

  // =========================================================================
  // AI TEST 26: STUDENT ISOLATION (IDOR)
  // =========================================================================
  console.log("\n--- AI Test 26: Student Isolation (IDOR) ---");
  const idorRes = await request(`/api/ai/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${student2Token}` },
  });
  assert(idorRes.status === 403 || idorRes.status === 404, `Student 2 blocked from Student 1 conversation (HTTP ${idorRes.status})`);

  // =========================================================================
  // AI TEST 27: STUDENT CANNOT MODIFY TEACHER DOCUMENTS
  // =========================================================================
  console.log("\n--- AI Test 27: Student Cannot Modify Teacher Documents ---");
  const studentUploadRes = await request("/api/lessons/lsn_01/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      title: "Hacked Document",
      fileName: "hacked.pdf",
      fileSize: 1024,
      fileContent: Buffer.from("DUMMY").toString("base64"),
    }),
  });
  assert(studentUploadRes.status === 403, `Student upload blocked with 403 Forbidden (got ${studentUploadRes.status})`);

  const studentDeleteRes = await request(`/api/lessons/lsn_01/documents/${createdPdfResourceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(studentDeleteRes.status === 403, `Student document delete blocked with 403 Forbidden (got ${studentDeleteRes.status})`);

  // =========================================================================
  // AI TEST 28: UNAUTHORIZED TEACHER CANNOT ACCESS ANOTHER TEACHER'S PRIVATE MATERIAL
  // =========================================================================
  console.log("\n--- AI Test 28: Unauthorized Teacher Isolation ---");
  // Teacher 2 attempts to upload to Teacher 1's lesson (lsn_01)
  const teacher2UploadRes = await request("/api/lessons/lsn_01/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacher2Token}`,
    },
    body: JSON.stringify({
      title: "Intruder Document",
      fileName: "intruder.pdf",
      fileSize: 1024,
      fileContent: Buffer.from("DUMMY").toString("base64"),
    }),
  });

  assert(
    teacher2UploadRes.status === 403,
    `Unauthorized Teacher 2 blocked from modifying Teacher 1's lesson (HTTP ${teacher2UploadRes.status})`
  );

  // Teacher 2 attempts to delete Teacher 1's document
  const teacher2DeleteRes = await request(`/api/lessons/lsn_01/documents/${createdPdfResourceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${teacher2Token}` },
  });

  assert(
    teacher2DeleteRes.status === 403,
    `Unauthorized Teacher 2 blocked from deleting Teacher 1's document (HTTP ${teacher2DeleteRes.status})`
  );

  // Teacher 1 creates a private draft lesson
  const createDraftRes = await request("/api/lessons", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      title: "Teacher 1 Private Research Lesson",
      description: "Private draft lesson",
      unitId: "unt_01",
      learningObjectives: ["Investigate advanced integers"],
      estimatedMinutes: 20,
    }),
  });

  if (createDraftRes.status === 201) {
    const draftId = createDraftRes.json?.data?.id || createDraftRes.json?.lesson?.id || createDraftRes.json?.id;
    if (draftId) {
      const teacher2DraftDocRes = await request(`/api/lessons/${draftId}/documents`, {
        headers: { Authorization: `Bearer ${teacher2Token}` },
      });
      assert(
        teacher2DraftDocRes.status === 403,
        `Teacher 2 blocked from viewing Teacher 1's unpublished draft documents (HTTP ${teacher2DraftDocRes.status})`
      );
    }
  }

  console.log("\n=================================================================");
  console.log(`🎉 PHASE 22 SUITE COMPLETE: ${passedCount} PASS, ${failedCount} FAIL`);
  console.log("=================================================================\n");
}

runPhase22Suite().catch((err) => {
  console.error("\n💥 FATAL SUITE EXECUTION ERROR:", err);
  process.exit(1);
});
