import { Job } from '@/types/domain';

export type DeduplicationTier =
  | 'exact_match'
  | 'strong_duplicate'
  | 'possible_duplicate'
  | 'unique';

export interface DeduplicationEvidence {
  companyMatch: boolean;
  titleMatch: boolean;
  locationMatch: boolean;
  structuralSimilarity: number; // 0 - 100
  breakdown: {
    skills: number;
    responsibilities: number;
    description: number;
  };
  reasons: string[];
}

export interface DeduplicationResult {
  tier: DeduplicationTier;
  canonicalJob?: Job;
  duplicateGroupId?: string;
  evidence?: DeduplicationEvidence;
  possibleDuplicates?: Array<{
    job: Job;
    evidence: DeduplicationEvidence;
  }>;
}

export interface SimilarityJobPayload {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  responsibilities?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
}

export type SourceAuthorityTier = 1 | 2 | 3 | 4;

export interface SourceVerificationEvaluation {
  newSourceStatus: 'active' | 'closed' | 'unknown';
  newVerificationStatus: 'verified_accessible' | 'verification_failed' | 'unverified';
  error?: string;
  isAuthoritativeClose: boolean;
}
