import { queryOptions } from '@tanstack/react-query';
import { getJobAnalysis, getJobById, getJobMatch, getJobs } from './service';
import { JobFilters } from './types';

export const jobKeys = {
  all: ['jobs'] as const,
  list: (filters?: JobFilters) => [...jobKeys.all, 'list', filters] as const,
  detail: (id: string) => [...jobKeys.all, 'detail', id] as const,
  analysis: (jobId: string) => [...jobKeys.all, 'analysis', jobId] as const,
  match: (jobId: string) => [...jobKeys.all, 'match', jobId] as const
};

export const jobsQueryOptions = (filters?: JobFilters) =>
  queryOptions({
    queryKey: jobKeys.list(filters),
    queryFn: () => getJobs(filters)
  });

export const jobByIdOptions = (id: string) =>
  queryOptions({
    queryKey: jobKeys.detail(id),
    queryFn: () => getJobById(id)
  });

export const jobAnalysisOptions = (jobId: string) =>
  queryOptions({
    queryKey: jobKeys.analysis(jobId),
    queryFn: () => getJobAnalysis(jobId)
  });

export const jobMatchOptions = (jobId: string) =>
  queryOptions({
    queryKey: jobKeys.match(jobId),
    queryFn: () => getJobMatch(jobId)
  });
