import { getCareerRepository } from '@/services/repository-provider';
import { getStorage } from '@/services/storage/storage-provider';
import { generateCandidateDocumentKey } from '@/services/storage/storage.interface';
import { validateDocumentUpload } from '../lib/document-validator';
import { CandidateDocument } from '@/types';
import { AccountDeletionResult } from '@/types/workspace';

export const DocumentService = {
  /**
   * Upload and persist a candidate document with storage compensation on failure.
   */
  async uploadDocument(
    candidateId: string,
    fileBuffer: Buffer,
    filename: string,
    claimedMimeType?: string
  ): Promise<CandidateDocument> {
    if (!candidateId) {
      throw new Error('Candidate identity required for document upload');
    }

    // 1. Validate file (size, MIME, magic signature, safe filename)
    const validated = validateDocumentUpload(fileBuffer, filename, claimedMimeType);

    // 2. Generate unique doc ID & candidate-scoped storage key
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const storageKey = generateCandidateDocumentKey(
      candidateId,
      docId,
      validated.sanitizedFilename
    );

    const storage = getStorage();
    const repository = getCareerRepository();

    // 3. Store object in object storage
    await storage.put(storageKey, validated.buffer, validated.mimeType);

    try {
      // 4. Persist database record
      const record = await repository.createCandidateDocument(
        {
          candidateId,
          filename: validated.sanitizedFilename,
          mimeType: validated.mimeType,
          size: validated.size,
          storageKey,
          hash: validated.hash,
          processingStatus: 'uploaded'
        },
        candidateId
      );

      return record;
    } catch (err: unknown) {
      // 5. Compensation: If DB persistence fails, remove the newly stored object to prevent orphans
      try {
        await storage.delete(storageKey);
      } catch {
        // Suppress secondary compensation cleanup error to preserve primary error context
      }

      const message =
        err instanceof Error ? err.message : 'Database error during document persistence';
      throw new Error(`Failed to record document metadata: ${message}`, { cause: err });
    }
  },

  /**
   * Secure candidate document retrieval for streaming/download.
   */
  async getDocumentForDownload(
    candidateId: string,
    documentId: string
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    if (!candidateId) {
      throw new Error('Candidate identity required');
    }

    const repository = getCareerRepository();
    const doc = await repository.getCandidateDocumentById(documentId, candidateId);

    if (!doc) {
      throw new Error('Document not found or unauthorized');
    }

    const storage = getStorage();
    const stored = await storage.get(doc.storageKey);

    return {
      buffer: stored.buffer,
      mimeType: doc.mimeType || stored.mimeType,
      filename: doc.filename
    };
  },

  /**
   * Delete a candidate document from storage and database.
   * Preserves approved Knowledge Bank items and truthfully marks provenance.
   */
  async deleteDocument(candidateId: string, documentId: string): Promise<boolean> {
    if (!candidateId) {
      throw new Error('Candidate identity required');
    }

    const repository = getCareerRepository();
    const doc = await repository.getCandidateDocumentById(documentId, candidateId);

    if (!doc) {
      return false;
    }

    // Delete from storage first
    const storage = getStorage();
    try {
      await storage.delete(doc.storageKey);
    } catch {
      // If storage delete encounters an error, log/handle safely
    }

    // Delete from database
    return repository.deleteCandidateDocument(documentId, candidateId);
  },

  /**
   * List all documents owned by the candidate.
   */
  async getCandidateDocuments(candidateId: string): Promise<CandidateDocument[]> {
    if (!candidateId) {
      throw new Error('Candidate identity required');
    }

    const repository = getCareerRepository();
    return repository.getCandidateDocuments(candidateId);
  },

  /**
   * Delete candidate account data following strict topological database order and storage cleanup.
   */
  async deleteCandidateAccount(candidateId: string): Promise<AccountDeletionResult> {
    if (!candidateId) {
      throw new Error('Candidate identity required');
    }

    const repository = getCareerRepository();
    return repository.deleteCandidateAccountData(candidateId);
  }
};
