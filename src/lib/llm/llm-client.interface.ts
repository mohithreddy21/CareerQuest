import { z } from 'zod';

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'LLMError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LLMConfigurationError extends LLMError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500);
    this.name = 'LLMConfigurationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LLMAuthError extends LLMError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'LLMAuthError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(message: string) {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'LLMRateLimitError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(message = 'LLM request timed out') {
    super(message, 'TIMEOUT_ERROR', 408);
    this.name = 'LLMTimeoutError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LLMResponseFormatError extends LLMError {
  constructor(
    message: string,
    public readonly rawText?: string
  ) {
    super(message, 'RESPONSE_FORMAT_ERROR', 502);
    this.name = 'LLMResponseFormatError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface LLMStructuredRequest<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMStructuredResponse<T> {
  data: T;
  rawJson: string;
  metadata: {
    provider: string;
    model: string;
    extractionVersion: string;
    latencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface ILLMClient {
  readonly providerId: string;
  readonly modelId: string;
  generateStructured<T>(request: LLMStructuredRequest<T>): Promise<LLMStructuredResponse<T>>;
}
