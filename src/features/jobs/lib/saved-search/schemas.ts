import { z } from 'zod';

export const alertFrequencyEnum = z.enum(['instant', 'daily', 'weekly', 'never']);

export const savedSearchFilterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name cannot exceed 120 characters'),
  query: z.string().trim().max(300).optional().nullable(),
  locations: z.array(z.string().trim()).default([]),
  workArrangements: z.array(z.enum(['remote', 'hybrid', 'onsite'])).default([]),
  roleCategories: z.array(z.string().trim()).default([]),
  seniorityLevels: z.array(z.string().trim()).default([]),
  skills: z.array(z.string().trim()).default([]),
  minSalary: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().trim().max(10).optional().nullable(),
  minMatchScore: z.number().int().min(0).max(100).optional().nullable(),
  postedWithinDays: z.number().int().min(1).max(365).optional().nullable(),
  alertFrequency: alertFrequencyEnum.default('weekly'),
  isEnabled: z.boolean().default(true),
  filterVersion: z.string().trim().optional()
});

export const createSavedSearchSchema = savedSearchFilterSchema;

export const updateSavedSearchSchema = savedSearchFilterSchema.partial().extend({
  id: z.string().min(1, 'Saved search ID is required'),
  filterVersion: z.string().optional()
});

export const toggleSavedSearchSchema = z.object({
  id: z.string().min(1, 'Saved search ID is required'),
  isEnabled: z.boolean()
});

export const executeSavedSearchSchema = z.object({
  savedSearchId: z.string().min(1, 'Saved search ID is required'),
  isManual: z.boolean().default(false)
});

export const markNotificationReadSchema = z.object({
  id: z.string().min(1, 'Notification ID is required')
});

export type SavedSearchFilterInput = z.infer<typeof savedSearchFilterSchema>;
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
export type ToggleSavedSearchInput = z.infer<typeof toggleSavedSearchSchema>;
export type ExecuteSavedSearchInput = z.infer<typeof executeSavedSearchSchema>;
