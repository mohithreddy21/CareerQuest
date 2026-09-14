import React, { useState } from 'react';
import { Job } from '@/types/domain';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

export interface ExternalHandoffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  onConfirmApplied: () => void;
  isSubmitting?: boolean;
}

export function ExternalHandoffModal({
  open,
  onOpenChange,
  job,
  onConfirmApplied,
  isSubmitting
}: ExternalHandoffModalProps) {
  const [hasOpenedPortal, setHasOpenedPortal] = useState(false);

  const targetUrl = job.originalUrl || 'https://careers.example.com';

  const handleOpenPortal = () => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    setHasOpenedPortal(true);
  };

  const handleConfirm = () => {
    onConfirmApplied();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <div className='flex items-center gap-2 mb-1'>
            <Badge variant='outline' className='text-[10px] uppercase font-semibold'>
              External Application Handoff
            </Badge>
          </div>
          <DialogTitle className='text-lg font-bold'>Apply on {job.company}</DialogTitle>
          <DialogDescription className='text-xs leading-relaxed'>
            CareerQuest prepares your verified materials, but you submit the application yourself
            directly on {job.company}&apos;s career site.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2 text-xs'>
          {/* Instruction Steps */}
          <div className='rounded-lg border border-border/70 bg-muted/30 p-3.5 space-y-2.5'>
            <div className='flex items-start gap-2'>
              <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary'>
                1
              </span>
              <p className='text-foreground/90'>
                Open {job.company}&apos;s portal and paste or upload your tailored resume and cover
                letter.
              </p>
            </div>
            <div className='flex items-start gap-2'>
              <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary'>
                2
              </span>
              <p className='text-foreground/90'>
                Complete the application steps on {job.company}&apos;s website.
              </p>
            </div>
            <div className='flex items-start gap-2'>
              <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary'>
                3
              </span>
              <p className='text-foreground/90'>
                Return here and explicitly confirm submission to advance your pipeline status.
              </p>
            </div>
          </div>

          {/* Action Step 1: Open Portal */}
          <div className='flex items-center justify-between p-3 rounded-lg border border-border bg-card'>
            <div>
              <p className='font-semibold text-foreground text-xs'>Step 1: Open Company Job Page</p>
              <p className='text-[11px] text-muted-foreground truncate max-w-xs'>{targetUrl}</p>
            </div>
            <Button
              size='sm'
              variant={hasOpenedPortal ? 'outline' : 'default'}
              onClick={handleOpenPortal}
              className='text-xs gap-1.5'
            >
              <Icons.externalLink className='h-3.5 w-3.5' />
              <span>{hasOpenedPortal ? 'Re-open Portal' : 'Open Portal'}</span>
            </Button>
          </div>

          {/* Step 2 Confirmation Prompt */}
          <div className='rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2'>
            <p className='font-bold text-xs text-foreground'>
              Did you complete and submit your application?
            </p>
            <p className='text-[11px] text-muted-foreground leading-relaxed'>
              CareerQuest never assumes an application was sent. Only your explicit confirmation
              will mark this opportunity as <strong>Applied</strong> in your tracking pipeline.
            </p>
          </div>
        </div>

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button variant='ghost' size='sm' onClick={handleCancel} className='text-xs'>
            Not Yet / In Progress
          </Button>
          <Button
            size='sm'
            onClick={handleConfirm}
            disabled={isSubmitting}
            className='text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white'
          >
            <Icons.check className='h-3.5 w-3.5' />
            <span>Yes, Mark as Applied</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
