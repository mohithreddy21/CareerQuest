'use client';

import { useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { applicationByIdOptions, applicationKeys } from '../api/queries';
import { updateApplicationNotesMutation, updateApplicationStatusMutation } from '../api/mutations';
import {
  preparationMaterialsQueryOptions,
  preparationKeys
} from '@/features/preparation/api/queries';
import {
  updateCoverLetterMutation,
  updateQuestionMutation,
  recordExportMutation,
  confirmAppliedMutation
} from '@/features/preparation/api/mutations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  APPLICATION_STAGES,
  APPLICATION_STATUS_LABELS,
  ApplicationStatus,
  GroundedCoverLetter,
  GroundedApplicationQuestion
} from '@/types/domain';
import { ResumeTemplateId } from '@/types/templates';
import { extractResumeContent } from '@/types/resume-content';
import { getResumeTemplate } from '@/features/templates/constants/templates';
import { ResumeRenderer } from '@/features/templates/components/resume-renderer';
import { TemplateSelector } from '@/features/templates/components/template-selector';
import { exportResumeDocument } from '@/features/export/services/resume-export-service';
import { CoverLetterEditor } from '@/features/preparation/components/cover-letter-editor';
import { ApplicationQuestionsEditor } from '@/features/preparation/components/application-questions-editor';
import { ApplicationSummaryCard } from '@/features/preparation/components/application-summary-card';
import { ExternalHandoffModal } from '@/features/preparation/components/external-handoff-modal';
import { ApplicationFollowUpCard } from './application-follow-up-card';
import { ApplicationInterviewsCard } from './application-interviews-card';
import { ApplicationTimeline } from './application-timeline';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { toast } from 'sonner';

export default function ApplicationDetailPage({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();

  // 1. Data Fetching
  const { data: application } = useSuspenseQuery(applicationByIdOptions(applicationId));
  const { data: prepData } = useSuspenseQuery(preparationMaterialsQueryOptions(applicationId));

  // 2. Local State
  const [activeTab, setActiveTab] = useState<
    'review' | 'resume' | 'materials' | 'interviews' | 'timeline' | 'overview'
  >('review');
  const [selectedTemplateId, setSelectedTemplateId] = useState<ResumeTemplateId>(
    application?.selectedTemplateId || prepData?.selectedTemplateId || 'classic-v1'
  );
  const [notes, setNotes] = useState(application?.notes || '');
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // 3. Mutations
  const statusMutation = useMutation({
    ...updateApplicationStatusMutation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success(`Application stage updated to ${APPLICATION_STATUS_LABELS[variables.status]}.`);
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update stage';
      toast.error(msg);
    }
  });

  const notesMutation = useMutation({
    ...updateApplicationNotesMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success('Application notes saved.');
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to save notes';
      toast.error(msg);
    }
  });

  const coverLetterMut = useMutation({
    ...updateCoverLetterMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preparationKeys.all });
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update cover letter';
      toast.error(msg);
    }
  });

  const questionMut = useMutation({
    ...updateQuestionMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: preparationKeys.all });
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update question';
      toast.error(msg);
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
      toast.success(`Congratulations! Application marked as Applied.`);
      setHandoffModalOpen(false);
    },
    onError: (err: Error) => {
      const msg = err.message || 'Application confirmation failed';
      toast.error(msg);
    }
  });

  if (!application) {
    notFound();
  }

  const job = application.job;
  const resume = application.resume;
  const activeTemplate = getResumeTemplate(selectedTemplateId);

  const handleSelectTemplate = (tplId: ResumeTemplateId) => {
    // Instant client-side presentation change (zero API/network calls)
    setSelectedTemplateId(tplId);
  };

  const handleExportResume = async (format: 'pdf' | 'docx') => {
    if (!resume) {
      toast.error('No tailored resume attached to this application.');
      return;
    }
    try {
      if (format === 'pdf') setIsExportingPdf(true);
      if (format === 'docx') setIsExportingDocx(true);

      const record = await exportResumeDocument({
        resume,
        template: activeTemplate,
        format
      });

      // Record export event metadata
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
    coverLetterMut.mutate({
      applicationId: application.id,
      coverLetter: updated
    });
  };

  const handleUpdateQuestion = (updated: GroundedApplicationQuestion) => {
    questionMut.mutate({
      applicationId: application.id,
      question: updated
    });
  };

  const handleConfirmApplied = () => {
    confirmAppliedMut.mutate({
      applicationId: application.id,
      note: `Applied externally via company careers site with ${activeTemplate.name} (v${activeTemplate.version}) template.`,
      templateId: activeTemplate.id,
      templateVersion: activeTemplate.version
    });
  };

  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full'>
      {/* 1. Breadcrumbs */}
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        <Link
          href='/dashboard/applications'
          className='hover:text-foreground flex items-center gap-1'
        >
          <Icons.chevronLeft className='h-3.5 w-3.5' /> Back to Applications
        </Link>
        <span>/</span>
        <span className='font-medium text-foreground truncate'>
          {job.title} at {job.company}
        </span>
      </div>

      {/* 2. Top Header Banner with Stage Selection & Apply Handoff Action */}
      <Card className='border-border/80 shadow-xs'>
        <CardContent className='flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between'>
          <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight text-foreground md:text-3xl'>
                {job.title}
              </h1>
              <span className='text-muted-foreground'>&bull;</span>
              <span className='text-lg font-semibold text-foreground/80'>{job.company}</span>
            </div>

            <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
              <span>
                Location: {job.location} ({job.workArrangement})
              </span>
              <span>&bull;</span>
              <span>Discovered: {application.dateDiscovered.slice(0, 10)}</span>
              {application.dateApplied && (
                <>
                  <span>&bull;</span>
                  <span className='font-semibold text-emerald-600 dark:text-emerald-400'>
                    Applied: {application.dateApplied.slice(0, 10)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Controls */}
          <div className='flex flex-wrap items-center gap-3 pt-2 md:pt-0'>
            <div className='flex items-center gap-2'>
              <span className='text-xs font-semibold text-muted-foreground'>Stage:</span>
              <Select
                value={application.status}
                onValueChange={(val) =>
                  statusMutation.mutate({
                    id: application.id,
                    status: val as ApplicationStatus
                  })
                }
                disabled={statusMutation.isPending}
              >
                <SelectTrigger className='h-9 w-36 text-xs'>
                  <SelectValue>{APPLICATION_STATUS_LABELS[application.status]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_STAGES.map((st) => (
                    <SelectItem key={st} value={st} className='text-xs'>
                      {APPLICATION_STATUS_LABELS[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setHandoffModalOpen(true)}
              size='default'
              className='shadow-xs text-xs gap-1.5 bg-primary text-primary-foreground font-semibold'
            >
              <Icons.externalLink className='h-4 w-4' />
              <span>Apply on {job.company}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Main 5-Tab Workspace */}
      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          setActiveTab(
            v as 'review' | 'resume' | 'materials' | 'interviews' | 'timeline' | 'overview'
          )
        }
        className='w-full space-y-4'
      >
        <div className='flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2'>
          <TabsList className='grid grid-cols-2 sm:grid-cols-5 w-full sm:w-auto'>
            <TabsTrigger value='review' className='text-xs gap-1.5'>
              <Icons.check className='h-3.5 w-3.5' />
              <span>Final Review & Status</span>
            </TabsTrigger>
            <TabsTrigger value='resume' className='text-xs gap-1.5'>
              <Icons.fileTypeDoc className='h-3.5 w-3.5' />
              <span>Tailored Resume</span>
            </TabsTrigger>
            <TabsTrigger value='materials' className='text-xs gap-1.5'>
              <Icons.edit className='h-3.5 w-3.5' />
              <span>Cover Letter & Q&A</span>
            </TabsTrigger>
            <TabsTrigger value='interviews' className='text-xs gap-1.5'>
              <Icons.calendar className='h-3.5 w-3.5' />
              <span>Interviews & Follow-ups</span>
            </TabsTrigger>
            <TabsTrigger value='timeline' className='text-xs gap-1.5'>
              <Icons.clock className='h-3.5 w-3.5' />
              <span>Timeline & Activity</span>
            </TabsTrigger>
          </TabsList>

          <span className='text-xs text-muted-foreground'>
            Readiness:{' '}
            <strong
              className={cn(
                prepData.summary.readinessStatus === 'ready' ? 'text-emerald-600' : 'text-amber-600'
              )}
            >
              {prepData.summary.readinessStatus === 'ready' ? 'Ready for Application' : 'In Review'}
            </strong>
          </span>
        </div>

        {/* TAB 1: Final Review & External Apply */}
        <TabsContent value='review' className='space-y-6 pt-1'>
          <ApplicationSummaryCard summary={prepData.summary} />

          {/* Action Callout Banner */}
          <Card className='border-primary/30 bg-primary/5 shadow-xs'>
            <CardContent className='p-6 flex flex-col sm:flex-row items-center justify-between gap-4'>
              <div className='space-y-1 text-center sm:text-left'>
                <h3 className='font-bold text-base text-foreground'>
                  Ready to submit on {job.company}&apos;s Career Portal?
                </h3>
                <p className='text-xs text-muted-foreground max-w-xl leading-relaxed'>
                  All application materials are grounded in your verified facts. Click below to open{' '}
                  {job.company}&apos;s portal in a new tab. When finished, return here and confirm
                  to record your submission date.
                </p>
              </div>

              <div className='flex flex-wrap items-center gap-2 shrink-0'>
                <Button
                  onClick={() => setHandoffModalOpen(true)}
                  size='lg'
                  className='shadow-sm text-xs gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold'
                >
                  <Icons.externalLink className='h-4 w-4' />
                  <span>Open {job.company} Application</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Tailored Resume & Presentation Templates */}
        <TabsContent value='resume' className='space-y-6 pt-1'>
          <Card className='border-border/80 shadow-xs'>
            <CardHeader className='pb-4 border-b border-border/60'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <div className='flex items-center gap-2'>
                    <CardTitle className='text-base font-bold'>
                      Tailored Resume &bull; {activeTemplate.name}
                    </CardTitle>
                    <Badge variant='outline' className='text-xs font-mono'>
                      Template v{activeTemplate.version}
                    </Badge>
                  </div>
                  <CardDescription className='text-xs'>
                    Job-specific snapshot for {job.company}. Master Resume remains untouched.
                  </CardDescription>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={isExportingPdf}
                    onClick={() => handleExportResume('pdf')}
                    className='text-xs gap-1.5 shadow-xs'
                  >
                    {isExportingPdf ? (
                      <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
                    ) : (
                      <Icons.download className='h-3.5 w-3.5' />
                    )}
                    <span>Download PDF</span>
                  </Button>

                  <Button
                    variant='outline'
                    size='sm'
                    disabled={isExportingDocx}
                    onClick={() => handleExportResume('docx')}
                    className='text-xs gap-1.5 shadow-xs'
                  >
                    {isExportingDocx ? (
                      <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
                    ) : (
                      <Icons.fileTypeDoc className='h-3.5 w-3.5' />
                    )}
                    <span>Download DOCX</span>
                  </Button>

                  <Link
                    href={`/dashboard/resume/tailor/${job.id}`}
                    className={cn(
                      buttonVariants({ variant: 'ghost', size: 'sm' }),
                      'text-xs gap-1'
                    )}
                  >
                    <Icons.edit className='h-3.5 w-3.5' />
                    <span>Revisit Revisions</span>
                  </Link>
                </div>
              </div>
            </CardHeader>

            <CardContent className='pt-4'>
              <TemplateSelector
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={handleSelectTemplate}
              />
            </CardContent>
          </Card>

          {/* Rendered Live Document Preview */}
          {resume ? (
            <ResumeRenderer content={extractResumeContent(resume)} template={activeTemplate} />
          ) : (
            <Card className='p-8 text-center text-xs text-muted-foreground'>
              No tailored resume found for this job opportunity.
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: Preparation Materials (Cover Letter & Q&A) */}
        <TabsContent value='materials' className='space-y-6 pt-1'>
          <CoverLetterEditor
            coverLetter={prepData.coverLetter}
            onUpdate={handleUpdateCoverLetter}
            isSaving={coverLetterMut.isPending}
          />

          <ApplicationQuestionsEditor
            questions={prepData.questions}
            onUpdateQuestion={handleUpdateQuestion}
            isSaving={questionMut.isPending}
          />
        </TabsContent>

        {/* TAB 4: Overview & Notes */}
        <TabsContent value='overview' className='pt-1'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
            {/* Left Column (2 cols): Opportunity Context */}
            <div className='space-y-6 lg:col-span-2'>
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Role Summary & Responsibilities</CardTitle>
                  <CardDescription>Position details from original posting.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4 text-xs leading-relaxed'>
                  <p className='text-foreground/90'>{job.description}</p>

                  <div className='space-y-1.5 pt-2 border-t border-border/50'>
                    <span className='font-semibold text-foreground'>Key Responsibilities:</span>
                    <ul className='list-disc pl-5 space-y-1 text-muted-foreground'>
                      {job.responsibilities.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className='space-y-1.5 pt-2 border-t border-border/50'>
                    <span className='font-semibold text-foreground'>Required Technical Stack:</span>
                    <div className='flex flex-wrap gap-1.5 pt-1'>
                      {job.requiredSkills.map((s) => (
                        <Badge key={s} variant='secondary' className='text-[10px]'>
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column (1 col): Private Notes & Timeline */}
            <div className='space-y-6'>
              {/* Private Notes */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Candidate Notes</CardTitle>
                  <CardDescription>
                    Private notes, recruiter interactions, and follow-ups.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <Textarea
                    rows={5}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder='Add private recruiter notes, contacts, or follow-up milestones...'
                    className='text-xs'
                  />
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => notesMutation.mutate({ id: application.id, notes })}
                    disabled={notesMutation.isPending}
                    className='text-xs w-full'
                  >
                    {notesMutation.isPending ? 'Saving Notes...' : 'Save Notes'}
                  </Button>
                </CardContent>
              </Card>

              {/* Status History Timeline */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Application Milestone History</CardTitle>
                  <CardDescription>Recorded status events and stage transitions.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-3'>
                    {application.statusHistory && application.statusHistory.length > 0 ? (
                      application.statusHistory.map((h, i) => (
                        <div key={i} className='flex items-start gap-2.5 text-xs'>
                          <div className='h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0' />
                          <div className='space-y-0.5'>
                            <div className='flex items-center gap-2'>
                              <span className='font-bold capitalize text-foreground'>
                                {h.status}
                              </span>
                              <span className='text-[10px] text-muted-foreground font-mono'>
                                {h.timestamp.slice(0, 10)}
                              </span>
                            </div>
                            {h.note && (
                              <p className='text-[11px] text-muted-foreground'>{h.note}</p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className='text-xs text-muted-foreground'>No history recorded yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: Interviews & Follow-ups */}
        <TabsContent value='interviews' className='space-y-6 pt-1'>
          <ApplicationFollowUpCard application={application} />
          <ApplicationInterviewsCard application={application} />
        </TabsContent>

        {/* TAB 5: Timeline & Activity */}
        <TabsContent value='timeline' className='space-y-6 pt-1'>
          <ApplicationTimeline application={application} />
        </TabsContent>
      </Tabs>

      {/* 4. External Handoff Modal */}
      <ExternalHandoffModal
        open={handoffModalOpen}
        onOpenChange={setHandoffModalOpen}
        job={job}
        onConfirmApplied={handleConfirmApplied}
        isSubmitting={confirmAppliedMut.isPending}
      />
    </div>
  );
}
