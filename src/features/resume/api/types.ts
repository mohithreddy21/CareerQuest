import { CandidateProfile, ResumeChange, ResumeChangeStatus, ResumeVersion } from '@/types/domain';

export type { CandidateProfile, ResumeChange, ResumeChangeStatus, ResumeVersion };

export interface UpdateCandidateProfilePayload {
  updates: Partial<CandidateProfile>;
}

export interface UpdateResumeChangeStatusPayload {
  resumeVersionId: string;
  changeId: string;
  status: ResumeChangeStatus;
}

export interface ApproveAllResumeChangesPayload {
  resumeVersionId: string;
}
