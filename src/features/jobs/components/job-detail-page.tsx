'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { jobAnalysisOptions, jobByIdOptions, jobMatchOptions } from '../api/queries';
import { analyzeJobMutation } from '../api/mutations';
import { createApplicationMutation } from '@/features/applications/api/mutations';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MatchScoreCard } from './match-score-card';
import { MatchBreakdown } from './match-breakdown';
import { JobAnalysisDetails } from './job-analysis-details';
import { AnalysisLifecycleState } from './analysis-lifecycle-state';
import { AnalysisStatus } from '@/types/domain';

export default function JobDetailPage({ jobId }: { jobId: string }) {
  const router = useRouter();

  // 1. Data Fetching via React Query
  const { data: job } = useSuspenseQuery(jobByIdOptions(jobId));
  const { data: analysis } = useSuspenseQuery(jobAnalysisOptions(jobId));
  const { data: match } = useSuspenseQuery(jobMatchOptions(jobId));

  // 2. Mutations
  const startAppMutation = useMutation({
    ...createApplicationMutation,
    onSuccess: (app) => {
      toast.success('Application started and moved to preparation stage.');
      router.push(`/dashboard/applications/${app.id}`);
    }
  });

  const markInterestedMutation = useMutation({
    ...createApplicationMutation,
    onSuccess: () => {
      toast.success('Opportunity marked as Interested in your pipeline.');
    }
  });

  const runAnalysisMutation = useMutation({
    ...analyzeJobMutation,
    onSuccess: () => {
      toast.success('Opportunity analysis and match evaluation updated.');
    },
    onError: (err) => {
      toast.error(`Analysis failed: ${err.message}`);
    }
  });

  if (!job) {
    notFound();
  }

  // Determine current lifecycle status
  const analysisStatus: AnalysisStatus = analysis?.analysisStatus || (match ? 'success' : 'idle');
  const hasSalary = Boolean(job.salary && (job.salary.min || job.salary.max));

  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full'>
      {/* 1. Breadcrumb navigation */}
      <nav
        aria-label='Breadcrumb'
        className='flex items-center gap-2 text-xs text-muted-foreground'
      >
        <Link
          href='/dashboard/discover'
          className='hover:text-foreground flex items-center gap-1 transition-colors'
        >
          <Icons.chevronLeft className='h-3.5 w-3.5' /> Back to Discover Jobs
        </Link>
        <span aria-hidden='true'>/</span>
        <span className='font-medium text-foreground truncate'>
          {job.title} at {job.company}
        </span>
      </nav>

      {/* 2. Job Header Card */}
      <Card className='border-border/70 shadow-xs'>
        <CardContent className='flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-start lg:justify-between'>
          <div className='space-y-3 flex-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight text-foreground md:text-3xl break-words'>
                {job.title}
              </h1>
              <Badge variant='secondary' className='capitalize text-xs font-medium shrink-0'>
                {job.source.replace('_', ' ')}
              </Badge>
              {analysis?.roleCategory && (
                <Badge variant='outline' className='text-xs shrink-0'>
                  {analysis.roleCategory}
                </Badge>
              )}
            </div>

            <div className='flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground'>
              <span className='font-semibold text-foreground/90'>{job.company}</span>
              <span aria-hidden='true'>•</span>
              <span className='flex items-center gap-1'>
                <Icons.workspace className='h-4 w-4 text-muted-foreground shrink-0' />
                {job.location} ({job.workArrangement})
              </span>
              <span aria-hidden='true'>•</span>
              {hasSalary ? (
                <span className='flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400'>
                  <Icons.billing className='h-4 w-4 shrink-0' />${(job.salary!.min ?? 0) / 1000}k -
                  ${(job.salary!.max ?? 0) / 1000}k / yr
                </span>
              ) : (
                <span className='italic text-muted-foreground'>Salary not disclosed</span>
              )}
              {job.postedDate && (
                <>
                  <span aria-hidden='true'>•</span>
                  <span className='flex items-center gap-1'>
                    <Icons.calendar className='h-3.5 w-3.5 shrink-0' /> Posted {job.postedDate}
                  </span>
                </>
              )}
            </div>

            {job.originalUrl && (
              <div className='pt-1'>
                <a
                  href={job.originalUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium'
                >
                  View Original Posting on {job.company} Careers
                  <Icons.externalLink className='h-3 w-3' />
                </a>
              </div>
            )}
          </div>

          {/* Job Actions: Tailor Resume, Start Application, Mark Interested */}
          <div className='flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0 shrink-0 w-full sm:w-auto'>
            <Link
              href={`/dashboard/resume/tailor/${job.id}`}
              className={cn(
                buttonVariants({ size: 'default' }),
                'shadow-xs flex-1 sm:flex-initial'
              )}
            >
              <Icons.edit className='mr-2 h-4 w-4' />
              Tailor Resume
            </Link>

            <Button
              variant='default'
              size='default'
              disabled={startAppMutation.isPending}
              onClick={() => startAppMutation.mutate({ jobId: job.id, initialStatus: 'preparing' })}
              className='flex-1 sm:flex-initial'
            >
              <Icons.paperclip className='mr-2 h-4 w-4' />
              Start Application
            </Button>

            <Button
              variant='outline'
              size='default'
              disabled={markInterestedMutation.isPending}
              onClick={() =>
                markInterestedMutation.mutate({ jobId: job.id, initialStatus: 'interested' })
              }
              className='flex-1 sm:flex-initial'
            >
              <Icons.star className='mr-2 h-4 w-4' />
              Mark Interested
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Match Decision Support or Analysis State */}
      {analysisStatus === 'success' && match ? (
        <MatchScoreCard
          match={match}
          isAnalyzing={runAnalysisMutation.isPending}
          onReanalyze={() => runAnalysisMutation.mutate({ jobId: job.id })}
        />
      ) : (
        <AnalysisLifecycleState
          status={analysisStatus}
          isTriggering={runAnalysisMutation.isPending}
          onAnalyze={() => runAnalysisMutation.mutate({ jobId: job.id })}
        />
      )}

      {/* 4. Two-Column Information Architecture */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Left Column: Requirements Alignment & Candidate Evidence */}
        <div className='space-y-6'>
          {match && analysisStatus === 'success' ? (
            <MatchBreakdown match={match} />
          ) : (
            <Card className='shadow-xs'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base font-semibold'>Match Assessment</CardTitle>
                <CardDescription className='text-xs'>
                  Candidate-specific match evaluation and evidence provenance will appear here once
                  analysis runs.
                </CardDescription>
              </CardHeader>
              <CardContent className='text-xs text-muted-foreground'>
                Click &ldquo;Analyze Fit Now&rdquo; above to generate a candidate alignment report.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Role Analysis, Skills, Responsibilities & Raw Description */}
        <div className='space-y-6'>
          {/* Role & Requirements Analysis Details */}
          <JobAnalysisDetails job={job} analysis={analysis} />

          {/* Raw Full Job Description (Always Preserved and Accessible) */}
          <Card className='shadow-xs'>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-base font-semibold'>Full Job Description</CardTitle>
                <span className='text-[11px] text-muted-foreground'>Source Posting</span>
              </div>
              <CardDescription className='text-xs'>
                Original posting text as extracted during normalization.
              </CardDescription>
            </CardHeader>
            <CardContent className='pt-0'>
              <div className='max-h-96 overflow-y-auto pr-2 rounded-md border border-border/40 bg-muted/10 p-3'>
                <p className='text-xs text-muted-foreground leading-relaxed whitespace-pre-line'>
                  {job.description}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
