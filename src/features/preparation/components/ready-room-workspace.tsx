'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { applicationByIdOptions, applicationKeys } from '@/features/applications/api/queries';
import { preparationMaterialsQueryOptions, preparationKeys } from '../api/queries';
import {
  updateCoverLetterMutation,
  updateQuestionMutation,
  recordExportMutation,
  confirmAppliedMutation
} from '../api/mutations';
import { evaluateApplicationReadiness } from '../lib/readiness-evaluator';
import { PreFlightChecklist } from './pre-flight-checklist';
import { ReadyRoomHandoffDialog } from './ready-room-handoff-dialog';
import { CoverLetterEditor } from './cover-letter-editor';
import { ApplicationQuestionsEditor } from './application-questions-editor';
import { TemplateSelector } from '@/features/templates/components/template-selector';
import { ResumeRenderer } from '@/features/templates/components/resume-renderer';
import { getResumeTemplate } from '@/features/templates/constants/templates';
import { exportResumeDocument } from '@/features/export/services/resume-export-service';
import { extractResumeContent, ResumeContent } from '@/types/resume-content';
import { ResumeTemplateId } from '@/types/templates';
import {
  GroundedCoverLetter,
  GroundedApplicationQuestion,
  APPLICATION_STATUS_LABELS
} from '@/types/domain';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

export interface ReadyRoomWorkspaceProps {
  applicationId: string;
}

export function ReadyRoomWorkspace({ applicationId }: ReadyRoomWorkspaceProps) {
  const queryClient = useQueryClient();

  // 1. Data Fetching
  const { data: application } = useSuspenseQuery(applicationByIdOptions(applicationId));
  const { data: prepData } = useSuspenseQuery(preparationMaterialsQueryOptions(applicationId));

  if (!application) {
    notFound();
  }

  const job = application.job;
  const isApplied = application.status === 'applied' || Boolean(application.dateApplied);

  // 2. Local State
  const [activeTab, setActiveTab] = useState<
    'resume' | 'cover_letter' | 'questions' | 'final_review'
  >('final_review');
  const [selectedTemplateId, setSelectedTemplateId] = useState<ResumeTemplateId>(
    (application.selectedTemplateId as ResumeTemplateId) ||
      prepData.selectedTemplateId ||
      'classic-v1'
  );
  const [handoffDialogOpen, setHandoffDialogOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // 3. Readiness Evaluation
  const evaluation = evaluateApplicationReadiness(application, prepData);
  const activeTemplate = getResumeTemplate(selectedTemplateId);

  // 4. Determine Resume Content (Snapshot vs Live Tailored)
  let resumeContent: ResumeContent;
  if (isApplied && application.resumeSnapshot) {
    resumeContent = application.resumeSnapshot as unknown as ResumeContent;
  } else if (application.resume) {
    resumeContent = extractResumeContent(application.resume, null);
  } else {
    resumeContent = {
      identity: {
        fullName: 'Candidate Profile',
        targetRole: job.title,
        targetCompany: job.company,
        email: '',
        location: job.location
      },
      summary: '',
      skills: { technical: [], tools: [], soft: [] },
      experience: [],
      education: [],
      projects: [],
      certifications: []
    };
  }

  // 5. Mutations
  const coverLetterMut = useMutation({
    ...updateCoverLetterMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preparationKeys.all });
      toast.success('Cover letter updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update cover letter');
    }
  });

  const questionMut = useMutation({
    ...updateQuestionMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preparationKeys.all });
      toast.success('Question updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update question');
    }
  });

  const recordExportMut = useMutation({
    ...recordExportMutation
  });

  const confirmAppliedMut = useMutation({
    ...confirmAppliedMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      queryClient.invalidateQueries({ queryKey: preparationKeys.all });
      toast.success('Application confirmed and submitted! Historical record permanently locked.');
      setHandoffDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Application confirmation failed');
    }
  });

  // 6. Handlers
  const handleExportResume = async (format: 'pdf' | 'docx') => {
    if (!application.resume) {
      toast.error('No resume content available to export.');
      return;
    }

    try {
      if (format === 'pdf') setIsExportingPdf(true);
      if (format === 'docx') setIsExportingDocx(true);

      const record = await exportResumeDocument({
        resume: application.resume,
        template: activeTemplate,
        format
      });

      recordExportMut.mutate({
        applicationId: application.id,
        exportRecord: record
      });

      toast.success(`Downloaded ${format.toUpperCase()}: ${record.filename}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown export error';
      toast.error(`Export failed: ${msg}`);
    } finally {
      setIsExportingPdf(false);
      setIsExportingDocx(false);
    }
  };

  const handleUpdateCoverLetter = (updated: GroundedCoverLetter) => {
    if (isApplied) {
      toast.error(
        'Cannot modify cover letter: This application has already been submitted and is historically frozen.'
      );
      return;
    }
    coverLetterMut.mutate({
      applicationId: application.id,
      coverLetter: updated
    });
  };

  const handleUpdateQuestion = (updated: GroundedApplicationQuestion) => {
    if (isApplied) {
      toast.error(
        'Cannot modify question answers: This application has already been submitted and is historically frozen.'
      );
      return;
    }
    questionMut.mutate({
      applicationId: application.id,
      question: updated
    });
  };

  const handleConfirmApplied = (candidateNote?: string) => {
    confirmAppliedMut.mutate({
      applicationId: application.id,
      expectedVersion: application.version,
      note:
        candidateNote ||
        `Applied externally via company careers site with ${activeTemplate.name} template.`,
      templateId: activeTemplate.id,
      templateVersion: activeTemplate.version
    });
  };

  const handleCopyAllAnswers = () => {
    const questions = prepData.questions || [];
    if (questions.length === 0) {
      toast.info('No questions to copy.');
      return;
    }

    const compiled = questions
      .map(
        (q, idx) =>
          `Question ${idx + 1}: ${q.question}\nAnswer: ${q.candidateEditedAnswer || q.suggestedAnswer}\n`
      )
      .join('\n');

    navigator.clipboard.writeText(compiled);
    toast.success('Copied all application questions and answers to clipboard.');
  };

  const handleCopyPackageSummary = () => {
    const summaryText = [
      `Application Package: ${job.title} at ${job.company}`,
      `Location: ${job.location} (${job.workArrangement})`,
      `Template: ${activeTemplate.name} (v${activeTemplate.version})`,
      `Destination: ${evaluation.destinationUrl || 'Not recorded'}`,
      `Cover Letter: ${prepData.coverLetter?.status === 'reviewed' ? 'Reviewed & Grounded' : 'Draft'}`,
      `Questions Reviewed: ${evaluation.questionsReviewed} / ${evaluation.questionsTotal}`,
      `Status: ${isApplied ? `Applied on ${application.dateApplied?.slice(0, 10)}` : 'Ready for External Application'}`
    ].join('\n');

    navigator.clipboard.writeText(summaryText);
    toast.success('Copied application summary to clipboard.');
  };

  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full'>
      {/* 1. Breadcrumbs */}
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        <Link
          href={`/dashboard/applications/${application.id}`}
          className='hover:text-foreground flex items-center gap-1'
        >
          <Icons.chevronLeft className='h-3.5 w-3.5' /> Back to Application Detail
        </Link>
        <span>/</span>
        <span className='font-medium text-foreground truncate'>Ready Room</span>
      </div>

      {/* 2. Top Header Banner */}
      <Card className='border-border/80 shadow-xs'>
        <CardContent className='flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between'>
          <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight text-foreground md:text-3xl'>
                Application Ready Room
              </h1>
              <span className='text-muted-foreground'>&bull;</span>
              <span className='text-lg font-semibold text-foreground/80'>
                {job.title} at {job.company}
              </span>
            </div>

            <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
              <span>
                Location: {job.location} ({job.workArrangement})
              </span>
              <span>&bull;</span>
              <span>Stage: {APPLICATION_STATUS_LABELS[application.status]}</span>
              {application.dateApplied && (
                <>
                  <span>&bull;</span>
                  <span className='font-semibold text-emerald-600 dark:text-emerald-400'>
                    Submitted: {application.dateApplied.slice(0, 10)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Top Actions */}
          <div className='flex flex-wrap items-center gap-2.5 pt-2 md:pt-0'>
            {isApplied ? (
              <StatusBadge
                status='verified'
                label={`Submitted on ${application.dateApplied?.slice(0, 10) || 'Record'}`}
                size='default'
              />
            ) : (
              <Button
                onClick={() => setHandoffDialogOpen(true)}
                disabled={!evaluation.isReadyToApply}
                className='shadow-xs text-xs gap-1.5 bg-primary text-primary-foreground font-semibold'
              >
                <Icons.externalLink className='h-4 w-4' />
                <span>Open Application</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. Historical Freeze Banner if Already Applied */}
      {isApplied && (
        <div className='rounded-lg border border-border/80 bg-muted/40 p-4 flex items-start gap-3 text-xs'>
          <Icons.info className='h-5 w-5 text-primary shrink-0 mt-0.5' />
          <div className='space-y-1'>
            <p className='font-bold text-foreground text-sm'>
              Historical Application Record Frozen
            </p>
            <p className='text-muted-foreground leading-relaxed'>
              This application was confirmed on {application.dateApplied?.slice(0, 10)}. To preserve
              historical reproducibility for your future interview prep, the tailored resume
              snapshot, presentation template, and submitted answers are permanently frozen.
            </p>
          </div>
        </div>
      )}

      {/* 4. Pre-Flight Checklist */}
      <PreFlightChecklist evaluation={evaluation} onNavigateToTab={(tab) => setActiveTab(tab)} />

      {/* 5. Main 4-Tab Ready Room Content */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as typeof activeTab)}
        className='w-full space-y-4'
      >
        <div className='flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2'>
          <TabsList className='grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto'>
            <TabsTrigger value='final_review' className='text-xs gap-1.5'>
              <Icons.check className='h-3.5 w-3.5' />
              <span>Final Review</span>
            </TabsTrigger>
            <TabsTrigger value='resume' className='text-xs gap-1.5'>
              <Icons.fileTypeDoc className='h-3.5 w-3.5' />
              <span>Tailored Resume</span>
            </TabsTrigger>
            <TabsTrigger value='cover_letter' className='text-xs gap-1.5'>
              <Icons.post className='h-3.5 w-3.5' />
              <span>Cover Letter</span>
            </TabsTrigger>
            <TabsTrigger value='questions' className='text-xs gap-1.5'>
              <Icons.chat className='h-3.5 w-3.5' />
              <span>Questions & Answers</span>
            </TabsTrigger>
          </TabsList>

          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleCopyPackageSummary}
              className='h-8 text-xs gap-1.5'
              title='Copy complete package summary to clipboard'
            >
              <Icons.copy className='h-3.5 w-3.5' />
              <span className='hidden sm:inline'>Copy Summary</span>
            </Button>
          </div>
        </div>

        {/* TAB 1: FINAL REVIEW */}
        <TabsContent value='final_review' className='space-y-6 pt-1'>
          <Card className='border-border/80 shadow-xs'>
            <CardHeader className='pb-3 border-b border-border/60'>
              <CardTitle className='text-base font-bold'>Application Package Overview</CardTitle>
              <CardDescription className='text-xs'>
                Everything prepared for this submission. Review your package before proceeding to{' '}
                {job.company}&apos;s portal.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6 pt-4'>
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs'>
                <div className='rounded-lg border p-3 bg-card space-y-1'>
                  <span className='text-muted-foreground text-[11px] uppercase tracking-wider font-semibold'>
                    Target Position
                  </span>
                  <p className='font-bold text-foreground text-sm truncate'>{job.title}</p>
                  <p className='text-muted-foreground truncate'>{job.company}</p>
                </div>

                <div className='rounded-lg border p-3 bg-card space-y-1'>
                  <span className='text-muted-foreground text-[11px] uppercase tracking-wider font-semibold'>
                    Resume Template
                  </span>
                  <p className='font-bold text-foreground text-sm'>{activeTemplate.name}</p>
                  <p className='text-muted-foreground text-[11px] font-mono'>
                    v{activeTemplate.version}
                  </p>
                </div>

                <div className='rounded-lg border p-3 bg-card space-y-1'>
                  <span className='text-muted-foreground text-[11px] uppercase tracking-wider font-semibold'>
                    Destination
                  </span>
                  <p className='font-bold text-foreground text-sm truncate'>
                    {evaluation.destinationDomain || 'Company Careers Site'}
                  </p>
                  <p className='text-muted-foreground text-[11px] truncate font-mono'>
                    {evaluation.destinationUrl || 'URL missing'}
                  </p>
                </div>
              </div>

              {/* Ready to Apply Action Callout */}
              <div className='rounded-lg border border-primary/30 bg-primary/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4'>
                <div className='space-y-1 text-center sm:text-left'>
                  <h3 className='font-bold text-base text-foreground'>
                    {isApplied ? 'Application Completed' : 'Proceed to External Application'}
                  </h3>
                  <p className='text-xs text-muted-foreground max-w-xl leading-relaxed'>
                    {isApplied
                      ? `This application was recorded as submitted on ${application.dateApplied?.slice(0, 10)}.`
                      : `Open ${job.company}'s career portal in a new tab to submit. When finished, return here and explicitly confirm submission.`}
                  </p>
                </div>

                {!isApplied && (
                  <Button
                    onClick={() => setHandoffDialogOpen(true)}
                    disabled={!evaluation.isReadyToApply}
                    className='text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shrink-0'
                  >
                    <Icons.externalLink className='h-4 w-4' />
                    <span>Open Application</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: TAILORED RESUME */}
        <TabsContent value='resume' className='space-y-6 pt-1'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <h2 className='text-base font-bold text-foreground'>Tailored Resume Preview</h2>
              <p className='text-xs text-muted-foreground'>
                Review the exact presentation template and layout that will be exported.
              </p>
            </div>

            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handleExportResume('pdf')}
                disabled={isExportingPdf || !application.resume}
                className='h-8 text-xs gap-1.5'
              >
                {isExportingPdf ? (
                  <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
                ) : (
                  <Icons.fileTypePdf className='h-3.5 w-3.5' />
                )}
                <span>Download PDF</span>
              </Button>

              <Button
                variant='outline'
                size='sm'
                onClick={() => handleExportResume('docx')}
                disabled={isExportingDocx || !application.resume}
                className='h-8 text-xs gap-1.5'
              >
                {isExportingDocx ? (
                  <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
                ) : (
                  <Icons.fileTypeDoc className='h-3.5 w-3.5' />
                )}
                <span>Download DOCX</span>
              </Button>
            </div>
          </div>

          {/* Presentation Template Selector (Presentation-only, does not touch KB) */}
          {!isApplied && (
            <TemplateSelector
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={(tplId) => setSelectedTemplateId(tplId)}
            />
          )}

          {/* Live Renderer Preview */}
          <div className='rounded-lg border border-border/80 bg-muted/20 p-4 sm:p-6 overflow-x-auto'>
            <ResumeRenderer content={resumeContent} template={activeTemplate} />
          </div>
        </TabsContent>

        {/* TAB 3: COVER LETTER */}
        <TabsContent value='cover_letter' className='space-y-6 pt-1'>
          <CoverLetterEditor
            coverLetter={prepData.coverLetter}
            onUpdate={handleUpdateCoverLetter}
            isSaving={coverLetterMut.isPending}
          />
        </TabsContent>

        {/* TAB 4: QUESTIONS & ANSWERS */}
        <TabsContent value='questions' className='space-y-6 pt-1'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <h2 className='text-base font-bold text-foreground'>
                Application Questions & Answers
              </h2>
              <p className='text-xs text-muted-foreground'>
                Pre-drafted, grounded responses for standard application questions.
              </p>
            </div>

            <Button
              variant='outline'
              size='sm'
              onClick={handleCopyAllAnswers}
              className='h-8 text-xs gap-1.5'
            >
              <Icons.copy className='h-3.5 w-3.5' />
              <span>Copy All Answers</span>
            </Button>
          </div>

          <ApplicationQuestionsEditor
            questions={prepData.questions || []}
            onUpdateQuestion={handleUpdateQuestion}
            isSaving={questionMut.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* 6. Controlled External Handoff Dialog */}
      {evaluation.destinationUrl && (
        <ReadyRoomHandoffDialog
          open={handoffDialogOpen}
          onOpenChange={setHandoffDialogOpen}
          company={job.company}
          role={job.title}
          destinationUrl={evaluation.destinationUrl}
          destinationDomain={evaluation.destinationDomain}
          onConfirmApplied={handleConfirmApplied}
          isSubmitting={confirmAppliedMut.isPending}
        />
      )}
    </div>
  );
}
