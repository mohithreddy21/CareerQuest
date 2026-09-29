import { CandidatePreferences, Job, JobMatch, JobSourceReference } from '@/types/domain';
import { normalizeLocation, normalizeTitle } from '../dedup';
import { DEFAULT_RANKING_CONFIG, NEUTRAL_FRESHNESS_SCORE, NEUTRAL_MATCH_SCORE } from './config';
import { OpportunityPriorityBreakdown, OpportunityPriorityResult, RankingConfig } from './types';

/**
 * Calculates deterministic Freshness score (0-100) based on postedDate or source firstSeenAt.
 * Missing temporal data returns neutral 50 without penalty.
 */
export function calculateFreshnessScore(
  job: Job,
  sources?: JobSourceReference[],
  evaluatedAt: Date = new Date()
): number {
  // 1. Primary basis: Job.postedDate
  let temporalDate: Date | null = job.postedDate ? new Date(job.postedDate) : null;

  // 2. Fallback basis: Earliest or primary JobSourceReference.firstSeenAt
  if (!temporalDate && sources && sources.length > 0) {
    const primary = sources.find((s) => s.isPrimary);
    const candidateSource = primary || sources[0];
    if (candidateSource?.firstSeenAt) {
      temporalDate = new Date(candidateSource.firstSeenAt);
    }
  }

  // If neither available, return neutral 50
  if (!temporalDate || Number.isNaN(temporalDate.getTime())) {
    return NEUTRAL_FRESHNESS_SCORE;
  }

  const ageMs = Math.max(0, evaluatedAt.getTime() - temporalDate.getTime());
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Deterministic age decay schedule
  if (ageDays <= 1) return 100;
  if (ageDays <= 3) return 95;
  if (ageDays <= 7) return 85;
  if (ageDays <= 14) return 70;
  if (ageDays <= 30) return 50;
  if (ageDays <= 60) return 30;
  if (ageDays <= 90) return 15;
  return 5;
}

export interface PreferenceFitEvaluation {
  fitScore: number;
  isUnconfigured: boolean;
  dimensionScores: {
    role?: number | null;
    location?: number | null;
    arrangement?: number | null;
  };
}

/**
 * Calculates candidate-specific PreferenceFit (0-100).
 * Missing job data and empty preference dimensions are treated as neutral.
 */
export function calculatePreferenceFit(
  job: Job,
  preferences?: CandidatePreferences | null
): PreferenceFitEvaluation {
  if (!preferences) {
    return {
      fitScore: 50,
      isUnconfigured: true,
      dimensionScores: { role: null, location: null, arrangement: null }
    };
  }

  const { targetRoles, preferredLocations, workArrangements } = preferences;

  const hasRoles = Array.isArray(targetRoles) && targetRoles.length > 0;
  const hasLocations = Array.isArray(preferredLocations) && preferredLocations.length > 0;
  const hasArrangements = Array.isArray(workArrangements) && workArrangements.length > 0;

  // If candidate has no preferences configured at all
  if (!hasRoles && !hasLocations && !hasArrangements) {
    return {
      fitScore: 50,
      isUnconfigured: true,
      dimensionScores: { role: null, location: null, arrangement: null }
    };
  }

  const dimensionScores: {
    role?: number | null;
    location?: number | null;
    arrangement?: number | null;
  } = {};

  // 1. Target Roles
  if (hasRoles) {
    const normJobTitle = normalizeTitle(job.title);
    const matchesRole = targetRoles.some((r) => {
      const normPref = normalizeTitle(r);
      if (!normPref) return false;
      return normJobTitle.includes(normPref) || normPref.includes(normJobTitle);
    });
    dimensionScores.role = matchesRole ? 100 : 0;
  } else {
    dimensionScores.role = null;
  }

  // 2. Preferred Locations
  if (hasLocations) {
    if (!job.location || job.location.toLowerCase().trim() === 'unknown') {
      dimensionScores.location = 50; // Neutral, missing job location is not penalized
    } else {
      const normJobLoc = normalizeLocation(job.location);
      const matchesLoc = preferredLocations.some((l) => {
        const normPref = normalizeLocation(l);
        if (
          normPref === 'remote' &&
          (normJobLoc === 'remote' || job.workArrangement === 'remote')
        ) {
          return true;
        }
        return normJobLoc.includes(normPref) || normPref.includes(normJobLoc);
      });
      dimensionScores.location = matchesLoc ? 100 : 0;
    }
  } else {
    dimensionScores.location = null;
  }

  // 3. Work Arrangement
  if (hasArrangements) {
    if (!job.workArrangement || job.workArrangement === 'unknown') {
      dimensionScores.arrangement = 50; // Neutral, missing job arrangement is not penalized
    } else {
      const matchesArrangement = workArrangements.includes(job.workArrangement);
      dimensionScores.arrangement = matchesArrangement ? 100 : 0;
    }
  } else {
    dimensionScores.arrangement = null;
  }

  // Average over configured dimensions
  const activeScores: number[] = [];
  if (dimensionScores.role !== null && dimensionScores.role !== undefined) {
    activeScores.push(dimensionScores.role);
  }
  if (dimensionScores.location !== null && dimensionScores.location !== undefined) {
    activeScores.push(dimensionScores.location);
  }
  if (dimensionScores.arrangement !== null && dimensionScores.arrangement !== undefined) {
    activeScores.push(dimensionScores.arrangement);
  }

  if (activeScores.length === 0) {
    return {
      fitScore: 50,
      isUnconfigured: true,
      dimensionScores
    };
  }

  const sum = activeScores.reduce((acc, v) => acc + v, 0);
  const fitScore = Math.round(sum / activeScores.length);

  return {
    fitScore,
    isUnconfigured: false,
    dimensionScores
  };
}

/**
 * Builds an explainable rationale for the priority score.
 */
function buildExplanation(
  matchScore: number,
  preferenceFit: number,
  freshness: number,
  isPreferenceUnconfigured: boolean,
  dimScores: PreferenceFitEvaluation['dimensionScores']
): string {
  const parts: string[] = [];

  if (matchScore >= 90) {
    parts.push(`Exceptional match alignment (${matchScore}%)`);
  } else if (matchScore >= 75) {
    parts.push(`Strong match alignment (${matchScore}%)`);
  } else if (matchScore === NEUTRAL_MATCH_SCORE) {
    parts.push(`Baseline profile match (${matchScore}%)`);
  } else {
    parts.push(`Match alignment (${matchScore}%)`);
  }

  if (isPreferenceUnconfigured) {
    parts.push('unconfigured preferences (weight redistributed)');
  } else {
    if (dimScores.role === 100) parts.push('preferred target role');
    if (dimScores.location === 100) parts.push('preferred location');
    if (dimScores.arrangement === 100) parts.push('preferred work arrangement');
    if (preferenceFit === 0) parts.push('outside configured preferences');
  }

  if (freshness >= 85) {
    parts.push('recently posted opportunity');
  } else if (freshness <= 15) {
    parts.push('older listing');
  }

  return parts.join(' + ');
}

/**
 * Computes candidate-specific Opportunity Priority score and explainable result.
 *
 * Formula:
 *   Priority = (Match * 0.50) + (PreferenceFit * 0.35) + (Freshness * 0.15)
 *
 * Empty preferences rule:
 *   If candidate has no preferences configured, the 35% preference weight is
 *   redistributed across available Match and Freshness components deterministically.
 */
export function calculateOpportunityPriority(
  job: Job,
  candidateId: string,
  match?: JobMatch | null,
  preferences?: CandidatePreferences | null,
  sources?: JobSourceReference[],
  config: RankingConfig = DEFAULT_RANKING_CONFIG,
  evaluatedAt: Date = new Date()
): OpportunityPriorityResult {
  // 1. Match component (neutral 50 if missing)
  const matchScore =
    match && typeof match.score === 'number' && Number.isFinite(match.score)
      ? Math.max(0, Math.min(100, match.score))
      : NEUTRAL_MATCH_SCORE;

  // 2. Preference fit component
  const prefEval = calculatePreferenceFit(job, preferences);

  // 3. Freshness component
  const freshness = calculateFreshnessScore(job, sources, evaluatedAt);

  let effectiveMatchWeight = config.matchWeight;
  let effectivePrefWeight = config.preferenceWeight;
  let effectiveFreshWeight = config.freshnessWeight;
  let preferencesRedistributed = false;

  // 4. Weight redistribution if preferences are completely unconfigured
  if (prefEval.isUnconfigured) {
    preferencesRedistributed = true;
    const availableWeightSum = config.matchWeight + config.freshnessWeight;
    effectiveMatchWeight = config.matchWeight / availableWeightSum;
    effectivePrefWeight = 0;
    effectiveFreshWeight = config.freshnessWeight / availableWeightSum;
  }

  const rawPriority =
    matchScore * effectiveMatchWeight +
    prefEval.fitScore * effectivePrefWeight +
    freshness * effectiveFreshWeight;

  // Round to 1 decimal place deterministically
  const priorityScore = Math.round(rawPriority * 10) / 10;

  const breakdown: OpportunityPriorityBreakdown = {
    matchScore,
    preferenceFit: prefEval.fitScore,
    freshnessScore: freshness,
    weights: {
      match: Math.round(effectiveMatchWeight * 1000) / 1000,
      preference: Math.round(effectivePrefWeight * 1000) / 1000,
      freshness: Math.round(effectiveFreshWeight * 1000) / 1000
    },
    preferencesRedistributed,
    dimensionScores: prefEval.dimensionScores
  };

  const explanation = buildExplanation(
    matchScore,
    prefEval.fitScore,
    freshness,
    prefEval.isUnconfigured,
    prefEval.dimensionScores
  );

  return {
    jobId: job.id,
    candidateId,
    priorityScore,
    matchScore,
    preferenceFit: prefEval.fitScore,
    freshness,
    rankingAlgorithmVersion: config.version,
    calculatedAt: evaluatedAt.toISOString(),
    breakdown,
    explanation
  };
}
