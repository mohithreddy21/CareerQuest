import PageContainer from '@/components/layout/page-container';
import { getQueryClient } from '@/lib/query-client';
import { applicationByIdOptions } from '@/features/applications/api/queries';
import { preparationMaterialsQueryOptions } from '@/features/preparation/api/queries';
import { ReadyRoomWorkspace } from '@/features/preparation/components/ready-room-workspace';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Application Ready Room | CareerQuest'
};

function ReadyRoomSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full'>
      <Skeleton className='h-8 w-64' />
      <Skeleton className='h-36 w-full rounded-xl' />
      <Skeleton className='h-48 w-full rounded-xl' />
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <Skeleton className='h-96 rounded-xl lg:col-span-2' />
        <Skeleton className='h-96 rounded-xl' />
      </div>
    </div>
  );
}

export default async function ReadyRoomPage({
  params
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(applicationByIdOptions(applicationId));
  void queryClient.prefetchQuery(preparationMaterialsQueryOptions(applicationId));

  return (
    <PageContainer
      pageTitle='Application Ready Room'
      pageDescription='Final candidate review workspace before controlled external application handoff.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<ReadyRoomSkeleton />}>
          <ReadyRoomWorkspace applicationId={applicationId} />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
