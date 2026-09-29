'use server';

import { requireCandidateId } from '@/lib/auth';
import { careerRepository } from '@/services/career-repository';
import { UpdateSettingsPayload, UserSettings } from './types';

// Default presentation preferences for AI assistance / notifications
const defaultSettings: UserSettings = {
  targetRoles: [],
  preferredLocations: [],
  workArrangements: ['remote', 'hybrid'],
  targetSalaryMin: 0,
  currency: 'USD',
  aiExplanationDetail: 'concise',
  autoExtractRequirements: true,
  notifyOnHighMatch: true,
  privateMode: true
};

export async function getUserSettings(candidateId?: string): Promise<UserSettings> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const prefs = await careerRepository.getCandidatePreferences(resolvedId);
  if (!prefs) {
    return defaultSettings;
  }

  return {
    ...defaultSettings,
    targetRoles: prefs.targetRoles ?? defaultSettings.targetRoles,
    preferredLocations: prefs.preferredLocations ?? defaultSettings.preferredLocations,
    workArrangements: (prefs.workArrangements ?? defaultSettings.workArrangements) as (
      | 'remote'
      | 'hybrid'
      | 'onsite'
    )[],
    targetSalaryMin: prefs.targetSalaryMin ?? defaultSettings.targetSalaryMin,
    currency: prefs.currency ?? defaultSettings.currency
  };
}

export async function updateUserSettings(
  payload: UpdateSettingsPayload,
  candidateId?: string
): Promise<UserSettings> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const current = await getUserSettings(resolvedId);
  const merged: UserSettings = {
    ...current,
    ...payload.updates
  };

  await careerRepository.updateCandidatePreferences(
    {
      targetRoles: merged.targetRoles,
      preferredLocations: merged.preferredLocations,
      workArrangements: merged.workArrangements,
      targetSalaryMin: merged.targetSalaryMin || undefined,
      currency: merged.currency
    },
    resolvedId
  );

  return merged;
}
