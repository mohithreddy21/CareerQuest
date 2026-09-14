'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { ApplicationDetail } from '../api/types';
import { updateApplicationFollowUpMutation } from '../api/mutations';
import { applicationKeys } from '../api/queries';
import { toast } from 'sonner';

interface ApplicationFollowUpCardProps {
  application: ApplicationDetail;
}

export function ApplicationFollowUpCard({ application }: ApplicationFollowUpCardProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showEmailDraft, setShowEmailDraft] = useState(false);
  const [copied, setCopied] = useState(false);

  const [date, setDate] = useState(
    () => application.followUpDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [note, setNote] = useState(application.followUpNote || '');

  const followUpMut = useMutation({
    ...updateApplicationFollowUpMutation,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success(`Follow-up updated (${variables.followUpStatus || 'scheduled'}).`);
      setIsEditing(false);
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update follow-up';
      toast.error(msg);
    }
  });

  const handleSnooze = (days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    const dateStr = newDate.toISOString().slice(0, 10);
    setDate(dateStr);
    followUpMut.mutate({
      id: application.id,
      followUpDate: dateStr,
      followUpStatus: 'snoozed',
      followUpNote: `Snoozed for ${days} days until ${dateStr}`
    });
  };

  const handleComplete = () => {
    followUpMut.mutate({
      id: application.id,
      followUpStatus: 'completed',
      followUpNote: note || 'Follow-up completed by candidate'
    });
  };

  const handleSaveCustom = () => {
    followUpMut.mutate({
      id: application.id,
      followUpDate: date,
      followUpStatus: 'pending',
      followUpNote: note
    });
  };

  const primaryContact = application.contacts?.[0];
  const recruiterName = primaryContact?.name || 'Hiring Team';

  const emailDraft = `Hi ${recruiterName},

I hope your week is going well!

I am following up on my application for the ${application.job.title} position at ${application.job.company}, submitted on ${
    application.dateApplied
      ? new Date(application.dateApplied).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      : 'recently'
  }.

I remains exceptionally enthusiastic about ${application.job.company}'s work and how my background aligns with the team's needs. Please let me know if there are any additional details or references I can provide.

Thank you for your time and consideration!

Best regards,
Alex Morgan`;

  const handleCopyDraft = async () => {
    try {
      await navigator.clipboard.writeText(emailDraft);
      setCopied(true);
      toast.success('Follow-up draft copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  const isDueTodayOrOverdue =
    application.followUpDate &&
    application.followUpStatus === 'pending' &&
    new Date(application.followUpDate).getTime() <= new Date().setHours(23, 59, 59, 999);

  return (
    <Card className='border-border/80 shadow-xs'>
      <CardHeader className='pb-3 border-b border-border/60'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <div className='p-1.5 rounded-md bg-primary/10 text-primary'>
              <Icons.notification className='h-4 w-4' />
            </div>
            <div>
              <CardTitle className='text-sm font-semibold'>Follow-Up Action</CardTitle>
              <CardDescription className='text-xs'>
                Keep momentum and stay top of mind with the hiring team
              </CardDescription>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            {application.followUpStatus === 'completed' && (
              <Badge
                variant='outline'
                className='bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-xs gap-1'
              >
                <Icons.check className='h-3 w-3' /> Completed
              </Badge>
            )}
            {application.followUpStatus === 'snoozed' && (
              <Badge
                variant='outline'
                className='bg-amber-500/10 text-amber-700 border-amber-500/20 text-xs gap-1'
              >
                <Icons.clock className='h-3 w-3' /> Snoozed until {application.followUpDate}
              </Badge>
            )}
            {application.followUpStatus === 'pending' && (
              <Badge
                variant='outline'
                className={
                  isDueTodayOrOverdue
                    ? 'bg-rose-500/10 text-rose-700 border-rose-500/20 text-xs gap-1 font-semibold animate-pulse'
                    : 'bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs gap-1'
                }
              >
                <Icons.calendar className='h-3 w-3' />
                {isDueTodayOrOverdue
                  ? `Due Today (${application.followUpDate})`
                  : `Scheduled for ${application.followUpDate}`}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className='p-4 sm:p-5 space-y-4'>
        {/* Status explanation */}
        <div className='text-xs text-muted-foreground flex items-center justify-between'>
          <span>
            {application.followUpStatus === 'completed'
              ? 'Last follow-up was completed. Schedule a new one if next round needs touching base.'
              : isDueTodayOrOverdue
                ? 'Recommended action: Reach out today with a polite status check.'
                : 'Recommended action: Wait until scheduled follow-up date before contacting the team.'}
          </span>
          {application.followUpNote && (
            <span className='italic max-w-xs truncate'>
              &ldquo;{application.followUpNote}&rdquo;
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className='flex flex-wrap items-center gap-2 pt-1'>
          {application.followUpStatus !== 'completed' && (
            <Button
              size='sm'
              variant='default'
              className='text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium'
              disabled={followUpMut.isPending}
              onClick={handleComplete}
            >
              <Icons.check className='h-3.5 w-3.5' />
              Mark Follow-Up Complete
            </Button>
          )}

          <Button
            size='sm'
            variant='outline'
            className='text-xs gap-1.5'
            disabled={followUpMut.isPending}
            onClick={() => handleSnooze(3)}
          >
            <Icons.clock className='h-3.5 w-3.5' />
            Snooze +3 Days
          </Button>

          <Button
            size='sm'
            variant='outline'
            className='text-xs gap-1.5'
            disabled={followUpMut.isPending}
            onClick={() => handleSnooze(7)}
          >
            <Icons.clock className='h-3.5 w-3.5' />
            Snooze +7 Days
          </Button>

          <Button
            size='sm'
            variant='outline'
            className='text-xs gap-1.5'
            onClick={() => setIsEditing(!isEditing)}
          >
            <Icons.edit className='h-3.5 w-3.5' />
            {isEditing ? 'Cancel Edit' : 'Edit Date & Note'}
          </Button>

          <Button
            size='sm'
            variant='secondary'
            className='text-xs gap-1.5 ml-auto'
            onClick={() => setShowEmailDraft(!showEmailDraft)}
          >
            <Icons.post className='h-3.5 w-3.5' />
            {showEmailDraft ? 'Hide Email Draft' : 'View Follow-Up Email Draft'}
          </Button>
        </div>

        {/* Custom Edit Section */}
        {isEditing && (
          <div className='p-4 rounded-lg bg-muted/40 border border-border/70 space-y-3 mt-3'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div>
                <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                  Target Follow-Up Date
                </span>
                <Input
                  type='date'
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className='h-8 text-xs bg-background'
                />
              </div>
              <div>
                <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                  Follow-Up Note / Objective
                </span>
                <Input
                  placeholder='e.g. Check status after technical screen'
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className='h-8 text-xs bg-background'
                />
              </div>
            </div>
            <div className='flex justify-end gap-2 pt-1'>
              <Button
                size='sm'
                variant='ghost'
                className='text-xs h-7'
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size='sm'
                className='text-xs h-7 gap-1 font-semibold'
                disabled={followUpMut.isPending}
                onClick={handleSaveCustom}
              >
                <Icons.check className='h-3.5 w-3.5' />
                Save Follow-Up
              </Button>
            </div>
          </div>
        )}

        {/* Email Draft Section */}
        {showEmailDraft && (
          <div className='p-4 rounded-lg bg-background border border-border/80 shadow-xs space-y-3 mt-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Icons.post className='h-4 w-4 text-primary' />
                <span className='text-xs font-semibold text-foreground'>
                  Draft Follow-up Note for Candidate Review
                </span>
              </div>
              <Badge variant='secondary' className='text-[10px] font-normal'>
                Manual candidate review &bull; Never sent automatically
              </Badge>
            </div>
            <p className='text-[11px] text-muted-foreground'>
              Copy and paste this message into your email client or LinkedIn message to{' '}
              {recruiterName}. Personalize any details as desired.
            </p>
            <div className='relative'>
              <Textarea
                readOnly
                value={emailDraft}
                rows={9}
                className='text-xs font-mono bg-muted/30 leading-relaxed resize-none p-3'
              />
              <Button
                size='sm'
                className='absolute top-2 right-2 text-xs h-7 gap-1 shadow-xs'
                onClick={handleCopyDraft}
              >
                {copied ? (
                  <Icons.check className='h-3.5 w-3.5 text-emerald-500' />
                ) : (
                  <Icons.copy className='h-3.5 w-3.5' />
                )}
                {copied ? 'Copied' : 'Copy Template'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
