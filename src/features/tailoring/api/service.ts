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
  candidateId: string = 'cand-1'
): Promise<RetrievedCandidateKnowledge> {
  return knowledgeRetrievalService.retrieveKnowledgeForJob(jobId, candidateId);
}

export async function getTailoredResumeForJob(
  jobId: string,
  candidateId: string = 'cand-1'
): Promise<TailoredResumeVersion> {
  return resumeReviewService.getOrCreateTailoredResume(jobId, candidateId);
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
