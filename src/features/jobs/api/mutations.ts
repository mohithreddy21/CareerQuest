import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { importJobByUrlAction, runJobAnalysisAction } from './actions';
import { ImportJobPayload, ImportJobResponse } from './types';
import { jobKeys } from './queries';
import { JobAnalysis, JobMatch } from '@/types/domain';

export const importJobMutation = mutationOptions<ImportJobResponse, Error, ImportJobPayload>({
  mutationFn: (payload: ImportJobPayload) => importJobByUrlAction(payload),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: jobKeys.all });
  }
});

export const analyzeJobMutation = mutationOptions<
  { analysis: JobAnalysis; match: JobMatch },
  Error,
  { jobId: string }
>({
  mutationFn: ({ jobId }: { jobId: string }) => runJobAnalysisAction({ jobId }),
  onSuccess: (_data, variables) => {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: jobKeys.detail(variables.jobId) });
    qc.invalidateQueries({ queryKey: jobKeys.analysis(variables.jobId) });
    qc.invalidateQueries({ queryKey: jobKeys.match(variables.jobId) });
  }
});
