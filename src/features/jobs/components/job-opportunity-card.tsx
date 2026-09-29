'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { RankedOpportunity } from '../lib/ranking';
import { CandidateJobStatus } from '@/types/domain';

export interface JobOpportunityCardProps {
  opportunity: RankedOpportunity;
  onSave?: (jobId: string, currentStatus: CandidateJobStatus | null) => void;
  onDismiss?: (jobId: string, currentStatus: CandidateJobStatus | null) => void;
  isSaving?: boolean;
  isDismissing?: boolean;
}

function formatFreshness(postedDate?: string | Date | null): string {
  if (!postedDate) return 'Date unavailable';
  const date = new Date(postedDate);
  if (isNaN(date.getTime())) return 'Date unavailable';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Posted today';
  if (diffDays === 1) return 'Posted 1 day ago';
  if (diffDays < 7) return `Posted ${diffDays} days ago`;
  if (diffDays < 14) return 'Posted 1 week ago';
  if (diffDays < 30) return `Posted ${Math.floor(diffDays / 7)} weeks ago`;
  return `Posted ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
}

function formatSourceLabel(source?: string | null): string {
  if (!source) return 'Direct';
  switch (source.toLowerCase()) {
    case 'greenhouse':
      return 'Greenhouse';
    case 'lever':
      return 'Lever';
    case 'linkedin':
      return 'LinkedIn';
    case 'indeed':
      return 'Indeed';
    case 'workday':
      return 'Workday';
    case 'url_import':
      return 'URL Import';
    case 'manual':
      return 'Manual Import';
    case 'company_portal':
      return 'Company Careers';
    default:
      return source.replace('_', ' ');
  }
}

function getFactualRationale(opportunity: RankedOpportunity): string[] {
  const reasons: string[] = [];
  const { match, priority, job } = opportunity;
  const breakdown = priority.breakdown;

  // 1. Profile alignment / match
  if (match && match.score >= 80) {
    reasons.push(`Strong profile alignment (${match.score}%)`);
  } else if (match && match.score >= 65) {
    reasons.push(`Solid profile match (${match.score}%)`);
  }

  // 2. Work arrangement / location
  if (job.workArrangement === 'remote') {
    reasons.push('Remote opportunity');
  } else if (job.workArrangement === 'hybrid') {
    reasons.push('Hybrid work arrangement');
  } else if (job.location) {
    reasons.push(`Location: ${job.location}`);
  }

  // 3. Freshness & Preference Fit
  if (breakdown.freshnessScore >= 80) {
    reasons.push('Recently posted opportunity');
  } else if (breakdown.preferenceFit >= 80) {
    reasons.push('Strong fit with target role preferences');
  }

  // Return at most 3 factual reasons
  return reasons.slice(0, 3);
}

export function JobOpportunityCard({
  opportunity,
  onSave,
  onDismiss,
  isSaving = false,
  isDismissing = false
}: JobOpportunityCardProps) {
  const { job, priority, match, primarySource, candidateState, applicationStatus } = opportunity;
  const isSaved = candidateState?.status === 'SAVED';
  const isDismissed = candidateState?.status === 'DISMISSED';
  const isClosed = primarySource?.sourceStatus === 'closed';

  const factualReasons = getFactualRationale(opportunity);
  const freshnessText = formatFreshness(job.postedDate);
  const sourceLabel = formatSourceLabel(primarySource?.source || job.source);

  return (
    <Card
      tabIndex={0}
      aria-label={`${job.title} at ${job.company}`}
      className={cn(
        'group relative transition-all duration-200 hover:shadow-md border-border/80 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        isDismissed && 'opacity-60 bg-muted/20',
        isSaved && 'border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10'
      )}
    >
      <CardContent className='p-5 sm:p-6 flex flex-col gap-4'>
        {/* Top Meta & Badges */}
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1 flex-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <Link
                href={`/dashboard/jobs/${job.id}`}
                className='text-base sm:text-lg font-bold text-foreground hover:text-primary hover:underline transition-colors line-clamp-1'
              >
                {job.title}
              </Link>
            </div>
            <div className='flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground'>
              <span className='font-semibold text-foreground/90'>{job.company}</span>
              <span aria-hidden='true'>•</span>
              <span>{job.location || 'Location not specified'}</span>
              <span aria-hidden='true'>•</span>
              <span className='capitalize'>{job.workArrangement}</span>
            </div>
          </div>

          {/* Indicators / Badges */}
          <div className='flex flex-wrap items-center gap-1.5 shrink-0'>
            <Badge variant='outline' className='text-xs font-medium bg-muted/40'>
              {sourceLabel}
            </Badge>

            {isClosed ? (
              <Badge variant='destructive' className='text-xs font-semibold'>
                Closed
              </Badge>
            ) : applicationStatus ? (
              <Badge
                variant='secondary'
                className='text-xs font-medium bg-primary/10 text-primary border-primary/20'
              >
                Applied ({applicationStatus})
              </Badge>
            ) : isSaved ? (
              <Badge
                variant='secondary'
                className='text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
              >
                Saved
              </Badge>
            ) : candidateState?.status === 'VIEWED' ? (
              <Badge variant='outline' className='text-xs text-muted-foreground'>
                Viewed
              </Badge>
            ) : (
              <Badge
                variant='outline'
                className='text-xs font-semibold text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10'
              >
                New
              </Badge>
            )}
          </div>
        </div>

        {/* Scores Bar: Profile Alignment + Opportunity Priority */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-muted/30 border border-border/50'>
          {/* Profile Alignment */}
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm shrink-0'>
              {match ? `${match.score}%` : '—'}
            </div>
            <div className='min-w-0'>
              <div className='text-xs font-medium text-muted-foreground'>Profile alignment</div>
              <div className='text-sm font-semibold text-foreground truncate'>
                {match ? `${match.score}% Match` : 'Evaluation pending'}
              </div>
            </div>
          </div>

          {/* Opportunity Priority */}
          <div className='flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-border/60 pt-2 sm:pt-0 sm:pl-3'>
            <div className='h-10 w-10 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-sm shrink-0'>
              {priority.priorityScore.toFixed(0)}
            </div>
            <div className='min-w-0'>
              <div className='text-xs font-medium text-muted-foreground'>Opportunity Priority</div>
              <div className='text-xs text-muted-foreground truncate'>
                Fit {priority.preferenceFit.toFixed(0)} • Fresh {priority.freshness.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Why this is here (Factual Rationale) */}
        {factualReasons.length > 0 && (
          <div className='space-y-1.5 pt-0.5'>
            <div className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
              <Icons.sparkles className='h-3.5 w-3.5 text-amber-500' />
              <span>Why this is surfaced:</span>
            </div>
            <ul className='space-y-1 text-xs text-foreground/80 pl-1'>
              {factualReasons.map((reason, idx) => (
                <li key={idx} className='flex items-center gap-2'>
                  <span className='h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0' />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bottom Actions Row */}
        <div className='flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60'>
          <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <Icons.calendar className='h-3.5 w-3.5' />
            <span>{freshnessText}</span>
          </div>

          <div className='flex items-center gap-2 w-full sm:w-auto justify-end'>
            {/* Save Button */}
            <Button
              type='button'
              variant={isSaved ? 'secondary' : 'outline'}
              size='sm'
              disabled={isSaving}
              onClick={() => onSave?.(job.id, candidateState?.status || null)}
              className={cn(
                'min-h-[44px] px-3.5 text-xs font-medium transition-colors',
                isSaved &&
                  'bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border-amber-500/30'
              )}
              aria-label={isSaved ? `Unsave ${job.title}` : `Save ${job.title}`}
            >
              {isSaved ? (
                <>
                  <Icons.check className='mr-1.5 h-4 w-4 text-amber-600' />
                  Saved
                </>
              ) : (
                <>
                  <Icons.star className='mr-1.5 h-4 w-4' />
                  Save
                </>
              )}
            </Button>

            {/* Dismiss Button */}
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={isDismissing}
              onClick={() => onDismiss?.(job.id, candidateState?.status || null)}
              className='min-h-[44px] px-3 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors'
              aria-label={`Dismiss ${job.title}`}
            >
              <Icons.close className='mr-1 h-3.5 w-3.5' />
              Dismiss
            </Button>

            {/* Review Match Link */}
            <Link
              href={`/dashboard/jobs/${job.id}`}
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'min-h-[44px] px-3.5 text-xs font-medium'
              )}
            >
              Review Match
              <Icons.chevronRight className='ml-1 h-3.5 w-3.5' />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
