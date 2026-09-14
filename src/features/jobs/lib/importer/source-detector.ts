import { SourceDetectionResult } from './types';

/**
 * Deterministically detects the job source and ATS category from a URL.
 * Execution takes place before adapter extraction and network fetching.
 */
export function detectSource(rawUrl: string): SourceDetectionResult {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    return {
      source: 'unsupported',
      confidence: 'high',
      isSupported: false,
      reason: 'URL cannot be empty.'
    };
  }

  // Handle manual input pseudo-URL
  if (trimmed.startsWith('manual:') || trimmed.startsWith('text:')) {
    return {
      source: 'manual',
      confidence: 'high',
      isSupported: true
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      source: 'unsupported',
      confidence: 'high',
      isSupported: false,
      reason: 'Invalid URL format.'
    };
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== 'http:' && scheme !== 'https:') {
    return {
      source: 'unsupported',
      confidence: 'high',
      isSupported: false,
      reason: `Unsupported URL scheme: ${scheme}. Only HTTP and HTTPS are permitted.`
    };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // 1. Greenhouse ATS Detection
  if (
    host === 'boards.greenhouse.io' ||
    host === 'job-boards.greenhouse.io' ||
    host.endsWith('.greenhouse.io') ||
    path.includes('/greenhouse/') ||
    parsed.searchParams.has('gh_jid')
  ) {
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    let companySlug: string | undefined;
    let jobId: string | undefined;

    if (pathParts[0] === 'embed' && pathParts[1] === 'job_app') {
      companySlug = parsed.searchParams.get('for') || undefined;
      jobId = parsed.searchParams.get('token') || parsed.searchParams.get('gh_jid') || undefined;
    } else if (pathParts.length >= 3 && pathParts[1] === 'jobs') {
      companySlug = pathParts[0];
      jobId = pathParts[2];
    } else if (pathParts.length >= 1) {
      companySlug = pathParts[0];
    }

    return {
      source: 'greenhouse',
      confidence: 'high',
      isSupported: true,
      metadata: {
        companySlug,
        jobId: jobId || parsed.searchParams.get('gh_jid') || undefined
      }
    };
  }

  // 2. Lever ATS Detection
  if (host === 'jobs.lever.co' || host.endsWith('.lever.co') || path.includes('/lever/')) {
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    let companySlug: string | undefined;
    let jobId: string | undefined;

    if (pathParts.length >= 2) {
      companySlug = pathParts[0];
      jobId = pathParts[1];
    } else if (pathParts.length >= 1) {
      companySlug = pathParts[0];
    }

    return {
      source: 'lever',
      confidence: 'high',
      isSupported: true,
      metadata: {
        companySlug,
        jobId
      }
    };
  }

  // 3. Generic Public Job Page (Fallback)
  return {
    source: 'generic',
    confidence: 'medium',
    isSupported: true
  };
}
