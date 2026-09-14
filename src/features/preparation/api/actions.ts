'use server';

import { requireCandidateId } from '@/lib/auth';
import { handleActionError, serializeActionResponse } from '@/lib/action-utils';
import {
  confirmAppliedSchema,
  updateCoverLetterSchema,
  updateQuestionSchema,
  updateTemplateSchema,
  recordExportSchema
} from './schemas';
import {
  confirmApplicationSubmission,
  updateCoverLetterDraft,
  updateQuestionAnswer,
  updateApplicationTemplateSelection,
  recordResumeExportEvent
} from './service';
import {
  ConfirmAppliedPayload,
  UpdateCoverLetterPayload,
  UpdateQuestionPayload,
  UpdateTemplatePayload,
  RecordExportPayload
} from './types';
import { Application, GroundedCoverLetter, GroundedApplicationQuestion } from '@/types/domain';
import { ResumeTemplateId, ResumeExport } from '@/types/templates';

export async function confirmApplicationSubmissionAction(
  payload: ConfirmAppliedPayload
): Promise<Application> {
  try {
    const validated = confirmAppliedSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await confirmApplicationSubmission(
      validated as ConfirmAppliedPayload,
      candidateId,
      validated.expectedVersion
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateCoverLetterDraftAction(
  payload: UpdateCoverLetterPayload
): Promise<GroundedCoverLetter> {
  try {
    const validated = updateCoverLetterSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateCoverLetterDraft(
      validated as unknown as UpdateCoverLetterPayload,
      candidateId
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateQuestionAnswerAction(
  payload: UpdateQuestionPayload
): Promise<GroundedApplicationQuestion> {
  try {
    const validated = updateQuestionSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateQuestionAnswer(
      validated as unknown as UpdateQuestionPayload,
      candidateId
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateApplicationTemplateSelectionAction(
  payload: UpdateTemplatePayload
): Promise<{ templateId: ResumeTemplateId }> {
  try {
    const validated = updateTemplateSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateApplicationTemplateSelection(
      {
        applicationId: validated.applicationId,
        templateId: validated.templateId as ResumeTemplateId
      },
      candidateId
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function recordResumeExportEventAction(
  payload: RecordExportPayload
): Promise<ResumeExport> {
  try {
    const validated = recordExportSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await recordResumeExportEvent(
      validated as unknown as RecordExportPayload,
      candidateId
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}
