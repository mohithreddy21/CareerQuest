/* eslint-disable no-console */
import { ResumeTailoringService } from '../src/features/tailoring/services/resume-tailoring-service';
import { LLMResumeTailorProvider } from '../src/features/tailoring/services/providers/llm-resume-tailor-provider';
import {
  getResumeTailorProvider,
  setResumeTailorProviderForTest,
  ProductionTailorConfigurationError
} from '../src/features/tailoring/services/providers/resume-tailor-provider.factory';
import { positiveGroundingValidator } from '../src/features/tailoring/services/grounding-validator';
import { resumeReviewService } from '../src/features/tailoring/services/resume-review-service';
import { knowledgeRetrievalService } from '../src/features/tailoring/services/knowledge-retrieval-service';
import { careerRepository } from '../src/services/career-repository';
import { aiOrchestrator, AIOrchestrationError } from '../src/lib/ai/ai-orchestrator';
import { setLLMClientForTest } from '../src/lib/llm/llm-factory';
import { ILLMClient, LLMRateLimitError, LLMTimeoutError } from '../src/lib/llm/llm-client.interface';
import { Job, JobAnalysis, ResumeVersion } from '../src/types/domain';
import { RetrievedCandidateKnowledge, ResumeChange } from '../src/types/tailoring';
import { KnowledgeItem } from '../src/types/knowledge';
import { setCareerRepositoryMode } from '../src/services/repository-provider';

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

async function runPhase8BVerification() {
  console.log('================================================================');
  console.log('🔍 CAREERQUEST PHASE 8B: REAL GROUNDED RESUME TAILORING VERIFICATION');
  console.log('================================================================\n');

  setCareerRepositoryMode('in-memory');

  const testCandidateId = 'cand-phase8b-user';
  const otherCandidateId = 'cand-phase8b-attacker';

  // -------------------------------------------------------------------------
  // 1. SETUP BASE CANDIDATE PROFILE & KNOWLEDGE BANK
  // -------------------------------------------------------------------------
  console.log('--- 1. Setting up Candidate Profile & Knowledge Bank ---');

  // Candidate Approved Knowledge Items
  const kbPython: KnowledgeItem = {
    id: 'kb-phase8b-python',
    candidateId: testCandidateId,
    category: 'skill',
    status: 'approved',
    provenance: [
      {
        id: 'prov-py',
        sourceType: 'resume_upload',
        sourceLabel: 'Resume.pdf',
        addedAt: '2026-03-01T00:00:00Z'
      }
    ],
    content: {
      name: 'Python',
      category: 'technical',
      proficiency: 'expert'
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  };

  const kbPostgres: KnowledgeItem = {
    id: 'kb-phase8b-postgres',
    candidateId: testCandidateId,
    category: 'skill',
    status: 'approved',
    provenance: [
      {
        id: 'prov-pg',
        sourceType: 'resume_upload',
        sourceLabel: 'Resume.pdf',
        addedAt: '2026-03-01T00:00:00Z'
      }
    ],
    content: {
      name: 'PostgreSQL',
      category: 'technical',
      proficiency: 'advanced'
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  };

  const kbOpenMetric: KnowledgeItem = {
    id: 'kb-phase8b-openmetric',
    candidateId: testCandidateId,
    category: 'project',
    status: 'approved',
    provenance: [
      {
        id: 'prov-proj',
        sourceType: 'resume_upload',
        sourceLabel: 'Resume.pdf',
        addedAt: '2026-03-01T00:00:00Z'
      }
    ],
    content: {
      name: 'OpenMetric Dashboard',
      description: 'Built a real-time observability dashboard using Python and PostgreSQL.',
      technologies: ['Python', 'PostgreSQL'],
      contributions: 'Engineered metrics aggregation engine.'
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  };

  const kbVeloceExp: KnowledgeItem = {
    id: 'kb-phase8b-veloce',
    candidateId: testCandidateId,
    category: 'experience',
    status: 'approved',
    provenance: [
      {
        id: 'prov-exp',
        sourceType: 'resume_upload',
        sourceLabel: 'Resume.pdf',
        addedAt: '2026-03-01T00:00:00Z'
      }
    ],
    content: {
      employer: 'Veloce Labs',
      role: 'Senior Software Engineer',
      startDate: '2024-01-01',
      endDate: '2025-12-31',
      isCurrent: false,
      responsibilities: ['Developed backend microservices in Python.'],
      achievements: ['Improved processing speed by 20%.']
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  };

  // Other candidate's knowledge (for cross-candidate attack testing)
  const kbAttackerItem: KnowledgeItem = {
    id: 'kb-phase8b-attacker-item',
    candidateId: otherCandidateId,
    category: 'skill',
    status: 'approved',
    provenance: [
      {
        id: 'prov-atk',
        sourceType: 'resume_upload',
        sourceLabel: 'OtherResume.pdf',
        addedAt: '2026-03-01T00:00:00Z'
      }
    ],
    content: {
      name: 'Secret Skill',
      category: 'technical'
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  };

  // Proposed/Unapproved knowledge (should be rejected/excluded)
  const kbProposedItem: KnowledgeItem = {
    id: 'kb-phase8b-proposed-item',
    candidateId: testCandidateId,
    category: 'skill',
    status: 'proposed',
    provenance: [
      {
        id: 'prov-prop',
        sourceType: 'external_import',
        sourceLabel: 'Job',
        addedAt: '2026-03-01T00:00:00Z'
      }
    ],
    content: {
      name: 'Unapproved AI claim',
      category: 'technical'
    },
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z'
  };

  await careerRepository.saveKnowledgeItem(kbPython, testCandidateId);
  await careerRepository.saveKnowledgeItem(kbPostgres, testCandidateId);
  await careerRepository.saveKnowledgeItem(kbOpenMetric, testCandidateId);
  await careerRepository.saveKnowledgeItem(kbVeloceExp, testCandidateId);
  await careerRepository.saveKnowledgeItem(kbAttackerItem, otherCandidateId);
  await careerRepository.saveKnowledgeItem(kbProposedItem, testCandidateId);

  const bank = await careerRepository.getKnowledgeBank(testCandidateId);
  assert(
    bank.skills.length >= 2 && bank.projects.length >= 1,
    'Knowledge Bank initialized with candidate approved items'
  );

  // Setup Master Resume
  const initialMasterSummary = 'Full-Stack Developer with Python and PostgreSQL experience.';
  const masterResume: ResumeVersion = {
    id: `res-master-${testCandidateId}`,
    candidateId: testCandidateId,
    title: 'Master Resume',
    targetRole: 'Senior Backend Engineer',
    summary: initialMasterSummary,
    experience: [
      {
        id: 'exp-veloce-1',
        employer: 'Veloce Labs',
        role: 'Senior Software Engineer',
        startDate: '2024-01-01',
        endDate: '2025-12-31',
        isCurrent: false,
        responsibilities: ['Developed backend microservices.'],
        achievements: ['Improved processing speed by 20%.']
      }
    ],
    education: [],
    skills: {
      technical: ['Python', 'PostgreSQL'],
      tools: ['Git', 'Docker'],
      soft: ['Collaboration'],
      other: []
    },
    projects: [
      {
        id: 'proj-openmetric-1',
        name: 'OpenMetric Dashboard',
        description: 'Monitoring dashboard for distributed systems.',
        technologies: ['Python', 'PostgreSQL'],
        contributions: 'Engineered metrics aggregation engine.'
      }
    ],
    certifications: [],
    changes: [],
    approvalState: 'approved',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };
  await careerRepository.saveResumeVersion(masterResume, testCandidateId);

  // Target Job
  const targetJob: Job = {
    id: 'job-phase8b-datadog',
    title: 'Senior Systems Engineer',
    company: 'Datadog',
    location: 'Remote',
    workArrangement: 'remote',
    description:
      'We are looking for an engineer experienced with Python and PostgreSQL to build monitoring infrastructure.',
    responsibilities: ['Architect scalable metrics ingestion systems.'],
    requiredSkills: ['Python', 'PostgreSQL', 'Kubernetes'],
    preferredSkills: ['Distributed Systems'],
    jobStatus: 'active',
    normalizedAt: '2026-03-01T00:00:00Z',
    source: 'manual'
  };
  const createdJob = await careerRepository.addJob(targetJob, testCandidateId);
  const activeJob: Job = { ...targetJob, id: createdJob.id };

  const targetAnalysis: JobAnalysis = {
    id: `analysis-${activeJob.id}`,
    jobId: activeJob.id,
    seniority: 'senior',
    roleCategory: 'backend',
    technicalRequirements: ['Python', 'PostgreSQL', 'Kubernetes'],
    softSkills: ['Distributed Systems'],
    importantKeywords: ['monitoring', 'metrics'],
    extractedRequirements: [
      { id: 'req-py', text: 'Python backend development', category: 'required', priority: 'high' },
      { id: 'req-pg', text: 'PostgreSQL database expertise', category: 'required', priority: 'high' },
      { id: 'req-k8s', text: 'Kubernetes orchestration', category: 'required', priority: 'medium' }
    ],
    analysisStatus: 'success'
  };
  await careerRepository.saveJobAnalysis(targetAnalysis);

  // -------------------------------------------------------------------------
  // 2. KNOWLEDGE RETRIEVAL & FILTERING
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Task-Aware Knowledge Retrieval ---');

  const retrievedKnowledge = await knowledgeRetrievalService.retrieveKnowledgeForJob(
    activeJob.id,
    testCandidateId
  );

  assert(
    retrievedKnowledge.items.length > 0,
    'Retrieval returns relevant items for target job'
  );
  assert(
    retrievedKnowledge.items.every((item) => item.candidateId === testCandidateId),
    'Candidate isolation: All retrieved items belong to authenticated candidate'
  );
  const containsUnapproved = retrievedKnowledge.items.some(
    (item) => item.knowledgeItemId === kbProposedItem.id
  );
  assert(!containsUnapproved, 'Proposed/unapproved items are strictly excluded from retrieval');
  const containsCrossCandidate = retrievedKnowledge.items.some(
    (item) => item.candidateId === otherCandidateId
  );
  assert(!containsCrossCandidate, 'Cross-candidate items are strictly excluded from retrieval');

  // -------------------------------------------------------------------------
  // 3. GROUNDING VALIDATOR SUITE (REALISTIC CASES 1-9)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing Section 20 Realistic Cases with PositiveGroundingValidator ---');

  const candidateApprovedItems = [kbPython, kbPostgres, kbOpenMetric, kbVeloceExp];

  // Case 1 — Valid: Supported technology & project
  const case1 = positiveGroundingValidator.validateClaim({
    proposedText: 'Built an OpenMetric monitoring dashboard using Python and PostgreSQL.',
    originalText: masterResume.projects[0].description,
    sourceKnowledgeItemIds: [kbPython.id, kbPostgres.id, kbOpenMetric.id],
    candidateId: testCandidateId,
    candidateApprovedKnowledge: candidateApprovedItems,
    contextLabel: 'Projects Section'
  });
  assert(case1.isValid && case1.status === 'GROUNDED', 'Case 1 [Valid]: Correctly marked GROUNDED/VERIFIED');

  // Case 2 — Unsupported technology (Kubernetes claimed)
  const case2 = positiveGroundingValidator.validateClaim({
    proposedText: 'Built services using Kubernetes in production.',
    originalText: masterResume.experience[0].responsibilities[0],
    sourceKnowledgeItemIds: [kbPython.id],
    candidateId: testCandidateId,
    candidateApprovedKnowledge: candidateApprovedItems,
    contextLabel: 'Experience Section'
  });
  assert(
    case2.status === 'REQUIRES_REVIEW' || case2.status === 'REJECTED',
    'Case 2 [Unsupported Technology]: Correctly flagged REQUIRES_REVIEW/REJECTED'
  );

  // Case 3 — Unsupported metric (Claiming 80% when verified is 20%)
  const case3 = positiveGroundingValidator.validateClaim({
    proposedText: 'Improved processing speed by 80% across backend services.',
    originalText: 'Improved processing speed by 20%.',
    sourceKnowledgeItemIds: [kbVeloceExp.id],
    candidateId: testCandidateId,
    candidateApprovedKnowledge: candidateApprovedItems,
    contextLabel: 'Experience Section'
  });
  assert(
    case3.status === 'REQUIRES_REVIEW' || case3.status === 'REJECTED',
    'Case 3 [Unsupported Metric]: Inflated metric (80% vs 20%) flagged REQUIRES_REVIEW/REJECTED'
  );

  // Case 4 — Unsupported leadership (Claiming team of 6 engineers)
  const case4 = positiveGroundingValidator.validateClaim({
    proposedText: 'Led a team of 6 engineers developing backend services.',
    originalText: 'Developed backend microservices.',
    sourceKnowledgeItemIds: [kbVeloceExp.id],
    candidateId: testCandidateId,
    candidateApprovedKnowledge: candidateApprovedItems,
    contextLabel: 'Experience Section'
  });
  assert(
    case4.status === 'REQUIRES_REVIEW' || case4.status === 'REJECTED',
    'Case 4 [Unsupported Leadership]: Fabricated team lead claim flagged REQUIRES_REVIEW/REJECTED'
  );

  // Case 5 — Unsupported employer (Claiming Microsoft when worked at Veloce)
  const case5 = positiveGroundingValidator.validateClaim({
    proposedText: 'At Microsoft, developed distributed backend services in Python.',
    originalText: 'Developed backend microservices.',
    sourceKnowledgeItemIds: [kbVeloceExp.id],
    candidateId: testCandidateId,
    candidateApprovedKnowledge: candidateApprovedItems,
    contextLabel: 'Experience Section'
  });
  assert(case5.status === 'REJECTED', 'Case 5 [Unsupported Employer]: Fabricated employer REJECTED');

  // Case 6 — Unsupported date (Claiming 2022–2025 when verified is 2024–2025)
  const case6 = positiveGroundingValidator.validateClaim({
    proposedText: 'Senior Software Engineer (2022–2025) developing backend services.',
    originalText: 'Senior Software Engineer (2024–2025)',
    sourceKnowledgeItemIds: [kbVeloceExp.id],
    candidateId: testCandidateId,
    candidateApprovedKnowledge: candidateApprovedItems,
    contextLabel: 'Experience Section'
  });
  assert(
    case6.status === 'REQUIRES_REVIEW' || case6.status === 'REJECTED',
    'Case 6 [Unsupported Date]: Modified tenure date flagged REQUIRES_REVIEW/REJECTED'
  );

  // Case 7 — Missing requirement non-blacklisting:
  // "Kubernetes" is a missing requirement, but mentioning it in a contextual statement
  // without claiming personal experience must NOT be rejected by a brittle keyword scan.
  const case7 = positiveGroundingValidator.validateClaim({
    proposedText: 'Collaborated with team on architectures designed for Kubernetes compatibility using Python.',
    originalText: 'Developed backend microservices in Python.',
    sourceKnowledgeItemIds: [kbPython.id],
    candidateId: testCandidateId,
    candidateApprovedKnowledge: candidateApprovedItems,
    contextLabel: 'Experience Section'
  });
  // Since the user is not claiming "experienced with Kubernetes" as personal skill, validator must not trigger keyword blacklist
  assert(
    case7.status !== 'REJECTED',
    'Case 7 [Missing Requirement Non-Blacklist]: No brittle keyword blacklist triggers rejection'
  );

  // Case 8 — Cross-candidate attack: Candidate citing Candidate B knowledge item
  const case8 = positiveGroundingValidator.validateClaim({
    proposedText: 'Experienced with proprietary architecture.',
    originalText: '',
    sourceKnowledgeItemIds: [kbAttackerItem.id],
    candidateId: testCandidateId,
    candidateApprovedKnowledge: [kbAttackerItem], // Contains item belonging to other candidate
    contextLabel: 'Skills Section'
  });
  assert(
    case8.status === 'REJECTED' && !case8.isValid,
    'Case 8 [Cross-Candidate Attack]: Foreign candidate KnowledgeItem rejected with SECURITY VIOLATION'
  );

  // -------------------------------------------------------------------------
  // 4. PRODUCTION AI PROVIDER & ORCHESTRATION PIPELINE
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing LLMResumeTailorProvider & AI Orchestration ---');

  // Test 4.1: Mock LLM client simulating real structured AI generation
  const mockLLMClient: ILLMClient = {
    providerId: 'gemini',
    modelId: 'gemini-2.5-flash',
    async generateStructured<T>(params: { userPrompt: string }) {
      // Case 9 defense test: Verify untrusted job context prompt delimiters
      assert(
        params.userPrompt.includes('=== UNTRUSTED_JOB_CONTEXT_START') &&
          params.userPrompt.includes('=== UNTRUSTED_JOB_CONTEXT_END'),
        'Prompt Injection Defense: AIOrchestrator wraps untrusted job data in delimiters'
      );

      const outputData = {
        proposedChanges: [
          {
            section: 'summary',
            originalContent: initialMasterSummary,
            proposedContent:
              'Senior Systems Engineer with expertise architecting real-time monitoring infrastructure in Python and PostgreSQL.',
            rationale: 'Highlights Python and PostgreSQL for Datadog systems engineering role.',
            jobRequirement: 'Python backend development and PostgreSQL database expertise',
            sourceKnowledgeItemIds: [kbPython.id, kbPostgres.id],
            sourceEvidenceSnippet: '5+ years professional experience building backend APIs and services in Python.'
          },
          {
            section: 'experience',
            sectionItemId: 'exp-veloce-1',
            originalContent: 'Developed backend microservices.',
            proposedContent:
              'Engineered scalable metrics ingestion pipelines in Python, maintaining low latency and high availability.',
            rationale: 'Directly addresses Datadog metrics ingestion priority.',
            jobRequirement: 'Architect scalable metrics ingestion systems',
            sourceKnowledgeItemIds: [kbPython.id, kbVeloceExp.id],
            sourceEvidenceSnippet: 'Developed backend microservices in Python. Improved processing speed by 20%.'
          }
        ]
      } as T;

      return {
        data: outputData,
        rawJson: JSON.stringify(outputData),
        metadata: {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          extractionVersion: '1.0',
          latencyMs: 145,
          promptTokens: 420,
          completionTokens: 180,
          totalTokens: 600
        }
      };
    }
  };

  setLLMClientForTest(mockLLMClient);

  const realLLMProvider = new LLMResumeTailorProvider();
  const tailorService = new ResumeTailoringService(realLLMProvider);

  const generatedChanges = await tailorService.generateGroundedChanges(
    activeJob,
    targetAnalysis,
    masterResume,
    retrievedKnowledge
  );

  assert(generatedChanges.length === 2, 'LLMResumeTailorProvider produced 2 structured proposed changes');
  assert(
    generatedChanges.every((c) => c.grounded === true),
    'Both generated proposals independently verified as grounded: true'
  );
  assert(
    generatedChanges.every((c) => c.status === 'pending'),
    'All AI-generated proposals initially remain pending candidate review'
  );

  // -------------------------------------------------------------------------
  // 5. PRODUCTION SAFETY & NO SILENT MOCK FALLBACK
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Production Factory Invariants & Error Handling ---');

  // Test 5.1: In production mode, requesting 'mock' throws error
  const origNodeEnv = process.env.NODE_ENV;
  const origTailorProvider = process.env.RESUME_TAILOR_PROVIDER;
  const origGeminiKey = process.env.GEMINI_API_KEY;

  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.RESUME_TAILOR_PROVIDER = 'mock';
    setResumeTailorProviderForTest(null);

    let threwProductionMockError = false;
    try {
      getResumeTailorProvider();
    } catch (err) {
      if (err instanceof ProductionTailorConfigurationError) {
        threwProductionMockError = true;
      }
    }
    assert(
      threwProductionMockError,
      'Production Invariant: MockResumeTailorProvider strictly forbidden in production'
    );

    // Test 5.2: In production with no API key, throws error
    delete process.env.RESUME_TAILOR_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    let threwMissingKeyError = false;
    try {
      getResumeTailorProvider();
    } catch (err) {
      if (err instanceof ProductionTailorConfigurationError) {
        threwMissingKeyError = true;
      }
    }
    assert(
      threwMissingKeyError,
      'Production Invariant: Missing API key in production throws clean configuration error'
    );
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    if (origTailorProvider) process.env.RESUME_TAILOR_PROVIDER = origTailorProvider;
    if (origGeminiKey) process.env.GEMINI_API_KEY = origGeminiKey;
    setResumeTailorProviderForTest(realLLMProvider);
  }

  // Test 5.3: Operational error handling (429 Rate Limit)
  const rateLimitClient: ILLMClient = {
    providerId: 'gemini',
    modelId: 'gemini-2.5-flash',
    async generateStructured() {
      throw new LLMRateLimitError('Quota exceeded (429)');
    }
  };
  setLLMClientForTest(rateLimitClient);

  let caughtRateLimit = false;
  try {
    await realLLMProvider.generateProposedChanges(
      activeJob,
      targetAnalysis,
      masterResume,
      retrievedKnowledge
    );
  } catch (err) {
    if (err instanceof AIOrchestrationError && err.code === 'AI_RATE_LIMIT') {
      caughtRateLimit = true;
    }
  }
  assert(caughtRateLimit, 'AI Failure Handling: 429 Rate Limit returns clean operational error');

  // Test 5.4: Operational error handling (Timeout)
  const timeoutClient: ILLMClient = {
    providerId: 'gemini',
    modelId: 'gemini-2.5-flash',
    async generateStructured() {
      throw new LLMTimeoutError('Request timeout after 30000ms');
    }
  };
  setLLMClientForTest(timeoutClient);

  let caughtTimeout = false;
  try {
    await realLLMProvider.generateProposedChanges(
      activeJob,
      targetAnalysis,
      masterResume,
      retrievedKnowledge
    );
  } catch (err) {
    if (err instanceof AIOrchestrationError && err.code === 'AI_TIMEOUT') {
      caughtTimeout = true;
    }
  }
  assert(caughtTimeout, 'AI Failure Handling: Timeout returns clean operational error without mock fallback');

  // Reset test client
  setLLMClientForTest(mockLLMClient);
  setResumeTailorProviderForTest(realLLMProvider);

  // -------------------------------------------------------------------------
  // 6. RESUME REVIEW LIFECYCLE & MASTER RESUME IMMUTABILITY
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Testing Tailored Resume Lifecycle & Master Resume Immutability ---');

  // 6.1 Create or load tailored resume
  const tailoredResume = await resumeReviewService.getOrCreateTailoredResume(
    activeJob.id,
    testCandidateId
  );

  assert(tailoredResume.changes.length > 0, 'Tailored resume created with proposed changes');
  assert(tailoredResume.approvalState === 'draft', 'Initial tailored resume is in draft state');

  // Verify Master Resume remains untouched
  const masterBeforeReview = await careerRepository.getMasterResume(testCandidateId);
  assert(
    masterBeforeReview !== null && masterBeforeReview.summary === initialMasterSummary,
    'Master Resume Protection: Master Resume summary untouched after tailoring generation'
  );

  // 6.2 Test "Approve All Pending" with mixed grounded and ungrounded changes
  // Inject an ungrounded change requiring review into the resume
  const ungroundedChange: ResumeChange = {
    id: `change-${activeJob.id}-exp-unsupported-leadership`,
    candidateId: testCandidateId,
    jobId: activeJob.id,
    resumeVersionId: tailoredResume.id,
    section: 'experience',
    originalContent: 'Developed backend microservices.',
    proposedContent: 'Led team of 15 engineers in building systems.',
    rationale: 'Demonstrates senior leadership.',
    jobRequirement: 'Leadership',
    sourceCandidateEvidence: 'Unverified claim',
    sourceKnowledgeItemIds: [kbVeloceExp.id],
    status: 'pending',
    grounded: false // REQUIRES REVIEW
  };
  tailoredResume.changes.push(ungroundedChange);
  await careerRepository.saveResumeVersion(tailoredResume, testCandidateId);

  // Call approveAllPendingChanges
  const approvedVersion = await resumeReviewService.approveAllPendingChanges(
    tailoredResume.id,
    testCandidateId
  );

  // The grounded changes should be approved, but ungrounded MUST remain pending!
  const remainingPending = approvedVersion.changes.filter((c) => c.status === 'pending');
  assert(
    remainingPending.length === 1 && remainingPending[0].id === ungroundedChange.id,
    'Approve All Safety: Ungrounded change (grounded === false) CANNOT bypass review and remains pending'
  );

  // 6.3 Test Candidate Rejection of ungrounded change
  const rejectedVersion = await resumeReviewService.updateChangeStatus(
    tailoredResume.id,
    ungroundedChange.id,
    'rejected',
    testCandidateId
  );
  const rejectedChange = rejectedVersion.changes.find((c) => c.id === ungroundedChange.id);
  assert(rejectedChange?.status === 'rejected', 'Candidate decision: Rejection updates status to rejected');

  // 6.4 Test Candidate Edit & Provenance Re-validation
  // Candidate provides an edit grounded in their Knowledge Bank (mentions Python & PostgreSQL)
  const editedVersion = await resumeReviewService.editChangeContent(
    tailoredResume.id,
    rejectedChange!.id,
    'Collaborated with senior engineers on Python and PostgreSQL microservices.',
    testCandidateId
  );
  const editedChange = editedVersion.changes.find((c) => c.id === ungroundedChange.id);
  assert(editedChange?.status === 'edited', 'Candidate edit: Status marked as edited');
  assert(editedChange?.grounded === true, 'Candidate edit: Independently grounded edit receives grounded: true');

  // Verify Master Resume remains untouched after approvals and edits
  const masterAfterAll = await careerRepository.getMasterResume(testCandidateId);
  assert(
    masterAfterAll !== null && masterAfterAll.summary === initialMasterSummary,
    'Master Resume Protection: Master Resume remains 100% UNTOUCHED after approvals and edits'
  );

  // Cleanup test client override
  setLLMClientForTest(null);
  setResumeTailorProviderForTest(null);

  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`Phase 8B Verification Complete: ${passedTests}/${totalTests} tests passed`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 8B TAILORING & GROUNDING TESTS PASSED!');
    process.exit(0);
  } else {
    console.error(`💥 ${totalTests - passedTests} tests failed.`);
    process.exit(1);
  }
}

void runPhase8BVerification();
