import { SimilarityJobPayload } from './types';
import { tokenizeText } from './normalizers';

/**
 * Common boilerplate expressions that appear in public job postings
 * (EEO statements, standard company perks/benefits disclaimers, etc.)
 * which do not describe the structural identity of the opportunity.
 */
const BOILERPLATE_PATTERNS = [
  /equal\s+opportunity\s+employer/gi,
  /all\s+qualified\s+applicants\s+will\s+receive\s+consideration/gi,
  /without\s+regard\s+to\s+race,\s+color,\s+religion/gi,
  /affirmative\s+action/gi,
  /we\s+celebrate\s+diversity/gi,
  /reasonable\s+accommodations?\s+may\s+be\s+made/gi,
  /authorized\s+to\s+work\s+in\s+the\s+united\s+states/gi,
  /must\s+be\s+legally\s+authorized\s+to\s+work/gi,
  /health,\s+dental,\s+vision/gi,
  /401\(k\)\s+matching/gi,
  /paid\s+time\s+off/gi
];

/**
 * Strips common corporate boilerplate from a job description before tokenization.
 */
export function stripBoilerplate(text: string): string {
  if (!text) return '';
  let cleaned = text;
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  return cleaned;
}

/**
 * Computes Jaccard similarity between two token sets.
 * J(A, B) = |A ∩ B| / |A ∪ B|
 * Returns a float between 0.0 and 1.0.
 */
export function computeJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 1.0;
  }
  if (setA.size === 0 || setB.size === 0) {
    return 0.0;
  }

  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionCount++;
    }
  }

  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 1.0 : intersectionCount / unionCount;
}

/**
 * Calculates deterministic structural similarity between two job payloads.
 *
 * Compares:
 * 1. Required & preferred skills (token set Jaccard)
 * 2. Responsibilities (token set Jaccard)
 * 3. Description core text (stripped of boilerplate, token set Jaccard)
 *
 * Returns an integer score between 0 and 100, along with a component breakdown.
 */
export function calculateStructuralSimilarity(
  jobA: SimilarityJobPayload,
  jobB: SimilarityJobPayload
): {
  similarity: number;
  breakdown: {
    skills: number;
    responsibilities: number;
    description: number;
  };
} {
  // 1. Skills token sets
  const skillsTokensA = tokenizeText(
    [...(jobA.requiredSkills || []), ...(jobA.preferredSkills || [])].join(' ')
  );
  const skillsTokensB = tokenizeText(
    [...(jobB.requiredSkills || []), ...(jobB.preferredSkills || [])].join(' ')
  );
  const skillsScore = computeJaccardSimilarity(skillsTokensA, skillsTokensB);

  // 2. Responsibilities token sets
  const respTokensA = tokenizeText((jobA.responsibilities || []).join(' '));
  const respTokensB = tokenizeText((jobB.responsibilities || []).join(' '));
  const respScore = computeJaccardSimilarity(respTokensA, respTokensB);

  // 3. Description core keyword sets
  const descTokensA = tokenizeText(stripBoilerplate(jobA.description || ''));
  const descTokensB = tokenizeText(stripBoilerplate(jobB.description || ''));
  const descScore = computeJaccardSimilarity(descTokensA, descTokensB);

  // 4. Weighted combination based on available components
  const hasSkillsA = skillsTokensA.size > 0;
  const hasSkillsB = skillsTokensB.size > 0;
  const hasSkills = hasSkillsA && hasSkillsB;

  const hasRespA = respTokensA.size > 0;
  const hasRespB = respTokensB.size > 0;
  const hasResp = hasRespA && hasRespB;

  const hasDescA = descTokensA.size > 0;
  const hasDescB = descTokensB.size > 0;
  const hasDesc = hasDescA && hasDescB;

  let combined = 0;

  if (hasSkills && hasResp && hasDesc) {
    // Balanced structural weighting
    combined = skillsScore * 0.35 + respScore * 0.35 + descScore * 0.3;
  } else if (hasSkills && hasDesc) {
    combined = skillsScore * 0.5 + descScore * 0.5;
  } else if (hasResp && hasDesc) {
    combined = respScore * 0.5 + descScore * 0.5;
  } else if (hasSkills && hasResp) {
    combined = skillsScore * 0.5 + respScore * 0.5;
  } else if (hasDesc) {
    combined = descScore;
  } else if (hasSkills) {
    combined = skillsScore;
  } else if (hasResp) {
    combined = respScore;
  } else {
    combined = 0;
  }

  const similarity = Math.min(100, Math.max(0, Math.round(combined * 100)));

  return {
    similarity,
    breakdown: {
      skills: Math.round(skillsScore * 100),
      responsibilities: Math.round(respScore * 100),
      description: Math.round(descScore * 100)
    }
  };
}
