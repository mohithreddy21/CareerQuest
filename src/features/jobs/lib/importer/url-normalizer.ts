import { URL } from 'node:url';

/**
 * List of known tracking / analytics query parameters that can be safely stripped
 * without altering the target job identity.
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'ref',
  'trk',
  'tracking',
  '_ga',
  '_gl',
  'mc_eid',
  'campaign',
  'source'
]);

/**
 * Normalizes an external job URL into a canonical format for source identity
 * and deduplication.
 *
 * Rules:
 * 1. Strips hash fragments.
 * 2. Normalizes protocol and hostname to lowercase.
 * 3. Strips standard default ports (80 for http, 443 for https).
 * 4. Normalizes trailing slashes (strips trailing slash unless root path).
 * 5. Conservatively removes tracking parameters while preserving meaningful ATS identifiers.
 * 6. Canonicalizes known ATS structures (Greenhouse, Lever).
 * 7. Deterministically sorts retained query parameters.
 */
export function normalizeJobUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Handle manual pseudo-URLs directly
  if (trimmed.startsWith('manual:')) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // If not a valid URL, return trimmed lowercase
    return trimmed.toLowerCase();
  }

  // 1. Protocol normalization
  let protocol = parsed.protocol.toLowerCase();
  if (!protocol.endsWith(':')) protocol += ':';

  // 2. Hostname normalization
  const hostname = parsed.hostname.toLowerCase();

  // 3. Port normalization (remove default ports)
  let port = parsed.port;
  if ((protocol === 'https:' && port === '443') || (protocol === 'http:' && port === '80')) {
    port = '';
  }

  // 4. Path normalization
  let pathname = parsed.pathname || '/';
  // Remove trailing slashes for non-root paths
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '');
  }

  // 5. Query parameters normalization
  const retainedParams: [string, string][] = [];
  parsed.searchParams.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!TRACKING_PARAMS.has(lowerKey)) {
      retainedParams.push([key, value]);
    }
  });

  // Sort retained query parameters for deterministic canonical output
  retainedParams.sort((a, b) => a[0].localeCompare(b[0]));

  // 6. ATS-specific Canonicalization
  if (hostname.includes('greenhouse.io')) {
    // Canonicalize job-boards.greenhouse.io to boards.greenhouse.io if identical path pattern
    const isStandardBoard = /^\/([^/]+)\/jobs\/(\d+)/i.exec(pathname);
    if (isStandardBoard) {
      const companySlug = isStandardBoard[1].toLowerCase();
      const jobId = isStandardBoard[2];
      pathname = `/${companySlug}/jobs/${jobId}`;
    }
  } else if (hostname.includes('lever.co')) {
    // e.g. jobs.lever.co/{company}/{jobId}
    const isLeverJob = /^\/([^/]+)\/([a-f0-9-]+)/i.exec(pathname);
    if (isLeverJob) {
      const companySlug = isLeverJob[1].toLowerCase();
      const jobId = isLeverJob[2];
      pathname =
        `/${companySlug}/jobs/${jobId}` === pathname ? pathname : `/${companySlug}/${jobId}`;
    }
  }

  // Assemble canonical normalized URL
  const hostWithPort = port ? `${hostname}:${port}` : hostname;
  let canonical = `${protocol}//${hostWithPort}${pathname}`;

  if (retainedParams.length > 0) {
    const searchString = retainedParams
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    canonical += `?${searchString}`;
  }

  return canonical;
}
