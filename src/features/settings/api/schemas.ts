import { z } from 'zod';

export const updateSettingsSchema = z.object({
  updates: z.object({
    targetRoles: z.array(z.string()).optional(),
    preferredLocations: z.array(z.string()).optional(),
    workArrangements: z.array(z.enum(['remote', 'hybrid', 'onsite'])).optional(),
    targetSalaryMin: z.number().optional(),
    currency: z.string().optional(),
    aiExplanationDetail: z.enum(['concise', 'detailed']).optional(),
    autoExtractRequirements: z.boolean().optional(),
    notifyOnHighMatch: z.boolean().optional(),
    privateMode: z.boolean().optional()
  })
});
