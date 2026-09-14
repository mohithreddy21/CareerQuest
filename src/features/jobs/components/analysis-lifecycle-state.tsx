'use client';

import { AnalysisStatus } from '@/types/domain';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface AnalysisLifecycleStateProps {
  status: AnalysisStatus;
  errorMessage?: string;
  isTriggering?: boolean;
  onAnalyze: () => void;
  className?: string;
}

export function AnalysisLifecycleState({
  status,
  errorMessage,
  isTriggering = false,
  onAnalyze,
  className
}: AnalysisLifecycleStateProps) {
  if (status === 'success') {
    return null;
  }

  if (status === 'processing' || isTriggering) {
    return (
      <Card className={cn('border-primary/30 bg-primary/5 shadow-xs', className)}>
        <CardContent className='flex flex-col items-center justify-center p-6 text-center space-y-3 sm:flex-row sm:text-left sm:space-y-0 sm:space-x-4'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <Icons.spinner className='h-5 w-5 animate-spin' />
          </div>
          <div className='space-y-1 flex-1'>
            <p className='text-sm font-semibold text-foreground'>
              Analyzing Opportunity & Profile Alignment...
            </p>
            <p className='text-xs text-muted-foreground'>
              Evaluating job requirements, seniority level, and cross-referencing your verified
              master profile evidence.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card
        className={cn(
          'border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20 shadow-xs',
          className
        )}
      >
        <CardContent className='flex flex-col items-center justify-between gap-4 p-5 sm:flex-row'>
          <div className='flex items-start gap-3'>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 mt-0.5'>
              <Icons.close className='h-4 w-4' />
            </div>
            <div className='space-y-1 text-left'>
              <p className='text-sm font-semibold text-foreground'>
                Opportunity Analysis Unavailable
              </p>
              <p className='text-xs text-muted-foreground'>
                {errorMessage ||
                  'Unable to complete profile match evaluation. The normalized job posting remains fully accessible below.'}
              </p>
            </div>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={onAnalyze}
            disabled={isTriggering}
            className='shrink-0 text-xs gap-1.5'
          >
            <Icons.refresh className='h-3.5 w-3.5' /> Retry Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Idle state
  return (
    <Card className={cn('border-border/80 bg-muted/20 shadow-xs', className)}>
      <CardContent className='flex flex-col items-center justify-between gap-4 p-5 sm:flex-row'>
        <div className='flex items-start gap-3'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground mt-0.5'>
            <Icons.sparkles className='h-4 w-4 text-primary' />
          </div>
          <div className='space-y-1 text-left'>
            <p className='text-sm font-semibold text-foreground'>
              Opportunity Analysis Ready to Run
            </p>
            <p className='text-xs text-muted-foreground'>
              Compare this opportunity against your verified profile to assess alignment and
              prioritize your application.
            </p>
          </div>
        </div>
        <Button
          variant='default'
          size='sm'
          onClick={onAnalyze}
          disabled={isTriggering}
          className='shrink-0 text-xs gap-1.5'
        >
          <Icons.sparkles className='h-3.5 w-3.5' /> Analyze Fit Now
        </Button>
      </CardContent>
    </Card>
  );
}
