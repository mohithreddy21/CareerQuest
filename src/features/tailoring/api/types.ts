import { ResumeChangeStatus, TailoredResumeVersion } from '@/types/tailoring';

export interface GetTailoredResumePayload {
  jobId: string;
  candidateId?: string;
}

export interface UpdateResumeChangeStatusPayload {
  resumeVersionId: string;
  changeId: string;
  status: ResumeChangeStatus;
}

export interface EditResumeChangeContentPayload {
  resumeVersionId: string;
  changeId: string;
  editedContent: string;
}

export interface ApproveAllChangesPayload {
  resumeVersionId: string;
}

export type { TailoredResumeVersion };
