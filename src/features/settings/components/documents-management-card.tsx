'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentKeys, documentsQueryOptions } from '@/features/documents/api/queries';
import {
  uploadDocumentAction,
  deleteDocumentAction,
  deleteCandidateAccountAction
} from '@/features/documents/api/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsManagementCard() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: documents = [], isLoading } = useQuery(documentsQueryOptions());

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return uploadDocumentAction(formData);
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
      toast.success(`Uploaded ${doc.filename}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Upload failed');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return deleteDocumentAction(documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
      toast.success('Document deleted. Approved Knowledge Bank items remain intact.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete document');
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleAccountDelete = async () => {
    if (deleteConfirmText !== 'DELETE MY CAREERQUEST DATA') {
      toast.error('Please type the exact confirmation phrase to proceed.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      const res = await deleteCandidateAccountAction(deleteConfirmText);
      toast.success(`Account data deleted. Storage status: ${res.storageCleanupStatus}.`);
      setDeleteConfirmText('');
      // Invalidate queries and refresh
      queryClient.clear();
      window.location.href = '/';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Deletion failed';
      toast.error(message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      {/* Uploaded Documents Management */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between pb-3'>
          <div className='space-y-1'>
            <CardTitle className='text-base'>Uploaded Source Documents</CardTitle>
            <CardDescription>
              Resumes and career documents used as source material for your Knowledge Bank.
            </CardDescription>
          </div>
          <div>
            <input
              type='file'
              ref={fileInputRef}
              onChange={handleFileChange}
              accept='.pdf,.docx,.txt'
              className='hidden'
              id='document-upload-input'
            />
            <Button
              size='sm'
              variant='outline'
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              className='gap-1.5'
            >
              {uploadMutation.isPending ? (
                <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Icons.upload className='h-3.5 w-3.5' />
              )}
              <span>Upload Document</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {isLoading ? (
            <div className='flex items-center justify-center p-6 text-sm text-muted-foreground'>
              <Icons.spinner className='h-4 w-4 animate-spin mr-2' /> Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className='rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground'>
              <Icons.page className='mx-auto h-8 w-8 text-muted-foreground/50 mb-2' />
              <p className='font-medium text-foreground'>No source documents uploaded</p>
              <p className='text-xs mt-1'>
                Upload a PDF, DOCX, or text resume to propose career facts for candidate review.
              </p>
            </div>
          ) : (
            <div className='divide-y divide-border/40 rounded-md border border-border/50 overflow-hidden'>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className='flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 hover:bg-muted/20 transition-colors'
                >
                  <div className='flex items-center gap-2.5 min-w-0'>
                    <Icons.page className='h-4 w-4 shrink-0 text-primary' />
                    <div className='min-w-0'>
                      <p className='text-xs font-medium text-foreground truncate'>{doc.filename}</p>
                      <p className='text-[11px] text-muted-foreground'>
                        {formatFileSize(doc.size)} • Uploaded{' '}
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2 self-end sm:self-center shrink-0'>
                    <Badge variant='outline' className='text-[10px] capitalize'>
                      {doc.processingStatus}
                    </Badge>
                    <a
                      href={`/api/documents/${doc.id}`}
                      download={doc.filename}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      title='Download Document'
                    >
                      <Icons.download className='h-3.5 w-3.5' />
                      <span className='sr-only'>Download</span>
                    </a>
                    <Button
                      size='sm'
                      variant='ghost'
                      className='h-7 w-7 p-0 text-destructive hover:text-destructive'
                      title='Delete Document'
                      disabled={deleteDocMutation.isPending}
                      onClick={() => deleteDocMutation.mutate(doc.id)}
                    >
                      <Icons.trash className='h-3.5 w-3.5' />
                      <span className='sr-only'>Delete Document</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className='rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border border-border/50'>
            <p className='font-medium text-foreground'>Document vs Knowledge Lifecycle</p>
            <p className='mt-1'>
              Deleting an uploaded document permanently removes the file. Any approved items in your
              Knowledge Bank derived from this document remain active, and their source provenance
              will truthfully reflect that the source document is no longer stored.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account Data & Workspace Deletion */}
      <Card className='border-destructive/30'>
        <CardHeader>
          <CardTitle className='text-base text-destructive'>
            Delete Account & Workspace Data
          </CardTitle>
          <CardDescription>
            Permanently destroy your candidate workspace, applications, documents, and career
            knowledge.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='rounded-lg bg-destructive/5 p-3 text-xs text-destructive border border-destructive/20'>
            <div className='flex items-center gap-1.5 font-medium'>
              <Icons.warning className='h-4 w-4' />
              <span>Irreversible Workspace Deletion</span>
            </div>
            <p className='mt-1 text-muted-foreground'>
              This will permanently purge your candidate profile, search preferences, approved
              Knowledge Bank items, all uploaded resumes, tailored resume versions, and application
              tracking pipeline records. Public jobs will not be deleted.
            </p>
          </div>

          <div className='flex justify-end'>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <Button
                variant='destructive'
                size='sm'
                className='gap-1.5'
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Icons.trash className='h-3.5 w-3.5' />
                <span>Delete CareerQuest Data</span>
              </Button>
              <AlertDialogContent className='sm:max-w-[425px]'>
                <AlertDialogHeader>
                  <AlertDialogTitle className='text-destructive flex items-center gap-2'>
                    <Icons.warning className='h-5 w-5' />
                    Confirm Account Data Deletion
                  </AlertDialogTitle>
                  <AlertDialogDescription className='space-y-2 text-xs'>
                    <span>
                      This action cannot be undone. All your documents, tailored resumes, and
                      application history will be permanently expunged.
                    </span>
                    <span className='block font-medium text-foreground pt-1'>
                      To confirm, type{' '}
                      <span className='font-mono text-destructive'>DELETE MY CAREERQUEST DATA</span>{' '}
                      below:
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className='py-2'>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='DELETE MY CAREERQUEST DATA'
                    className='text-xs'
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => {
                      setDeleteConfirmText('');
                      setIsDeleteDialogOpen(false);
                    }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={
                      deleteConfirmText !== 'DELETE MY CAREERQUEST DATA' || isDeletingAccount
                    }
                    onClick={handleAccountDelete}
                    className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  >
                    {isDeletingAccount ? (
                      <>
                        <Icons.spinner className='mr-1.5 h-3.5 w-3.5 animate-spin' /> Deleting...
                      </>
                    ) : (
                      'Delete Everything'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
