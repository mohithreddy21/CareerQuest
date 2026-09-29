'use server';

import { requireCandidateId, assertCandidateOwnership } from '@/lib/auth';
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
  AcceptAllProposedPayload,
  UploadAndIngestResumeResult
} from './types';
import { KnowledgeItem, ProposedIngestionBatch } from '@/types/domain';
import { DocumentService } from '@/features/documents/services/document.service';
import { DocumentTextExtractor } from '@/features/documents/services/document-text-extractor';
import { resumeIngestionService } from '../services/resume-ingestion-service';

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
    if (validated.candidateId && validated.candidateId !== candidateId) {
      assertCandidateOwnership(validated.candidateId, candidateId);
    }
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
    if (validated.candidateId && validated.candidateId !== candidateId) {
      assertCandidateOwnership(validated.candidateId, candidateId);
    }
    await acceptAllProposedItems(validated, candidateId);
    return serializeActionResponse({ success: true });
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Upload a candidate resume file from local device, persist to Object Storage & DB,
 * extract text, parse career claims, and generate a Proposed Ingestion Batch.
 */
export async function uploadAndIngestResumeAction(
  formData: FormData
): Promise<UploadAndIngestResumeResult> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      throw new Error('Please select a valid resume document to upload.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Upload & persist CandidateDocument in storage & PostgreSQL with security validation
    const doc = await DocumentService.uploadDocument(candidateId, buffer, file.name, file.type);

    // 2. Extract plain text from document (PDF / DOCX / TXT)
    let extractedText = '';
    try {
      extractedText = await DocumentTextExtractor.extractText(buffer, doc.mimeType, doc.filename);
    } catch {
      extractedText = '';
    }

    // 3. Ingest extracted text into proposed batch
    const batch = await resumeIngestionService.ingestResume(candidateId, {
      fileName: doc.filename,
      text: extractedText,
      documentId: doc.id
    });

    return serializeActionResponse({
      document: doc,
      batch
    });
  } catch (error) {
    return handleActionError(error);
  }
}
