import { KnowledgeCategory, KnowledgeStatus } from '@/types/domain';

export interface AddKnowledgeItemPayload {
  candidateId?: string;
  category: KnowledgeCategory;
  content: unknown;
  provenanceLabel?: string;
}

export interface UpdateKnowledgeItemPayload {
  id: string;
  content: unknown;
  provenanceNote?: string;
}

export interface UpdateKnowledgeStatusPayload {
  id: string;
  status: KnowledgeStatus;
}

export interface IngestResumePayload {
  candidateId?: string;
  fileName: string;
  text?: string;
}

export interface ResolveProposedItemPayload {
  candidateId?: string;
  batchId: string;
  tempId: string;
  action: 'accept' | 'reject' | 'edit';
  editedContent?: unknown;
}

export interface AcceptAllProposedPayload {
  candidateId?: string;
  batchId: string;
}

export interface UploadAndIngestResumeResult {
  document: {
    id: string;
    candidateId: string;
    filename: string;
    mimeType: string;
    size: number;
    storageKey: string;
    hash: string;
    uploadedAt: string;
    processingStatus: string;
  };
  batch: {
    id: string;
    candidateId: string;
    documentId?: string;
    fileName: string;
    rawText?: string;
    uploadedAt: string;
    items: unknown[];
    status: string;
  };
}
