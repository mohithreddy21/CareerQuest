import { careerRepository } from '@/services/career-repository';
import {
  calculateFreshnessScore,
  calculateOpportunityPriority,
  calculatePreferenceFit,
  DEFAULT_RANKING_CONFIG,
  DiscoveryRankingParams,
  DiscoveryRankingResponse,
  OpportunityPriorityResult,
  RankingConfig
} from '../lib/ranking';
import { CandidatePreferences, Job, JobMatch, JobSourceReference } from '@/types/domain';

export class OpportunityPriorityService {
  calculatePriority(
    job: Job,
    candidateId: string,
    options?: {
      match?: JobMatch | null;
      preferences?: CandidatePreferences | null;
      sources?: JobSourceReference[];
      config?: RankingConfig;
      now?: Date;
      evaluatedAt?: Date;
    }
  ): OpportunityPriorityResult {
    return calculateOpportunityPriority(
      job,
      candidateId,
      options?.match,
      options?.preferences,
      options?.sources,
      options?.config || DEFAULT_RANKING_CONFIG,
      options?.evaluatedAt || options?.now || new Date()
    );
  }

  calculatePreferenceFit(job: Job, preferences?: CandidatePreferences | null) {
    return calculatePreferenceFit(job, preferences);
  }

  calculateFreshnessScore(job: Job, sources?: JobSourceReference[], evaluatedAt = new Date()) {
    return calculateFreshnessScore(job, sources, evaluatedAt);
  }

  async getDiscoveryRanking(
    params: DiscoveryRankingParams,
    candidateId: string
  ): Promise<DiscoveryRankingResponse> {
    return careerRepository.getDiscoveryRanking(params, candidateId);
  }
}

export const opportunityPriorityService = new OpportunityPriorityService();
