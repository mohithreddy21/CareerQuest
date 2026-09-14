import { queryOptions } from '@tanstack/react-query';
import { getDocuments } from './service';

export const documentKeys = {
  all: ['documents'] as const,
  list: () => [...documentKeys.all, 'list'] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const
};

export const documentsQueryOptions = () =>
  queryOptions({
    queryKey: documentKeys.list(),
    queryFn: () => getDocuments()
  });
