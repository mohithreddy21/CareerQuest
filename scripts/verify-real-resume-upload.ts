import { PrismaClient } from '@prisma/client';
import { PrismaCareerRepository } from '../src/services/prisma-career-repository';
import { DocumentService } from '../src/features/documents/services/document.service';
import { DocumentTextExtractor } from '../src/features/documents/services/document-text-extractor';
import { resumeIngestionService } from '../src/features/knowledge/services/resume-ingestion-service';
import { knowledgeBankService } from '../src/features/knowledge/services/knowledge-bank-service';
import { getStorage } from '../src/services/storage/storage-provider';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

const prisma = new PrismaClient();
const repo = new PrismaCareerRepository();

async function run() {
  console.log('====================================================');
  console.log('  CareerQuest Real Resume Upload & Ingestion Test');
  console.log('====================================================\n');

  const CAND_A = 'cand-upload-test-a';
  const CAND_B = 'cand-upload-test-b';

  // Cleanup fixtures
  await prisma.knowledgeItem.deleteMany({ where: { candidateId: { in: [CAND_A, CAND_B] } } });
  await prisma.resumeIngestionBatch.deleteMany({ where: { candidateId: { in: [CAND_A, CAND_B] } } });
  await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: [CAND_A, CAND_B] } } });
  await prisma.candidate.deleteMany({ where: { id: { in: [CAND_A, CAND_B] } } });

  try {
    // 1. Provision candidates
    console.log('--- 1. PROVISION TEST CANDIDATES ---');
    await prisma.candidate.create({
      data: {
        id: CAND_A,
        clerkUserId: 'user_upload_test_a',
        email: 'cand-a@uploadtest.internal',
        profile: {
          create: {
            name: 'Alex Vance',
            headline: 'Full-Stack Engineer',
            location: 'San Francisco, CA',
            professionalSummary: 'Full-Stack Engineer with 5 years experience.'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Full-Stack Engineer']
          }
        }
      }
    });
    console.log('PASS 01: Created Candidate A with ID:', CAND_A);

    await prisma.candidate.create({
      data: {
        id: CAND_B,
        clerkUserId: 'user_upload_test_b',
        email: 'cand-b@uploadtest.internal',
        profile: {
          create: {
            name: 'Morgan Blake',
            headline: 'DevOps Engineer',
            location: 'New York, NY',
            professionalSummary: 'DevOps & SRE Specialist.'
          }
        },
        preferences: {
          create: {
            targetRoles: ['DevOps Engineer']
          }
        }
      }
    });
    console.log('PASS 02: Created Candidate B with ID:', CAND_B);

    // 2. Create Real PDF Document
    console.log('\n--- 2. REAL PDF UPLOAD & PARSING ---');
    const pdf = new jsPDF();
    pdf.text('Alex Vance', 10, 10);
    pdf.text('Senior Full-Stack Engineer at CloudScale Inc', 10, 20);
    pdf.text('June 2022 - Present | San Francisco, CA', 10, 30);
    pdf.text('- Engineered distributed services using Go and PostgreSQL.', 10, 40);
    pdf.text('- Built responsive web applications with React and Next.js.', 10, 50);
    pdf.text('Skills: Python, TypeScript, React, Next.js, Go, Docker, PostgreSQL', 10, 60);
    pdf.text('Education: Bachelor of Science in Computer Science at UC Berkeley', 10, 70);
    const pdfBytes = pdf.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfBytes);

    // Test text extraction from PDF
    const extractedPdfText = await DocumentTextExtractor.extractFromPdf(pdfBuffer);
    console.log('PASS 03: Extracted PDF text length:', extractedPdfText.length, 'chars');
    if (!extractedPdfText.includes('Alex Vance') || !extractedPdfText.includes('Python')) {
      throw new Error(`PDF text extraction failed: "${extractedPdfText}"`);
    }

    // Upload & Persist PDF
    const pdfDoc = await DocumentService.uploadDocument(
      CAND_A,
      pdfBuffer,
      'alex_vance_resume.pdf',
      'application/pdf'
    );
    console.log('PASS 04: CandidateDocument persisted in DB -> ID:', pdfDoc.id, '| Hash:', pdfDoc.hash.slice(0, 10));
    if (!pdfDoc.id || pdfDoc.candidateId !== CAND_A) {
      throw new Error('CandidateDocument persistence failure');
    }

    // Verify storage persistence
    const storage = getStorage();
    const storedObj = await storage.get(pdfDoc.storageKey);
    console.log('PASS 05: Object stored in storage adapter -> Size:', storedObj.size, 'bytes');
    if (storedObj.size !== pdfBuffer.length) {
      throw new Error('Stored object size mismatch');
    }

    // Ingest into proposed batch
    const pdfBatch = await resumeIngestionService.ingestResume(CAND_A, {
      fileName: pdfDoc.filename,
      text: extractedPdfText,
      documentId: pdfDoc.id
    });
    console.log('PASS 06: Proposed Ingestion Batch created -> ID:', pdfBatch.id, '| Items count:', pdfBatch.items.length);
    if (pdfBatch.items.length === 0 || pdfBatch.documentId !== pdfDoc.id) {
      throw new Error('Proposed batch was not created properly with documentId');
    }

    // 3. Create Real DOCX Document
    console.log('\n--- 3. REAL DOCX UPLOAD & PARSING ---');
    const zip = new JSZip();
    const docxXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Morgan Blake - Systems Engineer</w:t></w:r></w:p>
    <w:p><w:r><w:t>Lead Infrastructure Architect at DataGrid Systems</w:t></w:r></w:p>
    <w:p><w:r><w:t>2021 - Present</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Designed Kubernetes clusters with Terraform and Prometheus.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Skills: Kubernetes, Terraform, Docker, AWS, Prometheus, Linux, CI/CD</w:t></w:r></w:p>
    <w:p><w:r><w:t>Education: Master of Science in Computer Science at Stanford University</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    zip.file('word/document.xml', docxXml);
    const docxBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Test text extraction from DOCX
    const extractedDocxText = await DocumentTextExtractor.extractFromDocx(docxBuffer);
    console.log('PASS 07: Extracted DOCX text length:', extractedDocxText.length, 'chars');
    if (!extractedDocxText.includes('Morgan Blake') || !extractedDocxText.includes('Kubernetes')) {
      throw new Error('DOCX text extraction failed');
    }

    // Upload & Persist DOCX
    const docxDoc = await DocumentService.uploadDocument(
      CAND_B,
      docxBuffer,
      'morgan_blake_resume.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    console.log('PASS 08: CandidateDocument persisted in DB for Cand B -> ID:', docxDoc.id);

    const docxBatch = await resumeIngestionService.ingestResume(CAND_B, {
      fileName: docxDoc.filename,
      text: extractedDocxText,
      documentId: docxDoc.id
    });
    console.log('PASS 09: Proposed Ingestion Batch created for Cand B -> Items count:', docxBatch.items.length);
    if (docxBatch.items.length === 0) {
      throw new Error('DOCX proposed batch has 0 items');
    }

    // 4. Candidate reviews and approves proposed claims
    console.log('\n--- 4. CANDIDATE REVIEW & KNOWLEDGE BANK APPROVAL ---');
    const skillClaim = pdfBatch.items.find((i) => i.category === 'skill');
    if (!skillClaim) throw new Error('No skill claim found in batch');

    await knowledgeBankService.resolveProposedItem(CAND_A, pdfBatch.id, skillClaim.tempId, 'accept');
    const kbAfterApproval = await repo.getKnowledgeBank(CAND_A);
    const approvedSkillName = (skillClaim.content as { name: string }).name;
    const isApprovedInKb = kbAfterApproval.skills.some(
      (s) => (s.content as { name: string }).name.toLowerCase() === approvedSkillName.toLowerCase()
    );
    console.log(`PASS 10: Approved claim "${approvedSkillName}" entered Knowledge Bank:`, isApprovedInKb);
    if (!isApprovedInKb) throw new Error('Approved item failed to enter Knowledge Bank');

    // 5. Negative Security Tests
    console.log('\n--- 5. NEGATIVE VALIDATION TESTS ---');

    // 5a. Oversized file (> 10 MB)
    let oversizedBlocked = false;
    try {
      const hugeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024); // 10MB + 1KB
      hugeBuffer.write('%PDF-1.4');
      await DocumentService.uploadDocument(CAND_A, hugeBuffer, 'huge_file.pdf', 'application/pdf');
    } catch (err: unknown) {
      oversizedBlocked = (err as Error).message.includes('exceeds the maximum allowed limit of 10MB');
    }
    console.log('PASS 11: Oversized file (>10MB) rejected with clear error:', oversizedBlocked);
    if (!oversizedBlocked) throw new Error('Oversized file was not blocked!');

    // 5b. Unsupported file extension (.exe)
    let unsupportedBlocked = false;
    try {
      const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04');
      await DocumentService.uploadDocument(CAND_A, exeBuffer, 'malicious.exe', 'application/x-msdownload');
    } catch (err: unknown) {
      unsupportedBlocked = (err as Error).message.includes('Unsupported file extension');
    }
    console.log('PASS 12: Unsupported file extension rejected with clear error:', unsupportedBlocked);
    if (!unsupportedBlocked) throw new Error('Unsupported extension was not blocked!');

    // 5c. Disguised executable / malformed PDF (MZ header with .pdf extension)
    let disguisedBlocked = false;
    try {
      const disguisedBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff');
      await DocumentService.uploadDocument(CAND_A, disguisedBuffer, 'fake.pdf', 'application/pdf');
    } catch (err: unknown) {
      disguisedBlocked = (err as Error).message.includes('signature');
    }
    console.log('PASS 13: Disguised executable (.pdf extension with MZ magic bytes) rejected:', disguisedBlocked);
    if (!disguisedBlocked) throw new Error('Disguised executable was not blocked!');

    // 5d. Duplicate resume upload (uploading exact same content twice)
    let duplicateBlocked = false;
    try {
      await DocumentService.uploadDocument(
        CAND_A,
        pdfBuffer,
        'alex_vance_resume_duplicate.pdf',
        'application/pdf'
      );
    } catch (err: unknown) {
      duplicateBlocked = (err as Error).message.includes('Duplicate resume content');
    }
    console.log('PASS 14: Duplicate upload rejected with clear message:', duplicateBlocked);
    if (!duplicateBlocked) throw new Error('Duplicate resume upload was not blocked!');

    // 6. Multi-Tenant Candidate Isolation
    console.log('\n--- 6. MULTI-TENANT CANDIDATE ISOLATION ---');
    const candADocs = await repo.getCandidateDocuments(CAND_A);
    const candBDocs = await repo.getCandidateDocuments(CAND_B);

    console.log('PASS 15: Candidate A sees only their own documents count:', candADocs.length);
    console.log('PASS 16: Candidate B sees only their own documents count:', candBDocs.length);
    if (candADocs.some((d) => d.candidateId !== CAND_A)) throw new Error('Cand A sees Cand B docs');
    if (candBDocs.some((d) => d.candidateId !== CAND_B)) throw new Error('Cand B sees Cand A docs');

    // Candidate B cannot access Candidate A document by ID
    const crossAccessDoc = await repo.getCandidateDocumentById(pdfDoc.id, CAND_B);
    console.log('PASS 17: Candidate B cannot access Candidate A document by ID:', crossAccessDoc === null);
    if (crossAccessDoc !== null) throw new Error('Candidate isolation breach on document retrieval!');

    // Candidate B cannot see Candidate A proposed batches
    const candBBatches = await repo.getProposedBatches(CAND_B);
    const seesCandABatch = candBBatches.some((b) => b.id === pdfBatch.id);
    console.log('PASS 18: Candidate B cannot see Candidate A proposed batches:', !seesCandABatch);
    if (seesCandABatch) throw new Error('Candidate isolation breach on proposed batches!');

    // 7. Fresh Instance Persistence
    console.log('\n--- 7. FRESH REPOSITORY INSTANCE PERSISTENCE ---');
    const freshRepo = new PrismaCareerRepository();
    const freshDoc = await freshRepo.getCandidateDocumentById(pdfDoc.id, CAND_A);
    console.log('PASS 19: Fresh repository instance sees persisted document:', freshDoc?.filename === 'alex_vance_resume.pdf');
    if (!freshDoc) throw new Error('Document did not survive fresh repository instance');

    const freshBatches = await freshRepo.getProposedBatches(CAND_A);
    console.log('PASS 20: Fresh repository instance sees proposed batch count:', freshBatches.length);
    if (freshBatches.length === 0) throw new Error('Batch did not survive fresh repository instance');

    console.log('\n====================================================');
    console.log('  ALL 20 CHECKPOINTS PASSED!');
    console.log('  Real Resume Upload, Storage, Parsing, and Review');
    console.log('  Lifecycle: VERIFIED & CONFIRMED');
    console.log('====================================================\n');

  } finally {
    // Teardown
    await prisma.knowledgeItem.deleteMany({ where: { candidateId: { in: [CAND_A, CAND_B] } } });
    await prisma.resumeIngestionBatch.deleteMany({ where: { candidateId: { in: [CAND_A, CAND_B] } } });
    await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: [CAND_A, CAND_B] } } });
    await prisma.candidate.deleteMany({ where: { id: { in: [CAND_A, CAND_B] } } });
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
