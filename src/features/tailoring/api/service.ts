'use server';

import { requireCandidateId } from '@/lib/auth';
import { knowledgeRetrievalService } from '../services/knowledge-retrieval-service';
import { resumeReviewService } from '../services/resume-review-service';
import { RetrievedCandidateKnowledge, TailoredResumeVersion } from '@/types/tailoring';
import {
  UpdateResumeChangeStatusPayload,
  EditResumeChangeContentPayload,
  ApproveAllChangesPayload
} from './types';

export async function getRetrievedKnowledgeForJob(
  jobId: string,
  candidateId?: string
): Promise<RetrievedCandidateKnowledge> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return knowledgeRetrievalService.retrieveKnowledgeForJob(jobId, resolvedId);
}

export async function getTailoredResumeForJob(
  jobId: string,
  candidateId?: string
): Promise<TailoredResumeVersion> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return resumeReviewService.getOrCreateTailoredResume(jobId, resolvedId);
}

export async function updateResumeChangeStatus(
  payload: UpdateResumeChangeStatusPayload,
  candidateId?: string
): Promise<TailoredResumeVersion> {
  return resumeReviewService.updateChangeStatus(
    payload.resumeVersionId,
    payload.changeId,
    payload.status,
    candidateId
  );
}

export async function editResumeChangeContent(
  payload: EditResumeChangeContentPayload,
  candidateId?: string
): Promise<TailoredResumeVersion> {
  return resumeReviewService.editChangeContent(
    payload.resumeVersionId,
    payload.changeId,
    payload.editedContent,
    candidateId
  );
}

export async function approveAllResumeChanges(
  payload: ApproveAllChangesPayload,
  candidateId?: string
): Promise<TailoredResumeVersion> {
  return resumeReviewService.approveAllPendingChanges(payload.resumeVersionId, candidateId);
}
