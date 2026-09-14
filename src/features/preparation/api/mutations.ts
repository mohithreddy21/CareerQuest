import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  confirmApplicationSubmissionAction,
  recordResumeExportEventAction,
  updateApplicationTemplateSelectionAction,
  updateCoverLetterDraftAction,
  updateQuestionAnswerAction
} from './actions';
import {
  ConfirmAppliedPayload,
  RecordExportPayload,
  UpdateCoverLetterPayload,
  UpdateQuestionPayload,
  UpdateTemplatePayload
} from './types';
import { preparationKeys } from './queries';
import { applicationKeys } from '@/features/applications/api/queries';
import { overviewKeys } from '@/features/overview/api/queries';

export const updateCoverLetterMutation = mutationOptions({
  mutationFn: (payload: UpdateCoverLetterPayload) => updateCoverLetterDraftAction(payload),
  onSuccess: (_data, variables) => {
    getQueryClient().invalidateQueries({
      queryKey: preparationKeys.materials(variables.applicationId)
    });
  }
});

export const updateQuestionMutation = mutationOptions({
  mutationFn: (payload: UpdateQuestionPayload) => updateQuestionAnswerAction(payload),
  onSuccess: (_data, variables) => {
    getQueryClient().invalidateQueries({
      queryKey: preparationKeys.materials(variables.applicationId)
    });
  }
});

export const updateTemplateMutation = mutationOptions({
  mutationFn: (payload: UpdateTemplatePayload) => updateApplicationTemplateSelectionAction(payload),
  onSuccess: (_data, variables) => {
    getQueryClient().invalidateQueries({
      queryKey: preparationKeys.materials(variables.applicationId)
    });
  }
});

export const recordExportMutation = mutationOptions({
  mutationFn: (payload: RecordExportPayload) => recordResumeExportEventAction(payload),
  onSuccess: (_data, variables) => {
    getQueryClient().invalidateQueries({
      queryKey: applicationKeys.events(variables.applicationId)
    });
  }
});

export const confirmAppliedMutation = mutationOptions({
  mutationFn: (payload: ConfirmAppliedPayload) => confirmApplicationSubmissionAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    // Invalidate affected application and preparation queries
    qc.invalidateQueries({ queryKey: applicationKeys.list() });
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.applicationId) });
    qc.invalidateQueries({ queryKey: applicationKeys.events(variables.applicationId) });
    qc.invalidateQueries({ queryKey: preparationKeys.materials(variables.applicationId) });
    qc.invalidateQueries({ queryKey: overviewKeys.all });
  }
});
