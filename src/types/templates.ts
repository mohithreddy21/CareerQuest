export type ResumeTemplateId = 'classic-v1' | 'modern-v1' | 'compact-v1';

export interface ResumeTemplateLayout {
  fontFamily: string;
  headerAlignment: 'left' | 'center';
  sectionSpacing: 'tight' | 'normal' | 'relaxed';
  dividerStyle: 'none' | 'subtle' | 'solid' | 'accent';
  skillsDisplay: 'grouped' | 'pills' | 'inline';
  compactBullets: boolean;
}

export interface ResumeTemplate {
  id: ResumeTemplateId;
  name: string;
  tagline: string;
  description: string;
  version: string;
  bestFor: string;
  layout: ResumeTemplateLayout;
}

export interface ResumeExport {
  id: string;
  candidateId: string;
  applicationId?: string | null;
  tailoredResumeVersionId: string;
  templateId: ResumeTemplateId | string;
  templateVersion: string;
  format: 'pdf' | 'docx';
  filename: string;
  storageKey?: string | null;
  createdAt: string;
}
