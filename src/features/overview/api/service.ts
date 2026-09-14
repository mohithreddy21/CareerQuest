import { careerRepository } from '@/services/career-repository';
import { DashboardOverviewResponse } from './types';

export async function getDashboardOverview(
  candidateId?: string
): Promise<DashboardOverviewResponse> {
  return careerRepository.getDashboardOverview(candidateId);
}
