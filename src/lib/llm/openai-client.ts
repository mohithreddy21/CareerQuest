import { z } from 'zod';
import {
  ILLMClient,
  LLMStructuredRequest,
  LLMStructuredResponse,
  LLMAuthError,
  LLMConfigurationError,
  LLMRateLimitError,
  LLMResponseFormatError,
  LLMTimeoutError,
  LLMError
} from './llm-client.interface';

export interface OpenAILLMClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class OpenAILLMClient implements ILLMClient {
  readonly providerId = 'openai';
  readonly modelId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: OpenAILLMClientOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = (
      options.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    this.modelId =
      options.model || process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.timeoutMs = options.timeoutMs ?? 25000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  async generateStructured<T>(request: LLMStructuredRequest<T>): Promise<LLMStructuredResponse<T>> {
    if (!this.apiKey) {
      throw new LLMConfigurationError(
        'OPENAI_API_KEY is not configured. Please set OPENAI_API_KEY in environment variables.'
      );
    }

    // Convert Zod schema to JSON Schema for OpenAI Structured Outputs
    const rawJsonSchema = (z.toJSONSchema ? z.toJSONSchema(request.schema) : {}) as Record<
      string,
      unknown
    >;
    // Remove top-level $schema for OpenAI API compatibility
    const { $schema: _, ...cleanJsonSchema } = rawJsonSchema;

    const body = {
      model: this.modelId,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt }
      ],
      temperature: request.temperature ?? 0.1,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: request.schemaName,
          strict: true,
          schema: cleanJsonSchema
        }
      }
    };

    let attempt = 0;
    const startTime = Date.now();

    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timer);

        if (!response.ok) {
          const status = response.status;
          let errorText = '';
          try {
            const errorJson = await response.json();
            errorText = errorJson?.error?.message || JSON.stringify(errorJson);
          } catch {
            errorText = await response.text();
          }

          if (status === 401 || status === 403) {
            throw new LLMAuthError(`OpenAI Authentication Failed: ${errorText}`);
          }

          if (status === 429) {
            if (attempt <= this.maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
              continue;
            }
            throw new LLMRateLimitError(`OpenAI Rate Limit Exceeded: ${errorText}`);
          }

          if (status >= 500) {
            if (attempt <= this.maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
              continue;
            }
            throw new LLMError(
              `OpenAI Server Error (${status}): ${errorText}`,
              'SERVER_ERROR',
              status
            );
          }

          throw new LLMError(`OpenAI API Error (${status}): ${errorText}`, 'API_ERROR', status);
        }

        const json = await response.json();
        const latencyMs = Date.now() - startTime;
        const message = json.choices?.[0]?.message;
        const rawContent = message?.content;

        if (!rawContent) {
          throw new LLMResponseFormatError('OpenAI returned empty message content');
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawContent);
        } catch {
          throw new LLMResponseFormatError('OpenAI returned invalid JSON', rawContent);
        }

        // Validate parsed object against the required schema
        const validated = request.schema.parse(parsed);

        return {
          data: validated,
          rawJson: rawContent,
          metadata: {
            provider: this.providerId,
            model: this.modelId,
            extractionVersion: 'resume-extraction-v1',
            latencyMs,
            promptTokens: json.usage?.prompt_tokens,
            completionTokens: json.usage?.completion_tokens,
            totalTokens: json.usage?.total_tokens
          }
        };
      } catch (err: unknown) {
        clearTimeout(timer);

        if (err instanceof LLMError) {
          throw err;
        }

        if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
          if (attempt <= this.maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          throw new LLMTimeoutError(`OpenAI request timed out after ${this.timeoutMs}ms`);
        }

        if (attempt <= this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        throw new LLMError(
          `OpenAI network request failed: ${err instanceof Error ? err.message : String(err)}`,
          'NETWORK_ERROR'
        );
      }
    }

    throw new LLMError('OpenAI request failed after maximum retries', 'RETRY_EXHAUSTED');
  }
}
