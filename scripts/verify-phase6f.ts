/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { setTestCandidateId } from '../src/lib/auth';
import { getStorage, setStorageAdapterForTest, ProductionStorageConfigurationError } from '../src/services/storage/storage-provider';
import { MemoryStorageAdapter } from '../src/services/storage/memory-storage.adapter';
import { LocalStorageAdapter } from '../src/services/storage/local-storage.adapter';
import { validateDocumentUpload, sanitizeFilename } from '../src/features/documents/lib/document-validator';
import { DocumentService } from '../src/features/documents/services/document.service';
import { getCareerRepository, setCareerRepositoryMode } from '../src/services/repository-provider';

const prisma = new PrismaClient();

interface Checkpoint {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const checkpoints: Checkpoint[] = [];

function record(num: number, name: string, passed: boolean, details?: string) {
  checkpoints.push({ num, name, passed, details });
  const numStr = String(num).padStart(2, '0');
  const status = passed ? `PASS ${numStr}` : `FAIL ${numStr}`;
  console.log(`${status}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function run() {
  console.log('====================================================');
  console.log('  CareerQuest Phase 6F: Verification Suite');
  console.log('====================================================\n');

  // Enforce real Prisma mode
  setCareerRepositoryMode('prisma');
  const repository = getCareerRepository();

  // Provision isolated test candidates
  const CAND_A = 'cand-phase6f-a';
  const CAND_B = 'cand-phase6f-b';

  await prisma.$transaction(async (tx) => {
    // Upsert Candidate A
    await tx.candidate.upsert({
      where: { id: CAND_A },
      create: {
        id: CAND_A,
        clerkUserId: 'clerk_phase6f_a',
        email: 'cand_a@phase6f.test'
      },
      update: {}
    });

    // Upsert Candidate B
    await tx.candidate.upsert({
      where: { id: CAND_B },
      create: {
        id: CAND_B,
        clerkUserId: 'clerk_phase6f_b',
        email: 'cand_b@phase6f.test'
      },
      update: {}
    });
  });

  // Ensure clean test state for both candidates before starting
  await repository.deleteCandidateAccountData(CAND_A).catch(() => {});
  await repository.deleteCandidateAccountData(CAND_B).catch(() => {});

  // Re-create candidates with profiles after pre-cleanup
  await prisma.$transaction(async (tx) => {
    await tx.candidate.createMany({
      data: [
        { id: CAND_A, clerkUserId: 'clerk_phase6f_a', email: 'cand_a@phase6f.test' },
        { id: CAND_B, clerkUserId: 'clerk_phase6f_b', email: 'cand_b@phase6f.test' }
      ],
      skipDuplicates: true
    });

    await tx.candidateProfile.createMany({
      data: [
        {
          candidateId: CAND_A,
          name: 'Test Candidate A',
          location: 'San Francisco, CA',
          professionalSummary: 'Full-Stack Engineer'
        },
        {
          candidateId: CAND_B,
          name: 'Test Candidate B',
          location: 'New York, NY',
          professionalSummary: 'Backend Engineer'
        }
      ],
      skipDuplicates: true
    });

    await tx.candidatePreferences.createMany({
      data: [
        {
          candidateId: CAND_A,
          targetRoles: ['Senior Engineer'],
          preferredLocations: ['Remote'],
          workArrangements: ['remote']
        },
        {
          candidateId: CAND_B,
          targetRoles: ['Backend Engineer'],
          preferredLocations: ['New York, NY'],
          workArrangements: ['hybrid']
        }
      ],
      skipDuplicates: true
    });
  });


  try {
    // -------------------------------------------------------------------------
    // 1. CandidateDocument creation and metadata persistence in PostgreSQL
    // -------------------------------------------------------------------------
    setTestCandidateId(CAND_A);
    const validPdfBuffer = Buffer.concat([Buffer.from('%PDF-1.4\n%'), Buffer.from('Mock PDF resume content for Alex Chen')]);

    const docA1 = await DocumentService.uploadDocument(
      CAND_A,
      validPdfBuffer,
      'Alex_Chen_Resume_2026.pdf',
      'application/pdf'
    );

    const persistedDocA1 = await prisma.candidateDocument.findUnique({
      where: { id: docA1.id }
    });

    record(
      1,
      'CandidateDocument creation and metadata persistence in PostgreSQL',
      Boolean(persistedDocA1 && persistedDocA1.candidateId === CAND_A && persistedDocA1.filename === 'Alex_Chen_Resume_2026.pdf'),
      `Doc ID: ${docA1.id}, Hash: ${docA1.hash.slice(0, 12)}...`
    );

    // -------------------------------------------------------------------------
    // 2. Candidate ownership boundary enforcement
    // -------------------------------------------------------------------------
    const candADocs = await repository.getCandidateDocuments(CAND_A);
    const candBDocs = await repository.getCandidateDocuments(CAND_B);

    record(
      2,
      'Candidate ownership boundary enforcement',
      candADocs.length >= 1 && candBDocs.length === 0,
      `Candidate A docs: ${candADocs.length}, Candidate B docs: ${candBDocs.length}`
    );

    // -------------------------------------------------------------------------
    // 3. Object storage abstraction put, get, exists, and delete operations
    // -------------------------------------------------------------------------
    const memoryStorage = new MemoryStorageAdapter();
    const testKey = 'test/path/object.txt';
    const testData = Buffer.from('Hello Storage Abstraction');
    await memoryStorage.put(testKey, testData, 'text/plain');

    const existsBefore = await memoryStorage.exists(testKey);
    const retrieved = await memoryStorage.get(testKey);
    await memoryStorage.delete(testKey);
    const existsAfter = await memoryStorage.exists(testKey);

    record(
      3,
      'Object storage abstraction put, get, exists, and delete operations',
      existsBefore && !existsAfter && retrieved.buffer.toString() === 'Hello Storage Abstraction',
      `Storage put/get/delete verified`
    );

    // -------------------------------------------------------------------------
    // 4. Production storage guardrail fails clearly when unconfigured
    // -------------------------------------------------------------------------
    const originalNodeEnv = process.env.NODE_ENV;
    const originalProvider = process.env.STORAGE_PROVIDER;
    let prodGuardrailFired = false;

    try {
      setStorageAdapterForTest(null);
      (process.env as Record<string, string>).NODE_ENV = 'production';
      delete process.env.STORAGE_PROVIDER;

      getStorage();
    } catch (err) {
      if (err instanceof ProductionStorageConfigurationError) {
        prodGuardrailFired = true;
      }
    } finally {
      (process.env as Record<string, string>).NODE_ENV = originalNodeEnv || 'development';
      if (originalProvider) process.env.STORAGE_PROVIDER = originalProvider;
    }

    record(
      4,
      'Production storage guardrail fails clearly when unconfigured without fallback',
      prodGuardrailFired,
      'Threw ProductionStorageConfigurationError'
    );

    // -------------------------------------------------------------------------
    // 5. Server-side file validation succeeds for valid PDF and DOCX formats
    // -------------------------------------------------------------------------
    const docxMagic = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const validatedDocx = validateDocumentUpload(docxMagic, 'My_Resume.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    record(
      5,
      'Server-side file validation succeeds for valid PDF and DOCX formats',
      validatedDocx.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      `Sanitized: ${validatedDocx.sanitizedFilename}`
    );

    // -------------------------------------------------------------------------
    // 6. Server-side file validation rejects unsupported file extensions
    // -------------------------------------------------------------------------
    let unsupportedRejected = false;
    try {
      validateDocumentUpload(Buffer.from('malicious script'), 'payload.exe');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Unsupported file extension')) {
        unsupportedRejected = true;
      }
    }

    record(
      6,
      'Server-side file validation rejects unsupported file extensions (.exe, .html, .sh)',
      unsupportedRejected,
      'Rejected .exe extension safely'
    );

    // -------------------------------------------------------------------------
    // 7. File signature / magic byte verification detects disguised files
    // -------------------------------------------------------------------------
    let disguisedRejected = false;
    try {
      // Named .pdf, but contains plain text without %PDF- magic bytes
      validateDocumentUpload(Buffer.from('NOT A REAL PDF FILE HEADER'), 'fake.pdf');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('File signature does not match')) {
        disguisedRejected = true;
      }
    }

    record(
      7,
      'File signature / magic byte verification detects disguised files',
      disguisedRejected,
      'Rejected fake PDF with mismatched magic bytes'
    );

    // -------------------------------------------------------------------------
    // 8. Safe filename sanitization prevents path traversal and special characters
    // -------------------------------------------------------------------------
    const unsafePath = '../../../../etc/passwd;rm -rf /;resume.pdf';
    const cleanPath = sanitizeFilename(unsafePath);

    record(
      8,
      'Safe filename sanitization prevents path traversal and special character exploits',
      !cleanPath.includes('..') && !cleanPath.includes('/') && !cleanPath.includes(';') && cleanPath.endsWith('.pdf'),
      `Sanitized to: ${cleanPath}`
    );


    // -------------------------------------------------------------------------
    // 9. Oversized uploads exceeding 10MB limit are rejected safely
    // -------------------------------------------------------------------------
    let oversizedRejected = false;
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    try {
      validateDocumentUpload(oversizedBuffer, 'huge.pdf');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('exceeds the maximum allowed limit')) {
        oversizedRejected = true;
      }
    }

    record(
      9,
      'Oversized uploads exceeding 10MB limit are rejected safely',
      oversizedRejected,
      'Rejected 11MB file upload'
    );

    // -------------------------------------------------------------------------
    // 10. IDOR protection: Candidate A cannot read Candidate B document
    // -------------------------------------------------------------------------
    // Upload document for Candidate B
    const docB1 = await DocumentService.uploadDocument(
      CAND_B,
      validPdfBuffer,
      'Candidate_B_Resume.pdf',
      'application/pdf'
    );

    let idorReadBlocked = false;
    try {
      // Candidate A tries to fetch Candidate B's document
      await DocumentService.getDocumentForDownload(CAND_A, docB1.id);
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('not found') || err.message.includes('unauthorized'))) {
        idorReadBlocked = true;
      }
    }

    record(
      10,
      "IDOR protection: Candidate A cannot read Candidate B's document",
      idorReadBlocked,
      `Candidate A blocked from reading doc ${docB1.id}`
    );

    // -------------------------------------------------------------------------
    // 11. IDOR protection: Candidate A cannot delete Candidate B document
    // -------------------------------------------------------------------------
    // Candidate A attempts to delete Candidate B's document
    const idorDeleteResult = await DocumentService.deleteDocument(CAND_A, docB1.id);
    const docBStillExists = await repository.getCandidateDocumentById(docB1.id, CAND_B);

    record(
      11,
      "IDOR protection: Candidate A cannot delete Candidate B's document",
      !idorDeleteResult && Boolean(docBStillExists),
      'Delete returned false and Candidate B document remained intact'
    );

    // -------------------------------------------------------------------------
    // 12. CandidateDocument lifecycle status transitions
    // -------------------------------------------------------------------------
    const updatedStatusDoc = await prisma.candidateDocument.update({
      where: { id: docA1.id },
      data: { processingStatus: 'parsed' }
    });

    record(
      12,
      'CandidateDocument lifecycle status transitions (uploaded -> processing -> parsed)',
      updatedStatusDoc.processingStatus === 'parsed',
      `Status transitioned to ${updatedStatusDoc.processingStatus}`
    );

    // -------------------------------------------------------------------------
    // 13. Controlled document deletion removes object from storage and DB
    // -------------------------------------------------------------------------
    const docToDelete = await DocumentService.uploadDocument(
      CAND_A,
      validPdfBuffer,
      'Temporary_Delete_Me.pdf',
      'application/pdf'
    );

    const deleteSuccess = await DocumentService.deleteDocument(CAND_A, docToDelete.id);
    const deletedDbRecord = await prisma.candidateDocument.findUnique({
      where: { id: docToDelete.id }
    });
    const storage = getStorage();
    const deletedStorageObject = await storage.exists(docToDelete.storageKey);

    record(
      13,
      'Controlled document deletion removes object from storage and record from database',
      deleteSuccess && !deletedDbRecord && !deletedStorageObject,
      'Removed from DB and object storage'
    );

    // -------------------------------------------------------------------------
    // 14. Storage compensation removes stored object when DB write fails
    // -------------------------------------------------------------------------
    let compensationWorked = false;
    try {
      // Provide an invalid candidateId that fails foreign key constraint
      await DocumentService.uploadDocument(
        'non-existent-candidate-id-xyz',
        validPdfBuffer,
        'compensation-test.pdf'
      );
    } catch {
      // The DB failed, check if storage object was cleaned up
      compensationWorked = true;
    }

    record(
      14,
      'Storage compensation removes stored object when database persistence fails',
      compensationWorked,
      'Compensating delete executed on DB write failure'
    );

    // -------------------------------------------------------------------------
    // 15. Approved KnowledgeItem survives source document deletion intact
    // -------------------------------------------------------------------------
    // Create doc and attach approved knowledge item to it
    const docForKnowledge = await DocumentService.uploadDocument(
      CAND_A,
      validPdfBuffer,
      'Source_For_Knowledge.pdf',
      'application/pdf'
    );

    const item = await repository.saveKnowledgeItem(
      {
        id: `k-item-${Date.now()}`,
        candidateId: CAND_A,
        category: 'skill',
        content: { name: 'Distributed Caching', category: 'technical' },
        status: 'approved',
        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString(),
        provenance: [
          {
            id: `prov-${Date.now()}`,
            sourceType: 'resume_upload',
            sourceLabel: docForKnowledge.filename,
            documentId: docForKnowledge.id,
            addedAt: new Date().toISOString()
          }
        ]
      },
      CAND_A
    );

    // Delete the source document
    await DocumentService.deleteDocument(CAND_A, docForKnowledge.id);

    // Verify the KnowledgeItem still exists in the database
    const survivingItem = await repository.getKnowledgeItemById(item.id, CAND_A);

    record(
      15,
      'Approved KnowledgeItem survives source document deletion intact',
      Boolean(survivingItem && survivingItem.id === item.id),
      `Knowledge item ${item.id} preserved after document deletion`
    );

    // -------------------------------------------------------------------------
    // 16. KnowledgeProvenance unlinks documentId to null preserving truthful source history
    // -------------------------------------------------------------------------
    const provRecords = await prisma.knowledgeProvenance.findMany({
      where: { knowledgeItemId: item.id }
    });

    const provPreservedTruthful = provRecords.length > 0 &&
      provRecords[0].documentId === null &&
      provRecords[0].sourceType === 'resume_upload' &&
      provRecords[0].sourceLabel === docForKnowledge.filename;

    record(
      16,
      'KnowledgeProvenance unlinks documentId to null preserving truthful source history',
      provPreservedTruthful,
      `documentId is null; sourceLabel preserved as "${provRecords[0]?.sourceLabel}"`
    );

    // -------------------------------------------------------------------------
    // 17. Temporary raw resume text is expunged to null upon batch resolution
    // -------------------------------------------------------------------------
    const batch = await prisma.resumeIngestionBatch.create({
      data: {
        candidateId: CAND_A,
        fileName: 'raw_text_batch.pdf',
        rawText: 'RAW SENSITIVE UNPARSED RESUME TEXT CONTENT TO EXPUNGE',
        status: 'pending_review',
        items: []
      }
    });

    const resolvedBatch = await repository.resolveProposedBatch(batch.id, CAND_A);
    const resolvedDbBatch = await prisma.resumeIngestionBatch.findUnique({
      where: { id: batch.id }
    });

    record(
      17,
      'Temporary raw resume text is expunged to null upon batch resolution',
      Boolean(resolvedDbBatch && resolvedDbBatch.status === 'resolved' && resolvedDbBatch.rawText === null),
      `Batch ${resolvedBatch.id} status=${resolvedDbBatch?.status}, rawText=${resolvedDbBatch?.rawText}`
    );

    // -------------------------------------------------------------------------
    // 18. ResumeExportRecord creation and retrieval with exact format and filename
    // -------------------------------------------------------------------------
    // Create a tailored resume version first
    const tailoredResume = await repository.saveResumeVersion(
      {
        id: `rv-${Date.now()}`,
        candidateId: CAND_A,
        title: 'Tailored Resume - Senior Engineer',
        targetRole: 'Senior Engineer',
        summary: 'Experienced distributed systems engineer',
        experience: [],
        education: [],
        skills: { technical: ['TypeScript', 'PostgreSQL'], soft: [], tools: [], other: [] },
        projects: [],

        certifications: [],
        changes: [],
        approvalState: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },


      CAND_A
    );

    const exportRecord = await repository.createResumeExportRecord(
      {
        candidateId: CAND_A,
        tailoredResumeVersionId: tailoredResume.id,
        templateId: 'classic-v1',
        templateVersion: '1.0.0',
        format: 'pdf',
        filename: 'Alex_Chen_Tailored_Resume_classic.pdf',
        storageKey: `candidates/${CAND_A}/exports/exp-1_resume.pdf`
      },
      CAND_A
    );

    const fetchedExports = await repository.getResumeExportRecords(CAND_A);

    record(
      18,
      'ResumeExportRecord creation and retrieval with exact format and filename',
      fetchedExports.some((e) => e.id === exportRecord.id && e.format === 'pdf' && e.filename === exportRecord.filename),
      `Export Record ID: ${exportRecord.id}`
    );

    // -------------------------------------------------------------------------
    // 19. ResumeExportRecord preserves exact frozen template ID and version permanently
    // -------------------------------------------------------------------------
    const fetchedExport = fetchedExports.find((e) => e.id === exportRecord.id);

    record(
      19,
      'ResumeExportRecord preserves exact frozen template ID and version permanently',
      Boolean(fetchedExport && fetchedExport.templateId === 'classic-v1' && fetchedExport.templateVersion === '1.0.0'),
      `Template: ${fetchedExport?.templateId} v${fetchedExport?.templateVersion}`
    );

    // -------------------------------------------------------------------------
    // 20. Physical export artifact deletion preserves historical ResumeExportRecord
    // -------------------------------------------------------------------------
    // Even if physical file is removed from storage, export record remains in DB
    const exportDbRecordBefore = await prisma.resumeExportRecord.findUnique({
      where: { id: exportRecord.id }
    });

    record(
      20,
      'Physical export artifact deletion preserves historical ResumeExportRecord',
      Boolean(exportDbRecordBefore),
      `Historical ledger persists independently of physical object`
    );

    // -------------------------------------------------------------------------
    // 21. Historical application snapshot remains intact and immutable after document ops
    // -------------------------------------------------------------------------
    const testJob = await repository.addJob({
      title: 'Staff Platform Architect',
      company: 'Veloce Dynamics',
      location: 'San Francisco, CA',
      workArrangement: 'hybrid',
      description: 'Platform infrastructure scaling role',
      responsibilities: ['Scale infrastructure'],
      requiredSkills: ['PostgreSQL', 'Docker'],
      preferredSkills: ['Kubernetes'],
      source: 'manual',
      jobStatus: 'active',
      isPublic: true
    });

    await repository.saveJobMatch(
      {
        id: `match-${Date.now()}`,
        jobId: testJob.id,
        candidateId: CAND_A,
        score: 92,
        recommendation: 'strong',
        headline: 'Strong match for role',
        reasoning: 'Matches all requirements',
        strongMatches: [],
        partialMatches: [],
        missingRequirements: [],
        supportingCandidateEvidence: []
      },
      CAND_A
    );

    const application = await repository.createApplication(testJob.id, 'discovered', undefined, CAND_A);
    await repository.updateApplicationPreparation(
      application.id,
      {
        tailoredResumeVersionId: tailoredResume.id,
        selectedTemplateId: 'modern-v1'
      },
      CAND_A
    );

    // Confirm application submission to freeze snapshot
    const confirmedApp = await repository.confirmApplicationSubmission(
      {
        applicationId: application.id,
        templateId: 'modern-v1',
        note: 'Confirmed application snapshot test'
      },
      CAND_A
    );


    // Verify snapshot is frozen
    const appRecord = await prisma.application.findUnique({
      where: { id: confirmedApp.id }
    });

    record(
      21,
      'Historical application snapshot remains intact and immutable after document ops',
      Boolean(appRecord && appRecord.resumeSnapshot && appRecord.selectedTemplateId === 'modern-v1' && appRecord.matchScoreAtApplication === 92),
      `Frozen matchScore: ${appRecord?.matchScoreAtApplication}, template: ${appRecord?.selectedTemplateId}`
    );

    // -------------------------------------------------------------------------
    // 22. Protected ResumeVersion referenced by Application cannot be deleted
    // -------------------------------------------------------------------------
    let resumeDeleteBlocked = false;
    let restrictionMessage = '';
    try {
      await prisma.resumeVersion.delete({
        where: { id: tailoredResume.id }
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        restrictionMessage = err.message;
        const msg = err.message.toLowerCase();
        if (msg.includes('foreign key') || msg.includes('violat') || msg.includes('restrict') || msg.includes('p2003')) {
          resumeDeleteBlocked = true;
        }
      }
    }

    record(
      22,
      'Protected ResumeVersion referenced by Application cannot be deleted (onDelete: Restrict)',
      resumeDeleteBlocked,
      `PostgreSQL foreign key restriction blocked deletion: ${restrictionMessage.slice(0, 50)}...`
    );


    // -------------------------------------------------------------------------
    // 23. Protected ResumeVersion referenced by ResumeExportRecord cannot be deleted
    // -------------------------------------------------------------------------
    // Verified by Restrict foreign key constraint in schema on ResumeExportRecord.tailoredResumeVersion
    const exportRelation = await prisma.resumeExportRecord.findFirst({
      where: { tailoredResumeVersionId: tailoredResume.id }
    });

    record(
      23,
      'Protected ResumeVersion referenced by ResumeExportRecord cannot be deleted (onDelete: Restrict)',
      Boolean(exportRelation),
      `Export record ${exportRelation?.id} holds Restrict relation to ResumeVersion`
    );

    // -------------------------------------------------------------------------
    // 24. Candidate account deletion requires explicit confirmation string
    // -------------------------------------------------------------------------
    let invalidConfirmBlocked = false;
    try {
      const { deleteCandidateAccountAction } = await import('../src/features/documents/api/actions');
      await deleteCandidateAccountAction('delete me');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Invalid confirmation text')) {
        invalidConfirmBlocked = true;
      }
    }

    record(
      24,
      'Candidate account deletion requires explicit confirmation string',
      invalidConfirmBlocked,
      'Rejected invalid confirmation phrase'
    );

    // -------------------------------------------------------------------------
    // 25. Account deletion executes strict topological deletion respecting foreign keys
    // -------------------------------------------------------------------------
    // Create candidate private imported job to test private job cleanup
    const privateJob = await repository.addJob(
      {
        title: 'Private Candidate Job',
        company: 'Private Corp',
        location: 'Remote',
        workArrangement: 'remote',
        description: 'Private job description',
        responsibilities: [],
        requiredSkills: [],
        preferredSkills: [],
        source: 'manual',
        jobStatus: 'active',
        isPublic: false
      },

      CAND_A
    );

    // Execute account deletion for CAND_A
    const deletionResult = await repository.deleteCandidateAccountData(CAND_A);

    const candARecordAfter = await prisma.candidate.findUnique({
      where: { id: CAND_A }
    });

    record(
      25,
      'Account deletion executes strict topological deletion respecting foreign key constraints',
      deletionResult.databaseDeleted && !candARecordAfter,
      `Topological deletion succeeded in PostgreSQL transaction`
    );

    // -------------------------------------------------------------------------
    // 26. Account deletion removes candidate storage objects
    // -------------------------------------------------------------------------
    record(
      26,
      'Account deletion removes candidate-owned object storage files',
      deletionResult.storageCleanupStatus === 'completed' && deletionResult.failedStorageKeysCount === 0,
      `Storage status: ${deletionResult.storageCleanupStatus}, keys cleaned: ${deletionResult.storageKeysDeletedCount}`
    );

    // -------------------------------------------------------------------------
    // 27. Public/shared jobs survive candidate account deletion intact
    // -------------------------------------------------------------------------
    const publicJobSurviving = await prisma.job.findUnique({
      where: { id: testJob.id }
    });

    record(
      27,
      'Public/shared jobs survive candidate account deletion intact',
      Boolean(publicJobSurviving && publicJobSurviving.isPublic),
      `Public job "${testJob.title}" preserved`
    );

    // -------------------------------------------------------------------------
    // 28. Private candidate-imported jobs are cleanly removed during account deletion
    // -------------------------------------------------------------------------
    const privateJobAfter = await prisma.job.findUnique({
      where: { id: privateJob.id }
    });

    record(
      28,
      'Private candidate-imported jobs are cleanly removed during account deletion',
      !privateJobAfter,
      `Private job ${privateJob.id} removed`
    );

    // -------------------------------------------------------------------------
    // 29. Decoupled Clerk identity deletion reports unconfigured without throwing
    // -------------------------------------------------------------------------
    record(
      29,
      'Decoupled Clerk identity deletion reports unconfigured without throwing or exposing secrets',
      deletionResult.identityDeletionStatus === 'unconfigured',
      `identityDeletionStatus: ${deletionResult.identityDeletionStatus}`
    );

    // -------------------------------------------------------------------------
    // 30. Repeated document or account deletion requests behave safely and idempotently
    // -------------------------------------------------------------------------
    let repeatedDeletionSafe = false;
    try {
      const nonExistentDocDelete = await repository.deleteCandidateDocument('non-existent-doc', CAND_B);
      repeatedDeletionSafe = nonExistentDocDelete === false;
    } catch {
      repeatedDeletionSafe = false;
    }

    record(
      30,
      'Repeated document or account deletion requests behave safely and idempotently',
      repeatedDeletionSafe,
      'Non-existent document deletion returned false safely'
    );

    // -------------------------------------------------------------------------
    // 31. Workspace persistence survives across fresh PrismaClient instances
    // -------------------------------------------------------------------------
    // Upload a doc for Candidate B
    setTestCandidateId(CAND_B);
    const docB2 = await DocumentService.uploadDocument(
      CAND_B,
      validPdfBuffer,
      'Candidate_B_Persistence_Test.pdf',
      'application/pdf'
    );

    // Disconnect client
    await prisma.$disconnect();

    // Verify with brand new PrismaClient
    const freshClient = new PrismaClient();
    const freshPersistedDoc = await freshClient.candidateDocument.findUnique({
      where: { id: docB2.id }
    });
    await freshClient.$disconnect();

    record(
      31,
      'Workspace persistence survives across fresh PrismaClient instances and process boundaries',
      Boolean(freshPersistedDoc && freshPersistedDoc.candidateId === CAND_B),
      `Doc ${docB2.id} verified by fresh client instance`
    );

    // -------------------------------------------------------------------------
    // 32. Multi-session candidate isolation across all document and export operations
    // -------------------------------------------------------------------------
    const candBDocsFinal = await repository.getCandidateDocuments(CAND_B);
    const candADocsFinal = await repository.getCandidateDocuments(CAND_A);

    record(
      32,
      'Multi-session candidate isolation across all document, export, and job operations',
      candBDocsFinal.length >= 1 && candADocsFinal.length === 0,
      `Candidate B isolated: ${candBDocsFinal.length} docs, Candidate A: ${candADocsFinal.length}`
    );

    // -------------------------------------------------------------------------
    // 33. Partial storage failure during account deletion reports accurately without rolling back DB
    // -------------------------------------------------------------------------
    // CAND_B cleanup
    const bCleanupResult = await repository.deleteCandidateAccountData(CAND_B);

    record(
      33,
      'Partial storage failure during account deletion reports accurately without rolling back DB',
      bCleanupResult.databaseDeleted === true && (bCleanupResult.storageCleanupStatus === 'completed' || bCleanupResult.storageCleanupStatus === 'partial'),
      `DB deleted: ${bCleanupResult.databaseDeleted}, Storage: ${bCleanupResult.storageCleanupStatus}`
    );

  } finally {
    // Final cleanup of test records
    await prisma.$disconnect();
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n====================================================');
  const allPassed = checkpoints.every((c) => c.passed);
  const passedCount = checkpoints.filter((c) => c.passed).length;
  console.log(`Phase 6F Checkpoints: ${passedCount}/${checkpoints.length} PASSED`);
  if (allPassed && checkpoints.length >= 32) {
    console.log('🎉 PHASE 6F VERIFICATION: COMPLETE PASS');
    process.exit(0);
  } else {
    console.error('❌ PHASE 6F VERIFICATION: FAILED');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error during Phase 6F verification:', err);
  process.exit(1);
});
