import {
  ApplicationStatus,
  Job,
  JobAnalysis,
  JobMatch,
  JobSourceReference,
  CandidateJobState,
  CandidateJobStatus,
  SavedSearch,
  SourceStatus,
  VerificationStatus,
  ReferenceRole
} from '@/types/domain';

export type {
  Job,
  JobAnalysis,
  JobMatch,
  JobSourceReference,
  CandidateJobState,
  CandidateJobStatus,
  SavedSearch,
  SourceStatus,
  VerificationStatus,
  ReferenceRole
};

export interface JobWithMatch extends Job {
  match?: JobMatch | null;
  applicationStatus?: ApplicationStatus | null;
}

export interface JobFilters {
  search?: string;
  source?: string;
  workArrangement?: string;
  status?: string;
  minMatch?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface JobsResponse {
  items: JobWithMatch[];
  total_items: number;
}

export interface ImportJobPayload {
  url: string;
  force?: boolean;
}

export interface ImportJobResponse {
  success: boolean;
  isDuplicate?: boolean;
  existingJob?: Job;
  job?: Job;
  analysis?: JobAnalysis;
  match?: JobMatch;
  adapterName?: string;
  error?: string;
}
