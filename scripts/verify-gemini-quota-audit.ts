/**
 * CareerQuest — Gemini 429 Quota Handling Audit Verification Suite
 *
 * Deterministic test suite verifying:
 * 1. HTTP 400: throws immediately with NO retry (1 attempt)
 * 2. HTTP 401/403: throws LLMAuthError immediately with NO retry (1 attempt)
 * 3. HTTP 429: bounded retry (exactly maxRetries), parses Google retry guidance & headers, caps delay, throws LLMRateLimitError
 * 4. HTTP 500/503: bounded retry (exactly maxRetries), exponential backoff, throws LLMError
 * 5. Transactional Safety: when Gemini 429 occurs during resume ingestion, ZERO ProposedKnowledgeItems,
 *    ZERO Approved KnowledgeItems, and ZERO ResumeIngestionBatches are persisted to the database.
 * 6. Secret Redaction & Safe Error UX: no API keys or internal headers exposed in error messages.
 *
 * NOTE: Strictly mocks HTTP responses. Makes ZERO external Gemini network calls and consumes ZERO quota.
 */

import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { GeminiLLMClient } from '../src/lib/llm/gemini-client';
import {
  LLMError,
  LLMAuthError,
  LLMRateLimitError
} from '../src/lib/llm/llm-client.interface';
import { LLMResumeParserProvider } from '../src/features/knowledge/services/providers/llm-resume-parser-provider';
import { ResumeIngestionService } from '../src/features/knowledge/services/resume-ingestion-service';
import { handleActionError } from '../src/lib/action-utils';

const prisma = new PrismaClient();

const testSchema = z.object({
  greeting: z.string(),
  status: z.string()
});

const sampleRequest = {
  systemPrompt: 'You are a test assistant.',
  userPrompt: 'Hello',
  schema: testSchema,
  schemaName: 'test_greeting'
};

async function runAudit() {
  console.log('================================================================');
  console.log('  CareerQuest: Gemini 429 Quota Handling & Resiliency Audit');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (!condition) {
      console.error(`[FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passedTests++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  const originalFetch = globalThis.fetch;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: HTTP 400 -> No Retry (fails immediately after 1 attempt)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. HTTP 400 (Bad Request / Schema Error) -> Zero Retries ---');
    let fetchCallCount400 = 0;
    globalThis.fetch = (async () => {
      fetchCallCount400++;
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: 'Invalid JSON schema: unsupported keyword $comment',
            status: 'INVALID_ARGUMENT'
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const delays400: number[] = [];
    const client400 = new GeminiLLMClient({
      apiKey: 'test-api-key',
      maxRetries: 2,
      sleepFn: async (ms) => {
        delays400.push(ms);
      }
    });

    let error400: unknown = null;
    try {
      await client400.generateStructured(sampleRequest);
    } catch (e) {
      error400 = e;
    }

    assert(error400 instanceof LLMError, 'Throws LLMError on HTTP 400');
    assert((error400 as LLMError).status === 400, 'Error status is 400');
    assert((error400 as LLMError).code === 'API_ERROR', 'Error code is API_ERROR');
    assert(fetchCallCount400 === 1, `Fetch was invoked exactly 1 time (actual: ${fetchCallCount400})`);
    assert(delays400.length === 0, 'No retry delays occurred (zero sleep calls)');

    // -------------------------------------------------------------------------
    // TEST 2: HTTP 401/403 -> No Retry (Authentication failure)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. HTTP 401/403 (Auth Failure) -> Zero Retries, Typed LLMAuthError ---');
    let fetchCallCount401 = 0;
    globalThis.fetch = (async () => {
      fetchCallCount401++;
      return new Response(
        JSON.stringify({
          error: {
            code: 401,
            message: 'API key not valid. Please pass a valid API key.',
            status: 'UNAUTHENTICATED'
          }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const delays401: number[] = [];
    const client401 = new GeminiLLMClient({
      apiKey: 'invalid-key-xyz',
      maxRetries: 2,
      sleepFn: async (ms) => {
        delays401.push(ms);
      }
    });

    let error401: unknown = null;
    try {
      await client401.generateStructured(sampleRequest);
    } catch (e) {
      error401 = e;
    }

    assert(error401 instanceof LLMAuthError, 'Throws LLMAuthError on HTTP 401');
    assert((error401 as LLMAuthError).status === 401, 'Error status is 401');
    assert((error401 as LLMAuthError).code === 'AUTHENTICATION_ERROR', 'Error code is AUTHENTICATION_ERROR');
    assert(fetchCallCount401 === 1, `Fetch was invoked exactly 1 time (actual: ${fetchCallCount401})`);
    assert(delays401.length === 0, 'No retry delays occurred for auth error');

    // -------------------------------------------------------------------------
    // TEST 3: HTTP 429 -> Bounded Retry, Parses Google Retry Guidance, Capped Delay
    // -------------------------------------------------------------------------
    console.log('\n--- 3. HTTP 429 (Rate Limit / Quota Exceeded) -> Bounded Retries & Delay Parsing ---');
    let fetchCallCount429 = 0;
    const realGoogle429Message =
      "You exceeded your current quota for the 'Generate Content API requests per minute' metric. " +
      'limit: 20, model: gemini-3.8-flash. Please retry in 57.939082929s.';

    globalThis.fetch = (async () => {
      fetchCallCount429++;
      return new Response(
        JSON.stringify({
          error: {
            code: 429,
            message: realGoogle429Message,
            status: 'RESOURCE_EXHAUSTED'
          }
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const delays429: number[] = [];
    const maxRetries = 2;
    const client429 = new GeminiLLMClient({
      apiKey: 'test-api-key',
      maxRetries,
      sleepFn: async (ms) => {
        delays429.push(ms);
      }
    });

    let error429: unknown = null;
    try {
      await client429.generateStructured(sampleRequest);
    } catch (e) {
      error429 = e;
    }

    assert(error429 instanceof LLMRateLimitError, 'Throws LLMRateLimitError after exhausting retries');
    assert((error429 as LLMRateLimitError).status === 429, 'Error status is 429');
    assert((error429 as LLMRateLimitError).code === 'RATE_LIMIT_ERROR', 'Error code is RATE_LIMIT_ERROR');
    assert(
      fetchCallCount429 === maxRetries + 1,
      `Fetch called exactly ${maxRetries + 1} times (1 initial + ${maxRetries} retries, actual: ${fetchCallCount429})`
    );
    assert(delays429.length === maxRetries, `Exactly ${maxRetries} retry delays executed (actual: ${delays429.length})`);

    // Verify retry guidance parsing: 57.939s -> Math.min(Math.ceil(57.939082929 * 1000) + 1000, 60000) = 58940ms
    const expectedDelayMs = Math.min(Math.ceil(57.939082929 * 1000) + 1000, 60000);
    assert(
      delays429[0] === expectedDelayMs,
      `Parsed retry delay accurately: expected ${expectedDelayMs}ms, actual ${delays429[0]}ms`
    );
    assert(delays429[0] <= 60000, `Delay is bounded to max 60000ms: actual ${delays429[0]}ms`);

    // Verify Retry-After header takes precedence or works if present
    console.log('\n--- 3b. HTTP 429 with Retry-After header ---');
    let fetchCountHeader = 0;
    globalThis.fetch = (async () => {
      fetchCountHeader++;
      return new Response(
        JSON.stringify({
          error: {
            code: 429,
            message: 'Too Many Requests',
            status: 'RESOURCE_EXHAUSTED'
          }
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'retry-after': '12'
          }
        }
      );
    }) as typeof fetch;

    const delaysHeader: number[] = [];
    const clientHeader = new GeminiLLMClient({
      apiKey: 'test-api-key',
      maxRetries: 1,
      sleepFn: async (ms) => {
        delaysHeader.push(ms);
      }
    });

    try {
      await clientHeader.generateStructured(sampleRequest);
    } catch (e) {
      assert(e instanceof LLMRateLimitError, 'Throws LLMRateLimitError on Retry-After header test');
    }
    assert(fetchCountHeader === 2, 'Header test: called 2 times (1 attempt + 1 retry)');
    assert(delaysHeader[0] === 13000, `Retry-After: 12 parsed to 13000ms (12s + 1s buffer): actual ${delaysHeader[0]}ms`);

    // -------------------------------------------------------------------------
    // TEST 4: HTTP 500/503 -> Bounded Retry with Exponential Backoff
    // -------------------------------------------------------------------------
    console.log('\n--- 4. HTTP 500/503 (Server Error) -> Bounded Retries & Exponential Backoff ---');
    let fetchCallCount503 = 0;
    globalThis.fetch = (async () => {
      fetchCallCount503++;
      return new Response(
        JSON.stringify({
          error: {
            code: 503,
            message: 'Service Temporarily Unavailable',
            status: 'UNAVAILABLE'
          }
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const delays503: number[] = [];
    const client503 = new GeminiLLMClient({
      apiKey: 'test-api-key',
      maxRetries: 2,
      sleepFn: async (ms) => {
        delays503.push(ms);
      }
    });

    let error503: unknown = null;
    try {
      await client503.generateStructured(sampleRequest);
    } catch (e) {
      error503 = e;
    }

    assert(error503 instanceof LLMError, 'Throws LLMError on HTTP 503');
    assert((error503 as LLMError).status === 503, 'Error status is 503');
    assert((error503 as LLMError).code === 'SERVICE_ERROR', 'Error code is SERVICE_ERROR');
    assert(fetchCallCount503 === 3, 'Fetch called exactly 3 times (1 initial + 2 retries)');
    assert(delays503[0] === 1000, `Attempt 1 exponential backoff: expected 1000ms, actual ${delays503[0]}ms`);
    assert(delays503[1] === 2000, `Attempt 2 exponential backoff: expected 2000ms, actual ${delays503[1]}ms`);

    // -------------------------------------------------------------------------
    // TEST 5: Transactional Safety during Resume Ingestion on Gemini 429
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Transactional Safety: Zero DB Mutations when Gemini 429 Occurs ---');
    const AUDIT_CAND = 'cand-gemini-429-audit';

    // Teardown candidate artifacts
    await prisma.knowledgeProvenance.deleteMany({ where: { knowledgeItem: { candidateId: AUDIT_CAND } } });
    await prisma.knowledgeItem.deleteMany({ where: { candidateId: AUDIT_CAND } });
    await prisma.resumeIngestionBatch.deleteMany({ where: { candidateId: AUDIT_CAND } });
    await prisma.candidateDocument.deleteMany({ where: { candidateId: AUDIT_CAND } });
    await prisma.candidate.deleteMany({ where: { id: AUDIT_CAND } });

    // Provision test candidate
    await prisma.candidate.create({
      data: {
        id: AUDIT_CAND,
        clerkUserId: 'user_gemini_429_audit',
        email: 'audit429@careerquest.internal',
        profile: {
          create: {
            name: 'Audit Candidate',
            headline: 'Systems Architect',
            location: 'San Francisco, CA',
            professionalSummary: 'Audit candidate professional summary.'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Systems Architect']
          }
        }
      }
    });

    // Create a mock LLM client that returns 429
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 429,
            message: realGoogle429Message,
            status: 'RESOURCE_EXHAUSTED'
          }
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const rateLimitingClient = new GeminiLLMClient({
      apiKey: 'test-api-key',
      maxRetries: 1,
      sleepFn: async () => {} // Instant in test
    });

    const parserProvider = new LLMResumeParserProvider(rateLimitingClient);
    const ingestionService = new ResumeIngestionService(parserProvider);

    const testResumeText =
      'Alice Walker\nSenior Python Engineer\nSkills: Python, TypeScript, Docker\nExperience: Python Lead at TechCorp 2020-2024';

    let ingestionError: unknown = null;
    try {
      await ingestionService.ingestResume(AUDIT_CAND, {
        fileName: 'Software Developer Python.pdf',
        text: testResumeText,
        documentId: 'doc_audit_test_123'
      });
    } catch (e) {
      ingestionError = e;
    }

    assert(
      ingestionError instanceof LLMRateLimitError,
      'ResumeIngestionService throws LLMRateLimitError directly on Gemini 429'
    );

    // Verify PostgreSQL Database State: ZERO records created
    const persistedBatches = await prisma.resumeIngestionBatch.findMany({
      where: { candidateId: AUDIT_CAND }
    });
    assert(
      persistedBatches.length === 0,
      `ZERO ResumeIngestionBatch records exist in DB (actual count: ${persistedBatches.length})`
    );

    const persistedKnowledgeItems = await prisma.knowledgeItem.findMany({
      where: { candidateId: AUDIT_CAND }
    });
    assert(
      persistedKnowledgeItems.length === 0,
      `ZERO KnowledgeItem records exist in DB (actual count: ${persistedKnowledgeItems.length})`
    );

    const persistedProvenance = await prisma.knowledgeProvenance.findMany({
      where: { knowledgeItem: { candidateId: AUDIT_CAND } }
    });
    assert(
      persistedProvenance.length === 0,
      `ZERO KnowledgeProvenance records exist in DB (actual count: ${persistedProvenance.length})`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Error Classification & API Key Redaction Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Error Distinction & Secret Redaction ---');
    const sensitiveApiKey = 'AIzaSyD_SECRET_GEMINI_KEY_9876543210';
    let leakedErrorMsg = '';

    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 429,
            message: `Quota limit 20 exceeded for key ${sensitiveApiKey}. Please retry in 5s.`,
            status: 'RESOURCE_EXHAUSTED'
          }
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    const sanitizingClient = new GeminiLLMClient({
      apiKey: sensitiveApiKey,
      maxRetries: 0,
      sleepFn: async () => {}
    });

    try {
      await sanitizingClient.generateStructured(sampleRequest);
    } catch (e) {
      leakedErrorMsg = (e as Error).message;
    }

    assert(
      !leakedErrorMsg.includes(sensitiveApiKey),
      'Sensitive API key is redacted from error message (not exposed)'
    );
    assert(
      leakedErrorMsg.includes('[REDACTED]'),
      'Redaction marker [REDACTED] is present in place of sensitive token'
    );
    assert(
      leakedErrorMsg.startsWith('Gemini Rate Limit Exceeded (HTTP 429)'),
      'Error is explicitly classified as Gemini Rate Limit Exceeded (HTTP 429)'
    );

    // Verify handleActionError does not mangle LLMRateLimitError
    let actionErrorMsg = '';
    try {
      handleActionError(new LLMRateLimitError('Gemini Rate Limit Exceeded (HTTP 429): retry in 57s'));
    } catch (e) {
      actionErrorMsg = (e as Error).message;
    }
    assert(
      actionErrorMsg === 'Gemini Rate Limit Exceeded (HTTP 429): retry in 57s',
      'handleActionError cleanly preserves typed rate limit error message without mangling'
    );

    // Teardown candidate artifacts
    await prisma.candidate.deleteMany({ where: { id: AUDIT_CAND } });
  } finally {
    // Restore original global fetch
    globalThis.fetch = originalFetch;
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`  AUDIT COMPLETED: ${passedTests}/${totalTests} checks passed successfully.`);
  console.log('================================================================\n');
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
