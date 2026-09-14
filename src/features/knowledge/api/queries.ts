import { queryOptions } from '@tanstack/react-query';
import { getKnowledgeBank, getProposedBatches } from './service';

export const knowledgeKeys = {
  all: ['knowledge-bank'] as const,
  bank: (candidateId = 'cand-1') => [...knowledgeKeys.all, 'bank', candidateId] as const,
  proposed: (candidateId = 'cand-1') => [...knowledgeKeys.all, 'proposed', candidateId] as const
};

export const knowledgeBankQueryOptions = (candidateId = 'cand-1') =>
  queryOptions({
    queryKey: knowledgeKeys.bank(candidateId),
    queryFn: () => getKnowledgeBank(candidateId)
  });

export const proposedBatchesQueryOptions = (candidateId = 'cand-1') =>
  queryOptions({
    queryKey: knowledgeKeys.proposed(candidateId),
    queryFn: () => getProposedBatches(candidateId)
  });
