'use client';

import { JobMatch, MatchPoint } from '@/types/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface MatchBreakdownProps {
  match: JobMatch;
  className?: string;
}

export function MatchBreakdown({ match, className }: MatchBreakdownProps) {
  const { strongMatches, partialMatches, missingRequirements, supportingCandidateEvidence } = match;

  const totalEvaluated = strongMatches.length + partialMatches.length + missingRequirements.length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Requirement Alignment Assessment */}
      <Card className='shadow-xs'>
        <CardHeader className='pb-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base font-semibold'>Requirements Alignment</CardTitle>
              <CardDescription className='text-xs'>
                Detailed breakdown of job requirements evaluated against your verified profile
                credentials.
              </CardDescription>
            </div>
            <span className='text-xs text-muted-foreground font-medium'>
              {totalEvaluated} Requirements Evaluated
            </span>
          </div>
        </CardHeader>

        <CardContent className='space-y-5 pt-0'>
          {/* 1. Strong Matches */}
          {strongMatches.length > 0 && (
            <div className='space-y-2.5'>
              <div className='flex items-center justify-between'>
                <h3 className='flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400'>
                  <Icons.circleCheck className='h-4 w-4 shrink-0' aria-hidden='true' />
                  <span>Strong Matches ({strongMatches.length})</span>
                </h3>
                <Badge
                  variant='outline'
                  className='text-[11px] font-normal border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
                >
                  Verified Evidence
                </Badge>
              </div>

              <div className='space-y-2.5 pl-2 sm:pl-4'>
                {strongMatches.map((item, idx) => (
                  <RequirementMatchItem key={idx} item={item} tier='strong' />
                ))}
              </div>
            </div>
          )}

          {/* 2. Partial Alignment / Growth Areas */}
          {partialMatches.length > 0 && (
            <div className='space-y-2.5 pt-3 border-t border-border/60'>
              <div className='flex items-center justify-between'>
                <h3 className='flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400'>
                  <Icons.warning className='h-4 w-4 shrink-0' aria-hidden='true' />
                  <span>Partial Alignment & Growth Areas ({partialMatches.length})</span>
                </h3>
                <Badge
                  variant='outline'
                  className='text-[11px] font-normal border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300'
                >
                  Related Skills
                </Badge>
              </div>

              <div className='space-y-2.5 pl-2 sm:pl-4'>
                {partialMatches.map((item, idx) => (
                  <RequirementMatchItem key={idx} item={item} tier='partial' />
                ))}
              </div>
            </div>
          )}

          {/* 3. Missing / Unverified Requirements */}
          {missingRequirements.length > 0 ? (
            <div className='space-y-2.5 pt-3 border-t border-border/60'>
              <div className='flex items-center justify-between'>
                <h3 className='flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400'>
                  <Icons.close className='h-4 w-4 shrink-0' aria-hidden='true' />
                  <span>Missing or Unverified Requirements ({missingRequirements.length})</span>
                </h3>
                <Badge
                  variant='outline'
                  className='text-[11px] font-normal border-rose-200 text-rose-700 dark:border-rose-800 dark:text-rose-300'
                >
                  Evidence Gap
                </Badge>
              </div>

              <div className='space-y-2.5 pl-2 sm:pl-4'>
                {missingRequirements.map((item, idx) => (
                  <RequirementMatchItem key={idx} item={item} tier='missing' />
                ))}
              </div>
            </div>
          ) : (
            <div className='rounded-md border border-emerald-200/60 bg-emerald-50/50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-center gap-2'>
              <Icons.circleCheck className='h-4 w-4 shrink-0 text-emerald-600' />
              <span>No critical missing requirements identified for this position.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Candidate Evidence Provenance */}
      <Card className='shadow-xs'>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base font-semibold'>
                Candidate Evidence Provenance
              </CardTitle>
              <CardDescription className='text-xs'>
                Direct quotes and achievements from your verified profile supporting this match
                assessment.
              </CardDescription>
            </div>
            <span className='inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md'>
              <Icons.user className='h-3 w-3 text-primary' /> Verified Profile
            </span>
          </div>
        </CardHeader>

        <CardContent className='space-y-3 pt-0'>
          {supportingCandidateEvidence.length > 0 ? (
            supportingCandidateEvidence.map((ev, idx) => (
              <div
                key={idx}
                className='rounded-lg border border-border/60 bg-muted/20 p-3.5 text-xs space-y-2 transition-colors hover:bg-muted/30'
              >
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='font-semibold text-foreground flex items-center gap-1.5'>
                    <Icons.circleCheck className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0' />
                    {ev.requirementText}
                  </span>
                  <Badge variant='outline' className='text-[10px] font-medium shrink-0'>
                    {ev.evidenceSource}
                  </Badge>
                </div>
                <div className='rounded-md border border-border/40 bg-background/90 p-2.5 italic text-foreground/90 leading-relaxed'>
                  &ldquo;{ev.evidenceSnippet}&rdquo;
                </div>
              </div>
            ))
          ) : (
            <div className='rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground'>
              No matching evidence found in your current candidate profile.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Subcomponent: Individual Requirement-to-Evidence Item
function RequirementMatchItem({
  item,
  tier
}: {
  item: MatchPoint;
  tier: 'strong' | 'partial' | 'missing';
}) {
  const tierConfig = {
    strong: {
      border:
        'border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10',
      badge: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
      label: 'Strong Match'
    },
    partial: {
      border: 'border-amber-200/60 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10',
      badge: 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
      label: 'Partial Match'
    },
    missing: {
      border: 'border-rose-200/60 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10',
      badge: 'bg-rose-100/80 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
      label: 'Unverified Area'
    }
  };

  const conf = tierConfig[tier];

  return (
    <div className={cn('rounded-md p-3 border text-xs space-y-1.5 transition-colors', conf.border)}>
      <div className='flex flex-wrap items-center justify-between gap-1.5'>
        <span className='font-semibold text-foreground text-sm leading-tight'>{item.title}</span>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', conf.badge)}>
          {conf.label}
        </span>
      </div>

      <p className='text-muted-foreground leading-relaxed'>{item.detail}</p>

      {/* Inline Candidate Evidence if attached */}
      {item.evidenceSource && item.evidenceSnippet && (
        <div className='mt-2 rounded border border-border/40 bg-background/90 p-2 text-[11px] space-y-1'>
          <div className='flex items-center justify-between text-muted-foreground'>
            <span className='font-medium text-foreground/80'>Candidate Evidence:</span>
            <span className='text-[10px] italic'>{item.evidenceSource}</span>
          </div>
          <p className='italic text-foreground/90'>&ldquo;{item.evidenceSnippet}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
