'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ProposedIngestionBatch,
  ProposedKnowledgeItem,
  IngestionConflictStatus,
  SkillKnowledgeContent,
  ExperienceKnowledgeContent,
  ProjectKnowledgeContent,
  EducationKnowledgeContent,
  CertificationKnowledgeContent,
  AchievementKnowledgeContent
} from '@/types/knowledge';
import { resolveProposedItemMutation, acceptAllProposedMutation } from '../api/mutations';
import { knowledgeKeys } from '../api/queries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';

export interface ProposedKnowledgeReviewProps {
  candidateId: string;
  batches: ProposedIngestionBatch[];
}

function getConflictBadge(status: IngestionConflictStatus) {
  switch (status) {
    case 'new':
      return (
        <Badge
          variant='outline'
          className='text-[10px] border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300'
        >
          New Knowledge
        </Badge>
      );
    case 'exact_match':
      return (
        <Badge
          variant='outline'
          className='text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
        >
          Matches Existing
        </Badge>
      );
    case 'possible_duplicate':
      return (
        <Badge
          variant='outline'
          className='text-[10px] border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300'
        >
          Canonical Match
        </Badge>
      );
    case 'conflict':
      return (
        <Badge
          variant='outline'
          className='text-[10px] border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300'
        >
          Conflict Detected
        </Badge>
      );
  }
}

export function ProposedKnowledgeReview({ candidateId, batches }: ProposedKnowledgeReviewProps) {
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: resolveProposedItemMutation.mutationFn,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success(
        vars.action === 'accept'
          ? 'Proposed claim approved & added to Knowledge Bank.'
          : vars.action === 'reject'
            ? 'Proposed claim rejected.'
            : 'Claim updated and accepted.'
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to resolve claim: ${msg}`);
    }
  });

  const acceptAllMutation = useMutation({
    mutationFn: acceptAllProposedMutation.mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success('Accepted all non-conflicting proposed claims.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to accept all claims: ${msg}`);
    }
  });

  if (batches.length === 0) return null;

  return (
    <div className='space-y-4'>
      {batches.map((batch: ProposedIngestionBatch) => {
        const safeCount = batch.items.filter(
          (i: ProposedKnowledgeItem) => i.conflictStatus !== 'conflict'
        ).length;

        return (
          <Card
            key={batch.id}
            className='border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-xs overflow-hidden'
          >
            <CardHeader className='pb-3'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='space-y-1'>
                  <div className='flex items-center gap-2'>
                    <Badge variant='default' className='text-xs font-semibold'>
                      Proposed Ingestion Queue
                    </Badge>
                    <span className='text-xs text-muted-foreground'>
                      {batch.items.length} pending review
                    </span>
                  </div>
                  <CardTitle className='text-base font-bold text-foreground sm:text-lg'>
                    Claims Extracted from {batch.fileName}
                  </CardTitle>
                  <CardDescription className='text-xs'>
                    Review and verify each extracted item below. CareerQuest will only store and use
                    information you explicitly accept.
                  </CardDescription>
                </div>

                <div className='flex items-center gap-2'>
                  <Button
                    size='sm'
                    disabled={safeCount === 0 || acceptAllMutation.isPending}
                    onClick={() => acceptAllMutation.mutate({ candidateId, batchId: batch.id })}
                    className='text-xs gap-1.5 shadow-xs'
                  >
                    <Icons.check className='h-3.5 w-3.5' />
                    Accept All Safe Claims ({safeCount})
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className='space-y-3 pt-1'>
              {batch.items.map((item: ProposedKnowledgeItem) => (
                <ProposedItemCard
                  key={item.tempId}
                  item={item}
                  onResolve={(action, editedContent) =>
                    resolveMutation.mutate({
                      candidateId,
                      batchId: batch.id,
                      tempId: item.tempId,
                      action,
                      editedContent
                    })
                  }
                  isResolving={resolveMutation.isPending}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ProposedItemCard({
  item,
  onResolve,
  isResolving
}: {
  item: ProposedKnowledgeItem;
  onResolve: (
    action: 'accept' | 'reject' | 'edit',
    editedContent?: Record<string, unknown>
  ) => void;
  isResolving: boolean;
}) {
  const getItemTitle = () => {
    if (item.category === 'skill') {
      return (item.content as SkillKnowledgeContent).name;
    }
    if (item.category === 'experience') {
      const exp = item.content as ExperienceKnowledgeContent;
      return `${exp.role} at ${exp.employer}`;
    }
    if (item.category === 'project') {
      return (item.content as ProjectKnowledgeContent).name;
    }
    if (item.category === 'education') {
      const edu = item.content as EducationKnowledgeContent;
      return `${edu.degree} — ${edu.institution}`;
    }
    if (item.category === 'certification') {
      return (item.content as CertificationKnowledgeContent).name;
    }
    if (item.category === 'achievement') {
      return (item.content as AchievementKnowledgeContent).title;
    }
    return 'Proposed Claim';
  };

  return (
    <div className='rounded-lg border border-border/70 bg-card p-3.5 space-y-2 text-xs shadow-2xs'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Badge variant='secondary' className='text-[10px] capitalize font-semibold'>
            {item.category}
          </Badge>
          {getConflictBadge(item.conflictStatus)}
          <span className='font-semibold text-foreground text-sm'>{getItemTitle()}</span>
        </div>

        <div className='flex items-center gap-1.5'>
          <Button
            size='sm'
            variant='default'
            disabled={isResolving}
            onClick={() => onResolve('accept')}
            className='h-7 px-2.5 text-xs gap-1'
          >
            <Icons.check className='h-3 w-3' />
            {item.conflictStatus === 'conflict' ? 'Accept Incoming' : 'Accept'}
          </Button>

          <Button
            size='sm'
            variant='outline'
            disabled={isResolving}
            onClick={() => onResolve('reject')}
            className='h-7 px-2 text-xs text-muted-foreground hover:text-foreground'
          >
            <Icons.close className='h-3 w-3 mr-1' />
            {item.conflictStatus === 'conflict' ? 'Keep Existing' : 'Reject'}
          </Button>
        </div>
      </div>

      {item.conflictDescription && (
        <div className='rounded-md border border-amber-200/80 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20 p-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed'>
          <strong>Notice:</strong> {item.conflictDescription}
        </div>
      )}

      {item.extractedSnippet && (
        <div className='rounded-md border border-border/40 bg-muted/20 p-2 italic text-[11px] text-muted-foreground'>
          &ldquo;{item.extractedSnippet}&rdquo;
        </div>
      )}
    </div>
  );
}
