import React from 'react';
import { PreFlightCheckItem, ReadyRoomEvaluation } from '../lib/readiness-evaluator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface PreFlightChecklistProps {
  evaluation: ReadyRoomEvaluation;
  className?: string;
  onNavigateToTab?: (tab: 'resume' | 'cover_letter' | 'questions' | 'final_review') => void;
}

function getBadgeConfig(status: PreFlightCheckItem['status']) {
  switch (status) {
    case 'ready':
      return { status: 'verified' as const, label: 'Ready' };
    case 'needs_review':
      return { status: 'review' as const, label: 'Needs Review' };
    case 'missing':
      return { status: 'error' as const, label: 'Missing' };
    case 'unavailable':
      return { status: 'neutral' as const, label: 'Unavailable' };
  }
}

export function PreFlightChecklist({
  evaluation,
  className,
  onNavigateToTab
}: PreFlightChecklistProps) {
  return (
    <Card className={cn('border-border/80 shadow-xs space-y-4', className)}>
      <CardHeader className='pb-3 border-b border-border/60'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='space-y-1'>
            <div className='flex items-center gap-2 flex-wrap'>
              <CardTitle className='text-base font-bold'>
                Pre-Flight Application Checklist
              </CardTitle>
              {evaluation.isApplied ? (
                <StatusBadge status='verified' label='Historically Confirmed' size='sm' />
              ) : evaluation.blockingCount > 0 ? (
                <StatusBadge status='error' label='Blocking Issues Identified' size='sm' />
              ) : evaluation.warningsCount > 0 ? (
                <StatusBadge status='review' label='Review Recommended' size='sm' />
              ) : (
                <StatusBadge status='verified' label='All Items Ready' size='sm' />
              )}
            </div>
            <CardDescription className='text-xs'>
              Verify your tailored materials, grounding evidence, and target destination before
              external submission.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className='pt-1 space-y-3'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          {evaluation.items.map((item) => {
            const badge = getBadgeConfig(item.status);
            const isClickable = Boolean(onNavigateToTab);

            const handleClick = () => {
              if (!onNavigateToTab) return;
              if (item.category === 'resume') onNavigateToTab('resume');
              else if (item.category === 'cover_letter') onNavigateToTab('cover_letter');
              else if (item.category === 'questions') onNavigateToTab('questions');
              else if (item.category === 'destination') onNavigateToTab('final_review');
            };

            const cardClasses = cn(
              'rounded-lg border p-3.5 flex flex-col justify-between gap-2 transition-colors text-left w-full',
              isClickable && 'cursor-pointer hover:border-foreground/30',
              item.status === 'ready' && 'border-emerald-500/20 bg-emerald-500/5',
              item.status === 'needs_review' && 'border-amber-500/20 bg-amber-500/5',
              item.status === 'missing' &&
                item.isBlocking &&
                'border-destructive/30 bg-destructive/5',
              item.status === 'missing' && !item.isBlocking && 'border-border/60 bg-muted/20',
              item.status === 'unavailable' && 'border-border/60 bg-muted/20'
            );

            const content = (
              <>
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-semibold text-xs text-foreground flex items-center gap-1.5'>
                    {item.isBlocking && item.status !== 'ready' && (
                      <span
                        className='h-1.5 w-1.5 rounded-full bg-destructive shrink-0'
                        title='Blocking Issue'
                      />
                    )}
                    {item.label}
                  </span>
                  <StatusBadge status={badge.status} label={badge.label} size='sm' />
                </div>
                <p className='text-[11px] text-muted-foreground leading-relaxed'>{item.detail}</p>
              </>
            );

            if (isClickable) {
              return (
                <button key={item.id} type='button' onClick={handleClick} className={cardClasses}>
                  {content}
                </button>
              );
            }

            return (
              <div key={item.id} className={cardClasses}>
                {content}
              </div>
            );
          })}
        </div>

        {evaluation.blockingCount > 0 && !evaluation.isApplied && (
          <div className='rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2.5 text-xs text-destructive'>
            <Icons.warning className='h-4 w-4 shrink-0 mt-0.5' />
            <div className='space-y-0.5'>
              <p className='font-semibold'>Application Cannot Be Completed Yet</p>
              <p className='text-[11px] text-foreground/80 leading-relaxed'>
                Please resolve the {evaluation.blockingCount} blocking item(s) highlighted above
                before opening the application destination.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
