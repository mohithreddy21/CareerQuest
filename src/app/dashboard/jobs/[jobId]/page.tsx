import PageContainer from '@/components/layout/page-container';
import { getQueryClient } from '@/lib/query-client';
import { jobAnalysisOptions, jobByIdOptions, jobMatchOptions } from '@/features/jobs/api/queries';
import JobDetailPage from '@/features/jobs/components/job-detail-page';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Job Match Analysis | CareerQuest'
};

function JobDetailSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6'>
      <Skeleton className='h-36 w-full rounded-xl' />
      <Skeleton className='h-28 w-full rounded-xl' />
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <Skeleton className='h-96 rounded-xl' />
        <Skeleton className='h-96 rounded-xl' />
      </div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(jobByIdOptions(jobId)),
    queryClient.prefetchQuery(jobAnalysisOptions(jobId)),
    queryClient.prefetchQuery(jobMatchOptions(jobId))
  ]);

  return (
    <PageContainer
      pageTitle='Job Opportunity'
      pageDescription='Review alignment, verified evidence, and prepare tailored application materials.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<JobDetailSkeleton />}>
          <JobDetailPage jobId={jobId} />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
