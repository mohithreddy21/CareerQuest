import { prisma } from '@/lib/prisma';
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
  Prisma
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
import { ConcurrencyError } from '@/types/errors';
import { extractResumeContent } from '@/types/resume-content';
import { RESUME_TEMPLATES } from '@/features/templates/constants/templates';

const DEFAULT_DEMO_CANDIDATE_ID = 'cand-1';

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
  // --- Candidate Identity, Profile & Preferences ---
  async getCandidateProfile(candidateId?: string): Promise<CandidateProfile> {
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

    // Public jobs OR private jobs imported by this candidate
    const jobs = await prisma.job.findMany({
      where: {
        OR: [{ isPublic: true }, { importedByCandidateId: candId }],
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
        matches: {
          where: { candidateId: candId }
        },
        applications: {
          where: { candidateId: candId }
        }
      }
    });

    let mapped = jobs.map((j) => {
      const matchRecord = j.matches[0];
      const appRecord = j.applications[0];

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || match.candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
          existingJob: domainJob || undefined,
          job: domainJob || undefined,
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

    // 2. Check for exact source duplicate: (source, normalizedUrl)
    const existingRef = await prisma.jobSourceReference.findUnique({
      where: {
        source_normalizedUrl: {
          source: norm.source,
          normalizedUrl: norm.normalizedUrl
        }
      },
      include: { job: true }
    });

    if (existingRef && !force) {
      const domainJob = await this.getJobById(existingRef.jobId, candId);
      const analysis = await this.getJobAnalysis(existingRef.jobId);
      const match = await this.getJobMatch(existingRef.jobId, candId);

      return {
        success: false,
        isDuplicate: true,
        existingJob: domainJob || undefined,
        job: domainJob || undefined,
        analysis: analysis || undefined,
        match: match || undefined,
        adapterName: ingestResult.adapterName,
        error: 'A matching job already exists in your workspace.'
      };
    }

    // 3. Atomically persist Job and JobSourceReference
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
          jobStatus: 'active',
          isPublic: false,
          importedByCandidateId: candId
        }
      });

      if (existingRef) {
        await tx.jobSourceReference.update({
          where: { id: existingRef.id },
          data: {
            jobId: j.id,
            sourceJobId: norm.sourceJobId,
            sourceUrl: norm.sourceUrl,
            sourceStatus: 'active',
            verificationStatus: 'verified_accessible',
            lastVerifiedAt: new Date(),
            isPrimary: true,
            referenceRole: 'primary',
            lastSeenAt: new Date()
          }
        });
      } else {
        await tx.jobSourceReference.create({
          data: {
            jobId: j.id,
            source: norm.source,
            sourceJobId: norm.sourceJobId,
            sourceUrl: norm.sourceUrl,
            normalizedUrl: norm.normalizedUrl,
            sourceStatus: 'active',
            verificationStatus: 'verified_accessible',
            lastVerifiedAt: new Date(),
            isPrimary: true,
            referenceRole: 'primary'
          }
        });
      }

      return j;
    });

    const domainJob = this.mapJob(createdJob);

    // 4. Trigger Analysis
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

    // 5. Trigger Match if Candidate exists
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
      job: domainJob,
      analysis,
      match,
      adapterName: ingestResult.adapterName
    };
  }

  async importJobFromText(
    text: string,
    title?: string,
    company?: string,
    candidateId?: string
  ): Promise<ImportJobResponse> {
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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

      await tx.jobSourceReference.create({
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
          referenceRole: 'primary'
        }
      });

      return j;
    });

    const domainJob = this.mapJob(createdJob);

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
      job: domainJob,
      analysis,
      match,
      adapterName: ingestResult.adapterName
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

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.candidateJobState.findUnique({
        where: { candidateId_jobId: { candidateId, jobId } }
      });

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
    search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt' | 'candidateId'> & {
      id?: string;
      candidateId?: string;
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
          filterVersion: search.filterVersion || '1.0',
          lastExecutedAt: search.lastExecutedAt ? new Date(search.lastExecutedAt) : null,
          lastMatchCount: search.lastMatchCount || 0
        }
      });
      return this.mapSavedSearch(updated);
    }

    const created = await prisma.savedSearch.create({
      data: {
        candidateId,
        name: search.name,
        query: search.query || null,
        locations: search.locations || [],
        workArrangements: search.workArrangements || [],
        roleCategories: search.roleCategories || [],
        seniorityLevels: search.seniorityLevels || [],
        minSalary: search.minSalary || null,
        currency: search.currency || null,
        alertFrequency: search.alertFrequency || 'weekly',
        filterVersion: search.filterVersion || '1.0',
        lastExecutedAt: search.lastExecutedAt ? new Date(search.lastExecutedAt) : null,
        lastMatchCount: search.lastMatchCount || 0
      }
    });
    return this.mapSavedSearch(created);
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

  // --- Candidate Knowledge Bank & Provenance ---
  async getKnowledgeBank(candidateId?: string): Promise<CandidateKnowledgeBank> {
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || item.candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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

    return {
      id: saved.id,
      candidateId: saved.candidateId,
      category: saved.category as unknown as KnowledgeItem['category'],
      content: saved.content as unknown as KnowledgeItem['content'],
      status: saved.status as unknown as KnowledgeItem['status'],
      provenance: saved.provenance.map((p) => ({
        id: p.id,
        sourceType: p.sourceType as unknown as KnowledgeProvenance['sourceType'],
        sourceLabel: p.sourceLabel,
        documentId: p.documentId || undefined,
        extractedSnippet: p.extractedSnippet || undefined,
        confidence: p.confidence || undefined,
        addedAt: p.addedAt.toISOString()
      })),
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString()
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
    const res = await prisma.knowledgeItem.deleteMany({
      where: { id: itemId, candidateId: candId }
    });
    return res.count > 0;
  }

  // --- Ingestion Batches & Documents ---
  async getProposedBatches(candidateId?: string): Promise<ProposedIngestionBatch[]> {
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
    const batches = await prisma.resumeIngestionBatch.findMany({
      where: { candidateId: candId },
      orderBy: { uploadedAt: 'desc' }
    });

    return batches.map((b) => ({
      id: b.id,
      candidateId: b.candidateId,
      fileName: b.fileName,
      uploadedAt: b.uploadedAt.toISOString(),
      items: b.items as unknown as ProposedIngestionBatch['items'],
      status: b.status as unknown as ProposedIngestionBatch['status']
    }));
  }

  async createProposedBatch(
    batch: Omit<ProposedIngestionBatch, 'id' | 'uploadedAt'>,
    candidateId?: string
  ): Promise<ProposedIngestionBatch> {
    const candId = candidateId || batch.candidateId || DEFAULT_DEMO_CANDIDATE_ID;
    const b = await prisma.resumeIngestionBatch.create({
      data: {
        candidateId: candId,
        fileName: batch.fileName,
        items: batch.items as unknown as Prisma.InputJsonValue,
        status: batch.status || 'pending_review'
      }
    });

    return {
      id: b.id,
      candidateId: b.candidateId,
      fileName: b.fileName,
      uploadedAt: b.uploadedAt.toISOString(),
      items: b.items as unknown as ProposedIngestionBatch['items'],
      status: b.status as unknown as ProposedIngestionBatch['status']
    };
  }

  async resolveProposedBatch(
    batchId: string,
    candidateId?: string
  ): Promise<ProposedIngestionBatch> {
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
      fileName: b.fileName,
      uploadedAt: b.uploadedAt.toISOString(),
      items: b.items as unknown as ProposedIngestionBatch['items'],
      status: b.status as unknown as ProposedIngestionBatch['status']
    };
  }

  async saveProposedBatch(
    batch: ProposedIngestionBatch,
    candidateId?: string
  ): Promise<ProposedIngestionBatch> {
    const candId = candidateId || batch.candidateId || DEFAULT_DEMO_CANDIDATE_ID;
    const b = await prisma.resumeIngestionBatch.upsert({
      where: { id: batch.id },
      create: {
        id: batch.id,
        candidateId: candId,
        fileName: batch.fileName,
        items: batch.items as unknown as Prisma.InputJsonValue,
        status: batch.status || 'pending_review'
      },
      update: {
        fileName: batch.fileName,
        items: batch.items as unknown as Prisma.InputJsonValue,
        status: batch.status
      }
    });

    return {
      id: b.id,
      candidateId: b.candidateId,
      fileName: b.fileName,
      uploadedAt: b.uploadedAt.toISOString(),
      items: b.items as unknown as ProposedIngestionBatch['items'],
      status: b.status as unknown as ProposedIngestionBatch['status']
    };
  }

  async deleteProposedBatch(batchId: string, candidateId?: string): Promise<boolean> {
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
    const res = await prisma.resumeIngestionBatch.deleteMany({
      where: { id: batchId, candidateId: candId }
    });
    return res.count > 0;
  }

  async getCandidateDocuments(candidateId?: string): Promise<CandidateDocument[]> {
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || doc.candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || record.candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
      // 0a. Delete candidate's SavedSearches and CandidateJobStates
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
    const resumes = await prisma.resumeVersion.findMany({
      where: { candidateId: candId },
      include: { changes: true },
      orderBy: { createdAt: 'desc' }
    });

    return resumes.map((r) => this.mapResumeVersion(r));
  }

  async getResumeVersionById(id: string, candidateId?: string): Promise<ResumeVersion | null> {
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || version.candidateId || DEFAULT_DEMO_CANDIDATE_ID;
    const versionId =
      version.id || `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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

    if (filters?.search?.trim()) {
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
          matchScoreAtApplication: matchScore,
          resumeSnapshot: frozenResumeSnapshot as unknown as Prisma.InputJsonValue,
          statusHistory: statusHistory as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedAt: now
        },
        include: { interviewStages: true, contacts: true, exports: true }
      });

      // 8. Append immutable ApplicationEvent inside transaction
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
            resumeVersionId: targetResumeVersionId
          }
        }
      });

      return this.mapApplication(updated);
    });
  }

  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    note?: string,
    candidateId?: string,
    expectedVersion?: number
  ): Promise<Application> {
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
    const app = await prisma.application.findFirst({ where: { id, candidateId: candId } });
    if (!app) throw new Error(`Application ${id} not found`);

    if (expectedVersion !== undefined && app.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Application version mismatch. Expected version ${expectedVersion}, but database has version ${app.version}.`
      );
    }

    // Historical integrity invariant:
    // Once an application is applied, selectedTemplateId, selectedTemplateVersion, and tailoredResumeVersionId
    // must remain immutable snapshots of what was actually submitted!
    const isApplied = app.status === 'applied' || Boolean(app.dateApplied);
    const allowResumeUpdate = !isApplied;

    const updated = await prisma.application.update({
      where: { id },
      data: {
        ...(updates.coverLetterData
          ? { coverLetterData: updates.coverLetterData as unknown as Prisma.InputJsonValue }
          : {}),
        ...(updates.coverLetter !== undefined ? { coverLetter: updates.coverLetter } : {}),
        ...(updates.preparedQuestions
          ? { preparedQuestions: updates.preparedQuestions as unknown as Prisma.InputJsonValue }
          : {}),
        ...(allowResumeUpdate && updates.selectedTemplateId
          ? { selectedTemplateId: updates.selectedTemplateId }
          : {}),
        ...(allowResumeUpdate && updates.selectedTemplateVersion
          ? { selectedTemplateVersion: updates.selectedTemplateVersion }
          : {}),
        ...(allowResumeUpdate && updates.tailoredResumeVersionId
          ? {
              tailoredResumeVersionId: updates.tailoredResumeVersionId,
              resumeVersionId: updates.tailoredResumeVersionId
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;

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
    const candId = candidateId || DEFAULT_DEMO_CANDIDATE_ID;
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
      lastExecutedAt: s.lastExecutedAt,
      lastMatchCount: s.lastMatchCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    };
  }
}
