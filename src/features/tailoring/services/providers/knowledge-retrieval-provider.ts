import { Job, JobAnalysis } from '@/types/domain';
import { KnowledgeItem } from '@/types/knowledge';
import { RetrievedCandidateKnowledge } from '@/types/tailoring';

export interface KnowledgeRetrievalProvider {
  retrieveRelevantKnowledge(
    job: Job,
    analysis: JobAnalysis,
    approvedKnowledgeItems: KnowledgeItem[]
  ): Promise<RetrievedCandidateKnowledge>;
}
