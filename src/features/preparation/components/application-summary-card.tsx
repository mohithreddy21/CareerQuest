import React from 'react';
import { ApplicationSummary } from '@/types/preparation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface ApplicationSummaryCardProps {
  summary: ApplicationSummary;
  className?: string;
}

export function ApplicationSummaryCard({ summary, className }: ApplicationSummaryCardProps) {
  const isReady = summary.readinessStatus === 'ready';
  const isNeedsReview = summary.readinessStatus === 'needs_review';

  return (
    <Card className={cn('border-border/80 shadow-xs space-y-4', className)}>
      <CardHeader className='pb-2 border-b border-border/60'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <div className='flex items-center gap-2'>
              <CardTitle className='text-base font-bold'>
                Application Readiness & Pre-Flight
              </CardTitle>
              <Badge
                variant={isReady ? 'default' : isNeedsReview ? 'secondary' : 'outline'}
                className={cn(
                  'text-xs font-semibold uppercase tracking-wider',
                  isReady && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                  isNeedsReview &&
                    'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400'
                )}
              >
                {isReady
                  ? 'Ready for External Application'
                  : isNeedsReview
                    ? 'Review In Progress'
                    : 'Materials Incomplete'}
              </Badge>
            </div>
            <CardDescription className='text-xs'>
              Final pre-flight check before opening {summary.company}&apos;s external portal.
            </CardDescription>
          </div>

          <div className='flex items-center gap-2 text-xs font-mono text-muted-foreground'>
            <span>
              Template: <strong className='text-foreground'>{summary.selectedTemplateName}</strong>
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-5 pt-1'>
        {/* Checklist Grid */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          {summary.checklist.map((item) => {
            const isComplete = item.status === 'complete';
            const isWarning = item.status === 'warning';

            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-lg border p-3 flex items-start gap-2.5 transition-colors',
                  isComplete
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : isWarning
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-destructive/30 bg-destructive/5'
                )}
              >
                {isComplete ? (
                  <Icons.circleCheck className='h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5' />
                ) : isWarning ? (
                  <Icons.warning className='h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5' />
                ) : (
                  <Icons.close className='h-4 w-4 shrink-0 text-destructive mt-0.5' />
                )}

                <div className='space-y-0.5 text-xs'>
                  <p className='font-semibold text-foreground'>{item.title}</p>
                  <p className='text-muted-foreground text-[11px] leading-relaxed'>
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Known Gaps Alert if Present */}
        {summary.knownGaps && summary.knownGaps.length > 0 && (
          <div className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1.5'>
            <div className='flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300'>
              <Icons.info className='h-4 w-4 text-amber-600' />
              <span>Verified Skill Gaps Acknowledged ({summary.knownGaps.length})</span>
            </div>
            <p className='text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed'>
              The following job criteria have no supporting evidence in your Knowledge Bank. In
              accordance with CareerQuest grounding principles, they have NOT been added to your
              tailored resume:
            </p>
            <ul className='list-disc pl-5 space-y-0.5 text-[11px] font-mono text-amber-950 dark:text-amber-100'>
              {summary.knownGaps.map((gap, gIdx) => (
                <li key={gIdx}>{gap}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
