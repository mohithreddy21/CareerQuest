'use server';

import { requireCandidateId } from '@/lib/auth';
import { handleActionError, serializeActionResponse } from '@/lib/action-utils';
import {
  updateCandidateProfileSchema,
  updateResumeChangeStatusSchema,
  editResumeChangeContentSchema,
  approveAllResumeChangesSchema
} from './schemas';
import {
  updateCandidateProfile,
  updateResumeChangeStatus,
  editResumeChangeContent,
  approveAllResumeChanges
} from './service';
import {
  CandidateProfile,
  ResumeVersion,
  UpdateCandidateProfilePayload,
  UpdateResumeChangeStatusPayload,
  ApproveAllResumeChangesPayload
} from './types';

export async function updateCandidateProfileAction(
  payload: UpdateCandidateProfilePayload
): Promise<CandidateProfile> {
  try {
    const validated = updateCandidateProfileSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateCandidateProfile(
      validated as UpdateCandidateProfilePayload,
      candidateId
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateResumeChangeStatusAction(
  payload: UpdateResumeChangeStatusPayload
): Promise<ResumeVersion> {
  try {
    const validated = updateResumeChangeStatusSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateResumeChangeStatus(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function editResumeChangeContentAction(payload: {
  resumeVersionId: string;
  changeId: string;
  editedContent: string;
}): Promise<ResumeVersion> {
  try {
    const validated = editResumeChangeContentSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await editResumeChangeContent(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function approveAllResumeChangesAction(
  payload: ApproveAllResumeChangesPayload
): Promise<ResumeVersion> {
  try {
    const validated = approveAllResumeChangesSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await approveAllResumeChanges(validated.resumeVersionId, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}
