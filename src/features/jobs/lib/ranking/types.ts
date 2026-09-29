import {
  ApplicationStatus,
  CandidateJobState,
  Job,
  JobMatch,
  JobSourceReference
} from '@/types/domain';

export interface RankingConfig {
  version: string;
  matchWeight: number; // 0.50
  preferenceWeight: number; // 0.35
  freshnessWeight: number; // 0.15
}

export interface OpportunityPriorityBreakdown {
  matchScore: number;
  preferenceFit: number;
  freshnessScore: number;
  weights: {
    match: number;
    preference: number;
    freshness: number;
  };
  preferencesRedistributed: boolean;
  dimensionScores?: {
    role?: number | null;
    location?: number | null;
    arrangement?: number | null;
  };
}

export interface OpportunityPriorityResult {
  jobId: string;
  candidateId: string;
  priorityScore: number; // 0-100 rounded to 1 decimal place
  matchScore: number;
  preferenceFit: number;
  freshness: number;
  rankingAlgorithmVersion: string;
  calculatedAt: string;
  breakdown: OpportunityPriorityBreakdown;
  explanation: string;
}

export interface DiscoveryRankingCursorPayload {
  p: number; // priorityScore
  d: string | null; // postedDate as ISO string or null
  i: string; // jobId
  ctx: string; // ranking context hash
  e: string; // evaluatedAt as ISO timestamp
}

export interface DiscoveryRankingParams {
  cursor?: string;
  pageSize?: number;
  includeApplied?: boolean;
  tab?: 'recommended' | 'saved' | 'all';
  search?: string;
  stateFilter?: 'all' | 'saved' | 'unseen' | 'viewed' | 'dismissed';
  includeDismissed?: boolean;
  minMatch?: number;
  workArrangement?: string;
  source?: string;
  sort?: 'priority' | 'match_desc' | 'recent';
}

export interface RankedOpportunity {
  job: Job;
  priority: OpportunityPriorityResult;
  match?: JobMatch | null;
  primarySource?: JobSourceReference | null;
  candidateState?: CandidateJobState | null;
  applicationStatus?: ApplicationStatus | null;
}

export interface DiscoveryRankingResponse {
  items: RankedOpportunity[];
  nextCursor: string | null;
  hasMore: boolean;
  totalEligible: number;
  rankingContextKey: string;
  cursorReset?: boolean;
  evaluatedAt?: string;
}
