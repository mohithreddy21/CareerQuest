import { ApplicationStatus, CandidateProfile, Job, JobMatch } from '@/types/domain';

export interface RecommendedOpportunity {
  job: Job;
  match: Partial<JobMatch> & { score: number; headline: string };
  applicationStatus?: ApplicationStatus;
}

export interface NextActionTask {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  actionUrl: string;
  actionLabel: string;
  category: string;
}

export interface DashboardOverviewResponse {
  candidate: CandidateProfile;
  recommended: RecommendedOpportunity[];
  pipelineCounts: Record<ApplicationStatus, number>;
  totalApplications: number;
  tasks: NextActionTask[];
}
