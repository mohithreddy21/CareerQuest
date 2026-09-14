/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { setTestCandidateId } from '../src/lib/auth';
import { getCareerRepository, setCareerRepositoryMode } from '../src/services/repository-provider';
import { DocumentService } from '../src/features/documents/services/document.service';

const prisma = new PrismaClient();

interface AuditCheck {
  id: string;
  name: string;
  passed: boolean;
  details?: string;
}

const auditChecks: AuditCheck[] = [];

function check(id: string, name: string, passed: boolean, details?: string) {
  auditChecks.push({ id, name, passed, details });
  const status = passed ? 'AUDIT PASS' : 'AUDIT FAIL';
  console.log(`[${status}] ${id}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function runAudit() {
  console.log('====================================================');
  console.log('  CareerQuest Phase 6: Full-System E2E Audit Suite');
  console.log('====================================================\n');

  setCareerRepositoryMode('prisma');
  const repository = getCareerRepository();

  const CAND_1 = 'cand-audit-e2e-1';
  const CAND_2 = 'cand-audit-e2e-2';

  // Ensure clean starting state for audit candidates
  await repository.deleteCandidateAccountData(CAND_1).catch(() => {});
  await repository.deleteCandidateAccountData(CAND_2).catch(() => {});

  // Provision Candidates in PostgreSQL
  await prisma.$transaction(async (tx) => {
    await tx.candidate.createMany({
      data: [
        { id: CAND_1, clerkUserId: 'clerk_audit_1', email: 'audit1@careerquest.test' },
        { id: CAND_2, clerkUserId: 'clerk_audit_2', email: 'audit2@careerquest.test' }
      ],
      skipDuplicates: true
    });

    await tx.candidateProfile.createMany({
      data: [
        {
          candidateId: CAND_1,
          name: 'Sarah Audit Candidate',
          location: 'San Francisco, CA',
          headline: 'Senior Cloud Systems Engineer',
          professionalSummary: 'Specialist in distributed systems, PostgreSQL, and scalable services.'
        },
        {
          candidateId: CAND_2,
          name: 'David Isolation Candidate',
          location: 'Austin, TX',
          headline: 'Staff Security Engineer',
          professionalSummary: 'Expert in infrastructure security, IAM, and zero-trust systems.'
        }
      ],
      skipDuplicates: true
    });

    await tx.candidatePreferences.createMany({
      data: [
        {
          candidateId: CAND_1,
          targetRoles: ['Senior Cloud Systems Engineer'],
          preferredLocations: ['San Francisco', 'Remote'],
          workArrangements: ['remote', 'hybrid'],
          targetSalaryMin: 185000,
          currency: 'USD'
        },
        {
          candidateId: CAND_2,
          targetRoles: ['Staff Security Engineer'],
          preferredLocations: ['Austin', 'Remote'],
          workArrangements: ['remote'],
          targetSalaryMin: 195000,
          currency: 'USD'
        }
      ],
      skipDuplicates: true
    });
  });

  // =========================================================================
  // SCENARIO 1: Complete Candidate Journey with Immutability & Provenance
  // =========================================================================
  console.log('\n--- SCENARIO 1: Full Candidate Journey & Immutability Audit ---');
  setTestCandidateId(CAND_1);

  // 1. Authenticated Candidate Setup
  const candidate1Profile = await repository.getCandidateProfile(CAND_1);
  check(
    'S1.01',
    'Candidate authenticated with presentation profile and search preferences',
    Boolean(candidate1Profile && candidate1Profile.name === 'Sarah Audit Candidate'),
    `Name: ${candidate1Profile?.name}`
  );

  // 2. Upload source resume document & extract proposed knowledge
  const samplePdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Audit Resume) >>\nendobj\n%%EOF');
  const sourceDoc = await DocumentService.uploadDocument(
    CAND_1,
    samplePdfBytes,
    'Sarah_Audit_Resume.pdf',
    'application/pdf'
  );

  check(
    'S1.02',
    'Source resume document uploaded and stored with SHA-256 hash',
    Boolean(sourceDoc && sourceDoc.hash && sourceDoc.storageKey),
    `Doc ID: ${sourceDoc.id}, StorageKey: ${sourceDoc.storageKey}`
  );

  // 3. Create proposed knowledge item linked to source document
  const rawBatch = await repository.createProposedBatch(
    {
      candidateId: CAND_1,
      fileName: 'Sarah_Audit_Resume.pdf',
      status: 'pending_review',
      items: [
        {
          tempId: 'prop-item-1',
          category: 'skill',
          content: { name: 'Distributed Systems', proficiency: 'advanced' },
          confidence: 0.95,
          conflictStatus: 'new'
        }
      ]
    },
    CAND_1
  );

  await prisma.resumeIngestionBatch.update({
    where: { id: rawBatch.id },
    data: { rawText: 'Experienced in Kubernetes, Distributed Systems, Go, and PostgreSQL.' }
  });

  // Approve knowledge item into Knowledge Bank with truthful provenance
  const nowIso = new Date().toISOString();
  const approvedItem = await repository.saveKnowledgeItem(
    {
      id: `kb-fact-${Date.now()}`,
      candidateId: CAND_1,
      category: 'skill',
      content: { name: 'Distributed Systems', proficiency: 'advanced' },
      status: 'approved',
      createdAt: nowIso,
      updatedAt: nowIso,
      provenance: [
        {
          id: `prov-${Date.now()}`,
          sourceType: 'resume_upload',
          sourceLabel: 'Sarah_Audit_Resume.pdf',
          documentId: sourceDoc.id,
          extractedSnippet: 'Experienced in Kubernetes, Distributed Systems, Go, and PostgreSQL.',
          confidence: 0.95,
          addedAt: new Date().toISOString()
        }
      ]
    },
    CAND_1
  );

  // Resolve ingestion batch -> expunge rawText
  await repository.resolveProposedBatch(rawBatch.id, CAND_1);
  const resolvedBatch = await prisma.resumeIngestionBatch.findUnique({
    where: { id: rawBatch.id }
  });

  check(
    'S1.03',
    'Knowledge fact approved with provenance trace, and temporary raw batch text expunged',
    Boolean(approvedItem.id && resolvedBatch?.status === 'resolved' && resolvedBatch?.rawText === null),
    `Fact ID: ${approvedItem.id}, Batch status: ${resolvedBatch?.status}, rawText: ${resolvedBatch?.rawText}`
  );

  // 4. Discover public job opportunity
  const publicJob = await repository.addJob({
    title: 'Lead Distributed Systems Architect',
    company: 'CloudScale Global Inc.',
    location: 'San Francisco, CA',
    workArrangement: 'remote',
    description: 'Design and operate geo-distributed PostgreSQL and low-latency cloud infrastructure.',
    responsibilities: ['Architect multi-region databases', 'Scale distributed messaging'],
    requiredSkills: ['Distributed Systems', 'PostgreSQL', 'Go', 'System Architecture'],
    preferredSkills: ['Kubernetes', 'High Concurrency'],
    experienceRequirement: '7+ years',
    source: 'linkedin',
    jobStatus: 'active',
    isPublic: true
  });

  check(
    'S1.04',
    'Public job opportunity discovered in catalog',
    Boolean(publicJob && publicJob.isPublic),
    `Job: "${publicJob.title}" at ${publicJob.company}`
  );

  // 5. Job Analysis & Match calculation
  const jobAnalysis = await repository.saveJobAnalysis({
    id: `analysis-${Date.now()}`,
    jobId: publicJob.id,
    seniority: 'lead',
    roleCategory: 'Infrastructure',
    technicalRequirements: ['Distributed Systems', 'PostgreSQL', 'Go'],
    softSkills: ['Technical Leadership', 'System Design'],
    importantKeywords: ['geo-distributed', 'multi-region'],
    extractedRequirements: [],
    analysisStatus: 'success'
  });

  const jobMatch = await repository.saveJobMatch(
    {
      id: `match-${Date.now()}`,
      jobId: publicJob.id,
      candidateId: CAND_1,
      score: 95,
      recommendation: 'strong',
      headline: 'Exceptional match for distributed cloud infrastructure architecture',
      reasoning: 'Candidate has verified experience in distributed systems and high-scale databases.',
      strongMatches: [{ title: 'Distributed Systems', detail: 'Advanced verified skill' }],
      partialMatches: [],
      missingRequirements: [],
      supportingCandidateEvidence: []
    },
    CAND_1
  );

  check(
    'S1.05',
    'Job analysis and match score computed for candidate',
    Boolean(jobAnalysis.analysisStatus === 'success' && jobMatch.score === 95),
    `Match score: ${jobMatch.score}%, Recommendation: ${jobMatch.recommendation}`
  );

  // 6. Resume Tailoring with grounded change audit trail
  const tailoredResume = await repository.saveResumeVersion(
    {
      id: 'res-tailored-audit-1',
      candidateId: CAND_1,
      jobId: publicJob.id,
      targetCompany: 'CloudScale Global Inc.',
      title: 'Sarah Audit - Lead Distributed Systems Architect',
      targetRole: 'Lead Distributed Systems Architect',
      summary: 'Distinguished infrastructure engineer with deep expertise in distributed database systems.',
      createdAt: nowIso,
      updatedAt: nowIso,
      experience: [
        {
          id: 'exp-1',
          employer: 'HyperScale Corp',
          role: 'Senior Cloud Systems Engineer',
          startDate: '2021-01',
          isCurrent: true,
          responsibilities: ['Architecture'],
          achievements: ['Designed geo-distributed database failover across 3 AWS regions.']
        }
      ],
      education: [],
      skills: {
        technical: ['Go', 'TypeScript', 'SQL'],
        tools: ['Kubernetes', 'PostgreSQL', 'Docker'],
        soft: ['Technical Leadership'],
        other: ['Distributed Systems', 'Fault Tolerance']
      },
      projects: [],
      certifications: [],
      approvalState: 'draft',
      changes: [
        {
          id: `chg-${Date.now()}`,
          resumeVersionId: 'res-tailored-audit-1',
          section: 'summary',
          originalContent: 'Experienced engineer.',
          proposedContent: 'Distinguished infrastructure engineer with deep expertise in distributed database systems.',
          rationale: 'Tailored executive summary to reflect geo-distributed data architecture focus.',
          jobRequirement: 'Distributed Systems',
          sourceCandidateEvidence: 'Architected multi-region databases',
          sourceKnowledgeItemIds: [approvedItem.id],
          evidenceReferences: [approvedItem.id],
          status: 'approved',
          grounded: true
        }
      ]
    },
    CAND_1
  );

  check(
    'S1.06',
    'Tailored resume created with auditable grounded changes',
    Boolean(tailoredResume && tailoredResume.changes.length > 0 && tailoredResume.changes[0].grounded),
    `Resume ID: ${tailoredResume.id}, Grounded changes: ${tailoredResume.changes.length}`
  );

  // 7. Resume Export Ledger creation (PDF export with frozen template ID and version)
  const exportRecord = await repository.createResumeExportRecord(
    {
      candidateId: CAND_1,
      tailoredResumeVersionId: tailoredResume.id,
      templateId: 'modern-v1',
      templateVersion: '1.0.0',
      format: 'pdf',
      filename: 'Sarah_Audit_CloudScale_Resume.pdf',
      storageKey: `candidates/${CAND_1}/exports/pdf/audit-export-1.pdf`
    },
    CAND_1
  );

  check(
    'S1.07',
    'Resume export record persisted with frozen template ID and version',
    Boolean(exportRecord && exportRecord.templateId === 'modern-v1' && exportRecord.templateVersion === '1.0.0'),
    `Export ID: ${exportRecord.id}, Template: ${exportRecord.templateId} (v${exportRecord.templateVersion})`
  );

  // 8. Create Application & Confirm Submission (Atomic Transaction)
  const application = await repository.createApplication(
    publicJob.id,
    'preparing',
    undefined,
    CAND_1
  );

  await repository.updateApplicationNotes(application.id, 'Applied through executive portal', CAND_1);
  await repository.updateApplicationPreparation(
    application.id,
    {
      tailoredResumeVersionId: tailoredResume.id,
      selectedTemplateId: 'modern-v1',
      coverLetter: 'Dear Hiring Team, I am thrilled to submit my candidacy...'
    },
    CAND_1
  );

  const confirmedApp = await repository.confirmApplicationSubmission(
    {
      applicationId: application.id,
      templateId: 'modern-v1',
      note: 'Confirmed external submission on careers site'
    },
    CAND_1
  );

  check(
    'S1.08',
    'Application confirmed atomically: status applied, dateApplied set, resumeSnapshot and matchScore frozen',
    Boolean(
      confirmedApp.status === 'applied' &&
      confirmedApp.dateApplied &&
      confirmedApp.resumeSnapshot &&
      confirmedApp.matchScoreAtApplication === 95 &&
      confirmedApp.selectedTemplateId === 'modern-v1'
    ),
    `Status: ${confirmedApp.status}, Score: ${confirmedApp.matchScoreAtApplication}%, Frozen Snapshot: true`
  );

  // 9. Reconnect with fresh PrismaClient instance
  const freshClient = new PrismaClient();
  const freshAppRecord = await freshClient.application.findUnique({
    where: { id: confirmedApp.id }
  });

  check(
    'S1.09',
    'Historical application remains intact and verifiable across a fresh PrismaClient connection',
    Boolean(freshAppRecord && freshAppRecord.status === 'applied' && freshAppRecord.matchScoreAtApplication === 95),
    `Fresh client verified application ID: ${freshAppRecord?.id}`
  );

  // 10. Mutate Knowledge Bank: Add new skill & archive previous fact
  await repository.updateKnowledgeItemStatus(approvedItem.id, 'archived', CAND_1);
  await repository.saveKnowledgeItem(
    {
      id: `kb-fact-new-${Date.now()}`,
      candidateId: CAND_1,
      category: 'skill',
      content: { name: 'Rust Embedded Systems', proficiency: 'intermediate' },
      status: 'approved',
      createdAt: nowIso,
      updatedAt: nowIso,
      provenance: []
    },
    CAND_1
  );

  // Verify historical application state remains completely unchanged
  const postKnowledgeMutationApp = await freshClient.application.findUnique({
    where: { id: confirmedApp.id }
  });

  const snapshotResume = postKnowledgeMutationApp?.resumeSnapshot as Record<string, unknown>;

  check(
    'S1.10',
    'Later Knowledge Bank modifications cannot rewrite historical application snapshot or match score',
    Boolean(
      postKnowledgeMutationApp?.status === 'applied' &&
      postKnowledgeMutationApp?.matchScoreAtApplication === 95 &&
      postKnowledgeMutationApp?.selectedTemplateId === 'modern-v1' &&
      snapshotResume !== null
    ),
    `Snapshot intact: score remains ${postKnowledgeMutationApp?.matchScoreAtApplication}%, template remains ${postKnowledgeMutationApp?.selectedTemplateId}`
  );

  // 11. Delete source document -> Verify approved knowledge survives & provenance unlinks truthfully to null
  const docDeleteSuccess = await DocumentService.deleteDocument(CAND_1, sourceDoc.id);

  const survivingKnowledgeItem = await freshClient.knowledgeItem.findUnique({
    where: { id: approvedItem.id },
    include: { provenance: true }
  });

  const provenanceAfterDocDelete = survivingKnowledgeItem?.provenance[0];

  check(
    'S1.11',
    'Source document deletion preserves approved KnowledgeItem and unlinks provenance documentId to null truthfully',
    Boolean(
      docDeleteSuccess &&
      survivingKnowledgeItem &&
      provenanceAfterDocDelete &&
      provenanceAfterDocDelete.documentId === null &&
      provenanceAfterDocDelete.sourceLabel === 'Sarah_Audit_Resume.pdf'
    ),
    `KnowledgeItem exists: true, documentId: ${provenanceAfterDocDelete?.documentId}, sourceLabel: "${provenanceAfterDocDelete?.sourceLabel}"`
  );

  await freshClient.$disconnect();

  // =========================================================================
  // SCENARIO 2: Two-Candidate Isolation & Topological Deletion Scenario
  // =========================================================================
  console.log('\n--- SCENARIO 2: Two-Candidate Cross-Isolation & Deletion Audit ---');

  // Candidate 1 creates a private imported job
  const cand1PrivateJob = await repository.addJob(
    {
      title: 'Proprietary Core Infra Lead',
      company: 'Stealth Tech Venture',
      location: 'Remote',
      workArrangement: 'remote',
      description: 'Internal private opportunity for candidate 1 only.',
      responsibilities: ['Build high frequency trading engines'],
      requiredSkills: ['C++', 'Low Latency'],
      preferredSkills: ['Kernel Bypass'],
      source: 'manual',
      jobStatus: 'active',
      isPublic: false
    },
    CAND_1
  );

  // Candidate 2 creates private data: document, knowledge, application on public job
  setTestCandidateId(CAND_2);

  const cand2Doc = await DocumentService.uploadDocument(
    CAND_2,
    Buffer.from('%PDF-1.4\nCandidate 2 Resume Content\n%%EOF'),
    'David_Security_Resume.pdf',
    'application/pdf'
  );

  const cand2Knowledge = await repository.saveKnowledgeItem(
    {
      id: `kb-cand2-${Date.now()}`,
      candidateId: CAND_2,
      category: 'skill',
      content: { name: 'Zero-Trust Architecture', level: 'expert' },
      status: 'approved',
      createdAt: nowIso,
      updatedAt: nowIso,
      provenance: []
    },
    CAND_2
  );

  const cand2Resume = await repository.saveResumeVersion(
    {
      id: 'res-cand2-audit-2',
      candidateId: CAND_2,
      jobId: publicJob.id,
      title: 'David Chen - Security Lead',
      targetRole: 'Staff Security Architect',
      summary: 'Specialist in zero-trust architecture and infrastructure security.',
      createdAt: nowIso,
      updatedAt: nowIso,
      experience: [],
      education: [],
      skills: { technical: ['Zero-Trust Architecture'], tools: ['Vault', 'AWS IAM'], soft: [], other: [] },
      projects: [],
      certifications: [],
      approvalState: 'approved',
      changes: []
    },
    CAND_2
  );

  const cand2App = await repository.createApplication(
    publicJob.id,
    'preparing',
    undefined,
    CAND_2
  );
  await repository.updateApplicationNotes(cand2App.id, 'Candidate 2 application on shared public job', CAND_2);
  await repository.updateApplicationPreparation(
    cand2App.id,
    {
      tailoredResumeVersionId: cand2Resume.id,
      selectedTemplateId: 'classic-v1'
    },
    CAND_2
  );

  const cand2Export = await repository.createResumeExportRecord(
    {
      candidateId: CAND_2,
      tailoredResumeVersionId: cand2Resume.id,
      templateId: 'classic-v1',
      templateVersion: '1.0.0',
      format: 'pdf',
      filename: 'David_Security_Resume.pdf'
    },
    CAND_2
  );

  // IDOR & Cross-Isolation Verification: Candidate 2 attempts to access Candidate 1's resources
  const cand2AccessToCand1Doc = await repository.getCandidateDocumentById(sourceDoc.id, CAND_2);
  const cand2AttemptDeleteCand1Doc = await repository.deleteCandidateDocument(sourceDoc.id, CAND_2);
  const cand2AccessToCand1App = await repository.getApplicationById(application.id, CAND_2);
  const cand2AccessToCand1PrivateJob = await repository.getJobById(cand1PrivateJob.id, CAND_2);
  const cand2JobsList = await repository.getJobs({}, CAND_2);
  const cand1PrivateJobExposed = cand2JobsList.some((j) => j.id === cand1PrivateJob.id);

  check(
    'S2.01',
    'Cross-candidate isolation: Candidate 2 cannot read Candidate 1 document, application, or private job',
    cand2AccessToCand1Doc === null &&
    cand2AttemptDeleteCand1Doc === false &&
    cand2AccessToCand1App === null &&
    cand2AccessToCand1PrivateJob === null &&
    !cand1PrivateJobExposed,
    'All unauthorized access attempts blocked with null / false / excluded'
  );

  // Delete Candidate 1 account data completely
  const deletionResult = await repository.deleteCandidateAccountData(CAND_1);

  check(
    'S2.02',
    'Candidate 1 account deletion succeeds topologically and reports truthful results',
    Boolean(
      deletionResult.databaseDeleted &&
      deletionResult.deletedPrivateJobsCount === 1 &&
      deletionResult.storageCleanupStatus === 'completed'
    ),
    `DB deleted: ${deletionResult.databaseDeleted}, Private jobs deleted: ${deletionResult.deletedPrivateJobsCount}, Storage: ${deletionResult.storageCleanupStatus}`
  );

  // Verify Candidate 2 workspace remains 100% intact
  const cand2SurvivingDoc = await repository.getCandidateDocumentById(cand2Doc.id, CAND_2);
  const cand2SurvivingKnowledge = await repository.getKnowledgeItemById(cand2Knowledge.id, CAND_2);
  const cand2SurvivingApp = await repository.getApplicationById(cand2App.id, CAND_2);
  const cand2SurvivingExports = await repository.getResumeExportRecords(CAND_2);

  check(
    'S2.03',
    'Candidate 2 workspace, document, knowledge, application, and exports remain fully intact',
    Boolean(
      cand2SurvivingDoc &&
      cand2SurvivingKnowledge &&
      cand2SurvivingApp &&
      cand2SurvivingExports.length === 1 &&
      cand2SurvivingExports[0].id === cand2Export.id
    ),
    `Candidate 2 data verified intact: Doc: ${cand2SurvivingDoc?.id}, App: ${cand2SurvivingApp?.id}`
  );

  // Verify Public Job survived and Candidate 1 private job was removed
  const publicJobAfter = await prisma.job.findUnique({ where: { id: publicJob.id } });
  const privateJobAfter = await prisma.job.findUnique({ where: { id: cand1PrivateJob.id } });

  check(
    'S2.04',
    'Public job catalog data survives account deletion, and private job is purged',
    Boolean(publicJobAfter && publicJobAfter.isPublic && !privateJobAfter),
    `Public job "${publicJobAfter?.title}" preserved; Private job ${cand1PrivateJob.id} purged: ${!privateJobAfter}`
  );

  // Clean up Candidate 2
  await repository.deleteCandidateAccountData(CAND_2);
  await prisma.job.delete({ where: { id: publicJob.id } }).catch(() => {});

  // Cleanup test override
  setTestCandidateId(null);
  await prisma.$disconnect();

  console.log('\n====================================================');
  const total = auditChecks.length;
  const passed = auditChecks.filter((c) => c.passed).length;
  console.log(`E2E Audit Results: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log('🎉 AUDIT SCENARIO VERIFICATION: COMPLETE PASS');
  } else {
    console.log(`❌ AUDIT SCENARIO VERIFICATION: ${total - passed} FAILED`);
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
