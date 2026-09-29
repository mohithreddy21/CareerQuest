/* eslint-disable no-console */
import {
  ResumeTailorInputSchema,
  ResumeTailorOutputSchema,
  CoverLetterInputSchema,
  CoverLetterOutputSchema,
  ApplicationQuestionInputSchema,
  ApplicationQuestionOutputSchema,
  ApplicationQuestionCategorySchema
} from '../src/lib/ai/task-types';
import { getTaskPolicy } from '../src/lib/ai/task-policy';
import { aiOrchestrator, AIOrchestrationError } from '../src/lib/ai/ai-orchestrator';
import { setLLMClientForTest, getLLMClient } from '../src/lib/llm/llm-factory';
import { ILLMClient, LLMRateLimitError, LLMTimeoutError } from '../src/lib/llm/llm-client.interface';
import { positiveGroundingValidator } from '../src/features/tailoring/services/grounding-validator';
import { KnowledgeItem } from '../src/types/knowledge';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function runPhase8AVerification() {
  console.log('================================================================');
  console.log('🔍 CAREERQUEST PHASE 8A: AI TASK CONTRACTS & GROUNDING VERIFICATION');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // 1. AI TASK CONTRACT SCHEMAS
  // -------------------------------------------------------------------------
  console.log('--- 1. Testing AI Task Contracts & Zod Schemas ---');

  // 1.1 RESUME_TAILOR valid input & output
  const validTailorInput = {
    job: {
      id: 'job-stripe-1',
      title: 'Staff Backend Engineer',
      company: 'Stripe',
      requiredSkills: ['Node.js', 'PostgreSQL', 'Distributed Systems'],
      preferredSkills: ['Kafka', 'TypeScript'],
      responsibilities: ['Architect merchant billing microservices']
    },
    masterResume: {
      id: 'res-master-1',
      summary: 'Experienced Full-Stack Engineer specializing in backend performance.',
      experience: [
        {
          id: 'exp-1',
          employer: 'Veloce Labs',
          role: 'Senior Software Engineer',
          responsibilities: ['Built high-throughput payment ingestion pipeline'],
          achievements: ['Reduced p95 latency by 82% across all merchant APIs']
        }
      ],
      skills: {
        technical: ['TypeScript', 'Node.js', 'PostgreSQL'],
        tools: ['Docker', 'Kafka'],
        soft: ['Leadership'],
        other: []
      },
      projects: []
    },
    approvedKnowledge: [
      {
        knowledgeItemId: 'kb-exp-1',
        category: 'experience',
        title: 'Senior Software Engineer at Veloce Labs',
        supportingSnippet: 'Reduced p95 latency by 82% across all merchant APIs'
      }
    ]
  };

  const parsedTailorInput = ResumeTailorInputSchema.safeParse(validTailorInput);
  assert(parsedTailorInput.success, 'ResumeTailorInputSchema accepts valid input');

  // Invalid input (empty approvedKnowledge)
  const invalidTailorInput = {
    ...validTailorInput,
    approvedKnowledge: []
  };
  const parsedInvalidTailor = ResumeTailorInputSchema.safeParse(invalidTailorInput);
  assert(!parsedInvalidTailor.success, 'ResumeTailorInputSchema rejects empty approvedKnowledge');

  // Valid output schema
  const validTailorOutput = {
    proposedChanges: [
      {
        section: 'summary',
        originalContent: 'Experienced Full-Stack Engineer...',
        proposedContent: 'Senior Full-Stack Engineer with proven record in distributed systems.',
        rationale: 'Directly aligns with Stripe billing requirements.',
        jobRequirement: 'Distributed Systems',
        sourceKnowledgeItemIds: ['kb-exp-1'],
        sourceEvidenceSnippet: 'Reduced p95 latency by 82%'
      }
    ]
  };
  const parsedTailorOutput = ResumeTailorOutputSchema.safeParse(validTailorOutput);
  assert(parsedTailorOutput.success, 'ResumeTailorOutputSchema accepts valid proposed changes');

  // Invalid output schema (invalid section)
  const invalidTailorOutput = {
    proposedChanges: [
      {
        ...validTailorOutput.proposedChanges[0],
        section: 'invalid_section'
      }
    ]
  };
  const parsedInvalidTailorOutput = ResumeTailorOutputSchema.safeParse(invalidTailorOutput);
  assert(!parsedInvalidTailorOutput.success, 'ResumeTailorOutputSchema rejects invalid section enum');

  // 1.2 COVER_LETTER valid input & output
  const validCoverLetterInput = {
    candidate: {
      name: 'Alex Chen',
      headline: 'Senior Full-Stack Engineer'
    },
    job: {
      id: 'job-1',
      title: 'Backend Engineer',
      company: 'Datadog'
    },
    approvedKnowledge: [
      {
        knowledgeItemId: 'kb-proj-1',
        category: 'project',
        title: 'OpenMetric Dashboard',
        supportingSnippet: 'Built real-time telemetry dashboard in React and Go'
      }
    ]
  };
  assert(CoverLetterInputSchema.safeParse(validCoverLetterInput).success, 'CoverLetterInputSchema accepts valid input');

  const validCoverLetterOutput = {
    recipient: 'Datadog Engineering Team',
    openingHook: 'I am excited to apply for the Backend Engineer position...',
    coreEvidenceParagraph: 'At Veloce Labs, I developed distributed metrics collectors...',
    alignmentParagraph: 'Datadog’s focus on observability aligns with my background...',
    closingCallToAction: 'I look forward to discussing how my experience fits your team.',
    body: 'Full cover letter text goes here...',
    sourceKnowledgeItemIds: ['kb-proj-1'],
    evidenceReferences: ['OpenMetric Dashboard']
  };
  assert(CoverLetterOutputSchema.safeParse(validCoverLetterOutput).success, 'CoverLetterOutputSchema accepts valid output');

  // 1.3 APPLICATION_QUESTION schemas & taxonomy
  const validCategories = [
    'behavioral',
    'technical',
    'motivation',
    'logistics',
    'compensation',
    'eligibility',
    'other'
  ];
  for (const cat of validCategories) {
    assert(
      ApplicationQuestionCategorySchema.safeParse(cat).success,
      `ApplicationQuestionCategorySchema validates category: '${cat}'`
    );
  }
  assert(
    !ApplicationQuestionCategorySchema.safeParse('unsupported_cat').success,
    'ApplicationQuestionCategorySchema rejects unknown category'
  );

  const validQuestionInput = {
    question: 'How do you handle high-throughput database writes?',
    category: 'technical',
    job: {
      id: 'job-1',
      title: 'Senior DB Engineer',
      company: 'Linear'
    },
    approvedKnowledge: [
      {
        knowledgeItemId: 'kb-skill-1',
        category: 'skill',
        title: 'PostgreSQL',
        supportingSnippet: 'Partitioning and connection pooling for 50k req/s'
      }
    ]
  };
  assert(
    ApplicationQuestionInputSchema.safeParse(validQuestionInput).success,
    'ApplicationQuestionInputSchema accepts valid input'
  );

  const validQuestionOutput = {
    question: 'How do you handle high-throughput database writes?',
    category: 'technical',
    proposedAnswer: 'I utilize read-replicas, connection pooling, and batch processing...',
    hasSufficientEvidence: true,
    reviewStatus: 'VERIFIED',
    sourceKnowledgeItemIds: ['kb-skill-1'],
    evidenceReferences: ['PostgreSQL knowledge item']
  };
  assert(
    ApplicationQuestionOutputSchema.safeParse(validQuestionOutput).success,
    'ApplicationQuestionOutputSchema accepts valid output'
  );

  // -------------------------------------------------------------------------
  // 2. TASK POLICIES
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Task Policies ---');

  const tailorPolicy = getTaskPolicy('RESUME_TAILOR');
  assert(tailorPolicy.tier === 'COMPLEX_REASONER', 'RESUME_TAILOR tier is COMPLEX_REASONER');
  assert(tailorPolicy.temperature === 0.1, 'RESUME_TAILOR temperature is 0.1 (deterministic)');
  assert(tailorPolicy.maxTokens === 3000, 'RESUME_TAILOR maxTokens is 3000');
  assert(tailorPolicy.getSystemPrompt().includes('STRICT GROUNDING INVARIANTS'), 'RESUME_TAILOR prompt includes grounding invariants');

  const letterPolicy = getTaskPolicy('COVER_LETTER');
  assert(letterPolicy.temperature === 0.2, 'COVER_LETTER temperature is 0.2');
  assert(letterPolicy.maxTokens === 2000, 'COVER_LETTER maxTokens is 2000');

  const questionPolicy = getTaskPolicy('APPLICATION_QUESTION');
  assert(questionPolicy.temperature === 0.1, 'APPLICATION_QUESTION temperature is 0.1');
  assert(questionPolicy.getSystemPrompt().includes('MISSING EVIDENCE RULE'), 'APPLICATION_QUESTION prompt includes missing evidence rule');

  // Verify environment-driven model (never hardcoded)
  const envModel = process.env.LLM_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  assert(tailorPolicy.preferredModel === envModel, 'Task policy resolves environment-driven model, not hardcoded');

  // -------------------------------------------------------------------------
  // 3. AI ORCHESTRATOR DISPATCH & SAFETY
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing AI Orchestrator Dispatch & Error Handling ---');

  // Setup a mock LLM for dispatch verification
  const testLLM: ILLMClient = {
    providerId: 'gemini',
    modelId: 'test-model',
    generateStructured: async <T>(params: { schema: { parse: (val: unknown) => T } }) => {
      // Return typed mock response based on schema
      const output = params.schema.parse(validTailorOutput);
      return {
        data: output,
        rawJson: JSON.stringify(output),
        metadata: {
          provider: 'gemini',
          model: 'test-model',
          extractionVersion: '1.0',
          latencyMs: 10,
          promptTokens: 120,
          completionTokens: 80,
          totalTokens: 200
        }
      };
    }
  };

  setLLMClientForTest(testLLM);

  // Dispatch RESUME_TAILOR
  const dispatchTailor = await aiOrchestrator.dispatch<typeof validTailorOutput>(
    'RESUME_TAILOR',
    validTailorInput,
    { candidateId: 'cand-test-1' }
  );
  assert(dispatchTailor.data.proposedChanges.length === 1, 'AIOrchestrator successfully dispatches RESUME_TAILOR');
  assert(dispatchTailor.metadata.taskType === 'RESUME_TAILOR', 'AIExecutionMetadata records RESUME_TAILOR taskType');

  // Test error handling: Rate limit error
  const rateLimitLLM: ILLMClient = {
    ...testLLM,
    generateStructured: async () => {
      throw new LLMRateLimitError('Quota exhausted');
    }
  };
  setLLMClientForTest(rateLimitLLM);

  try {
    await aiOrchestrator.dispatch('RESUME_TAILOR', validTailorInput);
    assert(false, 'AIOrchestrator should throw on rate limit');
  } catch (err) {
    assert(err instanceof AIOrchestrationError, 'AIOrchestrator throws AIOrchestrationError on rate limit');
    assert((err as AIOrchestrationError).code === 'AI_RATE_LIMIT', 'AIOrchestrator sets code AI_RATE_LIMIT');
  }

  // Test error handling: Timeout error
  const timeoutLLM: ILLMClient = {
    ...testLLM,
    generateStructured: async () => {
      throw new LLMTimeoutError('Request timed out after 35s');
    }
  };
  setLLMClientForTest(timeoutLLM);

  try {
    await aiOrchestrator.dispatch('RESUME_TAILOR', validTailorInput);
    assert(false, 'AIOrchestrator should throw on timeout');
  } catch (err) {
    assert(err instanceof AIOrchestrationError, 'AIOrchestrator throws AIOrchestrationError on timeout');
    assert((err as AIOrchestrationError).code === 'AI_TIMEOUT', 'AIOrchestrator sets code AI_TIMEOUT');
  }

  // Reset test LLM
  setLLMClientForTest(null);

  // -------------------------------------------------------------------------
  // 4. PRODUCTION MOCK PROTECTION
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Production Mock Protection ---');

  const originalEnv = process.env.NODE_ENV;
  try {
    // Simulate production environment
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    let testInjectionRejected = false;
    try {
      setLLMClientForTest(testLLM);
    } catch {
      testInjectionRejected = true;
    }
    assert(testInjectionRejected, 'setLLMClientForTest is strictly rejected in production');

    // Simulate provider = "mock"
    const originalProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'mock';

    let mockProviderRejected = false;
    try {
      getLLMClient();
    } catch {
      mockProviderRejected = true;
    }
    assert(mockProviderRejected, 'getLLMClient strictly rejects provider="mock" in production');

    process.env.LLM_PROVIDER = originalProvider;
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  }

  // -------------------------------------------------------------------------
  // 5. POSITIVE GROUNDING VALIDATOR
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing PositiveGroundingValidator ---');

  const candidateId = 'candidate-real-1';
  const otherCandidateId = 'candidate-adversary-2';

  const approvedKB: KnowledgeItem[] = [
    {
      id: 'kb-exp-veloce',
      candidateId,
      category: 'experience',
      status: 'approved',
      content: {
        employer: 'Veloce Labs',
        role: 'Senior Full-Stack Engineer',
        responsibilities: [
          'Architected distributed event streaming using Apache Kafka and Node.js',
          'Managed PostgreSQL query optimizations and index tuning'
        ],
        achievements: [
          'Reduced p95 latency by 82% across high-volume merchant billing APIs',
          'Processed over 120k daily active transactions with zero data loss'
        ]
      },
      provenance: [{ id: 'p-1', sourceType: 'resume_upload', sourceLabel: 'Resume_2026.pdf', addedAt: '2026-01-01' }],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    },
    {
      id: 'kb-skill-ts',
      candidateId,
      category: 'skill',
      status: 'approved',
      content: {
        name: 'TypeScript',
        category: 'technical',
        proficiency: 'expert'
      },
      provenance: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    },
    {
      id: 'kb-proj-dashboard',
      candidateId,
      category: 'project',
      status: 'approved',
      content: {
        name: 'OpenMetric Dashboard',
        description: 'Real-time infrastructure monitoring dashboard',
        technologies: ['React', 'TypeScript', 'PostgreSQL'],
        contributions: 'Implemented WebSockets and interactive charts',
        outcomes: 'Scaled to 50k users'
      },
      provenance: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    },
    {
      id: 'kb-unapproved-exp',
      candidateId,
      category: 'experience',
      status: 'proposed', // NOT APPROVED
      content: {
        employer: 'Unapproved Corp',
        role: 'Staff Architect'
      },
      provenance: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    },
    {
      id: 'kb-other-cand-exp',
      candidateId: otherCandidateId, // OTHER CANDIDATE
      category: 'experience',
      status: 'approved',
      content: {
        employer: 'Google Deepmind',
        role: 'Principal Researcher'
      },
      provenance: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    }
  ];

  // 5.1 Positive evidence matches: Approved statement with verified metric
  const validClaimResult = positiveGroundingValidator.validateClaim({
    proposedText: 'Spearheaded payment microservices at Veloce Labs, reducing p95 latency by 82% for critical APIs.',
    sourceKnowledgeItemIds: ['kb-exp-veloce'],
    candidateId,
    candidateApprovedKnowledge: approvedKB
  });
  assert(validClaimResult.isValid, 'Valid approved claim is valid');
  assert(validClaimResult.status === 'GROUNDED', 'Valid approved claim receives status GROUNDED');
  assert(validClaimResult.userFacingStatus === 'Grounded in your Knowledge Bank', 'User facing status is "Grounded in your Knowledge Bank"');
  assert(validClaimResult.traces.length === 1, 'Grounding trace is generated with candidate evidence');

  // 5.2 Fabricated metric: LLM claims 99% reduction instead of verified 82%
  const fakeMetricResult = positiveGroundingValidator.validateClaim({
    proposedText: 'Spearheaded payment microservices at Veloce Labs, reducing p95 latency by 99% for critical APIs.',
    sourceKnowledgeItemIds: ['kb-exp-veloce'],
    candidateId,
    candidateApprovedKnowledge: approvedKB
  });
  assert(fakeMetricResult.isValid, 'Fabricated metric does not crash validation');
  assert(fakeMetricResult.status === 'REQUIRES_REVIEW', 'Fabricated metric drops status to REQUIRES_REVIEW');
  assert(fakeMetricResult.userFacingStatus === 'Requires Candidate Review', 'User facing status is "Requires Candidate Review"');
  assert(fakeMetricResult.unsupportedClaims.metrics.includes('99%'), 'Unsupported metric is tracked explicitly in unsupportedClaims');

  // 5.3 Unapproved KnowledgeItem (status === 'proposed')
  const unapprovedResult = positiveGroundingValidator.validateClaim({
    proposedText: 'Worked at Unapproved Corp as Staff Architect.',
    sourceKnowledgeItemIds: ['kb-unapproved-exp'],
    candidateId,
    candidateApprovedKnowledge: approvedKB
  });
  assert(!unapprovedResult.isValid, 'Citing proposed/unapproved item is invalid');
  assert(unapprovedResult.status === 'REJECTED', 'Citing proposed item receives status REJECTED');

  // 5.4 Cross-candidate knowledge contamination
  const crossCandidateResult = positiveGroundingValidator.validateClaim({
    proposedText: 'Led principal research at Google Deepmind.',
    sourceKnowledgeItemIds: ['kb-other-cand-exp'],
    candidateId, // Attempting to cite other candidate's item
    candidateApprovedKnowledge: approvedKB
  });
  assert(!crossCandidateResult.isValid, 'Citing another candidate knowledge item is strictly invalid');
  assert(crossCandidateResult.status === 'REJECTED', 'Cross-candidate citation receives status REJECTED');
  assert(crossCandidateResult.reasons[0].includes('SECURITY VIOLATION'), 'Cross-candidate citation raises explicit security violation reason');

  // 5.5 Missing citations (No IDs provided)
  const noCitationResult = positiveGroundingValidator.validateClaim({
    proposedText: 'Architected distributed event streaming using Apache Kafka and Node.js.',
    sourceKnowledgeItemIds: [],
    candidateId,
    candidateApprovedKnowledge: approvedKB
  });
  assert(noCitationResult.status === 'REQUIRES_REVIEW', 'Claim without citations receives REQUIRES_REVIEW');
  assert(noCitationResult.userFacingStatus === 'Missing Evidence', 'Claim without citations receives "Missing Evidence" user facing status');

  // 5.6 Positive Evidence Principle: A requirement being missing does NOT blacklist text
  // Candidate has approved OpenMetric Dashboard in React/TypeScript.
  // Suppose the job has a missing requirement for "GraphQL".
  // The candidate writes about their real React project without claiming GraphQL.
  const positiveEvidenceResult = positiveGroundingValidator.validateClaim({
    proposedText: 'Developed real-time OpenMetric Dashboard frontend using React and TypeScript.',
    sourceKnowledgeItemIds: ['kb-proj-dashboard', 'kb-skill-ts'],
    candidateId,
    candidateApprovedKnowledge: approvedKB
  });
  assert(positiveEvidenceResult.status === 'GROUNDED', 'Positive evidence claim is GROUNDED without any keyword blacklisting interference');

  // 5.7 Batch resume changes validation helper
  const batchChanges = [
    {
      id: 'c-1',
      originalContent: 'Old bullet',
      proposedContent: 'Reduced p95 latency by 82% at Veloce Labs.',
      sourceKnowledgeItemIds: ['kb-exp-veloce'],
      section: 'experience'
    },
    {
      id: 'c-2',
      originalContent: 'Old bullet 2',
      proposedContent: 'Invented impossible quantum algorithm accelerating execution by 500x.',
      sourceKnowledgeItemIds: ['kb-exp-veloce'],
      section: 'experience'
    }
  ];
  const batchResults = positiveGroundingValidator.validateResumeChanges(batchChanges, candidateId, approvedKB);
  assert(batchResults.length === 2, 'Batch validator processes all changes');
  assert(batchResults[0].validation.status === 'GROUNDED', 'Batch change 1 is GROUNDED');
  assert(batchResults[1].validation.status === 'REQUIRES_REVIEW', 'Batch change 2 with ungrounded metric requires review');

  // -------------------------------------------------------------------------
  // FINAL SCORECARD
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🎯 PHASE 8A TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    throw new Error(`Phase 8A verification failed: ${totalTests - passedTests} tests failed.`);
  }
}

runPhase8AVerification().catch((err) => {
  console.error('Fatal error during Phase 8A verification:', err);
  process.exit(1);
});
