import { AITaskType } from './task-types';

export type AIModelTier = 'FAST_EXTRACTOR' | 'COMPLEX_REASONER';

export interface AITaskPolicy {
  tier: AIModelTier;
  preferredProvider: string;
  preferredModel: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  getSystemPrompt: () => string;
}

/**
 * Returns configuration-driven policy for each AI task.
 * Uses environment configuration with fallbacks that preserve the active Gemini setup.
 */
export function getTaskPolicy(taskType: AITaskType): AITaskPolicy {
  const activeProvider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase().trim();
  const configuredModel = process.env.LLM_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  switch (taskType) {
    case 'JOB_EXTRACT':
      return {
        tier: 'FAST_EXTRACTOR',
        preferredProvider: activeProvider,
        preferredModel: configuredModel,
        temperature: 0.1,
        maxTokens: 2500,
        timeoutMs: 25000,
        getSystemPrompt: () => `You are CareerQuest's expert Job Extraction engine.
Your sole job is to extract factual, explicitly stated job details from candidate-provided text.

STRICT EXTRACTION INVARIANTS:
1. Extract ONLY facts present in the provided text.
2. NEVER hallucinate, guess, or assume salary, skills, company, experience, or requirements.
3. If salary is not explicitly stated in the text, return salaryMin: null, salaryMax: null, salaryCurrency: null, salaryInterval: null.
4. If company is not identified, return company: null.
5. If title is not identified, return title: null.
6. Clean and deduplicate extracted skill keywords.
7. Return clean JSON matching the requested schema.`
      };

    case 'RESUME_PARSE':
      return {
        tier: 'FAST_EXTRACTOR',
        preferredProvider: activeProvider,
        preferredModel: configuredModel,
        temperature: 0.1,
        maxTokens: 3500,
        timeoutMs: 30000,
        getSystemPrompt: () => `You are CareerQuest's expert Resume Fact Extraction engine.
Your sole job is to extract verified, factual career assets from the candidate's resume text.

CRITICAL FACTUAL INVARIANTS:
1. Extract ONLY facts explicitly stated in the resume text.
2. NEVER hallucinate, extrapolate, or invent achievements, metrics, skills, or dates.
3. Every skill, experience item, and education item must have exact ground-truth evidence in the text.
4. Return clean JSON matching the requested schema.`
      };

    case 'RESUME_TAILOR':
    case 'COVER_LETTER':
    case 'APPLICATION_QUESTION':
      return {
        tier: 'COMPLEX_REASONER',
        preferredProvider: activeProvider,
        preferredModel: configuredModel,
        temperature: 0.3,
        maxTokens: 3000,
        timeoutMs: 35000,
        getSystemPrompt: () => `You are CareerQuest's grounded career assistant.
Strictly adhere to the provided approved Knowledge Bank items and target job requirements.`
      };

    case 'SKILL_NORMALIZE':
    default:
      return {
        tier: 'FAST_EXTRACTOR',
        preferredProvider: activeProvider,
        preferredModel: configuredModel,
        temperature: 0.0,
        maxTokens: 1500,
        timeoutMs: 15000,
        getSystemPrompt: () =>
          `You are CareerQuest's Skill Normalization engine. Map raw skill terms to canonical industry keywords.`
      };
  }
}
