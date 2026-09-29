'use server';

import { requireCandidateId } from '@/lib/auth';
import { careerRepository } from '@/services/career-repository';
import { DashboardOverviewResponse } from './types';

export async function getDashboardOverview(
  candidateId?: string
): Promise<DashboardOverviewResponse> {
  const resolvedCandidateId =
    candidateId || (await requireCandidateId({ redirectOnUnauthenticated: false }));
  return careerRepository.getDashboardOverview(resolvedCandidateId);
}
