import { queryOptions } from '@tanstack/react-query';
import { getRetrievedKnowledgeForJob, getTailoredResumeForJob } from './service';

export const tailoringKeys = {
  all: ['tailoring'] as const,
  retrievedKnowledge: (jobId: string, candidateId: string = 'cand-1') =>
    [...tailoringKeys.all, 'retrieved', jobId, candidateId] as const,
  tailoredResume: (jobId: string, candidateId: string = 'cand-1') =>
    [...tailoringKeys.all, 'resume', jobId, candidateId] as const
};

export const retrievedKnowledgeQueryOptions = (jobId: string, candidateId: string = 'cand-1') =>
  queryOptions({
    queryKey: tailoringKeys.retrievedKnowledge(jobId, candidateId),
    queryFn: () => getRetrievedKnowledgeForJob(jobId, candidateId),
    staleTime: 5 * 60 * 1000
  });

export const tailoredResumeForJobQueryOptions = (jobId: string, candidateId: string = 'cand-1') =>
  queryOptions({
    queryKey: tailoringKeys.tailoredResume(jobId, candidateId),
    queryFn: () => getTailoredResumeForJob(jobId, candidateId),
    staleTime: 5 * 60 * 1000
  });
