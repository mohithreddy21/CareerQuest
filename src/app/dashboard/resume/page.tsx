import PageContainer from '@/components/layout/page-container';
import { getQueryClient } from '@/lib/query-client';
import { candidateProfileQueryOptions } from '@/features/resume/api/queries';
import ResumeProfilePage from '@/features/resume/components/resume-profile-page';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Resume & Profile | CareerQuest'
};

function ProfileSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6'>
      <div className='space-y-2'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-4 w-96' />
      </div>
      <Skeleton className='h-12 w-96 rounded-lg' />
      <Skeleton className='h-96 w-full rounded-xl' />
    </div>
  );
}

export default async function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(candidateProfileQueryOptions());

  return (
    <PageContainer
      pageTitle='Resume & Profile'
      pageDescription='Your verified professional history and source-of-truth master resume.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<ProfileSkeleton />}>
          <ResumeProfilePage />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
