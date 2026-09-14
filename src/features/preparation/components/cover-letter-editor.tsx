import React, { useState } from 'react';
import { GroundedCoverLetter } from '@/types/preparation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

export interface CoverLetterEditorProps {
  coverLetter: GroundedCoverLetter;
  onUpdate: (updated: GroundedCoverLetter) => void;
  isSaving?: boolean;
}

export function CoverLetterEditor({ coverLetter, onUpdate, isSaving }: CoverLetterEditorProps) {
  const [body, setBody] = useState(coverLetter.body);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    toast.success('Cover letter copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleReviewed = () => {
    const nextStatus = coverLetter.status === 'reviewed' ? 'draft' : 'reviewed';
    onUpdate({
      ...coverLetter,
      body,
      status: nextStatus
    });
    toast.success(
      nextStatus === 'reviewed'
        ? 'Cover letter marked as Reviewed & Ready.'
        : 'Cover letter returned to Draft.'
    );
  };

  const handleSaveDraft = () => {
    onUpdate({
      ...coverLetter,
      body
    });
    toast.success('Cover letter draft saved.');
  };

  return (
    <Card className='border-border/80 shadow-xs'>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              <CardTitle className='text-base font-bold'>Grounded Cover Letter</CardTitle>
              <Badge
                variant={coverLetter.status === 'reviewed' ? 'default' : 'secondary'}
                className='text-[10px] capitalize font-medium'
              >
                {coverLetter.status === 'reviewed' ? 'Reviewed & Ready' : 'Draft in Review'}
              </Badge>
            </div>
            <CardDescription className='text-xs'>
              Tailored narrative anchored to verified experiences in your Knowledge Bank. Never
              invents missing requirements.
            </CardDescription>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            {/* Grounding Popover */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 dark:text-emerald-400'
                  >
                    <Icons.circleCheck className='h-3.5 w-3.5' />
                    <span>Inspect Evidence ({coverLetter.sourceKnowledgeItemIds.length})</span>
                  </Button>
                }
              />

              <PopoverContent className='w-80 text-xs p-3.5 space-y-2' align='end'>
                <div className='font-bold text-foreground border-b border-border/60 pb-1 flex items-center gap-1.5'>
                  <Icons.circleCheck className='h-4 w-4 text-emerald-600' />
                  Grounded in your Knowledge Bank
                </div>
                <p className='text-[11px] text-muted-foreground'>
                  The statements in this cover letter reference the following verified candidate
                  facts:
                </p>
                <ul className='list-disc pl-4 space-y-1 text-[11px] text-foreground/90'>
                  {coverLetter.evidenceReferences.map((ref, idx) => (
                    <li key={idx}>{ref}</li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>

            {/* Copy Button */}
            <Button
              variant='outline'
              size='sm'
              onClick={handleCopy}
              className='h-8 text-xs gap-1.5'
            >
              {copied ? (
                <>
                  <Icons.check className='h-3.5 w-3.5 text-emerald-500' /> Copied
                </>
              ) : (
                <>
                  <Icons.copy className='h-3.5 w-3.5' /> Copy Draft
                </>
              )}
            </Button>

            {/* Review Status Toggle Button */}
            <Button
              variant={coverLetter.status === 'reviewed' ? 'secondary' : 'default'}
              size='sm'
              onClick={handleToggleReviewed}
              disabled={isSaving}
              className='h-8 text-xs gap-1.5'
            >
              {coverLetter.status === 'reviewed' ? (
                <>
                  <Icons.close className='h-3.5 w-3.5' /> Unmark Reviewed
                </>
              ) : (
                <>
                  <Icons.check className='h-3.5 w-3.5' /> Mark as Reviewed
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-3'>
        <Textarea
          rows={11}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={handleSaveDraft}
          className='font-sans text-xs leading-relaxed border-border/70 focus-visible:ring-1'
          placeholder='Cover letter body...'
        />

        <div className='flex items-center justify-between text-[11px] text-muted-foreground'>
          <span>
            Targeted for <strong className='text-foreground'>{coverLetter.company}</strong> &bull;{' '}
            {coverLetter.role}
          </span>
          <span>Draft auto-saves on blur</span>
        </div>
      </CardContent>
    </Card>
  );
}
