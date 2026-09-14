'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { InsightEngineResult } from '../services/insight-engine';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SearchInsightsCardProps {
  result: InsightEngineResult;
}

export function SearchInsightsCard({ result }: SearchInsightsCardProps) {
  const { isDataSufficient, submittedCount, threshold, insights, feedbackRecommendations } = result;

  return (
    <div className='space-y-6'>
      {/* 1. Data-Sufficient Insights or UX Safeguard Fallback */}
      <Card className='border-border/80 shadow-xs'>
        <CardHeader className='pb-3 border-b border-border/60'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 rounded-md bg-amber-500/10 text-amber-600'>
                <Icons.search className='h-4 w-4' />
              </div>
              <div>
                <CardTitle className='text-sm font-semibold'>
                  Search Insights & Observations
                </CardTitle>
                <CardDescription className='text-xs'>
                  Descriptive historical observations grounded strictly in submitted application
                  outcomes
                </CardDescription>
              </div>
            </div>

            <Badge
              variant='outline'
              className={
                isDataSufficient
                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-xs font-mono'
                  : 'bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs font-mono'
              }
            >
              Submitted Applications: {submittedCount} / {threshold}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className='p-4 sm:p-6'>
          {!isDataSufficient ? (
            <div className='py-8 px-4 text-center border border-dashed border-border/80 rounded-xl bg-muted/20 space-y-3'>
              <Icons.info className='h-8 w-8 text-amber-500 mx-auto' />
              <div className='space-y-1'>
                <h4 className='text-sm font-semibold text-foreground'>
                  Not enough data for a useful comparison yet
                </h4>
                <p className='text-xs text-muted-foreground max-w-md mx-auto leading-relaxed'>
                  To prevent manufacturing unverified conclusions, CareerQuest requires at least{' '}
                  <strong className='text-foreground font-mono'>
                    {threshold} confirmed applications
                  </strong>{' '}
                  before drawing strategy observations. Currently submitted:{' '}
                  <strong className='text-foreground font-mono'>{submittedCount}</strong>.
                </p>
              </div>
              <div className='pt-2 flex justify-center'>
                <Link
                  href='/dashboard/discover'
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'text-xs gap-1.5'
                  )}
                >
                  <Icons.add className='h-3.5 w-3.5' />
                  Discover Next Opportunity
                </Link>
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {insights.map((ins) => (
                <div
                  key={ins.id}
                  className='p-4 rounded-xl border border-border/70 bg-card space-y-2.5 hover:border-border transition-colors'
                >
                  <div className='flex items-start justify-between gap-2'>
                    <div className='space-y-0.5'>
                      <span className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block'>
                        {ins.category.replace('_', ' ')}
                      </span>
                      <h4 className='text-xs font-semibold text-foreground'>{ins.title}</h4>
                    </div>
                    <Badge variant='secondary' className='text-[10px] capitalize shrink-0'>
                      {ins.confidence} confidence
                    </Badge>
                  </div>

                  <p className='text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/40'>
                    <strong>Observation:</strong> {ins.observation}
                  </p>

                  <p className='text-xs text-foreground/90 leading-relaxed'>
                    <strong className='text-foreground'>Recommendation:</strong>{' '}
                    {ins.recommendation}
                  </p>

                  <div className='flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground'>
                    <span className='italic'>{ins.dataBasis}</span>
                    {ins.actionUrl && (
                      <Link
                        href={ins.actionUrl}
                        className='text-primary hover:underline font-medium inline-flex items-center gap-1'
                      >
                        {ins.actionLabel || 'Action'} <Icons.chevronRight className='h-3 w-3' />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Knowledge Bank Feedback Loop */}
      <Card className='border-indigo-500/20 bg-indigo-500/5 shadow-xs'>
        <CardHeader className='pb-3 border-b border-indigo-500/10'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 rounded-md bg-indigo-500/10 text-indigo-600'>
              <Icons.info className='h-4 w-4' />
            </div>
            <div>
              <CardTitle className='text-sm font-semibold text-foreground'>
                Candidate Feedback Loop
              </CardTitle>
              <CardDescription className='text-xs text-muted-foreground'>
                Observations across target roles that suggest updating your approved career
                knowledge
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className='p-4 sm:p-6 space-y-4'>
          {feedbackRecommendations.map((fb) => (
            <div
              key={fb.id}
              className='p-4 rounded-xl border border-indigo-500/20 bg-background space-y-3'
            >
              <div className='space-y-1'>
                <h4 className='text-xs font-semibold text-foreground flex items-center gap-2'>
                  <span className='h-2 w-2 rounded-full bg-indigo-500' />
                  {fb.title}
                </h4>
                <p className='text-xs text-muted-foreground leading-relaxed'>{fb.observation}</p>
              </div>

              <div className='p-3 rounded-lg bg-muted/40 border border-border/60 text-xs space-y-1'>
                <span className='font-semibold text-foreground block'>Suggested Next Step:</span>
                <p className='text-muted-foreground leading-relaxed'>{fb.recommendation}</p>
              </div>

              <div className='flex flex-wrap items-center justify-between gap-2 pt-1'>
                <span className='text-[11px] text-muted-foreground font-medium'>
                  Protection invariant: CareerQuest never automatically adds, approves, or invents
                  candidate skills.
                </span>
                <Link
                  href={fb.actionUrl}
                  className={cn(buttonVariants({ size: 'sm' }), 'text-xs h-7 font-medium gap-1.5')}
                >
                  <Icons.edit className='h-3.5 w-3.5' />
                  {fb.actionLabel}
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
