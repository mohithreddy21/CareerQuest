import { queryOptions } from '@tanstack/react-query';
import { getDashboardOverview } from './service';

export const overviewKeys = {
  all: ['overview'] as const,
  dashboard: () => [...overviewKeys.all, 'dashboard'] as const
};

export const dashboardOverviewQueryOptions = () =>
  queryOptions({
    queryKey: overviewKeys.dashboard(),
    queryFn: () => getDashboardOverview()
  });
