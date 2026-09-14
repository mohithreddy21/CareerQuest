import { Job, JobAnalysis } from '@/types/domain';
import { mockAnalysisProvider } from './mock-analysis-provider';

export interface AnalysisProvider {
  analyze(job: Job): Promise<JobAnalysis>;
}

export class AnalysisService {
  constructor(private provider: AnalysisProvider = mockAnalysisProvider) {}

  async analyzeJob(job: Job): Promise<JobAnalysis> {
    return this.provider.analyze(job);
  }
}

export const analysisService = new AnalysisService();
