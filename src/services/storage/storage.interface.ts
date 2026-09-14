/**
 * Object Storage Abstraction
 * Vendor-neutral interface for document and export artifact storage.
 */

export interface StoragePutResult {
  key: string;
  size: number;
  mimeType: string;
  etag?: string;
}

export interface StorageGetResult {
  key: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}

export interface IObjectStorage {
  /**
   * Put an object into storage.
   */
  put(key: string, buffer: Buffer, mimeType: string): Promise<StoragePutResult>;

  /**
   * Get an object from storage. Throws if not found.
   */
  get(key: string): Promise<StorageGetResult>;

  /**
   * Delete an object from storage. Does not throw if object already does not exist.
   */
  delete(key: string): Promise<void>;

  /**
   * Check if an object exists in storage.
   */
  exists(key: string): Promise<boolean>;
}

/**
 * Generate a candidate-scoped, opaque storage path.
 * Format: candidates/{candidateId}/documents/{docId}_{sanitizedFilename}
 */
export function generateCandidateDocumentKey(
  candidateId: string,
  docId: string,
  filename: string
): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `candidates/${candidateId}/documents/${docId}_${safeFilename}`;
}

/**
 * Generate a candidate-scoped, opaque export storage path.
 * Format: candidates/{candidateId}/exports/{exportId}_{sanitizedFilename}
 */
export function generateCandidateExportKey(
  candidateId: string,
  exportId: string,
  filename: string
): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `candidates/${candidateId}/exports/${exportId}_${safeFilename}`;
}
