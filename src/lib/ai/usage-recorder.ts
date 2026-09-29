import { AIExecutionMetadata } from './task-types';

export interface AIUsageRecordPayload extends AIExecutionMetadata {
  timestamp: string;
  candidateId?: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface IAIUsageRecorder {
  record(payload: AIUsageRecordPayload): Promise<void>;
  getRecentRecords(): ReadonlyArray<AIUsageRecordPayload>;
}

/**
 * Standard AI Usage Recorder.
 * Provides architectural boundary for future database persistence (e.g. AiUsageRecord model)
 * and operational telemetry.
 */
class InMemoryAIUsageRecorder implements IAIUsageRecorder {
  private recentRecords: AIUsageRecordPayload[] = [];
  private readonly maxRecords = 200;

  async record(payload: AIUsageRecordPayload): Promise<void> {
    this.recentRecords.push(payload);
    if (this.recentRecords.length > this.maxRecords) {
      this.recentRecords.shift();
    }
  }

  getRecentRecords(): ReadonlyArray<AIUsageRecordPayload> {
    return [...this.recentRecords];
  }
}

export const aiUsageRecorder: IAIUsageRecorder = new InMemoryAIUsageRecorder();
