import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type {
  Job as PrismaJob,
  JobAnalysis as PrismaJobAnalysis,
  JobMatch as PrismaJobMatch,
  KnowledgeItem as PrismaKnowledgeItem,
  KnowledgeProvenance as PrismaKnowledgeProvenance,
  ResumeVersion as PrismaResumeVersion,
  ResumeChange as PrismaResumeChange,
  Application as PrismaApplication,
  InterviewStage as PrismaInterviewStage,
  ApplicationContact as PrismaApplicationContact,
  ResumeExportRecord as PrismaResumeExportRecord,
  JobSourceReference as PrismaJobSourceReference,
  CandidateJobState as PrismaCandidateJobState,
  SavedSearch as PrismaSavedSearch,
  SavedSearchAlert as PrismaSavedSearchAlert,
  CandidateNotification as PrismaCandidateNotification
} from '@prisma/client';
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
  SourceStatus,
  VerificationStatus,
  ReferenceRole,
  NextAction,
  ResumeChange,
  ResumeChangeStatus,
  ResumeExport,
  ResumeTemplateId,
  ResumeVersion,
  SearchAnalytics,
  StatusHistoryEntry
} from '@/types/domain';
import {
  AccountDeletionResult,
  AchievementKnowledgeContent,
  CandidateDocument,
  CandidateKnowledgeBank,
  CertificationKnowledgeContent,
  EducationKnowledgeContent,
  ExperienceKnowledgeContent,
  KnowledgeItem,
  KnowledgeProvenance,
  KnowledgeStatus,
  ProjectKnowledgeContent,
  ProposedIngestionBatch,
  SkillKnowledgeContent
} from '@/types';
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
import {
  ICareerRepository,
  JobFilters,
  ApplicationPreparationUpdates,
  FollowUpUpdates
} from './career-repository.interface';
import { SearchAnalyticsService } from '@/features/analytics/services/analytics-service';
import { NextActionsService } from '@/features/overview/services/next-actions-service';
import { ConcurrencyError, LockedResumeVersionError } from '@/types/errors';
import { extractResumeContent } from '@/types/resume-content';
import { RESUME_TEMPLATES } from '@/features/templates/constants/templates';
import { JobSnapshot, ApplicationHistoricalPackage } from '@/types/application-tracking';

/**
 * Resolves candidate ID with strict invariant enforcement.
 * An explicit authenticated candidate ID is required for all candidate-scoped operations.
 * Silently falling back to demo candidates (such as cand-1) is strictly forbidden.
 */
function resolveCandidateId(candidateId?: string, operationName?: string): string {
  if (candidateId && candidateId.trim()) return candidateId;
  throw new Error(
    `SECURITY VIOLATION: Candidate ID is required for candidate-scoped operation "${operationName || 'unspecified'}". Unauthenticated access is not permitted.`
  );
}

function getSkillName(k: { content: Prisma.JsonValue }): string {
  const obj = k.content as unknown as { name?: string };
  return obj?.name || '';
}

function getSkillCategory(k: { content: Prisma.JsonValue }): string {
  const obj = k.content as unknown as { category?: string };
  return obj?.category || '';
}

function mapKnowledgeItem(
  k: PrismaKnowledgeItem & { provenance: PrismaKnowledgeProvenance[] }
): KnowledgeItem {
  return {
    id: k.id,
    candidateId: k.candidateId,
    category: k.category as unknown as KnowledgeItem['category'],
    content: k.content as unknown as KnowledgeItem['content'],
    status: k.status as unknown as KnowledgeItem['status'],
    provenance: k.provenance.map((p) => ({
      id: p.id,
      sourceType: p.sourceType as unknown as KnowledgeProvenance['sourceType'],
      sourceLabel: p.sourceLabel,
      documentId: p.documentId || undefined,
      extractedSnippet: p.extractedSnippet || undefined,
      confidence: p.confidence || undefined,
      addedAt: p.addedAt.toISOString()
    })),
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString()
  };
}

/**
 * PrismaCareerRepository
 *
 * Implements ICareerRepository backed by PostgreSQL via Prisma.
 * Architecture Invariants:
 * 1. Strict multi-tenant candidate scoping on all candidate-owned queries.
 * 2. Public vs candidate-private job opportunity partitioning.
 * 3. Knowledge Bank approval/status invariants preserved.
 * 4. Master and tailored resume integrity and lock protections preserved.
 * 5. Explicit mapping from Prisma models to domain entities.
 */
export class PrismaCareerRepository implements ICareerRepository {
  private previousJobStates = new Map<string, CandidateJobStatus>();

  // --- Candidate Identity, Profile & Preferences ---
  async getCandidateProfile(candidateId?: string): Promise<CandidateProfile> {
    const candId = resolveCandidateId(candidateId);
    const candidate = await prisma.candidate.findUnique({
      where: { id: candId },
      include: {
        profile: true,
        preferences: true,
        knowledgeItems: {
          where: { status: 'approved' }
        }
      }
    });

    if (!candidate || !candidate.profile) {
      throw new Error(`Candidate with ID ${candId} not found in database.`);
    }

    const kbItems = candidate.knowledgeItems;
    const skills = kbItems.filter((k) => k.category === 'skill').map(getSkillName);

    const technicalSkills = kbItems
      .filter((k) => k.category === 'skill' && getSkillCategory(k) === 'technical')
      .map(getSkillName);

    const toolSkills = kbItems
      .filter((k) => k.category === 'skill' && getSkillCategory(k) === 'tools')
      .map(getSkillName);

    const softSkills = kbItems
      .filter((k) => k.category === 'skill' && getSkillCategory(k) === 'soft')
      .map(getSkillName);

    const otherSkills = kbItems
      .filter((k) => k.category === 'skill' && getSkillCategory(k) === 'other')
      .map(getSkillName);

    const experiences = kbItems
      .filter((k) => k.category === 'experience')
      .map((k) => ({
        id: k.id,
        ...(k.content as unknown as Record<string, unknown>)
      })) as unknown as CandidateProfile['experience'];

    const projects = kbItems
      .filter((k) => k.category === 'project')
      .map((k) => ({
        id: k.id,
        ...(k.content as unknown as Record<string, unknown>)
      })) as unknown as CandidateProfile['projects'];

    const education = kbItems
      .filter((k) => k.category === 'education')
      .map((k) => ({
        id: k.id,
        ...(k.content as unknown as Record<string, unknown>)
      })) as unknown as CandidateProfile['education'];

    const certifications = kbItems
      .filter((k) => k.category === 'certification')
      .map((k) => ({
        id: k.id,
        ...(k.content as unknown as Record<string, unknown>)
      })) as unknown as CandidateProfile['certifications'];

    return {
      id: candidate.id,
      userId: candidate.clerkUserId,
      name: candidate.profile.name,
      headline: candidate.profile.headline || undefined,
      email: candidate.email,
      phone: candidate.profile.phone || undefined,
      location: candidate.profile.location,
      professionalSummary: candidate.profile.professionalSummary,
      targetRoles: candidate.preferences?.targetRoles || [],
      experience: experiences,
      education: education,
      skills: {
        technical: technicalSkills.length ? technicalSkills : skills,
        tools: toolSkills,
        soft: softSkills,
        other: otherSkills
      },
      projects: projects,
      certifications: certifications,
      preferences: {
        targetRoles: candidate.preferences?.targetRoles || [],
        preferredLocations: candidate.preferences?.preferredLocations || [],
        workArrangements: (candidate.preferences?.workArrangements as unknown as (
          | 'remote'
          | 'hybrid'
          | 'onsite'
        )[]) || ['remote'],
        targetSalaryMin: candidate.preferences?.targetSalaryMin || undefined,
        currency: candidate.preferences?.currency || 'USD'
      },
      masterResumeId: candidate.profile.masterResumeId || ''
    };
  }

  async updateCandidateProfile(
    updates: Partial<CandidateProfile>,
    candidateId?: string
  ): Promise<CandidateProfile> {
    const candId = resolveCandidateId(candidateId);

    await prisma.candidateProfile.update({
      where: { candidateId: candId },
      data: {
        name: updates.name,
        headline: updates.headline,
        phone: updates.phone,
        location: updates.location,
        professionalSummary: updates.professionalSummary,
        masterResumeId: updates.masterResumeId
      }
    });

    if (updates.targetRoles) {
      await prisma.candidatePreferences.upsert({
        where: { candidateId: candId },
        create: {
          candidateId: candId,
          targetRoles: updates.targetRoles,
          preferredLocations: ['San Francisco, CA', 'Remote'],
          workArrangements: ['remote', 'hybrid'],
          currency: 'USD'
        },
        update: {
          targetRoles: updates.targetRoles
        }
      });
    }

    return this.getCandidateProfile(candId);
  }

  async getCandidatePreferences(candidateId?: string): Promise<CandidatePreferences | null> {
    const candId = resolveCandidateId(candidateId);
    const prefs = await prisma.candidatePreferences.findUnique({
      where: { candidateId: candId }
    });
    if (!prefs) return null;
    return {
      targetRoles: prefs.targetRoles,
      preferredLocations: prefs.preferredLocations,
      workArrangements: prefs.workArrangements as unknown as ('remote' | 'hybrid' | 'onsite')[],
      targetSalaryMin: prefs.targetSalaryMin || undefined,
      currency: prefs.currency
    };
  }

  async updateCandidatePreferences(
    updates: Partial<CandidatePreferences>,
    candidateId?: string
  ): Promise<CandidatePreferences> {
    const candId = resolveCandidateId(candidateId);
    const prefs = await prisma.candidatePreferences.upsert({
      where: { candidateId: candId },
      create: {
        candidateId: candId,
        targetRoles: updates.targetRoles || [],
        preferredLocations: updates.preferredLocations || [],
        workArrangements: (updates.workArrangements as unknown as (
          | 'remote'
          | 'hybrid'
          | 'onsite'
        )[]) || ['remote'],
        targetSalaryMin: updates.targetSalaryMin,
        currency: updates.currency || 'USD'
      },
      update: {
        ...(updates.targetRoles ? { targetRoles: updates.targetRoles } : {}),
        ...(updates.preferredLocations ? { preferredLocations: updates.preferredLocations } : {}),
        ...(updates.workArrangements ? { workArrangements: updates.workArrangements } : {}),
        ...(updates.targetSalaryMin !== undefined
          ? { targetSalaryMin: updates.targetSalaryMin }
          : {}),
        ...(updates.currency ? { currency: updates.currency } : {})
      }
    });

    return {
      targetRoles: prefs.targetRoles,
      preferredLocations: prefs.preferredLocations,
      workArrangements: prefs.workArrangements as unknown as ('remote' | 'hybrid' | 'onsite')[],
      targetSalaryMin: prefs.targetSalaryMin || undefined,
      currency: prefs.currency
    };
  }

  // --- Jobs Catalog & Isolation ---
  async getJobs(
    filters?: JobFilters,
    candidateId?: string
  ): Promise<(Job & { match?: JobMatch | null; applicationStatus?: ApplicationStatus | null })[]> {
    const candId = candidateId && candidateId.trim() ? candidateId : undefined;

    // Public jobs OR private jobs imported by this candidate
    const jobs = await prisma.job.findMany({
      where: {
        OR: [{ isPublic: true }, ...(candId ? [{ importedByCandidateId: candId }] : [])],
        ...(filters?.status && filters.status !== 'all'
          ? { jobStatus: filters.status }
          : { jobStatus: 'active' }),
        ...(filters?.source && filters.source !== 'all' ? { source: filters.source } : {}),
        ...(filters?.workArrangement && filters.workArrangement !== 'all'
          ? { workArrangement: filters.workArrangement }
          : {})
      },
      include: {
        analysis: true,
        matches: candId
          ? {
              where: { candidateId: candId }
            }
          : false,
        applications: candId
          ? {
              where: { candidateId: candId }
            }
          : false
      }
    });

    let mapped = jobs.map((j) => {
      const matchRecord = j.matches?.[0];
      const appRecord = j.applications?.[0];

      const match: JobMatch | null = matchRecord ? this.mapJobMatch(matchRecord) : null;
      const domainJob: Job = this.mapJob(j);

      return {
        ...domainJob,
        match,
        applicationStatus: appRecord ? (appRecord.status as ApplicationStatus) : null
      };
    });

    // Search filter across title, company, skills, description
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      mapped = mapped.filter((j) => {
        const titleMatch = j.title.toLowerCase().includes(q);
        const companyMatch = j.company.toLowerCase().includes(q);
        const locationMatch = j.location.toLowerCase().includes(q);
        const descriptionMatch = j.description.toLowerCase().includes(q);
        const skillsMatch =
          j.requiredSkills.some((s) => s.toLowerCase().includes(q)) ||
          j.preferredSkills.some((s) => s.toLowerCase().includes(q));
        return titleMatch || companyMatch || locationMatch || descriptionMatch || skillsMatch;
      });
    }

    if (filters?.minMatch && filters.minMatch > 0) {
      mapped = mapped.filter((item) => (item.match?.score ?? 0) >= filters.minMatch!);
    }

    const sort = filters?.sort || 'match_desc';
    mapped = mapped.toSorted((a, b) => {
      if (sort === 'match_desc') return (b.match?.score ?? 0) - (a.match?.score ?? 0);
      if (sort === 'recent') {
        const dateA = a.postedDate || a.normalizedAt;
        const dateB = b.postedDate || b.normalizedAt;
        return dateB.localeCompare(dateA);
      }
      if (sort === 'company_asc') return a.company.localeCompare(b.company);
      if (sort === 'salary_desc') {
        const salA = a.salary?.max ?? a.salary?.min ?? 0;
        const salB = b.salary?.max ?? b.salary?.min ?? 0;
        return salB - salA;
      }
      return 0;
    });

    return mapped;
  }

  async getJobById(id: string, candidateId?: string): Promise<Job | null> {
    const candId = resolveCandidateId(candidateId);
    const j = await prisma.job.findFirst({
      where: {
        id,
        OR: [{ isPublic: true }, { importedByCandidateId: candId }]
      }
    });
    if (!j) return null;
    return this.mapJob(j);
  }

  async getJobAnalysis(jobId: string): Promise<JobAnalysis | null> {
    const a = await prisma.jobAnalysis.findUnique({
      where: { jobId }
    });
    if (!a) return null;
    return this.mapJobAnalysis(a);
  }

  async getJobMatch(jobId: string, candidateId?: string): Promise<JobMatch | null> {
    const candId = resolveCandidateId(candidateId);
    const m = await prisma.jobMatch.findUnique({
      where: {
        candidateId_jobId: {
          candidateId: candId,
          jobId
        }
      }
    });
    if (!m) return null;
    return this.mapJobMatch(m);
  }

  async saveJobAnalysis(analysis: JobAnalysis): Promise<JobAnalysis> {
    const saved = await prisma.jobAnalysis.upsert({
      where: { jobId: analysis.jobId },
      create: {
        jobId: analysis.jobId,
        seniority: analysis.seniority || 'mid',
        roleCategory: analysis.roleCategory || 'Software Engineering',
        technicalRequirements: analysis.technicalRequirements || [],
        softSkills: analysis.softSkills || [],
        importantKeywords: analysis.importantKeywords || [],
        extractedRequirements:
          (analysis.extractedRequirements as unknown as Prisma.InputJsonValue) || [],
        analysisStatus: analysis.analysisStatus || 'success'
      },
      update: {
        seniority: analysis.seniority || 'mid',
        roleCategory: analysis.roleCategory || 'Software Engineering',
        technicalRequirements: analysis.technicalRequirements || [],
        softSkills: analysis.softSkills || [],
        importantKeywords: analysis.importantKeywords || [],
        extractedRequirements:
          (analysis.extractedRequirements as unknown as Prisma.InputJsonValue) || [],
        analysisStatus: analysis.analysisStatus || 'success'
      }
    });

    return this.mapJobAnalysis(saved);
  }

  async saveJobMatch(match: JobMatch, candidateId?: string): Promise<JobMatch> {
    const candId = resolveCandidateId(candidateId || match.candidateId, 'saveJobMatch');
    const saved = await prisma.jobMatch.upsert({
      where: {
        candidateId_jobId: {
          candidateId: candId,
          jobId: match.jobId
        }
      },
      create: {
        candidateId: candId,
        jobId: match.jobId,
        score: match.score,
        recommendation: match.recommendation,
        headline: match.headline,
        reasoning: match.reasoning,
        strongMatches: (match.strongMatches as unknown as Prisma.InputJsonValue) || [],
        partialMatches: (match.partialMatches as unknown as Prisma.InputJsonValue) || [],
        missingRequirements: (match.missingRequirements as unknown as Prisma.InputJsonValue) || [],
        supportingCandidateEvidence:
          (match.supportingCandidateEvidence as unknown as Prisma.InputJsonValue) || []
      },
      update: {
        score: match.score,
        recommendation: match.recommendation,
        headline: match.headline,
        reasoning: match.reasoning,
        strongMatches: (match.strongMatches as unknown as Prisma.InputJsonValue) || [],
        partialMatches: (match.partialMatches as unknown as Prisma.InputJsonValue) || [],
        missingRequirements: (match.missingRequirements as unknown as Prisma.InputJsonValue) || [],
        supportingCandidateEvidence:
          (match.supportingCandidateEvidence as unknown as Prisma.InputJsonValue) || []
      }
    });

    return this.mapJobMatch(saved);
  }

  async importJobByUrl(
    url: string,
    force?: boolean,
    candidateId?: string
  ): Promise<ImportJobResponse> {
    const candId = resolveCandidateId(candidateId);

    // Upfront exact duplicate check on (source, normalizedUrl) before performing network request
    const detection = detectSource(url);
    const normalizedUrl = normalizeJobUrl(url);
    const sourceKey = detection.source === 'unsupported' ? 'unknown' : detection.source;

    if (!force) {
      const existingRef = await prisma.jobSourceReference.findUnique({
        where: {
          source_normalizedUrl: {
            source: sourceKey,
            normalizedUrl
          }
        },
        include: { job: true }
      });

      if (existingRef) {
        const domainJob = await this.getJobById(existingRef.jobId, candId);
        const analysis = await this.getJobAnalysis(existingRef.jobId);
        const match = await this.getJobMatch(existingRef.jobId, candId);

        return {
          success: false,
          isDuplicate: true,
          duplicateTier: 'exact_match',
          duplicateGroupId: existingRef.job?.duplicateGroupId || undefined,
          existingJob: domainJob || undefined,
          job: domainJob || undefined,
          sourceReference: this.mapJobSourceReference(existingRef),
          analysis: analysis || undefined,
          match: match || undefined,
          adapterName: detection.source === 'manual' ? 'Manual Job Text' : detection.source,
          error: 'A matching job already exists in your workspace.'
        };
      }
    }

    // 1. Run Ingestion Pipeline
    const ingestResult = await ingestJobFromUrl({
      url,
      force,
      allowHttpForTesting: process.env.NODE_ENV !== 'production'
    });

    if (ingestResult.error || !ingestResult.data) {
      return {
        success: false,
        error: ingestResult.error || 'Failed to import job from the provided URL.',
        adapterName: ingestResult.adapterName
      };
    }

    const norm = ingestResult.data;

    // 2. Exact source duplicate check: (source, normalizedUrl) or (source, sourceJobId)
    let existingRef = await prisma.jobSourceReference.findUnique({
      where: {
        source_normalizedUrl: {
          source: norm.source,
          normalizedUrl: norm.normalizedUrl
        }
      },
      include: { job: true }
    });

    if (!existingRef && norm.sourceJobId) {
      existingRef = await prisma.jobSourceReference.findFirst({
        where: {
          source: norm.source,
          sourceJobId: norm.sourceJobId
        },
        include: { job: true }
      });
    }

    if (existingRef && !force) {
      const domainJob = await this.getJobById(existingRef.jobId, candId);
      const analysis = await this.getJobAnalysis(existingRef.jobId);
      const match = await this.getJobMatch(existingRef.jobId, candId);

      return {
        success: false,
        isDuplicate: true,
        duplicateTier: 'exact_match',
        duplicateGroupId: existingRef.job?.duplicateGroupId || undefined,
        existingJob: domainJob || undefined,
        job: domainJob || undefined,
        sourceReference: this.mapJobSourceReference(existingRef),
        analysis: analysis || undefined,
        match: match || undefined,
        adapterName: ingestResult.adapterName,
        error: 'A matching job already exists in your workspace.'
      };
    }

    // 3. Cross-Source Deduplication Check (Phase 7C Tier 2 / 3 / 4)
    const candidateJobs = await this.findDuplicateCandidates(norm.company, norm.title, candId);
    const dedupEval = evaluateDeduplication(norm, candidateJobs);

    // --- CASE A: Strong Duplicate (Tier 2) ---
    // Reuses the existing canonical Job and attaches the new source reference!
    if (dedupEval.tier === 'strong_duplicate' && dedupEval.canonicalJob && !force) {
      const canonicalJob = dedupEval.canonicalJob;
      const groupId = canonicalJob.duplicateGroupId || `dup-group-${canonicalJob.id}`;

      if (!canonicalJob.duplicateGroupId) {
        await this.updateJobDuplicateGroup(canonicalJob.id, groupId);
        canonicalJob.duplicateGroupId = groupId;
      }

      // Check current primary source reference
      const existingRefs = await this.getJobSourceReferences(canonicalJob.id);
      const currentPrimary = existingRefs.find((r) => r.isPrimary);
      const incomingStatus = norm.sourceStatus || 'active';
      const shouldPromote =
        incomingStatus !== 'closed' && shouldPromoteNewSource(norm.source, currentPrimary);

      // Create new JobSourceReference attached to canonicalJob
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

      // Fetch or compute analysis and match for canonical job
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
    // A distinct canonical Job is created.
    const createdJob = await prisma.$transaction(async (tx) => {
      const j = await tx.job.create({
        data: {
          title: norm.title,
          company: norm.company,
          location: norm.location,
          workArrangement: norm.workArrangement,
          description: norm.description,
          responsibilities: norm.responsibilities,
          requiredSkills: norm.requiredSkills,
          preferredSkills: norm.preferredSkills,
          experienceRequirement: norm.experienceRequirement,
          educationRequirement: norm.educationRequirement,
          salaryMin: norm.salaryMin,
          salaryMax: norm.salaryMax,
          salaryCurrency: norm.salaryCurrency,
          salaryInterval: norm.salaryInterval,
          postedDate: norm.postedDate ? new Date(norm.postedDate) : null,
          source: norm.source,
          originalUrl: norm.sourceUrl,
          jobStatus: norm.sourceStatus === 'closed' ? 'closed' : 'active',
          isPublic: false,
          importedByCandidateId: candId
        }
      });

      const ref = await tx.jobSourceReference.create({
        data: {
          jobId: j.id,
          source: norm.source,
          sourceJobId: norm.sourceJobId || null,
          sourceUrl: norm.sourceUrl,
          normalizedUrl: norm.normalizedUrl,
          sourceStatus: norm.sourceStatus || 'active',
          verificationStatus: 'verified_accessible',
          lastVerifiedAt: new Date(),
          lastVerificationError: norm.closeReason || null,
          isPrimary: true,
          referenceRole: 'primary',
          firstSeenAt: new Date(),
          lastSeenAt: new Date()
        }
      });

      return { job: j, ref };
    });

    const domainJob = this.mapJob(createdJob.job);
    const domainRef = this.mapJobSourceReference(createdJob.ref);

    // Trigger Analysis
    let analysis: JobAnalysis;
    try {
      analysis = await analysisService.analyzeJob(domainJob);
      await this.saveJobAnalysis(analysis);
    } catch {
      analysis = {
        id: `analysis-${domainJob.id}`,
        jobId: domainJob.id,
        seniority: 'mid',
        roleCategory: 'Full-Stack Software Engineering',
        technicalRequirements: [...domainJob.requiredSkills],
        softSkills: ['Collaboration', 'Communication'],
        importantKeywords: domainJob.requiredSkills.slice(0, 4),
        extractedRequirements: domainJob.requiredSkills.map((s, idx) => ({
          id: `req-${domainJob.id}-${idx + 1}`,
          text: `Proficiency in ${s}`,
          category: 'required' as const,
          priority: 'high' as const
        })),
        analysisStatus: 'success'
      };
      await this.saveJobAnalysis(analysis);
    }

    // Trigger Match
    let match: JobMatch | undefined;
    try {
      const candidateProfile = await this.getCandidateProfile(candId);
      if (candidateProfile) {
        match = await matchService.calculateMatch(domainJob, analysis, candidateProfile);
        await this.saveJobMatch(match, candId);
      }
    } catch {
      // Match calculation failure does not fail job import
    }

    return {
      success: true,
      isDuplicate: false,
      duplicateTier: dedupEval.tier,
      job: domainJob,
      sourceReference: domainRef,
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
    const candId = resolveCandidateId(candidateId);

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

    // Cross-Source Deduplication Check (Phase 7C Tier 2 / 3 / 4)
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

      // Check current primary source reference
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
    const createdJob = await prisma.$transaction(async (tx) => {
      const j = await tx.job.create({
        data: {
          title: norm.title,
          company: norm.company,
          location: norm.location,
          workArrangement: norm.workArrangement,
          description: norm.description,
          responsibilities: norm.responsibilities,
          requiredSkills: norm.requiredSkills,
          preferredSkills: norm.preferredSkills,
          experienceRequirement: norm.experienceRequirement,
          educationRequirement: norm.educationRequirement,
          salaryMin: norm.salaryMin,
          salaryMax: norm.salaryMax,
          salaryCurrency: norm.salaryCurrency,
          salaryInterval: norm.salaryInterval,
          postedDate: norm.postedDate ? new Date(norm.postedDate) : null,
          source: 'manual',
          originalUrl: norm.sourceUrl,
          jobStatus: 'active',
          isPublic: false,
          importedByCandidateId: candId
        }
      });

      const ref = await tx.jobSourceReference.create({
        data: {
          jobId: j.id,
          source: 'manual',
          sourceJobId: null,
          sourceUrl: norm.sourceUrl,
          normalizedUrl: norm.normalizedUrl,
          sourceStatus: 'active',
          verificationStatus: 'verified_accessible',
          lastVerifiedAt: new Date(),
          isPrimary: true,
          referenceRole: 'primary',
          firstSeenAt: new Date(),
          lastSeenAt: new Date()
        }
      });

      return { job: j, ref };
    });

    const domainJob = this.mapJob(createdJob.job);
    const domainRef = this.mapJobSourceReference(createdJob.ref);

    let analysis: JobAnalysis;
    try {
      analysis = await analysisService.analyzeJob(domainJob);
      await this.saveJobAnalysis(analysis);
    } catch {
      analysis = {
        id: `analysis-${domainJob.id}`,
        jobId: domainJob.id,
        seniority: 'mid',
        roleCategory: 'Full-Stack Software Engineering',
        technicalRequirements: [...domainJob.requiredSkills],
        softSkills: ['Collaboration', 'Communication'],
        importantKeywords: domainJob.requiredSkills.slice(0, 4),
        extractedRequirements: domainJob.requiredSkills.map((s, idx) => ({
          id: `req-${domainJob.id}-${idx + 1}`,
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
        match = await matchService.calculateMatch(domainJob, analysis, candidateProfile);
        await this.saveJobMatch(match, candId);
      }
    } catch {
      // Match calculation failure does not fail job import
    }

    return {
      success: true,
      isDuplicate: false,
      duplicateTier: dedupEval.tier,
      job: domainJob,
      sourceReference: domainRef,
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
    const isPublic = jobData.isPublic ?? !candidateId;
    const j = await prisma.job.create({
      data: {
        title: jobData.title,
        company: jobData.company,
        location: jobData.location,
        workArrangement: jobData.workArrangement,
        description: jobData.description,
        responsibilities: jobData.responsibilities,
        requiredSkills: jobData.requiredSkills,
        preferredSkills: jobData.preferredSkills,
        experienceRequirement: jobData.experienceRequirement,
        educationRequirement: jobData.educationRequirement,
        salaryMin: jobData.salary?.min,
        salaryMax: jobData.salary?.max,
        salaryCurrency: jobData.salary?.currency || 'USD',
        salaryInterval: jobData.salary?.interval || 'yearly',
        postedDate: jobData.postedDate ? new Date(jobData.postedDate) : null,
        source: jobData.source,
        originalUrl: jobData.originalUrl,
        jobStatus: jobData.jobStatus || 'active',
        isPublic,
        importedByCandidateId: candidateId || jobData.importedByCandidateId
      }
    });

    return this.mapJob(j);
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
    const j = await prisma.job.update({
      where: { id },
      data: {
        title: updates.title,
        company: updates.company,
        location: updates.location,
        workArrangement: updates.workArrangement,
        description: updates.description,
        responsibilities: updates.responsibilities,
        requiredSkills: updates.requiredSkills,
        preferredSkills: updates.preferredSkills,
        experienceRequirement: updates.experienceRequirement,
        educationRequirement: updates.educationRequirement,
        jobStatus: updates.jobStatus
      }
    });

    return this.mapJob(j);
  }

  // --- Phase 7A: Job Discovery, Source References & Candidate State ---

  async getJobSourceReferences(jobId: string): Promise<JobSourceReference[]> {
    const refs = await prisma.jobSourceReference.findMany({
      where: { jobId },
      orderBy: [{ isPrimary: 'desc' }, { firstSeenAt: 'asc' }]
    });
    return refs.map((r) => this.mapJobSourceReference(r));
  }

  async addJobSourceReference(
    reference: Omit<JobSourceReference, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<JobSourceReference> {
    const created = await prisma.$transaction(async (tx) => {
      if (reference.isPrimary) {
        // Demote existing primary references for this job
        await tx.jobSourceReference.updateMany({
          where: { jobId: reference.jobId, isPrimary: true },
          data: { isPrimary: false, referenceRole: 'alternative' }
        });
      }

      return tx.jobSourceReference.create({
        data: {
          jobId: reference.jobId,
          source: reference.source,
          sourceJobId: reference.sourceJobId || null,
          sourceUrl: reference.sourceUrl,
          normalizedUrl: reference.normalizedUrl,
          sourceStatus: reference.sourceStatus || 'active',
          verificationStatus: reference.verificationStatus || 'unverified',
          lastVerifiedAt: reference.lastVerifiedAt ? new Date(reference.lastVerifiedAt) : null,
          lastVerificationError: reference.lastVerificationError || null,
          isPrimary: reference.isPrimary ?? false,
          referenceRole:
            reference.referenceRole || (reference.isPrimary ? 'primary' : 'alternative'),
          firstSeenAt: reference.firstSeenAt ? new Date(reference.firstSeenAt) : new Date(),
          lastSeenAt: reference.lastSeenAt ? new Date(reference.lastSeenAt) : new Date()
        }
      });
    });

    return this.mapJobSourceReference(created);
  }

  async setPrimaryJobSourceReference(jobId: string, referenceId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const target = await tx.jobSourceReference.findFirst({
        where: { id: referenceId, jobId }
      });

      if (!target) {
        throw new Error(`Job source reference ${referenceId} does not belong to job ${jobId}`);
      }

      if (target.sourceStatus === 'closed') {
        throw new Error(`Cannot set closed source reference ${referenceId} as primary`);
      }

      // Demote current primary
      await tx.jobSourceReference.updateMany({
        where: { jobId, isPrimary: true },
        data: { isPrimary: false, referenceRole: 'alternative' }
      });

      // Promote target
      await tx.jobSourceReference.update({
        where: { id: referenceId },
        data: { isPrimary: true, referenceRole: 'primary' }
      });
    });
  }

  async getCandidateJobState(
    jobId: string,
    candidateId: string
  ): Promise<CandidateJobState | null> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getCandidateJobState');
    }
    const state = await prisma.candidateJobState.findUnique({
      where: { candidateId_jobId: { candidateId, jobId } }
    });
    return state ? this.mapCandidateJobState(state) : null;
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

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.candidateJobState.findUnique({
        where: { candidateId_jobId: { candidateId, jobId } }
      });

      const prevStatus: CandidateJobStatus = existing
        ? (existing.status as CandidateJobStatus)
        : 'UNSEEN';
      this.previousJobStates.set(key, prevStatus);

      const now = new Date();

      if (!existing) {
        const firstViewedAt =
          status === 'VIEWED' || status === 'SAVED' || status === 'DISMISSED' ? now : null;
        const savedAt = status === 'SAVED' ? now : null;
        const dismissedAt = status === 'DISMISSED' ? now : null;

        return tx.candidateJobState.create({
          data: {
            candidateId,
            jobId,
            status,
            dismissedReason: status === 'DISMISSED' ? dismissedReason || null : null,
            firstViewedAt,
            savedAt,
            dismissedAt
          }
        });
      }

      // Existing record: firstViewedAt is immutable once established
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

      return tx.candidateJobState.update({
        where: { id: existing.id },
        data: {
          status,
          dismissedReason: reason,
          firstViewedAt,
          savedAt,
          dismissedAt
        }
      });
    });

    return this.mapCandidateJobState(updated);
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
    const existing = await prisma.candidateJobState.findUnique({
      where: { candidateId_jobId: { candidateId, jobId } }
    });

    if (!existing || existing.status !== 'DISMISSED') {
      return existing ? this.mapCandidateJobState(existing) : null;
    }

    const target = targetPreviousState || this.previousJobStates.get(key) || 'UNSEEN';

    if (target === 'UNSEEN') {
      await prisma.candidateJobState.delete({
        where: { id: existing.id }
      });
      this.previousJobStates.delete(key);
      return null;
    }

    if (target === 'SAVED') {
      const now = new Date();
      const updated = await prisma.candidateJobState.update({
        where: { id: existing.id },
        data: {
          status: 'SAVED',
          savedAt: now,
          dismissedAt: null,
          dismissedReason: null
        }
      });
      this.previousJobStates.set(key, 'SAVED');
      return this.mapCandidateJobState(updated);
    }

    if (target === 'VIEWED') {
      const updated = await prisma.candidateJobState.update({
        where: { id: existing.id },
        data: {
          status: 'VIEWED',
          dismissedAt: null,
          dismissedReason: null
        }
      });
      this.previousJobStates.set(key, 'VIEWED');
      return this.mapCandidateJobState(updated);
    }

    return this.mapCandidateJobState(existing);
  }

  async getSavedSearches(candidateId: string): Promise<SavedSearch[]> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getSavedSearches');
    }
    const searches = await prisma.savedSearch.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' }
    });
    return searches.map((s) => this.mapSavedSearch(s));
  }

  async getSavedSearchById(id: string, candidateId: string): Promise<SavedSearch | null> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getSavedSearchById');
    }
    const search = await prisma.savedSearch.findFirst({
      where: { id, candidateId }
    });
    return search ? this.mapSavedSearch(search) : null;
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

    if (search.id) {
      // Verify candidate ownership
      const existing = await prisma.savedSearch.findFirst({
        where: { id: search.id, candidateId }
      });
      if (!existing) {
        throw new Error(`Saved search ${search.id} not found or access denied`);
      }

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

      const updated = await prisma.savedSearch.update({
        where: { id: search.id },
        data: {
          name: search.name,
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
            search.lastMatchCount !== undefined ? search.lastMatchCount : existing.lastMatchCount
        }
      });
      return this.mapSavedSearch(updated);
    }

    const created = await prisma.savedSearch.create({
      data: {
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
        lastMatchCount: search.lastMatchCount || 0
      }
    });
    return this.mapSavedSearch(created);
  }

  async enableSavedSearch(id: string, candidateId: string): Promise<SavedSearch> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for enableSavedSearch');
    }
    const existing = await prisma.savedSearch.findFirst({
      where: { id, candidateId }
    });
    if (!existing) {
      throw new Error(`Saved search ${id} not found or access denied`);
    }
    const updated = await prisma.savedSearch.update({
      where: { id },
      data: { isEnabled: true }
    });
    return this.mapSavedSearch(updated);
  }

  async disableSavedSearch(id: string, candidateId: string): Promise<SavedSearch> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for disableSavedSearch');
    }
    const existing = await prisma.savedSearch.findFirst({
      where: { id, candidateId }
    });
    if (!existing) {
      throw new Error(`Saved search ${id} not found or access denied`);
    }
    const updated = await prisma.savedSearch.update({
      where: { id },
      data: { isEnabled: false }
    });
    return this.mapSavedSearch(updated);
  }

  async deleteSavedSearch(id: string, candidateId: string): Promise<boolean> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for deleteSavedSearch');
    }
    const result = await prisma.savedSearch.deleteMany({
      where: { id, candidateId }
    });
    return result.count > 0;
  }

  async getEnabledSavedSearches(frequency?: string, candidateId?: string): Promise<SavedSearch[]> {
    const searches = await prisma.savedSearch.findMany({
      where: {
        isEnabled: true,
        ...(frequency ? { alertFrequency: frequency } : {}),
        ...(candidateId ? { candidateId } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
    return searches.map((s) => this.mapSavedSearch(s));
  }

  // --- Phase 7E: Alerts & In-App Notifications ---

  async getSavedSearchAlerts(
    candidateId: string,
    savedSearchId?: string
  ): Promise<SavedSearchAlert[]> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getSavedSearchAlerts');
    }
    const where: Prisma.SavedSearchAlertWhereInput = {
      candidateId,
      ...(savedSearchId ? { savedSearchId } : {})
    };
    const alerts = await prisma.savedSearchAlert.findMany({
      where,
      orderBy: { generatedAt: 'desc' }
    });
    return alerts.map((a) => this.mapSavedSearchAlert(a));
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
      generatedAt = new Date()
    } = params;

    if (!candidateId) throw new Error('candidateId is mandatory');
    if (!savedSearchId) throw new Error('savedSearchId is mandatory');
    if (!jobId) throw new Error('jobId is mandatory');

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Check if alert already exists
        const existing = await tx.savedSearchAlert.findUnique({
          where: {
            candidateId_savedSearchId_jobId: {
              candidateId,
              savedSearchId,
              jobId
            }
          }
        });

        if (existing) {
          return {
            alert: this.mapSavedSearchAlert(existing),
            notification: null,
            isNew: false
          };
        }

        // 2. Create alert atomically
        const createdAlert = await tx.savedSearchAlert.create({
          data: {
            candidateId,
            savedSearchId,
            jobId,
            savedSearchVersion,
            generatedAt,
            status: 'generated'
          }
        });

        // 3. Create candidate notification linked to the job and saved search
        const createdNotification = await tx.candidateNotification.create({
          data: {
            candidateId,
            type: 'SAVED_SEARCH_ALERT',
            title: notificationTitle,
            message: notificationMessage,
            relatedJobId: jobId,
            relatedSavedSearchId: savedSearchId,
            createdAt: generatedAt
          }
        });

        return {
          alert: this.mapSavedSearchAlert(createdAlert),
          notification: this.mapCandidateNotification(createdNotification),
          isNew: true
        };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raceExisting = await prisma.savedSearchAlert.findUnique({
          where: {
            candidateId_savedSearchId_jobId: { candidateId, savedSearchId, jobId }
          }
        });
        return {
          alert: raceExisting ? this.mapSavedSearchAlert(raceExisting) : null,
          notification: null,
          isNew: false
        };
      }
      throw err;
    }
  }

  async getNotifications(candidateId: string): Promise<CandidateNotification[]> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getNotifications');
    }
    const items = await prisma.candidateNotification.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' }
    });
    return items.map((n) => this.mapCandidateNotification(n));
  }

  async markNotificationAsRead(id: string, candidateId: string): Promise<boolean> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for markNotificationAsRead');
    }
    const result = await prisma.candidateNotification.updateMany({
      where: { id, candidateId },
      data: { readAt: new Date() }
    });
    return result.count > 0;
  }

  // --- Phase 7C: Deduplication & Source Intelligence ---

  async findDuplicateCandidates(
    company: string,
    title?: string,
    candidateId?: string
  ): Promise<Job[]> {
    const normCompany = normalizeCompany(company);
    // Respect candidate isolation: public jobs OR private jobs imported by this candidate
    const isolationWhere: Prisma.JobWhereInput = candidateId
      ? {
          OR: [{ isPublic: true }, { importedByCandidateId: candidateId }]
        }
      : { isPublic: true };

    const rawJobs = await prisma.job.findMany({
      where: {
        AND: [
          isolationWhere,
          {
            OR: [
              { company: { contains: normCompany, mode: 'insensitive' } },
              { company: { equals: company, mode: 'insensitive' } }
            ]
          }
        ]
      },
      include: {
        sourceReferences: {
          orderBy: [{ isPrimary: 'desc' }, { firstSeenAt: 'asc' }]
        }
      }
    });

    return rawJobs.map((j) => this.mapJob(j));
  }

  async updateJobDuplicateGroup(jobId: string, duplicateGroupId: string): Promise<void> {
    await prisma.job.update({
      where: { id: jobId },
      data: { duplicateGroupId }
    });
  }

  async updateJobStatus(jobId: string, jobStatus: string): Promise<void> {
    await prisma.job.update({
      where: { id: jobId },
      data: { jobStatus }
    });
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
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.jobSourceReference.findUnique({
        where: { id }
      });
      if (!existing) {
        throw new Error(`Job source reference ${id} not found`);
      }

      if (updates.isPrimary) {
        // Demote any other primary references for this job
        await tx.jobSourceReference.updateMany({
          where: { jobId: existing.jobId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false, referenceRole: 'alternative' }
        });
      }

      const ref = await tx.jobSourceReference.update({
        where: { id },
        data: {
          sourceStatus: updates.sourceStatus ?? existing.sourceStatus,
          verificationStatus: updates.verificationStatus ?? existing.verificationStatus,
          lastVerifiedAt:
            updates.lastVerifiedAt !== undefined
              ? updates.lastVerifiedAt
                ? new Date(updates.lastVerifiedAt)
                : null
              : existing.lastVerifiedAt,
          lastVerificationError:
            updates.lastVerificationError !== undefined
              ? updates.lastVerificationError
              : existing.lastVerificationError,
          isPrimary: updates.isPrimary !== undefined ? updates.isPrimary : existing.isPrimary,
          referenceRole:
            updates.referenceRole ?? (updates.isPrimary ? 'primary' : existing.referenceRole),
          lastSeenAt: updates.lastSeenAt ? new Date(updates.lastSeenAt) : existing.lastSeenAt
        }
      });

      // Update aggregate job status if sourceStatus changed
      if (updates.sourceStatus && updates.sourceStatus !== existing.sourceStatus) {
        const allRefs = await tx.jobSourceReference.findMany({
          where: { jobId: existing.jobId }
        });
        const currentJob = await tx.job.findUnique({
          where: { id: existing.jobId }
        });
        if (currentJob) {
          const domainRefs = allRefs.map((r) => this.mapJobSourceReference(r));
          const newJobStatus = aggregateJobStatus(domainRefs, currentJob.jobStatus);
          if (newJobStatus !== currentJob.jobStatus) {
            await tx.job.update({
              where: { id: existing.jobId },
              data: { jobStatus: newJobStatus }
            });
          }
        }
      }

      return ref;
    });

    return this.mapJobSourceReference(updated);
  }

  async fallbackPrimarySource(jobId: string): Promise<JobSourceReference | null> {
    return prisma.$transaction(async (tx) => {
      const allRefs = await tx.jobSourceReference.findMany({
        where: { jobId }
      });
      if (allRefs.length === 0) return null;

      const domainRefs = allRefs.map((r) => this.mapJobSourceReference(r));
      const best = selectBestPrimarySource(domainRefs);

      if (!best) {
        const currentJob = await tx.job.findUnique({ where: { id: jobId } });
        if (currentJob) {
          const newStatus = aggregateJobStatus(domainRefs, currentJob.jobStatus);
          if (newStatus !== currentJob.jobStatus) {
            await tx.job.update({
              where: { id: jobId },
              data: { jobStatus: newStatus }
            });
          }
        }
        return null;
      }

      if (best.isPrimary) {
        return best;
      }

      // Demote current primaries
      await tx.jobSourceReference.updateMany({
        where: { jobId, isPrimary: true },
        data: { isPrimary: false, referenceRole: 'alternative' }
      });

      // Promote best
      const promoted = await tx.jobSourceReference.update({
        where: { id: best.id },
        data: { isPrimary: true, referenceRole: 'primary' }
      });

      // Update aggregate job status
      const currentJob = await tx.job.findUnique({ where: { id: jobId } });
      if (currentJob) {
        const newStatus = aggregateJobStatus(domainRefs, currentJob.jobStatus);
        if (newStatus !== currentJob.jobStatus) {
          await tx.job.update({
            where: { id: jobId },
            data: { jobStatus: newStatus }
          });
        }
      }

      return this.mapJobSourceReference(promoted);
    });
  }

  // --- Phase 7D: Opportunity Priority & Discovery Ranking ---

  async getDiscoveryRanking(
    params: DiscoveryRankingParams,
    candidateId: string
  ): Promise<DiscoveryRankingResponse> {
    if (!candidateId) {
      throw new Error('candidateId is mandatory for getDiscoveryRanking');
    }

    const pageSize = Math.min(
      Math.max(1, params.pageSize || DEFAULT_DISCOVERY_PAGE_SIZE),
      MAX_DISCOVERY_PAGE_SIZE
    );

    // 1. Fetch Candidate Preferences for context and fit calculation
    const preferences = await this.getCandidatePreferences(candidateId);

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
      candidateId,
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
        // Context changed (e.g. preferences changed or different candidate or filters changed), signal reset
        cursorReset = true;
        cursorPayload = null;
      } else if (decoded.error) {
        throw new Error(`Invalid pagination cursor: ${decoded.error}`);
      } else {
        cursorPayload = decoded.payload;
      }
    }

    // 3. Database query for candidate-scoped, active opportunities
    // Candidate isolation: isPublic: true OR importedByCandidateId: candidateId
    // Never include other candidates' private jobs!
    const whereClause: Prisma.JobWhereInput = {
      AND: [
        { jobStatus: 'active' },
        {
          OR: [{ isPublic: true }, { importedByCandidateId: candidateId }]
        },
        ...(params.workArrangement && params.workArrangement !== 'all'
          ? [{ workArrangement: params.workArrangement }]
          : [])
      ]
    };

    const rawJobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        sourceReferences: {
          orderBy: [{ isPrimary: 'desc' }, { firstSeenAt: 'asc' }]
        },
        matches: {
          where: { candidateId }
        },
        candidateStates: {
          where: { candidateId }
        },
        applications: {
          where: { candidateId }
        }
      }
    });

    // 4. Evaluation Time Snapshot & Usability Gate
    // If a cursor is present, reuse its evaluatedAt timestamp so that freshness scores remain
    // strictly stable across pagination pages. Otherwise establish one server-side evaluation time.
    const evaluationDate = cursorPayload ? new Date(cursorPayload.e) : new Date();
    const evaluatedAtIso = evaluationDate.toISOString();

    const eligibleOpportunities: RankedOpportunity[] = [];

    for (const rawJob of rawJobs) {
      const domainJob = this.mapJob(rawJob);
      const domainSources = rawJob.sourceReferences.map((r) => this.mapJobSourceReference(r));
      const match = rawJob.matches[0] ? this.mapJobMatch(rawJob.matches[0]) : null;
      const primarySource = domainSources.find((s) => s.isPrimary) || domainSources[0] || null;
      const candidateState = rawJob.candidateStates[0]
        ? this.mapCandidateJobState(rawJob.candidateStates[0])
        : null;
      const app = rawJob.applications[0];
      const applicationStatus = app ? (app.status as ApplicationStatus) : null;

      // Filter out applied jobs if not explicitly included
      if (!params.includeApplied && applicationStatus) {
        // preserve applications, can be filtered if needed
      }

      // Check source usability against stable evaluation timestamp
      const hasUsableSource = domainSources.some((s) => isSourceUsable(s, evaluationDate));

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
        const hasMatchingSource = domainSources.some(
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
        const inTitle = domainJob.title.toLowerCase().includes(q);
        const inCompany = domainJob.company.toLowerCase().includes(q);
        const inLocation = (domainJob.location || '').toLowerCase().includes(q);
        const inDesc = (domainJob.description || '').toLowerCase().includes(q);
        const inSkills =
          (domainJob.requiredSkills || []).some((s) => s.toLowerCase().includes(q)) ||
          (domainJob.preferredSkills || []).some((s) => s.toLowerCase().includes(q));
        if (!inTitle && !inCompany && !inLocation && !inSkills && !inDesc) {
          continue;
        }
      }

      const priority = calculateOpportunityPriority(
        domainJob,
        candidateId,
        match,
        preferences,
        domainSources,
        DEFAULT_RANKING_CONFIG,
        evaluationDate
      );

      eligibleOpportunities.push({
        job: domainJob,
        priority,
        match,
        primarySource,
        candidateState,
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
  async getKnowledgeBank(candidateId?: string): Promise<CandidateKnowledgeBank> {
    const candId = resolveCandidateId(candidateId);
    const items = await prisma.knowledgeItem.findMany({
      where: { candidateId: candId },
      include: {
        provenance: true
      },
      orderBy: { createdAt: 'asc' }
    });

    return {
      id: `kb-${candId}`,
      candidateId: candId,
      skills: items
        .filter((i) => i.category === 'skill')
        .map(mapKnowledgeItem) as unknown as KnowledgeItem<SkillKnowledgeContent>[],
      experiences: items
        .filter((i) => i.category === 'experience')
        .map(mapKnowledgeItem) as unknown as KnowledgeItem<ExperienceKnowledgeContent>[],
      projects: items
        .filter((i) => i.category === 'project')
        .map(mapKnowledgeItem) as unknown as KnowledgeItem<ProjectKnowledgeContent>[],
      education: items
        .filter((i) => i.category === 'education')
        .map(mapKnowledgeItem) as unknown as KnowledgeItem<EducationKnowledgeContent>[],
      certifications: items
        .filter((i) => i.category === 'certification')
        .map(mapKnowledgeItem) as unknown as KnowledgeItem<CertificationKnowledgeContent>[],
      achievements: items
        .filter((i) => i.category === 'achievement')
        .map(mapKnowledgeItem) as unknown as KnowledgeItem<AchievementKnowledgeContent>[],
      updatedAt: new Date().toISOString()
    };
  }

  async getKnowledgeItemById(itemId: string, candidateId?: string): Promise<KnowledgeItem | null> {
    const candId = resolveCandidateId(candidateId);
    const k = await prisma.knowledgeItem.findFirst({
      where: { id: itemId, candidateId: candId },
      include: { provenance: true }
    });
    if (!k) return null;

    return {
      id: k.id,
      candidateId: k.candidateId,
      category: k.category as unknown as KnowledgeItem['category'],
      content: k.content as unknown as KnowledgeItem['content'],
      status: k.status as unknown as KnowledgeItem['status'],
      provenance: k.provenance.map((p) => ({
        id: p.id,
        sourceType: p.sourceType as unknown as KnowledgeProvenance['sourceType'],
        sourceLabel: p.sourceLabel,
        documentId: p.documentId || undefined,
        extractedSnippet: p.extractedSnippet || undefined,
        confidence: p.confidence || undefined,
        addedAt: p.addedAt.toISOString()
      })),
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString()
    };
  }

  async saveKnowledgeItem(item: KnowledgeItem, candidateId?: string): Promise<KnowledgeItem> {
    const candId = resolveCandidateId(candidateId || item.candidateId, 'saveKnowledgeItem');

    const saved = await prisma.knowledgeItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        candidateId: candId,
        category: item.category,
        content: item.content as unknown as Prisma.InputJsonValue,
        status: item.status || 'approved',
        provenance: {
          create: (item.provenance || []).map((p) => ({
            id: p.id,
            sourceType: p.sourceType,
            sourceLabel: p.sourceLabel,
            documentId: p.documentId,
            extractedSnippet: p.extractedSnippet,
            confidence: p.confidence,
            addedAt: p.addedAt ? new Date(p.addedAt) : new Date()
          }))
        }
      },
      update: {
        content: item.content as unknown as Prisma.InputJsonValue,
        status: item.status,
        updatedAt: new Date()
      },
      include: { provenance: true }
    });

    if (item.provenance && item.provenance.length > 0) {
      for (const p of item.provenance) {
        await prisma.knowledgeProvenance.upsert({
          where: { id: p.id },
          create: {
            id: p.id,
            knowledgeItemId: saved.id,
            sourceType: p.sourceType,
            sourceLabel: p.sourceLabel,
            documentId: p.documentId || null,
            extractedSnippet: p.extractedSnippet || null,
            confidence: p.confidence ?? null,
            addedAt: p.addedAt ? new Date(p.addedAt) : new Date()
          },
          update: {
            sourceLabel: p.sourceLabel,
            extractedSnippet: p.extractedSnippet || null,
            confidence: p.confidence ?? null
          }
        });
      }
    }

    const reloaded = await prisma.knowledgeItem.findUnique({
      where: { id: saved.id },
      include: { provenance: true }
    });
    const finalItem = reloaded || saved;

    return {
      id: finalItem.id,
      candidateId: finalItem.candidateId,
      category: finalItem.category as unknown as KnowledgeItem['category'],
      content: finalItem.content as unknown as KnowledgeItem['content'],
      status: finalItem.status as unknown as KnowledgeItem['status'],
      provenance: finalItem.provenance.map((p) => ({
        id: p.id,
        sourceType: p.sourceType as unknown as KnowledgeProvenance['sourceType'],
        sourceLabel: p.sourceLabel,
        documentId: p.documentId || undefined,
        extractedSnippet: p.extractedSnippet || undefined,
        confidence: p.confidence || undefined,
        addedAt: p.addedAt.toISOString()
      })),
      createdAt: finalItem.createdAt.toISOString(),
      updatedAt: finalItem.updatedAt.toISOString()
    };
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
    const candId = resolveCandidateId(candidateId);
    const updated = await prisma.knowledgeItem.update({
      where: { id: itemId },
      data: { status, updatedAt: new Date() },
      include: { provenance: true }
    });

    // Ensure item belongs to candidate
    if (updated.candidateId !== candId) {
      throw new Error(`Cross-candidate tampering blocked for knowledge item ${itemId}`);
    }

    return {
      id: updated.id,
      candidateId: updated.candidateId,
      category: updated.category as unknown as KnowledgeItem['category'],
      content: updated.content as unknown as KnowledgeItem['content'],
      status: updated.status as unknown as KnowledgeItem['status'],
      provenance: updated.provenance.map((p) => ({
        id: p.id,
        sourceType: p.sourceType as unknown as KnowledgeProvenance['sourceType'],
        sourceLabel: p.sourceLabel,
        documentId: p.documentId || undefined,
        extractedSnippet: p.extractedSnippet || undefined,
        confidence: p.confidence || undefined,
        addedAt: p.addedAt.toISOString()
      })),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  async deleteKnowledgeItem(itemId: string, candidateId?: string): Promise<boolean> {
    const candId = resolveCandidateId(candidateId);
    const res = await prisma.knowledgeItem.deleteMany({
      where: { id: itemId, candidateId: candId }
    });
    return res.count > 0;
  }

  // --- Ingestion Batches & Documents ---
  async getProposedBatches(candidateId?: string): Promise<ProposedIngestionBatch[]> {
    const candId = resolveCandidateId(candidateId);
    const batches = await prisma.resumeIngestionBatch.findMany({
      where: { candidateId: candId },
      orderBy: { uploadedAt: 'desc' }
    });

    return batches.map((b) => ({
      id: b.id,
      candidateId: b.candidateId,
      documentId: b.documentId || undefined,
      fileName: b.fileName,
      rawText: b.rawText || undefined,
      uploadedAt: b.uploadedAt.toISOString(),
      items: b.items as unknown as ProposedIngestionBatch['items'],
      status: b.status as unknown as ProposedIngestionBatch['status']
    }));
  }

  async createProposedBatch(
    batch: Omit<ProposedIngestionBatch, 'id' | 'uploadedAt'>,
    candidateId?: string
  ): Promise<ProposedIngestionBatch> {
    const candId = resolveCandidateId(candidateId || batch.candidateId, 'createProposedBatch');
    const b = await prisma.resumeIngestionBatch.create({
      data: {
        candidateId: candId,
        documentId: batch.documentId || null,
        fileName: batch.fileName,
        rawText: batch.rawText || null,
        items: batch.items as unknown as Prisma.InputJsonValue,
        status: batch.status || 'pending_review'
      }
    });

    return {
      id: b.id,
      candidateId: b.candidateId,
      documentId: b.documentId || undefined,
      fileName: b.fileName,
      rawText: b.rawText || undefined,
      uploadedAt: b.uploadedAt.toISOString(),
      items: b.items as unknown as ProposedIngestionBatch['items'],
      status: b.status as unknown as ProposedIngestionBatch['status']
    };
  }

  async resolveProposedBatch(
    batchId: string,
    candidateId?: string
  ): Promise<ProposedIngestionBatch> {
    const candId = resolveCandidateId(candidateId);
    const existing = await prisma.resumeIngestionBatch.findFirst({
      where: { id: batchId, candidateId: candId }
    });

    if (!existing) {
      throw new Error(`Ingestion batch ${batchId} not found or unauthorized`);
    }

    const b = await prisma.resumeIngestionBatch.update({
      where: { id: batchId },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        rawText: null // Expunge temporary raw text upon resolution
      }
    });

    return {
      id: b.id,
      candidateId: b.candidateId,
      documentId: b.documentId || undefined,
      fileName: b.fileName,
      rawText: b.rawText || undefined,
      uploadedAt: b.uploadedAt.toISOString(),
      items: b.items as unknown as ProposedIngestionBatch['items'],
      status: b.status as unknown as ProposedIngestionBatch['status']
    };
  }

  async saveProposedBatch(
    batch: ProposedIngestionBatch,
    candidateId?: string
  ): Promise<ProposedIngestionBatch> {
    const candId = resolveCandidateId(candidateId || batch.candidateId, 'saveProposedBatch');
    const b = await prisma.resumeIngestionBatch.upsert({
      where: { id: batch.id },
      create: {
        id: batch.id,
        candidateId: candId,
        documentId: batch.documentId || null,
        fileName: batch.fileName,
        rawText: batch.rawText || null,
        items: batch.items as unknown as Prisma.InputJsonValue,
        status: batch.status || 'pending_review'
      },
      update: {
        fileName: batch.fileName,
        documentId: batch.documentId || undefined,
        rawText: batch.rawText || undefined,
        items: batch.items as unknown as Prisma.InputJsonValue,
        status: batch.status
      }
    });

    return {
      id: b.id,
      candidateId: b.candidateId,
      documentId: b.documentId || undefined,
      fileName: b.fileName,
      rawText: b.rawText || undefined,
      uploadedAt: b.uploadedAt.toISOString(),
      items: b.items as unknown as ProposedIngestionBatch['items'],
      status: b.status as unknown as ProposedIngestionBatch['status']
    };
  }

  async deleteProposedBatch(batchId: string, candidateId?: string): Promise<boolean> {
    const candId = resolveCandidateId(candidateId);
    const res = await prisma.resumeIngestionBatch.deleteMany({
      where: { id: batchId, candidateId: candId }
    });
    return res.count > 0;
  }

  async getCandidateDocuments(candidateId?: string): Promise<CandidateDocument[]> {
    const candId = resolveCandidateId(candidateId);
    const docs = await prisma.candidateDocument.findMany({
      where: { candidateId: candId },
      orderBy: { uploadedAt: 'desc' }
    });

    return docs.map((d) => ({
      id: d.id,
      candidateId: d.candidateId,
      filename: d.filename,
      mimeType: d.mimeType,
      size: d.size,
      storageKey: d.storageKey,
      hash: d.hash,
      uploadedAt: d.uploadedAt.toISOString(),
      processingStatus: d.processingStatus
    }));
  }

  async createCandidateDocument(
    doc: Omit<CandidateDocument, 'id' | 'uploadedAt'>,
    candidateId?: string
  ): Promise<CandidateDocument> {
    const candId = resolveCandidateId(candidateId || doc.candidateId, 'createCandidateDocument');
    const d = await prisma.candidateDocument.create({
      data: {
        candidateId: candId,
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        storageKey: doc.storageKey,
        hash: doc.hash || `hash-${Date.now()}`,
        processingStatus: doc.processingStatus || 'uploaded'
      }
    });

    return {
      id: d.id,
      candidateId: d.candidateId,
      filename: d.filename,
      mimeType: d.mimeType,
      size: d.size,
      storageKey: d.storageKey,
      hash: d.hash,
      uploadedAt: d.uploadedAt.toISOString(),
      processingStatus: d.processingStatus
    };
  }

  async getCandidateDocumentById(
    documentId: string,
    candidateId?: string
  ): Promise<CandidateDocument | null> {
    const candId = resolveCandidateId(candidateId);
    const d = await prisma.candidateDocument.findFirst({
      where: { id: documentId, candidateId: candId }
    });
    if (!d) return null;

    return {
      id: d.id,
      candidateId: d.candidateId,
      filename: d.filename,
      mimeType: d.mimeType,
      size: d.size,
      storageKey: d.storageKey,
      hash: d.hash,
      uploadedAt: d.uploadedAt.toISOString(),
      processingStatus: d.processingStatus
    };
  }

  async deleteCandidateDocument(documentId: string, candidateId?: string): Promise<boolean> {
    const candId = resolveCandidateId(candidateId);
    const doc = await prisma.candidateDocument.findFirst({
      where: { id: documentId, candidateId: candId }
    });
    if (!doc) return false;

    // Prisma relation onDelete: SetNull on KnowledgeProvenance and ResumeIngestionBatch
    // ensures provenance and batch records retain integrity while unlinking the deleted document.
    await prisma.candidateDocument.delete({
      where: { id: documentId }
    });

    return true;
  }

  async getResumeExportRecords(candidateId?: string): Promise<ResumeExport[]> {
    const candId = resolveCandidateId(candidateId);
    const exports = await prisma.resumeExportRecord.findMany({
      where: { candidateId: candId },
      orderBy: { createdAt: 'desc' }
    });

    return exports.map((e) => ({
      id: e.id,
      candidateId: e.candidateId,
      applicationId: e.applicationId,
      tailoredResumeVersionId: e.tailoredResumeVersionId,
      templateId: e.templateId,
      templateVersion: e.templateVersion,
      format: e.format as 'pdf' | 'docx',
      filename: e.filename,
      storageKey: e.storageKey,
      createdAt: e.createdAt.toISOString()
    }));
  }

  async createResumeExportRecord(
    record: Omit<ResumeExport, 'id' | 'createdAt'>,
    candidateId?: string
  ): Promise<ResumeExport> {
    const candId = resolveCandidateId(
      candidateId || record.candidateId,
      'createResumeExportRecord'
    );
    const e = await prisma.resumeExportRecord.create({
      data: {
        candidateId: candId,
        applicationId: record.applicationId || null,
        tailoredResumeVersionId: record.tailoredResumeVersionId,
        templateId: record.templateId,
        templateVersion: record.templateVersion,
        format: record.format,
        filename: record.filename,
        storageKey: record.storageKey || null
      }
    });

    return {
      id: e.id,
      candidateId: e.candidateId,
      applicationId: e.applicationId,
      tailoredResumeVersionId: e.tailoredResumeVersionId,
      templateId: e.templateId,
      templateVersion: e.templateVersion,
      format: e.format as 'pdf' | 'docx',
      filename: e.filename,
      storageKey: e.storageKey,
      createdAt: e.createdAt.toISOString()
    };
  }

  async deleteCandidateAccountData(candidateId: string): Promise<AccountDeletionResult> {
    if (!candidateId) {
      throw new Error('Candidate ID is required for account deletion');
    }

    // Step 1: Collect all candidate-owned storage keys BEFORE database deletion
    const [candidateDocs, candidateExports] = await Promise.all([
      prisma.candidateDocument.findMany({
        where: { candidateId },
        select: { storageKey: true }
      }),
      prisma.resumeExportRecord.findMany({
        where: { candidateId },
        select: { storageKey: true }
      })
    ]);

    const storageKeysToDelete = [
      ...candidateDocs.map((d) => d.storageKey).filter(Boolean),
      ...candidateExports.map((e) => e.storageKey).filter((k): k is string => Boolean(k))
    ];

    // Identify candidate-imported private jobs vs public/shared jobs
    const candidatePrivateJobs = await prisma.job.findMany({
      where: {
        importedByCandidateId: candidateId,
        isPublic: false
      },
      select: { id: true }
    });

    const publicJobsCount = await prisma.job.count({
      where: {
        OR: [
          { isPublic: true },
          { importedByCandidateId: { not: candidateId } },
          { importedByCandidateId: null }
        ]
      }
    });

    let deletedPrivateJobsCount = 0;

    // Step 2: Execute strictly ordered topological deletion inside a PostgreSQL transaction
    // Respects all foreign-key constraints (including onDelete: Restrict on tailoredResumeVersion)
    await prisma.$transaction(async (tx) => {
      // 0a. Delete candidate's CandidateNotifications, SavedSearchAlerts, SavedSearches and CandidateJobStates
      await tx.candidateNotification.deleteMany({ where: { candidateId } });
      await tx.savedSearchAlert.deleteMany({ where: { candidateId } });
      await tx.savedSearch.deleteMany({ where: { candidateId } });
      await tx.candidateJobState.deleteMany({ where: { candidateId } });

      // a. Delete candidate's ResumeExportRecords (breaks Restrict reference to ResumeVersion)
      await tx.resumeExportRecord.deleteMany({
        where: { candidateId }
      });

      // b. Delete candidate's ApplicationContacts
      await tx.applicationContact.deleteMany({
        where: { application: { candidateId } }
      });

      // c. Delete candidate's InterviewStages
      await tx.interviewStage.deleteMany({
        where: { application: { candidateId } }
      });

      // d. Delete candidate's ApplicationEvents
      await tx.applicationEvent.deleteMany({
        where: { candidateId }
      });

      // e. Delete candidate's Applications (breaks Restrict reference to ResumeVersion)
      await tx.application.deleteMany({
        where: { candidateId }
      });

      // f. Delete candidate's ResumeChanges
      await tx.resumeChange.deleteMany({
        where: { resumeVersion: { candidateId } }
      });

      // g. Delete candidate's ResumeVersions (now free of Restrict foreign keys)
      await tx.resumeVersion.deleteMany({
        where: { candidateId }
      });

      // h. Delete candidate's KnowledgeProvenance
      await tx.knowledgeProvenance.deleteMany({
        where: {
          OR: [{ knowledgeItem: { candidateId } }, { document: { candidateId } }]
        }
      });

      // i. Delete candidate's KnowledgeItems
      await tx.knowledgeItem.deleteMany({
        where: { candidateId }
      });

      // j. Delete candidate's ResumeIngestionBatches
      await tx.resumeIngestionBatch.deleteMany({
        where: { candidateId }
      });

      // k. Delete candidate's CandidateDocuments
      await tx.candidateDocument.deleteMany({
        where: { candidateId }
      });

      // l. Delete candidate's JobMatches
      await tx.jobMatch.deleteMany({
        where: { candidateId }
      });

      // m. Delete candidate-imported private jobs (if not referenced by other candidates)
      for (const pj of candidatePrivateJobs) {
        const otherAppCount = await tx.application.count({ where: { jobId: pj.id } });
        const otherMatchCount = await tx.jobMatch.count({ where: { jobId: pj.id } });
        if (otherAppCount === 0 && otherMatchCount === 0) {
          await tx.jobSourceReference.deleteMany({ where: { jobId: pj.id } });
          await tx.candidateJobState.deleteMany({ where: { jobId: pj.id } });
          await tx.jobAnalysis.deleteMany({ where: { jobId: pj.id } });
          await tx.job.delete({ where: { id: pj.id } });
          deletedPrivateJobsCount++;
        } else {
          await tx.job.update({
            where: { id: pj.id },
            data: { importedByCandidateId: null }
          });
        }
      }

      // n. Delete candidate profile and preferences
      await tx.candidateProfile.deleteMany({
        where: { candidateId }
      });
      await tx.candidatePreferences.deleteMany({
        where: { candidateId }
      });

      // o. Delete Candidate identity record itself
      await tx.candidate.deleteMany({
        where: { id: candidateId }
      });
    });

    // Step 3: Cleanup object storage after DB transaction has successfully committed
    let storageCleanupStatus: 'completed' | 'partial' | 'failed' | 'none' = 'none';
    let storageKeysDeletedCount = 0;
    let failedStorageKeysCount = 0;

    if (storageKeysToDelete.length > 0) {
      try {
        const { getStorage } = await import('@/services/storage/storage-provider');
        const storage = getStorage();
        for (const key of storageKeysToDelete) {
          try {
            await storage.delete(key);
            storageKeysDeletedCount++;
          } catch {
            failedStorageKeysCount++;
          }
        }

        if (failedStorageKeysCount === 0) {
          storageCleanupStatus = 'completed';
        } else if (storageKeysDeletedCount > 0) {
          storageCleanupStatus = 'partial';
        } else {
          storageCleanupStatus = 'failed';
        }
      } catch {
        storageCleanupStatus = 'failed';
        failedStorageKeysCount = storageKeysToDelete.length;
      }
    }

    return {
      candidateId,
      databaseDeleted: true,
      storageCleanupStatus,
      storageKeysDeletedCount,
      failedStorageKeysCount,
      preservedPublicJobsCount: publicJobsCount,
      deletedPrivateJobsCount,
      identityDeletionStatus: 'unconfigured',
      deletedAt: new Date().toISOString()
    };
  }

  // --- Resumes & Tailoring ---
  async getResumeVersions(candidateId?: string): Promise<ResumeVersion[]> {
    const candId = resolveCandidateId(candidateId);
    const resumes = await prisma.resumeVersion.findMany({
      where: { candidateId: candId },
      include: { changes: true },
      orderBy: { createdAt: 'desc' }
    });

    return resumes.map((r) => this.mapResumeVersion(r));
  }

  async getResumeVersionById(id: string, candidateId?: string): Promise<ResumeVersion | null> {
    const candId = resolveCandidateId(candidateId);
    const r = await prisma.resumeVersion.findFirst({
      where: { id, candidateId: candId },
      include: { changes: true }
    });
    return r ? this.mapResumeVersion(r) : null;
  }

  async getMasterResume(candidateId?: string): Promise<ResumeVersion | null> {
    const cand = await this.getCandidateProfile(candidateId);
    if (!cand.masterResumeId) return null;
    return this.getResumeVersionById(cand.masterResumeId, candidateId);
  }

  async saveResumeVersion(version: ResumeVersion, candidateId?: string): Promise<ResumeVersion> {
    const candId = resolveCandidateId(candidateId || version.candidateId, 'saveResumeVersion');
    const versionId =
      version.id || `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (version.id) {
      const existing = await prisma.resumeVersion.findFirst({
        where: { id: version.id, candidateId: candId },
        select: { id: true, isLocked: true }
      });
      if (existing?.isLocked) {
        throw new LockedResumeVersionError();
      }
    }

    const saved = await prisma.resumeVersion.upsert({
      where: { id: versionId },
      create: {
        id: versionId,
        candidateId: candId,
        masterResumeId: version.masterResumeId,
        jobId: version.jobId,
        targetCompany: version.targetCompany,
        title: version.title,
        targetRole: version.targetRole,
        summary: version.summary,
        experience: version.experience as unknown as Prisma.InputJsonValue,
        education: version.education as unknown as Prisma.InputJsonValue,
        skills: version.skills as unknown as Prisma.InputJsonValue,
        projects: version.projects as unknown as Prisma.InputJsonValue,
        certifications: version.certifications as unknown as Prisma.InputJsonValue,
        approvalState: version.approvalState,
        isLocked: version.approvalState === 'approved',
        changes: {
          create: (version.changes || []).map((ch) => ({
            id: ch.id,
            candidateId: candId,
            jobId: version.jobId,
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
      },
      update: {
        title: version.title,
        targetRole: version.targetRole,
        summary: version.summary,
        experience: version.experience as unknown as Prisma.InputJsonValue,
        education: version.education as unknown as Prisma.InputJsonValue,
        skills: version.skills as unknown as Prisma.InputJsonValue,
        projects: version.projects as unknown as Prisma.InputJsonValue,
        certifications: version.certifications as unknown as Prisma.InputJsonValue,
        approvalState: version.approvalState,
        updatedAt: new Date()
      },
      include: { changes: true }
    });

    return this.mapResumeVersion(saved);
  }

  async getTailoredResumeForJob(
    jobId: string,
    candidateId?: string
  ): Promise<ResumeVersion | null> {
    const candId = resolveCandidateId(candidateId);
    const r = await prisma.resumeVersion.findFirst({
      where: { jobId, candidateId: candId },
      include: { changes: true }
    });
    return r ? this.mapResumeVersion(r) : null;
  }

  async updateResumeChangeStatus(
    resumeVersionId: string,
    changeId: string,
    status: ResumeChangeStatus,
    candidateId?: string
  ): Promise<ResumeChange> {
    const resume = await this.getResumeVersionById(resumeVersionId, candidateId);
    if (!resume) throw new Error(`Resume version ${resumeVersionId} not found`);

    const ch = await prisma.resumeChange.update({
      where: { id: changeId },
      data: { status, updatedAt: new Date() }
    });

    // Check if all changes are now approved
    const allChanges = await prisma.resumeChange.findMany({
      where: { resumeVersionId }
    });
    const allApproved = allChanges.every((c) => c.status === 'approved');
    if (allApproved && allChanges.length > 0) {
      await prisma.resumeVersion.update({
        where: { id: resumeVersionId },
        data: { approvalState: 'approved', isLocked: true, updatedAt: new Date() }
      });
    }

    return {
      id: ch.id,
      resumeVersionId: ch.resumeVersionId,
      candidateId: ch.candidateId || undefined,
      jobId: ch.jobId || undefined,
      section: ch.section as unknown as ResumeChange['section'],
      sectionItemId: ch.sectionItemId || undefined,
      originalContent: ch.originalContent,
      proposedContent: ch.proposedContent,
      editedContent: ch.editedContent || undefined,
      rationale: ch.rationale,
      jobRequirement: ch.jobRequirement,
      sourceCandidateEvidence: ch.sourceCandidateEvidence,
      sourceKnowledgeItemIds: ch.sourceKnowledgeItemIds,
      evidenceReferences: ch.evidenceReferences,
      status: ch.status as unknown as ResumeChange['status'],
      grounded: ch.grounded
    };
  }

  async approveAllResumeChanges(
    resumeVersionId: string,
    candidateId?: string
  ): Promise<ResumeVersion> {
    const resume = await this.getResumeVersionById(resumeVersionId, candidateId);
    if (!resume) throw new Error(`Resume version ${resumeVersionId} not found`);

    await prisma.resumeChange.updateMany({
      where: { resumeVersionId },
      data: { status: 'approved', updatedAt: new Date() }
    });

    const updated = await prisma.resumeVersion.update({
      where: { id: resumeVersionId },
      data: { approvalState: 'approved', isLocked: true, updatedAt: new Date() },
      include: { changes: true }
    });

    return this.mapResumeVersion(updated);
  }

  private mapResumeVersion(
    r: PrismaResumeVersion & {
      changes?: PrismaResumeChange[];
    }
  ): ResumeVersion {
    return {
      id: r.id,
      candidateId: r.candidateId,
      masterResumeId: r.masterResumeId || undefined,
      jobId: r.jobId || undefined,
      targetCompany: r.targetCompany || undefined,
      title: r.title,
      targetRole: r.targetRole,
      summary: r.summary,
      experience: r.experience as unknown as ResumeVersion['experience'],
      education: r.education as unknown as ResumeVersion['education'],
      skills: r.skills as unknown as ResumeVersion['skills'],
      projects: r.projects as unknown as ResumeVersion['projects'],
      certifications: r.certifications as unknown as ResumeVersion['certifications'],
      changes: (r.changes || []).map((ch) => ({
        id: ch.id,
        candidateId: ch.candidateId || undefined,
        jobId: ch.jobId || undefined,
        resumeVersionId: ch.resumeVersionId,
        section: ch.section as unknown as ResumeChange['section'],
        sectionItemId: ch.sectionItemId || undefined,
        originalContent: ch.originalContent,
        proposedContent: ch.proposedContent,
        editedContent: ch.editedContent || undefined,
        rationale: ch.rationale,
        jobRequirement: ch.jobRequirement,
        sourceCandidateEvidence: ch.sourceCandidateEvidence,
        sourceKnowledgeItemIds: ch.sourceKnowledgeItemIds,
        evidenceReferences: ch.evidenceReferences || [],
        status: ch.status as unknown as ResumeChange['status'],
        grounded: ch.grounded
      })),
      approvalState: r.approvalState as unknown as ResumeVersion['approvalState'],
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  // --- Applications & Tracking Pipeline (Reads backed by PostgreSQL) ---
  async getApplications(
    filters?: { status?: string; search?: string; sort?: string; includeArchived?: boolean },
    candidateId?: string
  ): Promise<ApplicationWithJob[]> {
    const candId = resolveCandidateId(candidateId);
    const apps = await prisma.application.findMany({
      where: {
        candidateId: candId,
        ...(!filters?.includeArchived ? { isArchived: false } : {}),
        ...(filters?.status && filters.status !== 'all' ? { status: filters.status } : {})
      },
      include: {
        interviewStages: true,
        contacts: true,
        exports: true,
        events: true,
        job: true
      },
      orderBy: { dateDiscovered: 'desc' }
    });

    let mapped: ApplicationWithJob[] = apps.map((app) => ({
      ...this.mapApplication(app),
      job: this.mapJob(app.job)
    }));

    if (typeof filters?.search === 'string' && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      mapped = mapped.filter((a) => {
        const comp = a.job.company.toLowerCase();
        const title = a.job.title.toLowerCase();
        const notes = a.notes?.toLowerCase() || '';
        return comp.includes(q) || title.includes(q) || notes.includes(q);
      });
    }

    if (filters?.sort === 'company') {
      mapped = mapped.toSorted((a, b) => a.job.company.localeCompare(b.job.company));
    }

    return mapped;
  }

  async getApplicationById(id: string, candidateId?: string): Promise<ApplicationDetail | null> {
    const candId = resolveCandidateId(candidateId);
    const a = await prisma.application.findFirst({
      where: { id, candidateId: candId },
      include: {
        interviewStages: true,
        contacts: true,
        exports: true,
        events: true,
        job: {
          include: {
            analysis: true,
            matches: {
              where: { candidateId: candId }
            }
          }
        },
        tailoredResumeVersion: {
          include: {
            changes: true
          }
        }
      }
    });
    if (!a) return null;

    const baseApp = this.mapApplication(a);
    const domainJob = this.mapJob(a.job);
    const analysis = a.job.analysis ? this.mapJobAnalysis(a.job.analysis) : null;
    const matchRecord = a.job.matches[0];
    const match = matchRecord ? this.mapJobMatch(matchRecord) : null;
    const resume = a.tailoredResumeVersion ? this.mapResumeVersion(a.tailoredResumeVersion) : null;
    const events = (a.events || []).map((e) => ({
      id: e.id,
      applicationId: e.applicationId,
      jobId: e.jobId,
      type: e.type as unknown as ApplicationEvent['type'],
      title: e.title,
      description: e.description,
      timestamp: e.timestamp.toISOString(),
      isAutomated: e.isAutomated,
      metadata: e.metadata as unknown as ApplicationEvent['metadata']
    }));

    return {
      ...baseApp,
      job: domainJob,
      analysis,
      match,
      resume,
      events
    };
  }

  async getApplicationByJobId(jobId: string, candidateId?: string): Promise<Application | null> {
    const candId = resolveCandidateId(candidateId);
    const a = await prisma.application.findFirst({
      where: { jobId, candidateId: candId, isArchived: false },
      include: {
        interviewStages: true,
        contacts: true,
        exports: true
      }
    });
    return a ? this.mapApplication(a) : null;
  }

  async createApplication(
    jobId: string,
    initialStatus?: ApplicationStatus,
    options?: { allowDuplicate?: boolean },
    candidateId?: string
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);
    const existing = await prisma.application.findFirst({
      where: { jobId, candidateId: candId, isArchived: false },
      include: { interviewStages: true, contacts: true, exports: true }
    });
    if (existing && !options?.allowDuplicate) {
      return this.mapApplication(existing);
    }
    const status = initialStatus || 'discovered';
    const now = new Date();
    const app = await prisma.application.create({
      data: {
        jobId,
        candidateId: candId,
        status,
        dateDiscovered: now,
        statusHistory: [
          {
            status,
            timestamp: now.toISOString(),
            note: 'Added to pipeline.'
          }
        ]
      },
      include: { interviewStages: true, contacts: true, exports: true }
    });

    return this.mapApplication(app);
  }

  async confirmApplicationSubmission(
    payload: import('@/features/preparation/api/types').ConfirmAppliedPayload,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      // 1. Fetch application with candidate isolation
      const app = await tx.application.findFirst({
        where: { id: payload.applicationId, candidateId: candId },
        include: {
          interviewStages: true,
          contacts: true,
          exports: true,
          job: {
            include: {
              matches: { where: { candidateId: candId } }
            }
          }
        }
      });

      if (!app) {
        throw new Error(`Application ${payload.applicationId} not found`);
      }

      // Optimistic concurrency check
      if (expectedVersion !== undefined && app.version !== expectedVersion) {
        throw new ConcurrencyError(
          `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
        );
      }

      // 2. Identify and resolve target resume version strictly per Clarification #2:
      // "Application confirmation must never silently choose an arbitrary resume.
      // If a tailored resume is explicitly selected, use that exact version.
      // If the product explicitly supports applying with the Master Resume, use the Master Resume.
      // If no valid resume source exists, fail the confirmation transaction rather than silently falling back."
      let targetResumeVersionId: string | null = null;
      if (app.tailoredResumeVersionId) {
        targetResumeVersionId = app.tailoredResumeVersionId;
      } else if (app.resumeVersionId) {
        targetResumeVersionId = app.resumeVersionId;
      } else {
        // Check candidate profile's master resume
        const candProfile = await tx.candidateProfile.findUnique({
          where: { candidateId: candId }
        });
        if (candProfile?.masterResumeId) {
          targetResumeVersionId = candProfile.masterResumeId;
        }
      }

      if (!targetResumeVersionId) {
        throw new Error(
          `Application confirmation failed: No tailored resume or master resume is associated with application ${payload.applicationId}.`
        );
      }

      const resumeRecord = await tx.resumeVersion.findFirst({
        where: { id: targetResumeVersionId, candidateId: candId },
        include: { changes: true }
      });

      if (!resumeRecord) {
        throw new Error(
          `Application confirmation failed: Referenced resume version ${targetResumeVersionId} not found for candidate.`
        );
      }

      // 3. Resolve template selection
      const templateId =
        payload.templateId || (app.selectedTemplateId as ResumeTemplateId) || 'classic-v1';
      const templateVersion =
        payload.templateVersion ||
        app.selectedTemplateVersion ||
        RESUME_TEMPLATES[templateId]?.version ||
        '1.0';

      // 4. Extract structured resume content snapshot
      const candidateProfile = await this.getCandidateProfile(candId);
      const mappedResume = this.mapResumeVersion(resumeRecord);
      const frozenResumeSnapshot = extractResumeContent(mappedResume, candidateProfile);

      // 5. Freeze match score at application
      let matchScore = app.matchScoreAtApplication;
      if (matchScore === null || matchScore === undefined) {
        const match = app.job.matches[0];
        if (match) {
          matchScore = match.score;
        }
      }

      // 6. Lock the referenced resume version
      await tx.resumeVersion.update({
        where: { id: targetResumeVersionId },
        data: {
          isLocked: true,
          approvalState: 'approved',
          updatedAt: new Date()
        }
      });

      // 7. Update application state atomically
      const now = new Date();
      const existingHistory = (app.statusHistory as unknown as StatusHistoryEntry[]) || [];
      const note = payload.note || 'Candidate confirmed application submission.';
      const statusHistory = [
        ...existingHistory,
        {
          status: 'applied' as ApplicationStatus,
          timestamp: now.toISOString(),
          note
        }
      ];

      const applicationAnswers =
        app.applicationAnswers ||
        (Array.isArray(app.preparedQuestions)
          ? (app.preparedQuestions as unknown as Array<Record<string, unknown>>).map((q) => ({
              questionId: q.id,
              question: q.question,
              category: q.category,
              answer: q.candidateEditedAnswer || q.suggestedAnswer || '',
              reviewed: Boolean(q.reviewed),
              sourceKnowledgeItemIds: q.sourceKnowledgeItemIds || []
            }))
          : undefined);

      const updated = await tx.application.update({
        where: { id: app.id },
        data: {
          status: 'applied',
          dateApplied: app.dateApplied || now,
          dateClosed: null,
          tailoredResumeVersionId: targetResumeVersionId,
          resumeVersionId: targetResumeVersionId,
          selectedTemplateId: templateId,
          selectedTemplateVersion: templateVersion,
          matchScoreAtApplication: app.matchScoreAtApplication ?? matchScore,
          resumeSnapshot:
            (app.resumeSnapshot as unknown as Prisma.InputJsonValue) ||
            (frozenResumeSnapshot as unknown as Prisma.InputJsonValue),
          ...(applicationAnswers !== undefined
            ? { applicationAnswers: applicationAnswers as unknown as Prisma.InputJsonValue }
            : {}),
          statusHistory: statusHistory as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedAt: now
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      // 8. Capture immutable Job Snapshot
      const jobSnapshot: JobSnapshot = {
        title: app.job.title,
        company: app.job.company,
        location: app.job.location,
        workArrangement: app.job.workArrangement,
        description: app.job.description,
        responsibilities: app.job.responsibilities || [],
        requiredSkills: app.job.requiredSkills || [],
        preferredSkills: app.job.preferredSkills || [],
        sourceUrl: app.job.originalUrl || null,
        capturedAt: now.toISOString()
      };

      // 9. Append immutable ApplicationEvent inside transaction (if not already confirmed)
      const existingConfirmedEvent = await tx.applicationEvent.findFirst({
        where: { applicationId: app.id, type: 'applied_confirmed' }
      });

      if (!existingConfirmedEvent) {
        await tx.applicationEvent.create({
          data: {
            candidateId: candId,
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
              resumeVersionId: targetResumeVersionId,
              jobSnapshot
            } as unknown as Prisma.InputJsonValue
          }
        });
      }

      return this.mapApplication(updated);
    });
  }

  async getApplicationHistoricalPackage(
    applicationId: string,
    candidateId?: string
  ): Promise<ApplicationHistoricalPackage | null> {
    const candId = resolveCandidateId(candidateId, 'getApplicationHistoricalPackage');
    const a = await prisma.application.findFirst({
      where: { id: applicationId, candidateId: candId },
      include: {
        job: true,
        events: {
          where: { type: 'applied_confirmed' },
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!a) return null;
    const isApplied = a.status === 'applied' || Boolean(a.dateApplied);
    if (!isApplied) {
      return null;
    }

    const confirmedEvent = a.events[0];
    const eventMetadata = confirmedEvent?.metadata as Record<string, unknown> | undefined;
    const jobSnapshot = (eventMetadata?.jobSnapshot as JobSnapshot) || null;
    const isHistoricalJobSnapshot = Boolean(jobSnapshot);

    const domainJob = this.mapJob(a.job);
    const resumeSnapshot =
      (a.resumeSnapshot as unknown as import('@/types/resume-content').ResumeContent) || null;
    const applicationAnswers =
      (a.applicationAnswers as unknown as ApplicationHistoricalPackage['applicationAnswers']) || [];

    return {
      applicationId: a.id,
      candidateId: a.candidateId,
      jobId: a.jobId,
      status: a.status as ApplicationStatus,
      dateApplied: a.dateApplied ? a.dateApplied.toISOString() : a.updatedAt.toISOString(),
      matchScoreAtApplication: a.matchScoreAtApplication,
      selectedTemplateId: (a.selectedTemplateId as ResumeTemplateId) || 'classic-v1',
      selectedTemplateVersion: a.selectedTemplateVersion || '1.0',
      resumeSnapshot,
      coverLetter: a.coverLetter,
      coverLetterData:
        (a.coverLetterData as unknown as import('@/types/preparation').GroundedCoverLetter) || null,
      applicationAnswers,
      jobSnapshot,
      currentJob: domainJob,
      isHistoricalJobSnapshot,
      submissionEventTimestamp: confirmedEvent?.timestamp.toISOString()
    };
  }

  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    note?: string,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      const existing = await tx.application.findFirst({
        where: { id, candidateId: candId },
        include: { interviewStages: true, contacts: true, exports: true }
      });
      if (!existing) throw new Error(`Application ${id} not found`);

      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw new ConcurrencyError(
          `Application version mismatch. Expected version ${expectedVersion}, but database has version ${existing.version}.`
        );
      }

      const previousStatus = existing.status as ApplicationStatus;
      const now = new Date();
      const existingHistory = (existing.statusHistory as unknown as StatusHistoryEntry[]) || [];
      const statusHistory = [
        ...existingHistory,
        {
          status,
          timestamp: now.toISOString(),
          note: note || `Status transitioned to ${status}`
        }
      ];

      // Invariant: If application is already applied or closed, never wipe historical dateApplied or frozen snapshot
      const updated = await tx.application.update({
        where: { id },
        data: {
          status,
          ...(status === 'applied' && !existing.dateApplied ? { dateApplied: now } : {}),
          dateClosed: ['rejected', 'withdrawn', 'offer'].includes(status) ? now : null,
          statusHistory: statusHistory as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedAt: now
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      const wasClosed = ['rejected', 'withdrawn', 'offer'].includes(previousStatus);
      const isNowOpen = !['rejected', 'withdrawn', 'offer'].includes(status);
      const eventType = wasClosed && isNowOpen ? 'reopened' : 'status_changed';
      const eventTitle =
        wasClosed && isNowOpen ? 'Application Reopened' : `Status changed to ${status}`;
      const eventDescription =
        note ||
        (wasClosed && isNowOpen
          ? `Application reopened to ${status}`
          : `Status transitioned from ${previousStatus} to ${status}`);

      await tx.applicationEvent.create({
        data: {
          candidateId: candId,
          applicationId: id,
          jobId: existing.jobId,
          type: eventType,
          title: eventTitle,
          description: eventDescription,
          isAutomated: false
        }
      });

      return this.mapApplication(updated);
    });
  }

  async updateApplicationNotes(
    id: string,
    notes: string,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);
    const app = await prisma.application.findFirst({ where: { id, candidateId: candId } });
    if (!app) throw new Error(`Application ${id} not found`);

    if (expectedVersion !== undefined && app.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
      );
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        notes,
        version: { increment: 1 },
        updatedAt: new Date()
      },
      include: { interviewStages: true, contacts: true, exports: true }
    });
    return this.mapApplication(updated);
  }

  async updateApplicationPreparation(
    id: string,
    updates: ApplicationPreparationUpdates,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);
    const app = await prisma.application.findFirst({ where: { id, candidateId: candId } });
    if (!app) throw new Error(`Application ${id} not found`);

    if (expectedVersion !== undefined && app.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
      );
    }

    // Historical integrity invariant:
    // Once an application is applied, all submitted materials (resume, template, cover letter, questions)
    // must remain immutable snapshots of what was actually submitted!
    const isApplied = app.status === 'applied' || Boolean(app.dateApplied);
    const allowPrepUpdate = !isApplied;

    let validResumeVersionId: string | null = null;
    if (allowPrepUpdate && updates.tailoredResumeVersionId) {
      const exists = await prisma.resumeVersion.findUnique({
        where: { id: updates.tailoredResumeVersionId },
        select: { id: true }
      });
      if (exists) {
        validResumeVersionId = exists.id;
      }
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        ...(allowPrepUpdate && updates.coverLetterData
          ? { coverLetterData: updates.coverLetterData as unknown as Prisma.InputJsonValue }
          : {}),
        ...(allowPrepUpdate && updates.coverLetter !== undefined
          ? { coverLetter: updates.coverLetter }
          : {}),
        ...(allowPrepUpdate && updates.preparedQuestions
          ? { preparedQuestions: updates.preparedQuestions as unknown as Prisma.InputJsonValue }
          : {}),
        ...(allowPrepUpdate && updates.selectedTemplateId
          ? { selectedTemplateId: updates.selectedTemplateId }
          : {}),
        ...(allowPrepUpdate && updates.selectedTemplateVersion
          ? { selectedTemplateVersion: updates.selectedTemplateVersion }
          : {}),
        ...(validResumeVersionId
          ? {
              tailoredResumeVersionId: validResumeVersionId,
              resumeVersionId: validResumeVersionId
            }
          : {}),
        version: { increment: 1 },
        updatedAt: new Date()
      },
      include: { interviewStages: true, contacts: true, exports: true }
    });
    return this.mapApplication(updated);
  }

  async recordApplicationExport(
    applicationId: string,
    exportRecord: ResumeExport,
    candidateId?: string
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);
    await prisma.resumeExportRecord.create({
      data: {
        id: exportRecord.id,
        candidateId: candId,
        applicationId,
        tailoredResumeVersionId: exportRecord.tailoredResumeVersionId,
        templateId: exportRecord.templateId,
        templateVersion: exportRecord.templateVersion,
        format: exportRecord.format,
        filename: exportRecord.filename,
        createdAt: new Date(exportRecord.createdAt)
      }
    });

    const updated = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: { interviewStages: true, contacts: true, exports: true }
    });
    return this.mapApplication(updated);
  }

  async getApplicationEvents(
    applicationId?: string,
    candidateId?: string
  ): Promise<ApplicationEvent[]> {
    const candId = resolveCandidateId(candidateId);
    const events = await prisma.applicationEvent.findMany({
      where: {
        candidateId: candId,
        ...(applicationId ? { applicationId } : {})
      },
      orderBy: { timestamp: 'desc' }
    });

    return events.map((e) => ({
      id: e.id,
      applicationId: e.applicationId,
      jobId: e.jobId,
      type: e.type as unknown as ApplicationEvent['type'],
      title: e.title,
      description: e.description,
      timestamp: e.timestamp.toISOString(),
      isAutomated: e.isAutomated,
      metadata: e.metadata as unknown as ApplicationEvent['metadata']
    }));
  }

  async recordApplicationEvent(
    event: Omit<ApplicationEvent, 'id' | 'timestamp'>,
    candidateId?: string
  ): Promise<ApplicationEvent> {
    const candId = resolveCandidateId(candidateId);
    const e = await prisma.applicationEvent.create({
      data: {
        candidateId: candId,
        applicationId: event.applicationId,
        jobId: event.jobId,
        type: event.type,
        title: event.title,
        description: event.description,
        isAutomated: event.isAutomated,
        metadata: event.metadata as unknown as Prisma.InputJsonValue
      }
    });

    return {
      id: e.id,
      applicationId: e.applicationId,
      jobId: e.jobId,
      type: e.type as unknown as ApplicationEvent['type'],
      title: e.title,
      description: e.description,
      timestamp: e.timestamp.toISOString(),
      isAutomated: e.isAutomated,
      metadata: e.metadata as unknown as ApplicationEvent['metadata']
    };
  }

  async updateApplicationFollowUp(
    applicationId: string,
    updates: FollowUpUpdates,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, candidateId: candId }
      });
      if (!app) throw new Error(`Application ${applicationId} not found`);

      if (expectedVersion !== undefined && app.version !== expectedVersion) {
        throw new ConcurrencyError(
          `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
        );
      }

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          ...(updates.followUpDate !== undefined ? { followUpDate: updates.followUpDate } : {}),
          ...(updates.followUpStatus !== undefined
            ? { followUpStatus: updates.followUpStatus }
            : {}),
          ...(updates.followUpNote !== undefined ? { followUpNote: updates.followUpNote } : {}),
          version: { increment: 1 },
          updatedAt: new Date()
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      if (updates.followUpStatus === 'snoozed') {
        await tx.applicationEvent.create({
          data: {
            candidateId: candId,
            applicationId,
            jobId: updated.jobId,
            type: 'follow_up_snoozed',
            title: 'Follow-up Snoozed',
            description: updates.followUpNote || `Follow-up snoozed to ${updates.followUpDate}`,
            isAutomated: false
          }
        });
      } else if (updates.followUpStatus === 'completed') {
        await tx.applicationEvent.create({
          data: {
            candidateId: candId,
            applicationId,
            jobId: updated.jobId,
            type: 'follow_up_completed',
            title: 'Follow-up Completed',
            description: updates.followUpNote || 'Follow-up marked as completed',
            isAutomated: false
          }
        });
      } else if (updates.followUpStatus === 'pending') {
        await tx.applicationEvent.create({
          data: {
            candidateId: candId,
            applicationId,
            jobId: updated.jobId,
            type: 'follow_up_scheduled',
            title: 'Follow-up Scheduled',
            description: updates.followUpNote || `Follow-up scheduled for ${updates.followUpDate}`,
            isAutomated: false
          }
        });
      }

      return this.mapApplication(updated);
    });
  }

  async addInterviewStage(
    applicationId: string,
    stage: Omit<InterviewStage, 'id'>,
    candidateId?: string
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, candidateId: candId }
      });
      if (!app) throw new Error(`Application ${applicationId} not found`);

      await tx.interviewStage.create({
        data: {
          applicationId,
          stageName: stage.stageName,
          scheduledDate: stage.scheduledDate ? new Date(stage.scheduledDate) : null,
          completedDate: stage.completedDate ? new Date(stage.completedDate) : null,
          interviewerNames: stage.interviewerNames || [],
          meetingLink: stage.meetingLink,
          location: stage.location,
          notes: stage.notes,
          status: stage.status || 'scheduled',
          outcome: stage.outcome,
          feedback: stage.feedback
        }
      });

      await tx.applicationEvent.create({
        data: {
          candidateId: candId,
          applicationId,
          jobId: app.jobId,
          type: 'interview_scheduled',
          title: `Interview Scheduled: ${stage.stageName}`,
          description: stage.notes || `Scheduled for ${stage.scheduledDate || 'TBD'}`,
          isAutomated: false
        }
      });

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date()
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      return this.mapApplication(updated);
    });
  }

  async updateInterviewStage(
    applicationId: string,
    stage: InterviewStage,
    candidateId?: string
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, candidateId: candId }
      });
      if (!app) throw new Error(`Application ${applicationId} not found`);

      await tx.interviewStage.upsert({
        where: { id: stage.id },
        create: {
          id: stage.id,
          applicationId,
          stageName: stage.stageName,
          scheduledDate: stage.scheduledDate ? new Date(stage.scheduledDate) : null,
          completedDate: stage.completedDate ? new Date(stage.completedDate) : null,
          interviewerNames: stage.interviewerNames || [],
          meetingLink: stage.meetingLink,
          location: stage.location,
          notes: stage.notes,
          status: stage.status || 'scheduled',
          outcome: stage.outcome,
          feedback: stage.feedback
        },
        update: {
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
        }
      });

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date()
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      return this.mapApplication(updated);
    });
  }

  async deleteInterviewStage(
    applicationId: string,
    stageId: string,
    candidateId?: string
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, candidateId: candId }
      });
      if (!app) throw new Error(`Application ${applicationId} not found`);

      await tx.interviewStage.deleteMany({
        where: { id: stageId, applicationId }
      });

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date()
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      return this.mapApplication(updated);
    });
  }

  async addApplicationContact(
    applicationId: string,
    contact: Omit<ApplicationContact, 'id' | 'createdAt'>,
    candidateId?: string
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, candidateId: candId }
      });
      if (!app) throw new Error(`Application ${applicationId} not found`);

      await tx.applicationContact.create({
        data: {
          applicationId,
          name: contact.name,
          role: contact.role,
          email: contact.email,
          phone: contact.phone,
          linkedInUrl: contact.linkedInUrl,
          notes: contact.notes
        }
      });

      await tx.applicationEvent.create({
        data: {
          candidateId: candId,
          applicationId,
          jobId: app.jobId,
          type: 'contact_added',
          title: `Contact Added: ${contact.name}`,
          description: `${contact.role || 'Contact'} (${contact.email || ''})`,
          isAutomated: false
        }
      });

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date()
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      return this.mapApplication(updated);
    });
  }

  async updateApplicationContact(
    applicationId: string,
    contactId: string,
    updates: Partial<ApplicationContact>,
    candidateId?: string
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, candidateId: candId }
      });
      if (!app) throw new Error(`Application ${applicationId} not found`);

      await tx.applicationContact.update({
        where: { id: contactId },
        data: {
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.role ? { role: updates.role } : {}),
          ...(updates.email !== undefined ? { email: updates.email } : {}),
          ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
          ...(updates.linkedInUrl !== undefined ? { linkedInUrl: updates.linkedInUrl } : {}),
          ...(updates.notes !== undefined ? { notes: updates.notes } : {})
        }
      });

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date()
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      return this.mapApplication(updated);
    });
  }

  async deleteApplicationContact(
    applicationId: string,
    contactId: string,
    candidateId?: string
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, candidateId: candId }
      });
      if (!app) throw new Error(`Application ${applicationId} not found`);

      await tx.applicationContact.deleteMany({
        where: { id: contactId, applicationId }
      });

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          version: { increment: 1 },
          updatedAt: new Date()
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      return this.mapApplication(updated);
    });
  }

  async updateApplicationArchiveStatus(
    applicationId: string,
    isArchived: boolean,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = resolveCandidateId(candidateId);

    return await prisma.$transaction(async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, candidateId: candId }
      });
      if (!app) throw new Error(`Application ${applicationId} not found`);

      if (expectedVersion !== undefined && app.version !== expectedVersion) {
        throw new ConcurrencyError(
          `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
        );
      }

      const updated = await tx.application.update({
        where: { id: applicationId },
        data: {
          isArchived,
          version: { increment: 1 },
          updatedAt: new Date()
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      return this.mapApplication(updated);
    });
  }

  // --- Search Intelligence, Analytics & Next Actions ---
  async getDashboardOverview(candidateId?: string): Promise<DashboardOverviewResponse> {
    const candId = resolveCandidateId(candidateId);
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

  private mapJob(j: PrismaJob): Job {
    return {
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      workArrangement: j.workArrangement as unknown as Job['workArrangement'],
      description: j.description,
      responsibilities: j.responsibilities || [],
      requiredSkills: j.requiredSkills || [],
      preferredSkills: j.preferredSkills || [],
      experienceRequirement: j.experienceRequirement || undefined,
      educationRequirement: j.educationRequirement || undefined,
      salary: {
        min: j.salaryMin || undefined,
        max: j.salaryMax || undefined,
        currency: j.salaryCurrency || 'USD',
        interval:
          (j.salaryInterval as unknown as NonNullable<Job['salary']>['interval']) || 'yearly'
      },
      postedDate: j.postedDate
        ? typeof j.postedDate === 'string'
          ? j.postedDate
          : j.postedDate.toISOString()
        : undefined,
      source: j.source as unknown as Job['source'],
      originalUrl: j.originalUrl || undefined,
      normalizedAt: j.normalizedAt
        ? typeof j.normalizedAt === 'string'
          ? j.normalizedAt
          : j.normalizedAt.toISOString()
        : new Date().toISOString(),
      duplicateGroupId: j.duplicateGroupId || undefined,
      jobStatus: j.jobStatus as unknown as Job['jobStatus'],
      isPublic: j.isPublic,
      importedByCandidateId: j.importedByCandidateId || undefined
    };
  }

  private mapJobAnalysis(a: PrismaJobAnalysis): JobAnalysis {
    return {
      id: a.id,
      jobId: a.jobId,
      seniority: a.seniority as unknown as JobAnalysis['seniority'],
      roleCategory: a.roleCategory,
      technicalRequirements: a.technicalRequirements || [],
      softSkills: a.softSkills || [],
      importantKeywords: a.importantKeywords || [],
      extractedRequirements:
        (a.extractedRequirements as unknown as JobAnalysis['extractedRequirements']) || [],
      analysisStatus: a.analysisStatus as unknown as JobAnalysis['analysisStatus']
    };
  }

  private mapJobMatch(m: PrismaJobMatch): JobMatch {
    return {
      id: m.id,
      jobId: m.jobId,
      candidateId: m.candidateId,
      score: m.score,
      recommendation: m.recommendation as unknown as JobMatch['recommendation'],
      headline: m.headline,
      reasoning: m.reasoning,
      strongMatches: (m.strongMatches as unknown as JobMatch['strongMatches']) || [],
      partialMatches: (m.partialMatches as unknown as JobMatch['partialMatches']) || [],
      missingRequirements:
        (m.missingRequirements as unknown as JobMatch['missingRequirements']) || [],
      supportingCandidateEvidence:
        (m.supportingCandidateEvidence as unknown as JobMatch['supportingCandidateEvidence']) || []
    };
  }

  private mapApplication(
    a: PrismaApplication & {
      interviewStages?: PrismaInterviewStage[];
      contacts?: PrismaApplicationContact[];
      exports?: PrismaResumeExportRecord[];
    }
  ): Application {
    return {
      id: a.id,
      jobId: a.jobId,
      candidateId: a.candidateId,
      status: a.status as unknown as Application['status'],
      dateDiscovered: a.dateDiscovered.toISOString(),
      dateApplied: a.dateApplied ? a.dateApplied.toISOString() : undefined,
      dateClosed: a.dateClosed ? a.dateClosed.toISOString() : undefined,
      isArchived: a.isArchived,
      notes: a.notes || undefined,
      resumeVersionId: a.resumeVersionId || undefined,
      tailoredResumeVersionId: a.tailoredResumeVersionId || undefined,
      selectedTemplateId: (a.selectedTemplateId as unknown as ResumeTemplateId) || undefined,
      selectedTemplateVersion: a.selectedTemplateVersion || undefined,
      matchScoreAtApplication: a.matchScoreAtApplication || undefined,
      resumeSnapshot: (a.resumeSnapshot as unknown as Application['resumeSnapshot']) || undefined,
      coverLetter: a.coverLetter || undefined,
      coverLetterData: a.coverLetterData as unknown as Application['coverLetterData'],
      applicationAnswers: a.applicationAnswers as unknown as Application['applicationAnswers'],
      preparedQuestions: a.preparedQuestions as unknown as Application['preparedQuestions'],
      followUpDate: a.followUpDate || undefined,
      followUpStatus: (a.followUpStatus as unknown as Application['followUpStatus']) || 'none',
      followUpNote: a.followUpNote || undefined,
      statusHistory: (a.statusHistory as unknown as Application['statusHistory']) || [],
      version: a.version,
      interviewStages: (a.interviewStages || []).map((s) => ({
        id: s.id,
        stageName: s.stageName,
        scheduledDate: s.scheduledDate ? s.scheduledDate.toISOString() : undefined,
        completedDate: s.completedDate ? s.completedDate.toISOString() : undefined,
        interviewerNames: s.interviewerNames,
        meetingLink: s.meetingLink || undefined,
        location: s.location || undefined,
        notes: s.notes || undefined,
        status: s.status as unknown as InterviewStage['status'],
        outcome: s.outcome as unknown as InterviewStage['outcome'],
        feedback: s.feedback || undefined
      })),
      contacts: (a.contacts || []).map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        email: c.email || undefined,
        phone: c.phone || undefined,
        linkedInUrl: c.linkedInUrl || undefined,
        notes: c.notes || undefined,
        createdAt: c.createdAt.toISOString()
      })),
      exports: (a.exports || []).map((exp) => ({
        id: exp.id,
        candidateId: exp.candidateId,
        tailoredResumeVersionId: exp.tailoredResumeVersionId,
        templateId: exp.templateId as unknown as ResumeExport['templateId'],
        templateVersion: exp.templateVersion,
        format: exp.format as unknown as ResumeExport['format'],
        filename: exp.filename,
        createdAt: exp.createdAt.toISOString()
      }))
    };
  }

  private mapJobSourceReference(r: PrismaJobSourceReference): JobSourceReference {
    return {
      id: r.id,
      jobId: r.jobId,
      source: r.source,
      sourceJobId: r.sourceJobId,
      sourceUrl: r.sourceUrl,
      normalizedUrl: r.normalizedUrl,
      sourceStatus: r.sourceStatus as SourceStatus,
      verificationStatus: r.verificationStatus as VerificationStatus,
      lastVerifiedAt: r.lastVerifiedAt,
      lastVerificationError: r.lastVerificationError,
      isPrimary: r.isPrimary,
      referenceRole: r.referenceRole as ReferenceRole,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  private mapCandidateJobState(s: PrismaCandidateJobState): CandidateJobState {
    return {
      id: s.id,
      candidateId: s.candidateId,
      jobId: s.jobId,
      status: s.status as CandidateJobStatus,
      dismissedReason: s.dismissedReason,
      firstViewedAt: s.firstViewedAt,
      savedAt: s.savedAt,
      dismissedAt: s.dismissedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
  }

  private mapSavedSearch(s: PrismaSavedSearch): SavedSearch {
    return {
      id: s.id,
      candidateId: s.candidateId,
      name: s.name,
      query: s.query,
      locations: s.locations || [],
      workArrangements: s.workArrangements || [],
      roleCategories: s.roleCategories || [],
      seniorityLevels: s.seniorityLevels || [],
      minSalary: s.minSalary,
      currency: s.currency,
      alertFrequency: s.alertFrequency,
      filterVersion: s.filterVersion,
      isEnabled: s.isEnabled,
      minMatchScore: s.minMatchScore,
      lastExecutedAt: s.lastExecutedAt,
      lastMatchCount: s.lastMatchCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
  }

  private mapSavedSearchAlert(a: PrismaSavedSearchAlert): SavedSearchAlert {
    return {
      id: a.id,
      candidateId: a.candidateId,
      savedSearchId: a.savedSearchId,
      jobId: a.jobId,
      savedSearchVersion: a.savedSearchVersion,
      generatedAt: a.generatedAt,
      deliveredAt: a.deliveredAt,
      status: a.status
    };
  }

  private mapCandidateNotification(n: PrismaCandidateNotification): CandidateNotification {
    return {
      id: n.id,
      candidateId: n.candidateId,
      type: n.type,
      title: n.title,
      message: n.message,
      relatedJobId: n.relatedJobId,
      relatedSavedSearchId: n.relatedSavedSearchId,
      readAt: n.readAt,
      createdAt: n.createdAt
    };
  }
}
