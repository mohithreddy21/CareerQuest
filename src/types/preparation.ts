import { ResumeTemplateId } from './templates';

export interface GroundedCoverLetter {
  id: string;
  jobId: string;
  candidateId: string;
  tailoredResumeVersionId: string;
  recipient: string;
  company: string;
  role: string;
  body: string;
  sourceKnowledgeItemIds: string[];
  evidenceReferences: string[];
  grounded: boolean;
  status: 'draft' | 'reviewed';
}

export type ApplicationQuestionCategory = 'interest' | 'experience' | 'technical' | 'fit';

export interface GroundedApplicationQuestion {
  id: string;
  question: string;
  category: ApplicationQuestionCategory;
  suggestedAnswer: string;
  candidateEditedAnswer?: string;
  sourceKnowledgeItemIds: string[];
  evidenceReferences: string[];
  grounded: boolean;
  reviewed: boolean;
}

export interface ApplicationReadinessChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'complete' | 'warning' | 'incomplete';
}

export interface ApplicationSummary {
  jobId: string;
  company: string;
  role: string;
  matchScore: number;
  recommendation: string;
  tailoredResumeStatus: 'approved' | 'in_review' | 'draft';
  selectedTemplateId: ResumeTemplateId;
  selectedTemplateName: string;
  coverLetterReady: boolean;
  questionsCount: number;
  questionsReviewedCount: number;
  knownGaps: string[];
  readinessStatus: 'ready' | 'needs_review' | 'incomplete';
  checklist: ApplicationReadinessChecklistItem[];
}
