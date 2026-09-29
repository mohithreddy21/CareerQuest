'use server';

import { requireCandidateId } from '@/lib/auth';
import { careerRepository } from '@/services/career-repository';
import { resumeReviewService } from '@/features/tailoring/services/resume-review-service';
import {
  CandidateProfile,
  ResumeVersion,
  UpdateCandidateProfilePayload,
  UpdateResumeChangeStatusPayload
} from './types';

export async function getCandidateProfile(candidateId?: string): Promise<CandidateProfile> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return careerRepository.getCandidateProfile(resolvedId);
}

export async function updateCandidateProfile(
  payload: UpdateCandidateProfilePayload,
  candidateId?: string
): Promise<CandidateProfile> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return careerRepository.updateCandidateProfile(payload.updates, resolvedId);
}

export async function getMasterResume(candidateId?: string): Promise<ResumeVersion | null> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return careerRepository.getMasterResume(resolvedId);
}

export async function getTailoredResumeForJob(
  jobId: string,
  candidateId?: string
): Promise<ResumeVersion | null> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return resumeReviewService.getOrCreateTailoredResume(jobId, resolvedId);
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
