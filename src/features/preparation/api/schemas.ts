import { z } from 'zod';

export const confirmAppliedSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  note: z.string().optional(),
  templateId: z.string().optional(),
  templateVersion: z.string().optional(),
  expectedVersion: z.number().int().positive().optional()
});

export const updateCoverLetterSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  coverLetter: z.object({
    id: z.string().min(1),
    candidateId: z.string().optional(),
    jobId: z.string().min(1),
    body: z.string(),
    tone: z.string(),
    sourceKnowledgeItemIds: z.array(z.string()),
    grounded: z.boolean().optional(),
    generatedAt: z.string().optional(),
    updatedAt: z.string().optional()
  })
});

export const updateQuestionSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  question: z.object({
    id: z.string().min(1),
    applicationId: z.string().optional(),
    question: z.string(),
    answer: z.string(),
    sourceKnowledgeItemIds: z.array(z.string()),
    grounded: z.boolean().optional(),
    reviewed: z.boolean().optional(),
    confidence: z.number().optional()
  })
});

export const updateTemplateSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  templateId: z.string().min(1, 'Template ID is required')
});

export const recordExportSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  exportRecord: z.object({
    exportId: z.string().min(1),
    templateId: z.string().min(1),
    format: z.enum(['pdf', 'docx']),
    exportedAt: z.string()
  })
});
