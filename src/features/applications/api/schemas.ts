import { z } from 'zod';

export const applicationStatusSchema = z.enum([
  'discovered',
  'interested',
  'preparing',
  'applied',
  'interview',
  'interviewing',
  'negotiating',
  'accepted',
  'rejected',
  'withdrawn',
  'archived'
] as const);

export const createApplicationSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  initialStatus: applicationStatusSchema.optional()
});

export const updateApplicationStatusSchema = z.object({
  id: z.string().min(1, 'Application ID is required'),
  status: applicationStatusSchema,
  note: z.string().optional(),
  expectedVersion: z.number().int().positive().optional()
});

export const updateApplicationNotesSchema = z.object({
  id: z.string().min(1, 'Application ID is required'),
  notes: z.string(),
  expectedVersion: z.number().int().positive().optional()
});

export const updateApplicationFollowUpSchema = z.object({
  id: z.string().min(1, 'Application ID is required'),
  followUpDate: z.string().optional(),
  followUpStatus: z.enum(['pending', 'completed', 'snoozed', 'none']).optional(),
  followUpNote: z.string().optional(),
  expectedVersion: z.number().int().positive().optional()
});

export const updateApplicationArchiveSchema = z.object({
  id: z.string().min(1, 'Application ID is required'),
  isArchived: z.boolean(),
  expectedVersion: z.number().int().positive().optional()
});

export const addInterviewStageSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  stage: z.object({
    stageName: z.string().min(1, 'Stage name is required'),
    scheduledDate: z.string().optional(),
    interviewerNames: z.array(z.string()).optional(),
    meetingLink: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['scheduled', 'completed', 'cancelled']).default('scheduled'),
    outcome: z.enum(['pending', 'passed', 'failed', 'inconclusive']).optional()
  })
});

export const updateInterviewStageSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  stage: z.object({
    id: z.string().min(1, 'Stage ID is required'),
    stageName: z.string().min(1, 'Stage name is required'),
    scheduledDate: z.string().optional(),
    interviewerNames: z.array(z.string()).optional(),
    meetingLink: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['scheduled', 'completed', 'cancelled']),
    outcome: z.enum(['pending', 'passed', 'failed', 'inconclusive']).optional()
  })
});

export const deleteInterviewStageSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  stageId: z.string().min(1, 'Stage ID is required')
});

export const addApplicationContactSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  contact: z.object({
    name: z.string().min(1, 'Contact name is required'),
    role: z.string().min(1, 'Contact role is required'),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    linkedIn: z.string().optional(),
    notes: z.string().optional()
  })
});

export const updateApplicationContactSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  contactId: z.string().min(1, 'Contact ID is required'),
  updates: z.object({
    name: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    linkedIn: z.string().optional(),
    notes: z.string().optional()
  })
});

export const deleteApplicationContactSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  contactId: z.string().min(1, 'Contact ID is required')
});
