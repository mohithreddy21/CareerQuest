'use client';

import React from 'react';
import { RetrievedCandidateKnowledge } from '@/types/tailoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';

export interface RetrievedKnowledgePanelProps {
  retrieved: RetrievedCandidateKnowledge;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'skill':
      return <Icons.code className='h-3.5 w-3.5 text-blue-500' />;
    case 'experience':
      return <Icons.user className='h-3.5 w-3.5 text-purple-500' />;
    case 'project':
      return <Icons.post className='h-3.5 w-3.5 text-emerald-500' />;
    case 'education':
      return <Icons.fileTypeDoc className='h-3.5 w-3.5 text-amber-500' />;
    case 'certification':
      return <Icons.badgeCheck className='h-3.5 w-3.5 text-cyan-500' />;
    case 'achievement':
      return <Icons.sparkles className='h-3.5 w-3.5 text-rose-500' />;
    default:
      return <Icons.page className='h-3.5 w-3.5 text-muted-foreground' />;
  }
}

export function RetrievedKnowledgePanel({ retrieved }: RetrievedKnowledgePanelProps) {
  return (
    <Card className='border-border/80 shadow-xs'>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-base font-bold'>Relevant Approved Knowledge</CardTitle>
          <Badge variant='outline' className='text-xs'>
            {retrieved.items.length} matched
          </Badge>
        </div>
        <CardDescription className='text-xs'>
          Approved candidate knowledge retrieved specifically for this opportunity based on job
          requirements.
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-3.5 pt-1 text-xs'>
        {/* Missing Requirements Alert (e.g. eBPF, Electron) */}
        {retrieved.missingRequirements.length > 0 && (
          <div className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5'>
            <div className='flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold'>
              <Icons.warning className='h-4 w-4 shrink-0' />
              <span>Unverified / Missing Job Criteria</span>
            </div>
            <p className='text-[11px] text-muted-foreground leading-relaxed'>
              CareerQuest identified required or preferred skills without approved candidate
              evidence. To preserve 100% truthfulness, these will <strong>never</strong> be claimed
              on your tailored resume:
            </p>
            <div className='flex flex-wrap gap-1 pt-1'>
              {retrieved.missingRequirements.map((m) => (
                <Badge
                  key={m.requirementId}
                  variant='secondary'
                  className='text-[10px] bg-background/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-medium'
                >
                  {m.requirementText} (Unsupported)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Retrieved Items List */}
        <div className='space-y-2.5 max-h-[520px] overflow-y-auto pr-1'>
          {retrieved.items.map((item) => (
            <div
              key={item.id}
              className='rounded-lg border border-border/70 bg-card p-3 space-y-1.5 hover:border-primary/40 transition-colors shadow-2xs'
            >
              <div className='flex items-center justify-between gap-1'>
                <div className='flex items-center gap-1.5'>
                  {getCategoryIcon(item.category)}
                  <span className='font-semibold text-foreground text-xs'>{item.title}</span>
                </div>
                <Badge variant='outline' className='text-[9px] capitalize px-1.5 py-0'>
                  {item.category}
                </Badge>
              </div>

              <div className='rounded bg-muted/40 p-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground'>
                <p>
                  <strong className='text-foreground'>Why selected: </strong>
                  {item.relevanceReason}
                </p>
                <p>
                  <strong className='text-foreground'>Targeted: </strong>
                  {item.matchedRequirementText}
                </p>
              </div>

              <div className='flex items-center justify-between pt-0.5 text-[10px] text-muted-foreground'>
                <span className='italic truncate max-w-[200px]'>
                  &ldquo;{item.supportingSnippet}&rdquo;
                </span>
                <Badge variant='secondary' className='text-[9px] shrink-0 font-normal'>
                  {item.provenanceLabel}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
