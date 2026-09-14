import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  approveAllResumeChangesAction,
  editResumeChangeContentAction,
  updateCandidateProfileAction,
  updateResumeChangeStatusAction
} from './actions';
import {
  ApproveAllResumeChangesPayload,
  UpdateCandidateProfilePayload,
  UpdateResumeChangeStatusPayload
} from './types';
import { resumeKeys } from './queries';

export const updateCandidateProfileMutation = mutationOptions({
  mutationFn: (payload: UpdateCandidateProfilePayload) => updateCandidateProfileAction(payload),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: resumeKeys.profile() });
  }
});

export const updateResumeChangeStatusMutation = mutationOptions({
  mutationFn: (payload: UpdateResumeChangeStatusPayload) => updateResumeChangeStatusAction(payload),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: resumeKeys.all });
  }
});

export const editResumeChangeContentMutation = mutationOptions({
  mutationFn: (payload: { resumeVersionId: string; changeId: string; editedContent: string }) =>
    editResumeChangeContentAction(payload),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: resumeKeys.all });
  }
});

export const approveAllResumeChangesMutation = mutationOptions({
  mutationFn: (payload: ApproveAllResumeChangesPayload) => approveAllResumeChangesAction(payload),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: resumeKeys.all });
  }
});
