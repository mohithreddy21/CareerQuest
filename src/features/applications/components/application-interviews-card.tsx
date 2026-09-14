'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { ApplicationDetail, InterviewOutcome, InterviewStage, InterviewStatus } from '../api/types';
import {
  addApplicationContactMutation,
  addInterviewStageMutation,
  updateInterviewStageMutation
} from '../api/mutations';
import { applicationKeys } from '../api/queries';
import { toast } from 'sonner';

interface ApplicationInterviewsCardProps {
  application: ApplicationDetail;
}

export function ApplicationInterviewsCard({ application }: ApplicationInterviewsCardProps) {
  const queryClient = useQueryClient();

  // Dialog / form state
  const [showAddStage, setShowAddStage] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  // New stage form
  const [stageName, setStageName] = useState('Technical Interview');
  const [scheduledDate, setScheduledDate] = useState(() =>
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16)
  );
  const [interviewerNames, setInterviewerNames] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [stageNotes, setStageNotes] = useState('');

  // New contact form
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('Recruiter');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactLinkedIn, setContactLinkedIn] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  // Mutations
  const addStageMut = useMutation({
    ...addInterviewStageMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success('Interview round added.');
      setShowAddStage(false);
      resetStageForm();
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to add interview stage';
      toast.error(msg);
    }
  });

  const updateStageMut = useMutation({
    ...updateInterviewStageMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success('Interview status updated.');
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to update interview stage';
      toast.error(msg);
    }
  });

  const addContactMut = useMutation({
    ...addApplicationContactMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      toast.success('Contact added.');
      setShowAddContact(false);
      resetContactForm();
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to add contact';
      toast.error(msg);
    }
  });

  const resetStageForm = () => {
    setStageName('Technical Interview');
    setScheduledDate(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16));
    setInterviewerNames('');
    setMeetingLink('');
    setStageNotes('');
  };

  const resetContactForm = () => {
    setContactName('');
    setContactRole('Recruiter');
    setContactEmail('');
    setContactPhone('');
    setContactLinkedIn('');
    setContactNotes('');
  };

  const handleAddStage = () => {
    if (!stageName.trim()) {
      toast.error('Please enter a stage name.');
      return;
    }
    addStageMut.mutate({
      applicationId: application.id,
      stage: {
        stageName,
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
        interviewerNames: interviewerNames
          ? interviewerNames.split(',').map((s) => s.trim())
          : undefined,
        meetingLink: meetingLink.trim() || undefined,
        notes: stageNotes.trim() || undefined,
        status: 'scheduled',
        outcome: 'pending'
      }
    });
  };

  const handleUpdateStageStatus = (
    stage: InterviewStage,
    status: InterviewStatus,
    outcome?: InterviewOutcome
  ) => {
    updateStageMut.mutate({
      applicationId: application.id,
      stage: {
        ...stage,
        status,
        outcome: outcome || stage.outcome,
        completedDate: status === 'completed' ? new Date().toISOString() : stage.completedDate
      }
    });
  };

  const handleAddContact = () => {
    if (!contactName.trim()) {
      toast.error('Please enter the contact name.');
      return;
    }
    addContactMut.mutate({
      applicationId: application.id,
      contact: {
        name: contactName.trim(),
        role: contactRole.trim(),
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        linkedInUrl: contactLinkedIn.trim() || undefined,
        notes: contactNotes.trim() || undefined
      }
    });
  };

  const stages = application.interviewStages || [];
  const contacts = application.contacts || [];

  return (
    <div className='space-y-6'>
      {/* 1. Interview Rounds Section */}
      <Card className='border-border/80 shadow-xs'>
        <CardHeader className='pb-3 border-b border-border/60'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 rounded-md bg-purple-500/10 text-purple-600'>
                <Icons.calendar className='h-4 w-4' />
              </div>
              <div>
                <CardTitle className='text-sm font-semibold'>Interview Rounds & Process</CardTitle>
                <CardDescription className='text-xs'>
                  Keep track of interview stages, outcomes, notes, and meeting links
                </CardDescription>
              </div>
            </div>

            <Button
              size='sm'
              variant='outline'
              className='text-xs gap-1.5'
              onClick={() => setShowAddStage(!showAddStage)}
            >
              <Icons.add className='h-3.5 w-3.5' />
              {showAddStage ? 'Cancel' : 'Schedule Round'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className='p-4 sm:p-5 space-y-4'>
          {/* Add Stage Form */}
          {showAddStage && (
            <div className='p-4 rounded-xl bg-muted/40 border border-border/80 space-y-3 mb-4'>
              <span className='text-xs font-semibold text-foreground flex items-center gap-1.5'>
                <Icons.calendar className='h-3.5 w-3.5 text-primary' /> Schedule New Interview Round
              </span>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                    Stage Name *
                  </span>
                  <Input
                    placeholder='e.g. Technical Round 1, System Design, Hiring Manager'
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    className='h-8 text-xs bg-background'
                  />
                </div>
                <div>
                  <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                    Date & Time
                  </span>
                  <Input
                    type='datetime-local'
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className='h-8 text-xs bg-background'
                  />
                </div>
                <div>
                  <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                    Interviewers (Comma separated)
                  </span>
                  <Input
                    placeholder='e.g. Sarah Lin (Staff Eng), David Kim (EM)'
                    value={interviewerNames}
                    onChange={(e) => setInterviewerNames(e.target.value)}
                    className='h-8 text-xs bg-background'
                  />
                </div>
                <div>
                  <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                    Meeting / Video Link
                  </span>
                  <Input
                    placeholder='https://meet.google.com/xyz or Zoom URL'
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    className='h-8 text-xs bg-background'
                  />
                </div>
              </div>

              <div>
                <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                  Preparation Notes / Focus Areas
                </span>
                <Textarea
                  placeholder='Key topics, questions to ask, behavioral examples prepared...'
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  rows={2}
                  className='text-xs bg-background resize-none'
                />
              </div>

              <div className='flex justify-end gap-2 pt-1'>
                <Button
                  size='sm'
                  variant='ghost'
                  className='text-xs h-7'
                  onClick={() => setShowAddStage(false)}
                >
                  Cancel
                </Button>
                <Button
                  size='sm'
                  className='text-xs h-7 gap-1 font-semibold'
                  disabled={addStageMut.isPending}
                  onClick={handleAddStage}
                >
                  <Icons.check className='h-3.5 w-3.5' /> Save Round
                </Button>
              </div>
            </div>
          )}

          {/* Stages List */}
          {stages.length === 0 ? (
            <div className='py-8 text-center border border-dashed border-border/70 rounded-xl'>
              <Icons.calendar className='h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50' />
              <p className='text-xs font-semibold text-foreground'>
                No interview rounds logged yet
              </p>
              <p className='text-[11px] text-muted-foreground max-w-sm mx-auto mt-1'>
                When {application.job.company} reaches out for a screen or interview, schedule the
                round here to track your progress and prep notes.
              </p>
            </div>
          ) : (
            <div className='space-y-3'>
              {stages.map((stage, idx) => {
                const isScheduled = stage.status === 'scheduled';
                const isCompleted = stage.status === 'completed';
                const isCancelled = stage.status === 'cancelled';

                return (
                  <div
                    key={stage.id}
                    className='p-4 rounded-xl border border-border/70 bg-card hover:border-border transition-colors space-y-3'
                  >
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div className='flex items-center gap-2'>
                        <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs'>
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className='font-semibold text-xs text-foreground flex items-center gap-2'>
                            {stage.stageName}
                            {isScheduled && (
                              <Badge
                                variant='outline'
                                className='bg-blue-500/10 text-blue-700 border-blue-500/20 text-[10px]'
                              >
                                Scheduled
                              </Badge>
                            )}
                            {isCompleted && (
                              <Badge
                                variant='outline'
                                className={
                                  stage.outcome === 'passed'
                                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]'
                                    : stage.outcome === 'failed'
                                      ? 'bg-rose-500/10 text-rose-700 border-rose-500/20 text-[10px]'
                                      : 'bg-muted text-muted-foreground text-[10px]'
                                }
                              >
                                Completed {stage.outcome ? `(${stage.outcome})` : ''}
                              </Badge>
                            )}
                            {isCancelled && (
                              <Badge
                                variant='outline'
                                className='bg-muted text-muted-foreground text-[10px]'
                              >
                                Cancelled
                              </Badge>
                            )}
                          </h4>
                          {stage.scheduledDate && (
                            <p className='text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5'>
                              <Icons.clock className='h-3 w-3' />
                              {new Date(stage.scheduledDate).toLocaleString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quick stage transition buttons */}
                      <div className='flex items-center gap-1.5'>
                        {isScheduled && (
                          <>
                            <Button
                              size='sm'
                              variant='outline'
                              className='text-[11px] h-7 gap-1 text-emerald-600 hover:text-emerald-700'
                              onClick={() => handleUpdateStageStatus(stage, 'completed', 'passed')}
                            >
                              <Icons.check className='h-3 w-3' /> Passed
                            </Button>
                            <Button
                              size='sm'
                              variant='outline'
                              className='text-[11px] h-7 gap-1 text-muted-foreground'
                              onClick={() =>
                                handleUpdateStageStatus(stage, 'completed', 'inconclusive')
                              }
                            >
                              Completed
                            </Button>
                            <Button
                              size='sm'
                              variant='ghost'
                              className='text-[11px] h-7 text-destructive'
                              onClick={() => handleUpdateStageStatus(stage, 'cancelled')}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Interviewer details & Meeting Link */}
                    <div className='flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/40'>
                      {stage.interviewerNames && stage.interviewerNames.length > 0 && (
                        <div className='flex items-center gap-1.5'>
                          <Icons.user className='h-3.5 w-3.5' />
                          <span>{stage.interviewerNames.join(', ')}</span>
                        </div>
                      )}
                      {stage.meetingLink && (
                        <a
                          href={stage.meetingLink}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='flex items-center gap-1 text-primary hover:underline font-medium'
                        >
                          <Icons.externalLink className='h-3.5 w-3.5' />
                          <span>Join Meeting Video Call</span>
                        </a>
                      )}
                    </div>

                    {stage.notes && (
                      <p className='text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/40'>
                        {stage.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Recruiter & Team Contacts Section */}
      <Card className='border-border/80 shadow-xs'>
        <CardHeader className='pb-3 border-b border-border/60'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
              <div className='p-1.5 rounded-md bg-blue-500/10 text-blue-600'>
                <Icons.user className='h-4 w-4' />
              </div>
              <div>
                <CardTitle className='text-sm font-semibold'>Recruiters & Contacts</CardTitle>
                <CardDescription className='text-xs'>
                  Direct contacts at {application.job.company} for this opportunity
                </CardDescription>
              </div>
            </div>

            <Button
              size='sm'
              variant='outline'
              className='text-xs gap-1.5'
              onClick={() => setShowAddContact(!showAddContact)}
            >
              <Icons.add className='h-3.5 w-3.5' />
              {showAddContact ? 'Cancel' : 'Add Contact'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className='p-4 sm:p-5 space-y-4'>
          {showAddContact && (
            <div className='p-4 rounded-xl bg-muted/40 border border-border/80 space-y-3 mb-4'>
              <span className='text-xs font-semibold text-foreground flex items-center gap-1.5'>
                <Icons.user className='h-3.5 w-3.5 text-primary' /> Add New Contact
              </span>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                    Name *
                  </span>
                  <Input
                    placeholder='e.g. Jessica Chen'
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className='h-8 text-xs bg-background'
                  />
                </div>
                <div>
                  <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                    Role / Title
                  </span>
                  <Input
                    placeholder='e.g. Senior Tech Recruiter, Hiring Manager'
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                    className='h-8 text-xs bg-background'
                  />
                </div>
                <div>
                  <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                    Email
                  </span>
                  <Input
                    placeholder='jessica@company.com'
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className='h-8 text-xs bg-background'
                  />
                </div>
                <div>
                  <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                    LinkedIn / Phone
                  </span>
                  <Input
                    placeholder='https://linkedin.com/in/... or phone #'
                    value={contactLinkedIn}
                    onChange={(e) => setContactLinkedIn(e.target.value)}
                    className='h-8 text-xs bg-background'
                  />
                </div>
              </div>

              <div>
                <span className='text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1'>
                  Notes
                </span>
                <Input
                  placeholder='Met via referral, contacted on LinkedIn, etc.'
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  className='h-8 text-xs bg-background'
                />
              </div>

              <div className='flex justify-end gap-2 pt-1'>
                <Button
                  size='sm'
                  variant='ghost'
                  className='text-xs h-7'
                  onClick={() => setShowAddContact(false)}
                >
                  Cancel
                </Button>
                <Button
                  size='sm'
                  className='text-xs h-7 gap-1 font-semibold'
                  disabled={addContactMut.isPending}
                  onClick={handleAddContact}
                >
                  <Icons.check className='h-3.5 w-3.5' /> Save Contact
                </Button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <div className='py-6 text-center border border-dashed border-border/70 rounded-xl'>
              <Icons.user className='h-7 w-7 text-muted-foreground mx-auto mb-1 opacity-50' />
              <p className='text-xs text-muted-foreground'>No direct contacts saved yet</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className='p-3.5 rounded-xl border border-border/70 bg-card space-y-2'
                >
                  <div className='flex items-start justify-between'>
                    <div>
                      <h4 className='font-semibold text-xs text-foreground'>{c.name}</h4>
                      <p className='text-[11px] text-muted-foreground'>{c.role}</p>
                    </div>
                  </div>

                  <div className='space-y-1 text-[11px] text-muted-foreground pt-1 border-t border-border/40'>
                    {c.email && (
                      <div className='flex items-center gap-1.5'>
                        <Icons.post className='h-3 w-3' />
                        <a href={`mailto:${c.email}`} className='hover:underline text-foreground'>
                          {c.email}
                        </a>
                      </div>
                    )}
                    {c.linkedInUrl && (
                      <div className='flex items-center gap-1.5'>
                        <Icons.externalLink className='h-3 w-3' />
                        <a
                          href={
                            c.linkedInUrl.startsWith('http')
                              ? c.linkedInUrl
                              : `https://${c.linkedInUrl}`
                          }
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-primary hover:underline'
                        >
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                    {c.notes && (
                      <p className='italic text-muted-foreground pt-0.5'>&ldquo;{c.notes}&rdquo;</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
