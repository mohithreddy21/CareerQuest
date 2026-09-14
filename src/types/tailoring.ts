import { KnowledgeCategory } from './knowledge';
import { ResumeChange, ResumeChangeStatus, TailoredResumeVersion } from './domain';

export type { ResumeChange, ResumeChangeStatus, TailoredResumeVersion };

/**
 * Represents a single piece of approved candidate knowledge retrieved
 * for a specific job opportunity.
 */
export interface RetrievedKnowledgeItem {
  id: string; // e.g. 'ret-job-1-kb-skill-1'
  knowledgeItemId: string; // Foreign key -> KnowledgeItem.id in Knowledge Bank
  candidateId: string;
  jobId: string;
  category: KnowledgeCategory;
  title: string; // Display title, e.g. "TypeScript" or "Senior Full-Stack Engineer at Veloce Labs"
  matchedRequirementId?: string; // Foreign key -> ExtractedRequirement.id from JobAnalysis
  matchedRequirementText: string; // e.g. "5+ years experience with TypeScript and React"
  relevanceCategory:
    | 'direct_technical'
    | 'tool_infrastructure'
    | 'architectural_responsibility'
    | 'domain_experience'
    | 'credential';
  relevanceReason: string; // e.g. "Direct match with core required stack component."
  supportingSnippet: string; // Verbatim snippet from approved knowledge item
  provenanceLabel: string; // e.g. "Verified Candidate Baseline" or "Resume_2026.pdf"
  retrievalRank: number; // Deterministic rank (1 = highest priority)
}

/**
 * Missing requirement information detected during retrieval.
 */
export interface MissingRequirementInfo {
  requirementId: string;
  requirementText: string;
  status: 'unsupported' | 'partial';
  note: string;
}

/**
 * The complete retrieval package for a job.
 */
export interface RetrievedCandidateKnowledge {
  jobId: string;
  candidateId: string;
  retrievedAt: string;
  items: RetrievedKnowledgeItem[];
  missingRequirements: MissingRequirementInfo[];
}
