import {
  Application,
  ApplicationStatus,
  Job,
  JobAnalysis,
  JobMatch,
  ResumeVersion
} from '@/types/domain';
import {
  ApplicationContact,
  ApplicationEvent,
  FollowUpStatus,
  InterviewOutcome,
  InterviewStage,
  InterviewStatus
} from '@/types/application-tracking';

export type {
  Application,
  ApplicationStatus,
  ApplicationContact,
  ApplicationEvent,
  FollowUpStatus,
  InterviewStage,
  InterviewStatus,
  InterviewOutcome
};

export interface ApplicationWithJob extends Application {
  job: Job;
}

export interface ApplicationDetail extends Application {
  job: Job;
  analysis?: JobAnalysis | null;
  match?: JobMatch | null;
  resume?: ResumeVersion | null;
  events?: ApplicationEvent[];
}

export interface UpdateApplicationStatusPayload {
  id: string;
  status: ApplicationStatus;
  note?: string;
  expectedVersion?: number;
}

export interface CreateApplicationPayload {
  jobId: string;
  initialStatus?: ApplicationStatus;
}

export interface UpdateApplicationNotesPayload {
  id: string;
  notes: string;
  expectedVersion?: number;
}

export interface UpdateApplicationFollowUpPayload {
  id: string;
  followUpDate?: string;
  followUpStatus?: FollowUpStatus;
  followUpNote?: string;
  expectedVersion?: number;
}

export interface AddInterviewStagePayload {
  applicationId: string;
  stage: Omit<InterviewStage, 'id'>;
}

export interface UpdateInterviewStagePayload {
  applicationId: string;
  stage: InterviewStage;
}

export interface DeleteInterviewStagePayload {
  applicationId: string;
  stageId: string;
}

export interface AddApplicationContactPayload {
  applicationId: string;
  contact: Omit<ApplicationContact, 'id' | 'createdAt'>;
}

export interface UpdateApplicationContactPayload {
  applicationId: string;
  contactId: string;
  updates: Partial<ApplicationContact>;
}

export interface DeleteApplicationContactPayload {
  applicationId: string;
  contactId: string;
}

export interface UpdateApplicationArchivePayload {
  id: string;
  isArchived: boolean;
  expectedVersion?: number;
}
