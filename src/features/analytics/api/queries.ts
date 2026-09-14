import { queryOptions } from '@tanstack/react-query';
import { getSearchAnalytics, getSearchInsights } from './service';

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: () => [...analyticsKeys.all, 'overview'] as const,
  insights: () => [...analyticsKeys.all, 'insights'] as const
};

export const searchAnalyticsQueryOptions = () =>
  queryOptions({
    queryKey: analyticsKeys.overview(),
    queryFn: () => getSearchAnalytics()
  });

export const searchInsightsQueryOptions = () =>
  queryOptions({
    queryKey: analyticsKeys.insights(),
    queryFn: () => getSearchInsights()
  });
