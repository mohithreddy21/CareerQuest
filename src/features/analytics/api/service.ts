'use server';

import { requireCandidateId } from '@/lib/auth';
import { careerRepository } from '@/services/career-repository';
import { SearchAnalyticsService } from '../services/analytics-service';
import { InsightEngineResult, SearchInsightEngine } from '../services/insight-engine';
import { SearchAnalytics } from '@/types/application-tracking';

export async function getSearchAnalytics(candidateId?: string): Promise<SearchAnalytics> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const applications = await careerRepository.getApplications(undefined, resolvedId);
  const events = await careerRepository.getApplicationEvents(undefined, resolvedId);
  return SearchAnalyticsService.computeAnalytics(applications, events);
}

export async function getSearchInsights(candidateId?: string): Promise<InsightEngineResult> {
  const resolvedId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  const applications = await careerRepository.getApplications(undefined, resolvedId);
  const events = await careerRepository.getApplicationEvents(undefined, resolvedId);
  const analytics = SearchAnalyticsService.computeAnalytics(applications, events);
  return SearchInsightEngine.generateInsights(analytics, applications);
}
