'use client';

import React, { useState } from 'react';
import { ResumeChange } from '@/types/tailoring';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export interface ResumeChangeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  change: ResumeChange | null;
  onSave: (changeId: string, editedContent: string) => void;
  isSaving?: boolean;
}

interface InnerFormProps {
  change: ResumeChange;
  onSave: (changeId: string, editedContent: string) => void;
  onClose: () => void;
  isSaving: boolean;
}

function ChangeEditForm({ change, onSave, onClose, isSaving }: InnerFormProps) {
  const [content, setContent] = useState(change.editedContent || change.proposedContent);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSave(change.id, content.trim());
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <DialogHeader>
        <DialogTitle className='text-base font-bold'>Customize Statement Revision</DialogTitle>
        <DialogDescription className='text-xs'>
          Refine the tailored statement in your own voice. Your custom phrasing will be saved as the
          candidate-approved version for this application.
        </DialogDescription>
      </DialogHeader>

      <div className='space-y-3 pt-1'>
        <div className='rounded-md border border-border/70 bg-muted/30 p-2.5 space-y-1 text-xs'>
          <span className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
            Original Master Statement
          </span>
          <p className='text-foreground/80 leading-relaxed italic'>{change.originalContent}</p>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='edited-content' className='text-xs font-semibold'>
            Custom Tailored Phrasing *
          </Label>
          <Textarea
            id='edited-content'
            required
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className='text-xs leading-relaxed font-medium'
            placeholder='Refine your tailored wording here...'
          />
        </div>

        <div className='rounded-md bg-primary/5 border border-primary/20 p-2.5 text-[11px] text-muted-foreground space-y-0.5'>
          <p>
            <strong className='text-foreground'>Target Requirement: </strong>
            {change.jobRequirement}
          </p>
          <p>
            <strong className='text-foreground'>Grounded in: </strong>
            {change.sourceCandidateEvidence}
          </p>
        </div>
      </div>

      <DialogFooter className='pt-2'>
        <Button type='button' variant='outline' size='sm' onClick={onClose} className='text-xs'>
          Cancel
        </Button>
        <Button type='submit' size='sm' disabled={isSaving} className='text-xs'>
          Save Custom Phrasing
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ResumeChangeEditDialog({
  open,
  onOpenChange,
  change,
  onSave,
  isSaving = false
}: ResumeChangeEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md sm:max-w-lg'>
        {open && change && (
          <ChangeEditForm
            key={change.id}
            change={change}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
            isSaving={isSaving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
