import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

export interface ReadyRoomHandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: string;
  role: string;
  destinationUrl: string;
  destinationDomain: string | null;
  onConfirmApplied: (note?: string) => void;
  isSubmitting?: boolean;
}

export function ReadyRoomHandoffDialog({
  open,
  onOpenChange,
  company,
  role,
  destinationUrl,
  destinationDomain,
  onConfirmApplied,
  isSubmitting
}: ReadyRoomHandoffDialogProps) {
  const [hasOpenedSite, setHasOpenedSite] = useState(false);
  const [candidateNote, setCandidateNote] = useState('');

  const handleOpenDestination = () => {
    try {
      window.open(destinationUrl, '_blank', 'noopener,noreferrer');
      setHasOpenedSite(true);
      toast.info(`Opened ${company}'s application portal in a new tab.`);
    } catch {
      toast.error('Could not open external site. Please allow popups or copy the link directly.');
    }
  };

  const handleConfirmSubmission = () => {
    onConfirmApplied(candidateNote.trim() || undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <div className='flex items-center gap-2 mb-1.5'>
            <StatusBadge status='verified' label='External Handoff' size='sm' />
            <span className='text-xs text-muted-foreground font-mono'>{destinationDomain}</span>
          </div>
          <DialogTitle className='text-lg font-bold'>
            Apply to {role} at {company}
          </DialogTitle>
          <DialogDescription className='text-xs leading-relaxed'>
            CareerQuest empowers your preparation, but you submit the application yourself directly
            on {company}&apos;s portal. CareerQuest never performs automated submissions.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2 text-xs'>
          {/* Handoff Steps */}
          <div className='rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-3'>
            <div className='flex items-start gap-2.5'>
              <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold'>
                1
              </span>
              <div>
                <p className='font-semibold text-foreground text-xs'>Open Career Site</p>
                <p className='text-muted-foreground text-[11px] leading-relaxed'>
                  Navigate to {company}&apos;s verified job portal in your browser.
                </p>
              </div>
            </div>

            <div className='flex items-start gap-2.5'>
              <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold'>
                2
              </span>
              <div>
                <p className='font-semibold text-foreground text-xs'>Upload & Paste Materials</p>
                <p className='text-muted-foreground text-[11px] leading-relaxed'>
                  Upload your downloaded tailored resume and copy your grounded answers and cover
                  letter.
                </p>
              </div>
            </div>

            <div className='flex items-start gap-2.5'>
              <span className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold'>
                3
              </span>
              <div>
                <p className='font-semibold text-foreground text-xs'>Explicitly Confirm Here</p>
                <p className='text-muted-foreground text-[11px] leading-relaxed'>
                  Once submitted, return to this tab and confirm to advance your application
                  pipeline and permanently freeze your submission record.
                </p>
              </div>
            </div>
          </div>

          {/* Action Row: Open Site */}
          <div className='rounded-lg border border-border bg-card p-3 flex items-center justify-between gap-3'>
            <div className='min-w-0 flex-1'>
              <p className='font-semibold text-xs text-foreground'>Destination Portal</p>
              <p className='text-[11px] text-muted-foreground truncate font-mono'>
                {destinationUrl}
              </p>
            </div>
            <Button
              size='sm'
              variant={hasOpenedSite ? 'outline' : 'default'}
              onClick={handleOpenDestination}
              className='text-xs gap-1.5 shrink-0'
            >
              <Icons.externalLink className='h-3.5 w-3.5' />
              <span>{hasOpenedSite ? 'Re-open Portal' : 'Open Application'}</span>
            </Button>
          </div>

          {/* Explicit Candidate Confirmation Box */}
          <div className='rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2'>
            <div className='flex items-center gap-1.5 text-xs font-bold text-foreground'>
              <Icons.check className='h-4 w-4 text-emerald-600 dark:text-emerald-400' />
              <span>Candidate Submission Confirmation</span>
            </div>
            <p className='text-[11px] text-muted-foreground leading-relaxed'>
              Confirming submission marks this opportunity as <strong>Applied</strong>, records an
              immutable ledger event, and locks your tailored resume snapshot for future interview
              preparation.
            </p>
            <div className='pt-1'>
              <input
                type='text'
                placeholder='Optional confirmation note (e.g. Applied via referral / Greenhouse)'
                value={candidateNote}
                onChange={(e) => setCandidateNote(e.target.value)}
                className='w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
              />
            </div>
          </div>
        </div>

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className='text-xs'
          >
            Not Yet / In Progress
          </Button>
          <Button
            size='sm'
            onClick={handleConfirmSubmission}
            disabled={isSubmitting}
            className='text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold'
          >
            {isSubmitting ? (
              <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
            ) : (
              <Icons.check className='h-3.5 w-3.5' />
            )}
            <span>I Submitted This Application</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
