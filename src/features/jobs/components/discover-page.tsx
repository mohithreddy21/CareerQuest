'use client';

import React, { useState } from 'react';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { discoveryKeys, discoveryRankingQueryOptions } from '../api/queries';
import {
  setCandidateJobStateAction,
  undoCandidateJobStateAction,
  getDiscoveryRankingAction
} from '../api/actions';
import { JobOpportunityCard } from './job-opportunity-card';
import { JobImportDialog } from './job-import-dialog';
import { SavedSearchesDialog } from './saved-searches-dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import { RankedOpportunity, DiscoveryRankingParams } from '../lib/ranking';
import { CandidateJobStatus } from '@/types/domain';

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'lever', label: 'Lever' },
  { value: 'company_portal', label: 'Company Careers' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'url_import', label: 'URL Import' },
  { value: 'manual', label: 'Manual Import' }
];

const WORK_OPTIONS = [
  { value: 'all', label: 'All Arrangements' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'Onsite' }
];

const MIN_MATCH_OPTIONS = [
  { value: 0, label: 'Min Alignment: Any' },
  { value: 90, label: '90%+ Profile Alignment' },
  { value: 80, label: '80%+ Profile Alignment' },
  { value: 70, label: '70%+ Profile Alignment' }
];

const SORT_OPTIONS = [
  { value: 'priority', label: 'Opportunity Priority' },
  { value: 'match_desc', label: 'Profile Alignment (High to Low)' },
  { value: 'recent', label: 'Most Recently Posted' }
];

const STATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All States' },
  { value: 'unseen', label: 'New / Unseen' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'saved', label: 'Saved' },
  { value: 'dismissed', label: 'Dismissed' }
];

export default function DiscoverPage() {
  const queryClient = useQueryClient();

  // 1. URL State via Nuqs
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsString.withDefault('recommended').withOptions({ shallow: true })
  );
  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault('').withOptions({ shallow: true })
  );
  const [source, setSource] = useQueryState(
    'source',
    parseAsString.withDefault('all').withOptions({ shallow: true })
  );
  const [workArrangement, setWorkArrangement] = useQueryState(
    'workArrangement',
    parseAsString.withDefault('all').withOptions({ shallow: true })
  );
  const [minMatch, setMinMatch] = useQueryState(
    'minMatch',
    parseAsInteger.withDefault(0).withOptions({ shallow: true })
  );
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsString.withDefault('priority').withOptions({ shallow: true })
  );
  const [stateFilter, setStateFilter] = useQueryState(
    'stateFilter',
    parseAsString.withDefault('all').withOptions({ shallow: true })
  );

  // Discovery Params Contract
  const activeParams: DiscoveryRankingParams = {
    tab: (tab as 'recommended' | 'saved' | 'all') || 'recommended',
    search: search.trim() || undefined,
    source: source !== 'all' ? source : undefined,
    workArrangement:
      workArrangement !== 'all' ? (workArrangement as 'remote' | 'hybrid' | 'onsite') : undefined,
    minMatch: minMatch > 0 ? minMatch : undefined,
    sort:
      tab === 'recommended'
        ? 'priority'
        : (sort as 'priority' | 'match_desc' | 'recent') || 'priority',
    stateFilter:
      stateFilter !== 'all'
        ? (stateFilter as 'all' | 'saved' | 'unseen' | 'viewed' | 'dismissed')
        : undefined
  };

  // 2. Fetch Initial Page via TanStack React Query + Suspense
  const { data } = useSuspenseQuery(discoveryRankingQueryOptions(activeParams));

  // 3. Keyset Pagination & Load More State
  const [extraItems, setExtraItems] = useState<RankedOpportunity[]>([]);
  const [prevContextKey, setPrevContextKey] = useState(data.rankingContextKey);
  const [nextCursorOverride, setNextCursorOverride] = useState<string | null | undefined>(
    undefined
  );
  const [hasMoreOverride, setHasMoreOverride] = useState<boolean | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingJobActionId, setPendingJobActionId] = useState<string | null>(null);

  // If rankingContextKey changed (due to filters, tab, or query), reset pagination state during render
  if (data.rankingContextKey !== prevContextKey) {
    setPrevContextKey(data.rankingContextKey);
    setExtraItems([]);
    setNextCursorOverride(undefined);
    setHasMoreOverride(undefined);
  }

  const activeNextCursor = nextCursorOverride !== undefined ? nextCursorOverride : data.nextCursor;
  const activeHasMore = hasMoreOverride !== undefined ? hasMoreOverride : data.hasMore;

  // Combined Items: Deduplicated by Job ID to prevent duplicate keys across pages
  const combinedItems: RankedOpportunity[] = React.useMemo(() => {
    const seen = new Set<string>();
    const result: RankedOpportunity[] = [];
    for (const item of [...data.items, ...extraItems]) {
      if (!seen.has(item.job.id)) {
        seen.add(item.job.id);
        result.push(item);
      }
    }
    return result;
  }, [data.items, extraItems]);

  // Load More Handler (Server-side Keyset Pagination)
  const handleLoadMore = async () => {
    if (!activeNextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const response = await getDiscoveryRankingAction({
        ...activeParams,
        cursor: activeNextCursor
      });
      setExtraItems((prev) => {
        const seen = new Set(prev.map((i) => i.job.id));
        for (const item of data.items) seen.add(item.job.id);
        const newUniques = response.items.filter((i) => !seen.has(i.job.id));
        return [...prev, ...newUniques];
      });
      setNextCursorOverride(response.nextCursor);
      setHasMoreOverride(response.hasMore);
    } catch {
      toast.error('Could not load more opportunities. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // 4. Save & Dismiss Action Handlers with Deterministic Safe Undo
  const handleSave = async (jobId: string, currentStatus: CandidateJobStatus | null) => {
    const isSaved = currentStatus === 'SAVED';
    const targetStatus: CandidateJobStatus = isSaved ? 'UNSEEN' : 'SAVED';
    setPendingJobActionId(jobId);

    try {
      await setCandidateJobStateAction({ jobId, status: targetStatus });
      await queryClient.invalidateQueries({ queryKey: discoveryKeys.all });

      toast.success(isSaved ? 'Removed from Saved' : 'Opportunity Saved', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await undoCandidateJobStateAction({
                jobId,
                targetPreviousState: currentStatus || 'UNSEEN'
              });
              await queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
              toast.info('Undo successful');
            } catch {
              toast.error('Failed to undo state change');
            }
          }
        }
      });
    } catch {
      toast.error('Failed to update job status');
    } finally {
      setPendingJobActionId(null);
    }
  };

  const handleDismiss = async (jobId: string, currentStatus: CandidateJobStatus | null) => {
    setPendingJobActionId(jobId);
    const prevStatus: CandidateJobStatus = currentStatus || 'UNSEEN';

    try {
      await setCandidateJobStateAction({ jobId, status: 'DISMISSED' });
      await queryClient.invalidateQueries({ queryKey: discoveryKeys.all });

      toast('Opportunity dismissed', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await undoCandidateJobStateAction({
                jobId,
                targetPreviousState: prevStatus
              });
              await queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
              toast.success('Opportunity restored');
            } catch {
              toast.error('Failed to undo dismissal');
            }
          }
        }
      });
    } catch {
      toast.error('Failed to dismiss opportunity');
    } finally {
      setPendingJobActionId(null);
    }
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
    source !== 'all' ||
    workArrangement !== 'all' ||
    minMatch > 0 ||
    (tab !== 'recommended' && sort !== 'priority') ||
    stateFilter !== 'all'
  );

  const clearAllFilters = () => {
    setSearch('');
    setSource('all');
    setWorkArrangement('all');
    setMinMatch(0);
    setSort('priority');
    setStateFilter('all');
  };

  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full'>
      {/* Top Header Controls */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2.5'>
            <h1 className='text-2xl font-bold tracking-tight text-foreground'>
              Discover Opportunities
            </h1>
            <Badge variant='outline' className='text-xs font-semibold px-2.5 py-0.5'>
              {data.totalEligible} {data.totalEligible === 1 ? 'Job' : 'Jobs'}
            </Badge>
          </div>
          <p className='text-sm text-muted-foreground'>
            Ranked opportunities with profile alignment and factual decision support.
          </p>
        </div>

        {/* Action Buttons: Saved Searches & Import */}
        <div className='flex items-center gap-2 flex-wrap sm:flex-nowrap'>
          {/* Save Search Button (prepopulating active discovery filters) */}
          <SavedSearchesDialog
            initialFilterPrefill={{
              query: search.trim() || undefined,
              workArrangements: workArrangement !== 'all' ? [workArrangement] : [],
              minMatchScore: minMatch > 0 ? minMatch : undefined
            }}
            triggerLabel='Save Search'
            triggerVariant='outline'
            defaultMode='create'
          />

          {/* Manage Saved Searches */}
          <SavedSearchesDialog
            triggerLabel='Saved Searches'
            triggerVariant='ghost'
            defaultMode='list'
          />

          {/* Import Job */}
          <JobImportDialog />
        </div>
      </div>

      {/* Primary Discovery Tabs: Recommended, Saved, All Jobs */}
      <Tabs value={tab} onValueChange={(val) => setTab(val)} className='w-full'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <TabsList className='grid grid-cols-3 max-w-md w-full'>
            <TabsTrigger value='recommended' className='text-xs sm:text-sm'>
              Recommended
            </TabsTrigger>
            <TabsTrigger value='saved' className='text-xs sm:text-sm'>
              Saved
            </TabsTrigger>
            <TabsTrigger value='all' className='text-xs sm:text-sm'>
              All Jobs
            </TabsTrigger>
          </TabsList>

          {/* Active Filter Clear if filters are set */}
          {hasActiveFilters && (
            <Button
              variant='ghost'
              size='sm'
              onClick={clearAllFilters}
              className='text-xs text-muted-foreground hover:text-foreground h-8 px-2.5'
            >
              <Icons.close className='mr-1 h-3.5 w-3.5' />
              Reset Filters
            </Button>
          )}
        </div>
      </Tabs>

      {/* Search & Filter Controls Bar */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/70'>
        {/* Search Input */}
        <div className='relative sm:col-span-2 lg:col-span-1'>
          <Icons.search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search title, company, skills...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9 h-9 text-xs'
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className='absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              aria-label='Clear search'
            >
              <Icons.close className='h-3.5 w-3.5' />
            </button>
          )}
        </div>

        {/* Work Arrangement */}
        <Select value={workArrangement} onValueChange={(val) => setWorkArrangement(val)}>
          <SelectTrigger className='h-9 text-xs'>
            <SelectValue placeholder='Arrangement' />
          </SelectTrigger>
          <SelectContent>
            {WORK_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className='text-xs'>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Minimum Profile Alignment */}
        <Select
          value={String(minMatch)}
          onValueChange={(val) => setMinMatch(val ? parseInt(val, 10) : 0)}
        >
          <SelectTrigger className='h-9 text-xs'>
            <SelectValue placeholder='Profile Alignment' />
          </SelectTrigger>
          <SelectContent>
            {MIN_MATCH_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)} className='text-xs'>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Source Filter */}
        <Select value={source} onValueChange={(val) => setSource(val)}>
          <SelectTrigger className='h-9 text-xs'>
            <SelectValue placeholder='Source' />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className='text-xs'>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Extended Controls for All Jobs Tab */}
        {tab === 'all' && (
          <>
            {/* Sort Dropdown */}
            <Select value={sort} onValueChange={(val) => setSort(val)}>
              <SelectTrigger className='h-9 text-xs'>
                <SelectValue placeholder='Sort order' />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className='text-xs'>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* State Filter */}
            <Select value={stateFilter} onValueChange={(val) => setStateFilter(val)}>
              <SelectTrigger className='h-9 text-xs'>
                <SelectValue placeholder='Candidate State' />
              </SelectTrigger>
              <SelectContent>
                {STATE_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className='text-xs'>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Results Section */}
      {combinedItems.length > 0 ? (
        <div className='space-y-4'>
          {/* Card Grid */}
          <div className='grid grid-cols-1 gap-4'>
            {combinedItems.map((opp) => (
              <JobOpportunityCard
                key={opp.job.id}
                opportunity={opp}
                onSave={handleSave}
                onDismiss={handleDismiss}
                isSaving={pendingJobActionId === opp.job.id}
                isDismissing={pendingJobActionId === opp.job.id}
              />
            ))}
          </div>

          {/* Keyset Pagination Load More Controls */}
          {activeHasMore && (
            <div className='flex justify-center pt-4 pb-2'>
              <Button
                variant='outline'
                size='default'
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className='min-h-[44px] px-8 text-xs font-semibold'
              >
                {isLoadingMore ? (
                  <>
                    <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
                    Loading opportunities...
                  </>
                ) : (
                  <>
                    Load more opportunities
                    <Icons.chevronDown className='ml-2 h-4 w-4' />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* End of Results Indicator */}
          {!activeHasMore && combinedItems.length > 0 && (
            <div className='py-6 text-center text-xs text-muted-foreground border-t border-border/40'>
              You have viewed all {combinedItems.length} matching opportunities.
            </div>
          )}
        </div>
      ) : /* Meaningful Empty States per Tab */
      tab === 'recommended' ? (
        <EmptyState
          variant='dashed'
          icon={Icons.sparkles}
          title='No recommended opportunities yet'
          description='Try importing a job from a custom URL, expanding your search filters, or updating your role preferences.'
          secondaryAction={
            hasActiveFilters ? { label: 'Reset Filters', onClick: clearAllFilters } : undefined
          }
        >
          <div className='flex justify-center pt-2'>
            <JobImportDialog />
          </div>
        </EmptyState>
      ) : tab === 'saved' ? (
        <EmptyState
          variant='dashed'
          icon={Icons.star}
          title="You haven't saved any jobs yet"
          description='Click "Save" on any opportunity card to keep track of it here.'
          primaryAction={{
            label: 'Browse Recommended Jobs',
            onClick: () => setTab('recommended')
          }}
        />
      ) : (
        <EmptyState
          variant='dashed'
          icon={Icons.search}
          title='No jobs match these filters'
          description='Try adjusting your search query, clearing arrangements, or lowering the minimum alignment threshold.'
          primaryAction={
            hasActiveFilters ? { label: 'Clear All Filters', onClick: clearAllFilters } : undefined
          }
        />
      )}
    </div>
  );
}
