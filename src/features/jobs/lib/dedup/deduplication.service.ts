import { Job } from '@/types/domain';
import { NormalizedJobData } from '../importer/types';
import { normalizeCompany, normalizeLocation, normalizeTitle } from './normalizers';
import { calculateStructuralSimilarity } from './similarity';
import { DeduplicationEvidence, DeduplicationResult } from './types';

/**
 * Threshold constants governing tiered cross-source deduplication.
 *
 * Tier 2: Strong duplicate
 *   - Requires normalized company match
 *   - AND normalized title match
 *   - AND normalized location match
 *   - AND structural similarity >= 85%
 *
 * Tier 3: Possible duplicate
 *   - Requires company + title match, but differing location or similarity 60-84%
 *   - Preserved as separate opportunities (NEVER merged automatically)
 */
export const STRONG_DUPLICATE_SIMILARITY_THRESHOLD = 85;
export const POSSIBLE_DUPLICATE_MIN_SIMILARITY_THRESHOLD = 60;

/**
 * Evaluates an incoming normalized job posting against existing candidate jobs
 * to determine if it is an exact match, strong duplicate, possible duplicate, or unique.
 */
export function evaluateDeduplication(
  incoming: NormalizedJobData,
  existingCandidates: Job[]
): DeduplicationResult {
  const normIncCompany = normalizeCompany(incoming.company);
  const normIncTitle = normalizeTitle(incoming.title);
  const normIncLocation = normalizeLocation(incoming.location);

  const strongMatches: Array<{ job: Job; evidence: DeduplicationEvidence }> = [];
  const possibleMatches: Array<{ job: Job; evidence: DeduplicationEvidence }> = [];

  for (const candidate of existingCandidates) {
    const normCandCompany = normalizeCompany(candidate.company);
    const normCandTitle = normalizeTitle(candidate.title);
    const normCandLocation = normalizeLocation(candidate.location);

    const companyMatch = normIncCompany.length > 0 && normIncCompany === normCandCompany;
    const titleMatch = normIncTitle.length > 0 && normIncTitle === normCandTitle;
    const locationMatch =
      normIncLocation.length > 0 &&
      (normIncLocation === normCandLocation ||
        (normIncLocation === 'remote' && normCandLocation === 'remote'));

    const { similarity, breakdown } = calculateStructuralSimilarity(incoming, {
      title: candidate.title,
      company: candidate.company,
      location: candidate.location,
      description: candidate.description,
      responsibilities: candidate.responsibilities,
      requiredSkills: candidate.requiredSkills,
      preferredSkills: candidate.preferredSkills
    });

    const reasons: string[] = [];
    if (companyMatch) reasons.push(`Company matched (${normIncCompany})`);
    if (titleMatch) reasons.push(`Title matched (${normIncTitle})`);
    if (locationMatch) reasons.push(`Location matched (${normIncLocation})`);
    reasons.push(
      `Structural similarity: ${similarity}% (skills: ${breakdown.skills}%, resp: ${breakdown.responsibilities}%, desc: ${breakdown.description}%)`
    );

    const evidence: DeduplicationEvidence = {
      companyMatch,
      titleMatch,
      locationMatch,
      structuralSimilarity: similarity,
      breakdown,
      reasons
    };

    // Tier 2: Strong Duplicate Check
    if (
      companyMatch &&
      titleMatch &&
      locationMatch &&
      similarity >= STRONG_DUPLICATE_SIMILARITY_THRESHOLD
    ) {
      strongMatches.push({ job: candidate, evidence });
      continue;
    }

    // Tier 3: Possible Duplicate Check
    // e.g. Company + title match, but different location or similarity 60-84%
    const isCompanyAndTitle = companyMatch && titleMatch;

    if (
      isCompanyAndTitle &&
      (!locationMatch ||
        (similarity >= POSSIBLE_DUPLICATE_MIN_SIMILARITY_THRESHOLD &&
          similarity < STRONG_DUPLICATE_SIMILARITY_THRESHOLD))
    ) {
      possibleMatches.push({ job: candidate, evidence });
    } else if (companyMatch && similarity >= 75) {
      possibleMatches.push({ job: candidate, evidence });
    }
  }

  // 1. If strong duplicates found, select canonical job deterministically
  if (strongMatches.length > 0) {
    // Sort strong candidates:
    // 1. Highest structural similarity
    // 2. Earliest createdAt/normalizedAt
    // 3. Stable ID tie-breaker
    const sorted = [...strongMatches].toSorted((a, b) => {
      if (b.evidence.structuralSimilarity !== a.evidence.structuralSimilarity) {
        return b.evidence.structuralSimilarity - a.evidence.structuralSimilarity;
      }
      const aTime = new Date(a.job.normalizedAt || a.job.postedDate || 0).getTime();
      const bTime = new Date(b.job.normalizedAt || b.job.postedDate || 0).getTime();
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return a.job.id.localeCompare(b.job.id);
    });

    const selected = sorted[0];

    return {
      tier: 'strong_duplicate',
      canonicalJob: selected.job,
      duplicateGroupId: selected.job.duplicateGroupId || undefined,
      evidence: selected.evidence,
      possibleDuplicates: possibleMatches.length > 0 ? possibleMatches : undefined
    };
  }

  // 2. If possible duplicates found, preserve separately but report evidence
  if (possibleMatches.length > 0) {
    return {
      tier: 'possible_duplicate',
      possibleDuplicates: possibleMatches
    };
  }

  // 3. Unique
  return {
    tier: 'unique'
  };
}
