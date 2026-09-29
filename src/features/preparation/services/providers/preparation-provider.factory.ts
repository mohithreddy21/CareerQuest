import { CoverLetterProvider, MockCoverLetterProvider } from './cover-letter-provider';
import { LLMCoverLetterProvider } from './llm-cover-letter-provider';
import {
  ApplicationQuestionProvider,
  MockApplicationQuestionProvider
} from './application-question-provider';
import { LLMApplicationQuestionProvider } from './llm-application-question-provider';

export class ProductionPreparationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionPreparationConfigurationError';
  }
}

let testCoverLetterProvider: CoverLetterProvider | null = null;
let testQuestionProvider: ApplicationQuestionProvider | null = null;

/**
 * Injects a test provider override for unit and integration testing.
 * Strictly forbidden in production mode.
 */
export function setCoverLetterProviderForTest(provider: CoverLetterProvider | null): void {
  if (process.env.NODE_ENV === 'production' && provider instanceof MockCoverLetterProvider) {
    throw new ProductionPreparationConfigurationError(
      'Test cover letter provider injection is strictly forbidden in production mode.'
    );
  }
  testCoverLetterProvider = provider;
}

export function setApplicationQuestionProviderForTest(
  provider: ApplicationQuestionProvider | null
): void {
  if (
    process.env.NODE_ENV === 'production' &&
    provider instanceof MockApplicationQuestionProvider
  ) {
    throw new ProductionPreparationConfigurationError(
      'Test application question provider injection is strictly forbidden in production mode.'
    );
  }
  testQuestionProvider = provider;
}

/**
 * Resolves the active CoverLetterProvider following strict environment invariants.
 */
export function getCoverLetterProvider(): CoverLetterProvider {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredProvider = process.env.COVER_LETTER_PROVIDER?.toLowerCase().trim();

  if (isProduction) {
    if (configuredProvider === 'mock') {
      throw new ProductionPreparationConfigurationError(
        'CRITICAL INVARIANT VIOLATION: MockCoverLetterProvider is strictly forbidden in production mode. Configure a valid LLM provider.'
      );
    }

    const hasApiKey = Boolean(
      process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    );

    if (!hasApiKey) {
      throw new ProductionPreparationConfigurationError(
        'Production cover letter generation requires a valid AI API key (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY).'
      );
    }

    return new LLMCoverLetterProvider();
  }

  // Development / Test mode
  if (testCoverLetterProvider) {
    return testCoverLetterProvider;
  }

  if (configuredProvider === 'mock') {
    return new MockCoverLetterProvider();
  }

  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  );

  if (hasApiKey || configuredProvider === 'llm') {
    return new LLMCoverLetterProvider();
  }

  // Offline test fallback
  return new MockCoverLetterProvider();
}

/**
 * Resolves the active ApplicationQuestionProvider following strict environment invariants.
 */
export function getApplicationQuestionProvider(): ApplicationQuestionProvider {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredProvider = process.env.APPLICATION_QUESTION_PROVIDER?.toLowerCase().trim();

  if (isProduction) {
    if (configuredProvider === 'mock') {
      throw new ProductionPreparationConfigurationError(
        'CRITICAL INVARIANT VIOLATION: MockApplicationQuestionProvider is strictly forbidden in production mode. Configure a valid LLM provider.'
      );
    }

    const hasApiKey = Boolean(
      process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
    );

    if (!hasApiKey) {
      throw new ProductionPreparationConfigurationError(
        'Production question answering requires a valid AI API key (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY).'
      );
    }

    return new LLMApplicationQuestionProvider();
  }

  // Development / Test mode
  if (testQuestionProvider) {
    return testQuestionProvider;
  }

  if (configuredProvider === 'mock') {
    return new MockApplicationQuestionProvider();
  }

  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  );

  if (hasApiKey || configuredProvider === 'llm') {
    return new LLMApplicationQuestionProvider();
  }

  // Offline test fallback
  return new MockApplicationQuestionProvider();
}
