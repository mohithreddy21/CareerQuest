import { careerRepository } from '@/services/career-repository';
import { KnowledgeItem } from '@/types/knowledge';
import { RetrievedCandidateKnowledge } from '@/types/tailoring';
import { KnowledgeRetrievalProvider } from './providers/knowledge-retrieval-provider';
import { MockKnowledgeRetrievalProvider } from './providers/mock-knowledge-retrieval-provider';

export class KnowledgeRetrievalService {
  constructor(
    private provider: KnowledgeRetrievalProvider = new MockKnowledgeRetrievalProvider()
  ) {}

  async retrieveKnowledgeForJob(
    jobId: string,
    candidateId: string = 'cand-1'
  ): Promise<RetrievedCandidateKnowledge> {
    const job = await careerRepository.getJobById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const analysis = await careerRepository.getJobAnalysis(jobId);
    if (!analysis) throw new Error(`Job analysis not found for job: ${jobId}`);

    const bank = await careerRepository.getKnowledgeBank(candidateId);

    // 1. COLLECT ALL KNOWLEDGE ASSETS
    const allItems: KnowledgeItem[] = [
      ...bank.skills,
      ...bank.experiences,
      ...bank.projects,
      ...bank.education,
      ...bank.certifications,
      ...bank.achievements
    ];

    // 2. CRITICAL SAFETY INVARIANT: ONLY APPROVED KNOWLEDGE IS PERMITTED
    // Rejected, archived, deleted, or proposed claims are strictly excluded.
    const approvedItems = allItems.filter(
      (item) => item.status === 'approved' && item.candidateId === candidateId
    );

    // 3. CALL RETRIEVAL PROVIDER
    const retrievalResult = await this.provider.retrieveRelevantKnowledge(
      job,
      analysis,
      approvedItems
    );

    // 4. DOMAIN LEVEL SAFETY VALIDATION
    // The provider is NEVER trusted implicitly. Ensure every returned item references
    // an actual approved item in the candidate's Knowledge Bank.
    const approvedIdSet = new Set(approvedItems.map((i) => i.id));
    const validatedItems = retrievalResult.items.filter((retItem) => {
      const isApproved = approvedIdSet.has(retItem.knowledgeItemId);
      if (!isApproved) {
        // eslint-disable-next-line no-console
        console.warn(
          `[KnowledgeRetrievalService] Dropped unapproved knowledge item reference: ${retItem.knowledgeItemId}`
        );
      }
      return isApproved;
    });

    return {
      ...retrievalResult,
      items: validatedItems
    };
  }
}

export const knowledgeRetrievalService = new KnowledgeRetrievalService();
