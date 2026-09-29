import { ILLMClient, LLMConfigurationError } from './llm-client.interface';
import { OpenAILLMClient } from './openai-client';
import { AnthropicLLMClient } from './anthropic-client';
import { GeminiLLMClient } from './gemini-client';

let testLLMClient: ILLMClient | null = null;
let defaultLLMClient: ILLMClient | null = null;

/**
 * Set an explicit LLM client for testing purposes (e.g. offline tests or simulated provider responses)
 */
export function setLLMClientForTest(client: ILLMClient | null): void {
  if (process.env.NODE_ENV === 'production' && client !== null) {
    throw new LLMConfigurationError(
      'Mock/test LLM client cannot be configured in production environment.'
    );
  }
  testLLMClient = client;
}

/**
 * Resolves the configured ILLMClient based on environment variables
 */
export function getLLMClient(): ILLMClient {
  if (testLLMClient) {
    if (process.env.NODE_ENV === 'production') {
      throw new LLMConfigurationError(
        'Mock/test LLM client execution is strictly forbidden in production environment.'
      );
    }
    return testLLMClient;
  }

  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase().trim();

  if (provider === 'mock' || provider === 'fake' || provider === 'test') {
    throw new LLMConfigurationError(
      `Mock provider '${provider}' is forbidden in runtime. Only real providers ('gemini', 'openai', 'anthropic') are supported.`
    );
  }

  if (provider === 'gemini') {
    if (!defaultLLMClient || defaultLLMClient.providerId !== 'gemini') {
      defaultLLMClient = new GeminiLLMClient();
    }
    return defaultLLMClient;
  }

  if (provider === 'openai') {
    if (!defaultLLMClient || defaultLLMClient.providerId !== 'openai') {
      defaultLLMClient = new OpenAILLMClient();
    }
    return defaultLLMClient;
  }

  if (provider === 'anthropic') {
    if (!defaultLLMClient || defaultLLMClient.providerId !== 'anthropic') {
      defaultLLMClient = new AnthropicLLMClient();
    }
    return defaultLLMClient;
  }

  throw new LLMConfigurationError(
    `Unsupported LLM provider '${provider}'. Supported providers are 'gemini', 'openai', and 'anthropic'.`
  );
}
