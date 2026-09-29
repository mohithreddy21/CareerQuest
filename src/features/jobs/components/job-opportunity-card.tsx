'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
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
        'group relative transition-all duration-200 hover:shadow-xs border-border/80 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        isDismissed && 'opacity-60 bg-muted/20',
        isSaved && 'border-amber-500/40 bg-amber-50/15 dark:bg-amber-950/10'
      )}
    >
      <CardContent className='p-4 sm:p-5 flex flex-col gap-3.5'>
        {/* Top Meta & Badges */}
        <div className='flex flex-wrap items-start justify-between gap-2.5'>
          <div className='space-y-1 flex-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <Link
                href={`/dashboard/jobs/${job.id}`}
                className='type-heading text-foreground hover:text-primary transition-colors line-clamp-1'
              >
                {job.title}
              </Link>
            </div>
            <div className='flex flex-wrap items-center gap-2 type-body-sm text-muted-foreground'>
              <span className='font-semibold text-foreground/90'>{job.company}</span>
              <span aria-hidden='true'>•</span>
              <span>{job.location || 'Location not specified'}</span>
              <span aria-hidden='true'>•</span>
              <span className='capitalize'>{job.workArrangement}</span>
            </div>
          </div>

          {/* Indicators / Semantic Status Badges */}
          <div className='flex flex-wrap items-center gap-1.5 shrink-0'>
            <Badge variant='outline' className='text-[11px] font-medium bg-muted/40'>
              {sourceLabel}
            </Badge>

            {isClosed ? (
              <StatusBadge status='error' size='sm' label='Closed' />
            ) : applicationStatus ? (
              <StatusBadge status='info' size='sm' label={`Applied (${applicationStatus})`} />
            ) : isSaved ? (
              <StatusBadge status='warning' size='sm' label='Saved' />
            ) : candidateState?.status === 'VIEWED' ? (
              <StatusBadge status='neutral' size='sm' label='Viewed' />
            ) : (
              <StatusBadge status='customized' size='sm' label='New' />
            )}
          </div>
        </div>

        {/* Decision-Support Bar: Qualification Alignment & Opportunity Priority */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border border-border/60'>
          {/* Profile Alignment */}
          <div className='flex items-center gap-2.5'>
            <div className='min-w-0 flex-1 space-y-0.5'>
              <div className='type-caption text-muted-foreground uppercase tracking-wider font-semibold'>
                Profile Alignment
              </div>
              <div className='type-body-sm font-medium text-foreground flex items-center gap-2 truncate'>
                {match ? (
                  <>
                    <StatusBadge
                      status={match.score >= 70 ? 'verified' : 'review'}
                      size='sm'
                      showIcon={false}
                      label={`${match.score}% Alignment`}
                    />
                    <span className='type-caption text-muted-foreground capitalize'>
                      ({match.recommendation} fit)
                    </span>
                  </>
                ) : (
                  <span className='type-caption text-muted-foreground italic'>
                    Evaluation pending
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Opportunity Priority */}
          <div className='flex items-center gap-2.5 border-t sm:border-t-0 sm:border-l border-border/60 pt-2 sm:pt-0 sm:pl-3'>
            <div className='min-w-0 flex-1 space-y-0.5'>
              <div className='type-caption text-muted-foreground uppercase tracking-wider font-semibold'>
                Opportunity Priority
              </div>
              <div className='type-body-sm font-medium text-foreground flex items-center gap-2 truncate'>
                <Badge variant='outline' className='text-[11px] font-mono font-semibold'>
                  Score {priority.priorityScore.toFixed(0)}
                </Badge>
                <span className='type-caption text-muted-foreground'>
                  Fit {priority.breakdown.preferenceFit.toFixed(0)}% • Fresh{' '}
                  {priority.breakdown.freshnessScore.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Why this is surfaced (Factual Rationale) */}
        {factualReasons.length > 0 && (
          <div className='space-y-1 pt-0.5'>
            <div className='type-caption font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5'>
              <Icons.sparkles className='size-3 text-amber-500' aria-hidden='true' />
              <span>Why this is surfaced:</span>
            </div>
            <ul className='space-y-0.5 type-body-sm text-foreground/80 pl-1'>
              {factualReasons.map((reason, idx) => (
                <li key={idx} className='flex items-center gap-2'>
                  <span
                    className='size-1.5 rounded-full bg-primary/70 shrink-0'
                    aria-hidden='true'
                  />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bottom Actions Row */}
        <div className='flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60'>
          <div className='flex items-center gap-1.5 type-caption text-muted-foreground'>
            <Icons.calendar className='size-3.5' aria-hidden='true' />
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
                'h-8 px-3 text-xs font-medium transition-colors',
                isSaved &&
                  'bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border-amber-500/30'
              )}
              aria-label={isSaved ? `Unsave ${job.title}` : `Save ${job.title}`}
            >
              {isSaved ? (
                <>
                  <Icons.check className='mr-1.5 size-3.5 text-amber-600' />
                  Saved
                </>
              ) : (
                <>
                  <Icons.star className='mr-1.5 size-3.5' />
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
              className='h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors'
              aria-label={`Dismiss ${job.title}`}
            >
              <Icons.close className='mr-1 size-3' />
              Dismiss
            </Button>

            {/* Review Match Link */}
            <Link
              href={`/dashboard/jobs/${job.id}`}
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'h-8 px-3 text-xs font-medium shadow-2xs'
              )}
            >
              Review Match
              <Icons.chevronRight className='ml-1 size-3' />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
