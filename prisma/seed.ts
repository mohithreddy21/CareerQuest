/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { initialCareerData } from '../src/constants/mock-career-data';
import { extractResumeContent } from '../src/types/resume-content';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CareerQuest Phase 6A database seed...');

  const data = initialCareerData;

  // 1. Clean existing development seed data cleanly in foreign-key dependency order
  console.log('🧹 Cleaning existing records...');
  await prisma.savedSearch.deleteMany();
  await prisma.candidateJobState.deleteMany();
  await prisma.jobSourceReference.deleteMany();
  await prisma.resumeExportRecord.deleteMany();
  await prisma.applicationContact.deleteMany();
  await prisma.interviewStage.deleteMany();
  await prisma.applicationEvent.deleteMany();
  await prisma.application.deleteMany();
  await prisma.resumeChange.deleteMany();
  await prisma.resumeVersion.deleteMany();
  await prisma.jobMatch.deleteMany();
  await prisma.jobAnalysis.deleteMany();
  await prisma.job.deleteMany();
  await prisma.resumeIngestionBatch.deleteMany();
  await prisma.knowledgeProvenance.deleteMany();
  await prisma.candidateDocument.deleteMany();
  await prisma.knowledgeItem.deleteMany();
  await prisma.candidatePreferences.deleteMany();
  await prisma.candidateProfile.deleteMany();
  await prisma.candidate.deleteMany();

  // 2. Seed Candidate Identity
  console.log('👤 Seeding Candidate: Alex Chen...');
  const candidate = await prisma.candidate.create({
    data: {
      id: data.candidate.id,
      clerkUserId: data.candidate.userId || 'user_mock_01',
      email: data.candidate.email,
      profile: {
        create: {
          name: data.candidate.name,
          phone: data.candidate.phone,
          location: data.candidate.location,
          professionalSummary: data.candidate.professionalSummary,
          headline: 'Senior Full-Stack & Systems Engineer',
          masterResumeId: data.candidate.masterResumeId
        }
      },
      preferences: {
        create: {
          targetRoles: data.candidate.targetRoles,
          preferredLocations: ['San Francisco, CA', 'Remote', 'New York, NY'],
          workArrangements: ['remote', 'hybrid'],
          targetSalaryMin: 180000,
          currency: 'USD'
        }
      }
    }
  });

  // 3. Seed Knowledge Bank (Sole source of truth for candidate career facts)
  console.log('🧠 Seeding Candidate Knowledge Bank items...');
  const kb = data.knowledgeBank;
  const allKbItems = [
    ...(kb.skills || []),
    ...(kb.experiences || []),
    ...(kb.projects || []),
    ...(kb.education || []),
    ...(kb.certifications || []),
    ...(kb.achievements || [])
  ];

  for (const item of allKbItems) {
    await prisma.knowledgeItem.create({
      data: {
        id: item.id,
        candidateId: candidate.id,
        category: item.category,
        content: item.content as object,
        status: item.status,
        provenance: {
          create: (item.provenance || []).map((prov) => ({
            id: prov.id,
            sourceType: prov.sourceType,
            sourceLabel: prov.sourceLabel,
            documentId: prov.documentId,
            extractedSnippet: prov.extractedSnippet,
            confidence: prov.confidence,
            addedAt: new Date(prov.addedAt)
          }))
        }
      }
    });
  }

  // 4. Seed Proposed Ingestion Batches
  if (data.proposedBatches && data.proposedBatches.length > 0) {
    console.log('📥 Seeding Ingestion Batches...');
    for (const batch of data.proposedBatches) {
      await prisma.resumeIngestionBatch.create({
        data: {
          id: batch.id,
          candidateId: candidate.id,
          fileName: batch.fileName,
          rawText: null, // nullable / privacy safeguarded
          status: batch.status,
          items: batch.items as object,
          uploadedAt: new Date(batch.uploadedAt)
        }
      });
    }
  }

  // 5. Seed Jobs & Job Analyses
  console.log('💼 Seeding Jobs catalog and Analyses...');
  for (const job of data.jobs) {
    await prisma.job.create({
      data: {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        workArrangement: job.workArrangement,
        description: job.description,
        responsibilities: job.responsibilities,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        experienceRequirement: job.experienceRequirement,
        educationRequirement: job.educationRequirement,
        salaryMin: job.salary?.min,
        salaryMax: job.salary?.max,
        salaryCurrency: job.salary?.currency || 'USD',
        salaryInterval: job.salary?.interval || 'yearly',
        postedDate: job.postedDate ? new Date(job.postedDate) : null,
        source: job.source,
        originalUrl: job.originalUrl,
        normalizedAt: new Date(job.normalizedAt),
        duplicateGroupId: job.duplicateGroupId,
        jobStatus: job.jobStatus,
        isPublic: true
      }
    });

    if (job.originalUrl || job.source) {
      await prisma.jobSourceReference.create({
        data: {
          jobId: job.id,
          source: job.source || 'company_portal',
          sourceUrl:
            job.originalUrl ||
            `https://careers.example.com/${job.company.toLowerCase().replace(/[^a-z0-9]/g, '')}/${job.id}`,
          normalizedUrl:
            job.originalUrl ||
            `https://careers.example.com/${job.company.toLowerCase().replace(/[^a-z0-9]/g, '')}/${job.id}`,
          sourceStatus: 'active',
          verificationStatus: 'verified_accessible',
          lastVerifiedAt: new Date(),
          isPrimary: true,
          referenceRole: 'primary'
        }
      });
    }
  }

  for (const analysis of data.analyses) {
    await prisma.jobAnalysis.create({
      data: {
        id: analysis.id,
        jobId: analysis.jobId,
        seniority: analysis.seniority,
        roleCategory: analysis.roleCategory,
        technicalRequirements: analysis.technicalRequirements,
        softSkills: analysis.softSkills,
        importantKeywords: analysis.importantKeywords,
        extractedRequirements: analysis.extractedRequirements as object,
        analysisStatus: analysis.analysisStatus,
        analysisVersion: '1.0'
      }
    });
  }

  // 6. Seed Job Matches (Preserving decision scores: Stripe 94%, Datadog 82%, Linear 76%)
  console.log('🎯 Seeding Job Matches decision support scores...');
  for (const match of data.matches) {
    await prisma.jobMatch.create({
      data: {
        id: match.id,
        jobId: match.jobId,
        candidateId: candidate.id,
        score: match.score,
        recommendation: match.recommendation,
        headline: match.headline,
        reasoning: match.reasoning,
        strongMatches: match.strongMatches as object,
        partialMatches: match.partialMatches as object,
        missingRequirements: match.missingRequirements as object,
        supportingCandidateEvidence: match.supportingCandidateEvidence as object,
        matchAlgorithmVersion: '1.0'
      }
    });
  }

  // 7. Seed Resume Versions & Tailoring Changes
  console.log('📄 Seeding Resume Versions & Changes...');
  for (const resume of data.resumes) {
    await prisma.resumeVersion.create({
      data: {
        id: resume.id,
        candidateId: candidate.id,
        masterResumeId: resume.masterResumeId,
        jobId: resume.jobId,
        targetCompany: resume.targetCompany,
        title: resume.title,
        targetRole: resume.targetRole,
        summary: resume.summary,
        experience: resume.experience as object,
        education: resume.education as object,
        skills: resume.skills as object,
        projects: resume.projects as object,
        certifications: resume.certifications as object,
        approvalState: resume.approvalState,
        isLocked: resume.approvalState === 'approved', // Lock approved applied versions
        changes: {
          create: (resume.changes || []).map((ch) => ({
            id: ch.id,
            candidateId: candidate.id,
            jobId: resume.jobId,
            section: ch.section,
            sectionItemId: ch.sectionItemId,
            originalContent: ch.originalContent,
            proposedContent: ch.proposedContent,
            editedContent: ch.editedContent,
            rationale: ch.rationale,
            jobRequirement: ch.jobRequirement,
            sourceCandidateEvidence: ch.sourceCandidateEvidence,
            sourceKnowledgeItemIds: ch.sourceKnowledgeItemIds,
            evidenceReferences: ch.evidenceReferences || [],
            status: ch.status,
            grounded: ch.grounded ?? true
          }))
        }
      }
    });
  }

  // 8. Seed Applications with Frozen Snapshots & Tracking Sub-entities
  console.log('🚀 Seeding Applications pipeline & historical snapshots...');
  for (const app of data.applications) {
    // Generate historical resume snapshot JSON for applications
    let resumeSnapshot: object | null = null;
    const tailoredResume = data.resumes.find(
      (r) => r.id === app.tailoredResumeVersionId || r.id === app.resumeVersionId
    );
    if (tailoredResume) {
      resumeSnapshot = extractResumeContent(tailoredResume, data.candidate) as object;
    }

    await prisma.application.create({
      data: {
        id: app.id,
        candidateId: candidate.id,
        jobId: app.jobId,
        status: app.status,
        dateDiscovered: new Date(app.dateDiscovered),
        dateApplied: app.dateApplied ? new Date(app.dateApplied) : null,
        dateClosed: app.dateClosed ? new Date(app.dateClosed) : null,
        isArchived: app.isArchived ?? false,
        notes: app.notes,
        resumeVersionId: app.resumeVersionId,
        tailoredResumeVersionId: app.tailoredResumeVersionId,
        selectedTemplateId: app.selectedTemplateId,
        selectedTemplateVersion: app.selectedTemplateVersion || '1.0',
        matchScoreAtApplication: app.matchScoreAtApplication,
        resumeSnapshot: resumeSnapshot ?? undefined,
        coverLetter: app.coverLetter,
        coverLetterData: app.coverLetterData as object,
        applicationAnswers: app.applicationAnswers as object,
        preparedQuestions: app.preparedQuestions as object,
        followUpDate: app.followUpDate,
        followUpStatus: app.followUpStatus || 'none',
        followUpNote: app.followUpNote,
        statusHistory: app.statusHistory as object,
        interviewStages: {
          create: (app.interviewStages || []).map((stage) => ({
            id: stage.id,
            stageName: stage.stageName,
            scheduledDate: stage.scheduledDate ? new Date(stage.scheduledDate) : null,
            completedDate: stage.completedDate ? new Date(stage.completedDate) : null,
            interviewerNames: stage.interviewerNames || [],
            meetingLink: stage.meetingLink,
            location: stage.location,
            notes: stage.notes,
            status: stage.status,
            outcome: stage.outcome,
            feedback: stage.feedback
          }))
        },
        contacts: {
          create: (app.contacts || []).map((contact) => ({
            id: contact.id,
            name: contact.name,
            role: contact.role,
            email: contact.email,
            phone: contact.phone,
            linkedInUrl: contact.linkedInUrl,
            notes: contact.notes,
            createdAt: new Date(contact.createdAt)
          }))
        },
        exports: {
          create: (app.exports || []).map((exp) => ({
            id: exp.id,
            candidateId: candidate.id,
            tailoredResumeVersionId: exp.tailoredResumeVersionId,
            templateId: exp.templateId,
            templateVersion: exp.templateVersion,
            format: exp.format,
            filename: exp.filename,
            createdAt: new Date(exp.createdAt)
          }))
        }
      }
    });
  }

  // 9. Seed Application Timeline Events Ledger (Append-only)
  console.log('📜 Seeding Application Events ledger...');
  for (const event of data.applicationEvents) {
    await prisma.applicationEvent.create({
      data: {
        id: event.id,
        candidateId: candidate.id,
        applicationId: event.applicationId,
        jobId: event.jobId,
        type: event.type,
        title: event.title,
        description: event.description,
        timestamp: new Date(event.timestamp),
        isAutomated: event.isAutomated,
        metadata: event.metadata as object
      }
    });
  }

  console.log('✅ CareerQuest Phase 6A database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
