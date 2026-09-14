import { Job, JobAnalysis, JobMatch } from '@/types/domain';

export type JobSourceType =
  | 'greenhouse'
  | 'lever'
  | 'generic'
  | 'manual'
  | 'linkedin'
  | 'indeed'
  | 'workday'
  | 'company_site'
  | 'url_import';

export type SalaryInterval = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RawJobExtraction {
  title: string;
  company: string;
  location: string;
  workArrangement: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceRequirement?: string | null;
  educationRequirement?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryInterval?: SalaryInterval | null;
  postedDate?: string | null;
  source: string;
  sourceJobId?: string | null;
  sourceUrl: string;
  normalizedUrl?: string;
}

export interface SourceDetectionResult {
  source: JobSourceType | 'unsupported';
  confidence: 'high' | 'medium' | 'low';
  isSupported: boolean;
  reason?: string;
  metadata?: {
    companySlug?: string;
    jobId?: string;
  };
}

export interface AdapterExtractionContext {
  url: string;
  normalizedUrl: string;
  content: string; // HTML or plain text body
  contentType?: string | null;
  sourceDetection: SourceDetectionResult;
  allowHttpForTesting?: boolean;
}

export interface JobSourceAdapter {
  readonly id: string;
  readonly name: string;
  canHandle(detection: SourceDetectionResult, url?: URL): boolean;
  extract(context: AdapterExtractionContext): Promise<RawJobExtraction>;
}

export type AdapterErrorCode =
  | 'SOURCE_NOT_SUPPORTED'
  | 'SOURCE_FETCH_FAILED'
  | 'SOURCE_PARSE_FAILED'
  | 'INVALID_JOB_CONTENT'
  | 'MISSING_REQUIRED_JOB_FIELD'
  | 'NORMALIZATION_FAILED';

export class AdapterError extends Error {
  readonly code: AdapterErrorCode;
  readonly internalDetails?: string;

  constructor(code: AdapterErrorCode, clientMessage: string, internalDetails?: string) {
    super(clientMessage);
    this.name = 'AdapterError';
    this.code = code;
    this.internalDetails = internalDetails;
  }
}

export interface NormalizedJobData {
  title: string;
  company: string;
  location: string;
  workArrangement: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceRequirement?: string | null;
  educationRequirement?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryInterval?: SalaryInterval | null;
  postedDate?: string | null;
  source: string;
  sourceJobId?: string | null;
  sourceUrl: string;
  normalizedUrl: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingJob?: Job;
  matchReason?: 'exact_source_reference' | 'exact_url';
  message?: string;
}

export interface ImportJobResult {
  success: boolean;
  isDuplicate?: boolean;
  existingJob?: Job;
  job?: Job;
  analysis?: JobAnalysis;
  match?: JobMatch;
  adapterName?: string;
  error?: string;
  errorCode?: AdapterErrorCode;
}
