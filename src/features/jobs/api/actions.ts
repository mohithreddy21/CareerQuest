'use server';

import { requireCandidateId } from '@/lib/auth';
import { handleActionError, serializeActionResponse } from '@/lib/action-utils';
import { importJobSchema, runJobAnalysisSchema } from './schemas';
import { importJobByUrl, runJobAnalysis } from './service';
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

export async function runJobAnalysisAction(payload: {
  jobId: string;
}): Promise<{ analysis: JobAnalysis; match: JobMatch }> {
  try {
    const validated = runJobAnalysisSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await runJobAnalysis(validated.jobId, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}
