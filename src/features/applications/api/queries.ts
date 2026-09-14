import { queryOptions } from '@tanstack/react-query';
import { getApplicationById, getApplicationEvents, getApplications } from './service';

export const applicationKeys = {
  all: ['applications'] as const,
  list: () => [...applicationKeys.all, 'list'] as const,
  detail: (id: string) => [...applicationKeys.all, 'detail', id] as const,
  events: (id?: string) => [...applicationKeys.all, 'events', id ?? 'all'] as const
};

export const applicationsQueryOptions = () =>
  queryOptions({
    queryKey: applicationKeys.list(),
    queryFn: () => getApplications()
  });

export const applicationByIdOptions = (id: string) =>
  queryOptions({
    queryKey: applicationKeys.detail(id),
    queryFn: () => getApplicationById(id)
  });

export const applicationEventsQueryOptions = (applicationId?: string) =>
  queryOptions({
    queryKey: applicationKeys.events(applicationId),
    queryFn: () => getApplicationEvents(applicationId)
  });
