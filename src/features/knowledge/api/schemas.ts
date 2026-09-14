import { z } from 'zod';

export const knowledgeCategorySchema = z.enum([
  'skill',
  'experience',
  'project',
  'education',
  'certification',
  'achievement'
]);

export const knowledgeStatusSchema = z.enum(['approved', 'proposed', 'rejected', 'archived']);

export const addKnowledgeItemSchema = z.object({
  category: knowledgeCategorySchema,
  content: z.unknown().refine((c) => c !== undefined && c !== null, {
    message: 'Content is required'
  }),
  provenanceLabel: z.string().optional()
});

export const updateKnowledgeItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  content: z.unknown().refine((c) => c !== undefined && c !== null, {
    message: 'Content is required'
  }),
  provenanceNote: z.string().optional()
});

export const updateKnowledgeStatusSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  status: knowledgeStatusSchema
});

export const deleteKnowledgeItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required')
});

export const ingestResumeSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  text: z.string().optional()
});

export const resolveProposedItemSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required'),
  tempId: z.string().min(1, 'Item tempId is required'),
  action: z.enum(['accept', 'reject', 'edit']),
  editedContent: z.unknown().optional()
});

export const acceptAllProposedSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required')
});
