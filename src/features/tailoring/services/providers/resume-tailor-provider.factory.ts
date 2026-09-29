import { ResumeTailorProvider } from './resume-tailor-provider';
import { MockResumeTailorProvider } from './mock-resume-tailor-provider';
import { llmResumeTailorProvider } from './llm-resume-tailor-provider';

export class ProductionTailorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionTailorConfigurationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

let testTailorProvider: ResumeTailorProvider | null = null;
const defaultMockProvider = new MockResumeTailorProvider();

/**
 * Sets an explicit ResumeTailorProvider for test execution.
 */
export function setResumeTailorProviderForTest(provider: ResumeTailorProvider | null): void {
  testTailorProvider = provider;
}

/**
 * Resolves the configured ResumeTailorProvider based on environment variables
 * and enforces strict production invariants against silent mock fallbacks.
 */
export function getResumeTailorProvider(): ResumeTailorProvider {
  if (testTailorProvider) {
    return testTailorProvider;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const configuredProvider = (process.env.RESUME_TAILOR_PROVIDER || '').toLowerCase().trim();

  // STRICT PRODUCTION INVARIANT: Mock tailor provider is strictly forbidden in production
  if (isProduction) {
    if (configuredProvider === 'mock') {
      throw new ProductionTailorConfigurationError(
        'SECURITY & INTEGRITY VIOLATION: MockResumeTailorProvider is strictly prohibited in production. Configure a real LLM provider (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY).'
      );
    }

    const configuredLLM = (process.env.LLM_PROVIDER || '').toLowerCase().trim();
    if (configuredLLM === 'gemini' && !process.env.GEMINI_API_KEY) {
      throw new ProductionTailorConfigurationError(
        'Production resume tailoring intelligence is not configured. Set GEMINI_API_KEY in production environment variables.'
      );
    }

    const hasApiKey = Boolean(
      process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    );
    if (!hasApiKey) {
      throw new ProductionTailorConfigurationError(
        'Production resume tailoring intelligence is not configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in production environment variables.'
      );
    }

    return llmResumeTailorProvider;
  }

  // Non-production environment resolution
  if (configuredProvider === 'mock') {
    return defaultMockProvider;
  }

  if (configuredProvider === 'llm') {
    return llmResumeTailorProvider;
  }

  // If unspecified in development/test: use LLM if key is present, otherwise fallback to mock for offline dev
  const hasDevApiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  );
  if (hasDevApiKey) {
    return llmResumeTailorProvider;
  }

  return defaultMockProvider;
}
