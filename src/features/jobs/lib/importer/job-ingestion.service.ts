import { detectSource } from './source-detector';
import { normalizeJobUrl } from './url-normalizer';
import { resolveAdapter } from './adapter-registry';
import { normalizeJobExtraction } from './job-normalizer';
import { evaluateSourceVerification } from '../dedup/source-intelligence';
import { evaluateJobExtractionQuality } from './job-extraction-quality';
import {
  AdapterError,
  ExtractionQualityState,
  ImportJobResult,
  NormalizedJobData,
  RawJobExtraction
} from './types';

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
  extractionQuality?: ExtractionQualityState;
  extractionQualityReasons?: string[];
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

  // 5. Source Lifecycle Evaluation (detect authoritative closure markers in content)
  const verification = evaluateSourceVerification(
    { sourceStatus: 'active', verificationStatus: 'verified_accessible' },
    { statusCode: fetchResult.status, body: fetchResult.body }
  );
  rawExtraction.sourceStatus = verification.newSourceStatus;
  rawExtraction.closeReason = verification.isAuthoritativeClose ? verification.error || null : null;

  // 6. Extraction Quality Gate
  const quality = evaluateJobExtractionQuality(rawExtraction);
  rawExtraction.extractionQuality = quality.state;
  rawExtraction.extractionQualityReasons = quality.reasons;

  if (quality.state === 'insufficient') {
    return {
      adapterName: adapter.name,
      source: detection.source,
      normalizedUrl,
      error:
        "We accessed the page, but couldn't reliably identify the job posting. The page may require login, contain search results, or block automated extraction. Please paste the job description directly.",
      errorCode: 'INVALID_JOB_CONTENT',
      extractionQuality: 'insufficient',
      extractionQualityReasons: quality.reasons
    };
  }

  // 7. Field Normalization & Content Sanitization
  const normalizedData = normalizeJobExtraction(rawExtraction);

  return {
    data: normalizedData,
    adapterName: adapter.name,
    source: detection.source,
    normalizedUrl,
    extractionQuality: quality.state,
    extractionQualityReasons: quality.reasons
  };
}

/**
 * Extracts, sanitizes, and normalizes candidate-provided manual job text.
 * Uses deterministic extraction first, followed by AI Orchestrator (Gemini) when helpful,
 * and validates through the Extraction Quality Gate.
 */
export async function ingestJobFromManualText(options: IngestTextOptions): Promise<{
  data?: NormalizedJobData;
  adapterName: string;
  source: string;
  normalizedUrl: string;
  error?: string;
  errorCode?: ImportJobResult['errorCode'];
  extractionQuality?: 'reliable' | 'partial' | 'insufficient';
  extractionQualityReasons?: string[];
}> {
  const { text, title, company } = options;

  if (!text || text.trim().length < 20) {
    return {
      adapterName: 'Manual Text Extraction',
      source: 'manual',
      normalizedUrl: 'manual://empty',
      error: 'Please paste a complete job description (at least 20 characters).',
      errorCode: 'INVALID_JOB_CONTENT',
      extractionQuality: 'insufficient'
    };
  }

  if (text.length > 50000) {
    return {
      adapterName: 'Manual Text Extraction',
      source: 'manual',
      normalizedUrl: 'manual://oversized',
      error: 'Job description text exceeds maximum limit of 50,000 characters.',
      errorCode: 'INVALID_JOB_CONTENT',
      extractionQuality: 'insufficient'
    };
  }

  const detection = detectSource('manual:');
  const adapter = resolveAdapter(detection);
  const pseudoUrl = `manual:${Date.now()}`;
  const normalizedUrl = normalizeJobUrl(pseudoUrl);

  // 1. Deterministic Extraction First
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
        errorCode: err.code,
        extractionQuality: 'insufficient'
      };
    }
    return {
      adapterName: adapter.name,
      source: 'manual',
      normalizedUrl,
      error: 'Failed to parse manual job text.',
      errorCode: 'SOURCE_PARSE_FAILED',
      extractionQuality: 'insufficient'
    };
  }

  if (title) rawExtraction.title = title;
  if (company) rawExtraction.company = company;

  // Evaluate deterministic quality
  let quality = evaluateJobExtractionQuality(rawExtraction);

  // 2. If deterministic extraction is partial or lacks skills, invoke AI Orchestrator
  if (quality.state !== 'reliable') {
    try {
      const { aiOrchestrator } = await import('@/lib/ai');
      const aiResult = await aiOrchestrator.dispatch<import('@/lib/ai').JobExtractOutput>(
        'JOB_EXTRACT',
        {
          text,
          hints: { title: title || rawExtraction.title, company: company || rawExtraction.company }
        }
      );

      const aiData = aiResult.data;
      if (aiData.title) rawExtraction.title = aiData.title;
      if (aiData.company) rawExtraction.company = aiData.company;
      if (aiData.location) rawExtraction.location = aiData.location;
      if (aiData.workArrangement && aiData.workArrangement !== 'unknown') {
        rawExtraction.workArrangement = aiData.workArrangement;
      }
      if (aiData.description) rawExtraction.description = aiData.description;
      if (aiData.responsibilities && aiData.responsibilities.length > 0) {
        rawExtraction.responsibilities = aiData.responsibilities;
      }
      if (aiData.requiredSkills && aiData.requiredSkills.length > 0) {
        rawExtraction.requiredSkills = aiData.requiredSkills;
      }
      if (aiData.preferredSkills && aiData.preferredSkills.length > 0) {
        rawExtraction.preferredSkills = aiData.preferredSkills;
      }
      if (aiData.experienceRequirement) {
        rawExtraction.experienceRequirement = aiData.experienceRequirement;
      }
      if (aiData.educationRequirement) {
        rawExtraction.educationRequirement = aiData.educationRequirement;
      }
      if (aiData.salaryMin !== null && aiData.salaryMin !== undefined) {
        rawExtraction.salaryMin = aiData.salaryMin;
      }
      if (aiData.salaryMax !== null && aiData.salaryMax !== undefined) {
        rawExtraction.salaryMax = aiData.salaryMax;
      }
      if (aiData.salaryCurrency) rawExtraction.salaryCurrency = aiData.salaryCurrency;
      if (aiData.salaryInterval) rawExtraction.salaryInterval = aiData.salaryInterval;

      // Re-evaluate quality with AI-enriched structured fields
      quality = evaluateJobExtractionQuality(rawExtraction);
    } catch {
      // Deterministic extraction remains intact if AI is unavailable or offline
    }
  }

  rawExtraction.extractionQuality = quality.state;
  rawExtraction.extractionQualityReasons = quality.reasons;

  if (quality.state === 'insufficient') {
    return {
      adapterName: adapter.name,
      source: 'manual',
      normalizedUrl,
      error:
        "We couldn't reliably identify a job posting from the pasted text. Please include the role title and description.",
      errorCode: 'INVALID_JOB_CONTENT',
      extractionQuality: 'insufficient',
      extractionQualityReasons: quality.reasons
    };
  }

  const normalizedData = normalizeJobExtraction(rawExtraction);

  return {
    data: normalizedData,
    adapterName: adapter.name,
    source: 'manual',
    normalizedUrl,
    extractionQuality: quality.state,
    extractionQualityReasons: quality.reasons
  };
}
