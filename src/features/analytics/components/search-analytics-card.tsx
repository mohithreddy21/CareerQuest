'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { SearchAnalytics } from '@/types/application-tracking';

interface SearchAnalyticsCardProps {
  analytics: SearchAnalytics;
}

export function SearchAnalyticsCard({ analytics }: SearchAnalyticsCardProps) {
  const { funnel, conversion, velocity, byRole, bySource, byMatchScoreRange, byTemplate } =
    analytics;

  return (
    <div className='space-y-6'>
      {/* 1. Funnel Overview Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3'>
        <div className='p-3.5 rounded-xl border border-border/70 bg-card text-center space-y-1'>
          <span className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block'>
            Discovered
          </span>
          <span className='text-xl font-bold text-foreground font-mono'>
            {funnel.totalDiscovered}
          </span>
        </div>

        <div className='p-3.5 rounded-xl border border-border/70 bg-card text-center space-y-1'>
          <span className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block'>
            Saved / Prepping
          </span>
          <span className='text-xl font-bold text-blue-600 font-mono'>{funnel.totalSaved}</span>
        </div>

        <div className='p-3.5 rounded-xl border border-border/70 bg-card text-center space-y-1'>
          <span className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block'>
            Applied
          </span>
          <span className='text-xl font-bold text-indigo-600 font-mono'>{funnel.totalApplied}</span>
        </div>

        <div className='p-3.5 rounded-xl border border-border/70 bg-card text-center space-y-1'>
          <span className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block'>
            Interviews
          </span>
          <span className='text-xl font-bold text-purple-600 font-mono'>
            {funnel.totalInterviews}
          </span>
        </div>

        <div className='p-3.5 rounded-xl border border-border/70 bg-card text-center space-y-1'>
          <span className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block'>
            Offers
          </span>
          <span className='text-xl font-bold text-emerald-600 font-mono'>{funnel.totalOffers}</span>
        </div>

        <div className='p-3.5 rounded-xl border border-border/70 bg-card text-center space-y-1'>
          <span className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block'>
            Rejected
          </span>
          <span className='text-xl font-bold text-rose-600 font-mono'>{funnel.totalRejected}</span>
        </div>

        <div className='p-3.5 rounded-xl border border-border/70 bg-card text-center space-y-1'>
          <span className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block'>
            Withdrawn
          </span>
          <span className='text-xl font-bold text-muted-foreground font-mono'>
            {funnel.totalWithdrawn}
          </span>
        </div>
      </div>

      {/* 2. Rates and Velocity KPIs */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        {/* Applied -> Interview Rate */}
        <Card className='border-border/80 shadow-xs'>
          <CardContent className='p-5 space-y-2'>
            <div className='flex items-center justify-between text-xs text-muted-foreground'>
              <span>Applied &rarr; Interview Rate</span>
              <Icons.calendar className='h-4 w-4 text-purple-600' />
            </div>
            <div className='flex items-baseline gap-2'>
              <span className='text-3xl font-bold text-foreground font-mono'>
                {conversion.appliedToInterviewRate}%
              </span>
              <span className='text-xs text-muted-foreground'>
                ({funnel.totalInterviews} of {funnel.totalApplied} submitted)
              </span>
            </div>
            <div className='w-full bg-muted h-1.5 rounded-full overflow-hidden'>
              <div
                className='bg-purple-600 h-full rounded-full transition-all'
                style={{ width: `${Math.min(100, conversion.appliedToInterviewRate)}%` }}
              />
            </div>
            <p className='text-[11px] text-muted-foreground pt-1'>
              Proportion of confirmed applications that progressed to an interview.
            </p>
          </CardContent>
        </Card>

        {/* Interview -> Offer Rate */}
        <Card className='border-border/80 shadow-xs'>
          <CardContent className='p-5 space-y-2'>
            <div className='flex items-center justify-between text-xs text-muted-foreground'>
              <span>Interview &rarr; Offer Rate</span>
              <Icons.check className='h-4 w-4 text-emerald-600' />
            </div>
            <div className='flex items-baseline gap-2'>
              <span className='text-3xl font-bold text-foreground font-mono'>
                {conversion.interviewToOfferRate}%
              </span>
              <span className='text-xs text-muted-foreground'>
                ({funnel.totalOffers} of {funnel.totalInterviews} interviewed)
              </span>
            </div>
            <div className='w-full bg-muted h-1.5 rounded-full overflow-hidden'>
              <div
                className='bg-emerald-600 h-full rounded-full transition-all'
                style={{ width: `${Math.min(100, conversion.interviewToOfferRate)}%` }}
              />
            </div>
            <p className='text-[11px] text-muted-foreground pt-1'>
              Proportion of interviewed opportunities that resulted in an offer.
            </p>
          </CardContent>
        </Card>

        {/* Process Velocity */}
        <Card className='border-border/80 shadow-xs'>
          <CardContent className='p-5 space-y-2'>
            <div className='flex items-center justify-between text-xs text-muted-foreground'>
              <span>Search Timing Metrics</span>
              <Icons.clock className='h-4 w-4 text-primary' />
            </div>
            <div className='space-y-2 pt-1'>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>Discovery &rarr; Application:</span>
                <strong className='font-mono text-foreground'>
                  {velocity.avgDaysToApply !== null
                    ? `${velocity.avgDaysToApply} days`
                    : 'Pending data'}
                </strong>
              </div>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>Time to First Recorded Outcome:</span>
                <strong className='font-mono text-foreground'>
                  {velocity.avgDaysToFirstRecordedOutcome !== null
                    ? `${velocity.avgDaysToFirstRecordedOutcome} days`
                    : 'Pending outcome'}
                </strong>
              </div>
            </div>
            <p className='text-[11px] text-muted-foreground pt-1'>
              Calculated exclusively from recorded timeline event timestamps.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Segmented Breakdowns */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Match Score Alignment Breakdown */}
        <Card className='border-border/80 shadow-xs'>
          <CardHeader className='pb-3 border-b border-border/60'>
            <CardTitle className='text-sm font-semibold'>Progress by Match Score Range</CardTitle>
            <CardDescription className='text-xs'>
              Descriptive observation of applications grouped by qualification alignment
            </CardDescription>
          </CardHeader>
          <CardContent className='p-4 space-y-3'>
            {byMatchScoreRange.map((b) => (
              <div key={b.name} className='space-y-1'>
                <div className='flex items-center justify-between text-xs'>
                  <span className='font-medium text-foreground'>{b.name}</span>
                  <span className='text-muted-foreground font-mono'>
                    {b.interviews} interviews / {b.totalApplications} apps ({b.responseRate}%)
                  </span>
                </div>
                <div className='w-full bg-muted h-2 rounded-full overflow-hidden'>
                  <div
                    className='bg-primary h-full rounded-full'
                    style={{ width: `${Math.min(100, b.responseRate)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Source Channel Breakdown */}
        <Card className='border-border/80 shadow-xs'>
          <CardHeader className='pb-3 border-b border-border/60'>
            <CardTitle className='text-sm font-semibold'>Progress by Application Source</CardTitle>
            <CardDescription className='text-xs'>
              Activity and interview progression across discovery channels
            </CardDescription>
          </CardHeader>
          <CardContent className='p-4 space-y-3'>
            {bySource.map((s) => (
              <div key={s.name} className='space-y-1'>
                <div className='flex items-center justify-between text-xs'>
                  <span className='font-medium text-foreground'>{s.name}</span>
                  <span className='text-muted-foreground font-mono'>
                    {s.interviews} interviews / {s.totalApplications} apps ({s.responseRate}%)
                  </span>
                </div>
                <div className='w-full bg-muted h-2 rounded-full overflow-hidden'>
                  <div
                    className='bg-indigo-600 h-full rounded-full'
                    style={{ width: `${Math.min(100, s.responseRate)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Role Breakdown */}
        <Card className='border-border/80 shadow-xs'>
          <CardHeader className='pb-3 border-b border-border/60'>
            <CardTitle className='text-sm font-semibold'>Progress by Role Category</CardTitle>
            <CardDescription className='text-xs'>
              Application outcomes distributed by role domain
            </CardDescription>
          </CardHeader>
          <CardContent className='p-4 space-y-3'>
            {byRole.map((r) => (
              <div key={r.name} className='space-y-1'>
                <div className='flex items-center justify-between text-xs'>
                  <span className='font-medium text-foreground'>{r.name}</span>
                  <span className='text-muted-foreground font-mono'>
                    {r.interviews} interviews / {r.totalApplications} apps ({r.responseRate}%)
                  </span>
                </div>
                <div className='w-full bg-muted h-2 rounded-full overflow-hidden'>
                  <div
                    className='bg-purple-600 h-full rounded-full'
                    style={{ width: `${Math.min(100, r.responseRate)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Template Usage Breakdown */}
        <Card className='border-border/80 shadow-xs'>
          <CardHeader className='pb-3 border-b border-border/60'>
            <CardTitle className='text-sm font-semibold'>Resume Presentation Templates</CardTitle>
            <CardDescription className='text-xs'>
              Descriptive count of templates selected for finalized applications
            </CardDescription>
          </CardHeader>
          <CardContent className='p-4 space-y-3'>
            {byTemplate.map((t) => (
              <div
                key={t.templateId}
                className='flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20'
              >
                <div>
                  <h5 className='text-xs font-semibold text-foreground'>{t.templateName}</h5>
                  <p className='text-[11px] text-muted-foreground'>
                    {t.interviews} reached interview
                  </p>
                </div>
                <Badge variant='outline' className='text-xs font-mono'>
                  {t.totalApplications} Applications
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
