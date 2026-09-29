import { z } from 'zod';

export const extractedClaimEvidenceSchema = z.object({
  exactQuote: z.string().min(1, 'Exact verbatim quote from resume is required'),
  sectionHeader: z.string().optional()
});

export const extractedSkillClaimSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  category: z.enum(['technical', 'tools', 'soft', 'other']).default('technical'),
  yearsOfExperience: z.number().int().min(0).max(60).optional(),
  evidence: extractedClaimEvidenceSchema,
  confidence: z.number().min(0).max(1).default(0.9)
});

export const extractedExperienceClaimSchema = z.object({
  employer: z.string().min(1, 'Employer name is required'),
  role: z.string().min(1, 'Role title is required'),
  location: z.string().optional(),
  startDate: z.string().regex(/^\d{4}(-\d{2})?$/, 'Date format must be YYYY or YYYY-MM'),
  endDate: z
    .string()
    .regex(/^\d{4}(-\d{2})?$/)
    .optional(),
  isCurrent: z.boolean().default(false),
  responsibilities: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  evidence: extractedClaimEvidenceSchema,
  confidence: z.number().min(0).max(1).default(0.9)
});

export const extractedProjectClaimSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().min(1, 'Project description is required'),
  technologies: z.array(z.string()).default([]),
  contributions: z.string().optional(),
  outcomes: z.string().optional(),
  url: z.string().optional(),
  evidence: extractedClaimEvidenceSchema,
  confidence: z.number().min(0).max(1).default(0.9)
});

export const extractedEducationClaimSchema = z.object({
  institution: z.string().min(1, 'Institution is required'),
  degree: z.string().min(1, 'Degree is required'),
  fieldOfStudy: z.string().min(1, 'Field of study is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  details: z.string().optional(),
  evidence: extractedClaimEvidenceSchema,
  confidence: z.number().min(0).max(1).default(0.9)
});

export const extractedCertificationClaimSchema = z.object({
  name: z.string().min(1, 'Certification name is required'),
  issuer: z.string().min(1, 'Issuer is required'),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  credentialId: z.string().optional(),
  evidence: extractedClaimEvidenceSchema,
  confidence: z.number().min(0).max(1).default(0.9)
});

export const extractedAchievementClaimSchema = z.object({
  title: z.string().min(1, 'Achievement title is required'),
  description: z.string().min(1, 'Achievement description is required'),
  metric: z.string().optional(),
  sourceContext: z.string().optional(),
  evidence: extractedClaimEvidenceSchema,
  confidence: z.number().min(0).max(1).default(0.9)
});

export const structuredResumeExtractionSchema = z.object({
  skills: z.array(extractedSkillClaimSchema).default([]),
  experience: z.array(extractedExperienceClaimSchema).default([]),
  projects: z.array(extractedProjectClaimSchema).default([]),
  education: z.array(extractedEducationClaimSchema).default([]),
  certifications: z.array(extractedCertificationClaimSchema).default([]),
  achievements: z.array(extractedAchievementClaimSchema).default([])
});

export const resumeExtractionSchema = structuredResumeExtractionSchema;

export type ExtractedClaimEvidence = z.infer<typeof extractedClaimEvidenceSchema>;
export type ExtractedSkillClaim = z.infer<typeof extractedSkillClaimSchema>;
export type ExtractedExperienceClaim = z.infer<typeof extractedExperienceClaimSchema>;
export type ExtractedProjectClaim = z.infer<typeof extractedProjectClaimSchema>;
export type ExtractedEducationClaim = z.infer<typeof extractedEducationClaimSchema>;
export type ExtractedCertificationClaim = z.infer<typeof extractedCertificationClaimSchema>;
export type ExtractedAchievementClaim = z.infer<typeof extractedAchievementClaimSchema>;
export type StructuredResumeExtraction = z.infer<typeof structuredResumeExtractionSchema>;
