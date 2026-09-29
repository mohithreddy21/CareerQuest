'use server';

import { requireCandidateId } from '@/lib/auth';
import { handleActionError, serializeActionResponse } from '@/lib/action-utils';
import { careerRepository } from '@/services/career-repository';
import { savedSearchService } from '../services/saved-search-service';
import {
  createSavedSearchSchema,
  updateSavedSearchSchema,
  toggleSavedSearchSchema,
  executeSavedSearchSchema,
  markNotificationReadSchema,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  ToggleSavedSearchInput,
  ExecuteSavedSearchInput
} from '../lib/saved-search/schemas';
import { SavedSearch, SavedSearchExecutionResult, CandidateNotification } from '@/types/domain';

export async function getSavedSearchesAction(): Promise<SavedSearch[]> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const searches = await careerRepository.getSavedSearches(candidateId);
    return serializeActionResponse(searches);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function createSavedSearchAction(
  payload: CreateSavedSearchInput
): Promise<SavedSearch> {
  try {
    const validated = createSavedSearchSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });

    const created = await careerRepository.saveSavedSearch(
      {
        name: validated.name,
        query: validated.query || null,
        locations: validated.locations || [],
        workArrangements: validated.workArrangements || [],
        roleCategories: validated.roleCategories || [],
        seniorityLevels: validated.seniorityLevels || [],
        minSalary: validated.minSalary || null,
        currency: validated.currency || null,
        alertFrequency: validated.alertFrequency || 'weekly',
        filterVersion: validated.filterVersion || '1.0',
        isEnabled: validated.isEnabled !== undefined ? validated.isEnabled : true,
        minMatchScore: validated.minMatchScore || null,
        lastMatchCount: 0
      },
      candidateId
    );

    return serializeActionResponse(created);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateSavedSearchAction(
  payload: UpdateSavedSearchInput
): Promise<SavedSearch> {
  try {
    const validated = updateSavedSearchSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });

    const existing = await careerRepository.getSavedSearchById(validated.id, candidateId);
    if (!existing) {
      throw new Error(`Saved search ${validated.id} not found or access denied`);
    }

    const updated = await careerRepository.saveSavedSearch(
      {
        id: validated.id,
        name: validated.name || existing.name,
        query: validated.query !== undefined ? validated.query : existing.query,
        locations: validated.locations || existing.locations,
        workArrangements: validated.workArrangements || existing.workArrangements,
        roleCategories: validated.roleCategories || existing.roleCategories,
        seniorityLevels: validated.seniorityLevels || existing.seniorityLevels,
        minSalary: validated.minSalary !== undefined ? validated.minSalary : existing.minSalary,
        currency: validated.currency !== undefined ? validated.currency : existing.currency,
        alertFrequency: validated.alertFrequency || existing.alertFrequency,
        filterVersion: validated.filterVersion || existing.filterVersion,
        isEnabled: validated.isEnabled !== undefined ? validated.isEnabled : existing.isEnabled,
        minMatchScore:
          validated.minMatchScore !== undefined ? validated.minMatchScore : existing.minMatchScore,
        lastExecutedAt: existing.lastExecutedAt,
        lastMatchCount: existing.lastMatchCount
      },
      candidateId
    );

    return serializeActionResponse(updated);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function toggleSavedSearchAction(
  payload: ToggleSavedSearchInput
): Promise<SavedSearch> {
  try {
    const validated = toggleSavedSearchSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });

    const updated = validated.isEnabled
      ? await careerRepository.enableSavedSearch(validated.id, candidateId)
      : await careerRepository.disableSavedSearch(validated.id, candidateId);

    return serializeActionResponse(updated);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteSavedSearchAction(id: string): Promise<boolean> {
  try {
    if (!id || typeof id !== 'string') {
      throw new Error('Valid saved search ID is required');
    }
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const success = await careerRepository.deleteSavedSearch(id, candidateId);
    return serializeActionResponse(success);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function executeSavedSearchAction(
  payload: ExecuteSavedSearchInput
): Promise<SavedSearchExecutionResult> {
  try {
    const validated = executeSavedSearchSchema.parse(payload);
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });

    const result = await savedSearchService.executeSavedSearch(
      validated.savedSearchId,
      candidateId,
      { isManual: validated.isManual }
    );

    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getNotificationsAction(): Promise<CandidateNotification[]> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const notifications = await careerRepository.getNotifications(candidateId);
    return serializeActionResponse(notifications);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function markNotificationReadAction(id: string): Promise<boolean> {
  try {
    const validated = markNotificationReadSchema.parse({ id });
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const success = await careerRepository.markNotificationAsRead(validated.id, candidateId);
    return serializeActionResponse(success);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function generateSavedSearchAlertsAction(options?: {
  frequency?: 'daily' | 'weekly';
}): Promise<{
  processedSearches: number;
  generatedAlerts: number;
  generatedNotifications: number;
}> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const result = await savedSearchService.generateSavedSearchAlerts({
      frequency: options?.frequency,
      candidateId
    });
    return serializeActionResponse(result);
  } catch (error) {
    return handleActionError(error);
  }
}
