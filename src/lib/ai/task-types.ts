import { z } from 'zod';

export type AITaskType =
  | 'JOB_EXTRACT'
  | 'RESUME_PARSE'
  | 'RESUME_TAILOR'
  | 'COVER_LETTER'
  | 'APPLICATION_QUESTION'
  | 'SKILL_NORMALIZE';

export interface AIExecutionMetadata {
  taskType: AITaskType;
  provider: string;
  model: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cacheHit: boolean;
}

// ----------------------------------------------------
// JOB_EXTRACT Schemas
// ----------------------------------------------------
export const JobExtractInputSchema = z.object({
  text: z.string().min(10, 'Job text must be at least 10 characters'),
  sourceUrl: z.string().optional(),
  hints: z
    .object({
      title: z.string().optional(),
      company: z.string().optional()
    })
    .optional()
});

export type JobExtractInput = z.infer<typeof JobExtractInputSchema>;

export const JobExtractOutputSchema = z.object({
  title: z.string().nullable().default(null),
  company: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  workArrangement: z.enum(['remote', 'hybrid', 'onsite', 'unknown']).default('unknown'),
  description: z.string().default(''),
  responsibilities: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  experienceRequirement: z.string().nullable().default(null),
  educationRequirement: z.string().nullable().default(null),
  salaryMin: z.number().nullable().default(null),
  salaryMax: z.number().nullable().default(null),
  salaryCurrency: z.string().nullable().default(null),
  salaryInterval: z
    .enum(['hourly', 'daily', 'weekly', 'monthly', 'yearly'])
    .nullable()
    .default(null)
});

export type JobExtractOutput = z.infer<typeof JobExtractOutputSchema>;

// ----------------------------------------------------
// RESUME_PARSE Schemas
// ----------------------------------------------------
export const ResumeSkillSchema = z.object({
  name: z.string(),
  category: z.enum(['technical', 'soft', 'tools', 'languages']).default('technical'),
  evidenceSnippet: z.string().optional()
});

export const ResumeExperienceSchema = z.object({
  role: z.string(),
  employer: z.string(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isCurrent: z.boolean().default(false),
  highlights: z.array(z.string()).default([])
});

export const ResumeEducationSchema = z.object({
  institution: z.string(),
  degree: z.string().optional(),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  details: z.string().optional()
});

export const ResumeProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()).default([]),
  url: z.string().optional()
});

export const ResumeCertificationSchema = z.object({
  name: z.string(),
  issuer: z.string().optional(),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional()
});

export const ResumeAchievementSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.string().optional()
});

export const ResumeParseInputSchema = z.object({
  text: z.string().min(20, 'Resume text must be at least 20 characters')
});

export type ResumeParseInput = z.infer<typeof ResumeParseInputSchema>;

export const ResumeParseOutputSchema = z.object({
  skills: z.array(ResumeSkillSchema).default([]),
  experience: z.array(ResumeExperienceSchema).default([]),
  education: z.array(ResumeEducationSchema).default([]),
  projects: z.array(ResumeProjectSchema).default([]),
  certifications: z.array(ResumeCertificationSchema).default([]),
  achievements: z.array(ResumeAchievementSchema).default([])
});

export type ResumeParseOutput = z.infer<typeof ResumeParseOutputSchema>;

// ----------------------------------------------------
// RESUME_TAILOR Schemas
// ----------------------------------------------------
export const ResumeTailorChangeSchema = z.object({
  section: z.enum(['summary', 'experience', 'skills', 'projects']),
  sectionItemId: z.string().optional(),
  originalContent: z.string(),
  proposedContent: z.string(),
  rationale: z.string(),
  jobRequirement: z.string(),
  sourceKnowledgeItemIds: z.array(z.string()).default([]),
  sourceEvidenceSnippet: z.string().optional()
});

export type ResumeTailorChange = z.infer<typeof ResumeTailorChangeSchema>;

export const ResumeTailorInputSchema = z.object({
  job: z.object({
    id: z.string(),
    title: z.string(),
    company: z.string(),
    targetRole: z.string().optional(),
    description: z.string().optional(),
    responsibilities: z.array(z.string()).default([]),
    requiredSkills: z.array(z.string()).default([]),
    preferredSkills: z.array(z.string()).default([])
  }),
  masterResume: z.object({
    id: z.string(),
    summary: z.string(),
    experience: z
      .array(
        z.object({
          id: z.string(),
          employer: z.string(),
          role: z.string(),
          responsibilities: z.array(z.string()).default([]),
          achievements: z.array(z.string()).default([])
        })
      )
      .default([]),
    skills: z
      .object({
        technical: z.array(z.string()).default([]),
        tools: z.array(z.string()).default([]),
        soft: z.array(z.string()).default([]),
        other: z.array(z.string()).default([])
      })
      .default({ technical: [], tools: [], soft: [], other: [] }),
    projects: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          technologies: z.array(z.string()).default([]),
          contributions: z.string().optional()
        })
      )
      .default([])
  }),
  approvedKnowledge: z
    .array(
      z.object({
        knowledgeItemId: z.string(),
        category: z.string(),
        title: z.string(),
        supportingSnippet: z.string()
      })
    )
    .min(1, 'At least one approved knowledge item is required for tailoring'),
  tailoringInstructions: z.string().optional()
});

export type ResumeTailorInput = z.infer<typeof ResumeTailorInputSchema>;

export const ResumeTailorOutputSchema = z.object({
  proposedChanges: z.array(ResumeTailorChangeSchema).default([])
});

export type ResumeTailorOutput = z.infer<typeof ResumeTailorOutputSchema>;

// ----------------------------------------------------
// COVER_LETTER Schemas
// ----------------------------------------------------
export const CoverLetterInputSchema = z.object({
  candidate: z.object({
    name: z.string(),
    headline: z.string().optional(),
    professionalSummary: z.string().optional()
  }),
  job: z.object({
    id: z.string(),
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    descriptionSummary: z.string().optional()
  }),
  approvedKnowledge: z
    .array(
      z.object({
        knowledgeItemId: z.string(),
        category: z.string(),
        title: z.string(),
        supportingSnippet: z.string()
      })
    )
    .min(1, 'At least one approved knowledge item is required for cover letter generation'),
  toneOrInstructions: z.string().optional()
});

export type CoverLetterInput = z.infer<typeof CoverLetterInputSchema>;

export const CoverLetterOutputSchema = z.object({
  recipient: z.string().default('Hiring Team'),
  openingHook: z.string(),
  coreEvidenceParagraph: z.string(),
  alignmentParagraph: z.string(),
  closingCallToAction: z.string(),
  body: z.string(),
  sourceKnowledgeItemIds: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([])
});

export type CoverLetterOutput = z.infer<typeof CoverLetterOutputSchema>;

// ----------------------------------------------------
// APPLICATION_QUESTION Schemas
// ----------------------------------------------------
export const ApplicationQuestionCategorySchema = z.enum([
  'behavioral',
  'technical',
  'motivation',
  'logistics',
  'compensation',
  'eligibility',
  'other'
]);

export type ApplicationQuestionCategory = z.infer<typeof ApplicationQuestionCategorySchema>;

export const ApplicationQuestionInputSchema = z.object({
  question: z.string().min(3, 'Question text is required'),
  category: ApplicationQuestionCategorySchema,
  job: z.object({
    id: z.string(),
    title: z.string(),
    company: z.string()
  }),
  candidateProfileContext: z
    .object({
      targetRoles: z.array(z.string()).default([]),
      preferredLocations: z.array(z.string()).default([]),
      workArrangements: z.array(z.string()).default([]),
      targetSalaryMin: z.number().nullable().optional(),
      currency: z.string().default('USD')
    })
    .optional(),
  approvedKnowledge: z
    .array(
      z.object({
        knowledgeItemId: z.string(),
        category: z.string(),
        title: z.string(),
        supportingSnippet: z.string()
      })
    )
    .default([])
});

export type ApplicationQuestionInput = z.infer<typeof ApplicationQuestionInputSchema>;

export const ApplicationQuestionOutputSchema = z.object({
  question: z.string(),
  category: ApplicationQuestionCategorySchema,
  proposedAnswer: z.string(),
  hasSufficientEvidence: z.boolean(),
  reviewStatus: z
    .enum(['VERIFIED', 'REQUIRES_REVIEW', 'MISSING_EVIDENCE'])
    .default('REQUIRES_REVIEW'),
  missingEvidenceNote: z.string().nullable().default(null),
  sourceKnowledgeItemIds: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([])
});

export type ApplicationQuestionOutput = z.infer<typeof ApplicationQuestionOutputSchema>;

// ----------------------------------------------------
// Task Contract Map
// ----------------------------------------------------
export interface TaskContractMap {
  JOB_EXTRACT: {
    input: JobExtractInput;
    output: JobExtractOutput;
  };
  RESUME_PARSE: {
    input: ResumeParseInput;
    output: ResumeParseOutput;
  };
  RESUME_TAILOR: {
    input: ResumeTailorInput;
    output: ResumeTailorOutput;
  };
  COVER_LETTER: {
    input: CoverLetterInput;
    output: CoverLetterOutput;
  };
  APPLICATION_QUESTION: {
    input: ApplicationQuestionInput;
    output: ApplicationQuestionOutput;
  };
  SKILL_NORMALIZE: {
    input: { rawSkills: string[] };
    output: { normalizedSkills: { original: string; normalized: string; category: string }[] };
  };
}
