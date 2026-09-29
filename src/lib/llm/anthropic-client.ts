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

export interface AnthropicLLMClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class AnthropicLLMClient implements ILLMClient {
  readonly providerId = 'anthropic';
  readonly modelId: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: AnthropicLLMClientOptions = {}) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = (
      options.baseUrl ||
      process.env.ANTHROPIC_BASE_URL ||
      'https://api.anthropic.com/v1'
    ).replace(/\/+$/, '');
    this.modelId =
      options.model ||
      process.env.LLM_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      'claude-3-5-haiku-20241022';
    this.timeoutMs = options.timeoutMs ?? 25000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  async generateStructured<T>(request: LLMStructuredRequest<T>): Promise<LLMStructuredResponse<T>> {
    if (!this.apiKey) {
      throw new LLMConfigurationError(
        'ANTHROPIC_API_KEY is not configured. Please set ANTHROPIC_API_KEY in environment variables.'
      );
    }

    const rawJsonSchema = (z.toJSONSchema ? z.toJSONSchema(request.schema) : {}) as Record<
      string,
      unknown
    >;
    const { $schema: _, ...cleanJsonSchema } = rawJsonSchema;

    const body = {
      model: this.modelId,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.1,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }],
      tools: [
        {
          name: request.schemaName,
          description: `Extracted structured data for ${request.schemaName}`,
          input_schema: cleanJsonSchema
        }
      ],
      tool_choice: { type: 'tool', name: request.schemaName }
    };

    let attempt = 0;
    const startTime = Date.now();

    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
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
            throw new LLMAuthError(`Anthropic Authentication Failed: ${errorText}`);
          }

          if (status === 429) {
            if (attempt <= this.maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
              continue;
            }
            throw new LLMRateLimitError(`Anthropic Rate Limit Exceeded: ${errorText}`);
          }

          if (status >= 500) {
            if (attempt <= this.maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
              continue;
            }
            throw new LLMError(
              `Anthropic Server Error (${status}): ${errorText}`,
              'SERVER_ERROR',
              status
            );
          }

          throw new LLMError(`Anthropic API Error (${status}): ${errorText}`, 'API_ERROR', status);
        }

        const json = await response.json();
        const latencyMs = Date.now() - startTime;

        // Extract tool use content
        const toolUseBlock = json.content?.find((c: { type: string }) => c.type === 'tool_use');
        if (!toolUseBlock || !toolUseBlock.input) {
          throw new LLMResponseFormatError(
            'Anthropic response did not contain expected tool_use input'
          );
        }

        const validated = request.schema.parse(toolUseBlock.input);

        return {
          data: validated,
          rawJson: JSON.stringify(toolUseBlock.input),
          metadata: {
            provider: this.providerId,
            model: this.modelId,
            extractionVersion: 'resume-extraction-v1',
            latencyMs,
            promptTokens: json.usage?.input_tokens,
            completionTokens: json.usage?.output_tokens,
            totalTokens: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0)
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
          throw new LLMTimeoutError(`Anthropic request timed out after ${this.timeoutMs}ms`);
        }

        if (attempt <= this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        throw new LLMError(
          `Anthropic network request failed: ${err instanceof Error ? err.message : String(err)}`,
          'NETWORK_ERROR'
        );
      }
    }

    throw new LLMError('Anthropic request failed after maximum retries', 'RETRY_EXHAUSTED');
  }
}
