export interface ExtractedResumeData {
  rawText: string;
  skills: { name: string; category?: 'technical' | 'tools' | 'soft' | 'other'; years?: number }[];
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
  }[];
  education: {
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate?: string;
    details?: string;
  }[];
  projects: {
    name: string;
    description: string;
    technologies: string[];
    contributions?: string;
  }[];
  certifications: {
    name: string;
    issuer: string;
    issueDate: string;
    credentialId?: string;
  }[];
  achievements: {
    title: string;
    description: string;
    metric?: string;
  }[];
}

export interface ResumeParserProvider {
  parseResume(file: { fileName: string; text?: string }): Promise<ExtractedResumeData>;
}
