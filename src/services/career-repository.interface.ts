import {
  Application,
  ApplicationContact,
  ApplicationEvent,
  ApplicationStatus,
  CandidatePreferences,
  CandidateProfile,
  InterviewStage,
  Job,
  JobAnalysis,
  JobMatch,
  JobSourceReference,
  CandidateJobState,
  CandidateJobStatus,
  SavedSearch,
  NextAction,
  ResumeChange,
  ResumeChangeStatus,
  ResumeExport,
  ResumeTemplateId,
  ResumeVersion,
  SearchAnalytics
} from '@/types/domain';
import {
  AccountDeletionResult,
  CandidateDocument,
  CandidateKnowledgeBank,
  GroundedApplicationQuestion,
  GroundedCoverLetter,
  KnowledgeItem,
  KnowledgeStatus,
  ProposedIngestionBatch
} from '@/types';
import { ApplicationDetail, ApplicationWithJob } from '@/features/applications/api/types';
import { ImportJobResponse } from '@/features/jobs/api/types';
import { DashboardOverviewResponse } from '@/features/overview/api/types';
import { InsightEngineResult } from '@/features/analytics/services/insight-engine';

export interface JobFilters {
  search?: string;
  source?: string;
  workArrangement?: string;
  status?: string;
  minMatch?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface ApplicationPreparationUpdates {
  coverLetterData?: GroundedCoverLetter;
  coverLetter?: string;
  preparedQuestions?: GroundedApplicationQuestion[];
  selectedTemplateId?: ResumeTemplateId;
  selectedTemplateVersion?: string;
  tailoredResumeVersionId?: string;
}

export interface FollowUpUpdates {
  followUpDate?: string;
  followUpStatus?: import('@/types/application-tracking').FollowUpStatus;
  followUpNote?: string;
}

/**
 * Core CareerQuest Repository Interface (ICareerRepository)
 *
 * Architecture Invariants:
 * 1. Represents all data-access operations across Candidate, Knowledge Bank, Jobs,
 *    Tailoring, Applications, and Intelligence.
 * 2. Candidate-owned queries require a server-derived candidateId for multi-tenant isolation.
 * 3. Preserves deterministic offline testability via InMemoryCareerRepository.
 * 4. Enables production persistence via PrismaCareerRepository.
 */
export interface ICareerRepository {
  // --- Candidate Identity, Profile & Preferences ---
  getCandidateProfile(candidateId?: string): Promise<CandidateProfile>;
  updateCandidateProfile(
    updates: Partial<CandidateProfile>,
    candidateId?: string
  ): Promise<CandidateProfile>;
  getCandidatePreferences(candidateId?: string): Promise<CandidatePreferences | null>;
  updateCandidatePreferences(
    updates: Partial<CandidatePreferences>,
    candidateId?: string
  ): Promise<CandidatePreferences>;

  // --- Jobs Catalog & Isolation ---
  getJobs(
    filters?: JobFilters,
    candidateId?: string
  ): Promise<(Job & { match?: JobMatch | null; applicationStatus?: ApplicationStatus | null })[]>;
  getJobById(id: string, candidateId?: string): Promise<Job | null>;
  getJobAnalysis(jobId: string): Promise<JobAnalysis | null>;
  saveJobAnalysis(analysis: JobAnalysis): Promise<JobAnalysis>;
  getJobMatch(jobId: string, candidateId?: string): Promise<JobMatch | null>;
  saveJobMatch(match: JobMatch, candidateId?: string): Promise<JobMatch>;
  importJobByUrl(url: string, force?: boolean, candidateId?: string): Promise<ImportJobResponse>;
  importJobFromText(
    text: string,
    title?: string,
    company?: string,
    candidateId?: string
  ): Promise<ImportJobResponse>;
  addJob(job: Omit<Job, 'id' | 'normalizedAt'>, candidateId?: string): Promise<Job>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job>;

  // --- Phase 7A: Job Discovery, Source References & Candidate State ---
  getJobSourceReferences(jobId: string): Promise<JobSourceReference[]>;
  addJobSourceReference(
    reference: Omit<JobSourceReference, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<JobSourceReference>;
  setPrimaryJobSourceReference(jobId: string, referenceId: string): Promise<void>;
  getCandidateJobState(jobId: string, candidateId: string): Promise<CandidateJobState | null>;
  setCandidateJobState(
    jobId: string,
    status: CandidateJobStatus,
    candidateId: string,
    dismissedReason?: string
  ): Promise<CandidateJobState>;
  getSavedSearches(candidateId: string): Promise<SavedSearch[]>;
  getSavedSearchById(id: string, candidateId: string): Promise<SavedSearch | null>;
  saveSavedSearch(
    search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt' | 'candidateId'> & {
      id?: string;
      candidateId?: string;
    },
    candidateId: string
  ): Promise<SavedSearch>;
  deleteSavedSearch(id: string, candidateId: string): Promise<boolean>;

  // --- Candidate Knowledge Bank & Provenance ---
  getKnowledgeBank(candidateId?: string): Promise<CandidateKnowledgeBank>;
  getKnowledgeItemById(itemId: string, candidateId?: string): Promise<KnowledgeItem | null>;
  saveKnowledgeItem(item: KnowledgeItem, candidateId?: string): Promise<KnowledgeItem>;
  updateKnowledgeItem(
    idOrItem: string | KnowledgeItem,
    updates?: Partial<KnowledgeItem>,
    candidateId?: string
  ): Promise<KnowledgeItem>;
  updateKnowledgeItemStatus(
    itemId: string,
    status: KnowledgeStatus,
    candidateId?: string
  ): Promise<KnowledgeItem>;
  deleteKnowledgeItem(itemId: string, candidateId?: string): Promise<boolean>;

  // --- Ingestion Batches & Documents ---
  getProposedBatches(candidateId?: string): Promise<ProposedIngestionBatch[]>;
  createProposedBatch(
    batch: Omit<ProposedIngestionBatch, 'id' | 'uploadedAt'>,
    candidateId?: string
  ): Promise<ProposedIngestionBatch>;
  saveProposedBatch(
    batch: ProposedIngestionBatch,
    candidateId?: string
  ): Promise<ProposedIngestionBatch>;
  resolveProposedBatch(batchId: string, candidateId?: string): Promise<ProposedIngestionBatch>;
  deleteProposedBatch(batchId: string, candidateId?: string): Promise<boolean>;
  getCandidateDocuments(candidateId?: string): Promise<CandidateDocument[]>;
  getCandidateDocumentById(
    documentId: string,
    candidateId?: string
  ): Promise<CandidateDocument | null>;
  createCandidateDocument(
    doc: Omit<CandidateDocument, 'id' | 'uploadedAt'>,
    candidateId?: string
  ): Promise<CandidateDocument>;
  deleteCandidateDocument(documentId: string, candidateId?: string): Promise<boolean>;
  getResumeExportRecords(candidateId?: string): Promise<ResumeExport[]>;
  createResumeExportRecord(
    record: Omit<ResumeExport, 'id' | 'createdAt'>,
    candidateId?: string
  ): Promise<ResumeExport>;
  deleteCandidateAccountData(candidateId: string): Promise<AccountDeletionResult>;

  // --- Resume Tailoring & Versioning ---
  getResumeVersions(candidateId?: string): Promise<ResumeVersion[]>;
  getResumeVersionById(id: string, candidateId?: string): Promise<ResumeVersion | null>;
  getMasterResume(candidateId?: string): Promise<ResumeVersion | null>;
  saveResumeVersion(version: ResumeVersion, candidateId?: string): Promise<ResumeVersion>;
  getTailoredResumeForJob(jobId: string, candidateId?: string): Promise<ResumeVersion | null>;
  updateResumeChangeStatus(
    resumeVersionId: string,
    changeId: string,
    status: ResumeChangeStatus,
    candidateId?: string
  ): Promise<ResumeChange>;
  approveAllResumeChanges(resumeVersionId: string, candidateId?: string): Promise<ResumeVersion>;

  // --- Applications & Tracking Pipeline ---
  getApplications(
    filters?: {
      status?: string;
      search?: string;
      sort?: string;
      includeArchived?: boolean;
    },
    candidateId?: string
  ): Promise<ApplicationWithJob[]>;
  getApplicationById(id: string, candidateId?: string): Promise<ApplicationDetail | null>;
  getApplicationByJobId(jobId: string, candidateId?: string): Promise<Application | null>;
  createApplication(
    jobId: string,
    initialStatus?: ApplicationStatus,
    options?: { allowDuplicate?: boolean },
    candidateId?: string
  ): Promise<Application>;
  confirmApplicationSubmission(
    payload: import('@/features/preparation/api/types').ConfirmAppliedPayload,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application>;
  updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    note?: string,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application>;
  updateApplicationNotes(
    id: string,
    notes: string,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application>;
  updateApplicationPreparation(
    id: string,
    updates: ApplicationPreparationUpdates,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application>;
  recordApplicationExport(
    applicationId: string,
    exportRecord: ResumeExport,
    candidateId?: string
  ): Promise<Application>;
  getApplicationEvents(applicationId?: string, candidateId?: string): Promise<ApplicationEvent[]>;
  recordApplicationEvent(
    event: Omit<ApplicationEvent, 'id' | 'timestamp'>,
    candidateId?: string
  ): Promise<ApplicationEvent>;
  updateApplicationFollowUp(
    applicationId: string,
    updates: FollowUpUpdates,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application>;
  addInterviewStage(
    applicationId: string,
    stage: Omit<InterviewStage, 'id'>,
    candidateId?: string
  ): Promise<Application>;
  updateInterviewStage(
    applicationId: string,
    stage: InterviewStage,
    candidateId?: string
  ): Promise<Application>;
  deleteInterviewStage(
    applicationId: string,
    stageId: string,
    candidateId?: string
  ): Promise<Application>;
  addApplicationContact(
    applicationId: string,
    contact: Omit<ApplicationContact, 'id' | 'createdAt'>,
    candidateId?: string
  ): Promise<Application>;
  updateApplicationContact(
    applicationId: string,
    contactId: string,
    updates: Partial<ApplicationContact>,
    candidateId?: string
  ): Promise<Application>;
  deleteApplicationContact(
    applicationId: string,
    contactId: string,
    candidateId?: string
  ): Promise<Application>;
  updateApplicationArchiveStatus(
    applicationId: string,
    isArchived: boolean,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application>;

  // --- Search Intelligence, Analytics & Next Actions ---
  getDashboardOverview(candidateId?: string): Promise<DashboardOverviewResponse>;
  getNextActions(candidateId?: string): Promise<NextAction[]>;
  getSearchAnalytics(candidateId?: string): Promise<SearchAnalytics>;
  getSearchInsights(candidateId?: string): Promise<InsightEngineResult>;
}
