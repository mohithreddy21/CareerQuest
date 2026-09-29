export interface ExtractedResumeData {
  rawText: string;
  skills: {
    name: string;
    category?: 'technical' | 'tools' | 'soft' | 'other';
    years?: number;
    evidence?: { exactQuote: string; sectionHeader?: string };
    confidence?: number;
  }[];
  experience: {
    employer: string;
    role: string;
    location?: string;
    startDate: string;
    endDate?: string;
    isCurrent?: boolean;
    responsibilities: string[];
    achievements: string[];
    rawSnippet?: string;
    evidence?: { exactQuote: string; sectionHeader?: string };
    confidence?: number;
  }[];
  education: {
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate?: string;
    endDate?: string;
    details?: string;
    evidence?: { exactQuote: string; sectionHeader?: string };
    confidence?: number;
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string[];
    contributions?: string;
    outcomes?: string;
    url?: string;
    evidence?: { exactQuote: string; sectionHeader?: string };
    confidence?: number;
  }[];
  certifications: {
    name: string;
    issuer: string;
    issueDate?: string;
    expiryDate?: string;
    credentialId?: string;
    evidence?: { exactQuote: string; sectionHeader?: string };
    confidence?: number;
  }[];
  achievements: {
    title: string;
    description: string;
    metric?: string;
    sourceContext?: string;
    evidence?: { exactQuote: string; sectionHeader?: string };
    confidence?: number;
  }[];
  metadata?: {
    provider: string;
    model: string;
    extractionVersion: string;
    latencyMs?: number;
  };
}

export interface ResumeParserProvider {
  readonly providerId?: string;
  parseResume(file: {
    fileName: string;
    text?: string;
    documentId?: string;
  }): Promise<ExtractedResumeData>;
}

export type IResumeParserProvider = ResumeParserProvider;
