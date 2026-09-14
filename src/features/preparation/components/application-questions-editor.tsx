import React, { useState } from 'react';
import { GroundedApplicationQuestion } from '@/types/preparation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface ApplicationQuestionsEditorProps {
  questions: GroundedApplicationQuestion[];
  onUpdateQuestion: (updated: GroundedApplicationQuestion) => void;
  isSaving?: boolean;
}

export function ApplicationQuestionsEditor({
  questions,
  onUpdateQuestion,
  isSaving
}: ApplicationQuestionsEditorProps) {
  const [editingQuestion, setEditingQuestion] = useState<GroundedApplicationQuestion | null>(null);
  const [candidateText, setCandidateText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleOpenEdit = (q: GroundedApplicationQuestion) => {
    setEditingQuestion(q);
    setCandidateText(q.candidateEditedAnswer || q.suggestedAnswer);
  };

  const handleSaveEdit = () => {
    if (!editingQuestion) return;
    onUpdateQuestion({
      ...editingQuestion,
      candidateEditedAnswer: candidateText,
      reviewed: true
    });
    setEditingQuestion(null);
    toast.success('Custom answer saved and marked as reviewed.');
  };

  const handleToggleReview = (q: GroundedApplicationQuestion) => {
    onUpdateQuestion({
      ...q,
      reviewed: !q.reviewed
    });
  };

  const handleCopyAnswer = (q: GroundedApplicationQuestion) => {
    const text = q.candidateEditedAnswer || q.suggestedAnswer;
    navigator.clipboard.writeText(text);
    setCopiedId(q.id);
    toast.success('Answer copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const reviewedCount = questions.filter((q) => q.reviewed).length;

  return (
    <Card className='border-border/80 shadow-xs'>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <div className='flex items-center gap-2'>
              <CardTitle className='text-base font-bold'>Application Questions & Answers</CardTitle>
              <Badge variant='outline' className='text-xs font-semibold'>
                {reviewedCount} / {questions.length} Reviewed
              </Badge>
            </div>
            <CardDescription className='text-xs'>
              Tailored responses grounded in your verified projects, latency outcomes, and
              leadership facts.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {questions.map((q, idx) => {
          const activeText = q.candidateEditedAnswer || q.suggestedAnswer;
          const isCustom = Boolean(q.candidateEditedAnswer);

          return (
            <div
              key={q.id}
              className={cn(
                'rounded-lg border p-4 transition-all space-y-3',
                q.reviewed ? 'border-border/60 bg-card/60' : 'border-border bg-muted/20'
              )}
            >
              {/* Question Header */}
              <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='space-y-1 max-w-xl'>
                  <div className='flex items-center gap-2'>
                    <span className='font-mono text-xs font-bold text-muted-foreground'>
                      Q{idx + 1}.
                    </span>
                    <Badge variant='secondary' className='text-[10px] capitalize font-medium'>
                      {q.category}
                    </Badge>
                    {isCustom && (
                      <Badge
                        variant='outline'
                        className='text-[10px] text-primary border-primary/40'
                      >
                        Candidate Customized
                      </Badge>
                    )}
                    {q.reviewed && (
                      <span className='inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400'>
                        <Icons.check className='h-3 w-3' /> Reviewed
                      </span>
                    )}
                  </div>
                  <h4 className='font-semibold text-xs text-foreground leading-snug'>
                    {q.question}
                  </h4>
                </div>

                {/* Question Actions */}
                <div className='flex items-center gap-1.5 shrink-0'>
                  {/* Grounding Evidence Popover */}
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-7 text-[11px] gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400'
                        >
                          <Icons.circleCheck className='h-3.5 w-3.5' />
                          <span>Evidence</span>
                        </Button>
                      }
                    />

                    <PopoverContent className='w-72 text-xs p-3 space-y-1.5' align='end'>
                      <p className='font-bold text-foreground text-[11px] flex items-center gap-1.5'>
                        <Icons.circleCheck className='h-3.5 w-3.5 text-emerald-600' />
                        Grounded Sources:
                      </p>
                      <ul className='list-disc pl-4 space-y-1 text-[11px] text-muted-foreground'>
                        {q.evidenceReferences.map((ref, rIdx) => (
                          <li key={rIdx}>{ref}</li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>

                  {/* Copy Answer */}
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => handleCopyAnswer(q)}
                    className='h-7 text-[11px] gap-1'
                  >
                    {copiedId === q.id ? (
                      <>
                        <Icons.check className='h-3 w-3 text-emerald-500' /> Copied
                      </>
                    ) : (
                      <>
                        <Icons.copy className='h-3 w-3' /> Copy
                      </>
                    )}
                  </Button>

                  {/* Edit Answer */}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleOpenEdit(q)}
                    className='h-7 text-[11px] gap-1'
                  >
                    <Icons.edit className='h-3 w-3' /> Customize
                  </Button>

                  {/* Toggle Reviewed */}
                  <Button
                    variant={q.reviewed ? 'secondary' : 'default'}
                    size='sm'
                    onClick={() => handleToggleReview(q)}
                    disabled={isSaving}
                    className='h-7 text-[11px] gap-1'
                  >
                    {q.reviewed ? (
                      <>
                        <Icons.close className='h-3 w-3' /> Unmark
                      </>
                    ) : (
                      <>
                        <Icons.check className='h-3 w-3' /> Mark Reviewed
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Answer Body */}
              <div className='rounded bg-muted/40 p-3 text-xs text-foreground/90 leading-relaxed font-sans border border-border/40'>
                {activeText}
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog
        open={Boolean(editingQuestion)}
        onOpenChange={(open) => !open && setEditingQuestion(null)}
      >
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='text-base font-bold'>Customize Application Answer</DialogTitle>
            <DialogDescription className='text-xs'>{editingQuestion?.question}</DialogDescription>
          </DialogHeader>

          <div className='space-y-2 py-2'>
            <label htmlFor='custom-answer-input' className='text-xs font-semibold text-foreground'>
              Your Answer Phrasing:
            </label>
            <Textarea
              id='custom-answer-input'
              rows={6}
              value={candidateText}
              onChange={(e) => setCandidateText(e.target.value)}
              className='text-xs font-sans leading-relaxed'
              placeholder='Tailor your response...'
            />

            <p className='text-[11px] text-muted-foreground'>
              Refine the response in your own voice while preserving truthfulness with your
              Knowledge Bank.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setEditingQuestion(null)}
              className='text-xs'
            >
              Cancel
            </Button>
            <Button size='sm' onClick={handleSaveEdit} className='text-xs gap-1'>
              <Icons.check className='h-3.5 w-3.5' /> Save & Mark Reviewed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
