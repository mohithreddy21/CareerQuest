'use server';

import { requireCandidateId } from '@/lib/auth';
import { handleActionError, serializeActionResponse } from '@/lib/action-utils';
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
  updateApplicationNotesSchema,
  updateApplicationFollowUpSchema,
  updateApplicationArchiveSchema,
  addInterviewStageSchema,
  updateInterviewStageSchema,
  deleteInterviewStageSchema,
  addApplicationContactSchema,
  updateApplicationContactSchema,
  deleteApplicationContactSchema
} from './schemas';
import {
  createApplication,
  updateApplicationStatus,
  updateApplicationNotes,
  updateApplicationFollowUp,
  updateApplicationArchiveStatus,
  addInterviewStage,
  updateInterviewStage,
  deleteInterviewStage,
  addApplicationContact,
  updateApplicationContact,
  deleteApplicationContact
} from './service';
import {
  Application,
  AddApplicationContactPayload,
  AddInterviewStagePayload,
  CreateApplicationPayload,
  DeleteApplicationContactPayload,
  DeleteInterviewStagePayload,
  UpdateApplicationArchivePayload,
  UpdateApplicationContactPayload,
  UpdateApplicationFollowUpPayload,
  UpdateApplicationNotesPayload,
  UpdateApplicationStatusPayload,
  UpdateInterviewStagePayload
} from './types';

export async function createApplicationAction(
  payload: CreateApplicationPayload
): Promise<Application> {
  try {
    const validated = createApplicationSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await createApplication(validated as CreateApplicationPayload, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateApplicationStatusAction(
  payload: UpdateApplicationStatusPayload
): Promise<Application> {
  try {
    const validated = updateApplicationStatusSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateApplicationStatus(
      validated as UpdateApplicationStatusPayload,
      candidateId
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateApplicationNotesAction(
  payload: UpdateApplicationNotesPayload
): Promise<Application> {
  try {
    const validated = updateApplicationNotesSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateApplicationNotes(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateApplicationFollowUpAction(
  payload: UpdateApplicationFollowUpPayload
): Promise<Application> {
  try {
    const validated = updateApplicationFollowUpSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateApplicationFollowUp(
      validated as UpdateApplicationFollowUpPayload,
      candidateId
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateApplicationArchiveStatusAction(
  payload: UpdateApplicationArchivePayload
): Promise<Application> {
  try {
    const validated = updateApplicationArchiveSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateApplicationArchiveStatus(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function addInterviewStageAction(
  payload: AddInterviewStagePayload
): Promise<Application> {
  try {
    const validated = addInterviewStageSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await addInterviewStage(validated as AddInterviewStagePayload, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateInterviewStageAction(
  payload: UpdateInterviewStagePayload
): Promise<Application> {
  try {
    const validated = updateInterviewStageSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateInterviewStage(
      validated as UpdateInterviewStagePayload,
      candidateId
    );
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteInterviewStageAction(
  payload: DeleteInterviewStagePayload
): Promise<Application> {
  try {
    const validated = deleteInterviewStageSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await deleteInterviewStage(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function addApplicationContactAction(
  payload: AddApplicationContactPayload
): Promise<Application> {
  try {
    const validated = addApplicationContactSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await addApplicationContact(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateApplicationContactAction(
  payload: UpdateApplicationContactPayload
): Promise<Application> {
  try {
    const validated = updateApplicationContactSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateApplicationContact(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteApplicationContactAction(
  payload: DeleteApplicationContactPayload
): Promise<Application> {
  try {
    const validated = deleteApplicationContactSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await deleteApplicationContact(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}
