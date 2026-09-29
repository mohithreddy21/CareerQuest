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
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  };
  COVER_LETTER: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  };
  APPLICATION_QUESTION: {
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  };
  SKILL_NORMALIZE: {
    input: { rawSkills: string[] };
    output: { normalizedSkills: { original: string; normalized: string; category: string }[] };
  };
}
