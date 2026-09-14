'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { ApplicationDetail, ApplicationEvent } from '../api/types';

interface ApplicationTimelineProps {
  application: ApplicationDetail;
  events?: ApplicationEvent[];
}

function getEventIcon(type: ApplicationEvent['type']) {
  switch (type) {
    case 'applied_confirmed':
      return <Icons.check className='h-3.5 w-3.5 text-emerald-600' />;
    case 'offer_received':
      return <Icons.check className='h-3.5 w-3.5 text-emerald-600' />;
    case 'interview_scheduled':
    case 'interview_completed':
      return <Icons.calendar className='h-3.5 w-3.5 text-purple-600' />;
    case 'follow_up_scheduled':
    case 'follow_up_snoozed':
    case 'follow_up_completed':
      return <Icons.notification className='h-3.5 w-3.5 text-blue-600' />;
    case 'resume_exported':
    case 'resume_tailored':
      return <Icons.fileTypeDoc className='h-3.5 w-3.5 text-indigo-600' />;
    case 'handoff_opened':
      return <Icons.externalLink className='h-3.5 w-3.5 text-amber-600' />;
    case 'rejection_logged':
      return <Icons.close className='h-3.5 w-3.5 text-rose-600' />;
    case 'withdrawn':
      return <Icons.warning className='h-3.5 w-3.5 text-muted-foreground' />;
    case 'note_added':
      return <Icons.post className='h-3.5 w-3.5 text-foreground' />;
    default:
      return <Icons.info className='h-3.5 w-3.5 text-muted-foreground' />;
  }
}

function getEventBadge(event: ApplicationEvent) {
  if (event.isAutomated) {
    return (
      <Badge variant='outline' className='text-[10px] bg-muted/60 text-muted-foreground font-mono'>
        System Event
      </Badge>
    );
  }
  return (
    <Badge
      variant='outline'
      className='text-[10px] bg-primary/10 text-primary border-primary/20 font-medium'
    >
      Candidate Action
    </Badge>
  );
}

export function ApplicationTimeline({ application, events }: ApplicationTimelineProps) {
  // Use passed events or application.events, fallback to statusHistory
  const rawEvents = events || application.events || [];

  // Sort chronologically descending (newest first)
  const sortedEvents = [...rawEvents].toSorted(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Card className='border-border/80 shadow-xs'>
      <CardHeader className='pb-3 border-b border-border/60'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 rounded-md bg-indigo-500/10 text-indigo-600'>
              <Icons.clock className='h-4 w-4' />
            </div>
            <div>
              <CardTitle className='text-sm font-semibold'>Historical Activity Trail</CardTitle>
              <CardDescription className='text-xs'>
                Immutable chronological log of all interactions, decisions, and outcomes
              </CardDescription>
            </div>
          </div>

          <Badge variant='secondary' className='text-xs font-mono'>
            {sortedEvents.length} Recorded Events
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='p-4 sm:p-6'>
        {sortedEvents.length === 0 ? (
          <div className='py-8 text-center border border-dashed border-border/70 rounded-xl space-y-2'>
            <Icons.clock className='h-8 w-8 text-muted-foreground mx-auto opacity-50' />
            <p className='text-xs font-semibold text-foreground'>No activity recorded yet</p>
            <p className='text-[11px] text-muted-foreground max-w-sm mx-auto'>
              Events will be appended here as you tailor resumes, prepare documents, record status
              transitions, and schedule interviews.
            </p>
          </div>
        ) : (
          <div className='relative border-l-2 border-border/60 ml-3 pl-6 space-y-6'>
            {sortedEvents.map((evt) => (
              <div key={evt.id} className='relative group'>
                {/* Timeline node dot */}
                <div className='absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 border-border group-hover:border-primary transition-colors shadow-xs'>
                  {getEventIcon(evt.type)}
                </div>

                <div className='space-y-1 rounded-xl p-3 bg-muted/20 border border-border/50 group-hover:border-border/80 transition-colors'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='flex items-center gap-2'>
                      <h4 className='text-xs font-semibold text-foreground'>{evt.title}</h4>
                      {getEventBadge(evt)}
                    </div>
                    <time className='text-[11px] font-mono text-muted-foreground'>
                      {new Date(evt.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </time>
                  </div>

                  <p className='text-xs text-muted-foreground leading-relaxed'>{evt.description}</p>

                  {/* Optional metadata pills */}
                  {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                    <div className='pt-1.5 flex flex-wrap items-center gap-1.5'>
                      {Object.entries(evt.metadata).map(([key, value]) => {
                        if (typeof value === 'object' || value === undefined) return null;
                        return (
                          <span
                            key={key}
                            className='inline-flex items-center text-[10px] font-mono bg-background border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground'
                          >
                            <span className='font-semibold text-foreground mr-1'>{key}:</span>
                            {String(value)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
