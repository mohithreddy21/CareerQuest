'use client';

import React, { useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { tailoredResumeQueryOptions } from '../api/queries';
import { jobByIdOptions, jobMatchOptions } from '@/features/jobs/api/queries';
import { retrievedKnowledgeQueryOptions } from '@/features/tailoring/api/queries';
import {
  approveAllResumeChangesMutation,
  updateResumeChangeStatusMutation,
  editResumeChangeContentMutation
} from '../api/mutations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import { ResumeChange, ResumeChangeStatus } from '@/types/tailoring';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { toast } from 'sonner';
import { RetrievedKnowledgePanel } from '@/features/tailoring/components/retrieved-knowledge-panel';
import { ResumeChangeCard } from '@/features/tailoring/components/resume-change-card';
import { ResumeChangeEditDialog } from '@/features/tailoring/components/resume-change-edit-dialog';
import { TailoredResumePreview } from '@/features/tailoring/components/tailored-resume-preview';

export default function ResumeTailorWorkspace({ jobId }: { jobId: string }) {
  const { data: job } = useSuspenseQuery(jobByIdOptions(jobId));
  const { data: match } = useSuspenseQuery(jobMatchOptions(jobId));
  const { data: retrieved } = useSuspenseQuery(retrievedKnowledgeQueryOptions(jobId));
  const { data: resume } = useSuspenseQuery(tailoredResumeQueryOptions(jobId));

  const [activeTab, setActiveTab] = useState<'changes' | 'preview'>('changes');
  const [editingChange, setEditingChange] = useState<ResumeChange | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const changeStatusMutation = useMutation({
    mutationFn: updateResumeChangeStatusMutation.mutationFn,
    onSuccess: (_, vars) => {
      toast.success(
        vars.status === 'approved'
          ? 'Statement revision approved.'
          : vars.status === 'rejected'
            ? 'Revision rejected. Original master wording preserved.'
            : 'Statement marked for review.'
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to update change: ${msg}`);
    }
  });

  const editContentMutation = useMutation({
    mutationFn: editResumeChangeContentMutation.mutationFn,
    onSuccess: () => {
      toast.success('Custom phrasing saved and approved for this tailored resume.');
      setEditDialogOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save custom edit: ${msg}`);
    }
  });

  const approveAllMutation = useMutation({
    mutationFn: approveAllResumeChangesMutation.mutationFn,
    onSuccess: () => {
      toast.success('All pending tailoring proposals approved.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to approve all changes: ${msg}`);
    }
  });

  if (!job || !resume) {
    notFound();
  }

  const handleUpdateStatus = (changeId: string, status: ResumeChangeStatus) => {
    changeStatusMutation.mutate({
      resumeVersionId: resume.id,
      changeId,
      status
    });
  };

  const handleOpenEdit = (change: ResumeChange) => {
    setEditingChange(change);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (changeId: string, editedContent: string) => {
    editContentMutation.mutate({
      resumeVersionId: resume.id,
      changeId,
      editedContent
    });
  };

  const pendingCount = resume.changes.filter((c) => c.status === 'pending').length;
  const approvedCount = resume.changes.filter(
    (c) => c.status === 'approved' || c.status === 'edited'
  ).length;

  return (
    <div className='flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full'>
      {/* 1. Breadcrumb Navigation */}
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        <Link
          href={`/dashboard/jobs/${job.id}`}
          className='hover:text-foreground flex items-center gap-1'
        >
          <Icons.chevronLeft className='h-3.5 w-3.5' /> Back to Job Match
        </Link>
        <span>/</span>
        <span className='font-medium text-foreground truncate'>
          Resume Tailoring &mdash; {job.company}
        </span>
      </div>

      {/* 2. Header Banner with Core Job Context & Actions */}
      <Card className='border-border/80 shadow-xs'>
        <CardContent className='flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between'>
          <div className='space-y-1.5'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge variant='outline' className='text-xs font-semibold'>
                {job.company}
              </Badge>
              <Badge variant='secondary' className='text-xs'>
                Target: {job.title}
              </Badge>
              <Badge
                variant={resume.approvalState === 'approved' ? 'default' : 'outline'}
                className='text-xs capitalize'
              >
                Status: {resume.approvalState.replace('_', ' ')}
              </Badge>
            </div>
            <h1 className='text-2xl font-bold tracking-tight text-foreground md:text-3xl'>
              Tailor Resume for {job.company}
            </h1>
            <p className='text-xs text-muted-foreground max-w-2xl leading-relaxed'>
              Reposition verified career facts from your Knowledge Bank to directly highlight
              alignment with {job.company}&apos;s requirements. You remain in complete control over
              every proposed revision.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2 shrink-0'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setActiveTab('preview')}
              className='text-xs gap-1.5 shadow-xs'
            >
              <Icons.fileTypeDoc className='h-3.5 w-3.5' /> View Live Preview
            </Button>
            <Button
              variant='default'
              size='sm'
              disabled={pendingCount === 0 || approveAllMutation.isPending}
              onClick={() => approveAllMutation.mutate({ resumeVersionId: resume.id })}
              className='text-xs gap-1.5 shadow-xs'
            >
              <Icons.check className='h-3.5 w-3.5' />
              Approve All ({pendingCount} pending)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Grounding Trust & Integrity Assurance Card */}
      <Card className='border-emerald-500/30 bg-emerald-500/5 shadow-2xs'>
        <CardContent className='p-4 text-xs text-muted-foreground'>
          <div className='flex items-start gap-2.5'>
            <Icons.circleCheck className='mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400' />
            <div className='space-y-0.5'>
              <p className='font-semibold text-foreground'>
                100% Grounded in your approved Candidate Knowledge Bank
              </p>
              <p className='leading-relaxed text-[11px]'>
                Every suggested modification is anchored to verified skills, projects, and
                achievements in your Knowledge Bank. Unverified or missing job qualifications (such
                as absent frameworks or tools) are never fabricated or claimed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. 2-Column Responsive Workspace Layout */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-12'>
        {/* Left Column (4 cols on lg): Role Context & Retrieved Knowledge */}
        <div className='space-y-6 lg:col-span-5 xl:col-span-4'>
          {/* Role Alignment Context Card */}
          <Card className='border-border/80 shadow-xs'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base font-bold'>Role Alignment Context</CardTitle>
              <CardDescription className='text-xs'>
                Key criteria extracted from the job posting motivating tailored phrasing.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3.5 text-xs'>
              {match && (
                <div className='rounded-lg bg-primary/10 p-3 text-primary font-semibold flex items-center justify-between'>
                  <span className='text-xs'>Phase 2 Fit Score:</span>
                  <span className='text-base font-bold'>
                    {match.score}% ({match.recommendation})
                  </span>
                </div>
              )}

              <div>
                <span className='font-semibold text-foreground text-xs'>
                  Required Technical Stack:
                </span>
                <div className='flex flex-wrap gap-1.5 pt-1.5'>
                  {job.requiredSkills.map((s) => (
                    <Badge key={s} variant='secondary' className='text-[10px]'>
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              {job.preferredSkills && job.preferredSkills.length > 0 && (
                <div>
                  <span className='font-semibold text-foreground text-xs'>
                    Preferred Qualifications:
                  </span>
                  <div className='flex flex-wrap gap-1.5 pt-1.5'>
                    {job.preferredSkills.map((s) => (
                      <Badge key={s} variant='outline' className='text-[10px]'>
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className='pt-2 border-t border-border/50 space-y-1.5'>
                <span className='font-semibold text-foreground text-xs'>
                  Core Target Responsibilities:
                </span>
                <ul className='list-disc pl-4 space-y-1 text-muted-foreground text-[11px] leading-relaxed'>
                  {job.responsibilities.slice(0, 3).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Retrieved Knowledge Panel */}
          <RetrievedKnowledgePanel retrieved={retrieved} />
        </div>

        {/* Right Column (7-8 cols on lg): Review Tabs & Live Document Preview */}
        <div className='space-y-6 lg:col-span-7 xl:col-span-8'>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'changes' | 'preview')}
            className='w-full'
          >
            <div className='flex flex-wrap items-center justify-between gap-2 pb-2'>
              <TabsList className='grid grid-cols-2 w-full max-w-xs'>
                <TabsTrigger value='changes' className='gap-1.5 text-xs'>
                  <Icons.edit className='h-3.5 w-3.5' />
                  <span>Review ({resume.changes.length})</span>
                </TabsTrigger>
                <TabsTrigger value='preview' className='gap-1.5 text-xs'>
                  <Icons.fileTypeDoc className='h-3.5 w-3.5' />
                  <span>Live Preview</span>
                </TabsTrigger>
              </TabsList>

              <span className='text-xs text-muted-foreground'>
                {approvedCount} approved &bull; {pendingCount} pending review
              </span>
            </div>

            {/* TAB 1: Change-by-Change Review Queue */}
            <TabsContent value='changes' className='space-y-4 pt-1'>
              <div className='flex items-center justify-between'>
                <h2 className='text-base font-bold tracking-tight text-foreground'>
                  Proposed Statement Revisions ({resume.changes.length})
                </h2>
                <span className='text-xs text-muted-foreground'>
                  Every change is grounded in approved knowledge.
                </span>
              </div>

              {resume.changes.map((change) => (
                <ResumeChangeCard
                  key={change.id}
                  change={change}
                  onUpdateStatus={handleUpdateStatus}
                  onOpenEdit={handleOpenEdit}
                  isUpdating={changeStatusMutation.isPending}
                />
              ))}

              {/* Bottom Applications Handoff Bar */}
              <div className='flex items-center justify-between pt-4 border-t border-border/60'>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                >
                  <Icons.chevronLeft className='mr-1 h-4 w-4' /> Back to Job Details
                </Link>
                <Link
                  href={
                    job.id === 'job-1'
                      ? '/dashboard/applications/app-1'
                      : job.id === 'job-2'
                        ? '/dashboard/applications/app-2'
                        : '/dashboard/applications'
                  }
                  className={cn(buttonVariants({ size: 'sm' }))}
                >
                  Proceed to Application Preparation
                  <Icons.arrowRight className='ml-1.5 h-4 w-4' />
                </Link>
              </div>
            </TabsContent>

            {/* TAB 2: Live Document Preview */}
            <TabsContent value='preview' className='pt-1'>
              <TailoredResumePreview resume={resume} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Dialog for Candidate Custom Phrasing */}
      <ResumeChangeEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        change={editingChange}
        onSave={handleSaveEdit}
        isSaving={editContentMutation.isPending}
      />
    </div>
  );
}
