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

export const savedSearchKeys = {
  all: ['saved-searches'] as const,
  list: () => [...savedSearchKeys.all, 'list'] as const,
  detail: (id: string) => [...savedSearchKeys.all, 'detail', id] as const,
  execution: (id: string) => [...savedSearchKeys.all, 'execution', id] as const
};

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const
};

export const savedSearchesQueryOptions = () =>
  queryOptions({
    queryKey: savedSearchKeys.list(),
    queryFn: async () => {
      const { getSavedSearchesAction } = await import('./saved-search-actions');
      return getSavedSearchesAction();
    }
  });

export const notificationsQueryOptions = () =>
  queryOptions({
    queryKey: notificationKeys.list(),
    queryFn: async () => {
      const { getNotificationsAction } = await import('./saved-search-actions');
      return getNotificationsAction();
    }
  });

export const discoveryKeys = {
  all: ['discovery'] as const,
  ranking: (params: import('../lib/ranking').DiscoveryRankingParams) =>
    [...discoveryKeys.all, 'ranking', params] as const,
  sources: (jobId: string) => [...discoveryKeys.all, 'sources', jobId] as const,
  state: (jobId: string) => [...discoveryKeys.all, 'state', jobId] as const
};

export const discoveryRankingQueryOptions = (
  params: import('../lib/ranking').DiscoveryRankingParams
) =>
  queryOptions({
    queryKey: discoveryKeys.ranking(params),
    queryFn: async () => {
      const { getDiscoveryRankingAction } = await import('./actions');
      return getDiscoveryRankingAction(params);
    }
  });

export const jobSourceReferencesQueryOptions = (jobId: string) =>
  queryOptions({
    queryKey: discoveryKeys.sources(jobId),
    queryFn: async () => {
      const { getJobSourceReferencesAction } = await import('./actions');
      return getJobSourceReferencesAction(jobId);
    }
  });

export const candidateJobStateQueryOptions = (jobId: string) =>
  queryOptions({
    queryKey: discoveryKeys.state(jobId),
    queryFn: async () => {
      const { getCandidateJobStateAction } = await import('./actions');
      return getCandidateJobStateAction(jobId);
    }
  });

export const opportunityPriorityOptions = (jobId: string) =>
  queryOptions({
    queryKey: ['discovery', 'priority', jobId] as const,
    queryFn: async () => {
      const { getOpportunityPriorityAction } = await import('./actions');
      return getOpportunityPriorityAction(jobId);
    }
  });
