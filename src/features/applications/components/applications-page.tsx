'use client';

import { useMemo, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { applicationsQueryOptions } from '../api/queries';
import { ApplicationsKanban } from './applications-kanban';
import { ApplicationsTable } from './applications-table';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Icons } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS } from '@/types/domain';
import Link from 'next/link';

export default function ApplicationsPage() {
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [followUpFilter, setFollowUpFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const { data: applications } = useSuspenseQuery(applicationsQueryOptions());

  // Distinct sources
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    applications.forEach((a) => {
      if (a.job.source) set.add(a.job.source);
    });
    return Array.from(set);
  }, [applications]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = app.job.title.toLowerCase().includes(q);
        const matchCompany = app.job.company.toLowerCase().includes(q);
        if (!matchTitle && !matchCompany) return false;
      }

      // 2. Status & Archive filter
      if (statusFilter === 'archived') {
        if (!app.isArchived) return false;
      } else {
        // By default, archived opportunities are removed from active working views
        if (app.isArchived) return false;

        if (statusFilter === 'active') {
          if (['offer', 'rejected', 'withdrawn'].includes(app.status)) return false;
        } else if (statusFilter === 'closed') {
          if (!['offer', 'rejected', 'withdrawn'].includes(app.status)) return false;
        } else if (statusFilter !== 'all') {
          if (app.status !== statusFilter) return false;
        }
      }

      // 3. Follow-up filter
      if (followUpFilter === 'due_only') {
        const isDue =
          app.followUpDate &&
          app.followUpStatus === 'pending' &&
          new Date(app.followUpDate).getTime() <= new Date().setHours(23, 59, 59, 999);
        if (!isDue) return false;
      }

      // 4. Source filter
      if (sourceFilter !== 'all' && app.job.source !== sourceFilter) {
        return false;
      }

      return true;
    });
  }, [applications, searchQuery, statusFilter, followUpFilter, sourceFilter]);

  const dueCount = useMemo(() => {
    return applications.filter(
      (a) =>
        !a.isArchived &&
        a.followUpDate &&
        a.followUpStatus === 'pending' &&
        new Date(a.followUpDate).getTime() <= new Date().setHours(23, 59, 59, 999)
    ).length;
  }, [applications]);

  const archivedCount = useMemo(() => {
    return applications.filter((a) => a.isArchived).length;
  }, [applications]);

  return (
    <div className='flex flex-1 flex-col gap-5 p-4 md:p-6 max-w-full overflow-hidden'>
      {/* Top Header Controls */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2.5'>
            <h1 className='text-2xl font-bold tracking-tight text-foreground'>
              Application Tracker
            </h1>
            <Badge variant='secondary' className='text-xs font-mono'>
              {applications.length} Tracked
            </Badge>
          </div>
          <p className='text-xs sm:text-sm text-muted-foreground'>
            Manage your opportunities, scheduled interview rounds, follow-up dates, and timelines.
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {/* View Toggle */}
          <div className='flex items-center rounded-lg border border-border/70 p-1 bg-muted/40'>
            <button
              type='button'
              onClick={() => setViewMode('pipeline')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'pipeline'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icons.kanban className='h-3.5 w-3.5' /> Pipeline
            </button>
            <button
              type='button'
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icons.page className='h-3.5 w-3.5' /> Table List
            </button>
          </div>

          <Link
            href='/dashboard/discover'
            className={cn(buttonVariants({ size: 'default' }), 'text-xs h-8')}
          >
            <Icons.add className='mr-1.5 h-4 w-4' /> Discover New Role
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className='flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-card border border-border/70 shadow-xs'>
        {/* Search */}
        <div className='relative flex-1 min-w-[200px]'>
          <Icons.search className='absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground' />
          <Input
            placeholder='Search by company or role...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-8 h-8 text-xs bg-background'
          />
          {searchQuery && (
            <button
              type='button'
              onClick={() => setSearchQuery('')}
              className='absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground'
            >
              <Icons.close className='h-3.5 w-3.5' />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'all')}>
          <SelectTrigger className='h-8 text-xs w-[140px] bg-background'>
            <SelectValue placeholder='All Stages' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all' className='text-xs'>
              All Stages
            </SelectItem>
            <SelectItem value='active' className='text-xs font-medium'>
              Active Only
            </SelectItem>
            <SelectItem value='closed' className='text-xs font-medium'>
              Closed (Outcome)
            </SelectItem>
            <SelectItem
              value='archived'
              className='text-xs font-medium text-amber-700 dark:text-amber-400'
            >
              Archived ({archivedCount})
            </SelectItem>
            {APPLICATION_STAGES.map((st) => (
              <SelectItem key={st} value={st} className='text-xs'>
                {APPLICATION_STATUS_LABELS[st]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Follow-up Filter */}
        <Select value={followUpFilter} onValueChange={(val) => setFollowUpFilter(val ?? 'all')}>
          <SelectTrigger className='h-8 text-xs w-[150px] bg-background'>
            <SelectValue placeholder='Follow-ups' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all' className='text-xs'>
              All Follow-ups
            </SelectItem>
            <SelectItem value='due_only' className='text-xs text-rose-600 font-medium'>
              Due Today / Overdue ({dueCount})
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Source Filter */}
        {availableSources.length > 0 && (
          <Select value={sourceFilter} onValueChange={(val) => setSourceFilter(val ?? 'all')}>
            <SelectTrigger className='h-8 text-xs w-[130px] bg-background'>
              <SelectValue placeholder='All Sources' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all' className='text-xs'>
                All Sources
              </SelectItem>
              {availableSources.map((src) => (
                <SelectItem key={src} value={src} className='text-xs capitalize'>
                  {src}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(searchQuery ||
          statusFilter !== 'all' ||
          followUpFilter !== 'all' ||
          sourceFilter !== 'all') && (
          <button
            type='button'
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setFollowUpFilter('all');
              setSourceFilter('all');
            }}
            className='text-xs text-muted-foreground hover:text-foreground underline pl-1'
          >
            Reset Filters
          </button>
        )}

        <div className='ml-auto text-xs text-muted-foreground hidden sm:block'>
          Showing <strong>{filteredApplications.length}</strong> of {applications.length}
        </div>
      </div>

      {/* Main Content Area */}
      {filteredApplications.length === 0 ? (
        <Card className='p-12 text-center'>
          <div className='flex flex-col items-center justify-center gap-3'>
            <Icons.kanban className='h-10 w-10 text-muted-foreground opacity-50' />
            <h2 className='text-base font-semibold text-foreground'>
              No matching applications found
            </h2>
            <p className='text-xs text-muted-foreground max-w-md'>
              Try adjusting your search query or stage filters to see your tracked applications.
            </p>
            <button
              type='button'
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setFollowUpFilter('all');
                setSourceFilter('all');
              }}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs mt-1')}
            >
              Clear All Filters
            </button>
          </div>
        </Card>
      ) : viewMode === 'pipeline' ? (
        <ApplicationsKanban applications={filteredApplications} />
      ) : (
        <ApplicationsTable applications={filteredApplications} />
      )}
    </div>
  );
}
