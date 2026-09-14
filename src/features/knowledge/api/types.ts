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
