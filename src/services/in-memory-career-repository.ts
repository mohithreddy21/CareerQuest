import { initialCareerData, CareerDatabase } from '@/constants/mock-career-data';
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
  SavedSearchAlert,
  CandidateNotification,
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
  KnowledgeItem,
  KnowledgeStatus,
  ProposedIngestionBatch
} from '@/types';
import {
  ICareerRepository,
  JobFilters,
  ApplicationPreparationUpdates,
  FollowUpUpdates
} from './career-repository.interface';
import { ApplicationDetail, ApplicationWithJob } from '@/features/applications/api/types';
import { ImportJobResponse } from '@/features/jobs/api/types';
import {
  ingestJobFromUrl,
  ingestJobFromManualText,
  detectSource,
  normalizeJobUrl
} from '@/features/jobs/lib/importer';
import {
  evaluateDeduplication,
  shouldPromoteNewSource,
  selectBestPrimarySource,
  aggregateJobStatus,
  normalizeCompany,
  isSourceUsable
} from '@/features/jobs/lib/dedup';
import {
  DEFAULT_RANKING_CONFIG,
  DEFAULT_DISCOVERY_PAGE_SIZE,
  MAX_DISCOVERY_PAGE_SIZE,
  DiscoveryRankingParams,
  DiscoveryRankingResponse,
  DiscoveryRankingCursorPayload,
  RankedOpportunity,
  buildRankingContextKey,
  calculateOpportunityPriority,
  compareDiscoveryOrder,
  decodeCursor,
  encodeCursor,
  isRowAfterCursor
} from '@/features/jobs/lib/ranking';
import { analysisService } from '@/features/jobs/services/analysis-service';
import { matchService } from '@/features/jobs/services/match-service';
import {
  DashboardOverviewResponse,
  RecommendedOpportunity,
  NextActionTask
} from '@/features/overview/api/types';
import {
  InsightEngineResult,
  SearchInsightEngine
} from '@/features/analytics/services/insight-engine';
import { SearchAnalyticsService } from '@/features/analytics/services/analytics-service';
import { NextActionsService } from '@/features/overview/services/next-actions-service';
import { ConcurrencyError } from '@/types/errors';
import { extractResumeContent } from '@/types/resume-content';
import { RESUME_TEMPLATES } from '@/features/templates/constants/templates';

/**
 * InMemoryCareerRepository
 *
 * Implements ICareerRepository using in-memory state initialized from initialCareerData.
 * Preserves deterministic test fixtures, mock data, and offline testability for Phases 1-5.
 */
export class InMemoryCareerRepository implements ICareerRepository {
  private db: CareerDatabase & {
    documents?: CandidateDocument[];
    preferences?: Record<string, CandidatePreferences>;
  };
  private jobSourceReferences: JobSourceReference[] = [];
  private candidateJobStates: Map<string, CandidateJobState> = new Map();
  private previousJobStates: Map<string, CandidateJobStatus> = new Map();
  private savedSearches: SavedSearch[] = [];
  private savedSearchAlerts: SavedSearchAlert[] = [];
  private candidateNotifications: CandidateNotification[] = [];

  constructor() {
    this.db = JSON.parse(JSON.stringify(initialCareerData));
    this.db.documents = [];
    this.db.preferences = {
      [this.db.candidate.id]: {
        targetRoles:
          this.db.candidate.preferences?.targetRoles || this.db.candidate.targetRoles || [],
        preferredLocations: this.db.candidate.preferences?.preferredLocations || [
          'San Francisco, CA',
          'Remote'
        ],
        workArrangements: this.db.candidate.preferences?.workArrangements || ['remote', 'hybrid'],
        targetSalaryMin: this.db.candidate.preferences?.targetSalaryMin || 180000,
        currency: this.db.candidate.preferences?.currency || 'USD'
      }
    };

    // Seed initial primary source reference for each initial mock job
    for (const job of this.db.jobs) {
      if (job.originalUrl || job.source) {
        this.jobSourceReferences.push({
          id: `jsr-${job.id}-init`,
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
          referenceRole: 'primary',
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }

  // --- Candidate Identity, Profile & Preferences ---
  async getCandidateProfile(candidateId?: string): Promise<CandidateProfile> {
    const cand = this.db.candidate;
    if (candidateId && cand.id !== candidateId) {
      // In-memory single-candidate mock fallback
      return {
        ...cand,
        id: candidateId
      };
    }
    return JSON.parse(JSON.stringify(cand));
  }

  async updateCandidateProfile(
    updates: Partial<CandidateProfile>,
    _candidateId?: string
  ): Promise<CandidateProfile> {
    this.db.candidate = {
      ...this.db.candidate,
      ...updates
    };
    return JSON.parse(JSON.stringify(this.db.candidate));
  }

  async getCandidatePreferences(candidateId?: string): Promise<CandidatePreferences | null> {
    const id = candidateId || this.db.candidate.id;
    if (!this.db.preferences) this.db.preferences = {};
    const prefs = this.db.preferences[id] || this.db.candidate.preferences;
    return prefs ? JSON.parse(JSON.stringify(prefs)) : null;
  }

  async updateCandidatePreferences(
    updates: Partial<CandidatePreferences>,
    candidateId?: string
  ): Promise<CandidatePreferences> {
    const id = candidateId || this.db.candidate.id;
    if (!this.db.preferences) this.db.preferences = {};
    const current = this.db.preferences[id] || {
      targetRoles: [],
      preferredLocations: [],
      workArrangements: ['remote'],
      currency: 'USD'
    };
    this.db.preferences[id] = { ...current, ...updates };
    return JSON.parse(JSON.stringify(this.db.preferences[id]));
  }

  // --- Jobs Catalog & Isolation ---
  async getJobs(
    filters?: JobFilters,
    candidateId?: string
  ): Promise<(Job & { match?: JobMatch | null; applicationStatus?: ApplicationStatus | null })[]> {
    let result = [...this.db.jobs];
    const candId = candidateId || this.db.candidate.id;

    // Filter candidate-private vs public jobs:
    // Only return jobs that are either public OR imported by the requesting candidate
    result = result.filter((j) => {
      if (j.isPublic === false) {
        return j.importedByCandidateId === candId;
      }
      return true;
    });

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q)
      );
    }

    if (filters?.source && filters.source !== 'all') {
      result = result.filter((j) => j.source === filters.source);
    }

    if (filters?.workArrangement && filters.workArrangement !== 'all') {
      result = result.filter((j) => j.workArrangement === filters.workArrangement);
    }

    // Attach matches & application status
    const mapped = result.map((j) => {
      const match = this.db.matches.find((m) => m.jobId === j.id) || null;
      const app = this.db.applications.find(
        (a) => a.jobId === j.id && a.candidateId === candId && !a.isArchived
      );
      return {
        ...j,
        match,
        applicationStatus: app ? app.status : null
      };
    });

    if (filters?.status && filters.status !== 'all') {
      return mapped.filter((j) => {
        if (filters.status === 'not_applied') return !j.applicationStatus;
        return j.applicationStatus === filters.status;
      });
    }

    if (filters?.minMatch) {
      return mapped.filter((j) => (j.match?.score || 0) >= (filters.minMatch || 0));
    }

    if (filters?.sort) {
      if (filters.sort === 'match') {
        mapped.sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0));
      } else if (filters.sort === 'company') {
        mapped.sort((a, b) => a.company.localeCompare(b.company));
      } else if (filters.sort === 'recent') {
        mapped.sort(
          (a, b) => new Date(b.normalizedAt).getTime() - new Date(a.normalizedAt).getTime()
        );
      }
    }

    return JSON.parse(JSON.stringify(mapped));
  }

  async getJobById(id: string, candidateId?: string): Promise<Job | null> {
    const job = this.db.jobs.find((j) => j.id === id);
    if (!job) return null;
    const candId = candidateId || this.db.candidate.id;
    if (job.isPublic === false && job.importedByCandidateId !== candId) {
      return null;
    }
    return JSON.parse(JSON.stringify(job));
  }

  async getJobAnalysis(jobId: string): Promise<JobAnalysis | null> {
    const analysis = this.db.analyses.find((a) => a.jobId === jobId);
    return analysis ? JSON.parse(JSON.stringify(analysis)) : null;
  }

  async saveJobAnalysis(analysis: JobAnalysis): Promise<JobAnalysis> {
    const idx = this.db.analyses.findIndex((a) => a.jobId === analysis.jobId);
    if (idx >= 0) {
      this.db.analyses[idx] = analysis;
    } else {
      this.db.analyses.push(analysis);
    }
    return JSON.parse(JSON.stringify(analysis));
  }

  async getJobMatch(jobId: string, _candidateId?: string): Promise<JobMatch | null> {
    const match = this.db.matches.find((m) => m.jobId === jobId);
    return match ? JSON.parse(JSON.stringify(match)) : null;
  }

  async saveJobMatch(match: JobMatch, _candidateId?: string): Promise<JobMatch> {
    const idx = this.db.matches.findIndex((m) => m.jobId === match.jobId);
    if (idx >= 0) {
      this.db.matches[idx] = match;
    } else {
      this.db.matches.push(match);
    }
    return JSON.parse(JSON.stringify(match));
  }

  async importJobByUrl(
    url: string,
    force?: boolean,
    candidateId?: string
  ): Promise<ImportJobResponse> {
    const candId = candidateId || this.db.candidate.id;

    // Upfront exact duplicate check on (source, normalizedUrl) before performing network request
    const detection = detectSource(url);
    const normalizedUrl = normalizeJobUrl(url);
    const sourceKey = detection.source === 'unsupported' ? 'unknown' : detection.source;

    if (!force) {
      const existingRef = this.jobSourceReferences.find(
        (ref) => ref.source === sourceKey && ref.normalizedUrl === normalizedUrl
      );

      if (existingRef) {
        const existingJob = this.db.jobs.find((j) => j.id === existingRef.jobId);
        const analysis = this.db.analyses.find((a) => a.jobId === existingRef.jobId);
        const match = this.db.matches.find(
          (m) => m.jobId === existingRef.jobId && m.candidateId === candId
        );

        return {
          success: false,
          isDuplicate: true,
          duplicateTier: 'exact_match',
          duplicateGroupId: existingJob?.duplicateGroupId,
          existingJob,
          job: existingJob,
          sourceReference: JSON.parse(JSON.stringify(existingRef)),
          analysis,
          match,
          adapterName: detection.source === 'manual' ? 'Manual Job Text' : detection.source,
          error: 'A matching job already exists in your workspace.'
        };
      }
    }

    // 1. Run Ingestion Pipeline
    const ingestResult = await ingestJobFromUrl({
      url,
      force,
      allowHttpForTesting: true
    });

    if (ingestResult.error || !ingestResult.data) {
      return {
        success: false,
        error: ingestResult.error || 'Failed to import job from the provided URL.',
        adapterName: ingestResult.adapterName
      };
    }

    const norm = ingestResult.data;

    // 2. Post-fetch exact duplicate check: (source, normalizedUrl) or (source, sourceJobId)
    let existingRef = this.jobSourceReferences.find(
      (ref) => ref.source === norm.source && ref.normalizedUrl === norm.normalizedUrl
    );

    if (!existingRef && norm.sourceJobId) {
      existingRef = this.jobSourceReferences.find(
        (ref) => ref.source === norm.source && ref.sourceJobId === norm.sourceJobId
      );
    }

    if (existingRef && !force) {
      const existingJob = this.db.jobs.find((j) => j.id === existingRef.jobId);
      const analysis = this.db.analyses.find((a) => a.jobId === existingRef.jobId);
      const match = this.db.matches.find(
        (m) => m.jobId === existingRef.jobId && m.candidateId === candId
      );

      return {
        success: false,
        isDuplicate: true,
        duplicateTier: 'exact_match',
        duplicateGroupId: existingJob?.duplicateGroupId,
        existingJob,
        job: existingJob,
        sourceReference: JSON.parse(JSON.stringify(existingRef)),
        analysis,
        match,
        adapterName: ingestResult.adapterName,
        error: 'A matching job already exists in your workspace.'
      };
    }

    // 3. Cross-Source Deduplication Check (Phase 7C Tier 2 / 3 / 4)
    const candidateJobs = await this.findDuplicateCandidates(norm.company, norm.title, candId);
    const dedupEval = evaluateDeduplication(norm, candidateJobs);

    // --- CASE A: Strong Duplicate (Tier 2) ---
    if (dedupEval.tier === 'strong_duplicate' && dedupEval.canonicalJob && !force) {
      const canonicalJob = dedupEval.canonicalJob;
      const groupId = canonicalJob.duplicateGroupId || `dup-group-${canonicalJob.id}`;

      if (!canonicalJob.duplicateGroupId) {
        await this.updateJobDuplicateGroup(canonicalJob.id, groupId);
        canonicalJob.duplicateGroupId = groupId;
      }

      const existingRefs = await this.getJobSourceReferences(canonicalJob.id);
      const currentPrimary = existingRefs.find((r) => r.isPrimary);
      const incomingStatus = norm.sourceStatus || 'active';
      const shouldPromote =
        incomingStatus !== 'closed' && shouldPromoteNewSource(norm.source, currentPrimary);

      const newRef = await this.addJobSourceReference({
        jobId: canonicalJob.id,
        source: norm.source,
        sourceJobId: norm.sourceJobId || null,
        sourceUrl: norm.sourceUrl,
        normalizedUrl: norm.normalizedUrl,
        sourceStatus: incomingStatus,
        verificationStatus: 'verified_accessible',
        lastVerifiedAt: new Date(),
        lastVerificationError: norm.closeReason || null,
        isPrimary: shouldPromote,
        referenceRole: shouldPromote ? 'primary' : 'alternative',
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      });

      let analysis = await this.getJobAnalysis(canonicalJob.id);
      if (!analysis) {
        analysis = await analysisService.analyzeJob(canonicalJob);
        await this.saveJobAnalysis(analysis);
      }

      let match = await this.getJobMatch(canonicalJob.id, candId);
      if (!match) {
        const candidateProfile = await this.getCandidateProfile(candId);
        if (candidateProfile) {
          match = await matchService.calculateMatch(canonicalJob, analysis, candidateProfile);
          await this.saveJobMatch(match, candId);
        }
      }

      const updatedCanonicalJob = await this.getJobById(canonicalJob.id, candId);

      return {
        success: true,
        isDuplicate: true,
        duplicateTier: 'strong_duplicate',
        duplicateGroupId: groupId,
        existingJob: canonicalJob,
        job: updatedCanonicalJob || canonicalJob,
        sourceReference: newRef,
        analysis: analysis || undefined,
        match: match || undefined,
        adapterName: ingestResult.adapterName,
        evidence: dedupEval.evidence,
        possibleDuplicates: dedupEval.possibleDuplicates
      };
    }

    // --- CASE B: Unique (Tier 4) or Possible Duplicate (Tier 3) ---
    const newJob: Job = {
      id: `job-import-${Date.now()}`,
      title: norm.title,
      company: norm.company,
      location: norm.location,
      workArrangement: norm.workArrangement,
      description: norm.description,
      responsibilities: norm.responsibilities,
      requiredSkills: norm.requiredSkills,
      preferredSkills: norm.preferredSkills,
      experienceRequirement: norm.experienceRequirement || undefined,
      educationRequirement: norm.educationRequirement || undefined,
      salary:
        norm.salaryMin || norm.salaryMax
          ? {
              min: norm.salaryMin || undefined,
              max: norm.salaryMax || undefined,
              currency: norm.salaryCurrency || undefined,
              interval: (norm.salaryInterval as 'yearly' | 'monthly' | 'hourly') || undefined
            }
          : undefined,
      postedDate: norm.postedDate || undefined,
      source: norm.source,
      originalUrl: norm.sourceUrl,
      jobStatus: norm.sourceStatus === 'closed' ? 'closed' : 'active',
      normalizedAt: new Date().toISOString(),
      isPublic: false,
      importedByCandidateId: candId,
      extractionQuality: norm.extractionQuality,
      extractionQualityReasons: norm.extractionQualityReasons
    };

    this.db.jobs.push(newJob);

    const now = new Date();
    const newRef: JobSourceReference = {
      id: `ref-${Date.now()}`,
      jobId: newJob.id,
      source: norm.source,
      sourceJobId: norm.sourceJobId || null,
      sourceUrl: norm.sourceUrl,
      normalizedUrl: norm.normalizedUrl,
      sourceStatus: norm.sourceStatus || 'active',
      verificationStatus: 'verified_accessible',
      lastVerifiedAt: now,
      lastVerificationError: norm.closeReason || null,
      isPrimary: true,
      referenceRole: 'primary',
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now
    };

    // Promote new reference, demote any existing primary for this job
    for (const ref of this.jobSourceReferences) {
      if (ref.jobId === newJob.id && ref.isPrimary) {
        ref.isPrimary = false;
        ref.referenceRole = 'alternative';
      }
    }
    this.jobSourceReferences.push(newRef);

    // 4. Trigger Analysis
    let analysis: JobAnalysis;
    try {
      analysis = await analysisService.analyzeJob(newJob);
      await this.saveJobAnalysis(analysis);
    } catch {
      analysis = {
        id: `analysis-${newJob.id}`,
        jobId: newJob.id,
        seniority: 'mid',
        roleCategory: 'Full-Stack Software Engineering',
        technicalRequirements: [...newJob.requiredSkills],
        softSkills: ['Collaboration', 'Communication'],
        importantKeywords: newJob.requiredSkills.slice(0, 4),
        extractedRequirements: newJob.requiredSkills.map((s, idx) => ({
          id: `req-${newJob.id}-${idx + 1}`,
          text: `Proficiency in ${s}`,
          category: 'required' as const,
          priority: 'high' as const
        })),
        analysisStatus: 'success'
      };
      await this.saveJobAnalysis(analysis);
    }

    // 5. Trigger Match if candidate exists
    let match: JobMatch | undefined;
    try {
      const candidateProfile = await this.getCandidateProfile(candId);
      if (candidateProfile) {
        match = await matchService.calculateMatch(newJob, analysis, candidateProfile);
        await this.saveJobMatch(match, candId);
      }
    } catch {
      // Match calculation failure does not fail job import
    }

    return {
      success: true,
      isDuplicate: false,
      duplicateTier: dedupEval.tier,
      job: newJob,
      sourceReference: newRef,
      analysis,
      match,
      adapterName: ingestResult.adapterName,
      possibleDuplicates: dedupEval.possibleDuplicates
    };
  }

  async importJobFromText(
    text: string,
    title?: string,
    company?: string,
    candidateId?: string
  ): Promise<ImportJobResponse> {
    const candId = candidateId || this.db.candidate.id;

    const ingestResult = await ingestJobFromManualText({
      text,
      title,
      company
    });

    if (ingestResult.error || !ingestResult.data) {
      return {
        success: false,
        error: ingestResult.error || 'Failed to parse manual job text.',
        adapterName: ingestResult.adapterName
      };
    }

    const norm = ingestResult.data;

    // Cross-Source Deduplication Check
    const candidateJobs = await this.findDuplicateCandidates(norm.company, norm.title, candId);
    const dedupEval = evaluateDeduplication(norm, candidateJobs);

    // --- CASE A: Strong Duplicate (Tier 2) ---
    if (dedupEval.tier === 'strong_duplicate' && dedupEval.canonicalJob) {
      const canonicalJob = dedupEval.canonicalJob;
      const groupId = canonicalJob.duplicateGroupId || `dup-group-${canonicalJob.id}`;

      if (!canonicalJob.duplicateGroupId) {
        await this.updateJobDuplicateGroup(canonicalJob.id, groupId);
        canonicalJob.duplicateGroupId = groupId;
      }

      const existingRefs = await this.getJobSourceReferences(canonicalJob.id);
      const currentPrimary = existingRefs.find((r) => r.isPrimary);
      const shouldPromote = shouldPromoteNewSource('manual', currentPrimary);

      const newRef = await this.addJobSourceReference({
        jobId: canonicalJob.id,
        source: 'manual',
        sourceJobId: null,
        sourceUrl: norm.sourceUrl,
        normalizedUrl: norm.normalizedUrl,
        sourceStatus: 'active',
        verificationStatus: 'verified_accessible',
        lastVerifiedAt: new Date(),
        lastVerificationError: null,
        isPrimary: shouldPromote,
        referenceRole: shouldPromote ? 'primary' : 'alternative',
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      });

      let analysis = await this.getJobAnalysis(canonicalJob.id);
      if (!analysis) {
        analysis = await analysisService.analyzeJob(canonicalJob);
        await this.saveJobAnalysis(analysis);
      }

      let match = await this.getJobMatch(canonicalJob.id, candId);
      if (!match) {
        const candidateProfile = await this.getCandidateProfile(candId);
        if (candidateProfile) {
          match = await matchService.calculateMatch(canonicalJob, analysis, candidateProfile);
          await this.saveJobMatch(match, candId);
        }
      }

      const updatedCanonicalJob = await this.getJobById(canonicalJob.id, candId);

      return {
        success: true,
        isDuplicate: true,
        duplicateTier: 'strong_duplicate',
        duplicateGroupId: groupId,
        existingJob: canonicalJob,
        job: updatedCanonicalJob || canonicalJob,
        sourceReference: newRef,
        analysis: analysis || undefined,
        match: match || undefined,
        adapterName: ingestResult.adapterName,
        evidence: dedupEval.evidence,
        possibleDuplicates: dedupEval.possibleDuplicates
      };
    }

    // --- CASE B: Unique (Tier 4) or Possible Duplicate (Tier 3) ---
    const newJob: Job = {
      id: `job-import-${Date.now()}`,
      title: norm.title,
      company: norm.company,
      location: norm.location,
      workArrangement: norm.workArrangement,
      description: norm.description,
      responsibilities: norm.responsibilities,
      requiredSkills: norm.requiredSkills,
      preferredSkills: norm.preferredSkills,
      experienceRequirement: norm.experienceRequirement || undefined,
      educationRequirement: norm.educationRequirement || undefined,
      salary:
        norm.salaryMin || norm.salaryMax
          ? {
              min: norm.salaryMin || undefined,
              max: norm.salaryMax || undefined,
              currency: norm.salaryCurrency || undefined,
              interval: (norm.salaryInterval as 'yearly' | 'monthly' | 'hourly') || undefined
            }
          : undefined,
      postedDate: norm.postedDate || undefined,
      source: 'manual',
      originalUrl: norm.sourceUrl,
      jobStatus: 'active',
      normalizedAt: new Date().toISOString(),
      isPublic: false,
      importedByCandidateId: candId,
      extractionQuality: norm.extractionQuality,
      extractionQualityReasons: norm.extractionQualityReasons
    };

    this.db.jobs.push(newJob);

    const now = new Date();
    const newRef: JobSourceReference = {
      id: `ref-${Date.now()}`,
      jobId: newJob.id,
      source: 'manual',
      sourceJobId: null,
      sourceUrl: norm.sourceUrl,
      normalizedUrl: norm.normalizedUrl,
      sourceStatus: 'active',
      verificationStatus: 'verified_accessible',
      lastVerifiedAt: now,
      lastVerificationError: null,
      isPrimary: true,
      referenceRole: 'primary',
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now
    };

    this.jobSourceReferences.push(newRef);

    let analysis: JobAnalysis;
    try {
      analysis = await analysisService.analyzeJob(newJob);
      await this.saveJobAnalysis(analysis);
    } catch {
      analysis = {
        id: `analysis-${newJob.id}`,
        jobId: newJob.id,
        seniority: 'mid',
        roleCategory: 'Full-Stack Software Engineering',
        technicalRequirements: [...newJob.requiredSkills],
        softSkills: ['Collaboration', 'Communication'],
        importantKeywords: newJob.requiredSkills.slice(0, 4),
        extractedRequirements: newJob.requiredSkills.map((s, idx) => ({
          id: `req-${newJob.id}-${idx + 1}`,
          text: `Proficiency in ${s}`,
          category: 'required' as const,
          priority: 'high' as const
        })),
        analysisStatus: 'success'
      };
      await this.saveJobAnalysis(analysis);
    }

    let match: JobMatch | undefined;
    try {
      const candidateProfile = await this.getCandidateProfile(candId);
      if (candidateProfile) {
        match = await matchService.calculateMatch(newJob, analysis, candidateProfile);
        await this.saveJobMatch(match, candId);
      }
    } catch {
      // Match calculation failure does not fail job import
    }

    return {
      success: true,
      isDuplicate: false,
      duplicateTier: dedupEval.tier,
      job: newJob,
      sourceReference: newRef,
      analysis,
      match,
      adapterName: ingestResult.adapterName,
      possibleDuplicates: dedupEval.possibleDuplicates
    };
  }

  async addJob(
    jobData: Omit<Job, 'id' | 'normalizedAt'> & {
      isPublic?: boolean;
      importedByCandidateId?: string;
    },
    candidateId?: string
  ): Promise<Job> {
    const newJob: Job = {
      ...jobData,
      id: `job-${Date.now()}`,
      normalizedAt: new Date().toISOString(),
      ...(candidateId
        ? { importedByCandidateId: candidateId, isPublic: jobData.isPublic ?? false }
        : {})
    } as Job;

    this.db.jobs.push(newJob);
    return JSON.parse(JSON.stringify(newJob));
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
    const idx = this.db.jobs.findIndex((j) => j.id === id);
    if (idx === -1) throw new Error(`Job ${id} not found`);

    this.db.jobs[idx] = {
      ...this.db.jobs[idx],
      ...updates
    };
    return JSON.parse(JSON.stringify(this.db.jobs[idx]));
  }

  // --- Phase 7A: Job Discovery, Source References & Candidate State ---

  async getJobSourceReferences(jobId: string): Promise<JobSourceReference[]> {
    const refs = this.jobSourceReferences
      .filter((r) => r.jobId === jobId)
      .toSorted((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime();
      });
    return JSON.parse(JSON.stringify(refs));
  }

  async addJobSourceReference(
    reference: Omit<JobSourceReference, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<JobSourceReference> {
    const existing = this.jobSourceReferences.find(
      (r) => r.source === reference.source && r.normalizedUrl === reference.normalizedUrl
    );
    if (existing) {
      throw new Error(
        `Job source reference for ${reference.source} and ${reference.normalizedUrl} already exists`
      );
    }

    if (reference.isPrimary) {
      for (const r of this.jobSourceReferences) {
        if (r.jobId === reference.jobId && r.isPrimary) {
          r.isPrimary = false;
          r.referenceRole = 'alternative';
          r.updatedAt = new Date();
        }
      }
    }

    const newRef: JobSourceReference = {
      ...reference,
      id: `jsr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceJobId: reference.sourceJobId || null,
      sourceStatus: reference.sourceStatus || 'active',
      verificationStatus: reference.verificationStatus || 'unverified',
      lastVerifiedAt: reference.lastVerifiedAt ? new Date(reference.lastVerifiedAt) : null,
      lastVerificationError: reference.lastVerificationError || null,
      isPrimary: reference.isPrimary ?? false,
      referenceRole: reference.referenceRole || (reference.isPrimary ? 'primary' : 'alternative'),
      firstSeenAt: reference.firstSeenAt ? new Date(reference.firstSeenAt) : new Date(),
      lastSeenAt: reference.lastSeenAt ? new Date(reference.lastSeenAt) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.jobSourceReferences.push(newRef);
    return JSON.parse(JSON.stringify(newRef));
  }

  async setPrimaryJobSourceReference(jobId: string, referenceId: string): Promise<void> {
    const target = this.jobSourceReferences.find((r) => r.id === referenceId && r.jobId === jobId);
    if (!target) {
      throw new Error(`Job source reference ${referenceId} does not belong to job ${jobId}`);
    }

    if (target.sourceStatus === 'closed') {
      throw new Error(`Cannot set closed source reference ${referenceId} as primary`);
    }

    for (const r of this.jobSourceReferences) {
      if (r.jobId === jobId && r.isPrimary) {
        r.isPrimary = false;
        r.referenceRole = 'alternative';
        r.updatedAt = new Date();
      }
    }

    target.isPrimary = true;
    target.referenceRole = 'primary';
    target.updatedAt = new Date();
  }

  async getCandidateJobState(
    jobId: string,
    candidateId: string
  ): Promise<CandidateJobState | null> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getCandidateJobState');
    }
    const state = this.candidateJobStates.get(`${candidateId}:${jobId}`);
    return state ? JSON.parse(JSON.stringify(state)) : null;
  }

  async setCandidateJobState(
    jobId: string,
    status: CandidateJobStatus,
    candidateId: string,
    dismissedReason?: string
  ): Promise<CandidateJobState> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for setCandidateJobState');
    }

    const key = `${candidateId}:${jobId}`;
    const existing = this.candidateJobStates.get(key);
    const prevStatus: CandidateJobStatus = existing ? existing.status : 'UNSEEN';
    this.previousJobStates.set(key, prevStatus);

    const now = new Date();

    if (!existing) {
      const firstViewedAt =
        status === 'VIEWED' || status === 'SAVED' || status === 'DISMISSED' ? now : null;
      const savedAt = status === 'SAVED' ? now : null;
      const dismissedAt = status === 'DISMISSED' ? now : null;

      const newState: CandidateJobState = {
        id: `cjs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        candidateId,
        jobId,
        status,
        dismissedReason: status === 'DISMISSED' ? dismissedReason || null : null,
        firstViewedAt,
        savedAt,
        dismissedAt,
        createdAt: now,
        updatedAt: now
      };
      this.candidateJobStates.set(key, newState);
      return JSON.parse(JSON.stringify(newState));
    }

    const firstViewedAt =
      existing.firstViewedAt ||
      (status === 'VIEWED' || status === 'SAVED' || status === 'DISMISSED' ? now : null);
    let savedAt = existing.savedAt;
    let dismissedAt = existing.dismissedAt;
    let reason = existing.dismissedReason;

    if (status === 'SAVED') {
      savedAt = now;
      dismissedAt = null;
      reason = null;
    } else if (status === 'DISMISSED') {
      dismissedAt = now;
      reason = dismissedReason || null;
      savedAt = null;
    } else if (status === 'VIEWED') {
      savedAt = null;
      dismissedAt = null;
      reason = null;
    }

    const updated: CandidateJobState = {
      ...existing,
      status,
      dismissedReason: reason,
      firstViewedAt,
      savedAt,
      dismissedAt,
      updatedAt: now
    };
    this.candidateJobStates.set(key, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  async undoCandidateJobState(
    jobId: string,
    candidateId: string,
    targetPreviousState?: CandidateJobStatus
  ): Promise<CandidateJobState | null> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for undoCandidateJobState');
    }

    const key = `${candidateId}:${jobId}`;
    const existing = this.candidateJobStates.get(key);

    if (!existing || existing.status !== 'DISMISSED') {
      return existing ? JSON.parse(JSON.stringify(existing)) : null;
    }

    const target = targetPreviousState || this.previousJobStates.get(key) || 'UNSEEN';

    if (target === 'UNSEEN') {
      this.candidateJobStates.delete(key);
      this.previousJobStates.delete(key);
      return null;
    }

    if (target === 'SAVED') {
      const now = new Date();
      existing.status = 'SAVED';
      existing.savedAt = now;
      existing.dismissedAt = null;
      existing.dismissedReason = null;
      existing.updatedAt = now;
      this.previousJobStates.set(key, 'SAVED');
      return JSON.parse(JSON.stringify(existing));
    }

    if (target === 'VIEWED') {
      const now = new Date();
      existing.status = 'VIEWED';
      existing.dismissedAt = null;
      existing.dismissedReason = null;
      existing.updatedAt = now;
      this.previousJobStates.set(key, 'VIEWED');
      return JSON.parse(JSON.stringify(existing));
    }

    return JSON.parse(JSON.stringify(existing));
  }

  async getSavedSearches(candidateId: string): Promise<SavedSearch[]> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getSavedSearches');
    }
    const searches = this.savedSearches
      .filter((s) => s.candidateId === candidateId)
      .toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return JSON.parse(JSON.stringify(searches));
  }

  async getSavedSearchById(id: string, candidateId: string): Promise<SavedSearch | null> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getSavedSearchById');
    }
    const search = this.savedSearches.find((s) => s.id === id && s.candidateId === candidateId);
    return search ? JSON.parse(JSON.stringify(search)) : null;
  }

  async saveSavedSearch(
    search: Partial<Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt' | 'candidateId'>> & {
      id?: string;
      candidateId?: string;
      name?: string;
    },
    candidateId: string
  ): Promise<SavedSearch> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for saveSavedSearch');
    }

    const now = new Date();

    if (search.id) {
      const idx = this.savedSearches.findIndex(
        (s) => s.id === search.id && s.candidateId === candidateId
      );
      if (idx === -1) {
        throw new Error(`Saved search ${search.id} not found or access denied`);
      }
      const existing = this.savedSearches[idx];

      // Optimistic concurrency check
      if (search.filterVersion && search.filterVersion !== existing.filterVersion) {
        throw new Error(
          `Concurrency conflict: Saved search version ${search.filterVersion} does not match current version ${existing.filterVersion}`
        );
      }

      const definitionChanged =
        (search.name !== undefined && search.name !== existing.name) ||
        (search.query !== undefined && search.query !== existing.query) ||
        (search.locations !== undefined &&
          JSON.stringify(search.locations) !== JSON.stringify(existing.locations)) ||
        (search.workArrangements !== undefined &&
          JSON.stringify(search.workArrangements) !== JSON.stringify(existing.workArrangements)) ||
        (search.roleCategories !== undefined &&
          JSON.stringify(search.roleCategories) !== JSON.stringify(existing.roleCategories)) ||
        (search.seniorityLevels !== undefined &&
          JSON.stringify(search.seniorityLevels) !== JSON.stringify(existing.seniorityLevels)) ||
        (search.minSalary !== undefined && search.minSalary !== existing.minSalary) ||
        (search.currency !== undefined && search.currency !== existing.currency) ||
        (search.alertFrequency !== undefined &&
          search.alertFrequency !== existing.alertFrequency) ||
        (search.minMatchScore !== undefined && search.minMatchScore !== existing.minMatchScore);

      let nextVersion = existing.filterVersion;
      if (definitionChanged) {
        const currentVerNum = parseFloat(existing.filterVersion) || 1.0;
        nextVersion = (Math.round((currentVerNum + 0.1) * 10) / 10).toFixed(1);
      }

      const updated: SavedSearch = {
        ...existing,
        name: search.name !== undefined ? search.name : existing.name,
        query: search.query || null,
        locations: search.locations || [],
        workArrangements: search.workArrangements || [],
        roleCategories: search.roleCategories || [],
        seniorityLevels: search.seniorityLevels || [],
        minSalary: search.minSalary || null,
        currency: search.currency || null,
        alertFrequency: search.alertFrequency || 'weekly',
        filterVersion: nextVersion,
        isEnabled: search.isEnabled !== undefined ? search.isEnabled : existing.isEnabled,
        minMatchScore:
          search.minMatchScore !== undefined ? search.minMatchScore : existing.minMatchScore,
        lastExecutedAt: search.lastExecutedAt
          ? new Date(search.lastExecutedAt)
          : existing.lastExecutedAt,
        lastMatchCount:
          search.lastMatchCount !== undefined ? search.lastMatchCount : existing.lastMatchCount,
        updatedAt: now
      };
      this.savedSearches[idx] = updated;
      return JSON.parse(JSON.stringify(updated));
    }

    const created: SavedSearch = {
      id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      candidateId,
      name: search.name || 'Untitled Saved Search',
      query: search.query || null,
      locations: search.locations || [],
      workArrangements: search.workArrangements || [],
      roleCategories: search.roleCategories || [],
      seniorityLevels: search.seniorityLevels || [],
      minSalary: search.minSalary || null,
      currency: search.currency || null,
      alertFrequency: search.alertFrequency || 'weekly',
      filterVersion: search.filterVersion || '1.0',
      isEnabled: search.isEnabled !== undefined ? search.isEnabled : true,
      minMatchScore: search.minMatchScore || null,
      lastExecutedAt: search.lastExecutedAt ? new Date(search.lastExecutedAt) : null,
      lastMatchCount: search.lastMatchCount || 0,
      createdAt: now,
      updatedAt: now
    };
    this.savedSearches.push(created);
    return JSON.parse(JSON.stringify(created));
  }

  async enableSavedSearch(id: string, candidateId: string): Promise<SavedSearch> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for enableSavedSearch');
    }
    const idx = this.savedSearches.findIndex((s) => s.id === id && s.candidateId === candidateId);
    if (idx === -1) {
      throw new Error(`Saved search ${id} not found or access denied`);
    }
    const updated: SavedSearch = {
      ...this.savedSearches[idx],
      isEnabled: true,
      updatedAt: new Date()
    };
    this.savedSearches[idx] = updated;
    return JSON.parse(JSON.stringify(updated));
  }

  async disableSavedSearch(id: string, candidateId: string): Promise<SavedSearch> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for disableSavedSearch');
    }
    const idx = this.savedSearches.findIndex((s) => s.id === id && s.candidateId === candidateId);
    if (idx === -1) {
      throw new Error(`Saved search ${id} not found or access denied`);
    }
    const updated: SavedSearch = {
      ...this.savedSearches[idx],
      isEnabled: false,
      updatedAt: new Date()
    };
    this.savedSearches[idx] = updated;
    return JSON.parse(JSON.stringify(updated));
  }

  async deleteSavedSearch(id: string, candidateId: string): Promise<boolean> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for deleteSavedSearch');
    }
    const idx = this.savedSearches.findIndex((s) => s.id === id && s.candidateId === candidateId);
    if (idx === -1) return false;
    this.savedSearches.splice(idx, 1);
    return true;
  }

  async getEnabledSavedSearches(frequency?: string, candidateId?: string): Promise<SavedSearch[]> {
    return JSON.parse(
      JSON.stringify(
        this.savedSearches.filter(
          (s) =>
            s.isEnabled !== false &&
            (!frequency || s.alertFrequency === frequency) &&
            (!candidateId || s.candidateId === candidateId)
        )
      )
    );
  }

  // --- Phase 7E: Alerts & In-App Notifications ---

  async getSavedSearchAlerts(
    candidateId: string,
    savedSearchId?: string
  ): Promise<SavedSearchAlert[]> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getSavedSearchAlerts');
    }
    const alerts = this.savedSearchAlerts
      .filter(
        (a) =>
          a.candidateId === candidateId && (!savedSearchId || a.savedSearchId === savedSearchId)
      )
      .toSorted((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    return JSON.parse(JSON.stringify(alerts));
  }

  async createSavedSearchAlertAndNotification(params: {
    candidateId: string;
    savedSearchId: string;
    jobId: string;
    savedSearchVersion: string;
    notificationTitle: string;
    notificationMessage: string;
    generatedAt?: Date;
  }): Promise<{
    alert: SavedSearchAlert | null;
    notification: CandidateNotification | null;
    isNew: boolean;
  }> {
    const {
      candidateId,
      savedSearchId,
      jobId,
      savedSearchVersion,
      notificationTitle,
      notificationMessage,
      generatedAt
    } = params;

    if (!candidateId || !savedSearchId || !jobId) {
      throw new Error(
        'candidateId, savedSearchId, and jobId are required for createSavedSearchAlert'
      );
    }

    // Atomic deduplication check: [candidateId, savedSearchId, jobId]
    const existingAlert = this.savedSearchAlerts.find(
      (a) => a.candidateId === candidateId && a.savedSearchId === savedSearchId && a.jobId === jobId
    );

    if (existingAlert) {
      return {
        alert: JSON.parse(JSON.stringify(existingAlert)),
        notification: null,
        isNew: false
      };
    }

    const now = generatedAt || new Date();
    const newAlert: SavedSearchAlert = {
      id: `ssa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      candidateId,
      savedSearchId,
      jobId,
      savedSearchVersion,
      status: 'generated',
      generatedAt: now,
      deliveredAt: null
    };
    this.savedSearchAlerts.push(newAlert);

    const newNotification: CandidateNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      candidateId,
      type: 'SAVED_SEARCH_ALERT',
      title: notificationTitle,
      message: notificationMessage,
      relatedJobId: jobId,
      relatedSavedSearchId: savedSearchId,
      readAt: null,
      createdAt: now
    };
    this.candidateNotifications.push(newNotification);

    return {
      alert: JSON.parse(JSON.stringify(newAlert)),
      notification: JSON.parse(JSON.stringify(newNotification)),
      isNew: true
    };
  }

  async getNotifications(candidateId: string): Promise<CandidateNotification[]> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getNotifications');
    }
    const notifs = this.candidateNotifications
      .filter((n) => n.candidateId === candidateId)
      .toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return JSON.parse(JSON.stringify(notifs));
  }

  async markNotificationAsRead(id: string, candidateId: string): Promise<boolean> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for markNotificationAsRead');
    }
    const idx = this.candidateNotifications.findIndex(
      (n) => n.id === id && n.candidateId === candidateId
    );
    if (idx === -1) {
      return false;
    }
    this.candidateNotifications[idx] = {
      ...this.candidateNotifications[idx],
      readAt: new Date()
    };
    return true;
  }

  // --- Phase 7C: Deduplication & Source Intelligence ---

  async findDuplicateCandidates(
    company: string,
    title?: string,
    candidateId?: string
  ): Promise<Job[]> {
    const normCompany = normalizeCompany(company);
    const candId = candidateId || this.db.candidate.id;

    // Filter candidate-private vs public jobs:
    // Candidate isolation: Only return jobs that are either public OR imported by the requesting candidate
    return this.db.jobs
      .filter((j) => {
        const isAccessible = j.isPublic || j.importedByCandidateId === candId;
        if (!isAccessible) return false;

        const jCompanyNorm = normalizeCompany(j.company);
        return (
          jCompanyNorm.includes(normCompany) ||
          normCompany.includes(jCompanyNorm) ||
          j.company.toLowerCase() === company.toLowerCase()
        );
      })
      .map((j) => JSON.parse(JSON.stringify(j)));
  }

  async updateJobDuplicateGroup(jobId: string, duplicateGroupId: string): Promise<void> {
    const job = this.db.jobs.find((j) => j.id === jobId);
    if (job) {
      job.duplicateGroupId = duplicateGroupId;
    }
  }

  async updateJobStatus(jobId: string, jobStatus: string): Promise<void> {
    const job = this.db.jobs.find((j) => j.id === jobId);
    if (job) {
      job.jobStatus = jobStatus as Job['jobStatus'];
    }
  }

  async updateJobSourceReference(
    id: string,
    updates: Partial<
      Pick<
        JobSourceReference,
        | 'sourceStatus'
        | 'verificationStatus'
        | 'lastVerifiedAt'
        | 'lastVerificationError'
        | 'isPrimary'
        | 'referenceRole'
        | 'lastSeenAt'
      >
    >
  ): Promise<JobSourceReference> {
    const ref = this.jobSourceReferences.find((r) => r.id === id);
    if (!ref) {
      throw new Error(`Job source reference ${id} not found`);
    }

    if (updates.isPrimary) {
      for (const r of this.jobSourceReferences) {
        if (r.jobId === ref.jobId && r.id !== id && r.isPrimary) {
          r.isPrimary = false;
          r.referenceRole = 'alternative';
          r.updatedAt = new Date();
        }
      }
    }

    if (updates.sourceStatus !== undefined) ref.sourceStatus = updates.sourceStatus;
    if (updates.verificationStatus !== undefined)
      ref.verificationStatus = updates.verificationStatus;
    if (updates.lastVerifiedAt !== undefined)
      ref.lastVerifiedAt = updates.lastVerifiedAt ? new Date(updates.lastVerifiedAt) : null;
    if (updates.lastVerificationError !== undefined)
      ref.lastVerificationError = updates.lastVerificationError;
    if (updates.isPrimary !== undefined) ref.isPrimary = updates.isPrimary;
    if (updates.referenceRole !== undefined) ref.referenceRole = updates.referenceRole;
    if (updates.lastSeenAt !== undefined) ref.lastSeenAt = new Date(updates.lastSeenAt);
    ref.updatedAt = new Date();

    // Check aggregate job status if sourceStatus changed
    if (updates.sourceStatus) {
      const allRefs = this.jobSourceReferences.filter((r) => r.jobId === ref.jobId);
      const job = this.db.jobs.find((j) => j.id === ref.jobId);
      if (job) {
        const newStatus = aggregateJobStatus(allRefs, job.jobStatus);
        if (newStatus !== job.jobStatus) {
          job.jobStatus = newStatus;
        }
      }
    }

    return JSON.parse(JSON.stringify(ref));
  }

  async fallbackPrimarySource(jobId: string): Promise<JobSourceReference | null> {
    const allRefs = this.jobSourceReferences.filter((r) => r.jobId === jobId);
    if (allRefs.length === 0) return null;

    const best = selectBestPrimarySource(allRefs);
    const job = this.db.jobs.find((j) => j.id === jobId);

    if (!best) {
      if (job) {
        const newStatus = aggregateJobStatus(allRefs, job.jobStatus);
        if (newStatus !== job.jobStatus) {
          job.jobStatus = newStatus;
        }
      }
      return null;
    }

    if (best.isPrimary) {
      return JSON.parse(JSON.stringify(best));
    }

    for (const r of this.jobSourceReferences) {
      if (r.jobId === jobId && r.isPrimary) {
        r.isPrimary = false;
        r.referenceRole = 'alternative';
        r.updatedAt = new Date();
      }
    }

    best.isPrimary = true;
    best.referenceRole = 'primary';
    best.updatedAt = new Date();

    if (job) {
      const newStatus = aggregateJobStatus(allRefs, job.jobStatus);
      if (newStatus !== job.jobStatus) {
        job.jobStatus = newStatus;
      }
    }

    return JSON.parse(JSON.stringify(best));
  }

  // --- Phase 7D: Opportunity Priority & Discovery Ranking ---

  async getDiscoveryRanking(
    params: DiscoveryRankingParams,
    candidateId: string
  ): Promise<DiscoveryRankingResponse> {
    const candId = candidateId || this.db.candidate.id;

    const pageSize = Math.min(
      Math.max(1, params.pageSize || DEFAULT_DISCOVERY_PAGE_SIZE),
      MAX_DISCOVERY_PAGE_SIZE
    );

    // 1. Fetch Candidate Preferences for context and fit calculation
    const preferences = await this.getCandidatePreferences(candId);

    const filterParts: string[] = [];
    if (params.tab) filterParts.push(`t:${params.tab}`);
    if (params.search && params.search.trim()) filterParts.push(`q:${params.search.trim()}`);
    if (params.workArrangement && params.workArrangement !== 'all')
      filterParts.push(`w:${params.workArrangement}`);
    if (params.source && params.source !== 'all') filterParts.push(`s:${params.source}`);
    if (params.minMatch !== undefined && params.minMatch !== null)
      filterParts.push(`m:${params.minMatch}`);
    if (params.stateFilter && params.stateFilter !== 'all')
      filterParts.push(`st:${params.stateFilter}`);
    if (params.includeDismissed) filterParts.push('id:1');
    if (params.sort && params.sort !== 'priority') filterParts.push(`sort:${params.sort}`);

    const filterContext = filterParts.length > 0 ? filterParts.join(';') : undefined;

    const rankingContextKey = buildRankingContextKey(
      candId,
      preferences,
      DEFAULT_RANKING_CONFIG.version,
      filterContext
    );

    // 2. Decode & validate cursor if provided
    let cursorPayload: DiscoveryRankingCursorPayload | null = null;
    let cursorReset = false;

    if (params.cursor) {
      const decoded = decodeCursor(params.cursor, rankingContextKey);
      if (decoded.isContextMismatch) {
        cursorReset = true;
        cursorPayload = null;
      } else if (decoded.error) {
        throw new Error(`Invalid pagination cursor: ${decoded.error}`);
      } else {
        cursorPayload = decoded.payload;
      }
    }

    // 3. Candidate isolation & active jobs filter
    const jobs = this.db.jobs.filter((j) => {
      if (j.isPublic === false && j.importedByCandidateId !== candId) return false;

      const status = j.jobStatus || 'active';
      if (status !== 'active') return false;

      if (params.workArrangement && params.workArrangement !== 'all') {
        if (j.workArrangement !== params.workArrangement) return false;
      }

      return true;
    });

    // 4. Evaluation Time Snapshot & Usability Gate
    // If a cursor is present, reuse its evaluatedAt timestamp so that freshness scores remain
    // strictly stable across pagination pages. Otherwise establish one server-side evaluation time.
    const evaluationDate = cursorPayload ? new Date(cursorPayload.e) : new Date();
    const evaluatedAtIso = evaluationDate.toISOString();

    const eligibleOpportunities: RankedOpportunity[] = [];

    for (const job of jobs) {
      const sources = this.jobSourceReferences.filter((r) => r.jobId === job.id);
      const hasUsableSource = sources.some((s) => isSourceUsable(s, evaluationDate));

      const match =
        this.db.matches.find((m) => m.jobId === job.id && m.candidateId === candId) || null;
      const primarySource = sources.find((s) => s.isPrimary) || sources[0] || null;
      const candidateState = this.candidateJobStates.get(`${candId}:${job.id}`) || null;
      const app = this.db.applications.find((a) => a.jobId === job.id && a.candidateId === candId);
      const applicationStatus = app ? app.status : null;

      // Tab semantics
      const tab = params.tab || 'recommended';
      if (tab === 'saved') {
        if (candidateState?.status !== 'SAVED') {
          continue;
        }
      } else if (tab === 'recommended') {
        // Exclude DISMISSED by default
        if (!params.includeDismissed && candidateState?.status === 'DISMISSED') {
          continue;
        }
        // Exclude without usable sources
        if (!hasUsableSource) {
          continue;
        }
      }

      // Explicit state filter
      if (params.stateFilter && params.stateFilter !== 'all') {
        if (params.stateFilter === 'saved' && candidateState?.status !== 'SAVED') continue;
        if (params.stateFilter === 'dismissed' && candidateState?.status !== 'DISMISSED') continue;
        if (params.stateFilter === 'viewed' && candidateState?.status !== 'VIEWED') continue;
        if (params.stateFilter === 'unseen' && candidateState && candidateState.status !== 'UNSEEN')
          continue;
      }

      // Minimum Match Score filter (JobMatch.score, NOT Preference Fit!)
      if (params.minMatch !== undefined && params.minMatch !== null && params.minMatch > 0) {
        const matchScore = match?.score ?? 0;
        if (matchScore < params.minMatch) {
          continue;
        }
      }

      // Source filter
      if (params.source && params.source.trim() && params.source !== 'all') {
        const sourceQuery = params.source.toLowerCase().trim();
        const hasMatchingSource = sources.some(
          (s) =>
            s.source.toLowerCase() === sourceQuery ||
            (s.sourceUrl && s.sourceUrl.toLowerCase().includes(sourceQuery))
        );
        if (!hasMatchingSource) {
          continue;
        }
      }

      // Deterministic search matching across normalized fields (title, company, location, skills)
      if (params.search && params.search.trim()) {
        const q = params.search.toLowerCase().trim();
        const inTitle = job.title.toLowerCase().includes(q);
        const inCompany = job.company.toLowerCase().includes(q);
        const inLocation = (job.location || '').toLowerCase().includes(q);
        const inDesc = (job.description || '').toLowerCase().includes(q);
        const inSkills =
          (job.requiredSkills || []).some((s) => s.toLowerCase().includes(q)) ||
          (job.preferredSkills || []).some((s) => s.toLowerCase().includes(q));
        if (!inTitle && !inCompany && !inLocation && !inSkills && !inDesc) {
          continue;
        }
      }

      const priority = calculateOpportunityPriority(
        job,
        candId,
        match,
        preferences,
        sources,
        DEFAULT_RANKING_CONFIG,
        evaluationDate
      );

      eligibleOpportunities.push({
        job: JSON.parse(JSON.stringify(job)),
        priority,
        match: match ? JSON.parse(JSON.stringify(match)) : null,
        primarySource: primarySource ? JSON.parse(JSON.stringify(primarySource)) : null,
        candidateState: candidateState ? JSON.parse(JSON.stringify(candidateState)) : null,
        applicationStatus
      });
    }

    // 5. Canonical Deterministic Discovery Ordering:
    // Recommended MUST always use Opportunity Priority
    const effectiveSort =
      params.tab === 'recommended' || !params.tab ? 'priority' : params.sort || 'priority';

    let sorted: RankedOpportunity[];
    if (effectiveSort === 'match_desc') {
      sorted = eligibleOpportunities.toSorted((a, b) => {
        const aMatch = a.match?.score ?? 0;
        const bMatch = b.match?.score ?? 0;
        if (bMatch !== aMatch) return bMatch - aMatch;
        return compareDiscoveryOrder(
          { priorityScore: a.priority.priorityScore, postedDate: a.job.postedDate, id: a.job.id },
          { priorityScore: b.priority.priorityScore, postedDate: b.job.postedDate, id: b.job.id }
        );
      });
    } else if (effectiveSort === 'recent') {
      sorted = eligibleOpportunities.toSorted((a, b) => {
        const aDate = a.job.postedDate ? new Date(a.job.postedDate).getTime() : 0;
        const bDate = b.job.postedDate ? new Date(b.job.postedDate).getTime() : 0;
        if (bDate !== aDate) return bDate - aDate;
        return compareDiscoveryOrder(
          { priorityScore: a.priority.priorityScore, postedDate: a.job.postedDate, id: a.job.id },
          { priorityScore: b.priority.priorityScore, postedDate: b.job.postedDate, id: b.job.id }
        );
      });
    } else {
      // 1. Priority DESC
      // 2. postedDate DESC NULLS LAST
      // 3. id ASC
      sorted = eligibleOpportunities.toSorted((a, b) =>
        compareDiscoveryOrder(
          { priorityScore: a.priority.priorityScore, postedDate: a.job.postedDate, id: a.job.id },
          { priorityScore: b.priority.priorityScore, postedDate: b.job.postedDate, id: b.job.id }
        )
      );
    }

    // 6. Keyset filtering strictly after cursor
    let filteredItems = sorted;
    if (cursorPayload) {
      if (effectiveSort === 'priority') {
        filteredItems = sorted.filter((item) =>
          isRowAfterCursor(
            {
              priorityScore: item.priority.priorityScore,
              postedDate: item.job.postedDate,
              id: item.job.id
            },
            cursorPayload!
          )
        );
      } else {
        const cursorIdx = sorted.findIndex((item) => item.job.id === cursorPayload!.i);
        if (cursorIdx >= 0) {
          filteredItems = sorted.slice(cursorIdx + 1);
        }
      }
    }

    // 7. Keyset pagination slice
    const pageItems = filteredItems.slice(0, pageSize);
    const hasMore = filteredItems.length > pageSize;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = encodeCursor({
        p: lastItem.priority.priorityScore,
        d: lastItem.job.postedDate ? new Date(lastItem.job.postedDate).toISOString() : null,
        i: lastItem.job.id,
        ctx: rankingContextKey,
        e: evaluatedAtIso
      });
    }

    return {
      items: pageItems,
      nextCursor,
      hasMore,
      totalEligible: sorted.length,
      rankingContextKey,
      evaluatedAt: evaluatedAtIso,
      cursorReset: cursorReset ? true : undefined
    };
  }

  // --- Candidate Knowledge Bank & Provenance ---
  private getCategoryCollectionKey(category: string): string | null {
    switch (category) {
      case 'skill':
        return 'skills';
      case 'experience':
        return 'experiences';
      case 'project':
        return 'projects';
      case 'education':
        return 'education';
      case 'certification':
        return 'certifications';
      case 'achievement':
        return 'achievements';
      default:
        return null;
    }
  }

  async getKnowledgeBank(candidateId?: string): Promise<CandidateKnowledgeBank> {
    const candId = candidateId || this.db.candidate.id;
    if (!this.db.knowledgeBank) {
      this.db.knowledgeBank = {
        id: `kb-${candId}`,
        candidateId: candId,
        skills: [],
        experiences: [],
        projects: [],
        education: [],
        certifications: [],
        achievements: [],
        updatedAt: new Date().toISOString()
      };
    }
    return JSON.parse(JSON.stringify(this.db.knowledgeBank));
  }

  async getKnowledgeItemById(itemId: string, candidateId?: string): Promise<KnowledgeItem | null> {
    const kb = await this.getKnowledgeBank(candidateId);
    const all = [
      ...kb.skills,
      ...kb.experiences,
      ...kb.projects,
      ...kb.education,
      ...kb.certifications,
      ...kb.achievements
    ];
    const found = all.find((i) => i.id === itemId);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async saveKnowledgeItem(item: KnowledgeItem, candidateId?: string): Promise<KnowledgeItem> {
    const candId = candidateId || this.db.candidate.id;
    await this.getKnowledgeBank(candId);

    const collectionKey = this.getCategoryCollectionKey(item.category);
    if (!collectionKey) throw new Error(`Unsupported category ${item.category}`);

    const collection = (this.db.knowledgeBank as unknown as Record<string, KnowledgeItem[]>)[
      collectionKey
    ];
    const idx = collection.findIndex((i) => i.id === item.id);

    const toSave: KnowledgeItem = {
      ...item,
      candidateId: candId,
      updatedAt: new Date().toISOString()
    };

    if (idx >= 0) {
      collection[idx] = toSave;
    } else {
      collection.push(toSave);
    }
    this.db.knowledgeBank.updatedAt = new Date().toISOString();

    return JSON.parse(JSON.stringify(toSave));
  }

  async updateKnowledgeItem(
    idOrItem: string | KnowledgeItem,
    updates?: Partial<KnowledgeItem>,
    candidateId?: string
  ): Promise<KnowledgeItem> {
    if (typeof idOrItem === 'string') {
      const existing = await this.getKnowledgeItemById(idOrItem, candidateId);
      if (!existing) throw new Error(`KnowledgeItem ${idOrItem} not found`);
      const merged: KnowledgeItem = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return this.saveKnowledgeItem(merged, candidateId);
    }
    return this.saveKnowledgeItem(idOrItem, candidateId);
  }

  async updateKnowledgeItemStatus(
    itemId: string,
    status: KnowledgeStatus,
    candidateId?: string
  ): Promise<KnowledgeItem> {
    const item = await this.getKnowledgeItemById(itemId, candidateId);
    if (!item) throw new Error(`KnowledgeItem ${itemId} not found`);
    item.status = status;
    item.updatedAt = new Date().toISOString();
    return this.saveKnowledgeItem(item, candidateId);
  }

  async deleteKnowledgeItem(itemId: string, candidateId?: string): Promise<boolean> {
    await this.getKnowledgeBank(candidateId);
    const categories = [
      'skills',
      'experiences',
      'projects',
      'education',
      'certifications',
      'achievements'
    ];
    for (const cat of categories) {
      const collection = (this.db.knowledgeBank as unknown as Record<string, KnowledgeItem[]>)[cat];
      const idx = collection.findIndex((i) => i.id === itemId);
      if (idx >= 0) {
        collection.splice(idx, 1);
        this.db.knowledgeBank.updatedAt = new Date().toISOString();
        return true;
      }
    }
    return false;
  }

  // --- Ingestion Batches & Documents ---
  async getProposedBatches(candidateId?: string): Promise<ProposedIngestionBatch[]> {
    const candId = candidateId || this.db.candidate.id;
    const batches = (this.db.proposedBatches || []).filter((b) => b.candidateId === candId);
    return JSON.parse(JSON.stringify(batches));
  }

  async createProposedBatch(
    batch: Omit<ProposedIngestionBatch, 'id' | 'uploadedAt'>,
    candidateId?: string
  ): Promise<ProposedIngestionBatch> {
    if (!this.db.proposedBatches) this.db.proposedBatches = [];
    const newBatch: ProposedIngestionBatch = {
      ...batch,
      id: `batch-${Date.now()}`,
      candidateId: candidateId || batch.candidateId || this.db.candidate.id,
      uploadedAt: new Date().toISOString()
    };
    this.db.proposedBatches.push(newBatch);
    return JSON.parse(JSON.stringify(newBatch));
  }

  async saveProposedBatch(
    batch: ProposedIngestionBatch,
    _candidateId?: string
  ): Promise<ProposedIngestionBatch> {
    if (!this.db.proposedBatches) this.db.proposedBatches = [];
    const idx = this.db.proposedBatches.findIndex((b) => b.id === batch.id);
    if (idx >= 0) {
      this.db.proposedBatches[idx] = batch;
    } else {
      this.db.proposedBatches.push(batch);
    }
    return JSON.parse(JSON.stringify(batch));
  }

  async resolveProposedBatch(
    batchId: string,
    candidateId?: string
  ): Promise<ProposedIngestionBatch> {
    const batches = await this.getProposedBatches(candidateId);
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found`);

    for (const item of batch.items) {
      if (!('action' in item) || (item as { action?: string }).action === 'accept') {
        const prov = {
          id: `prov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sourceType: 'resume_upload' as const,
          sourceLabel: batch.fileName,
          extractedSnippet: item.extractedSnippet,
          confidence: item.confidence,
          addedAt: new Date().toISOString()
        };

        const newItem: KnowledgeItem = {
          id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          candidateId: batch.candidateId,
          category: item.category,
          content: item.content,
          status: 'approved',
          provenance: [prov],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveKnowledgeItem(newItem, batch.candidateId);
      }
    }

    const realBatch = (this.db.proposedBatches || []).find((b) => b.id === batchId);
    if (realBatch) {
      this.db.proposedBatches = this.db.proposedBatches?.filter((b) => b.id !== batchId);
    }
    return JSON.parse(JSON.stringify(batch));
  }

  async deleteProposedBatch(batchId: string, _candidateId?: string): Promise<boolean> {
    if (!this.db.proposedBatches) return false;
    const idx = this.db.proposedBatches.findIndex((b) => b.id === batchId);
    if (idx >= 0) {
      this.db.proposedBatches.splice(idx, 1);
      return true;
    }
    return false;
  }

  async getCandidateDocuments(candidateId?: string): Promise<CandidateDocument[]> {
    const candId = candidateId || this.db.candidate.id;
    const docs = (this.db.documents || []).filter((d) => d.candidateId === candId);
    return JSON.parse(JSON.stringify(docs));
  }

  async createCandidateDocument(
    doc: Omit<CandidateDocument, 'id' | 'uploadedAt'>,
    candidateId?: string
  ): Promise<CandidateDocument> {
    if (!this.db.documents) this.db.documents = [];
    const newDoc: CandidateDocument = {
      ...doc,
      id: `doc-${Date.now()}`,
      candidateId: candidateId || doc.candidateId || this.db.candidate.id,
      uploadedAt: new Date().toISOString()
    };
    this.db.documents.push(newDoc);
    return JSON.parse(JSON.stringify(newDoc));
  }

  async getCandidateDocumentById(
    documentId: string,
    candidateId?: string
  ): Promise<CandidateDocument | null> {
    const candId = candidateId || this.db.candidate.id;
    const doc = (this.db.documents || []).find(
      (d) => d.id === documentId && d.candidateId === candId
    );
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  }

  async deleteCandidateDocument(documentId: string, candidateId?: string): Promise<boolean> {
    const candId = candidateId || this.db.candidate.id;
    if (!this.db.documents) return false;
    const idx = this.db.documents.findIndex((d) => d.id === documentId && d.candidateId === candId);
    if (idx === -1) return false;

    this.db.documents.splice(idx, 1);

    // Provenance truthfulness: documentId -> undefined, preserving the KnowledgeItem!
    const keys: (keyof CandidateKnowledgeBank)[] = [
      'skills',
      'experiences',
      'projects',
      'education',
      'certifications',
      'achievements'
    ];
    for (const key of keys) {
      const list = this.db.knowledgeBank[key];
      if (Array.isArray(list)) {
        for (const item of list as KnowledgeItem[]) {
          for (const prov of item.provenance || []) {
            if (prov.documentId === documentId) {
              prov.documentId = undefined;
            }
          }
        }
      }
    }

    return true;
  }

  async getResumeExportRecords(candidateId?: string): Promise<ResumeExport[]> {
    const candId = candidateId || this.db.candidate.id;
    const exports = (this.db.resumeExports || []).filter((e) => e.candidateId === candId);
    return JSON.parse(JSON.stringify(exports));
  }

  async createResumeExportRecord(
    record: Omit<ResumeExport, 'id' | 'createdAt'>,
    candidateId?: string
  ): Promise<ResumeExport> {
    if (!this.db.resumeExports) this.db.resumeExports = [];
    const newExport: ResumeExport = {
      ...record,
      id: `exp-${Date.now()}`,
      candidateId: candidateId || record.candidateId || this.db.candidate.id,
      createdAt: new Date().toISOString()
    };
    this.db.resumeExports.push(newExport);
    return JSON.parse(JSON.stringify(newExport));
  }

  async deleteCandidateAccountData(candidateId: string): Promise<AccountDeletionResult> {
    if (!candidateId) {
      throw new Error('Candidate ID is required for account deletion');
    }

    const docs = (this.db.documents || []).filter((d) => d.candidateId === candidateId);
    const exports = (this.db.resumeExports || []).filter((e) => e.candidateId === candidateId);

    const storageKeys = [
      ...docs.map((d) => d.storageKey).filter(Boolean),
      ...exports.map((e) => e.storageKey).filter((k): k is string => Boolean(k))
    ];

    // Filter out candidate's records
    this.db.documents = (this.db.documents || []).filter((d) => d.candidateId !== candidateId);
    this.db.resumeExports = (this.db.resumeExports || []).filter(
      (e) => e.candidateId !== candidateId
    );
    this.db.applications = (this.db.applications || []).filter(
      (a) => a.candidateId !== candidateId
    );
    this.db.applicationEvents = (this.db.applicationEvents || []).filter(
      (e) => e.candidateId !== candidateId
    );
    this.db.matches = (this.db.matches || []).filter((m) => m.candidateId !== candidateId);
    this.db.resumes = (this.db.resumes || []).filter((r) => r.candidateId !== candidateId);
    this.db.proposedBatches = (this.db.proposedBatches || []).filter(
      (b) => b.candidateId !== candidateId
    );

    // Phase 7 discovery & Phase 7E alerts cleanup
    this.candidateNotifications = this.candidateNotifications.filter(
      (n) => n.candidateId !== candidateId
    );
    this.savedSearchAlerts = this.savedSearchAlerts.filter((a) => a.candidateId !== candidateId);
    this.savedSearches = this.savedSearches.filter((s) => s.candidateId !== candidateId);
    for (const [key] of this.candidateJobStates.entries()) {
      if (key.startsWith(`${candidateId}:`)) {
        this.candidateJobStates.delete(key);
      }
    }

    // Knowledge items
    this.db.knowledgeBank.skills = (this.db.knowledgeBank.skills || []).filter(
      (i) => i.candidateId !== candidateId
    );
    this.db.knowledgeBank.experiences = (this.db.knowledgeBank.experiences || []).filter(
      (i) => i.candidateId !== candidateId
    );
    this.db.knowledgeBank.projects = (this.db.knowledgeBank.projects || []).filter(
      (i) => i.candidateId !== candidateId
    );
    this.db.knowledgeBank.education = (this.db.knowledgeBank.education || []).filter(
      (i) => i.candidateId !== candidateId
    );
    this.db.knowledgeBank.certifications = (this.db.knowledgeBank.certifications || []).filter(
      (i) => i.candidateId !== candidateId
    );
    this.db.knowledgeBank.achievements = (this.db.knowledgeBank.achievements || []).filter(
      (i) => i.candidateId !== candidateId
    );

    // Preserve public jobs; delete candidate private jobs
    const initialPrivateJobs = this.db.jobs.filter(
      (j) => j.importedByCandidateId === candidateId && !j.isPublic
    );
    this.db.jobs = this.db.jobs.filter(
      (j) => !(j.importedByCandidateId === candidateId && !j.isPublic)
    );

    const publicJobsCount = this.db.jobs.filter(
      (j) => j.isPublic || j.importedByCandidateId !== candidateId
    ).length;

    return {
      candidateId,
      databaseDeleted: true,
      storageCleanupStatus: storageKeys.length > 0 ? 'completed' : 'none',
      storageKeysDeletedCount: storageKeys.length,
      failedStorageKeysCount: 0,
      preservedPublicJobsCount: publicJobsCount,
      deletedPrivateJobsCount: initialPrivateJobs.length,
      identityDeletionStatus: 'unconfigured',
      deletedAt: new Date().toISOString()
    };
  }

  // --- Resume Tailoring & Versioning ---
  async getResumeVersions(candidateId?: string): Promise<ResumeVersion[]> {
    const candId = candidateId || this.db.candidate.id;
    const resumes = this.db.resumes.filter((r) => !r.candidateId || r.candidateId === candId);
    return JSON.parse(JSON.stringify(resumes));
  }

  async getResumeVersionById(id: string, candidateId?: string): Promise<ResumeVersion | null> {
    const candId = candidateId || this.db.candidate.id;
    const resume = this.db.resumes.find(
      (r) => r.id === id && (!r.candidateId || r.candidateId === candId)
    );
    return resume ? JSON.parse(JSON.stringify(resume)) : null;
  }

  async getMasterResume(candidateId?: string): Promise<ResumeVersion | null> {
    const candId = candidateId || this.db.candidate.id;
    const master = this.db.resumes.find(
      (r) =>
        (!r.jobId || r.id === this.db.candidate.masterResumeId) &&
        (!r.candidateId || r.candidateId === candId)
    );
    return master ? JSON.parse(JSON.stringify(master)) : null;
  }

  async saveResumeVersion(version: ResumeVersion, candidateId?: string): Promise<ResumeVersion> {
    const candId = candidateId || this.db.candidate.id;
    const toSave: ResumeVersion = {
      ...version,
      candidateId: candId,
      updatedAt: new Date().toISOString()
    };

    const idx = this.db.resumes.findIndex((r) => r.id === version.id);
    if (idx >= 0) {
      this.db.resumes[idx] = toSave;
    } else {
      this.db.resumes.push(toSave);
    }
    return JSON.parse(JSON.stringify(toSave));
  }

  async getTailoredResumeForJob(
    jobId: string,
    candidateId?: string
  ): Promise<ResumeVersion | null> {
    const candId = candidateId || this.db.candidate.id;
    const tailored = this.db.resumes.find(
      (r) => r.jobId === jobId && (!r.candidateId || r.candidateId === candId)
    );
    return tailored ? JSON.parse(JSON.stringify(tailored)) : null;
  }

  async updateResumeChangeStatus(
    resumeVersionId: string,
    changeId: string,
    status: ResumeChangeStatus,
    candidateId?: string
  ): Promise<ResumeChange> {
    const resume = await this.getResumeVersionById(resumeVersionId, candidateId);
    if (!resume) throw new Error(`Resume version ${resumeVersionId} not found`);

    const change = (resume.changes || []).find((c) => c.id === changeId);
    if (!change) throw new Error(`Change ${changeId} not found in resume ${resumeVersionId}`);

    change.status = status;
    const allChanges = resume.changes || [];
    const allDecided = allChanges.every((c) => c.status !== 'pending');
    if (allDecided) {
      resume.approvalState = allChanges.some(
        (c) => c.status === 'approved' || c.status === 'edited'
      )
        ? 'approved'
        : 'in_review';
    }

    await this.saveResumeVersion(resume, candidateId);
    return JSON.parse(JSON.stringify(change));
  }

  async approveAllResumeChanges(
    resumeVersionId: string,
    candidateId?: string
  ): Promise<ResumeVersion> {
    const resume = await this.getResumeVersionById(resumeVersionId, candidateId);
    if (!resume) throw new Error(`Resume version ${resumeVersionId} not found`);

    if (resume.changes) {
      resume.changes.forEach((c) => {
        if (c.status === 'pending') c.status = 'approved';
      });
    }
    resume.approvalState = 'approved';

    return this.saveResumeVersion(resume, candidateId);
  }

  // --- Applications & Tracking Pipeline ---
  async getApplications(
    filters?: { status?: string; search?: string; sort?: string; includeArchived?: boolean },
    candidateId?: string
  ): Promise<ApplicationWithJob[]> {
    const candId = candidateId || this.db.candidate.id;
    let apps = this.db.applications.filter((a) => a.candidateId === candId);

    if (!filters?.includeArchived) {
      apps = apps.filter((a) => !a.isArchived);
    }
    if (filters?.status && filters.status !== 'all') {
      apps = apps.filter((a) => a.status === filters.status);
    }
    if (filters?.search?.trim()) {
      const q = filters.search.toLowerCase().trim();
      apps = apps.filter((a) => {
        const job = this.db.jobs.find((j) => j.id === a.jobId);
        return (
          job?.company.toLowerCase().includes(q) ||
          job?.title.toLowerCase().includes(q) ||
          a.notes?.toLowerCase().includes(q)
        );
      });
    }

    const sort = filters?.sort || 'recent';
    apps.sort((a, b) => {
      if (sort === 'company') {
        const compA = this.db.jobs.find((j) => j.id === a.jobId)?.company || '';
        const compB = this.db.jobs.find((j) => j.id === b.jobId)?.company || '';
        return compA.localeCompare(compB);
      }
      return new Date(b.dateDiscovered).getTime() - new Date(a.dateDiscovered).getTime();
    });

    const appsWithJobs: ApplicationWithJob[] = apps.map((app) => {
      const job = this.db.jobs.find((j) => j.id === app.jobId) || {
        id: app.jobId,
        title: 'Unknown Role',
        company: 'Unknown Company',
        location: 'Remote',
        workArrangement: 'remote',
        description: '',
        requirements: [],
        preferredQualifications: [],
        source: 'manual',
        normalizedAt: new Date().toISOString()
      };
      return {
        ...JSON.parse(JSON.stringify(app)),
        job: JSON.parse(JSON.stringify(job))
      };
    });

    return appsWithJobs;
  }

  async getApplicationById(id: string, candidateId?: string): Promise<ApplicationDetail | null> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find((a) => a.id === id && a.candidateId === candId);
    if (!app) return null;

    const job = this.db.jobs.find((j) => j.id === app.jobId) || {
      id: app.jobId,
      title: 'Unknown Role',
      company: 'Unknown Company',
      location: 'Remote',
      workArrangement: 'remote',
      description: '',
      requirements: [],
      preferredQualifications: [],
      source: 'manual',
      normalizedAt: new Date().toISOString()
    };
    const analysis = this.db.analyses.find((a) => a.jobId === app.jobId) || null;
    const match = this.db.matches.find((m) => m.jobId === app.jobId) || null;
    const resume = app.tailoredResumeVersionId
      ? this.db.resumes.find((r) => r.id === app.tailoredResumeVersionId) || null
      : null;
    const events = (this.db.applicationEvents || []).filter((e) => e.applicationId === id);

    return {
      ...JSON.parse(JSON.stringify(app)),
      job: JSON.parse(JSON.stringify(job)),
      analysis: analysis ? JSON.parse(JSON.stringify(analysis)) : null,
      match: match ? JSON.parse(JSON.stringify(match)) : null,
      resume: resume ? JSON.parse(JSON.stringify(resume)) : null,
      events: JSON.parse(JSON.stringify(events))
    };
  }

  async getApplicationByJobId(jobId: string, candidateId?: string): Promise<Application | null> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.jobId === jobId && a.candidateId === candId && !a.isArchived
    );
    return app ? JSON.parse(JSON.stringify(app)) : null;
  }

  async createApplication(
    jobId: string,
    initialStatus?: ApplicationStatus,
    options?: { allowDuplicate?: boolean },
    candidateId?: string
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const existing = this.db.applications.find(
      (a) => a.jobId === jobId && a.candidateId === candId && !a.isArchived
    );
    if (existing && !options?.allowDuplicate) {
      return JSON.parse(JSON.stringify(existing));
    }
    const status = initialStatus || 'discovered';
    const newApp: Application = {
      id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      jobId,
      candidateId: candId,
      status,
      dateDiscovered: new Date().toISOString(),
      statusHistory: [
        {
          status,
          timestamp: new Date().toISOString(),
          note: 'Added to pipeline.'
        }
      ]
    };
    this.db.applications.push(newApp);
    return JSON.parse(JSON.stringify(newApp));
  }

  async confirmApplicationSubmission(
    payload: import('@/features/preparation/api/types').ConfirmAppliedPayload,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.id === payload.applicationId && a.candidateId === candId
    );
    if (!app) {
      throw new Error(`Application ${payload.applicationId} not found`);
    }

    if (app.version === undefined) app.version = 1;
    if (expectedVersion !== undefined && app.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
      );
    }

    // Resolve target resume strictly per Clarification #2
    let targetResumeVersionId: string | null = null;
    if (app.tailoredResumeVersionId) {
      targetResumeVersionId = app.tailoredResumeVersionId;
    } else if (app.resumeVersionId) {
      targetResumeVersionId = app.resumeVersionId;
    } else if (this.db.candidate.masterResumeId) {
      targetResumeVersionId = this.db.candidate.masterResumeId;
    }

    if (!targetResumeVersionId) {
      throw new Error(
        `Application confirmation failed: No tailored resume or master resume is associated with application ${payload.applicationId}.`
      );
    }

    const resumeRecord = this.db.resumes.find(
      (r) => r.id === targetResumeVersionId && (!r.candidateId || r.candidateId === candId)
    );
    if (!resumeRecord) {
      throw new Error(
        `Application confirmation failed: Referenced resume version ${targetResumeVersionId} not found for candidate.`
      );
    }

    // Resolve template selection
    const templateId =
      payload.templateId || (app.selectedTemplateId as ResumeTemplateId) || 'classic-v1';
    const templateVersion =
      payload.templateVersion ||
      app.selectedTemplateVersion ||
      RESUME_TEMPLATES[templateId]?.version ||
      '1.0';

    // Lock the referenced resume
    resumeRecord.approvalState = 'approved';

    // Structured snapshot
    const candidateProfile = await this.getCandidateProfile(candId);
    const frozenResumeSnapshot = extractResumeContent(resumeRecord, candidateProfile);

    // Freeze match score
    let matchScore = app.matchScoreAtApplication;
    if (matchScore === null || matchScore === undefined) {
      const match = this.db.matches.find(
        (m) => m.jobId === app.jobId && (!m.candidateId || m.candidateId === candId)
      );
      if (match) matchScore = match.score;
    }

    const now = new Date();
    const note = payload.note || 'Candidate confirmed application submission.';
    app.status = 'applied';
    if (!app.dateApplied) app.dateApplied = now.toISOString();
    app.dateClosed = undefined;
    app.tailoredResumeVersionId = targetResumeVersionId;
    app.resumeVersionId = targetResumeVersionId;
    app.selectedTemplateId = templateId;
    app.selectedTemplateVersion = templateVersion;
    app.matchScoreAtApplication = matchScore;
    app.resumeSnapshot = frozenResumeSnapshot;
    app.version = (app.version || 1) + 1;

    if (!app.statusHistory) app.statusHistory = [];
    app.statusHistory.push({
      status: 'applied',
      timestamp: now.toISOString(),
      note
    });

    await this.recordApplicationEvent(
      {
        applicationId: app.id,
        jobId: app.jobId,
        type: 'applied_confirmed',
        title: 'Application Confirmed',
        description: note,
        isAutomated: false,
        metadata: {
          templateId,
          templateVersion,
          matchScoreAtApplication: matchScore,
          resumeVersionId: targetResumeVersionId
        }
      },
      candId
    );

    return JSON.parse(JSON.stringify(app));
  }

  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    note?: string,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find((a) => a.id === id && a.candidateId === candId);
    if (!app) throw new Error(`Application ${id} not found`);

    if (app.version === undefined) app.version = 1;
    if (expectedVersion !== undefined && app.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
      );
    }

    const previousStatus = app.status;
    app.status = status;
    if (status === 'applied' && !app.dateApplied) {
      app.dateApplied = new Date().toISOString();
    }
    if (['rejected', 'withdrawn', 'offer'].includes(status)) {
      app.dateClosed = new Date().toISOString();
    } else {
      app.dateClosed = undefined;
    }

    app.version = (app.version || 1) + 1;

    if (!app.statusHistory) app.statusHistory = [];
    app.statusHistory.push({
      status,
      timestamp: new Date().toISOString(),
      note: note || `Status transitioned to ${status}`
    });

    const wasClosed = ['rejected', 'withdrawn', 'offer'].includes(previousStatus);
    const isNowOpen = !['rejected', 'withdrawn', 'offer'].includes(status);
    if (wasClosed && isNowOpen) {
      await this.recordApplicationEvent(
        {
          applicationId: id,
          jobId: app.jobId,
          type: 'reopened',
          title: 'Application Reopened',
          description: note || `Application reopened to ${status}`,
          isAutomated: false
        },
        candId
      );
    } else {
      await this.recordApplicationEvent(
        {
          applicationId: id,
          jobId: app.jobId,
          type: 'status_changed',
          title: `Status changed to ${status}`,
          description: note || `Status transitioned from ${previousStatus} to ${status}`,
          isAutomated: false
        },
        candId
      );
    }

    return JSON.parse(JSON.stringify(app));
  }

  async updateApplicationNotes(
    id: string,
    notes: string,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find((a) => a.id === id && a.candidateId === candId);
    if (!app) throw new Error(`Application ${id} not found`);

    if (app.version === undefined) app.version = 1;
    if (expectedVersion !== undefined && app.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
      );
    }

    app.notes = notes;
    app.version = (app.version || 1) + 1;
    return JSON.parse(JSON.stringify(app));
  }

  async updateApplicationPreparation(
    id: string,
    updates: ApplicationPreparationUpdates,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find((a) => a.id === id && a.candidateId === candId);
    if (!app) throw new Error(`Application ${id} not found`);

    if (app.version === undefined) app.version = 1;
    if (expectedVersion !== undefined && app.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
      );
    }

    const isApplied = app.status === 'applied' || Boolean(app.dateApplied);
    const allowResumeUpdate = !isApplied;

    if (updates.coverLetterData) app.coverLetterData = updates.coverLetterData;
    if (updates.coverLetter !== undefined) app.coverLetter = updates.coverLetter;
    if (updates.preparedQuestions) app.preparedQuestions = updates.preparedQuestions;
    if (allowResumeUpdate && updates.selectedTemplateId)
      app.selectedTemplateId = updates.selectedTemplateId;
    if (allowResumeUpdate && updates.selectedTemplateVersion)
      app.selectedTemplateVersion = updates.selectedTemplateVersion;
    if (allowResumeUpdate && updates.tailoredResumeVersionId) {
      app.tailoredResumeVersionId = updates.tailoredResumeVersionId;
      app.resumeVersionId = updates.tailoredResumeVersionId;
    }

    app.version = (app.version || 1) + 1;
    return JSON.parse(JSON.stringify(app));
  }

  async recordApplicationExport(
    applicationId: string,
    exportRecord: ResumeExport,
    candidateId?: string
  ): Promise<Application> {
    const app = await this.getApplicationById(applicationId, candidateId);
    if (!app) throw new Error(`Application ${applicationId} not found`);

    if (!app.exports) app.exports = [];
    app.exports.push(exportRecord);

    const realApp = this.db.applications.find((a) => a.id === applicationId);
    if (realApp) {
      if (!realApp.exports) realApp.exports = [];
      realApp.exports.push(exportRecord);
    }
    return JSON.parse(JSON.stringify(app));
  }

  async getApplicationEvents(
    applicationId?: string,
    candidateId?: string
  ): Promise<ApplicationEvent[]> {
    const candId = candidateId || this.db.candidate.id;
    let events = (this.db.applicationEvents || []).filter(
      (e) => !e.candidateId || e.candidateId === candId
    );
    if (applicationId) {
      events = events.filter((e) => e.applicationId === applicationId);
    }
    return JSON.parse(
      JSON.stringify(
        [...events].toSorted(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      )
    );
  }

  async recordApplicationEvent(
    event: Omit<ApplicationEvent, 'id' | 'timestamp'>,
    candidateId?: string
  ): Promise<ApplicationEvent> {
    if (!this.db.applicationEvents) this.db.applicationEvents = [];
    const newEvent: ApplicationEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...(candidateId ? { candidateId } : {})
    } as ApplicationEvent;

    this.db.applicationEvents.push(newEvent);
    return JSON.parse(JSON.stringify(newEvent));
  }

  async updateApplicationFollowUp(
    applicationId: string,
    updates: FollowUpUpdates,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.id === applicationId && a.candidateId === candId
    );
    if (!app) throw new Error(`Application ${applicationId} not found`);

    if (app.version === undefined) app.version = 1;
    if (expectedVersion !== undefined && app.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
      );
    }

    if (updates.followUpDate !== undefined) app.followUpDate = updates.followUpDate;
    if (updates.followUpStatus !== undefined) app.followUpStatus = updates.followUpStatus;
    if (updates.followUpNote !== undefined) app.followUpNote = updates.followUpNote;
    app.version = (app.version || 1) + 1;

    if (updates.followUpStatus === 'snoozed') {
      await this.recordApplicationEvent(
        {
          applicationId,
          jobId: app.jobId,
          type: 'follow_up_snoozed',
          title: 'Follow-up Snoozed',
          description: updates.followUpNote || `Follow-up snoozed to ${updates.followUpDate}`,
          isAutomated: false
        },
        candId
      );
    } else if (updates.followUpStatus === 'completed') {
      await this.recordApplicationEvent(
        {
          applicationId,
          jobId: app.jobId,
          type: 'follow_up_completed',
          title: 'Follow-up Completed',
          description: updates.followUpNote || 'Follow-up marked as completed',
          isAutomated: false
        },
        candId
      );
    } else if (updates.followUpStatus === 'pending') {
      await this.recordApplicationEvent(
        {
          applicationId,
          jobId: app.jobId,
          type: 'follow_up_scheduled',
          title: 'Follow-up Scheduled',
          description: updates.followUpNote || `Follow-up scheduled for ${updates.followUpDate}`,
          isAutomated: false
        },
        candId
      );
    }

    return JSON.parse(JSON.stringify(app));
  }

  async addInterviewStage(
    applicationId: string,
    stage: Omit<InterviewStage, 'id'>,
    candidateId?: string
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.id === applicationId && a.candidateId === candId
    );
    if (!app) throw new Error(`Application ${applicationId} not found`);

    if (!app.interviewStages) app.interviewStages = [];
    const newStage: InterviewStage = {
      ...stage,
      id: `int-${Date.now()}`
    };
    app.interviewStages.push(newStage);
    app.version = (app.version || 1) + 1;

    await this.recordApplicationEvent(
      {
        applicationId,
        jobId: app.jobId,
        type: 'interview_scheduled',
        title: `Interview Scheduled: ${stage.stageName}`,
        description: stage.notes || `Scheduled for ${stage.scheduledDate || 'TBD'}`,
        isAutomated: false
      },
      candId
    );

    return JSON.parse(JSON.stringify(app));
  }

  async updateInterviewStage(
    applicationId: string,
    stage: InterviewStage,
    candidateId?: string
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.id === applicationId && a.candidateId === candId
    );
    if (!app) throw new Error(`Application ${applicationId} not found`);

    if (!app.interviewStages) app.interviewStages = [];
    const idx = app.interviewStages.findIndex((s) => s.id === stage.id);
    if (idx >= 0) {
      app.interviewStages[idx] = { ...app.interviewStages[idx], ...stage };
    } else {
      app.interviewStages.push(stage);
    }
    app.version = (app.version || 1) + 1;

    return JSON.parse(JSON.stringify(app));
  }

  async deleteInterviewStage(
    applicationId: string,
    stageId: string,
    candidateId?: string
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.id === applicationId && a.candidateId === candId
    );
    if (!app) throw new Error(`Application ${applicationId} not found`);

    app.interviewStages = (app.interviewStages || []).filter((s) => s.id !== stageId);
    app.version = (app.version || 1) + 1;
    return JSON.parse(JSON.stringify(app));
  }

  async addApplicationContact(
    applicationId: string,
    contact: Omit<ApplicationContact, 'id' | 'createdAt'>,
    candidateId?: string
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.id === applicationId && a.candidateId === candId
    );
    if (!app) throw new Error(`Application ${applicationId} not found`);

    if (!app.contacts) app.contacts = [];
    const newContact: ApplicationContact = {
      ...contact,
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    app.contacts.push(newContact);
    app.version = (app.version || 1) + 1;

    await this.recordApplicationEvent(
      {
        applicationId,
        jobId: app.jobId,
        type: 'contact_added',
        title: `Contact Added: ${contact.name}`,
        description: `${contact.role || 'Contact'} (${contact.email || ''})`,
        isAutomated: false
      },
      candId
    );

    return JSON.parse(JSON.stringify(app));
  }

  async updateApplicationContact(
    applicationId: string,
    contactId: string,
    updates: Partial<ApplicationContact>,
    candidateId?: string
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.id === applicationId && a.candidateId === candId
    );
    if (!app) throw new Error(`Application ${applicationId} not found`);

    const c = (app.contacts || []).find((item) => item.id === contactId);
    if (c) Object.assign(c, updates);
    app.version = (app.version || 1) + 1;

    return JSON.parse(JSON.stringify(app));
  }

  async deleteApplicationContact(
    applicationId: string,
    contactId: string,
    candidateId?: string
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.id === applicationId && a.candidateId === candId
    );
    if (!app) throw new Error(`Application ${applicationId} not found`);

    app.contacts = (app.contacts || []).filter((c) => c.id !== contactId);
    app.version = (app.version || 1) + 1;
    return JSON.parse(JSON.stringify(app));
  }

  async updateApplicationArchiveStatus(
    applicationId: string,
    isArchived: boolean,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = candidateId || this.db.candidate.id;
    const app = this.db.applications.find(
      (a) => a.id === applicationId && a.candidateId === candId
    );
    if (!app) throw new Error(`Application ${applicationId} not found`);

    if (app.version === undefined) app.version = 1;
    if (expectedVersion !== undefined && app.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
      );
    }

    app.isArchived = isArchived;
    app.version = (app.version || 1) + 1;

    return JSON.parse(JSON.stringify(app));
  }

  // --- Search Intelligence, Analytics & Next Actions ---
  async getDashboardOverview(candidateId?: string): Promise<DashboardOverviewResponse> {
    const candId = candidateId || this.db.candidate.id;
    const candidate = await this.getCandidateProfile(candId);
    const jobs = await this.getJobs({}, candId);
    const applications = await this.getApplications({ includeArchived: true }, candId);
    const events = await this.getApplicationEvents(undefined, candId);

    const pipelineCounts: Record<ApplicationStatus, number> = {
      discovered: 0,
      interested: 0,
      preparing: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0
    };
    applications.forEach((a) => {
      if (pipelineCounts[a.status] !== undefined) {
        pipelineCounts[a.status]++;
      }
    });

    const recommended: RecommendedOpportunity[] = jobs
      .filter((j) => j.match && j.match.score >= 70)
      .toSorted((a, b) => (b.match?.score || 0) - (a.match?.score || 0))
      .slice(0, 5)
      .map((j) => ({
        job: j,
        match: {
          score: j.match!.score,
          headline: j.match!.headline || 'Strong match for your experience'
        },
        applicationStatus: j.applicationStatus || undefined
      }));

    const nextActions = NextActionsService.computeNextActions(applications, events);
    const tasks: NextActionTask[] = nextActions.map((na) => ({
      id: na.id,
      title: na.title,
      priority: na.priority,
      actionUrl: na.actionUrl,
      actionLabel: na.actionLabel,
      category: na.category
    }));

    return {
      candidate,
      recommended,
      pipelineCounts,
      totalApplications: applications.length,
      tasks
    };
  }

  async getNextActions(candidateId?: string): Promise<NextAction[]> {
    const apps = await this.getApplications({ includeArchived: false }, candidateId);
    const events = await this.getApplicationEvents(undefined, candidateId);
    return NextActionsService.computeNextActions(apps, events);
  }

  async getSearchAnalytics(candidateId?: string): Promise<SearchAnalytics> {
    const apps = await this.getApplications({ includeArchived: true }, candidateId);
    const events = await this.getApplicationEvents(undefined, candidateId);
    return SearchAnalyticsService.computeAnalytics(apps, events);
  }

  async getSearchInsights(candidateId?: string): Promise<InsightEngineResult> {
    const apps = await this.getApplications({ includeArchived: true }, candidateId);
    const events = await this.getApplicationEvents(undefined, candidateId);
    const analytics = SearchAnalyticsService.computeAnalytics(apps, events);
    return SearchInsightEngine.generateInsights(analytics, apps);
  }
}
