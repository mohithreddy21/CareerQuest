'use client';

import { KnowledgeProvenance } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';

export interface ProvenancePopoverProps {
  provenance: KnowledgeProvenance[];
  itemTitle: string;
}

function getSourceBadge(type: KnowledgeProvenance['sourceType']) {
  switch (type) {
    case 'manual_entry':
      return (
        <Badge
          variant='outline'
          className='text-[10px] bg-blue-50/50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
        >
          Manual Entry
        </Badge>
      );
    case 'resume_upload':
      return (
        <Badge
          variant='outline'
          className='text-[10px] bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
        >
          Resume Document
        </Badge>
      );
    case 'profile_migration':
      return (
        <Badge
          variant='outline'
          className='text-[10px] bg-purple-50/50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
        >
          Verified Baseline
        </Badge>
      );
    default:
      return (
        <Badge variant='secondary' className='text-[10px]'>
          External Import
        </Badge>
      );
  }
}

export function ProvenancePopover({ provenance, itemTitle }: ProvenancePopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            size='sm'
            className='h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1'
          >
            <Icons.badgeCheck className='h-3 w-3 text-primary' />
            <span>
              {provenance.length} {provenance.length === 1 ? 'source' : 'sources'}
            </span>
          </Button>
        }
      />
      <PopoverContent align='end' className='w-80 p-3 space-y-2.5 text-xs shadow-md'>
        <div className='flex items-center justify-between border-b border-border/60 pb-2'>
          <span className='font-semibold text-foreground text-xs'>Provenance History</span>
          <span className='text-[10px] text-muted-foreground truncate max-w-[140px]'>
            {itemTitle}
          </span>
        </div>

        <div className='space-y-2 max-h-60 overflow-y-auto pr-1'>
          {provenance.map((prov) => (
            <div
              key={prov.id}
              className='rounded-md border border-border/50 bg-muted/20 p-2 space-y-1.5'
            >
              <div className='flex items-center justify-between gap-1.5'>
                {getSourceBadge(prov.sourceType)}
                <span className='text-[10px] text-muted-foreground'>
                  {new Date(prov.addedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <p className='font-medium text-foreground text-[11px] leading-tight'>
                {prov.sourceLabel}
              </p>
              {prov.extractedSnippet && (
                <div className='rounded bg-background/90 p-1.5 italic text-[11px] text-muted-foreground border border-border/40'>
                  &ldquo;{prov.extractedSnippet}&rdquo;
                </div>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
