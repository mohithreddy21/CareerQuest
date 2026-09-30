'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { applicationHistoricalPackageOptions } from '../api/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Icons } from '@/components/icons';
import { getResumeTemplate } from '@/features/templates/constants/templates';
import { ResumeRenderer } from '@/features/templates/components/resume-renderer';
import { Skeleton } from '@/components/ui/skeleton';
import { APPLICATION_STATUS_LABELS } from '@/types/domain';

export interface SubmittedPackageViewerProps {
  applicationId: string;
}

export function SubmittedPackageViewer({ applicationId }: SubmittedPackageViewerProps) {
  const {
    data: pkg,
    isLoading,
    isError,
    error
  } = useQuery(applicationHistoricalPackageOptions(applicationId));

  if (isLoading) {
    return (
      <div className='space-y-6 pt-2'>
        <Card className='p-6'>
          <Skeleton className='h-8 w-1/3 mb-4' />
          <Skeleton className='h-24 w-full' />
        </Card>
        <Card className='p-6'>
          <Skeleton className='h-48 w-full' />
        </Card>
      </div>
    );
  }

  if (isError || !pkg) {
    return (
      <Card className='border-destructive/30 bg-destructive/5 p-6'>
        <div className='flex items-center gap-3 text-destructive'>
          <Icons.warning className='h-5 w-5 shrink-0' />
          <div>
            <h3 className='font-semibold text-sm'>Submitted Package Unavailable</h3>
            <p className='text-xs text-muted-foreground mt-1'>
              {error instanceof Error
                ? error.message
                : 'Historical package could not be retrieved or this application has not yet been submitted.'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const activeTemplate = getResumeTemplate(pkg.selectedTemplateId);
  const jobToDisplay = pkg.jobSnapshot || pkg.currentJob;
  const jobSourceUrl = pkg.jobSnapshot
    ? pkg.jobSnapshot.sourceUrl
    : pkg.currentJob
      ? pkg.currentJob.originalUrl
      : null;

  return (
    <div className='space-y-6 pt-1'>
      {/* 1. Header Banner & Submission Summary */}
      <Card className='border-emerald-500/30 bg-emerald-500/5 shadow-xs'>
        <CardContent className='p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
          <div className='space-y-1.5'>
            <div className='flex flex-wrap items-center gap-2'>
              <StatusBadge status='verified' label='Immutable Historical Record' showIcon />
              <Badge
                variant='outline'
                className='text-xs font-mono border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
              >
                Submitted &amp; Frozen
              </Badge>
              <Badge variant='secondary' className='text-xs capitalize'>
                {APPLICATION_STATUS_LABELS[pkg.status] || pkg.status}
              </Badge>
            </div>
            <h2 className='text-xl font-bold tracking-tight text-foreground'>
              Submitted Application Package
            </h2>
            <p className='text-xs text-muted-foreground max-w-2xl leading-relaxed'>
              This is a permanent, read-only snapshot of the exact job posting, tailored resume,
              cover letter, and responses submitted on{' '}
              {pkg.dateApplied
                ? new Date(pkg.dateApplied).toLocaleDateString()
                : 'the submission date'}
              . Subsequent edits to your Knowledge Bank, Master Resume, or active job listings do
              not alter this historical record.
            </p>
          </div>

          <div className='flex flex-col gap-1.5 bg-background/80 dark:bg-card/80 p-3.5 rounded-lg border border-border/70 min-w-[200px] shrink-0 text-xs'>
            <div className='flex justify-between items-center py-0.5'>
              <span className='text-muted-foreground'>Date Submitted:</span>
              <span className='font-medium font-mono text-foreground'>
                {pkg.dateApplied ? pkg.dateApplied.slice(0, 10) : '—'}
              </span>
            </div>
            <div className='flex justify-between items-center py-0.5'>
              <span className='text-muted-foreground'>Match at Apply:</span>
              <span className='font-semibold text-emerald-600 dark:text-emerald-400'>
                {pkg.matchScoreAtApplication !== null && pkg.matchScoreAtApplication !== undefined
                  ? `${Math.round(pkg.matchScoreAtApplication)}%`
                  : 'N/A'}
              </span>
            </div>
            <div className='flex justify-between items-center py-0.5'>
              <span className='text-muted-foreground'>Template:</span>
              <span className='font-mono text-foreground'>
                {activeTemplate.name} (v{pkg.selectedTemplateVersion})
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Job at Submission */}
      <Card className='border-border/80 shadow-xs'>
        <CardHeader className='pb-3 border-b border-border/60'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <div className='flex items-center gap-2'>
                <CardTitle className='text-base font-bold'>Job Context at Submission</CardTitle>
                {pkg.isHistoricalJobSnapshot ? (
                  <Badge
                    variant='outline'
                    className='text-[10px] text-emerald-600 border-emerald-500/30 font-medium'
                  >
                    Captured at Submission
                  </Badge>
                ) : (
                  <Badge
                    variant='outline'
                    className='text-[10px] text-amber-600 border-amber-500/30 font-medium'
                  >
                    Current Job (Snapshot Unavailable)
                  </Badge>
                )}
              </div>
              <CardDescription className='text-xs mt-1'>
                {pkg.isHistoricalJobSnapshot
                  ? 'Job details captured at submission time. Protected from external re-scraping and live job updates.'
                  : 'Historical job snapshot unavailable for this application. Displaying current live job posting as fallback.'}
              </CardDescription>
            </div>

            {jobSourceUrl && (
              <a
                href={jobSourceUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-xs inline-flex items-center gap-1 text-primary hover:underline font-medium'
              >
                <span>View Source Posting</span>
                <Icons.externalLink className='h-3 w-3' />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className='p-6 space-y-4 text-xs leading-relaxed'>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-md border border-border/50'>
            <div>
              <span className='text-muted-foreground block text-[11px] font-medium'>
                Role Title
              </span>
              <span className='font-semibold text-foreground text-sm'>{jobToDisplay.title}</span>
            </div>
            <div>
              <span className='text-muted-foreground block text-[11px] font-medium'>Company</span>
              <span className='font-semibold text-foreground text-sm'>{jobToDisplay.company}</span>
            </div>
            <div>
              <span className='text-muted-foreground block text-[11px] font-medium'>
                Location &amp; Arrangement
              </span>
              <span className='text-foreground'>
                {jobToDisplay.location} &bull; {jobToDisplay.workArrangement}
              </span>
            </div>
          </div>

          {jobToDisplay.description && (
            <div className='space-y-1.5'>
              <h4 className='font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground'>
                Description
              </h4>
              <p className='text-foreground whitespace-pre-line text-xs bg-muted/20 p-3 rounded border border-border/40 max-h-48 overflow-y-auto'>
                {jobToDisplay.description}
              </p>
            </div>
          )}

          {jobToDisplay.responsibilities && jobToDisplay.responsibilities.length > 0 && (
            <div className='space-y-1.5'>
              <h4 className='font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground'>
                Key Responsibilities
              </h4>
              <ul className='list-disc list-inside space-y-1 text-muted-foreground'>
                {jobToDisplay.responsibilities.map((r, i) => (
                  <li key={i} className='text-foreground'>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-2'>
            {jobToDisplay.requiredSkills && jobToDisplay.requiredSkills.length > 0 && (
              <div className='space-y-1.5'>
                <h4 className='font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground'>
                  Required Skills
                </h4>
                <div className='flex flex-wrap gap-1.5'>
                  {jobToDisplay.requiredSkills.map((s, i) => (
                    <Badge key={i} variant='secondary' className='text-[11px] font-normal'>
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {jobToDisplay.preferredSkills && jobToDisplay.preferredSkills.length > 0 && (
              <div className='space-y-1.5'>
                <h4 className='font-bold text-foreground text-xs uppercase tracking-wider text-muted-foreground'>
                  Preferred Skills
                </h4>
                <div className='flex flex-wrap gap-1.5'>
                  {jobToDisplay.preferredSkills.map((s, i) => (
                    <Badge
                      key={i}
                      variant='outline'
                      className='text-[11px] font-normal text-muted-foreground'
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Submitted Resume (Frozen Snapshot) */}
      <Card className='border-border/80 shadow-xs'>
        <CardHeader className='pb-3 border-b border-border/60'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <div className='flex items-center gap-2'>
                <CardTitle className='text-base font-bold'>Submitted Tailored Resume</CardTitle>
                <Badge variant='outline' className='text-xs font-mono'>
                  {activeTemplate.name} (v{pkg.selectedTemplateVersion})
                </Badge>
              </div>
              <CardDescription className='text-xs mt-1'>
                Rendered directly from the immutable application resume snapshot.
              </CardDescription>
            </div>
            <StatusBadge status='neutral' label='Read-Only' />
          </div>
        </CardHeader>
        <CardContent className='p-6'>
          {pkg.resumeSnapshot ? (
            <div className='rounded-lg border border-border/80 shadow-xs overflow-hidden'>
              <ResumeRenderer content={pkg.resumeSnapshot} template={activeTemplate} />
            </div>
          ) : (
            <div className='p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-md border border-dashed border-border'>
              No frozen resume snapshot was captured for this application.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Submitted Cover Letter (Frozen) */}
      <Card className='border-border/80 shadow-xs'>
        <CardHeader className='pb-3 border-b border-border/60'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base font-bold'>Submitted Cover Letter</CardTitle>
              <CardDescription className='text-xs mt-1'>
                Exact letter text frozen upon submission confirmation.
              </CardDescription>
            </div>
            <StatusBadge status='neutral' label='Read-Only' />
          </div>
        </CardHeader>
        <CardContent className='p-6'>
          {pkg.coverLetter ? (
            <div className='bg-muted/15 p-5 rounded-md border border-border/60 text-xs font-serif leading-relaxed text-foreground whitespace-pre-wrap max-w-3xl'>
              {pkg.coverLetter}
            </div>
          ) : (
            <p className='text-xs text-muted-foreground italic'>
              No cover letter was included with this application submission.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 5. Submitted Application Q&A Responses (Frozen) */}
      <Card className='border-border/80 shadow-xs'>
        <CardHeader className='pb-3 border-b border-border/60'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base font-bold'>Submitted Application Questions</CardTitle>
              <CardDescription className='text-xs mt-1'>
                Frozen candidate answers provided for employer application prompts.
              </CardDescription>
            </div>
            <StatusBadge status='neutral' label='Read-Only' />
          </div>
        </CardHeader>
        <CardContent className='p-6 space-y-4'>
          {pkg.applicationAnswers && pkg.applicationAnswers.length > 0 ? (
            <div className='space-y-4'>
              {pkg.applicationAnswers.map((ans, idx) => (
                <div
                  key={ans.questionId || idx}
                  className='p-4 rounded-md border border-border/60 bg-muted/15 space-y-2 text-xs'
                >
                  <div className='flex items-start justify-between gap-2'>
                    <div className='font-semibold text-foreground flex items-center gap-2'>
                      <span className='text-muted-foreground font-mono text-[11px]'>
                        Q{idx + 1}.
                      </span>
                      <span>{ans.question}</span>
                    </div>
                    {ans.category && (
                      <Badge
                        variant='outline'
                        className='text-[10px] font-mono capitalize shrink-0'
                      >
                        {ans.category}
                      </Badge>
                    )}
                  </div>
                  <div className='p-3 bg-background rounded border border-border/40 text-foreground leading-relaxed whitespace-pre-wrap'>
                    {ans.answer || (
                      <span className='text-muted-foreground italic'>No answer provided.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-xs text-muted-foreground italic'>
              No custom application question responses were recorded.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
