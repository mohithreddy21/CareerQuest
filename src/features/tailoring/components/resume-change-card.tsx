'use client';

import React from 'react';
import { ResumeChange, ResumeChangeStatus } from '@/types/tailoring';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { StatusBadge } from '@/components/ui/status-badge';
import { DiffViewer } from '@/components/ui/diff-viewer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ResumeChangeCardProps {
  change: ResumeChange;
  onUpdateStatus: (changeId: string, status: ResumeChangeStatus) => void;
  onOpenEdit: (change: ResumeChange) => void;
  isUpdating?: boolean;
}

export function ResumeChangeCard({
  change,
  onUpdateStatus,
  onOpenEdit,
  isUpdating = false
}: ResumeChangeCardProps) {
  const isGrounded = change.grounded !== false;
  const isApproved = change.status === 'approved';
  const isEdited = change.status === 'edited';
  const isRejected = change.status === 'rejected';

  const displayedProposedText = isEdited
    ? change.editedContent || change.proposedContent
    : change.proposedContent;

  return (
    <Card
      className={cn(
        'border-border/80 shadow-xs hover:border-border transition-colors',
        isRejected && 'opacity-70 bg-muted/10'
      )}
    >
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-center justify-between gap-2.5'>
          {/* Left Metadata & Semantic Badges */}
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline' className='text-[10px] uppercase tracking-wider font-semibold'>
              Section: {change.section}
            </Badge>

            {/* Decision Status Badge */}
            {isApproved && <StatusBadge status='verified' size='sm' label='Approved' />}
            {isEdited && <StatusBadge status='customized' size='sm' label='Custom Edited' />}
            {isRejected && <StatusBadge status='original' size='sm' label='Kept Original' />}
            {!isApproved && !isEdited && !isRejected && (
              <StatusBadge status='review' size='sm' label='Pending Review' />
            )}

            {/* Grounding Trust Badge & Evidence Popover */}
            <Popover>
              <PopoverTrigger
                render={
                  <button
                    type='button'
                    className='inline-flex items-center cursor-pointer transition-opacity hover:opacity-80'
                    aria-label={
                      isGrounded ? 'Verified against Knowledge Bank' : 'Requires candidate review'
                    }
                  >
                    <StatusBadge
                      status={isGrounded ? 'verified' : 'review'}
                      size='sm'
                      label={isGrounded ? 'Verified Knowledge' : 'Requires Candidate Review'}
                    />
                  </button>
                }
              />
              <PopoverContent className='w-80 p-3 text-xs space-y-2' align='start'>
                <div className='font-semibold text-foreground flex items-center gap-1.5'>
                  {isGrounded ? (
                    <>
                      <Icons.badgeCheck className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />
                      <span>Grounded in your Knowledge Bank</span>
                    </>
                  ) : (
                    <>
                      <Icons.warning className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                      <span>Requires Candidate Review</span>
                    </>
                  )}
                </div>
                <p className='text-muted-foreground text-[11px] leading-relaxed'>
                  {isGrounded
                    ? 'This proposed statement is strictly anchored to approved candidate facts. Zero synthetic claims were introduced.'
                    : 'This statement introduces claims or metrics that could not be independently verified in your Knowledge Bank. Explicit candidate review is required.'}
                </p>
                <div className='rounded-md bg-muted/50 p-2 space-y-1 text-[11px] border border-border/40'>
                  <p>
                    <strong className='text-foreground font-medium'>Knowledge IDs: </strong>
                    <code className='text-[10px] font-mono'>
                      {change.sourceKnowledgeItemIds?.length > 0
                        ? change.sourceKnowledgeItemIds.join(', ')
                        : 'None cited'}
                    </code>
                  </p>
                  {change.sourceCandidateEvidence && (
                    <p>
                      <strong className='text-foreground font-medium'>Verified Evidence: </strong>
                      <span>{change.sourceCandidateEvidence}</span>
                    </p>
                  )}
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
              variant={isApproved ? 'default' : 'outline'}
              disabled={isUpdating}
              onClick={() => onUpdateStatus(change.id, 'approved')}
              className='h-7 px-2.5 text-xs gap-1'
            >
              <Icons.check className='h-3 w-3' /> Approve
            </Button>

            <Button
              size='sm'
              variant={isRejected ? 'neutral' : 'ghost'}
              disabled={isUpdating}
              onClick={() => onUpdateStatus(change.id, 'rejected')}
              className='h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground'
            >
              <Icons.close className='h-3 w-3' /> Keep Original
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className='pt-0'>
        {/* LCS Token-Level Diff Viewer */}
        <DiffViewer
          originalText={change.originalContent}
          proposedText={displayedProposedText}
          originalLabel='Master Resume Statement'
          proposedLabel={isEdited ? 'Custom Tailored Formulation' : 'Proposed Tailored Formulation'}
          status={
            isRejected ? 'neutral' : isEdited ? 'customized' : isGrounded ? 'verified' : 'review'
          }
          grounded={isGrounded}
          rationale={change.rationale}
          jobRequirement={change.jobRequirement}
          sourceCandidateEvidence={change.sourceCandidateEvidence}
          sourceKnowledgeItemIds={change.sourceKnowledgeItemIds}
        />
      </CardContent>
    </Card>
  );
}
