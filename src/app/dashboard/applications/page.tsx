import PageContainer from '@/components/layout/page-container';
import { getQueryClient } from '@/lib/query-client';
import { applicationsQueryOptions } from '@/features/applications/api/queries';
import ApplicationsPage from '@/features/applications/components/applications-page';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Applications Pipeline | CareerQuest'
};

function ApplicationsSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6'>
      <div className='space-y-2'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-4 w-96' />
      </div>
      <div className='flex gap-4 overflow-x-auto pb-4'>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className='h-[420px] w-72 shrink-0 rounded-xl' />
        ))}
      </div>
    </div>
  );
}

export default async function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(applicationsQueryOptions());

  return (
    <PageContainer
      pageTitle='Applications'
      pageDescription='Track your active opportunities across discovery, interview, and offer stages.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<ApplicationsSkeleton />}>
          <ApplicationsPage />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
