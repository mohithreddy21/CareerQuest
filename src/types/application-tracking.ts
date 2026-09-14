import { ResumeTemplateId } from './templates';

// 1. Recruiter & Key Contact Information
export interface ApplicationContact {
  id: string;
  name: string;
  role: string; // e.g. "Lead Technical Recruiter", "Hiring Manager", "Peer Engineer"
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  notes?: string;
  createdAt: string;
}

// 2. Interview Stage Record
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled';
export type InterviewOutcome = 'passed' | 'failed' | 'inconclusive' | 'pending';

export interface InterviewStage {
  id: string;
  stageName: string; // e.g. "Recruiter Screen", "System Architecture", "Hiring Manager"
  scheduledDate?: string; // ISO string
  completedDate?: string; // ISO string
  interviewerNames?: string[];
  meetingLink?: string;
  location?: string; // e.g. "Google Meet", "Zoom", "Onsite"
  notes?: string;
  status: InterviewStatus;
  outcome?: InterviewOutcome;
  feedback?: string;
}

// 3. Follow-Up System
export type FollowUpStatus = 'pending' | 'completed' | 'snoozed' | 'none';

export interface ActiveFollowUp {
  followUpDate?: string; // YYYY-MM-DD
  followUpStatus: FollowUpStatus;
  followUpNote?: string;
  lastFollowUpAt?: string;
}

// 4. Immutable Timeline Event Model
export type ApplicationEventType =
  | 'discovered'
  | 'interested'
  | 'preparation_started'
  | 'resume_tailored'
  | 'resume_exported'
  | 'handoff_opened'
  | 'applied_confirmed'
  | 'status_changed'
  | 'follow_up_scheduled'
  | 'follow_up_snoozed'
  | 'follow_up_completed'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'interview_cancelled'
  | 'contact_added'
  | 'note_added'
  | 'offer_received'
  | 'rejection_logged'
  | 'withdrawn'
  | 'reopened';

export interface ApplicationEvent {
  id: string;
  candidateId?: string;
  applicationId: string;
  jobId: string;
  type: ApplicationEventType;
  title: string;
  description: string;
  timestamp: string; // ISO string
  isAutomated: boolean; // true if triggered by system flow, false if candidate action
  metadata?: Record<string, unknown>;
}

// 5. Deterministic Next Actions
export type NextActionCategory =
  | 'follow_up_due'
  | 'interview_upcoming'
  | 'preparation_incomplete'
  | 'confirm_applied'
  | 'stale_application'
  | 'knowledge_gap';

export interface NextAction {
  id: string;
  applicationId?: string;
  jobId?: string;
  category: NextActionCategory;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  explanation: string; // Explainable WHY
  actionLabel: string;
  actionUrl: string;
  dueDate?: string;
}

// 6. Job Search Intelligence & Analytics
export interface FunnelMetrics {
  totalDiscovered: number;
  totalSaved: number;
  totalApplied: number;
  totalInterviews: number;
  totalOffers: number;
  totalRejected: number;
  totalWithdrawn: number;
}

export interface ConversionRates {
  appliedToInterviewRate: number; // (interviews / applied) * 100
  interviewToOfferRate: number; // (offers / interviews) * 100
  appliedToOfferRate: number; // (offers / applied) * 100
}

export interface VelocityMetrics {
  avgDaysToApply: number | null; // Discovery -> Application
  avgDaysToFirstRecordedOutcome: number | null; // Application -> First Interview / Rejection
}

export interface SegmentedBreakdownItem {
  name: string;
  totalApplications: number;
  interviews: number;
  offers: number;
  responseRate: number; // (interviews / totalApplications) * 100
}

export interface SearchAnalytics {
  funnel: FunnelMetrics;
  conversion: ConversionRates;
  velocity: VelocityMetrics;
  byRole: SegmentedBreakdownItem[];
  bySource: SegmentedBreakdownItem[];
  byMatchScoreRange: SegmentedBreakdownItem[];
  byTemplate: Array<{
    templateId: ResumeTemplateId | string;
    templateName: string;
    totalApplications: number;
    interviews: number;
  }>;
}

// 7. Search Strategy Insights
export type SearchInsightCategory =
  | 'role_fit'
  | 'match_score'
  | 'timing'
  | 'pipeline_balance'
  | 'source'
  | 'template';

export interface SearchInsight {
  id: string;
  category: SearchInsightCategory;
  title: string;
  observation: string; // Purely factual description
  recommendation: string; // Suggested strategy adjustment
  dataBasis: string; // Explicit sample size notice
  confidence: 'preliminary' | 'moderate' | 'strong';
  actionUrl?: string;
  actionLabel?: string;
}
