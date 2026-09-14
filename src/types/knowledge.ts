/**
 * CareerQuest Candidate Knowledge Bank Domain Models
 *
 * Phase 3A: Candidate Knowledge Bank
 * Canonical, verified store of approved candidate career assets.
 */

export type KnowledgeCategory =
  | 'skill'
  | 'experience'
  | 'project'
  | 'education'
  | 'certification'
  | 'achievement';

export type KnowledgeStatus =
  | 'proposed' // Extracted/suggested; awaiting candidate review
  | 'approved' // Verified, active candidate knowledge (source of truth)
  | 'rejected' // Explicitly discarded by candidate
  | 'archived'; // Formerly approved, currently retired

export type ProvenanceSourceType =
  | 'manual_entry'
  | 'resume_upload'
  | 'profile_migration'
  | 'external_import';

export interface KnowledgeProvenance {
  id: string;
  sourceType: ProvenanceSourceType;
  sourceLabel: string; // e.g. "Manual Profile Entry", "Resume_Alex_Chen_2026.pdf"
  documentId?: string;
  extractedSnippet?: string; // Verifiable text excerpt
  confidence?: number; // 0 to 1 parser confidence
  addedAt: string;
}

export interface SkillKnowledgeContent {
  name: string;
  category: 'technical' | 'tools' | 'soft' | 'other';
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience?: number;
}

export interface ExperienceKnowledgeContent {
  employer: string;
  role: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  responsibilities: string[];
  achievements: string[];
}

export interface ProjectKnowledgeContent {
  name: string;
  description: string;
  technologies: string[];
  contributions: string;
  outcomes?: string;
  url?: string;
}

export interface EducationKnowledgeContent {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
  details?: string;
}

export interface CertificationKnowledgeContent {
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface AchievementKnowledgeContent {
  title: string;
  description: string;
  metric?: string;
  sourceContext?: string; // Employer or Project association
}

export interface KnowledgeItem<T = unknown> {
  id: string;
  candidateId: string;
  category: KnowledgeCategory;
  content: T;
  status: KnowledgeStatus;
  provenance: KnowledgeProvenance[];
  createdAt: string;
  updatedAt: string;
}

export interface CandidateKnowledgeBank {
  id: string;
  candidateId: string;
  skills: KnowledgeItem<SkillKnowledgeContent>[];
  experiences: KnowledgeItem<ExperienceKnowledgeContent>[];
  projects: KnowledgeItem<ProjectKnowledgeContent>[];
  education: KnowledgeItem<EducationKnowledgeContent>[];
  certifications: KnowledgeItem<CertificationKnowledgeContent>[];
  achievements: KnowledgeItem<AchievementKnowledgeContent>[];
  updatedAt: string;
}

export type IngestionConflictStatus = 'new' | 'exact_match' | 'possible_duplicate' | 'conflict';

export interface ProposedKnowledgeItem {
  tempId: string;
  category: KnowledgeCategory;
  content: unknown;
  confidence?: number;
  extractedSnippet?: string;
  conflictStatus: IngestionConflictStatus;
  existingItemId?: string;
  conflictDescription?: string;
}

export interface ProposedIngestionBatch {
  id: string;
  candidateId: string;
  fileName: string;
  uploadedAt: string;
  items: ProposedKnowledgeItem[];
  status: 'pending_review' | 'resolved';
}

export interface CandidateDocument {
  id: string;
  candidateId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  hash: string;
  uploadedAt: string;
  processingStatus: 'uploaded' | 'processing' | 'parsed' | 'reviewed' | 'failed' | string;
}
