-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT NOT NULL,
    "professionalSummary" TEXT NOT NULL,
    "headline" TEXT,
    "masterResumeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePreferences" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "targetRoles" TEXT[],
    "preferredLocations" TEXT[],
    "workArrangements" TEXT[],
    "targetSalaryMin" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatePreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeProvenance" (
    "id" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "documentId" TEXT,
    "extractedSnippet" TEXT,
    "confidence" DOUBLE PRECISION,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateDocument" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" TEXT NOT NULL DEFAULT 'uploaded',

    CONSTRAINT "CandidateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeIngestionBatch" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "documentId" TEXT,
    "fileName" TEXT NOT NULL,
    "rawText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "items" JSONB NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ResumeIngestionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "workArrangement" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT[],
    "requiredSkills" TEXT[],
    "preferredSkills" TEXT[],
    "experienceRequirement" TEXT,
    "educationRequirement" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "salaryInterval" TEXT NOT NULL DEFAULT 'yearly',
    "postedDate" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "originalUrl" TEXT,
    "normalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duplicateGroupId" TEXT,
    "jobStatus" TEXT NOT NULL DEFAULT 'active',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "importedByCandidateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAnalysis" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "seniority" TEXT NOT NULL,
    "roleCategory" TEXT NOT NULL,
    "technicalRequirements" TEXT[],
    "softSkills" TEXT[],
    "importantKeywords" TEXT[],
    "extractedRequirements" JSONB NOT NULL,
    "analysisStatus" TEXT NOT NULL DEFAULT 'idle',
    "analysisVersion" TEXT NOT NULL DEFAULT '1.0',
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobMatch" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "recommendation" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "strongMatches" JSONB NOT NULL,
    "partialMatches" JSONB NOT NULL,
    "missingRequirements" JSONB NOT NULL,
    "supportingCandidateEvidence" JSONB NOT NULL,
    "matchAlgorithmVersion" TEXT NOT NULL DEFAULT '1.0',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "masterResumeId" TEXT,
    "jobId" TEXT,
    "targetCompany" TEXT,
    "title" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "experience" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    "skills" JSONB NOT NULL,
    "projects" JSONB NOT NULL,
    "certifications" JSONB NOT NULL,
    "approvalState" TEXT NOT NULL DEFAULT 'draft',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeChange" (
    "id" TEXT NOT NULL,
    "resumeVersionId" TEXT NOT NULL,
    "candidateId" TEXT,
    "jobId" TEXT,
    "section" TEXT NOT NULL,
    "sectionItemId" TEXT,
    "originalContent" TEXT NOT NULL,
    "proposedContent" TEXT NOT NULL,
    "editedContent" TEXT,
    "rationale" TEXT NOT NULL,
    "jobRequirement" TEXT NOT NULL,
    "sourceCandidateEvidence" TEXT NOT NULL,
    "sourceKnowledgeItemIds" TEXT[],
    "evidenceReferences" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "grounded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'discovered',
    "dateDiscovered" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateApplied" TIMESTAMP(3),
    "dateClosed" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "resumeVersionId" TEXT,
    "tailoredResumeVersionId" TEXT,
    "selectedTemplateId" TEXT,
    "selectedTemplateVersion" TEXT,
    "matchScoreAtApplication" INTEGER,
    "resumeSnapshot" JSONB,
    "coverLetter" TEXT,
    "coverLetterData" JSONB,
    "applicationAnswers" JSONB,
    "preparedQuestions" JSONB,
    "followUpDate" TEXT,
    "followUpStatus" TEXT NOT NULL DEFAULT 'none',
    "followUpNote" TEXT,
    "statusHistory" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewStage" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "interviewerNames" TEXT[],
    "meetingLink" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "outcome" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationContact" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "linkedInUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeExportRecord" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "tailoredResumeVersionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeExportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_clerkUserId_key" ON "Candidate"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_clerkUserId_idx" ON "Candidate"("clerkUserId");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_candidateId_key" ON "CandidateProfile"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePreferences_candidateId_key" ON "CandidatePreferences"("candidateId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_candidateId_category_idx" ON "KnowledgeItem"("candidateId", "category");

-- CreateIndex
CREATE INDEX "KnowledgeItem_candidateId_status_idx" ON "KnowledgeItem"("candidateId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeProvenance_knowledgeItemId_idx" ON "KnowledgeProvenance"("knowledgeItemId");

-- CreateIndex
CREATE INDEX "KnowledgeProvenance_documentId_idx" ON "KnowledgeProvenance"("documentId");

-- CreateIndex
CREATE INDEX "CandidateDocument_candidateId_idx" ON "CandidateDocument"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateDocument_hash_idx" ON "CandidateDocument"("hash");

-- CreateIndex
CREATE INDEX "ResumeIngestionBatch_candidateId_status_idx" ON "ResumeIngestionBatch"("candidateId", "status");

-- CreateIndex
CREATE INDEX "Job_jobStatus_isPublic_idx" ON "Job"("jobStatus", "isPublic");

-- CreateIndex
CREATE INDEX "Job_importedByCandidateId_idx" ON "Job"("importedByCandidateId");

-- CreateIndex
CREATE INDEX "Job_company_idx" ON "Job"("company");

-- CreateIndex
CREATE UNIQUE INDEX "JobAnalysis_jobId_key" ON "JobAnalysis"("jobId");

-- CreateIndex
CREATE INDEX "JobMatch_candidateId_score_idx" ON "JobMatch"("candidateId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "JobMatch_candidateId_jobId_key" ON "JobMatch"("candidateId", "jobId");

-- CreateIndex
CREATE INDEX "ResumeVersion_candidateId_jobId_idx" ON "ResumeVersion"("candidateId", "jobId");

-- CreateIndex
CREATE INDEX "ResumeVersion_candidateId_approvalState_idx" ON "ResumeVersion"("candidateId", "approvalState");

-- CreateIndex
CREATE INDEX "ResumeChange_resumeVersionId_section_idx" ON "ResumeChange"("resumeVersionId", "section");

-- CreateIndex
CREATE INDEX "Application_candidateId_status_idx" ON "Application"("candidateId", "status");

-- CreateIndex
CREATE INDEX "Application_candidateId_jobId_idx" ON "Application"("candidateId", "jobId");

-- CreateIndex
CREATE INDEX "Application_tailoredResumeVersionId_idx" ON "Application"("tailoredResumeVersionId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_timestamp_idx" ON "ApplicationEvent"("applicationId", "timestamp");

-- CreateIndex
CREATE INDEX "ApplicationEvent_candidateId_timestamp_idx" ON "ApplicationEvent"("candidateId", "timestamp");

-- CreateIndex
CREATE INDEX "InterviewStage_applicationId_status_idx" ON "InterviewStage"("applicationId", "status");

-- CreateIndex
CREATE INDEX "ApplicationContact_applicationId_idx" ON "ApplicationContact"("applicationId");

-- CreateIndex
CREATE INDEX "ResumeExportRecord_candidateId_idx" ON "ResumeExportRecord"("candidateId");

-- CreateIndex
CREATE INDEX "ResumeExportRecord_applicationId_idx" ON "ResumeExportRecord"("applicationId");

-- CreateIndex
CREATE INDEX "ResumeExportRecord_tailoredResumeVersionId_idx" ON "ResumeExportRecord"("tailoredResumeVersionId");

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatePreferences" ADD CONSTRAINT "CandidatePreferences_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeProvenance" ADD CONSTRAINT "KnowledgeProvenance_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeProvenance" ADD CONSTRAINT "KnowledgeProvenance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CandidateDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateDocument" ADD CONSTRAINT "CandidateDocument_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeIngestionBatch" ADD CONSTRAINT "ResumeIngestionBatch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeIngestionBatch" ADD CONSTRAINT "ResumeIngestionBatch_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CandidateDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_importedByCandidateId_fkey" FOREIGN KEY ("importedByCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobMatch" ADD CONSTRAINT "JobMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeChange" ADD CONSTRAINT "ResumeChange_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_tailoredResumeVersionId_fkey" FOREIGN KEY ("tailoredResumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewStage" ADD CONSTRAINT "InterviewStage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationContact" ADD CONSTRAINT "ApplicationContact_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeExportRecord" ADD CONSTRAINT "ResumeExportRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeExportRecord" ADD CONSTRAINT "ResumeExportRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeExportRecord" ADD CONSTRAINT "ResumeExportRecord_tailoredResumeVersionId_fkey" FOREIGN KEY ("tailoredResumeVersionId") REFERENCES "ResumeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
