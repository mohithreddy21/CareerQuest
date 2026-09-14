'use client';

import React from 'react';
import { ResumeChange, ResumeChangeStatus } from '@/types/tailoring';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ResumeChangeCardProps {
  change: ResumeChange;
  onUpdateStatus: (changeId: string, status: ResumeChangeStatus) => void;
  onOpenEdit: (change: ResumeChange) => void;
  isUpdating?: boolean;
}

function getStatusBadge(status: ResumeChangeStatus) {
  switch (status) {
    case 'approved':
      return (
        <Badge
          variant='default'
          className='text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white'
        >
          <Icons.check className='h-3 w-3' /> Approved
        </Badge>
      );
    case 'edited':
      return (
        <Badge
          variant='default'
          className='text-[10px] gap-1 bg-blue-600 hover:bg-blue-700 text-white'
        >
          <Icons.edit className='h-3 w-3' /> Custom Edited
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant='destructive' className='text-[10px] gap-1'>
          <Icons.close className='h-3 w-3' /> Kept Original
        </Badge>
      );
    default:
      return (
        <Badge
          variant='secondary'
          className='text-[10px] text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
        >
          Pending Review
        </Badge>
      );
  }
}

export function ResumeChangeCard({
  change,
  onUpdateStatus,
  onOpenEdit,
  isUpdating = false
}: ResumeChangeCardProps) {
  return (
    <Card className='border-border/80 shadow-xs hover:border-border transition-colors'>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <Badge variant='outline' className='text-[10px] uppercase tracking-wider font-semibold'>
              Section: {change.section}
            </Badge>
            {getStatusBadge(change.status)}

            {/* Grounding Trust Badge & Evidence Popover */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-6 px-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 gap-1 hover:bg-emerald-500/10'
                  >
                    <Icons.badgeCheck className='h-3.5 w-3.5' />
                    <span>Grounded</span>
                  </Button>
                }
              />
              <PopoverContent className='w-80 p-3 text-xs space-y-2' align='start'>
                <div className='font-semibold text-foreground flex items-center gap-1.5'>
                  <Icons.badgeCheck className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />
                  <span>Grounded in Knowledge Bank</span>
                </div>
                <p className='text-muted-foreground text-[11px] leading-relaxed'>
                  This proposed statement is strictly anchored to approved candidate facts. Zero
                  synthetic claims were introduced.
                </p>
                <div className='rounded-md bg-muted/50 p-2 space-y-1 text-[11px] border border-border/40'>
                  <p>
                    <strong className='text-foreground'>Knowledge IDs: </strong>
                    <code className='text-[10px]'>{change.sourceKnowledgeItemIds.join(', ')}</code>
                  </p>
                  <p>
                    <strong className='text-foreground'>Verified Evidence: </strong>
                    {change.sourceCandidateEvidence}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Candidate Decision Actions */}
          <div className='flex items-center gap-1.5'>
            <Button
              size='sm'
              variant='outline'
              onClick={() => onOpenEdit(change)}
              className='h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground'
            >
              <Icons.edit className='h-3 w-3' /> Edit
            </Button>

            <Button
              size='sm'
              variant={change.status === 'approved' ? 'default' : 'outline'}
              disabled={isUpdating}
              onClick={() => onUpdateStatus(change.id, 'approved')}
              className='h-7 px-2 text-xs gap-1'
            >
              <Icons.check className='h-3 w-3' /> Approve
            </Button>

            <Button
              size='sm'
              variant={change.status === 'rejected' ? 'destructive' : 'ghost'}
              disabled={isUpdating}
              onClick={() => onUpdateStatus(change.id, 'rejected')}
              className='h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground'
            >
              <Icons.close className='h-3 w-3' /> Reject
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-3.5 text-xs'>
        {/* Original Master vs Proposed Tailored Comparison */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          <div className='rounded-md border border-border/70 bg-muted/20 p-3 space-y-1'>
            <span className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1'>
              <Icons.fileTypeDoc className='h-3 w-3' /> Original Master Content
            </span>
            <p className='text-foreground/80 leading-relaxed'>{change.originalContent}</p>
          </div>

          <div
            className={`rounded-md border p-3 space-y-1 ${
              change.status === 'rejected'
                ? 'border-border/50 bg-muted/10 opacity-60'
                : change.status === 'edited'
                  ? 'border-blue-500/30 bg-blue-500/5'
                  : 'border-primary/30 bg-primary/5'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                change.status === 'edited' ? 'text-blue-600 dark:text-blue-400' : 'text-primary'
              }`}
            >
              <Icons.sparkles className='h-3 w-3' />
              {change.status === 'edited'
                ? 'Custom Tailored Formulation'
                : 'Proposed Tailored Formulation'}
            </span>
            <p className='text-foreground font-medium leading-relaxed'>
              {change.status === 'edited' ? change.editedContent : change.proposedContent}
            </p>
          </div>
        </div>

        {/* Explainability / Rationale Card */}
        <div className='rounded-md bg-muted/40 p-3 space-y-1 text-muted-foreground border border-border/40 text-[11px] leading-relaxed'>
          <p>
            <strong className='text-foreground'>Why this change: </strong>
            {change.rationale}
          </p>
          <p>
            <strong className='text-foreground'>Targeted Job Requirement: </strong>
            {change.jobRequirement}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
