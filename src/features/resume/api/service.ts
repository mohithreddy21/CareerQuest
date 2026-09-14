import { careerRepository } from '@/services/career-repository';
import { resumeReviewService } from '@/features/tailoring/services/resume-review-service';
import {
  CandidateProfile,
  ResumeVersion,
  UpdateCandidateProfilePayload,
  UpdateResumeChangeStatusPayload
} from './types';

export async function getCandidateProfile(candidateId?: string): Promise<CandidateProfile> {
  return careerRepository.getCandidateProfile(candidateId);
}

export async function updateCandidateProfile(
  payload: UpdateCandidateProfilePayload,
  candidateId?: string
): Promise<CandidateProfile> {
  return careerRepository.updateCandidateProfile(payload.updates, candidateId);
}

export async function getMasterResume(candidateId?: string): Promise<ResumeVersion | null> {
  return careerRepository.getMasterResume(candidateId);
}

export async function getTailoredResumeForJob(
  jobId: string,
  candidateId?: string
): Promise<ResumeVersion | null> {
  return resumeReviewService.getOrCreateTailoredResume(jobId, candidateId);
}

export async function updateResumeChangeStatus(
  payload: UpdateResumeChangeStatusPayload,
  candidateId?: string
): Promise<ResumeVersion> {
  return resumeReviewService.updateChangeStatus(
    payload.resumeVersionId,
    payload.changeId,
    payload.status,
    candidateId
  );
}

export async function editResumeChangeContent(
  payload: {
    resumeVersionId: string;
    changeId: string;
    editedContent: string;
  },
  candidateId?: string
): Promise<ResumeVersion> {
  return resumeReviewService.editChangeContent(
    payload.resumeVersionId,
    payload.changeId,
    payload.editedContent,
    candidateId
  );
}

export async function approveAllResumeChanges(
  resumeVersionId: string,
  candidateId?: string
): Promise<ResumeVersion> {
  return resumeReviewService.approveAllPendingChanges(resumeVersionId, candidateId);
}
