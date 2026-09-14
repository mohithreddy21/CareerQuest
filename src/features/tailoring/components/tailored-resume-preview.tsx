'use client';

import React, { useState } from 'react';
import { TailoredResumeVersion } from '@/types/tailoring';
import { ResumeTemplateId } from '@/types/templates';
import { extractResumeContent } from '@/types/resume-content';
import { getResumeTemplate } from '@/features/templates/constants/templates';
import { ResumeRenderer } from '@/features/templates/components/resume-renderer';
import { TemplateSelector } from '@/features/templates/components/template-selector';
import { exportResumeDocument } from '@/features/export/services/resume-export-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface TailoredResumePreviewProps {
  resume: TailoredResumeVersion;
}

export function TailoredResumePreview({ resume }: TailoredResumePreviewProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<ResumeTemplateId>('classic-v1');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const template = getResumeTemplate(selectedTemplateId);
  const content = extractResumeContent(resume);

  const pendingCount = resume.changes.filter((c) => c.status === 'pending').length;
  const isFinalized = resume.approvalState === 'approved' && pendingCount === 0;

  const handleExport = async (format: 'pdf' | 'docx') => {
    try {
      if (format === 'pdf') setIsExportingPdf(true);
      if (format === 'docx') setIsExportingDocx(true);

      const record = await exportResumeDocument({
        resume,
        template,
        format
      });

      toast.success(`Downloaded ${format.toUpperCase()}: ${record.filename}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown export error';
      toast.error(`Export failed: ${msg}`);
    } finally {
      setIsExportingPdf(false);
      setIsExportingDocx(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* 1. Control Header with Format Downloads & Application Preparation Link */}
      <Card className='border-border/80 shadow-xs'>
        <CardHeader className='pb-4 border-b border-border/60'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2'>
                <CardTitle className='text-base font-bold'>
                  Tailored Document Presentation
                </CardTitle>
                <Badge
                  variant={isFinalized ? 'default' : 'secondary'}
                  className='text-xs capitalize font-semibold'
                >
                  {isFinalized ? 'Finalized Snapshot' : `${pendingCount} Pending Review`}
                </Badge>
              </div>
              <p className='text-xs text-muted-foreground'>
                Renders approved candidate facts through selectable ATS-optimized presentation
                templates.
              </p>
            </div>

            {/* Actions: PDF / DOCX / Prepare */}
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={isExportingPdf}
                onClick={() => handleExport('pdf')}
                className='text-xs gap-1.5 shadow-xs'
              >
                {isExportingPdf ? (
                  <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
                ) : (
                  <Icons.download className='h-3.5 w-3.5' />
                )}
                <span>Download PDF</span>
              </Button>

              <Button
                variant='outline'
                size='sm'
                disabled={isExportingDocx}
                onClick={() => handleExport('docx')}
                className='text-xs gap-1.5 shadow-xs'
              >
                {isExportingDocx ? (
                  <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
                ) : (
                  <Icons.fileTypeDoc className='h-3.5 w-3.5' />
                )}
                <span>Download DOCX</span>
              </Button>

              <Link
                href={
                  resume.jobId === 'job-1'
                    ? '/dashboard/applications/app-1'
                    : resume.jobId === 'job-2'
                      ? '/dashboard/applications/app-2'
                      : '/dashboard/applications'
                }
                className={cn(buttonVariants({ size: 'sm' }), 'text-xs gap-1.5 shadow-xs')}
              >
                <span>Prepare Application</span>
                <Icons.arrowRight className='h-3.5 w-3.5' />
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className='pt-4'>
          {/* Template Selector Bar */}
          <TemplateSelector
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={(tplId) => setSelectedTemplateId(tplId)}
          />
        </CardContent>
      </Card>

      {/* 2. Draft warning if changes are unreviewed */}
      {!isFinalized && (
        <div className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3 text-xs'>
          <div className='flex items-center gap-2 text-amber-800 dark:text-amber-300'>
            <Icons.warning className='h-4 w-4 shrink-0 text-amber-600' />
            <span>
              {pendingCount} revision{pendingCount > 1 ? 's are' : ' is'} still pending human review
              in the <strong>Review Queue</strong> tab.
            </span>
          </div>
          <p className='text-[11px] text-amber-700 dark:text-amber-400'>
            Exports reflect currently approved statements.
          </p>
        </div>
      )}

      {/* 3. Rendered Resume Preview */}
      <ResumeRenderer content={content} template={template} />
    </div>
  );
}
