'use client';

import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import { useSuspenseQuery } from '@tanstack/react-query';
import { jobsQueryOptions } from '../api/queries';
import { JobImportDialog } from './job-import-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'lever', label: 'Lever' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'workday', label: 'Workday' },
  { value: 'url_import', label: 'URL Import' }
];

const WORK_OPTIONS = [
  { value: 'all', label: 'All Arrangements' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'Onsite' }
];

const SORT_OPTIONS = [
  { value: 'match_desc', label: 'Highest Fit Score' },
  { value: 'recent', label: 'Most Recently Added' },
  { value: 'company_asc', label: 'Company (A to Z)' },
  { value: 'salary_desc', label: 'Highest Compensation' }
];

const MIN_MATCH_OPTIONS = [
  { value: 0, label: 'Any Match' },
  { value: 90, label: '90%+ Fit' },
  { value: 80, label: '80%+ Fit' },
  { value: 70, label: '70%+ Fit' }
];

export default function DiscoverPage() {
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
  const [sort, setSort] = useQueryState(
    'sort',
    parseAsString.withDefault('match_desc').withOptions({ shallow: true })
  );
  const [minMatch, setMinMatch] = useQueryState(
    'minMatch',
    parseAsInteger.withDefault(0).withOptions({ shallow: true })
  );

  const { data } = useSuspenseQuery(
    jobsQueryOptions({
      search: search || undefined,
      source: source !== 'all' ? source : undefined,
      workArrangement: workArrangement !== 'all' ? workArrangement : undefined,
      sort: sort || undefined,
      minMatch: minMatch > 0 ? minMatch : undefined
    })
  );

  const hasActiveFilters = Boolean(
    search || source !== 'all' || workArrangement !== 'all' || sort !== 'match_desc' || minMatch > 0
  );

  const clearAllFilters = () => {
    setSearch('');
    setSource('all');
    setWorkArrangement('all');
    setSort('match_desc');
    setMinMatch(0);
  };

  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full'>
      {/* Top Header Controls */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2'>
            <h1 className='text-2xl font-bold tracking-tight text-foreground'>
              Discover Opportunities
            </h1>
            <Badge variant='outline' className='text-xs font-semibold px-2 py-0.5'>
              {data.total_items} {data.total_items === 1 ? 'Job' : 'Jobs'}
            </Badge>
          </div>
          <p className='text-sm text-muted-foreground'>
            Normalized opportunities with truthful profile fit analysis. Import custom URLs from any
            source.
          </p>
        </div>
        <div className='flex items-center gap-2.5'>
          <JobImportDialog />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className='space-y-3.5 bg-card/60 p-4 rounded-xl border shadow-xs'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          {/* Search Input */}
          <div className='relative w-full lg:max-w-md'>
            <Icons.search className='text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2' />
            <Input
              id='discover-search-input'
              placeholder='Search by role, company, location, or skills (e.g. React)...'
              className='pl-9 bg-background'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type='button'
                onClick={() => setSearch('')}
                className='absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1'
                aria-label='Clear search'
              >
                <Icons.close className='h-3.5 w-3.5' />
              </button>
            )}
          </div>

          {/* Sort & Min Match Selector */}
          <div className='flex flex-wrap items-center gap-2.5'>
            {/* Sort Dropdown */}
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <span className='font-medium'>Sort:</span>
              <select
                id='discover-sort-select'
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className='h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring'
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Min Match Dropdown */}
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <span className='font-medium'>Min Fit:</span>
              <select
                id='discover-match-select'
                value={minMatch}
                onChange={(e) => setMinMatch(Number(e.target.value))}
                className='h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring'
              >
                {MIN_MATCH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Source & Work Arrangement Filter Pills */}
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60'>
          {/* Source filters */}
          <div className='flex flex-wrap items-center gap-1.5'>
            <span className='text-xs font-medium text-muted-foreground mr-1'>Source:</span>
            {SOURCE_OPTIONS.map((opt) => {
              const isActive = source === opt.value;
              return (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => setSource(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Work Arrangement filters */}
          <div className='flex flex-wrap items-center gap-1.5'>
            <span className='text-xs font-medium text-muted-foreground mr-1'>Arrangement:</span>
            {WORK_OPTIONS.map((opt) => {
              const isActive = workArrangement === opt.value;
              return (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => setWorkArrangement(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filter Chips & Clear Action */}
        {hasActiveFilters && (
          <div className='flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground border-t border-border/40'>
            <span className='font-medium'>Active filters:</span>
            {search && (
              <Badge variant='secondary' className='gap-1 font-normal text-[11px]'>
                Search: &ldquo;{search}&rdquo;
                <Icons.close
                  className='h-3 w-3 cursor-pointer hover:text-foreground'
                  onClick={() => setSearch('')}
                />
              </Badge>
            )}
            {source !== 'all' && (
              <Badge variant='secondary' className='gap-1 font-normal text-[11px] capitalize'>
                Source: {source.replace('_', ' ')}
                <Icons.close
                  className='h-3 w-3 cursor-pointer hover:text-foreground'
                  onClick={() => setSource('all')}
                />
              </Badge>
            )}
            {workArrangement !== 'all' && (
              <Badge variant='secondary' className='gap-1 font-normal text-[11px] capitalize'>
                Arrangement: {workArrangement}
                <Icons.close
                  className='h-3 w-3 cursor-pointer hover:text-foreground'
                  onClick={() => setWorkArrangement('all')}
                />
              </Badge>
            )}
            {minMatch > 0 && (
              <Badge variant='secondary' className='gap-1 font-normal text-[11px]'>
                Min Fit: {minMatch}%+
                <Icons.close
                  className='h-3 w-3 cursor-pointer hover:text-foreground'
                  onClick={() => setMinMatch(0)}
                />
              </Badge>
            )}
            {sort !== 'match_desc' && (
              <Badge variant='secondary' className='gap-1 font-normal text-[11px]'>
                Sorted by: {SORT_OPTIONS.find((s) => s.value === sort)?.label}
                <Icons.close
                  className='h-3 w-3 cursor-pointer hover:text-foreground'
                  onClick={() => setSort('match_desc')}
                />
              </Badge>
            )}
            <Button
              variant='ghost'
              size='sm'
              onClick={clearAllFilters}
              className='h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground'
            >
              Reset all
            </Button>
          </div>
        )}
      </div>

      {/* Job Results Feed */}
      {data.items.length === 0 ? (
        <Card className='p-10 text-center border-dashed'>
          <div className='flex flex-col items-center justify-center gap-3 max-w-md mx-auto'>
            <div className='rounded-full bg-muted p-3'>
              <Icons.search className='text-muted-foreground h-6 w-6' />
            </div>
            <div className='space-y-1'>
              <h3 className='text-base font-semibold text-foreground'>No opportunities found</h3>
              <p className='text-xs text-muted-foreground'>
                No job postings match your current search and filter combination. Try clearing your
                filters or paste a link to import any posting.
              </p>
            </div>
            <div className='flex items-center gap-2 pt-2'>
              {hasActiveFilters && (
                <Button variant='outline' size='sm' onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              )}
              <JobImportDialog />
            </div>
          </div>
        </Card>
      ) : (
        <div className='grid gap-4'>
          {data.items.map((job) => {
            const matchScore = job.match?.score ?? 0;
            const hasSalary = Boolean(job.salary && (job.salary.min || job.salary.max));

            return (
              <Card
                key={job.id}
                className='transition-all duration-200 hover:border-primary/50 hover:shadow-sm overflow-hidden'
              >
                <CardContent className='p-5'>
                  <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                    {/* Left Column: Job Info */}
                    <div className='space-y-3 flex-1 min-w-0'>
                      <div className='space-y-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Link
                            href={`/dashboard/jobs/${job.id}`}
                            className='text-base font-semibold text-foreground hover:text-primary transition-colors'
                          >
                            {job.title}
                          </Link>
                          <span className='text-muted-foreground text-xs'>at</span>
                          <span className='text-sm font-medium text-foreground/90'>
                            {job.company}
                          </span>

                          {/* Source Badge */}
                          <Badge variant='secondary' className='text-[10px] capitalize font-medium'>
                            {job.source.replace('_', ' ')}
                          </Badge>

                          {/* Pipeline status if tracked */}
                          {job.applicationStatus && (
                            <Badge
                              variant='outline'
                              className='text-[10px] uppercase tracking-wider font-semibold border-primary/40 text-primary'
                            >
                              Pipeline: {job.applicationStatus}
                            </Badge>
                          )}
                        </div>

                        {/* Location, Arrangement, Compensation, Date */}
                        <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-0.5'>
                          <span className='flex items-center gap-1'>
                            <Icons.workspace className='h-3.5 w-3.5 shrink-0' />
                            {job.location} ({job.workArrangement})
                          </span>

                          {hasSalary ? (
                            <span className='flex items-center gap-1 font-medium text-foreground/90'>
                              <Icons.billing className='h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400' />
                              ${(job.salary!.min ?? 0) / 1000}k - ${(job.salary!.max ?? 0) / 1000}k
                            </span>
                          ) : (
                            <span className='italic text-muted-foreground/80'>
                              Compensation not disclosed
                            </span>
                          )}

                          {job.postedDate && (
                            <span className='flex items-center gap-1'>
                              <Icons.calendar className='h-3.5 w-3.5 shrink-0' />
                              Posted {job.postedDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Brief description excerpt */}
                      <p className='line-clamp-2 text-xs text-muted-foreground/90 leading-relaxed'>
                        {job.description}
                      </p>

                      {/* Required Skills chips */}
                      <div className='flex flex-wrap items-center gap-1.5 pt-1'>
                        {job.requiredSkills.slice(0, 5).map((skill) => (
                          <Badge
                            key={skill}
                            variant='outline'
                            className='text-[11px] font-normal py-0.5'
                          >
                            {skill}
                          </Badge>
                        ))}
                        {job.requiredSkills.length > 5 && (
                          <span className='self-center text-[10px] text-muted-foreground font-medium'>
                            +{job.requiredSkills.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Profile Fit & Action CTAs */}
                    <div className='flex sm:flex-col items-end justify-between sm:justify-start gap-3.5 pt-3 sm:pt-0 sm:border-l sm:pl-5 shrink-0 min-w-[140px]'>
                      {/* Fit Score Badge */}
                      {job.match ? (
                        <div className='flex flex-col items-end'>
                          <div className='flex items-center gap-1.5'>
                            <span
                              className={`text-lg font-bold tracking-tight ${
                                matchScore >= 90
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : matchScore >= 80
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {matchScore}%
                            </span>
                            <span className='text-[11px] font-semibold uppercase text-muted-foreground'>
                              Fit
                            </span>
                          </div>
                          <p className='text-[10px] text-muted-foreground text-right hidden sm:block'>
                            Profile alignment
                          </p>
                        </div>
                      ) : (
                        <span className='text-xs text-muted-foreground italic'>No fit score</span>
                      )}

                      {/* Action CTA */}
                      <div className='flex flex-col items-end gap-1.5 w-full sm:w-auto'>
                        <Link
                          href={`/dashboard/jobs/${job.id}`}
                          className={cn(
                            buttonVariants({ size: 'sm' }),
                            'h-8 px-3.5 shadow-xs w-full sm:w-auto justify-center'
                          )}
                        >
                          Review Match
                          <Icons.arrowRight className='ml-1.5 h-3.5 w-3.5' />
                        </Link>
                        {job.originalUrl && (
                          <a
                            href={job.originalUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1'
                          >
                            Source Link <Icons.externalLink className='h-3 w-3' />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
