import { Job, JobAnalysis, ResumeVersion } from '@/types/domain';
import { RetrievedCandidateKnowledge, ResumeChange } from '@/types/tailoring';

export interface ResumeTailorProvider {
  generateProposedChanges(
    job: Job,
    analysis: JobAnalysis,
    masterResume: ResumeVersion,
    retrievedKnowledge: RetrievedCandidateKnowledge
  ): Promise<ResumeChange[]>;
}
