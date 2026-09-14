import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  acceptAllProposedItemsAction,
  addKnowledgeItemAction,
  deleteKnowledgeItemAction,
  ingestResumeAction,
  resolveProposedItemAction,
  updateKnowledgeItemAction,
  updateKnowledgeItemStatusAction
} from './actions';
import {
  AddKnowledgeItemPayload,
  UpdateKnowledgeItemPayload,
  UpdateKnowledgeStatusPayload,
  IngestResumePayload,
  ResolveProposedItemPayload,
  AcceptAllProposedPayload
} from './types';
import { knowledgeKeys } from './queries';
import { resumeKeys } from '@/features/resume/api/queries';

export const addKnowledgeItemMutation = mutationOptions({
  mutationFn: (payload: AddKnowledgeItemPayload) => addKnowledgeItemAction(payload),
  onSuccess: () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: knowledgeKeys.all });
    qc.invalidateQueries({ queryKey: resumeKeys.profile() });
  }
});

export const updateKnowledgeItemMutation = mutationOptions({
  mutationFn: (payload: UpdateKnowledgeItemPayload) => updateKnowledgeItemAction(payload),
  onSuccess: () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: knowledgeKeys.all });
    qc.invalidateQueries({ queryKey: resumeKeys.profile() });
  }
});

export const updateKnowledgeStatusMutation = mutationOptions({
  mutationFn: (payload: UpdateKnowledgeStatusPayload) => updateKnowledgeItemStatusAction(payload),
  onSuccess: () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: knowledgeKeys.all });
    qc.invalidateQueries({ queryKey: resumeKeys.profile() });
  }
});

export const deleteKnowledgeItemMutation = mutationOptions({
  mutationFn: (id: string) => deleteKnowledgeItemAction(id),
  onSuccess: () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: knowledgeKeys.all });
    qc.invalidateQueries({ queryKey: resumeKeys.profile() });
  }
});

export const ingestResumeMutation = mutationOptions({
  mutationFn: (payload: IngestResumePayload) => ingestResumeAction(payload),
  onSuccess: () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: knowledgeKeys.proposed() });
  }
});

export const resolveProposedItemMutation = mutationOptions({
  mutationFn: (payload: ResolveProposedItemPayload) => resolveProposedItemAction(payload),
  onSuccess: () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: knowledgeKeys.all });
    qc.invalidateQueries({ queryKey: resumeKeys.profile() });
  }
});

export const acceptAllProposedMutation = mutationOptions({
  mutationFn: (payload: AcceptAllProposedPayload) => acceptAllProposedItemsAction(payload),
  onSuccess: () => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: knowledgeKeys.all });
    qc.invalidateQueries({ queryKey: resumeKeys.profile() });
  }
});
