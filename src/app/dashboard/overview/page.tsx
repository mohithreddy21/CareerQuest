import PageContainer from '@/components/layout/page-container';
import { getQueryClient } from '@/lib/query-client';
import { dashboardOverviewQueryOptions } from '@/features/overview/api/queries';
import {
  applicationsQueryOptions,
  applicationEventsQueryOptions
} from '@/features/applications/api/queries';
import {
  searchAnalyticsQueryOptions,
  searchInsightsQueryOptions
} from '@/features/analytics/api/queries';
import OverviewPage from '@/features/overview/components/overview-page';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Dashboard | CareerQuest'
};

function OverviewSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6'>
      <Skeleton className='h-40 w-full rounded-xl' />
      <Skeleton className='h-28 w-full rounded-xl' />
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <Skeleton className='h-96 rounded-xl lg:col-span-2' />
        <Skeleton className='h-96 rounded-xl' />
      </div>
    </div>
  );
}

export default async function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(dashboardOverviewQueryOptions());
  void queryClient.prefetchQuery(applicationsQueryOptions());
  void queryClient.prefetchQuery(applicationEventsQueryOptions());
  void queryClient.prefetchQuery(searchAnalyticsQueryOptions());
  void queryClient.prefetchQuery(searchInsightsQueryOptions());

  return (
    <PageContainer
      pageTitle='Dashboard'
      pageDescription='Overview of your job search progress and priority actions.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<OverviewSkeleton />}>
          <OverviewPage />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
