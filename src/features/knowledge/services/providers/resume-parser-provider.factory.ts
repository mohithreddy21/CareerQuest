import { ResumeParserProvider } from './resume-parser-provider';
import { mockResumeParserProvider } from './mock-resume-parser-provider';
import { llmResumeParserProvider } from './llm-resume-parser-provider';

export class ProductionParserConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionParserConfigurationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

let testParserProvider: ResumeParserProvider | null = null;

/**
 * Set an explicit ResumeParserProvider for testing purposes
 */
export function setResumeParserProviderForTest(provider: ResumeParserProvider | null): void {
  testParserProvider = provider;
}

/**
 * Resolves the configured ResumeParserProvider based on environment variables
 * and enforces strict production invariants against silent mock fallbacks.
 */
export function getResumeParserProvider(): ResumeParserProvider {
  if (testParserProvider) {
    return testParserProvider;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const configuredProvider = (process.env.RESUME_PARSER_PROVIDER || '').toLowerCase().trim();

  // STRICT PRODUCTION INVARIANT: Mock parser is strictly forbidden in production
  if (isProduction) {
    if (configuredProvider === 'mock') {
      throw new ProductionParserConfigurationError(
        'SECURITY & INTEGRITY VIOLATION: MockResumeParserProvider is strictly prohibited in production. Configure a real LLM provider (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY).'
      );
    }

    const configuredLLM = (process.env.LLM_PROVIDER || '').toLowerCase().trim();
    if (configuredLLM === 'gemini' && !process.env.GEMINI_API_KEY) {
      throw new ProductionParserConfigurationError(
        'Production resume intelligence is not configured. Set GEMINI_API_KEY in production environment variables.'
      );
    }

    const hasApiKey = Boolean(
      process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    );
    if (!hasApiKey) {
      throw new ProductionParserConfigurationError(
        'Production resume intelligence is not configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in production environment variables.'
      );
    }

    return llmResumeParserProvider;
  }

  // Non-production environment resolution
  if (configuredProvider === 'mock') {
    return mockResumeParserProvider;
  }

  if (configuredProvider === 'llm') {
    return llmResumeParserProvider;
  }

  // If unspecified in development/test: use LLM if key is present, otherwise fallback to mock for offline dev
  const hasDevApiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  );
  if (hasDevApiKey) {
    return llmResumeParserProvider;
  }

  return mockResumeParserProvider;
}
