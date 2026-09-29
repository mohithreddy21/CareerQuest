'use server';

import { requireCandidateId, assertCandidateOwnership } from '@/lib/auth';
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
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return knowledgeBankService.getKnowledgeBank(resolvedId);
}

export async function getProposedBatches(candidateId?: string): Promise<ProposedIngestionBatch[]> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return knowledgeBankService.getProposedBatches(resolvedId);
}

export async function addKnowledgeItem(
  payload: AddKnowledgeItemPayload,
  candidateId?: string
): Promise<KnowledgeItem> {
  const sessionCandidateId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  if (payload.candidateId && payload.candidateId !== sessionCandidateId) {
    assertCandidateOwnership(payload.candidateId, sessionCandidateId);
  }
  return knowledgeBankService.addKnowledgeItem(
    sessionCandidateId,
    payload.category,
    payload.content,
    payload.provenanceLabel
  );
}

export async function updateKnowledgeItem(
  payload: UpdateKnowledgeItemPayload,
  candidateId?: string
): Promise<KnowledgeItem> {
  const effectiveCandidateId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return knowledgeBankService.updateKnowledgeItem(
    payload.id,
    payload.content,
    payload.provenanceNote,
    effectiveCandidateId
  );
}

export async function updateKnowledgeItemStatus(
  payload: UpdateKnowledgeStatusPayload,
  candidateId?: string
): Promise<KnowledgeItem> {
  const effectiveCandidateId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return knowledgeBankService.updateKnowledgeItemStatus(
    payload.id,
    payload.status,
    effectiveCandidateId
  );
}

export async function deleteKnowledgeItem(id: string, candidateId?: string): Promise<boolean> {
  const effectiveCandidateId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return knowledgeBankService.deleteKnowledgeItem(id, effectiveCandidateId);
}

export async function ingestResume(
  payload: IngestResumePayload,
  candidateId?: string
): Promise<ProposedIngestionBatch> {
  const sessionCandidateId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  if (payload.candidateId && payload.candidateId !== sessionCandidateId) {
    assertCandidateOwnership(payload.candidateId, sessionCandidateId);
  }
  return resumeIngestionService.ingestResume(sessionCandidateId, {
    fileName: payload.fileName,
    text: payload.text
  });
}

export async function resolveProposedItem(
  payload: ResolveProposedItemPayload,
  candidateId?: string
): Promise<{ resolved: boolean; remainingInBatch: number }> {
  const sessionCandidateId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  if (payload.candidateId && payload.candidateId !== sessionCandidateId) {
    assertCandidateOwnership(payload.candidateId, sessionCandidateId);
  }
  return knowledgeBankService.resolveProposedItem(
    sessionCandidateId,
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
  const sessionCandidateId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  if (payload.candidateId && payload.candidateId !== sessionCandidateId) {
    assertCandidateOwnership(payload.candidateId, sessionCandidateId);
  }
  return knowledgeBankService.acceptAllProposedItems(sessionCandidateId, payload.batchId);
}
