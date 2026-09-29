import { JobSourceReference } from '@/types/domain';
import { SourceVerificationEvaluation } from './types';

/**
 * Source authority tiers:
 * Tier 1 (100): Direct company ATS integrations (Greenhouse, Lever, Ashby, Workday)
 * Tier 2 (75):  Direct company career pages / company portals
 * Tier 3 (50):  Aggregators / general job boards (LinkedIn, Indeed)
 * Tier 4 (25):  Candidate-provided manual text or generic imports
 */
export function getSourceAuthorityRank(source: string): number {
  if (!source) return 10;
  const s = source.toLowerCase().trim();

  // Tier 1: ATS
  if (s === 'greenhouse' || s === 'lever' || s === 'ashby' || s === 'workday') {
    return 100;
  }

  // Tier 2: Company direct / portal
  if (s === 'company_portal' || s === 'company_site' || s === 'generic') {
    return 75;
  }

  // Tier 3: Aggregators
  if (s === 'linkedin' || s === 'indeed') {
    return 50;
  }

  // Tier 4: Manual text
  if (s === 'manual' || s === 'url_import') {
    return 25;
  }

  return 10;
}

/**
 * Evaluates whether a source reference is currently "usable".
 *
 * A source is usable when:
 *   sourceStatus === 'active'
 *   AND (
 *     verificationStatus === 'verified_accessible'
 *     OR (verificationStatus === 'unverified' AND within 24-hour grace period)
 *   )
 *
 * A source is NOT usable when:
 *   verification_failed, OR unknown, OR closed, OR unverified beyond 24 hours.
 */
export function isSourceUsable(
  ref: Pick<JobSourceReference, 'sourceStatus' | 'verificationStatus' | 'firstSeenAt'>,
  now = new Date()
): boolean {
  if (ref.sourceStatus !== 'active') {
    return false;
  }

  if (ref.verificationStatus === 'verified_accessible') {
    return true;
  }

  if (ref.verificationStatus === 'unverified') {
    const firstSeen = new Date(ref.firstSeenAt);
    const ageMs = now.getTime() - firstSeen.getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    return ageMs <= twentyFourHoursMs;
  }

  // verification_failed or any other state
  return false;
}

/**
 * Determines whether an incoming source reference should displace an existing primary reference.
 *
 * Rules:
 * 1. If existing primary is closed or unusable, promote target if target is active.
 * 2. If incoming source has strictly higher authority rank than existing primary, promote incoming.
 * 3. If authority ranks are equal, DO NOT demote existing (earlier firstSeen wins).
 */
export function shouldPromoteNewSource(
  incomingSource: string,
  existingPrimary: JobSourceReference | null | undefined
): boolean {
  if (!existingPrimary) {
    return true;
  }

  // If existing primary is explicitly closed, any active incoming source takes over
  if (existingPrimary.sourceStatus === 'closed') {
    return true;
  }

  // If existing primary is not usable, and incoming source is higher or equal authority, promote incoming
  const existingIsUsable = isSourceUsable(existingPrimary);
  const incomingRank = getSourceAuthorityRank(incomingSource);
  const existingRank = getSourceAuthorityRank(existingPrimary.source);

  if (!existingIsUsable && incomingRank >= existingRank) {
    return true;
  }

  // Higher authority source always takes precedence (e.g. Greenhouse over LinkedIn)
  return incomingRank > existingRank;
}

/**
 * Selects the optimal primary source from a collection of source references.
 *
 * Ranking criteria:
 * 1. Usability (usable sources prioritized over unusable)
 * 2. Source authority rank (descending)
 * 3. Earliest firstSeenAt (ascending)
 * 4. Stable ID tie-breaker
 */
export function selectBestPrimarySource(
  sources: JobSourceReference[],
  now = new Date()
): JobSourceReference | null {
  if (!sources || sources.length === 0) {
    return null;
  }

  // Filter out definitively closed sources if active alternatives exist
  const activeSources = sources.filter((s) => s.sourceStatus !== 'closed');
  const candidatePool = activeSources.length > 0 ? activeSources : sources;

  const sorted = [...candidatePool].toSorted((a, b) => {
    // 1. Usability
    const aUsable = isSourceUsable(a, now);
    const bUsable = isSourceUsable(b, now);
    if (aUsable && !bUsable) return -1;
    if (!aUsable && bUsable) return 1;

    // 2. Authority Rank
    const aRank = getSourceAuthorityRank(a.source);
    const bRank = getSourceAuthorityRank(b.source);
    if (aRank !== bRank) {
      return bRank - aRank; // Descending
    }

    // 3. Earliest firstSeenAt
    const aTime = new Date(a.firstSeenAt).getTime();
    const bTime = new Date(b.firstSeenAt).getTime();
    if (aTime !== bTime) {
      return aTime - bTime; // Ascending (earliest first)
    }

    // 4. Stable ID
    return a.id.localeCompare(b.id);
  });

  return sorted[0] || null;
}

const ATS_CLOSED_MARKERS = [
  /this\s+job\s+is\s+no\s+longer\s+available/i,
  /this\s+job\s+has\s+closed/i,
  /posting\s+has\s+expired/i,
  /(?:not|no\s+longer)\s+accepting\s+(?:new\s+)?applications/i,
  /this\s+position\s+has\s+been\s+filled/i,
  /this\s+requisition\s+has\s+been\s+closed/i,
  /job-expired-view/i,
  /ph-page-state=["']expired["']/i,
  /expire_job\.png/i
];

/**
 * Distinguishes source availability from source verification.
 *
 * Authoritative closure evidence:
 * - HTTP 404 (Not Found)
 * - HTTP 410 (Gone)
 * - Explicit ATS closed text marker in the HTML
 *
 * Transient / non-closure failures:
 * - Network timeouts (408 or fetch timeout)
 * - DNS resolution failures
 * - 403 Forbidden / Cloudflare challenge
 * - 429 Rate limiting
 * - 500 / 502 / 503 server errors
 * - Content parse failures
 *
 * Transient failures MUST NOT mark a source closed. They record verification_failed.
 */
export function evaluateSourceVerification(
  currentRef: Pick<JobSourceReference, 'sourceStatus' | 'verificationStatus'>,
  result: {
    statusCode?: number;
    body?: string;
    error?: string;
  }
): SourceVerificationEvaluation {
  const { statusCode, body, error } = result;

  // 1. Check authoritative HTTP closure status
  if (statusCode === 404 || statusCode === 410) {
    return {
      newSourceStatus: 'closed',
      newVerificationStatus: 'verified_accessible',
      error: error || `Remote server returned HTTP ${statusCode} (Posting closed)`,
      isAuthoritativeClose: true
    };
  }

  // 2. Check explicit closed markers in page content
  if (body) {
    for (const marker of ATS_CLOSED_MARKERS) {
      if (marker.test(body)) {
        return {
          newSourceStatus: 'closed',
          newVerificationStatus: 'verified_accessible',
          error: 'Remote page indicates posting is no longer accepting applications.',
          isAuthoritativeClose: true
        };
      }
    }
  }

  // 3. Successful fetch without closure indicators
  if (statusCode && statusCode >= 200 && statusCode < 300) {
    return {
      newSourceStatus: 'active',
      newVerificationStatus: 'verified_accessible',
      isAuthoritativeClose: false
    };
  }

  // 4. Transient failures (timeout, DNS, 403, 5xx, parser errors)
  // MUST preserve existing sourceStatus and record verification_failed!
  return {
    newSourceStatus: currentRef.sourceStatus,
    newVerificationStatus: 'verification_failed',
    error:
      error ||
      `Verification encountered non-authoritative failure (status: ${statusCode || 'unknown'}).`,
    isAuthoritativeClose: false
  };
}

/**
 * Aggregates canonical Job status across all of its source references.
 *
 * Rules:
 * - If current job status is explicitly 'archived' or 'duplicate', retain it.
 * - If all known source references are 'closed', jobStatus becomes 'closed'.
 * - If any known source reference is 'active', jobStatus is 'active'.
 * - Otherwise retains current status.
 */
export function aggregateJobStatus(
  sources: Array<Pick<JobSourceReference, 'sourceStatus'>>,
  currentStatus: string = 'active'
): 'active' | 'closed' | 'archived' | 'duplicate' {
  if (currentStatus === 'archived' || currentStatus === 'duplicate') {
    return currentStatus as 'archived' | 'duplicate';
  }

  if (sources.length === 0) {
    return 'active';
  }

  const allClosed = sources.every((s) => s.sourceStatus === 'closed');
  if (allClosed) {
    return 'closed';
  }

  const anyActive = sources.some((s) => s.sourceStatus === 'active');
  if (anyActive) {
    return 'active';
  }

  return 'active';
}
