'use client';

import { Job, JobAnalysis } from '@/types/domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface JobAnalysisDetailsProps {
  job: Job;
  analysis?: JobAnalysis | null;
  className?: string;
}

export function JobAnalysisDetails({ job, analysis, className }: JobAnalysisDetailsProps) {
  const seniorityLabels: Record<string, string> = {
    entry: 'Entry Level',
    mid: 'Mid-Level',
    senior: 'Senior',
    lead: 'Staff / Lead',
    executive: 'Executive / Director'
  };

  const seniorityDisplay = analysis?.seniority
    ? seniorityLabels[analysis.seniority] || analysis.seniority
    : 'Not Specified';

  return (
    <div className={cn('space-y-6', className)}>
      {/* What This Job Requires Card */}
      <Card className='shadow-xs'>
        <CardHeader className='pb-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base font-semibold'>
                Role & Requirements Analysis
              </CardTitle>
              <CardDescription className='text-xs'>
                Structured classification and competencies extracted from this opportunity.
              </CardDescription>
            </div>
            <span className='inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md'>
              <Icons.sparkles className='h-3 w-3 text-primary' /> Structured Extraction
            </span>
          </div>
        </CardHeader>

        <CardContent className='space-y-5 pt-0 text-xs sm:text-sm'>
          {/* Role Classification & Seniority */}
          <div className='rounded-lg border border-border/70 bg-muted/20 p-3.5 space-y-2.5'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                Classification
              </span>
              <div className='flex items-center gap-1.5'>
                <Badge variant='outline' className='text-xs font-medium capitalize bg-background'>
                  Level: {seniorityDisplay}
                </Badge>
                {analysis?.roleCategory && (
                  <Badge variant='secondary' className='text-xs font-medium'>
                    {analysis.roleCategory}
                  </Badge>
                )}
              </div>
            </div>

            {/* Experience & Education Expectations */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50 text-xs'>
              <div>
                <span className='font-semibold text-foreground block mb-0.5'>
                  Experience Expectation:
                </span>
                <span className='text-muted-foreground'>
                  {job.experienceRequirement || 'Not explicitly constrained in posting.'}
                </span>
              </div>
              <div>
                <span className='font-semibold text-foreground block mb-0.5'>
                  Education Requirement:
                </span>
                <span className='text-muted-foreground'>
                  {job.educationRequirement || 'Not explicitly required in posting.'}
                </span>
              </div>
            </div>
          </div>

          {/* Technical Skills: Required vs Preferred */}
          <div className='space-y-3'>
            <div>
              <span className='font-semibold text-foreground text-xs block mb-1.5'>
                Required Technical Skills ({job.requiredSkills.length}):
              </span>
              <div className='flex flex-wrap gap-1.5'>
                {job.requiredSkills.map((skill) => (
                  <Badge key={skill} variant='default' className='text-xs font-normal shadow-2xs'>
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            {job.preferredSkills.length > 0 && (
              <div className='pt-2 border-t border-border/40'>
                <span className='font-semibold text-foreground text-xs block mb-1.5'>
                  Preferred Technical Skills ({job.preferredSkills.length}):
                </span>
                <div className='flex flex-wrap gap-1.5'>
                  {job.preferredSkills.map((skill) => (
                    <Badge
                      key={skill}
                      variant='outline'
                      className='text-xs font-normal bg-background'
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Soft Skills Section */}
          {analysis?.softSkills && analysis.softSkills.length > 0 && (
            <div className='pt-2 border-t border-border/40 space-y-1.5'>
              <span className='font-semibold text-foreground text-xs block'>
                Soft Skills & Ways of Working:
              </span>
              <div className='flex flex-wrap gap-1.5'>
                {analysis.softSkills.map((skill) => (
                  <Badge key={skill} variant='secondary' className='text-xs font-normal'>
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Important Keywords for Resume Tailoring */}
          {analysis?.importantKeywords && analysis.importantKeywords.length > 0 && (
            <div className='pt-2 border-t border-border/40 space-y-1.5'>
              <div className='flex items-center justify-between'>
                <span className='font-semibold text-foreground text-xs block'>
                  Extracted Job Keywords:
                </span>
                <span className='text-[11px] text-muted-foreground'>
                  High-signal terms for resume tailoring
                </span>
              </div>
              <div className='flex flex-wrap gap-1.5'>
                {analysis.importantKeywords.map((kw) => (
                  <span
                    key={kw}
                    className='inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs text-primary font-medium'
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Responsibilities Card */}
      <Card className='shadow-xs'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base font-semibold'>Core Responsibilities</CardTitle>
          <CardDescription className='text-xs'>
            Normalized day-to-day responsibilities and project expectations.
          </CardDescription>
        </CardHeader>
        <CardContent className='pt-0'>
          <ul className='space-y-2 text-xs sm:text-sm text-muted-foreground list-disc pl-4'>
            {job.responsibilities.map((resp, idx) => (
              <li key={idx} className='leading-relaxed'>
                <span className='text-foreground/90'>{resp}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
