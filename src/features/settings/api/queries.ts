import { queryOptions } from '@tanstack/react-query';
import { getUserSettings } from './service';
import { UserSettings } from './types';

export const settingsKeys = {
  all: ['settings'] as const,
  user: () => [...settingsKeys.all, 'user'] as const
};

export const userSettingsQueryOptions = (candidateId?: string) =>
  queryOptions({
    queryKey: settingsKeys.user(),
    queryFn: async (): Promise<UserSettings> => {
      if (typeof window !== 'undefined') {
        const res = await fetch('/api/settings');
        if (!res.ok) {
          throw new Error('Failed to fetch user settings');
        }
        return res.json() as Promise<UserSettings>;
      }
      return getUserSettings(candidateId);
    }
  });
