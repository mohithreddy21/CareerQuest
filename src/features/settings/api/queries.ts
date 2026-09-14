import { queryOptions } from '@tanstack/react-query';
import { getUserSettings } from './service';

export const settingsKeys = {
  all: ['settings'] as const,
  user: () => [...settingsKeys.all, 'user'] as const
};

export const userSettingsQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.user(),
    queryFn: () => getUserSettings()
  });
