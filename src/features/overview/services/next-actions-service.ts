import { ApplicationWithJob } from '@/features/applications/api/types';
import { ApplicationEvent, NextAction } from '@/types/application-tracking';

export const NEXT_ACTION_THRESHOLDS = {
  STALE_APPLICATION_DAYS: 14,
  UPCOMING_INTERVIEW_WINDOW_DAYS: 7,
  PREPARATION_STALE_DAYS: 2
};

export const NextActionsService = {
  computeNextActions(
    applications: ApplicationWithJob[],
    events: ApplicationEvent[] = []
  ): NextAction[] {
    const actions: NextAction[] = [];
    const now = new Date();
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    ).getTime();

    // Track which apps already have high priority actions to prevent flooding
    const seenAppIds = new Set<string>();

    for (const app of applications) {
      // Rule 1: Follow-up due today or overdue
      if (app.status === 'applied' && app.followUpDate && app.followUpStatus === 'pending') {
        const isDue = new Date(app.followUpDate).getTime() <= endOfToday;
        if (isDue) {
          actions.push({
            id: `act-followup-${app.id}`,
            applicationId: app.id,
            jobId: app.jobId,
            category: 'follow_up_due',
            priority: 'high',
            title: `Follow up with ${app.job.company}`,
            description: `Scheduled follow-up date (${app.followUpDate}) has arrived for ${app.job.title}.`,
            explanation:
              'A polite check-in 7–10 days after applying demonstrates active interest and keeps your candidacy visible.',
            actionLabel: 'Review & Follow Up',
            actionUrl: `/dashboard/applications/${app.id}`,
            dueDate: app.followUpDate
          });
          seenAppIds.add(app.id);
        }
      }

      // Rule 2: Upcoming scheduled interview round
      if (app.interviewStages && app.interviewStages.length > 0) {
        const upcomingStage = app.interviewStages.find((s) => {
          if (s.status !== 'scheduled' || !s.scheduledDate) return false;
          const stageDate = new Date(s.scheduledDate).getTime();
          const diffDays = (stageDate - now.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= NEXT_ACTION_THRESHOLDS.UPCOMING_INTERVIEW_WINDOW_DAYS;
        });

        if (upcomingStage) {
          actions.push({
            id: `act-interview-${app.id}-${upcomingStage.id}`,
            applicationId: app.id,
            jobId: app.jobId,
            category: 'interview_upcoming',
            priority: 'high',
            title: `Upcoming: ${upcomingStage.stageName} at ${app.job.company}`,
            description: `Scheduled for ${
              upcomingStage.scheduledDate
                ? new Date(upcomingStage.scheduledDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })
                : 'soon'
            }. Review role requirements and prep notes.`,
            explanation:
              'Reviewing grounded resume points and company tech stack ahead of time maximizes interview confidence.',
            actionLabel: 'Prepare Interview Notes',
            actionUrl: `/dashboard/applications/${app.id}`,
            dueDate: upcomingStage.scheduledDate
          });
          seenAppIds.add(app.id);
        }
      }

      // Rule 3: External handoff opened but applied not confirmed
      const hasHandoff = events.some(
        (e) => e.applicationId === app.id && e.type === 'handoff_opened'
      );
      if (app.status === 'preparing' && hasHandoff) {
        actions.push({
          id: `act-confirm-${app.id}`,
          applicationId: app.id,
          jobId: app.jobId,
          category: 'confirm_applied',
          priority: 'high',
          title: `Confirm submission for ${app.job.company}`,
          description: `You opened ${app.job.company}'s career portal. Mark as applied once submission is complete.`,
          explanation:
            'Confirming your application captures an immutable snapshot of your tailored resume and initiates the tracking timer.',
          actionLabel: 'Confirm Applied',
          actionUrl: `/dashboard/applications/${app.id}`
        });
        seenAppIds.add(app.id);
      }

      // Rule 4: Preparation incomplete (in preparing status with work started)
      if (app.status === 'preparing' && !seenAppIds.has(app.id)) {
        actions.push({
          id: `act-prep-${app.id}`,
          applicationId: app.id,
          jobId: app.jobId,
          category: 'preparation_incomplete',
          priority: 'medium',
          title: `Finish application materials for ${app.job.company}`,
          description: `Resume tailored for ${app.job.title}. Finalize review, cover letter, and export documents.`,
          explanation:
            'Completing application materials while target requirements are fresh ensures consistent, grounded positioning.',
          actionLabel: 'Continue Preparation',
          actionUrl: `/dashboard/applications/${app.id}`
        });
        seenAppIds.add(app.id);
      }

      // Rule 5: Stale application (> 14 days with no interview or follow-up)
      if (app.status === 'applied' && app.dateApplied && !seenAppIds.has(app.id)) {
        const daysSinceApplied =
          (now.getTime() - new Date(app.dateApplied).getTime()) / (1000 * 60 * 60 * 24);

        if (
          daysSinceApplied >= NEXT_ACTION_THRESHOLDS.STALE_APPLICATION_DAYS &&
          (!app.followUpDate || app.followUpStatus === 'completed')
        ) {
          actions.push({
            id: `act-stale-${app.id}`,
            applicationId: app.id,
            jobId: app.jobId,
            category: 'stale_application',
            priority: 'low',
            title: `Check on status for ${app.job.company}`,
            description: `Applied ${Math.round(daysSinceApplied)} days ago with no recent updates.`,
            explanation:
              'Applications over two weeks old can be checked with a brief follow-up note or updated if closed.',
            actionLabel: 'View Application',
            actionUrl: `/dashboard/applications/${app.id}`
          });
        }
      }
    }

    // Rule 6: Candidate Knowledge Bank check (General recommendation)
    actions.push({
      id: 'act-knowledge-bank',
      category: 'knowledge_gap',
      priority: 'low',
      title: 'Maintain verified Knowledge Bank evidence',
      description:
        'Keep your approved skills and project metrics current as you complete new work.',
      explanation:
        'CareerQuest grounds all tailored resumes in your verified facts. Adding new achievements unlocks higher match scores.',
      actionLabel: 'Review Knowledge Bank',
      actionUrl: '/dashboard/resume'
    });

    // Sort by priority: high -> medium -> low
    const priorityWeight: Record<NextAction['priority'], number> = {
      high: 3,
      medium: 2,
      low: 1
    };

    return actions.toSorted((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
  }
};
