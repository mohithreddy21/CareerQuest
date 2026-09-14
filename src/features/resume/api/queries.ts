import { queryOptions } from '@tanstack/react-query';
import { getCandidateProfile, getMasterResume, getTailoredResumeForJob } from './service';

export const resumeKeys = {
  all: ['resumes'] as const,
  profile: () => [...resumeKeys.all, 'profile'] as const,
  master: () => [...resumeKeys.all, 'master'] as const,
  tailored: (jobId: string) => [...resumeKeys.all, 'tailored', jobId] as const
};

export const candidateProfileQueryOptions = () =>
  queryOptions({
    queryKey: resumeKeys.profile(),
    queryFn: () => getCandidateProfile()
  });

export const masterResumeQueryOptions = () =>
  queryOptions({
    queryKey: resumeKeys.master(),
    queryFn: () => getMasterResume()
  });

export const tailoredResumeQueryOptions = (jobId: string) =>
  queryOptions({
    queryKey: resumeKeys.tailored(jobId),
    queryFn: () => getTailoredResumeForJob(jobId)
  });
