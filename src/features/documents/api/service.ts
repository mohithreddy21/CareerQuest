import {
  getCandidateDocumentsAction,
  uploadDocumentAction,
  deleteDocumentAction,
  deleteCandidateAccountAction
} from './actions';
import { CandidateDocument } from '@/types';
import { AccountDeletionResult } from '@/types/workspace';

export async function getDocuments(): Promise<CandidateDocument[]> {
  return getCandidateDocumentsAction();
}

export async function uploadDocument(formData: FormData): Promise<CandidateDocument> {
  return uploadDocumentAction(formData);
}

export async function deleteDocument(documentId: string): Promise<{ success: boolean }> {
  return deleteDocumentAction(documentId);
}

export async function deleteAccount(confirmationText: string): Promise<AccountDeletionResult> {
  return deleteCandidateAccountAction(confirmationText);
}
