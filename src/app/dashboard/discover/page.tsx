import PageContainer from '@/components/layout/page-container';
import { getQueryClient } from '@/lib/query-client';
import { jobsQueryOptions } from '@/features/jobs/api/queries';
import DiscoverPage from '@/features/jobs/components/discover-page';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

import { searchParamsCache } from '@/lib/searchparams';

export const metadata = {
  title: 'Discover Jobs | CareerQuest'
};

function DiscoverSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6'>
      <div className='space-y-2'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-4 w-96' />
      </div>
      <Skeleton className='h-10 w-full' />
      <div className='grid gap-4'>
        <Skeleton className='h-36 w-full rounded-xl' />
        <Skeleton className='h-36 w-full rounded-xl' />
        <Skeleton className='h-36 w-full rounded-xl' />
      </div>
    </div>
  );
}

export default async function Page(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const parsed = searchParamsCache.parse(searchParams);
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    jobsQueryOptions({
      search: parsed.search || undefined,
      source: parsed.source && parsed.source !== 'all' ? parsed.source : undefined,
      workArrangement:
        parsed.workArrangement && parsed.workArrangement !== 'all'
          ? parsed.workArrangement
          : undefined,
      sort: parsed.sort || undefined,
      minMatch: parsed.minMatch || undefined
    })
  );

  return (
    <PageContainer
      pageTitle='Discover Jobs'
      pageDescription='Normalized opportunities from supported sources and custom URL imports.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<DiscoverSkeleton />}>
          <DiscoverPage />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
