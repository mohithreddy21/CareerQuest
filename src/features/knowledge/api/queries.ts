import { queryOptions } from '@tanstack/react-query';
import { getKnowledgeBank, getProposedBatches } from './service';
import { CandidateKnowledgeBank, ProposedIngestionBatch } from '@/types/domain';

export const knowledgeKeys = {
  all: ['knowledge-bank'] as const,
  bank: (candidateId?: string) =>
    candidateId
      ? ([...knowledgeKeys.all, 'bank', candidateId] as const)
      : ([...knowledgeKeys.all, 'bank'] as const),
  proposed: (candidateId?: string) =>
    candidateId
      ? ([...knowledgeKeys.all, 'proposed', candidateId] as const)
      : ([...knowledgeKeys.all, 'proposed'] as const)
};

export const knowledgeBankQueryOptions = (candidateId?: string) =>
  queryOptions({
    queryKey: knowledgeKeys.bank(candidateId),
    queryFn: async (): Promise<CandidateKnowledgeBank> => {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/knowledge/bank');
        if (!res.ok) {
          throw new Error('Failed to fetch Knowledge Bank');
        }
        return res.json() as Promise<CandidateKnowledgeBank>;
      }
      return getKnowledgeBank(candidateId);
    }
  });

export const proposedBatchesQueryOptions = (candidateId?: string) =>
  queryOptions({
    queryKey: knowledgeKeys.proposed(candidateId),
    queryFn: async (): Promise<ProposedIngestionBatch[]> => {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/knowledge/proposed');
        if (!res.ok) {
          throw new Error('Failed to fetch proposed ingestion batches');
        }
        return res.json() as Promise<ProposedIngestionBatch[]>;
      }
      return getProposedBatches(candidateId);
    }
  });
