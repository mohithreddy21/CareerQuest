import { z } from 'zod';

export const importJobSchema = z.object({
  url: z.string().url('A valid job posting URL is required'),
  force: z.boolean().optional()
});

export const runJobAnalysisSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required')
});
