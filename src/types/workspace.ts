/**
 * CareerQuest Workspace & Data Lifecycle Types
 */

export interface AccountDeletionResult {
  candidateId: string;
  databaseDeleted: boolean;
  storageCleanupStatus: 'completed' | 'partial' | 'failed' | 'none';
  storageKeysDeletedCount: number;
  failedStorageKeysCount: number;
  preservedPublicJobsCount: number;
  deletedPrivateJobsCount: number;
  identityDeletionStatus: 'completed' | 'unconfigured' | 'failed';
  deletedAt: string;
}

export interface DocumentUploadResult {
  documentId: string;
  filename: string;
  size: number;
  mimeType: string;
  storageKey: string;
  hash: string;
  uploadedAt: string;
}
