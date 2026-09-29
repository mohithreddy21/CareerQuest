import { z } from 'zod';

export const importJobSchema = z.object({
  url: z.string().url('A valid job posting URL is required'),
  force: z.boolean().optional()
});

export const importJobFromTextSchema = z.object({
  text: z
    .string()
    .min(20, 'Please paste at least 20 characters of job description')
    .max(50000, 'Text exceeds 50,000 character limit'),
  title: z.string().optional(),
  company: z.string().optional()
});

export type ImportJobFromTextPayload = z.infer<typeof importJobFromTextSchema>;

export const runJobAnalysisSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  forceReanalyze: z.boolean().optional()
});

export * from '../lib/saved-search/schemas';
