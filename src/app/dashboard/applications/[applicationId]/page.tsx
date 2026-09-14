import PageContainer from '@/components/layout/page-container';
import { getQueryClient } from '@/lib/query-client';
import { applicationByIdOptions } from '@/features/applications/api/queries';
import { preparationMaterialsQueryOptions } from '@/features/preparation/api/queries';
import ApplicationDetailPage from '@/features/applications/components/application-detail-page';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Application Preparation & Tracking | CareerQuest'
};

function ApplicationDetailSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6'>
      <Skeleton className='h-32 w-full rounded-xl' />
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <Skeleton className='h-96 rounded-xl lg:col-span-2' />
        <Skeleton className='h-96 rounded-xl' />
      </div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(applicationByIdOptions(applicationId)),
    queryClient.prefetchQuery(preparationMaterialsQueryOptions(applicationId))
  ]);

  return (
    <PageContainer
      pageTitle='Application Preparation'
      pageDescription='Review tailored materials, draft answers, and track interview milestones.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<ApplicationDetailSkeleton />}>
          <ApplicationDetailPage applicationId={applicationId} />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
