import {
  AddKnowledgeItemPayload,
  UpdateKnowledgeItemPayload,
  UpdateKnowledgeStatusPayload,
  IngestResumePayload,
  ResolveProposedItemPayload,
  AcceptAllProposedPayload
} from './types';
import { CandidateKnowledgeBank, KnowledgeItem, ProposedIngestionBatch } from '@/types/domain';
import { knowledgeBankService } from '../services/knowledge-bank-service';
import { resumeIngestionService } from '../services/resume-ingestion-service';

export async function getKnowledgeBank(candidateId?: string): Promise<CandidateKnowledgeBank> {
  return knowledgeBankService.getKnowledgeBank(candidateId || 'cand-1');
}

export async function getProposedBatches(candidateId?: string): Promise<ProposedIngestionBatch[]> {
  return knowledgeBankService.getProposedBatches(candidateId || 'cand-1');
}

export async function addKnowledgeItem(
  payload: AddKnowledgeItemPayload,
  candidateId?: string
): Promise<KnowledgeItem> {
  const effectiveCandidateId = candidateId || payload.candidateId || 'cand-1';
  return knowledgeBankService.addKnowledgeItem(
    effectiveCandidateId,
    payload.category,
    payload.content,
    payload.provenanceLabel
  );
}

export async function updateKnowledgeItem(
  payload: UpdateKnowledgeItemPayload,
  candidateId?: string
): Promise<KnowledgeItem> {
  return knowledgeBankService.updateKnowledgeItem(
    payload.id,
    payload.content,
    payload.provenanceNote,
    candidateId
  );
}

export async function updateKnowledgeItemStatus(
  payload: UpdateKnowledgeStatusPayload,
  candidateId?: string
): Promise<KnowledgeItem> {
  return knowledgeBankService.updateKnowledgeItemStatus(payload.id, payload.status, candidateId);
}

export async function deleteKnowledgeItem(id: string, candidateId?: string): Promise<boolean> {
  return knowledgeBankService.deleteKnowledgeItem(id, candidateId);
}

export async function ingestResume(
  payload: IngestResumePayload,
  candidateId?: string
): Promise<ProposedIngestionBatch> {
  const effectiveCandidateId = candidateId || payload.candidateId || 'cand-1';
  return resumeIngestionService.ingestResume(effectiveCandidateId, {
    fileName: payload.fileName,
    text: payload.text
  });
}

export async function resolveProposedItem(
  payload: ResolveProposedItemPayload,
  candidateId?: string
): Promise<{ resolved: boolean; remainingInBatch: number }> {
  const effectiveCandidateId = candidateId || payload.candidateId || 'cand-1';
  return knowledgeBankService.resolveProposedItem(
    effectiveCandidateId,
    payload.batchId,
    payload.tempId,
    payload.action,
    payload.editedContent
  );
}

export async function acceptAllProposedItems(
  payload: AcceptAllProposedPayload,
  candidateId?: string
): Promise<void> {
  const effectiveCandidateId = candidateId || payload.candidateId || 'cand-1';
  return knowledgeBankService.acceptAllProposedItems(effectiveCandidateId, payload.batchId);
}
