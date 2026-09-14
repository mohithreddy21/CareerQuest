import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  createApplicationAction,
  updateApplicationStatusAction,
  updateApplicationNotesAction,
  updateApplicationFollowUpAction,
  updateApplicationArchiveStatusAction,
  addInterviewStageAction,
  updateInterviewStageAction,
  deleteInterviewStageAction,
  addApplicationContactAction,
  updateApplicationContactAction,
  deleteApplicationContactAction
} from './actions';
import {
  AddApplicationContactPayload,
  AddInterviewStagePayload,
  CreateApplicationPayload,
  DeleteApplicationContactPayload,
  DeleteInterviewStagePayload,
  UpdateApplicationArchivePayload,
  UpdateApplicationContactPayload,
  UpdateApplicationFollowUpPayload,
  UpdateApplicationNotesPayload,
  UpdateApplicationStatusPayload,
  UpdateInterviewStagePayload
} from './types';
import { applicationKeys } from './queries';
import { overviewKeys } from '@/features/overview/api/queries';
import { jobKeys } from '@/features/jobs/api/queries';

export const updateApplicationStatusMutation = mutationOptions({
  mutationFn: (payload: UpdateApplicationStatusPayload) => updateApplicationStatusAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.list() });
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.id) });
    qc.invalidateQueries({ queryKey: applicationKeys.events(variables.id) });
    qc.invalidateQueries({ queryKey: overviewKeys.all });
  }
});

export const createApplicationMutation = mutationOptions({
  mutationFn: (payload: CreateApplicationPayload) => createApplicationAction(payload),
  onSuccess: (data) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.list() });
    if (data?.id) {
      qc.invalidateQueries({ queryKey: applicationKeys.detail(data.id) });
    }
    qc.invalidateQueries({ queryKey: overviewKeys.all });
    qc.invalidateQueries({ queryKey: jobKeys.all });
  }
});

export const updateApplicationNotesMutation = mutationOptions({
  mutationFn: (payload: UpdateApplicationNotesPayload) => updateApplicationNotesAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.id) });
  }
});

export const updateApplicationFollowUpMutation = mutationOptions({
  mutationFn: (payload: UpdateApplicationFollowUpPayload) =>
    updateApplicationFollowUpAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.id) });
    qc.invalidateQueries({ queryKey: applicationKeys.events(variables.id) });
    qc.invalidateQueries({ queryKey: overviewKeys.all });
  }
});

export const addInterviewStageMutation = mutationOptions({
  mutationFn: (payload: AddInterviewStagePayload) => addInterviewStageAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.applicationId) });
    qc.invalidateQueries({ queryKey: applicationKeys.events(variables.applicationId) });
    qc.invalidateQueries({ queryKey: overviewKeys.all });
  }
});

export const updateInterviewStageMutation = mutationOptions({
  mutationFn: (payload: UpdateInterviewStagePayload) => updateInterviewStageAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.applicationId) });
    qc.invalidateQueries({ queryKey: applicationKeys.events(variables.applicationId) });
    qc.invalidateQueries({ queryKey: overviewKeys.all });
  }
});

export const deleteInterviewStageMutation = mutationOptions({
  mutationFn: (payload: DeleteInterviewStagePayload) => deleteInterviewStageAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.applicationId) });
    qc.invalidateQueries({ queryKey: applicationKeys.events(variables.applicationId) });
    qc.invalidateQueries({ queryKey: overviewKeys.all });
  }
});

export const addApplicationContactMutation = mutationOptions({
  mutationFn: (payload: AddApplicationContactPayload) => addApplicationContactAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.applicationId) });
    qc.invalidateQueries({ queryKey: applicationKeys.events(variables.applicationId) });
  }
});

export const updateApplicationContactMutation = mutationOptions({
  mutationFn: (payload: UpdateApplicationContactPayload) => updateApplicationContactAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.applicationId) });
  }
});

export const deleteApplicationContactMutation = mutationOptions({
  mutationFn: (payload: DeleteApplicationContactPayload) => deleteApplicationContactAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.applicationId) });
  }
});

export const updateApplicationArchiveMutation = mutationOptions({
  mutationFn: (payload: UpdateApplicationArchivePayload) =>
    updateApplicationArchiveStatusAction(payload),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: applicationKeys.list() });
    qc.invalidateQueries({ queryKey: applicationKeys.detail(variables.id) });
    qc.invalidateQueries({ queryKey: overviewKeys.all });
  }
});
