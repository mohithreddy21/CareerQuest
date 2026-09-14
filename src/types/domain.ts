/**
 * CareerQuest Domain Models
 *
 * Explicitly separated domain entities maintaining relational integrity via IDs:
 * Job -> JobAnalysis
 * Job -> JobMatch
 * Job -> ResumeVersion
 * Job -> Application
 * CandidateProfile -> ResumeVersion
 * ResumeVersion -> ResumeChange
 */

export type WorkArrangement = 'remote' | 'hybrid' | 'onsite' | 'unknown';

export type JobStatus = 'active' | 'archived' | 'duplicate';

export type SourceStatus = 'active' | 'closed' | 'unknown';
export type VerificationStatus = 'verified_accessible' | 'verification_failed' | 'unverified';
export type ReferenceRole = 'primary' | 'alternative';

export interface JobSourceReference {
  id: string;
  jobId: string;
  source: string;
  sourceJobId?: string | null;
  sourceUrl: string;
  normalizedUrl: string;
  sourceStatus: SourceStatus;
  verificationStatus: VerificationStatus;
  lastVerifiedAt?: Date | string | null;
  lastVerificationError?: string | null;
  isPrimary: boolean;
  referenceRole: ReferenceRole;
  firstSeenAt: Date | string;
  lastSeenAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export type CandidateJobStatus = 'UNSEEN' | 'VIEWED' | 'SAVED' | 'DISMISSED';

export interface CandidateJobState {
  id: string;
  candidateId: string;
  jobId: string;
  status: CandidateJobStatus;
  dismissedReason?: string | null;
  firstViewedAt?: Date | string | null;
  savedAt?: Date | string | null;
  dismissedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SavedSearch {
  id: string;
  candidateId: string;
  name: string;
  query?: string | null;
  locations: string[];
  workArrangements: string[];
  roleCategories: string[];
  seniorityLevels: string[];
  minSalary?: number | null;
  currency?: string | null;
  alertFrequency: 'instant' | 'daily' | 'weekly' | 'never' | string;
  filterVersion: string;
  lastExecutedAt?: Date | string | null;
  lastMatchCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ExtractedRequirement {
  id: string;
  text: string;
  category: 'required' | 'preferred';
  priority: 'high' | 'medium' | 'low';
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  workArrangement: WorkArrangement;
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceRequirement?: string;
  educationRequirement?: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string | null;
    interval?: 'yearly' | 'monthly' | 'hourly';
  };
  postedDate?: string;
  source: 'linkedin' | 'indeed' | 'url_import' | 'manual' | string;
  originalUrl?: string;
  normalizedAt: string;
  duplicateGroupId?: string;
  jobStatus: JobStatus;
  isPublic?: boolean;
  importedByCandidateId?: string;
  sourceReferences?: JobSourceReference[];
  candidateState?: CandidateJobState | null;
}

export type AnalysisStatus = 'idle' | 'processing' | 'success' | 'error';

export interface JobAnalysis {
  id: string;
  jobId: string; // Foreign key -> Job.id
  seniority: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  roleCategory: string;
  technicalRequirements: string[];
  softSkills: string[];
  importantKeywords: string[];
  extractedRequirements: ExtractedRequirement[];
  analysisStatus: AnalysisStatus;
}

export interface MatchPoint {
  requirementId?: string;
  title: string;
  detail: string;
  evidenceSource?: string;
  evidenceSnippet?: string;
}

export interface CandidateEvidencePoint {
  requirementText: string;
  evidenceSource: string;
  evidenceSnippet: string;
}

export interface JobMatch {
  id: string;
  jobId: string; // Foreign key -> Job.id
  candidateId: string; // Foreign key -> CandidateProfile.id
  score: number; // 0-100
  recommendation: 'strong' | 'good' | 'moderate' | 'low';
  headline: string;
  reasoning: string;
  strongMatches: MatchPoint[];
  partialMatches: MatchPoint[];
  missingRequirements: MatchPoint[];
  supportingCandidateEvidence: CandidateEvidencePoint[];
}

export interface CandidateExperience {
  id: string;
  employer: string;
  role: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  responsibilities: string[];
  achievements: string[];
  candidateEvidence?: string;
}

export interface CandidateEducation {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
  details?: string;
}

export interface CandidateSkills {
  technical: string[];
  tools: string[];
  soft: string[];
  other: string[];
}

export interface CandidateProject {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  contributions: string;
  outcomes?: string;
  url?: string;
}

export interface CandidateCertification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  credentialId?: string;
  url?: string;
}

export interface CandidatePreferences {
  targetRoles: string[];
  preferredLocations: string[];
  workArrangements: WorkArrangement[];
  targetSalaryMin?: number;
  currency?: string;
}

export interface CandidateProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  headline?: string;
  phone?: string;
  location: string;
  professionalSummary: string;
  targetRoles: string[];
  experience: CandidateExperience[];
  education: CandidateEducation[];
  skills: CandidateSkills;
  projects: CandidateProject[];
  certifications: CandidateCertification[];
  preferences: CandidatePreferences;
  masterResumeId: string;
}

export type ResumeChangeStatus = 'pending' | 'approved' | 'rejected' | 'edited';

export interface ResumeChange {
  id: string;
  candidateId?: string;
  jobId?: string;
  resumeVersionId: string; // Foreign key -> ResumeVersion.id
  section: 'summary' | 'experience' | 'skills' | 'projects';
  sectionItemId?: string;
  originalContent: string;
  proposedContent: string;
  editedContent?: string;
  rationale: string;
  jobRequirement: string;
  sourceCandidateEvidence: string;
  sourceKnowledgeItemIds: string[];
  evidenceReferences?: string[];
  status: ResumeChangeStatus;
  grounded?: boolean;
}

export interface ResumeVersion {
  id: string;
  candidateId: string; // Foreign key -> CandidateProfile.id
  masterResumeId?: string; // Foreign key -> ResumeVersion.id (if derived from master)
  jobId?: string; // Foreign key -> Job.id (if tailored for a job)
  targetCompany?: string;
  title: string;
  targetRole: string;
  summary: string;
  experience: CandidateExperience[];
  education: CandidateEducation[];
  skills: CandidateSkills;
  projects: CandidateProject[];
  certifications: CandidateCertification[];
  changes: ResumeChange[];
  approvalState: 'draft' | 'in_review' | 'approved';
  createdAt: string;
  updatedAt: string;
}

export type TailoredResumeVersion = ResumeVersion;

export type ApplicationStatus =
  | 'discovered'
  | 'interested'
  | 'preparing'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  discovered: 'Discovered',
  interested: 'Interested',
  preparing: 'Preparing',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

export const APPLICATION_STAGES: ApplicationStatus[] = [
  'discovered',
  'interested',
  'preparing',
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn'
];

export interface ApplicationAnswer {
  id: string;
  question: string;
  suggestedAnswer: string;
  contextUsed: string;
  reviewed: boolean;
}

export interface StatusHistoryEntry {
  status: ApplicationStatus;
  timestamp: string;
  note?: string;
}

export interface Application {
  id: string;
  jobId: string; // Foreign key -> Job.id
  candidateId: string; // Foreign key -> CandidateProfile.id
  status: ApplicationStatus;
  dateDiscovered: string;
  dateApplied?: string;
  dateClosed?: string; // Recorded when status transitions to offer, rejected, or withdrawn
  isArchived?: boolean; // UI visibility flag for archiving stale/closed applications

  // Historical snapshots & references
  resumeVersionId?: string; // Foreign key -> ResumeVersion.id
  tailoredResumeVersionId?: string; // Foreign key -> TailoredResumeVersion.id
  selectedTemplateId?: import('./templates').ResumeTemplateId;
  selectedTemplateVersion?: string;
  matchScoreAtApplication?: number; // Preserved match score snapshot at time of application
  resumeSnapshot?: import('./resume-content').ResumeContent; // Frozen snapshot JSON captured at confirmation

  // Prepared materials
  coverLetter?: string;
  coverLetterData?: import('./preparation').GroundedCoverLetter;
  applicationAnswers?: ApplicationAnswer[];
  preparedQuestions?: import('./preparation').GroundedApplicationQuestion[];
  exports?: import('./templates').ResumeExport[];

  // Tracking details
  notes?: string;
  interviewStages?: import('./application-tracking').InterviewStage[];
  contacts?: import('./application-tracking').ApplicationContact[];

  // Active follow-up state
  followUpDate?: string; // YYYY-MM-DD
  followUpStatus?: import('./application-tracking').FollowUpStatus;
  followUpNote?: string;

  // Event audit trail & optimistic concurrency
  statusHistory: StatusHistoryEntry[];
  version?: number;
}

export * from './knowledge';
export * from './tailoring';
export * from './resume-content';
export * from './templates';
export * from './preparation';
export * from './application-tracking';
