import { z } from 'zod';

export const updateCandidateProfileSchema = z.object({
  updates: z.object({
    name: z.string().min(1).optional(),
    headline: z.string().optional(),
    professionalSummary: z.string().optional(),
    location: z.string().optional(),
    phone: z.string().nullable().optional(),
    targetRoles: z.array(z.string()).optional()
  })
});

export const updateResumeChangeStatusSchema = z.object({
  resumeVersionId: z.string().min(1, 'Resume Version ID is required'),
  changeId: z.string().min(1, 'Change ID is required'),
  status: z.enum(['pending', 'approved', 'rejected', 'edited'])
});

export const editResumeChangeContentSchema = z.object({
  resumeVersionId: z.string().min(1, 'Resume Version ID is required'),
  changeId: z.string().min(1, 'Change ID is required'),
  editedContent: z.string().min(1, 'Edited content cannot be empty')
});

export const approveAllResumeChangesSchema = z.object({
  resumeVersionId: z.string().min(1, 'Resume Version ID is required')
});
