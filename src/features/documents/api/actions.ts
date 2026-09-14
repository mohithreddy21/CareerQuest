'use server';

import { requireCandidateId } from '@/lib/auth';
import { handleActionError, serializeActionResponse } from '@/lib/action-utils';
import { DocumentService } from '../services/document.service';
import { CandidateDocument } from '@/types';
import { AccountDeletionResult } from '@/types/workspace';

/**
 * Upload a candidate resume/document.
 */
export async function uploadDocumentAction(formData: FormData): Promise<CandidateDocument> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      throw new Error('No valid file provided in upload request');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const doc = await DocumentService.uploadDocument(candidateId, buffer, file.name, file.type);

    return serializeActionResponse(doc);
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Delete a candidate resume/document.
 */
export async function deleteDocumentAction(documentId: string): Promise<{ success: boolean }> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const success = await DocumentService.deleteDocument(candidateId, documentId);

    if (!success) {
      throw new Error(`Document ${documentId} not found or unauthorized`);
    }

    return serializeActionResponse({ success: true });
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * List candidate-owned documents.
 */
export async function getCandidateDocumentsAction(): Promise<CandidateDocument[]> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const docs = await DocumentService.getCandidateDocuments(candidateId);
    return serializeActionResponse(docs);
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Permanent candidate workspace and account data deletion.
 * Requires explicit typed confirmation string.
 */
export async function deleteCandidateAccountAction(
  confirmationText: string
): Promise<AccountDeletionResult> {
  try {
    if (confirmationText !== 'DELETE MY CAREERQUEST DATA') {
      throw new Error(
        'Invalid confirmation text. You must type "DELETE MY CAREERQUEST DATA" exactly.'
      );
    }

    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await DocumentService.deleteCandidateAccount(candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}
