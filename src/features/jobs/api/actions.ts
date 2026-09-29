'use server';

import { requireCandidateId } from '@/lib/auth';
import { handleActionError, serializeActionResponse } from '@/lib/action-utils';
import {
  importJobSchema,
  importJobFromTextSchema,
  runJobAnalysisSchema,
  ImportJobFromTextPayload
} from './schemas';
import { importJobByUrl, importJobFromText, runJobAnalysis } from './service';
import { ImportJobPayload, ImportJobResponse } from './types';
import { JobAnalysis, JobMatch } from '@/types/domain';

export async function importJobByUrlAction(payload: ImportJobPayload): Promise<ImportJobResponse> {
  try {
    const validated = importJobSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await importJobByUrl(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function importJobFromTextAction(
  payload: ImportJobFromTextPayload
): Promise<ImportJobResponse> {
  try {
    const validated = importJobFromTextSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await importJobFromText(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function runJobAnalysisAction(payload: {
  jobId: string;
  forceReanalyze?: boolean;
}): Promise<{ analysis: JobAnalysis; match: JobMatch }> {
  try {
    const validated = runJobAnalysisSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await runJobAnalysis(validated.jobId, candidateId, validated.forceReanalyze);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getDiscoveryRankingAction(
  params: import('../lib/ranking').DiscoveryRankingParams
): Promise<import('../lib/ranking').DiscoveryRankingResponse> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const { opportunityPriorityService } = await import('../services/opportunity-priority-service');
    const result = await opportunityPriorityService.getDiscoveryRanking(params, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function setCandidateJobStateAction(payload: {
  jobId: string;
  status: import('@/types/domain').CandidateJobStatus;
  dismissedReason?: string;
}): Promise<import('@/types/domain').CandidateJobState> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const { careerRepository } = await import('@/services/career-repository');
    const result = await careerRepository.setCandidateJobState(
      payload.jobId,
      payload.status,
      candidateId,
      payload.dismissedReason
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function undoCandidateJobStateAction(payload: {
  jobId: string;
  targetPreviousState?: import('@/types/domain').CandidateJobStatus;
}): Promise<import('@/types/domain').CandidateJobState | null> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const { careerRepository } = await import('@/services/career-repository');
    const result = await careerRepository.undoCandidateJobState(
      payload.jobId,
      candidateId,
      payload.targetPreviousState
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getJobSourceReferencesAction(
  jobId: string
): Promise<import('@/types/domain').JobSourceReference[]> {
  try {
    const { careerRepository } = await import('@/services/career-repository');
    const result = await careerRepository.getJobSourceReferences(jobId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getCandidateJobStateAction(
  jobId: string
): Promise<import('@/types/domain').CandidateJobState | null> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const { careerRepository } = await import('@/services/career-repository');
    const result = await careerRepository.getCandidateJobState(jobId, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getOpportunityPriorityAction(
  jobId: string
): Promise<import('../lib/ranking').OpportunityPriorityResult | null> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const { careerRepository } = await import('@/services/career-repository');
    const { opportunityPriorityService } = await import('../services/opportunity-priority-service');
    const job = await careerRepository.getJobById(jobId, candidateId);
    if (!job) return null;
    const match = await careerRepository.getJobMatch(jobId, candidateId);
    const preferences = await careerRepository.getCandidatePreferences(candidateId);
    const sources = await careerRepository.getJobSourceReferences(jobId);
    const priority = opportunityPriorityService.calculatePriority(job, candidateId, {
      match,
      preferences,
      sources
    });
    return serializeActionResponse(priority);
  } catch (error) {
    return handleActionError(error);
  }
}
