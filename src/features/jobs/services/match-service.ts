import { CandidateProfile, Job, JobAnalysis, JobMatch } from '@/types/domain';
import { mockMatchProvider } from './mock-match-provider';

export interface MatchProvider {
  calculateMatch(job: Job, analysis: JobAnalysis, candidate: CandidateProfile): Promise<JobMatch>;
}

export class MatchService {
  constructor(private provider: MatchProvider = mockMatchProvider) {}

  async calculateMatch(
    job: Job,
    analysis: JobAnalysis,
    candidate: CandidateProfile
  ): Promise<JobMatch> {
    return this.provider.calculateMatch(job, analysis, candidate);
  }
}

export const matchService = new MatchService();
