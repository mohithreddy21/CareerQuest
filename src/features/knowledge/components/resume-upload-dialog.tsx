'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ingestResumeMutation } from '../api/mutations';
import { knowledgeKeys } from '../api/queries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

export interface ResumeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId?: string;
}

export function ResumeUploadDialog({
  open,
  onOpenChange,
  candidateId = 'cand-1'
}: ResumeUploadDialogProps) {
  const [fileName, setFileName] = useState('Resume_Alex_Chen_2026_Updated.pdf');
  const [samplePreset, setSamplePreset] = useState<'updated2026' | 'devops'>('updated2026');
  const queryClient = useQueryClient();

  const ingestMutation = useMutation({
    ...ingestResumeMutation,
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success(
        `Parsed ${batch.items.length} claims from "${batch.fileName}". Added to Proposed Review Queue.`
      );
      onOpenChange(false);
    },
    onError: (err: Error) => {
      const msg = err.message || 'Unknown error';
      toast.error(`Resume ingestion failed: ${msg}`);
    }
  });

  const handlePresetSelect = (preset: 'updated2026' | 'devops') => {
    setSamplePreset(preset);
    if (preset === 'updated2026') {
      setFileName('Resume_Alex_Chen_2026_Updated.pdf');
    } else {
      setFileName('Resume_Alex_Chen_DevOps_Cloud.pdf');
    }
  };

  const handleIngest = (e: React.FormEvent) => {
    e.preventDefault();
    ingestMutation.mutate({
      candidateId,
      fileName: fileName.trim() || 'Uploaded_Resume.pdf'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md sm:max-w-lg'>
        <form onSubmit={handleIngest} className='space-y-4'>
          <DialogHeader>
            <DialogTitle>Ingest Resume into Knowledge Bank</DialogTitle>
            <DialogDescription className='text-xs'>
              Upload a resume document to extract skills, experience, and certifications. Extracted
              claims will be placed into the Proposed Review Queue for your explicit approval.
            </DialogDescription>
          </DialogHeader>

          {/* Sample Preset Selector for Testing */}
          <div className='space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3'>
            <span className='text-xs font-semibold text-foreground block'>
              Select Sample Resume for Testing:
            </span>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
              <button
                type='button'
                onClick={() => handlePresetSelect('updated2026')}
                className={`text-left p-2.5 rounded-md border text-xs transition-colors ${
                  samplePreset === 'updated2026'
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border/60 bg-background/80 text-muted-foreground hover:text-foreground'
                }`}
              >
                <p className='font-semibold'>2026 Updated Profile</p>
                <p className='text-[10px] text-muted-foreground mt-0.5'>
                  Includes CKA cert, gRPC, and Staff title.
                </p>
              </button>

              <button
                type='button'
                onClick={() => handlePresetSelect('devops')}
                className={`text-left p-2.5 rounded-md border text-xs transition-colors ${
                  samplePreset === 'devops'
                    ? 'border-primary bg-primary/10 text-foreground font-medium'
                    : 'border-border/60 bg-background/80 text-muted-foreground hover:text-foreground'
                }`}
              >
                <p className='font-semibold'>DevOps & Cloud Spec</p>
                <p className='text-[10px] text-muted-foreground mt-0.5'>
                  Includes Terraform, Prometheus, AWS DevOps.
                </p>
              </button>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='file-name' className='text-xs'>
              Document Name / File Identifier
            </Label>
            <Input
              id='file-name'
              required
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder='e.g. Resume_2026.pdf'
              className='text-xs'
            />
          </div>

          <div className='rounded-lg border border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-xs text-muted-foreground flex items-start gap-2'>
            <Icons.circleCheck className='h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5' />
            <p className='leading-relaxed'>
              <strong className='font-semibold text-foreground'>Truthfulness Assurance:</strong>{' '}
              Extracted claims will <em>never</em> be automatically approved. You will have full
              discretion to accept, reject, or edit each claim in the Proposed Review Queue.
            </p>
          </div>

          <DialogFooter className='pt-2'>
            <Button type='button' variant='outline' size='sm' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type='submit' size='sm' disabled={ingestMutation.isPending} className='gap-1.5'>
              {ingestMutation.isPending && <Icons.spinner className='h-3.5 w-3.5 animate-spin' />}
              {ingestMutation.isPending ? 'Parsing Document...' : 'Ingest & Review Claims'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
