import PageContainer from '@/components/layout/page-container';
import { getQueryClient } from '@/lib/query-client';
import { tailoredResumeQueryOptions } from '@/features/resume/api/queries';
import { jobByIdOptions, jobMatchOptions } from '@/features/jobs/api/queries';
import { retrievedKnowledgeQueryOptions } from '@/features/tailoring/api/queries';
import ResumeTailorWorkspace from '@/features/resume/components/resume-tailor-workspace';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Resume Tailoring Workspace | CareerQuest'
};

function TailorSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6'>
      <Skeleton className='h-32 w-full rounded-xl' />
      <Skeleton className='h-16 w-full rounded-xl' />
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-12'>
        <Skeleton className='h-96 rounded-xl lg:col-span-4' />
        <Skeleton className='h-96 rounded-xl lg:col-span-8' />
      </div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(jobByIdOptions(jobId));
  void queryClient.prefetchQuery(jobMatchOptions(jobId));
  void queryClient.prefetchQuery(retrievedKnowledgeQueryOptions(jobId));
  void queryClient.prefetchQuery(tailoredResumeQueryOptions(jobId));

  return (
    <PageContainer
      pageTitle='Resume Tailoring Workspace'
      pageDescription='Review change-by-change tailored statements grounded in your verified experience.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<TailorSkeleton />}>
          <ResumeTailorWorkspace jobId={jobId} />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
