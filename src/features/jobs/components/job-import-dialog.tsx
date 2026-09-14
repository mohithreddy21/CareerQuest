'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importJobMutation } from '../api/mutations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { jobKeys } from '../api/queries';
import { ImportJobPayload, ImportJobResponse, Job, JobMatch } from '../api/types';

type ImportStep = 'input' | 'processing' | 'duplicate' | 'success';
type ProcessingPhase = 'fetching' | 'extracting' | 'normalizing';

export function JobImportDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [step, setStep] = useState<ImportStep>('input');
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('fetching');

  // Result state
  const [duplicateJob, setDuplicateJob] = useState<Job | null>(null);
  const [duplicateReason, setDuplicateReason] = useState<string>('');
  const [importedJob, setImportedJob] = useState<Job | null>(null);
  const [importedMatch, setImportedMatch] = useState<JobMatch | null>(null);
  const [adapterName, setAdapterName] = useState<string>('');

  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation<ImportJobResponse, Error, ImportJobPayload>({
    ...importJobMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.all });

      if (data.isDuplicate && data.existingJob) {
        setDuplicateJob(data.existingJob);
        setDuplicateReason(data.error || 'A matching job already exists in your workspace.');
        setStep('duplicate');
        return;
      }

      if (data.success && data.job) {
        setImportedJob(data.job);
        setImportedMatch(data.match || null);
        setAdapterName(data.adapterName || 'Direct Import');
        setStep('success');
        toast.success(`Imported: ${data.job.title} at ${data.job.company}`);
      } else {
        setValidationError(data.error || 'Could not parse job from this URL.');
        setStep('input');
      }
    },
    onError: (err: Error) => {
      setValidationError(err?.message || 'Failed to import posting. Please check the URL.');
      setStep('input');
    }
  });

  const resetState = () => {
    setUrl('');
    setValidationError(null);
    setStep('input');
    setProcessingPhase('fetching');
    setDuplicateJob(null);
    setDuplicateReason('');
    setImportedJob(null);
    setImportedMatch(null);
    setAdapterName('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    setOpen(newOpen);
  };

  const validateUrl = (rawUrl: string): boolean => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      setValidationError('Please enter a job posting URL.');
      return false;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setValidationError('URL must begin with http:// or https://');
        return false;
      }
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        setValidationError('Please enter a valid web domain (e.g., https://company.com/jobs/...)');
        return false;
      }
    } catch {
      setValidationError('Invalid URL structure. Please enter a valid web link.');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const executeImport = async (forceDuplicate = false) => {
    if (!validateUrl(url)) return;

    setStep('processing');
    setProcessingPhase('fetching');

    // Simulated phase 1: Fetching posting
    await new Promise((r) => setTimeout(r, 450));
    setProcessingPhase('extracting');

    // Simulated phase 2: Extracting requirements
    await new Promise((r) => setTimeout(r, 450));
    setProcessingPhase('normalizing');

    // Simulated phase 3: Normalizing domain schema
    await new Promise((r) => setTimeout(r, 300));

    await mutation.mutateAsync({
      url: url.trim(),
      force: forceDuplicate
    });
  };

  const handleReviewExisting = () => {
    if (!duplicateJob) return;
    setOpen(false);
    resetState();
    router.push(`/dashboard/jobs/${duplicateJob.id}`);
  };

  const handleReviewImported = () => {
    if (!importedJob) return;
    setOpen(false);
    resetState();
    router.push(`/dashboard/jobs/${importedJob.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant='outline' size='default' className='gap-2 shadow-xs'>
            <Icons.add className='h-4 w-4' />
            Add Job by URL
          </Button>
        }
      />
      <DialogContent className='sm:max-w-[540px]'>
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold'>
            {step === 'input' && 'Import Job by Public URL'}
            {step === 'processing' && 'Processing Job Posting'}
            {step === 'duplicate' && 'Potential Duplicate Detected'}
            {step === 'success' && 'Job Normalized Successfully'}
          </DialogTitle>
          <DialogDescription className='text-xs text-muted-foreground'>
            {step === 'input' &&
              'Paste a public job posting URL from Greenhouse, Lever, LinkedIn, Indeed, Workday, or any company career page.'}
            {step === 'processing' &&
              'Simulating external extraction and standardizing into the normalized Job contract.'}
            {step === 'duplicate' &&
              'This opportunity appears to match an existing job already tracked in your workspace.'}
            {step === 'success' &&
              'Posting normalized against profile criteria. All provenance is preserved.'}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: INPUT */}
        {step === 'input' && (
          <div className='space-y-4 py-2'>
            <div className='space-y-2'>
              <label htmlFor='job-import-url' className='text-xs font-medium text-foreground'>
                Public Posting URL
              </label>
              <Input
                id='job-import-url'
                placeholder='https://boards.greenhouse.io/stripe/jobs/...'
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={mutation.isPending}
                className={
                  validationError ? 'border-destructive focus-visible:ring-destructive' : ''
                }
              />
              {validationError && (
                <div className='flex items-center gap-1.5 text-xs text-destructive font-medium'>
                  <Icons.alertCircle className='h-3.5 w-3.5 shrink-0' />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            <div className='rounded-lg border bg-muted/40 p-3 text-xs space-y-1.5 text-muted-foreground'>
              <p className='font-medium text-foreground'>Supported Source Adapters:</p>
              <div className='flex flex-wrap gap-1.5 pt-0.5'>
                <Badge variant='outline' className='text-[10px] font-normal'>
                  Greenhouse
                </Badge>
                <Badge variant='outline' className='text-[10px] font-normal'>
                  Lever
                </Badge>
                <Badge variant='outline' className='text-[10px] font-normal'>
                  LinkedIn Jobs
                </Badge>
                <Badge variant='outline' className='text-[10px] font-normal'>
                  Indeed
                </Badge>
                <Badge variant='outline' className='text-[10px] font-normal'>
                  Workday
                </Badge>
                <Badge variant='outline' className='text-[10px] font-normal'>
                  Generic Career Sites
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PROCESSING MULTI-PHASE STEPPER */}
        {step === 'processing' && (
          <div className='py-6 space-y-6'>
            <div className='space-y-3'>
              {/* Phase 1: Fetching */}
              <div className='flex items-center gap-3'>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                    processingPhase === 'fetching'
                      ? 'border-primary bg-primary text-primary-foreground animate-pulse'
                      : 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {processingPhase === 'fetching' ? (
                    <Icons.spinner className='h-4 w-4 animate-spin' />
                  ) : (
                    <Icons.check className='h-4 w-4' />
                  )}
                </div>
                <div>
                  <p className='text-xs font-semibold text-foreground'>
                    1. Fetching source posting
                  </p>
                  <p className='text-[11px] text-muted-foreground'>
                    Identifying source adapter and parsing public content
                  </p>
                </div>
              </div>

              {/* Phase 2: Extracting */}
              <div className='flex items-center gap-3'>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                    processingPhase === 'extracting'
                      ? 'border-primary bg-primary text-primary-foreground animate-pulse'
                      : processingPhase === 'normalizing'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-muted bg-muted text-muted-foreground'
                  }`}
                >
                  {processingPhase === 'extracting' ? (
                    <Icons.spinner className='h-4 w-4 animate-spin' />
                  ) : processingPhase === 'normalizing' ? (
                    <Icons.check className='h-4 w-4' />
                  ) : (
                    '2'
                  )}
                </div>
                <div>
                  <p className='text-xs font-semibold text-foreground'>
                    2. Extracting structured metadata
                  </p>
                  <p className='text-[11px] text-muted-foreground'>
                    Extracting requirements, responsibilities, salary, and work arrangement
                  </p>
                </div>
              </div>

              {/* Phase 3: Normalizing */}
              <div className='flex items-center gap-3'>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                    processingPhase === 'normalizing'
                      ? 'border-primary bg-primary text-primary-foreground animate-pulse'
                      : 'border-muted bg-muted text-muted-foreground'
                  }`}
                >
                  {processingPhase === 'normalizing' ? (
                    <Icons.spinner className='h-4 w-4 animate-spin' />
                  ) : (
                    '3'
                  )}
                </div>
                <div>
                  <p className='text-xs font-semibold text-foreground'>
                    3. Normalizing domain contract
                  </p>
                  <p className='text-[11px] text-muted-foreground'>
                    Checking duplicates and evaluating candidate profile fit
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DUPLICATE FOUND */}
        {step === 'duplicate' && duplicateJob && (
          <div className='space-y-4 py-2'>
            <div className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2'>
              <div className='flex items-start gap-2.5'>
                <Icons.warning className='h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5' />
                <div className='space-y-1'>
                  <p className='text-xs font-semibold text-amber-900 dark:text-amber-200'>
                    Duplicate Detected
                  </p>
                  <p className='text-xs text-amber-800/90 dark:text-amber-300/90'>
                    {duplicateReason}
                  </p>
                </div>
              </div>
            </div>

            <div className='rounded-lg border bg-card p-3 space-y-2 text-xs'>
              <p className='font-semibold text-foreground'>Existing Opportunity in Workspace:</p>
              <div className='flex justify-between items-start'>
                <div>
                  <p className='font-medium text-foreground'>{duplicateJob.title}</p>
                  <p className='text-muted-foreground'>
                    {duplicateJob.company} • {duplicateJob.location}
                  </p>
                </div>
                <Badge variant='outline' className='text-[10px] capitalize'>
                  {duplicateJob.source.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS CONFIRMATION */}
        {step === 'success' && importedJob && (
          <div className='space-y-4 py-2'>
            <div className='rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1'>
              <div className='flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-xs'>
                <Icons.check className='h-4 w-4 shrink-0' />
                <span>Standardized into Normalized Domain Contract</span>
              </div>
              <p className='text-xs text-emerald-800/80 dark:text-emerald-300/80 pl-6'>
                Identified through <span className='font-medium'>{adapterName}</span> adapter
                without fake data generation.
              </p>
            </div>

            <div className='rounded-lg border bg-card p-3.5 space-y-2.5 text-xs'>
              <div className='flex items-start justify-between gap-2'>
                <div>
                  <h4 className='font-semibold text-foreground text-sm'>{importedJob.title}</h4>
                  <p className='text-muted-foreground'>
                    {importedJob.company} • {importedJob.location}
                  </p>
                </div>
                {importedMatch && (
                  <Badge variant='secondary' className='font-semibold'>
                    {importedMatch.score}% Fit
                  </Badge>
                )}
              </div>

              <div className='flex flex-wrap gap-2 text-muted-foreground pt-1'>
                <span className='capitalize bg-muted px-2 py-0.5 rounded text-[11px]'>
                  {importedJob.workArrangement}
                </span>
                {importedJob.salary ? (
                  <span className='bg-muted px-2 py-0.5 rounded text-[11px]'>
                    ${(importedJob.salary.min ?? 0) / 1000}k - $
                    {(importedJob.salary.max ?? 0) / 1000}k
                  </span>
                ) : (
                  <span className='bg-muted px-2 py-0.5 rounded text-[11px] italic'>
                    Salary not disclosed
                  </span>
                )}
                <span className='bg-muted px-2 py-0.5 rounded text-[11px]'>
                  {importedJob.requiredSkills.length} required skills
                </span>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <DialogFooter className='flex-col sm:flex-row gap-2 sm:justify-end'>
          {step === 'input' && (
            <>
              <Button variant='ghost' onClick={() => setOpen(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => executeImport(false)}
                disabled={!url.trim() || mutation.isPending}
              >
                Import Job
              </Button>
            </>
          )}

          {step === 'duplicate' && (
            <>
              <Button variant='outline' size='sm' onClick={() => setStep('input')}>
                Use Another URL
              </Button>
              <Button variant='ghost' size='sm' onClick={() => executeImport(true)}>
                Import Anyway
              </Button>
              <Button
                variant='default'
                size='sm'
                onClick={handleReviewExisting}
                className='gap-1.5'
              >
                Review Existing Opportunity
                <Icons.arrowRight className='h-3.5 w-3.5' />
              </Button>
            </>
          )}

          {step === 'success' && (
            <>
              <Button
                variant='outline'
                onClick={() => {
                  setOpen(false);
                  resetState();
                }}
              >
                Close
              </Button>
              <Button variant='default' onClick={handleReviewImported} className='gap-1.5'>
                Review Job
                <Icons.arrowRight className='h-4 w-4' />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
