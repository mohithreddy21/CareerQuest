'use client';

import { JobMatch } from '@/types/domain';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface MatchScoreCardProps {
  match: JobMatch;
  isAnalyzing?: boolean;
  onReanalyze?: () => void;
  className?: string;
}

export function MatchScoreCard({
  match,
  isAnalyzing = false,
  onReanalyze,
  className
}: MatchScoreCardProps) {
  const { score, recommendation, headline, reasoning } = match;

  // Recommendation configuration: label, badge variant, color theme
  const recommendationConfig: Record<
    JobMatch['recommendation'],
    {
      label: string;
      badgeClass: string;
      scoreClass: string;
      ariaLabel: string;
    }
  > = {
    strong: {
      label: 'Strong fit — Worth prioritizing',
      badgeClass:
        'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      scoreClass: 'bg-emerald-600 dark:bg-emerald-500 text-white',
      ariaLabel: 'Strong fit, worth prioritizing'
    },
    good: {
      label: 'Good fit — Worth considering',
      badgeClass:
        'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      scoreClass: 'bg-blue-600 dark:bg-blue-500 text-white',
      ariaLabel: 'Good fit, worth considering'
    },
    moderate: {
      label: 'Mixed fit — Review gaps before investing time',
      badgeClass:
        'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      scoreClass: 'bg-amber-600 dark:bg-amber-500 text-white',
      ariaLabel: 'Mixed fit, review gaps before investing time'
    },
    low: {
      label: 'Weak fit — Probably not a priority',
      badgeClass: 'bg-muted text-muted-foreground border-border',
      scoreClass: 'bg-slate-600 dark:bg-slate-500 text-white',
      ariaLabel: 'Weak fit, probably not a priority'
    }
  };

  const recInfo = recommendationConfig[recommendation] || recommendationConfig.moderate;

  return (
    <Card
      className={cn(
        'border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-xs overflow-hidden',
        className
      )}
      aria-label='Job Match Decision Support'
    >
      <CardHeader className='pb-3'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-4'>
            {/* Visual Alignment Score Meter */}
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl shadow-xs font-bold transition-transform',
                recInfo.scoreClass
              )}
              aria-label={`Profile alignment score: ${score} percent`}
            >
              <span className='text-xl leading-none'>{score}%</span>
              <span className='text-[9px] uppercase tracking-wider opacity-90 mt-0.5'>Fit</span>
            </div>

            <div className='space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                  Profile Alignment
                </span>
                <Badge
                  variant='outline'
                  className={cn('text-xs font-medium px-2 py-0.5', recInfo.badgeClass)}
                  aria-label={recInfo.ariaLabel}
                >
                  {recInfo.label}
                </Badge>
              </div>
              <h2 className='text-base font-semibold tracking-tight text-foreground sm:text-lg'>
                {headline}
              </h2>
            </div>
          </div>

          {/* Action button to re-run deterministic analysis */}
          {onReanalyze && (
            <Button
              variant='outline'
              size='sm'
              disabled={isAnalyzing}
              onClick={onReanalyze}
              className='self-start sm:self-auto text-xs shrink-0 gap-1.5'
              aria-label='Re-analyze this opportunity against your profile'
            >
              <Icons.refresh className={cn('h-3.5 w-3.5', isAnalyzing && 'animate-spin')} />
              {isAnalyzing ? 'Analyzing...' : 'Re-analyze Fit'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className='space-y-4 pt-0 text-sm'>
        {/* Human-readable match reasoning */}
        <p className='text-foreground/90 leading-relaxed font-normal'>{reasoning}</p>

        {/* Provenance Tags Legend */}
        <div className='flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground'>
          <span className='font-medium text-foreground/80 mr-1'>Data Provenance:</span>
          <span className='inline-flex items-center gap-1 rounded-md border border-border/80 bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground/90'>
            <Icons.page className='h-3 w-3 text-muted-foreground' /> From job posting
          </span>
          <span className='inline-flex items-center gap-1 rounded-md border border-border/80 bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-foreground/90'>
            <Icons.user className='h-3 w-3 text-primary' /> From your profile
          </span>
          <span className='inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary'>
            <Icons.sparkles className='h-3 w-3 text-primary' /> CareerQuest analysis
          </span>
        </div>

        {/* Explicit Non-Predictive Disclaimer per Section 5 & 10 */}
        <div
          className='rounded-lg border border-primary/20 bg-background/80 p-3 text-xs text-muted-foreground flex items-start gap-2.5'
          role='note'
        >
          <Icons.info className='h-4 w-4 text-primary shrink-0 mt-0.5' aria-hidden='true' />
          <p className='leading-relaxed'>
            <strong className='font-semibold text-foreground'>Decision-support metric:</strong> This
            score evaluates how closely your verified master profile credentials align with the
            declared job requirements. It is designed solely to help you prioritize where to invest
            your application time. It does <em>not</em> predict employer hiring outcomes, interview
            decisions, or job offers.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
