'use server';

import { requireCandidateId } from '@/lib/auth';
import { handleActionError, serializeActionResponse } from '@/lib/action-utils';
import { updateSettingsSchema } from './schemas';
import { updateUserSettings } from './service';
import { UpdateSettingsPayload, UserSettings } from './types';

export async function updateUserSettingsAction(
  payload: UpdateSettingsPayload
): Promise<UserSettings> {
  try {
    const validated = updateSettingsSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await updateUserSettings(validated, candidateId);
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}
