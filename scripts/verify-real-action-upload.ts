import { PrismaClient } from '@prisma/client';
import { setTestCandidateId } from '../src/lib/auth';
import { uploadAndIngestResumeAction } from '../src/features/knowledge/api/actions';
import { PrismaCareerRepository } from '../src/services/prisma-career-repository';
import { knowledgeBankService } from '../src/features/knowledge/services/knowledge-bank-service';
import { getStorage } from '../src/services/storage/storage-provider';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

const prisma = new PrismaClient();
const repo = new PrismaCareerRepository();

async function run() {
  console.log('========================================================');
  console.log('  Testing uploadAndIngestResumeAction with Real Files');
  console.log('========================================================\n');

  const CAND_1 = 'cand-action-test-1';
  const CAND_2 = 'cand-action-test-2';

  // Teardown prior artifacts
  await prisma.knowledgeItem.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
  await prisma.resumeIngestionBatch.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
  await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
  await prisma.candidate.deleteMany({ where: { id: { in: [CAND_1, CAND_2] } } });

  try {
    // 1. Provision candidates
    await prisma.candidate.create({
      data: {
        id: CAND_1,
        clerkUserId: 'user_action_1',
        email: 'action1@careerquest.internal',
        profile: {
          create: {
            name: 'Sarah Connor',
            headline: 'Principal Security Architect',
            location: 'Los Angeles, CA',
            professionalSummary: 'Security expert.'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Security Architect']
          }
        }
      }
    });

    await prisma.candidate.create({
      data: {
        id: CAND_2,
        clerkUserId: 'user_action_2',
        email: 'action2@careerquest.internal',
        profile: {
          create: {
            name: 'John Connor',
            headline: 'Systems Engineer',
            location: 'Los Angeles, CA',
            professionalSummary: 'Systems engineer.'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Systems Engineer']
          }
        }
      }
    });
    console.log('PASS 01: Test candidates created in PostgreSQL.');

    // Set authenticated user to CAND_1
    setTestCandidateId(CAND_1);

    // 2. Real PDF upload via Server Action
    console.log('\n--- 2. REAL PDF UPLOAD VIA SERVER ACTION ---');
    const doc = new jsPDF();
    doc.text('Sarah Connor', 10, 10);
    doc.text('Principal Security Architect at Cyberdyne Defense', 10, 20);
    doc.text('2020 - Present | Los Angeles, CA', 10, 30);
    doc.text('- Architected zero-trust security infrastructure with Rust and Kubernetes.', 10, 40);
    doc.text('- Led automated vulnerability assessments and penetration testing.', 10, 50);
    doc.text('Skills: Rust, Python, Kubernetes, Docker, Cryptography, Linux, AWS', 10, 60);
    doc.text('Education: Master of Science in Cyber Security at MIT', 10, 70);
    const pdfArray = doc.output('arraybuffer');
    const pdfBlob = new Blob([pdfArray], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], 'sarah_connor_resume.pdf', { type: 'application/pdf' });

    const pdfFormData = new FormData();
    pdfFormData.append('file', pdfFile);

    const pdfResult = await uploadAndIngestResumeAction(pdfFormData);
    console.log('Server Action result for PDF:', pdfResult);

    if (!pdfResult.batch || !pdfResult.document) {
      throw new Error(`PDF upload action failed`);
    }
    console.log('PASS 02: Real PDF Server Action succeeded -> Batch ID:', pdfResult.batch.id, '| Document ID:', pdfResult.document.id);

    // Verify document persistence in DB
    const dbDoc = await repo.getCandidateDocumentById(pdfResult.document.id, CAND_1);
    if (!dbDoc || dbDoc.filename !== 'sarah_connor_resume.pdf') {
      throw new Error('CandidateDocument not found or mismatch');
    }
    console.log('PASS 03: CandidateDocument verified in PostgreSQL -> Filename:', dbDoc.filename, '| Mime:', dbDoc.mimeType);

    // Verify file storage in storage adapter
    const storage = getStorage();
    const storedFile = await storage.get(dbDoc.storageKey);
    if (!storedFile || storedFile.size !== pdfArray.byteLength) {
      throw new Error('Storage adapter file size mismatch');
    }
    console.log('PASS 04: Physical file verified in IObjectStorage adapter -> Size:', storedFile.size);

    // Verify proposed batch
    const batches = await repo.getProposedBatches(CAND_1);
    const pdfBatch = batches.find((b) => b.id === pdfResult.batch!.id);
    if (!pdfBatch || pdfBatch.items.length === 0) {
      throw new Error('Proposed batch not found or empty');
    }
    console.log('PASS 05: Proposed batch items generated -> Count:', pdfBatch.items.length);

    // Verify human approval
    const firstSkill = pdfBatch.items.find((i) => i.category === 'skill');
    if (!firstSkill) throw new Error('No skill claim in proposed batch');
    await knowledgeBankService.resolveProposedItem(CAND_1, pdfBatch.id, firstSkill.tempId, 'accept');
    const kb = await repo.getKnowledgeBank(CAND_1);
    const hasApproved = kb.skills.some((s) => (s.content as { name: string }).name.toLowerCase() === (firstSkill.content as { name: string }).name.toLowerCase());
    console.log('PASS 06: Candidate approved proposed item, verified in Knowledge Bank:', hasApproved);
    if (!hasApproved) throw new Error('Approved item failed to enter KB');

    // 3. Real DOCX upload via Server Action
    console.log('\n--- 3. REAL DOCX UPLOAD VIA SERVER ACTION ---');
    const zip = new JSZip();
    const docxXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Sarah Connor - Advanced Operations</w:t></w:r></w:p>
    <w:p><w:r><w:t>Director of Tactical Infrastructure at Resistance HQ</w:t></w:r></w:p>
    <w:p><w:r><w:t>2023 - Present</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Deployed hardened mesh networks and radio communications.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Skills: Networking, Mesh Protocols, Cryptography, Hardware Security</w:t></w:r></w:p>
    <w:p><w:r><w:t>Education: BS in Computer Engineering at Stanford</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    zip.file('word/document.xml', docxXml);
    const docxBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const docxBlob = new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const docxFile = new File([docxBlob], 'sarah_connor_operations.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    const docxFormData = new FormData();
    docxFormData.append('file', docxFile);

    const docxResult = await uploadAndIngestResumeAction(docxFormData);
    if (!docxResult.batch) {
      throw new Error(`DOCX upload action failed`);
    }
    console.log('PASS 07: Real DOCX Server Action succeeded -> Batch ID:', docxResult.batch.id, '| Document ID:', docxResult.document?.id);

    // 4. File picker cancel / empty FormData
    console.log('\n--- 4. EDGE CASE: CANCEL / EMPTY FORMDATA ---');
    let emptyCaught = false;
    try {
      const emptyFormData = new FormData();
      await uploadAndIngestResumeAction(emptyFormData);
    } catch (err: unknown) {
      emptyCaught = (err as Error).message.includes('valid resume document');
    }
    console.log('PASS 08: Empty FormData cleanly rejected:', emptyCaught);
    if (!emptyCaught) {
      throw new Error('Empty form data was not rejected with proper error message');
    }

    // 5. Duplicate upload check
    console.log('\n--- 5. DUPLICATE RESUME UPLOAD CHECK ---');
    let dupCaught = false;
    try {
      const dupFormData = new FormData();
      dupFormData.append('file', pdfFile); // exact same content
      await uploadAndIngestResumeAction(dupFormData);
    } catch (err: unknown) {
      dupCaught = (err as Error).message.includes('Duplicate resume content');
    }
    console.log('PASS 09: Duplicate resume rejected:', dupCaught);
    if (!dupCaught) {
      throw new Error('Duplicate resume was not blocked');
    }

    // 6. Oversized file (>10MB)
    console.log('\n--- 6. OVERSIZED FILE CHECK (>10MB) ---');
    let hugeCaught = false;
    try {
      const hugeBuf = Buffer.alloc(10 * 1024 * 1024 + 500);
      hugeBuf.write('%PDF-1.4');
      const hugeBlob = new Blob([hugeBuf], { type: 'application/pdf' });
      const hugeFile = new File([hugeBlob], 'huge.pdf', { type: 'application/pdf' });
      const hugeFormData = new FormData();
      hugeFormData.append('file', hugeFile);
      await uploadAndIngestResumeAction(hugeFormData);
    } catch (err: unknown) {
      hugeCaught = (err as Error).message.includes('maximum allowed limit of 10MB');
    }
    console.log('PASS 10: Oversized file rejected:', hugeCaught);
    if (!hugeCaught) {
      throw new Error('Oversized file was not blocked');
    }

    // 7. Unsupported file extension (.exe)
    console.log('\n--- 7. UNSUPPORTED EXTENSION CHECK ---');
    let exeCaught = false;
    try {
      const exeBuf = Buffer.from('MZ\x90\x00\x03');
      const exeBlob = new Blob([exeBuf], { type: 'application/x-msdownload' });
      const exeFile = new File([exeBlob], 'virus.exe', { type: 'application/x-msdownload' });
      const exeFormData = new FormData();
      exeFormData.append('file', exeFile);
      await uploadAndIngestResumeAction(exeFormData);
    } catch (err: unknown) {
      exeCaught = (err as Error).message.includes('Unsupported file extension');
    }
    console.log('PASS 11: Unsupported extension rejected:', exeCaught);
    if (!exeCaught) {
      throw new Error('Unsupported extension was not blocked');
    }

    // 8. Disguised executable (.pdf with MZ header)
    console.log('\n--- 8. DISGUISED EXECUTABLE / MAGIC-BYTE CHECK ---');
    let fakeCaught = false;
    try {
      const fakeBuf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff');
      const fakeBlob = new Blob([fakeBuf], { type: 'application/pdf' });
      const fakeFile = new File([fakeBlob], 'trojan.pdf', { type: 'application/pdf' });
      const fakeFormData = new FormData();
      fakeFormData.append('file', fakeFile);
      await uploadAndIngestResumeAction(fakeFormData);
    } catch (err: unknown) {
      fakeCaught = (err as Error).message.includes('signature');
    }
    console.log('PASS 12: Disguised file rejected by magic bytes:', fakeCaught);
    if (!fakeCaught) {
      throw new Error('Disguised file was not blocked');
    }

    // 9. Multi-tenant Candidate Isolation
    console.log('\n--- 9. MULTI-TENANT ISOLATION ---');
    // Switch to Candidate 2
    setTestCandidateId(CAND_2);

    // Cand 2 cannot see Cand 1 documents
    const cand2Docs = await repo.getCandidateDocuments(CAND_2);
    const cand2Batches = await repo.getProposedBatches(CAND_2);
    console.log('PASS 13: Candidate 2 sees 0 documents:', cand2Docs.length === 0);
    console.log('PASS 14: Candidate 2 sees 0 batches:', cand2Batches.length === 0);
    if (cand2Docs.length !== 0 || cand2Batches.length !== 0) {
      throw new Error('Candidate 2 leaked Candidate 1 documents or batches');
    }

    // Candidate 2 attempting to access Candidate 1's document by ID gets null
    const crossDoc = await repo.getCandidateDocumentById(pdfResult.document!.id, CAND_2);
    console.log('PASS 15: Cross-tenant document access by ID returns null:', crossDoc === null);
    if (crossDoc !== null) {
      throw new Error('Cross-tenant document access succeeded');
    }

    console.log('\n========================================================');
    console.log('  ALL 15 SERVER ACTION END-TO-END CHECKS PASSED!');
    console.log('========================================================\n');

  } finally {
    setTestCandidateId(null);
    await prisma.knowledgeItem.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
    await prisma.resumeIngestionBatch.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
    await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: [CAND_1, CAND_2] } } });
    await prisma.candidate.deleteMany({ where: { id: { in: [CAND_1, CAND_2] } } });
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
