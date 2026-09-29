import * as fs from 'node:fs';
import * as path from 'node:path';
import { jsPDF } from 'jspdf';
import { DocumentTextExtractor } from '../src/features/documents/services/document-text-extractor';
import {
  LLMResumeParserProvider,
  formatSectionBoundaries
} from '../src/features/knowledge/services/providers/llm-resume-parser-provider';

async function runRegressionSuite() {
  console.log('====================================================');
  console.log('  PDF Extraction Diagnostic & Regression Suite');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAIL [Test ${totalTests}]: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`✅ PASS [Test ${totalTests}]: ${message}`);
    passedTests++;
  }

  // --------------------------------------------------------------------------
  // TEST 1: Synthetic Multi-Section Resume Quality & Formatting
  // --------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Standard Multi-Section Extraction Quality ---');
  const standardPdf = new jsPDF();
  standardPdf.text('Candidate Test Profile', 10, 10);
  standardPdf.text('Professional Summary', 10, 20);
  standardPdf.text('Experienced Software Engineer specializing in scalable cloud applications.', 10, 30);
  standardPdf.text('Skills', 10, 40);
  standardPdf.text('Python, TypeScript, React, Next.js, Node.js, PostgreSQL, Docker, AWS', 10, 50);
  standardPdf.text('Work Experience', 10, 60);
  standardPdf.text('Senior Software Engineer at Horizon Systems (2021 - Present)', 10, 70);
  standardPdf.text('Education', 10, 80);
  standardPdf.text('Bachelor of Science in Computer Science, Tech University (2017 - 2021)', 10, 90);
  standardPdf.text('Projects', 10, 100);
  standardPdf.text('Microservices Orchestrator: Built distributed job scheduler in Go.', 10, 110);
  standardPdf.text('Certifications', 10, 120);
  standardPdf.text('AWS Certified Solutions Architect - Associate (2023)', 10, 130);

  const standardBuffer = Buffer.from(standardPdf.output('arraybuffer'));
  const standardText = await DocumentTextExtractor.extractText(
    standardBuffer,
    'application/pdf',
    'standard_resume.pdf'
  );

  assert(standardText.length > 200, `Standard PDF extracted text is non-empty (${standardText.length} chars)`);
  assert(standardText.length < 5000, `Standard PDF extracted text has realistic length (${standardText.length} chars)`);
  assert(
    !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(standardText),
    'Standard PDF extraction contains no non-printable control characters'
  );

  const formattedStandard = formatSectionBoundaries(standardText);
  assert(
    formattedStandard.includes('=== SECTION: SKILLS ==='),
    'formatSectionBoundaries preserved and formatted SKILLS section'
  );
  assert(
    formattedStandard.includes('=== SECTION: WORK EXPERIENCE ==='),
    'formatSectionBoundaries preserved and formatted WORK EXPERIENCE section'
  );
  assert(
    formattedStandard.includes('=== SECTION: EDUCATION ==='),
    'formatSectionBoundaries preserved and formatted EDUCATION section'
  );
  assert(
    formattedStandard.includes('=== SECTION: PROJECTS ==='),
    'formatSectionBoundaries preserved and formatted PROJECTS section'
  );

  // --------------------------------------------------------------------------
  // TEST 2: Real Uploaded PDF Extraction Inflation Guard
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Real Resume Upload Bug Verification ---');
  const realPdfPath = path.join(
    process.cwd(),
    '.storage',
    'candidates',
    'cmui5p0pf0000u48kclvfjytp',
    'documents',
    'doc_1790489542714_byd6ucj_Software_Developer_Python.pdf'
  );

  if (fs.existsSync(realPdfPath)) {
    const realPdfBuffer = fs.readFileSync(realPdfPath);
    const realExtracted = await DocumentTextExtractor.extractText(
      realPdfBuffer,
      'application/pdf',
      'Software Developer Python.pdf'
    );

    console.log(`[Diagnostic] Real PDF size: ${realPdfBuffer.length} bytes`);
    console.log(`[Diagnostic] Real PDF extracted length: ${realExtracted.length} characters (previously 165,512)`);

    assert(
      realExtracted.length < 50000,
      `Real resume length (${realExtracted.length} chars) is strictly below the 50,000 character limit (was 165,512)`
    );
    assert(
      realExtracted.length >= 1000 && realExtracted.length <= 15000,
      `Real resume extracted length is within expected realistic range [1,000 - 15,000 chars]: actual = ${realExtracted.length}`
    );
    assert(
      !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(realExtracted),
      'Real resume extraction contains zero non-printable binary font artifacts'
    );

    const formattedReal = formatSectionBoundaries(realExtracted);
    assert(
      formattedReal.includes('=== SECTION: SKILLS ==='),
      'Real resume text extraction retains SKILLS section boundary'
    );
    assert(
      formattedReal.includes('=== SECTION: PROJECTS ===') ||
        formattedReal.includes('=== SECTION: EDUCATION ==='),
      'Real resume text extraction retains structural section boundaries'
    );
  } else {
    console.log('Skipping real PDF check (file not present in storage directory)');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Synthetic Embedded Font Bytecode Inflation Regression
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Font Bytecode Stream Rejection Test ---');
  // Construct a minimal PDF with 1 visible Page and 1 embedded font program (/Length1)
  // containing binary byte sequences that mimic (fake_text) Tj to ensure the extractor
  // NEVER extracts text from font programs.
  const fakeFontBytes = Buffer.alloc(50000);
  for (let i = 0; i < 50000; i += 20) {
    fakeFontBytes.write('(INFLATED_FONT_BYTECODE) Tj', i, 'latin1');
  }

  const pdfWithFontPayload = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    'endobj',
    '4 0 obj',
    '<< /Length 53 >>',
    'stream',
    'BT /F1 12 Tf 100 700 Td (Legitimate Resume Content) Tj ET',
    'endstream',
    'endobj',
    '5 0 obj',
    `<< /Type /FontDescriptor /FontName /TestFont /Length1 50000 /Filter /FlateDecode >>`,
    'stream',
    fakeFontBytes.toString('binary'),
    'endstream',
    'endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    'trailer',
    '<< /Size 6 /Root 1 0 R >>',
    'startxref',
    '0',
    '%%EOF'
  ].join('\n');

  const payloadBuffer = Buffer.from(pdfWithFontPayload, 'binary');
  const payloadExtracted = await DocumentTextExtractor.extractText(
    payloadBuffer,
    'application/pdf',
    'test_font_payload.pdf'
  );

  assert(
    !payloadExtracted.includes('INFLATED_FONT_BYTECODE'),
    'Extractor correctly ignored binary font descriptor streams and avoided text inflation'
  );
  assert(
    payloadExtracted.includes('Legitimate Resume Content'),
    'Extractor correctly extracted genuine page content from content stream'
  );

  // --------------------------------------------------------------------------
  // TEST 4: Oversized Document Safety Guard Preservation (MAX_RESUME_CHAR_LIMIT = 50,000)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: 50,000 Character Safety Guard Preservation ---');
  const parser = new LLMResumeParserProvider();

  // Case A: 49,999 characters (under limit) does NOT throw the oversized error
  // (we provide dummy text with length 49,999)
  const underLimitText = 'Skills: TypeScript, Python, React. '.repeat(1400).slice(0, 49900);
  let underLimitRejected = false;
  try {
    // LLM client will be called, or fail on lack of mock/key, but NOT on the 50,000 length limit
    await parser.parseResume({ fileName: 'test.pdf', text: underLimitText });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('exceeds the maximum allowed limit')) {
      underLimitRejected = true;
    }
  }
  assert(!underLimitRejected, 'Document under 50,000 chars was NOT rejected by the character limit guard');

  // Case B: 50,001 characters (strictly over limit) MUST be rejected by the safety guard
  const overLimitText = 'A'.repeat(50001);
  let overLimitRejected = false;
  let rejectedMessage = '';
  try {
    await parser.parseResume({ fileName: 'huge.pdf', text: overLimitText });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('exceeds the maximum allowed limit of 50000 characters')) {
      overLimitRejected = true;
      rejectedMessage = msg;
    }
  }
  assert(
    overLimitRejected,
    `Genuinely oversized document (>50,000 chars) was correctly rejected with: "${rejectedMessage}"`
  );

  console.log(`\n====================================================`);
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log(`====================================================\n`);
}

runRegressionSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
