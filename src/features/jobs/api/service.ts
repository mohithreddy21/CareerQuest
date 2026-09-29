'use server';

import { requireCandidateId } from '@/lib/auth';
import { careerRepository } from '@/services/career-repository';
import { ImportJobPayload, ImportJobResponse, JobFilters, JobsResponse } from './types';
import { Job, JobAnalysis, JobMatch } from '@/types/domain';

export async function getJobs(filters?: JobFilters, candidateId?: string): Promise<JobsResponse> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const items = await careerRepository.getJobs(filters, resolvedId);
  return {
    items,
    total_items: items.length
  };
}

export async function getJobById(id: string, candidateId?: string): Promise<Job | null> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return careerRepository.getJobById(id, resolvedId);
}

export async function getJobAnalysis(jobId: string): Promise<JobAnalysis | null> {
  return careerRepository.getJobAnalysis(jobId);
}

export async function getJobMatch(jobId: string, candidateId?: string): Promise<JobMatch | null> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return careerRepository.getJobMatch(jobId, resolvedId);
}

export async function importJobByUrl(
  payload: ImportJobPayload,
  candidateId?: string
): Promise<ImportJobResponse> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const res = await careerRepository.importJobByUrl(payload.url, payload.force, resolvedId);
  if (res.success && res.job) {
    try {
      const { savedSearchService } = await import('../services/saved-search-service');
      await savedSearchService.evaluateInstantAlertsForJob(res.job.id, { candidateId: resolvedId });
    } catch {
      // Instant alert evaluation failure is non-fatal to job ingestion
    }
  }
  return res;
}

export async function importJobFromText(
  payload: { text: string; title?: string; company?: string },
  candidateId?: string
): Promise<ImportJobResponse> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const res = await careerRepository.importJobFromText(
    payload.text,
    payload.title,
    payload.company,
    resolvedId
  );
  if (res.success && res.job) {
    try {
      const { savedSearchService } = await import('../services/saved-search-service');
      await savedSearchService.evaluateInstantAlertsForJob(res.job.id, { candidateId: resolvedId });
    } catch {
      // Instant alert evaluation failure is non-fatal to job ingestion
    }
  }
  return res;
}

export async function runJobAnalysis(
  jobId: string,
  candidateId?: string,
  forceReanalyze = false
): Promise<{
  analysis: JobAnalysis;
  match: JobMatch;
}> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const job = await careerRepository.getJobById(jobId, resolvedId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  const candidate = await careerRepository.getCandidateProfile(resolvedId);

  const { analysisService } = await import('../services/analysis-service');
  const { matchService } = await import('../services/match-service');

  // 1. REUSE CHECK: Before invoking analysis, check if a valid JobAnalysis already exists
  let analysis = forceReanalyze ? null : await careerRepository.getJobAnalysis(jobId);
  if (!analysis) {
    analysis = await analysisService.analyzeJob(job);
    await careerRepository.saveJobAnalysis(analysis);
  }

  // 2. Compute match with quality-safeguarded matching engine
  const match = await matchService.calculateMatch(job, analysis, candidate);
  await careerRepository.saveJobMatch(match, resolvedId);

  return { analysis, match };
}
