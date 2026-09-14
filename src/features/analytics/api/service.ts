import { careerRepository } from '@/services/career-repository';
import { SearchAnalyticsService } from '../services/analytics-service';
import { InsightEngineResult, SearchInsightEngine } from '../services/insight-engine';
import { SearchAnalytics } from '@/types/application-tracking';

export async function getSearchAnalytics(candidateId?: string): Promise<SearchAnalytics> {
  const applications = await careerRepository.getApplications(undefined, candidateId);
  const events = await careerRepository.getApplicationEvents(undefined, candidateId);
  return SearchAnalyticsService.computeAnalytics(applications, events);
}

export async function getSearchInsights(candidateId?: string): Promise<InsightEngineResult> {
  const applications = await careerRepository.getApplications(undefined, candidateId);
  const events = await careerRepository.getApplicationEvents(undefined, candidateId);
  const analytics = SearchAnalyticsService.computeAnalytics(applications, events);
  return SearchInsightEngine.generateInsights(analytics, applications);
}
