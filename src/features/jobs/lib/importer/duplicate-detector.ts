import { Job } from '@/types/domain';
import { DuplicateCheckResult, RawJobExtraction } from './types';
import { normalizeJobUrl } from './url-normalizer';

/**
 * Checks for exact source identity duplication in memory.
 * Note: Cross-source fuzzy deduplication is deferred to Phase 7C.
 */
export function checkForDuplicate(
  raw: RawJobExtraction,
  existingJobs: Job[]
): DuplicateCheckResult {
  const normalizedIncomingUrl = normalizeJobUrl(raw.sourceUrl);

  const exactUrlMatch = existingJobs.find(
    (j) => j.originalUrl && normalizeJobUrl(j.originalUrl) === normalizedIncomingUrl
  );

  if (exactUrlMatch) {
    return {
      isDuplicate: true,
      existingJob: exactUrlMatch,
      matchReason: 'exact_source_reference',
      message: `This posting has already been imported (${exactUrlMatch.title} at ${exactUrlMatch.company}).`
    };
  }

  return {
    isDuplicate: false
  };
}
