'use server';

import { requireCandidateId } from '@/lib/auth';
import { handleActionError, serializeActionResponse } from '@/lib/action-utils';
import {
  addKnowledgeItemSchema,
  updateKnowledgeItemSchema,
  updateKnowledgeStatusSchema,
  deleteKnowledgeItemSchema,
  ingestResumeSchema,
  resolveProposedItemSchema,
  acceptAllProposedSchema
} from './schemas';
import {
  addKnowledgeItem,
  updateKnowledgeItem,
  updateKnowledgeItemStatus,
  deleteKnowledgeItem,
  ingestResume,
  resolveProposedItem,
  acceptAllProposedItems
} from './service';
import {
  AddKnowledgeItemPayload,
  UpdateKnowledgeItemPayload,
  UpdateKnowledgeStatusPayload,
  IngestResumePayload,
  ResolveProposedItemPayload,
  AcceptAllProposedPayload
} from './types';
import { KnowledgeItem, ProposedIngestionBatch } from '@/types/domain';

export async function addKnowledgeItemAction(
  payload: AddKnowledgeItemPayload
): Promise<KnowledgeItem> {
  try {
    const validated = addKnowledgeItemSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await addKnowledgeItem(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateKnowledgeItemAction(
  payload: UpdateKnowledgeItemPayload
): Promise<KnowledgeItem> {
  try {
    const validated = updateKnowledgeItemSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateKnowledgeItem(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateKnowledgeItemStatusAction(
  payload: UpdateKnowledgeStatusPayload
): Promise<KnowledgeItem> {
  try {
    const validated = updateKnowledgeStatusSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateKnowledgeItemStatus(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteKnowledgeItemAction(id: string): Promise<boolean> {
  try {
    const validated = deleteKnowledgeItemSchema.parse({ id });
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await deleteKnowledgeItem(validated.id, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function ingestResumeAction(
  payload: IngestResumePayload
): Promise<ProposedIngestionBatch> {
  try {
    const validated = ingestResumeSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await ingestResume(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function resolveProposedItemAction(
  payload: ResolveProposedItemPayload
): Promise<{ resolved: boolean; remainingInBatch: number }> {
  try {
    const validated = resolveProposedItemSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await resolveProposedItem(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function acceptAllProposedItemsAction(
  payload: AcceptAllProposedPayload
): Promise<{ success: boolean }> {
  try {
    const validated = acceptAllProposedSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    await acceptAllProposedItems(validated, candidateId);
    return serializeActionResponse({ success: true });
  } catch (error) {
    return handleActionError(error);
  }
}
