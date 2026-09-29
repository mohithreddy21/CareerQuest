import { getLLMClient } from '@/lib/llm/llm-factory';
import {
  AITaskType,
  AIExecutionMetadata,
  JobExtractInputSchema,
  JobExtractOutputSchema,
  ResumeParseInputSchema,
  ResumeParseOutputSchema
} from './task-types';
import { getTaskPolicy } from './task-policy';
import { aiUsageRecorder } from './usage-recorder';
import { LLMError, LLMRateLimitError, LLMTimeoutError } from '@/lib/llm/llm-client.interface';

export class AIOrchestrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly isOperational = true
  ) {
    super(message);
    this.name = 'AIOrchestrationError';
  }
}

export class AIOrchestrator {
  /**
   * Dispatches a typed AI task through the governance, policy, and provider pipeline.
   */
  async dispatch<T>(
    taskType: AITaskType,
    input: unknown,
    options?: { candidateId?: string }
  ): Promise<{ data: T; metadata: AIExecutionMetadata }> {
    const startTime = Date.now();
    const policy = getTaskPolicy(taskType);

    // 1. Task-Specific Input Validation & Prompt Formulation
    let userPrompt: string;
    let schema: import('zod').ZodType<unknown>;
    let schemaName: string;

    switch (taskType) {
      case 'JOB_EXTRACT': {
        const validatedInput = JobExtractInputSchema.parse(input);
        userPrompt = `Please extract the job opportunity details from this text:
${validatedInput.hints?.title ? `[Hint Title: ${validatedInput.hints.title}]` : ''}
${validatedInput.hints?.company ? `[Hint Company: ${validatedInput.hints.company}]` : ''}

=== JOB TEXT START ===
${validatedInput.text}
=== JOB TEXT END ===`;
        schema = JobExtractOutputSchema;
        schemaName = 'job_extraction';
        break;
      }

      case 'RESUME_PARSE': {
        const validatedInput = ResumeParseInputSchema.parse(input);
        userPrompt = `Extract all verified career facts from the following resume text:

=== RESUME TEXT START ===
${validatedInput.text}
=== RESUME TEXT END ===`;
        schema = ResumeParseOutputSchema;
        schemaName = 'resume_facts';
        break;
      }

      default:
        throw new AIOrchestrationError(
          `Task '${taskType}' is not currently configured for direct execution in this phase.`,
          'UNSUPPORTED_TASK'
        );
    }

    // 2. Invoke Configured Provider (Gemini / test override)
    const client = getLLMClient();

    try {
      const response = await client.generateStructured({
        systemPrompt: policy.getSystemPrompt(),
        userPrompt,
        schema,
        schemaName,
        temperature: policy.temperature,
        maxTokens: policy.maxTokens
      });

      const latencyMs = Date.now() - startTime;
      const metadata: AIExecutionMetadata = {
        taskType,
        provider: response.metadata.provider || client.providerId,
        model: response.metadata.model || client.modelId,
        latencyMs,
        promptTokens: response.metadata.promptTokens,
        completionTokens: response.metadata.completionTokens,
        totalTokens: response.metadata.totalTokens,
        cacheHit: false
      };

      // Record operational telemetry
      void aiUsageRecorder.record({
        ...metadata,
        timestamp: new Date().toISOString(),
        candidateId: options?.candidateId,
        status: 'success'
      });

      return {
        data: response.data as T,
        metadata
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;

      let errCode = 'AI_EXECUTION_FAILED';
      let clientMsg = 'AI processing encountered a temporary error. Please try again.';

      if (err instanceof LLMRateLimitError) {
        errCode = 'AI_RATE_LIMIT';
        clientMsg = 'AI service is temporarily busy. Please wait a moment and try again.';
      } else if (err instanceof LLMTimeoutError) {
        errCode = 'AI_TIMEOUT';
        clientMsg =
          'AI service request timed out. Please try again or paste a concise description.';
      } else if (err instanceof LLMError) {
        errCode = err.code;
        clientMsg = err.message;
      } else if (err instanceof Error) {
        clientMsg = err.message;
      }

      // Record failure telemetry
      void aiUsageRecorder.record({
        taskType,
        provider: client.providerId,
        model: client.modelId,
        latencyMs,
        cacheHit: false,
        timestamp: new Date().toISOString(),
        candidateId: options?.candidateId,
        status: 'error',
        errorMessage: clientMsg
      });

      throw new AIOrchestrationError(clientMsg, errCode);
    }
  }
}

export const aiOrchestrator = new AIOrchestrator();
