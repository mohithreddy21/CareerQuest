'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { NextAction } from '@/types/application-tracking';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface NextActionsListProps {
  actions: NextAction[];
}

function getCategoryIcon(category: NextAction['category']) {
  switch (category) {
    case 'follow_up_due':
      return <Icons.notification className='h-4 w-4 text-rose-600' />;
    case 'interview_upcoming':
      return <Icons.calendar className='h-4 w-4 text-purple-600' />;
    case 'confirm_applied':
      return <Icons.check className='h-4 w-4 text-emerald-600' />;
    case 'preparation_incomplete':
      return <Icons.edit className='h-4 w-4 text-blue-600' />;
    case 'stale_application':
      return <Icons.clock className='h-4 w-4 text-amber-600' />;
    case 'knowledge_gap':
      return <Icons.info className='h-4 w-4 text-indigo-600' />;
    default:
      return <Icons.chevronRight className='h-4 w-4 text-muted-foreground' />;
  }
}

function getPriorityBadge(priority: NextAction['priority']) {
  switch (priority) {
    case 'high':
      return (
        <Badge
          variant='outline'
          className='bg-rose-500/10 text-rose-700 border-rose-500/20 text-[10px] font-semibold'
        >
          High Priority
        </Badge>
      );
    case 'medium':
      return (
        <Badge
          variant='outline'
          className='bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px] font-medium'
        >
          Medium
        </Badge>
      );
    case 'low':
      return (
        <Badge variant='outline' className='bg-muted text-muted-foreground text-[10px]'>
          Low
        </Badge>
      );
  }
}

export function NextActionsList({ actions }: NextActionsListProps) {
  return (
    <Card className='border-border/80 shadow-xs'>
      <CardHeader className='pb-3 border-b border-border/60'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 rounded-md bg-primary/10 text-primary'>
              <Icons.check className='h-4 w-4' />
            </div>
            <div>
              <CardTitle className='text-sm font-semibold'>
                Today&apos;s Recommended Actions
              </CardTitle>
              <CardDescription className='text-xs'>
                Deterministic next steps derived from active follow-up deadlines and interview dates
              </CardDescription>
            </div>
          </div>
          <Badge variant='secondary' className='text-xs font-mono'>
            {actions.length} Actionable
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='p-4 space-y-3'>
        {actions.length === 0 ? (
          <div className='py-8 text-center border border-dashed border-border/70 rounded-xl space-y-1.5'>
            <Icons.check className='h-7 w-7 text-emerald-500 mx-auto' />
            <p className='text-xs font-semibold text-foreground'>All caught up for today!</p>
            <p className='text-[11px] text-muted-foreground'>
              No follow-ups due or pending preparations require your immediate attention.
            </p>
          </div>
        ) : (
          actions.map((act) => (
            <div
              key={act.id}
              className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-card hover:border-border transition-colors'
            >
              <div className='flex items-start gap-3'>
                <div className='p-2 rounded-lg bg-muted/50 shrink-0 mt-0.5'>
                  {getCategoryIcon(act.category)}
                </div>

                <div className='space-y-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h4 className='text-xs font-semibold text-foreground'>{act.title}</h4>
                    {getPriorityBadge(act.priority)}
                    {act.dueDate && (
                      <span className='text-[10px] font-mono text-muted-foreground'>
                        Due: {act.dueDate.slice(0, 10)}
                      </span>
                    )}
                  </div>
                  <p className='text-xs text-muted-foreground leading-relaxed'>{act.description}</p>
                  <p className='text-[11px] text-muted-foreground/80 italic flex items-center gap-1'>
                    <Icons.info className='h-3 w-3 shrink-0 text-primary/70' />
                    <span>Why: {act.explanation}</span>
                  </p>
                </div>
              </div>

              <div className='shrink-0 self-end sm:self-center pl-10 sm:pl-0'>
                <Link
                  href={act.actionUrl}
                  className={cn(
                    buttonVariants({
                      variant: act.priority === 'high' ? 'default' : 'outline',
                      size: 'sm'
                    }),
                    'text-xs h-7 font-medium'
                  )}
                >
                  {act.actionLabel}
                  <Icons.chevronRight className='ml-1 h-3 w-3' />
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
