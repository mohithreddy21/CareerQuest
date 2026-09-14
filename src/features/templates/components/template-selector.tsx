import React from 'react';
import { ResumeTemplateId } from '@/types/templates';
import { RESUME_TEMPLATE_LIST } from '../constants/templates';
import { Badge } from '@/components/ui/badge';

import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface TemplateSelectorProps {
  selectedTemplateId: ResumeTemplateId;
  onSelectTemplate: (templateId: ResumeTemplateId) => void;
  className?: string;
}

export function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
  className
}: TemplateSelectorProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-xs font-bold uppercase tracking-wider text-foreground'>
            Select Resume Template
          </h3>
          <p className='text-[11px] text-muted-foreground'>
            Choose presentation style. Instant switch &mdash; does not re-tailor or alter approved
            content.
          </p>
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        {RESUME_TEMPLATE_LIST.map((tpl) => {
          const isSelected = tpl.id === selectedTemplateId;

          return (
            <button
              key={tpl.id}
              type='button'
              onClick={() => onSelectTemplate(tpl.id)}
              className={cn(
                'group relative text-left rounded-lg border p-3 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary'
                  : 'border-border/70 bg-card hover:border-border hover:bg-accent/30'
              )}
              aria-pressed={isSelected}
            >
              {/* Top Bar with Name and Check */}
              <div className='flex items-center justify-between gap-1 mb-1'>
                <span className='font-bold text-xs text-foreground group-hover:text-primary transition-colors'>
                  {tpl.name}
                </span>
                {isSelected ? (
                  <span className='inline-flex items-center rounded-full bg-primary p-0.5 text-primary-foreground'>
                    <Icons.check className='h-3 w-3' />
                  </span>
                ) : (
                  <span className='text-[10px] font-mono text-muted-foreground'>
                    v{tpl.version}
                  </span>
                )}
              </div>

              {/* Tagline Badge */}
              <Badge
                variant={isSelected ? 'default' : 'secondary'}
                className='text-[9.5px] px-1.5 py-0 mb-1.5'
              >
                {tpl.tagline}
              </Badge>

              {/* Description */}
              <p className='text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2'>
                {tpl.description}
              </p>

              {/* Miniature Layout Visualizer */}
              <div
                className={cn(
                  'rounded border border-border/40 p-2 space-y-1 bg-background/50 text-[8px]',
                  tpl.id === 'classic-v1' && 'font-serif text-center',
                  tpl.id === 'modern-v1' && 'font-sans text-left border-l-2 border-l-primary',
                  tpl.id === 'compact-v1' && 'font-sans text-left space-y-0.5'
                )}
              >
                <div
                  className={cn(
                    'h-1.5 w-1/3 bg-foreground/40 rounded-xs',
                    tpl.id === 'classic-v1' ? 'mx-auto' : ''
                  )}
                />
                <div
                  className={cn(
                    'h-1 w-1/2 bg-muted-foreground/30 rounded-xs',
                    tpl.id === 'classic-v1' ? 'mx-auto' : ''
                  )}
                />
                <div className='h-[1px] w-full bg-border/80 my-1' />
                <div className='h-1 w-full bg-foreground/20 rounded-xs' />
                <div className='h-1 w-4/5 bg-foreground/15 rounded-xs' />
              </div>

              {/* Best for Footer */}
              <p className='text-[9.5px] text-muted-foreground/80 mt-2 line-clamp-1'>
                <span className='font-medium text-foreground/70'>Best: </span>
                {tpl.bestFor}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
