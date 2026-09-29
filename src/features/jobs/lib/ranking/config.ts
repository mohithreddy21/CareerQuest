import { RankingConfig } from './types';

export const OPPORTUNITY_PRIORITY_V1 = 'opportunity-priority-v1';

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  version: OPPORTUNITY_PRIORITY_V1,
  matchWeight: 0.5,
  preferenceWeight: 0.35,
  freshnessWeight: 0.15
};

export const NEUTRAL_MATCH_SCORE = 50;
export const NEUTRAL_FRESHNESS_SCORE = 50;
export const DEFAULT_DISCOVERY_PAGE_SIZE = 20;
export const MAX_DISCOVERY_PAGE_SIZE = 50;
