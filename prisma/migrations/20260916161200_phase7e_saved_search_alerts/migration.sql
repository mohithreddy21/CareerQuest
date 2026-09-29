-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "minMatchScore" INTEGER;

-- CreateTable
CREATE TABLE "SavedSearchAlert" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "savedSearchVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'generated',

    CONSTRAINT "SavedSearchAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateNotification" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedJobId" TEXT,
    "relatedSavedSearchId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSearchAlert_candidateId_generatedAt_idx" ON "SavedSearchAlert"("candidateId", "generatedAt");

-- CreateIndex
CREATE INDEX "SavedSearchAlert_savedSearchId_idx" ON "SavedSearchAlert"("savedSearchId");

-- CreateIndex
CREATE INDEX "SavedSearchAlert_jobId_idx" ON "SavedSearchAlert"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedSearchAlert_candidateId_savedSearchId_jobId_key" ON "SavedSearchAlert"("candidateId", "savedSearchId", "jobId");

-- CreateIndex
CREATE INDEX "CandidateNotification_candidateId_createdAt_idx" ON "CandidateNotification"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateNotification_candidateId_readAt_idx" ON "CandidateNotification"("candidateId", "readAt");

-- AddForeignKey
ALTER TABLE "SavedSearchAlert" ADD CONSTRAINT "SavedSearchAlert_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchAlert" ADD CONSTRAINT "SavedSearchAlert_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchAlert" ADD CONSTRAINT "SavedSearchAlert_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNotification" ADD CONSTRAINT "CandidateNotification_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNotification" ADD CONSTRAINT "CandidateNotification_relatedJobId_fkey" FOREIGN KEY ("relatedJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNotification" ADD CONSTRAINT "CandidateNotification_relatedSavedSearchId_fkey" FOREIGN KEY ("relatedSavedSearchId") REFERENCES "SavedSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
