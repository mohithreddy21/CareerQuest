import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  updateResumeChangeStatusAction,
  editResumeChangeContentAction,
  approveAllResumeChangesAction
} from './actions';
import {
  UpdateResumeChangeStatusPayload,
  EditResumeChangeContentPayload,
  ApproveAllChangesPayload
} from './types';
import { resumeKeys } from '@/features/resume/api/queries';

export const updateResumeChangeStatusMutation = mutationOptions({
  mutationFn: (payload: UpdateResumeChangeStatusPayload) => updateResumeChangeStatusAction(payload),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: resumeKeys.all });
  }
});

export const editResumeChangeContentMutation = mutationOptions({
  mutationFn: (payload: EditResumeChangeContentPayload) => editResumeChangeContentAction(payload),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: resumeKeys.all });
  }
});

export const approveAllResumeChangesMutation = mutationOptions({
  mutationFn: (payload: ApproveAllChangesPayload) => approveAllResumeChangesAction(payload),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: resumeKeys.all });
  }
});
