'use client';

import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { dashboardOverviewQueryOptions } from '../api/queries';
import {
  applicationsQueryOptions,
  applicationEventsQueryOptions
} from '@/features/applications/api/queries';
import {
  searchAnalyticsQueryOptions,
  searchInsightsQueryOptions
} from '@/features/analytics/api/queries';
import { NextActionsService } from '../services/next-actions-service';
import { NextActionsList } from './next-actions-list';
import { SearchAnalyticsCard } from '@/features/analytics/components/search-analytics-card';
import { SearchInsightsCard } from '@/features/analytics/components/search-insights-card';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS, ApplicationStatus } from '@/types/domain';

export default function OverviewPage() {
  const { data: overviewData } = useSuspenseQuery(dashboardOverviewQueryOptions());
  const { data: applications } = useSuspenseQuery(applicationsQueryOptions());
  const { data: events } = useSuspenseQuery(applicationEventsQueryOptions());
  const { data: analytics } = useSuspenseQuery(searchAnalyticsQueryOptions());
  const { data: insightsResult } = useSuspenseQuery(searchInsightsQueryOptions());

  const { candidate, recommended } = overviewData;

  // Compute deterministic next actions using NextActionsService
  const dynamicActions = useMemo(() => {
    return NextActionsService.computeNextActions(applications, events);
  }, [applications, events]);

  // Compute live pipeline counts directly from applications
  const pipelineCounts = useMemo(() => {
    const counts: Record<ApplicationStatus, number> = {
      discovered: 0,
      interested: 0,
      preparing: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0
    };
    applications.forEach((a) => {
      if (counts[a.status] !== undefined) {
        counts[a.status]++;
      }
    });
    return counts;
  }, [applications]);

  // Upcoming items: scheduled interview rounds + due follow-ups
  const upcomingInterviews = useMemo(() => {
    const list: Array<{
      appId: string;
      company: string;
      role: string;
      stageName: string;
      date: string;
      meetingLink?: string;
    }> = [];

    applications.forEach((app) => {
      app.interviewStages?.forEach((st) => {
        if (st.status === 'scheduled' && st.scheduledDate) {
          list.push({
            appId: app.id,
            company: app.job.company,
            role: app.job.title,
            stageName: st.stageName,
            date: st.scheduledDate,
            meetingLink: st.meetingLink
          });
        }
      });
    });

    return list.toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [applications]);

  const upcomingFollowUps = useMemo(() => {
    return applications
      .filter((a) => a.followUpDate && a.followUpStatus === 'pending')
      .map((a) => ({
        appId: a.id,
        company: a.job.company,
        role: a.job.title,
        date: a.followUpDate!,
        note: a.followUpNote,
        isOverdueOrDueToday:
          new Date(a.followUpDate!).getTime() <= new Date().setHours(23, 59, 59, 999)
      }))
      .toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [applications]);

  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-full overflow-hidden'>
      {/* Search Status Hero Banner */}
      <Card className='border-border/80 bg-card/60 shadow-xs'>
        <CardContent className='flex flex-col gap-4 p-5 md:p-6 md:flex-row md:items-center md:justify-between'>
          <div className='space-y-1.5'>
            <div className='flex items-center gap-2'>
              <StatusBadge status='verified' size='sm' label='Active Search Workspace' />
              <span className='type-body-sm text-muted-foreground'>
                Targeting: {candidate.preferences.targetRoles.join(', ')}
              </span>
            </div>
            <h1 className='type-display text-foreground'>
              Focus on the jobs worth your time, {candidate.name.split(' ')[0]}.
            </h1>
            <p className='max-w-2xl type-body-sm text-muted-foreground leading-relaxed'>
              Your deterministic command center. Review today&apos;s actions, keep upcoming
              interviews on track, monitor application progress, and learn from outcome trends
              without losing human authority.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2.5 pt-2 md:pt-0'>
            <Link
              href='/dashboard/discover'
              className={cn(buttonVariants({ size: 'default' }), 'text-xs h-9 shadow-xs')}
            >
              <Icons.search className='mr-1.5 h-3.5 w-3.5' />
              Discover Jobs
            </Link>
            <Link
              href='/dashboard/applications'
              className={cn(buttonVariants({ variant: 'outline', size: 'default' }), 'text-xs h-9')}
            >
              <Icons.kanban className='mr-1.5 h-3.5 w-3.5' />
              Application Tracker
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 1. TODAY'S ACTIONS (Priority 1) */}
      <section className='space-y-2.5'>
        <NextActionsList actions={dynamicActions} />
      </section>

      {/* 2. PIPELINE AT A GLANCE (Priority 2) */}
      <section className='space-y-2.5'>
        <Card className='border-border/80 shadow-xs'>
          <CardHeader className='pb-3 border-b border-border/60'>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='text-sm font-semibold'>Pipeline At a Glance</CardTitle>
                <CardDescription className='text-xs'>
                  Current stage breakdown of your {applications.length} tracked opportunities
                </CardDescription>
              </div>
              <Link
                href='/dashboard/applications'
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-xs h-7')}
              >
                Open Tracker <Icons.chevronRight className='ml-1 h-3 w-3' />
              </Link>
            </div>
          </CardHeader>
          <CardContent className='p-4'>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8'>
              {APPLICATION_STAGES.map((stage) => {
                const count = pipelineCounts[stage] || 0;
                return (
                  <Link
                    key={stage}
                    href={`/dashboard/applications?status=${stage}`}
                    className='flex flex-col rounded-lg border border-border/50 p-3 transition-colors hover:border-primary/50 hover:bg-muted/40'
                  >
                    <span className='type-caption text-muted-foreground'>
                      {APPLICATION_STATUS_LABELS[stage]}
                    </span>
                    <span className='mt-1 text-2xl font-bold tracking-tight text-foreground font-mono'>
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. UPCOMING INTERVIEWS & ACTIVE FOLLOW-UPS (Priority 3) */}
      <section className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Upcoming Interviews */}
        <Card className='border-border/80 shadow-xs'>
          <CardHeader className='pb-3 border-b border-border/60'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='p-1.5 rounded-md bg-purple-500/10 text-purple-600'>
                  <Icons.calendar className='h-4 w-4' />
                </div>
                <div>
                  <CardTitle className='text-sm font-semibold'>Upcoming Interviews</CardTitle>
                  <CardDescription className='text-xs'>
                    Scheduled conversations and technical rounds
                  </CardDescription>
                </div>
              </div>
              <Badge variant='secondary' className='text-xs font-mono'>
                {upcomingInterviews.length} Scheduled
              </Badge>
            </div>
          </CardHeader>
          <CardContent className='p-4'>
            {upcomingInterviews.length === 0 ? (
              <EmptyState
                variant='compact'
                icon={Icons.calendar}
                title='No interviews scheduled yet'
                description='When recruiters schedule rounds, log them to track interview notes and follow-ups.'
              />
            ) : (
              <div className='space-y-2.5'>
                {upcomingInterviews.map((item, idx) => (
                  <div
                    key={idx}
                    className='flex items-center justify-between p-3 rounded-lg border border-border/70 bg-card hover:border-border transition-colors'
                  >
                    <div className='space-y-0.5'>
                      <div className='flex items-center gap-2'>
                        <h4 className='text-xs font-semibold text-foreground'>{item.stageName}</h4>
                        <span className='text-xs text-muted-foreground'>&bull;</span>
                        <span className='text-xs font-medium text-foreground/80'>
                          {item.company}
                        </span>
                      </div>
                      <p className='text-[11px] text-muted-foreground flex items-center gap-1.5'>
                        <Icons.clock className='h-3 w-3' />
                        {new Date(item.date).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    <div className='flex items-center gap-1.5'>
                      {item.meetingLink && (
                        <a
                          href={item.meetingLink}
                          target='_blank'
                          rel='noopener noreferrer'
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'text-[11px] h-7 gap-1'
                          )}
                        >
                          <Icons.externalLink className='h-3 w-3' /> Join
                        </a>
                      )}
                      <Link
                        href={`/dashboard/applications/${item.appId}?tab=interviews`}
                        className={cn(buttonVariants({ size: 'sm' }), 'text-[11px] h-7')}
                      >
                        Prep Notes
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Follow-Up Deadlines */}
        <Card className='border-border/80 shadow-xs'>
          <CardHeader className='pb-3 border-b border-border/60'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='p-1.5 rounded-md bg-blue-500/10 text-blue-600'>
                  <Icons.notification className='h-4 w-4' />
                </div>
                <div>
                  <CardTitle className='text-sm font-semibold'>Follow-Up Deadlines</CardTitle>
                  <CardDescription className='text-xs'>
                    Timely check-ins after application submissions
                  </CardDescription>
                </div>
              </div>
              <Badge variant='secondary' className='text-xs font-mono'>
                {upcomingFollowUps.length} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className='p-4'>
            {upcomingFollowUps.length === 0 ? (
              <EmptyState
                variant='compact'
                icon={Icons.check}
                title='No pending follow-ups'
                description='Submitting new applications automatically sets a 7-day follow-up reminder.'
              />
            ) : (
              <div className='space-y-2.5'>
                {upcomingFollowUps.map((item, idx) => (
                  <div
                    key={idx}
                    className='flex items-center justify-between p-3 rounded-lg border border-border/70 bg-card hover:border-border transition-colors'
                  >
                    <div className='space-y-0.5'>
                      <div className='flex items-center gap-2'>
                        <h4 className='text-xs font-semibold text-foreground'>{item.company}</h4>
                        {item.isOverdueOrDueToday ? (
                          <Badge
                            variant='outline'
                            className='bg-rose-500/10 text-rose-700 border-rose-500/30 text-[10px] font-semibold'
                          >
                            Due Today
                          </Badge>
                        ) : (
                          <Badge
                            variant='outline'
                            className='bg-blue-500/10 text-blue-700 border-blue-500/20 text-[10px]'
                          >
                            Scheduled
                          </Badge>
                        )}
                      </div>
                      <p className='text-[11px] text-muted-foreground'>
                        {item.role} &bull; Target: {item.date}
                      </p>
                    </div>

                    <Link
                      href={`/dashboard/applications/${item.appId}?tab=interviews`}
                      className={cn(
                        buttonVariants({
                          size: 'sm',
                          variant: item.isOverdueOrDueToday ? 'default' : 'outline'
                        }),
                        'text-[11px] h-7'
                      )}
                    >
                      Follow Up
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 4. SEARCH PROGRESS & ANALYTICS (Priority 4) */}
      <section className='space-y-2.5'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-base font-bold text-foreground'>Search Progress & Analytics</h2>
            <p className='text-xs text-muted-foreground'>
              Derived conversion funnels and process velocity based strictly on recorded application
              events
            </p>
          </div>
        </div>

        <SearchAnalyticsCard analytics={analytics} />
      </section>

      {/* 5. SEARCH INSIGHTS & FEEDBACK LOOP (Priority 5) */}
      <section className='space-y-2.5'>
        <SearchInsightsCard result={insightsResult} />
      </section>

      {/* 6. RECOMMENDED OPPORTUNITIES */}
      <section className='space-y-3 pt-2'>
        <div className='flex items-center justify-between'>
          <div>
            <h2 className='text-base font-bold text-foreground'>
              High-Alignment Roles Worth Exploring
            </h2>
            <p className='text-xs text-muted-foreground'>
              Ranked by qualification overlap against your approved Candidate Knowledge Bank
            </p>
          </div>
          <Link
            href='/dashboard/discover'
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs h-7')}
          >
            All Roles
          </Link>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
          {recommended.map(({ job, match, applicationStatus: _applicationStatus }) => (
            <Card
              key={job.id}
              className='border-border/70 hover:border-primary/40 hover:shadow-xs transition-all'
            >
              <CardContent className='p-4 space-y-2.5 flex flex-col justify-between h-full'>
                <div className='space-y-1.5'>
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <h4 className='font-semibold text-xs text-foreground line-clamp-1'>
                        {job.title}
                      </h4>
                      <p className='text-[11px] text-muted-foreground font-medium'>{job.company}</p>
                    </div>
                    <StatusBadge
                      status='verified'
                      size='sm'
                      showIcon={false}
                      label={`Match: ${match.score}%`}
                    />
                  </div>
                  <p className='text-[11px] text-muted-foreground line-clamp-2 leading-relaxed'>
                    {match.headline}
                  </p>
                </div>

                <div className='pt-2 flex items-center justify-between border-t border-border/40'>
                  <span className='text-[10px] text-muted-foreground capitalize'>
                    {job.workArrangement} &bull; {job.source}
                  </span>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className={cn(
                      buttonVariants({ size: 'sm', variant: 'outline' }),
                      'text-[11px] h-7'
                    )}
                  >
                    View Match
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
