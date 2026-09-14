import { careerRepository } from '@/services/career-repository';
import { UpdateSettingsPayload, UserSettings } from './types';

// Default presentation preferences for AI assistance / notifications
const defaultSettings: UserSettings = {
  targetRoles: [
    'Senior Full-Stack Engineer',
    'Senior Frontend Engineer',
    'Staff Software Engineer'
  ],
  preferredLocations: ['San Francisco, CA', 'Remote', 'New York, NY'],
  workArrangements: ['remote', 'hybrid'],
  targetSalaryMin: 165000,
  currency: 'USD',
  aiExplanationDetail: 'concise',
  autoExtractRequirements: true,
  notifyOnHighMatch: true,
  privateMode: true
};

export async function getUserSettings(candidateId?: string): Promise<UserSettings> {
  const prefs = await careerRepository.getCandidatePreferences(candidateId);
  if (!prefs) {
    return defaultSettings;
  }

  return {
    ...defaultSettings,
    targetRoles: prefs.targetRoles || defaultSettings.targetRoles,
    preferredLocations: prefs.preferredLocations || defaultSettings.preferredLocations,
    workArrangements: (prefs.workArrangements || defaultSettings.workArrangements) as (
      | 'remote'
      | 'hybrid'
      | 'onsite'
    )[],
    targetSalaryMin: prefs.targetSalaryMin || defaultSettings.targetSalaryMin,
    currency: prefs.currency || defaultSettings.currency
  };
}

export async function updateUserSettings(
  payload: UpdateSettingsPayload,
  candidateId?: string
): Promise<UserSettings> {
  const current = await getUserSettings(candidateId);
  const merged: UserSettings = {
    ...current,
    ...payload.updates
  };

  await careerRepository.updateCandidatePreferences(
    {
      targetRoles: merged.targetRoles,
      preferredLocations: merged.preferredLocations,
      workArrangements: merged.workArrangements,
      targetSalaryMin: merged.targetSalaryMin,
      currency: merged.currency
    },
    candidateId
  );

  return merged;
}
