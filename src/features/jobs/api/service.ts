import { careerRepository } from '@/services/career-repository';
import { ImportJobPayload, ImportJobResponse, JobFilters, JobsResponse } from './types';
import { Job, JobAnalysis, JobMatch } from '@/types/domain';

export async function getJobs(filters?: JobFilters, candidateId?: string): Promise<JobsResponse> {
  const items = await careerRepository.getJobs(filters, candidateId);
  return {
    items,
    total_items: items.length
  };
}

export async function getJobById(id: string, candidateId?: string): Promise<Job | null> {
  return careerRepository.getJobById(id, candidateId);
}

export async function getJobAnalysis(jobId: string): Promise<JobAnalysis | null> {
  return careerRepository.getJobAnalysis(jobId);
}

export async function getJobMatch(jobId: string, candidateId?: string): Promise<JobMatch | null> {
  return careerRepository.getJobMatch(jobId, candidateId);
}

export async function importJobByUrl(
  payload: ImportJobPayload,
  candidateId?: string
): Promise<ImportJobResponse> {
  return careerRepository.importJobByUrl(payload.url, payload.force, candidateId);
}

export async function importJobFromText(
  payload: { text: string; title?: string; company?: string },
  candidateId?: string
): Promise<ImportJobResponse> {
  return careerRepository.importJobFromText(
    payload.text,
    payload.title,
    payload.company,
    candidateId
  );
}

export async function runJobAnalysis(
  jobId: string,
  candidateId?: string
): Promise<{
  analysis: JobAnalysis;
  match: JobMatch;
}> {
  const job = await careerRepository.getJobById(jobId, candidateId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  const candidate = await careerRepository.getCandidateProfile(candidateId);

  const { analysisService } = await import('../services/analysis-service');
  const { matchService } = await import('../services/match-service');

  const analysis = await analysisService.analyzeJob(job);
  await careerRepository.saveJobAnalysis(analysis);

  const match = await matchService.calculateMatch(job, analysis, candidate);
  await careerRepository.saveJobMatch(match, candidateId);

  return { analysis, match };
}
