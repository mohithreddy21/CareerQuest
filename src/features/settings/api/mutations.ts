import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { updateUserSettingsAction } from './actions';
import { UpdateSettingsPayload } from './types';
import { settingsKeys } from './queries';
import { resumeKeys } from '@/features/resume/api/queries';
import { overviewKeys } from '@/features/overview/api/queries';

export const updateSettingsMutation = mutationOptions({
  mutationFn: (payload: UpdateSettingsPayload) => updateUserSettingsAction(payload),
  onSuccess: () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: settingsKeys.all });
    qc.invalidateQueries({ queryKey: resumeKeys.profile() });
    qc.invalidateQueries({ queryKey: overviewKeys.all });
  }
});
