-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "salaryCurrency" DROP NOT NULL,
ALTER COLUMN "salaryCurrency" DROP DEFAULT,
ALTER COLUMN "salaryInterval" DROP NOT NULL;

-- CreateTable
CREATE TABLE "JobSourceReference" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceJobId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "sourceStatus" TEXT NOT NULL DEFAULT 'active',
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "lastVerifiedAt" TIMESTAMP(3),
    "lastVerificationError" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "referenceRole" TEXT NOT NULL DEFAULT 'primary',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateJobState" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNSEEN',
    "dismissedReason" TEXT,
    "firstViewedAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateJobState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT,
    "locations" TEXT[],
    "workArrangements" TEXT[],
    "roleCategories" TEXT[],
    "seniorityLevels" TEXT[],
    "minSalary" INTEGER,
    "currency" TEXT,
    "alertFrequency" TEXT NOT NULL DEFAULT 'weekly',
    "filterVersion" TEXT NOT NULL DEFAULT '1.0',
    "lastExecutedAt" TIMESTAMP(3),
    "lastMatchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobSourceReference_jobId_sourceStatus_verificationStatus_idx" ON "JobSourceReference"("jobId", "sourceStatus", "verificationStatus");

-- CreateIndex
CREATE INDEX "JobSourceReference_jobId_isPrimary_idx" ON "JobSourceReference"("jobId", "isPrimary");

-- CreateIndex
CREATE INDEX "JobSourceReference_normalizedUrl_idx" ON "JobSourceReference"("normalizedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "JobSourceReference_source_normalizedUrl_key" ON "JobSourceReference"("source", "normalizedUrl");

-- CreateIndex
CREATE INDEX "CandidateJobState_candidateId_status_idx" ON "CandidateJobState"("candidateId", "status");

-- CreateIndex
CREATE INDEX "CandidateJobState_jobId_idx" ON "CandidateJobState"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateJobState_candidateId_jobId_key" ON "CandidateJobState"("candidateId", "jobId");

-- CreateIndex
CREATE INDEX "SavedSearch_candidateId_createdAt_idx" ON "SavedSearch"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_duplicateGroupId_idx" ON "Job"("duplicateGroupId");

-- CreateIndex
CREATE INDEX "Job_postedDate_idx" ON "Job"("postedDate");

-- AddForeignKey
ALTER TABLE "JobSourceReference" ADD CONSTRAINT "JobSourceReference_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateJobState" ADD CONSTRAINT "CandidateJobState_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateJobState" ADD CONSTRAINT "CandidateJobState_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: at most one primary source reference per Job
CREATE UNIQUE INDEX "job_source_primary_idx" ON "JobSourceReference"("jobId") WHERE "isPrimary" = true;
