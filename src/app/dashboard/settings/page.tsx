import PageContainer from '@/components/layout/page-container';
import { getQueryClient } from '@/lib/query-client';
import { userSettingsQueryOptions } from '@/features/settings/api/queries';
import { documentsQueryOptions } from '@/features/documents/api/queries';
import SettingsPage from '@/features/settings/components/settings-page';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Settings | CareerQuest'
};

function SettingsSkeleton() {
  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-4xl'>
      <div className='space-y-2'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-4 w-96' />
      </div>
      <Skeleton className='h-48 w-full rounded-xl' />
      <Skeleton className='h-36 w-full rounded-xl' />
    </div>
  );
}

export default async function Page() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(userSettingsQueryOptions());
  void queryClient.prefetchQuery(documentsQueryOptions());

  return (
    <PageContainer
      pageTitle='Settings'
      pageDescription='Job search parameters, AI preferences, and privacy controls.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<SettingsSkeleton />}>
          <SettingsPage />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
