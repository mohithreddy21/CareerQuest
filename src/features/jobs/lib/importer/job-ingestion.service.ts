import { detectSource } from './source-detector';
import { normalizeJobUrl } from './url-normalizer';
import { resolveAdapter } from './adapter-registry';
import { normalizeJobExtraction } from './job-normalizer';
import { AdapterError, ImportJobResult, NormalizedJobData, RawJobExtraction } from './types';

export interface IngestUrlOptions {
  url: string;
  force?: boolean;
  allowHttpForTesting?: boolean;
}

export interface IngestTextOptions {
  text: string;
  title?: string;
  company?: string;
}

/**
 * Extracts, sanitizes, and normalizes an external job URL through the secure ingestion pipeline.
 *
 * Pipeline:
 * 1. Source Detection
 * 2. URL Normalization
 * 3. Secure ServerJobFetcher (SSRF protection, DNS pinning, redirects, bounds)
 * 4. Source Adapter Execution
 * 5. Field Normalization & Sanitization
 */
export async function ingestJobFromUrl(options: IngestUrlOptions): Promise<{
  data?: NormalizedJobData;
  adapterName: string;
  source: string;
  normalizedUrl: string;
  error?: string;
  errorCode?: ImportJobResult['errorCode'];
}> {
  const { url, allowHttpForTesting = false } = options;

  // 1. Source Detection
  const detection = detectSource(url);
  if (!detection.isSupported || detection.source === 'unsupported') {
    return {
      adapterName: 'Unknown',
      source: 'unknown',
      normalizedUrl: url,
      error: detection.reason || 'The provided URL is not a supported web address.',
      errorCode: 'SOURCE_NOT_SUPPORTED'
    };
  }

  // 2. URL Normalization
  const normalizedUrl = normalizeJobUrl(url);

  // 3. Secure HTTP Retrieval via ServerJobFetcher (dynamically imported to protect client bundles)
  let fetchResult;
  try {
    const { ServerJobFetcher, ServerJobFetcherError } =
      await import('@/services/fetcher/server-job-fetcher');
    try {
      fetchResult = await ServerJobFetcher.fetch(url, {
        allowHttpForTesting
      });
    } catch (err: unknown) {
      if (err instanceof ServerJobFetcherError) {
        return {
          adapterName: detection.source,
          source: detection.source,
          normalizedUrl,
          error: err.message,
          errorCode: 'SOURCE_FETCH_FAILED'
        };
      }
      return {
        adapterName: detection.source,
        source: detection.source,
        normalizedUrl,
        error: 'Failed to safely retrieve remote job posting.',
        errorCode: 'SOURCE_FETCH_FAILED'
      };
    }
  } catch {
    return {
      adapterName: detection.source,
      source: detection.source,
      normalizedUrl,
      error: 'Failed to initialize secure server fetcher.',
      errorCode: 'SOURCE_FETCH_FAILED'
    };
  }

  // 4. Resolve Adapter & Extract
  let parsedFinalUrl: URL | undefined;
  try {
    parsedFinalUrl = new URL(fetchResult.finalUrl);
  } catch {
    // Non-fatal
  }

  const adapter = resolveAdapter(detection, parsedFinalUrl);
  let rawExtraction: RawJobExtraction;

  try {
    rawExtraction = await adapter.extract({
      url,
      normalizedUrl,
      content: fetchResult.body,
      contentType: fetchResult.contentType,
      sourceDetection: detection,
      allowHttpForTesting
    });
  } catch (err: unknown) {
    if (err instanceof AdapterError) {
      return {
        adapterName: adapter.name,
        source: detection.source,
        normalizedUrl,
        error: err.message,
        errorCode: err.code
      };
    }
    return {
      adapterName: adapter.name,
      source: detection.source,
      normalizedUrl,
      error: 'Failed to extract job details from the remote posting.',
      errorCode: 'SOURCE_PARSE_FAILED'
    };
  }

  // 5. Field Normalization & Content Sanitization
  const normalizedData = normalizeJobExtraction(rawExtraction);

  return {
    data: normalizedData,
    adapterName: adapter.name,
    source: detection.source,
    normalizedUrl
  };
}

/**
 * Extracts, sanitizes, and normalizes candidate-provided manual job text.
 * Runs completely locally with ZERO network access.
 */
export async function ingestJobFromManualText(options: IngestTextOptions): Promise<{
  data?: NormalizedJobData;
  adapterName: string;
  source: string;
  normalizedUrl: string;
  error?: string;
  errorCode?: ImportJobResult['errorCode'];
}> {
  const { text, title, company } = options;
  const detection = detectSource('manual:');

  const adapter = resolveAdapter(detection);
  const pseudoUrl = `manual:${Date.now()}`;
  const normalizedUrl = normalizeJobUrl(pseudoUrl);

  let rawExtraction: RawJobExtraction;
  try {
    rawExtraction = await adapter.extract({
      url: pseudoUrl,
      normalizedUrl,
      content: text,
      sourceDetection: detection
    });
  } catch (err: unknown) {
    if (err instanceof AdapterError) {
      return {
        adapterName: adapter.name,
        source: 'manual',
        normalizedUrl,
        error: err.message,
        errorCode: err.code
      };
    }
    return {
      adapterName: adapter.name,
      source: 'manual',
      normalizedUrl,
      error: 'Failed to parse manual job text.',
      errorCode: 'SOURCE_PARSE_FAILED'
    };
  }

  if (title) rawExtraction.title = title;
  if (company) rawExtraction.company = company;

  const normalizedData = normalizeJobExtraction(rawExtraction);

  return {
    data: normalizedData,
    adapterName: adapter.name,
    source: 'manual',
    normalizedUrl
  };
}
