'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadAndIngestResumeMutation } from '../api/mutations';
import { knowledgeKeys } from '../api/queries';
import { resumeKeys } from '@/features/resume/api/queries';
import { documentKeys } from '@/features/documents/api/queries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

export interface ResumeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId?: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileFormatBadge(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (ext === '.pdf') {
    return (
      <Badge
        variant='outline'
        className='text-[10px] font-semibold border-rose-400 text-rose-600 dark:border-rose-800 dark:text-rose-400'
      >
        PDF
      </Badge>
    );
  }
  if (ext === '.docx') {
    return (
      <Badge
        variant='outline'
        className='text-[10px] font-semibold border-blue-400 text-blue-600 dark:border-blue-800 dark:text-blue-400'
      >
        DOCX
      </Badge>
    );
  }
  return (
    <Badge variant='outline' className='text-[10px] font-semibold'>
      TXT
    </Badge>
  );
}

export function ResumeUploadDialog({ open, onOpenChange, candidateId }: ResumeUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const resetState = () => {
    setSelectedFile(null);
    setValidationError(null);
    setIsDragOver(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const uploadMutation = useMutation({
    ...uploadAndIngestResumeMutation,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      queryClient.invalidateQueries({ queryKey: resumeKeys.profile() });
      queryClient.invalidateQueries({ queryKey: documentKeys.all });

      const claimCount = result?.batch?.items?.length || 0;
      const filename = result?.document?.filename || selectedFile?.name || 'resume';

      toast.success(`Uploaded "${filename}". Extracted ${claimCount} proposed claims for review.`);
      handleClose();
    },
    onError: (err: Error) => {
      const msg = err.message || 'Upload failed';
      setValidationError(msg);
      toast.error(`Resume upload failed: ${msg}`);
    }
  });

  const validateAndSetFile = (file: File) => {
    setValidationError(null);

    // 1. File size check (10 MB limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 10 MB.`
      );
      setSelectedFile(null);
      return;
    }

    // 2. Extension check
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setValidationError(
        `Unsupported file type "${ext || 'unknown'}". Allowed formats: .pdf, .docx, .txt`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setValidationError('Please select a resume file from your device first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (candidateId) {
      formData.append('candidateId', candidateId);
    }

    uploadMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className='max-w-md sm:max-w-lg'>
        <form onSubmit={handleUploadSubmit} className='space-y-4'>
          <DialogHeader>
            <DialogTitle>Upload Resume to Ingest</DialogTitle>
            <DialogDescription className='text-xs'>
              Upload your resume from this device (PDF, DOCX, or TXT). Extracted skills, experience,
              and education will be placed into your Proposed Review Queue for human-in-the-loop
              review.
            </DialogDescription>
          </DialogHeader>

          {/* Hidden HTML File Input */}
          <input
            ref={fileInputRef}
            type='file'
            accept='.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'
            onChange={handleFileInputChange}
            className='hidden'
            id='resume-file-picker-input'
          />

          {/* Drag & Drop / File Selection Area */}
          {!selectedFile ? (
            <div
              role='button'
              tabIndex={0}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                isDragOver
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
              }`}
            >
              <div className='p-3 rounded-full bg-primary/10 text-primary mb-3'>
                <Icons.upload className='h-6 w-6' />
              </div>
              <p className='text-xs font-semibold text-foreground mb-1 text-center'>
                Choose a file from your device or drag & drop here
              </p>
              <p className='text-[11px] text-muted-foreground text-center mb-3'>
                PDF, DOCX, or TXT (Max 10 MB)
              </p>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className='text-xs gap-1.5'
              >
                <Icons.folder className='h-3.5 w-3.5' /> Browse Local Files
              </Button>
            </div>
          ) : (
            <div className='rounded-lg border border-border bg-card p-4 space-y-3'>
              <div className='flex items-start justify-between gap-3'>
                <div className='flex items-center gap-2.5 min-w-0'>
                  <div className='p-2 rounded-md bg-primary/10 text-primary shrink-0'>
                    <Icons.page className='h-5 w-5' />
                  </div>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <p className='text-xs font-semibold text-foreground truncate'>
                        {selectedFile.name}
                      </p>
                      {getFileFormatBadge(selectedFile.name)}
                    </div>
                    <p className='text-[11px] text-muted-foreground mt-0.5'>
                      {formatBytes(selectedFile.size)} • Ready for ingestion
                    </p>
                  </div>
                </div>

                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={resetState}
                  className='h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0'
                  title='Remove selected file'
                >
                  <Icons.close className='h-3.5 w-3.5' />
                </Button>
              </div>

              <div className='flex items-center justify-between pt-1 border-t border-border/50 text-[11px] text-muted-foreground'>
                <span>Selected from local storage</span>
                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  className='text-primary hover:underline font-medium'
                >
                  Choose different file
                </button>
              </div>
            </div>
          )}

          {/* Validation Error Alert */}
          {validationError && (
            <div className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2'>
              <Icons.warning className='h-4 w-4 shrink-0 mt-0.5' />
              <p className='leading-relaxed font-medium'>{validationError}</p>
            </div>
          )}

          {/* Truthfulness Notice */}
          <div className='rounded-lg border border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-xs text-muted-foreground flex items-start gap-2'>
            <Icons.circleCheck className='h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5' />
            <p className='leading-relaxed'>
              <strong className='font-semibold text-foreground'>Truthfulness Assurance:</strong>{' '}
              Extracted claims will <em>never</em> be automatically approved. You will have full
              discretion to accept, reject, or edit each claim in the Proposed Review Queue.
            </p>
          </div>

          <DialogFooter className='pt-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={handleClose}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={!selectedFile || Boolean(validationError) || uploadMutation.isPending}
              className='gap-1.5'
            >
              {uploadMutation.isPending ? (
                <>
                  <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
                  <span>Uploading & Ingesting...</span>
                </>
              ) : (
                <>
                  <Icons.upload className='h-3.5 w-3.5' />
                  <span>Upload & Ingest Resume</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
