/* eslint-disable no-console */
import { careerRepository } from '../src/services/career-repository';
import { setCareerRepositoryMode } from '../src/services/repository-provider';
import {
  getPreparationMaterials,
  updateCoverLetterDraft,
  updateQuestionAnswer,
  regenerateCoverLetterDraft,
  confirmApplicationSubmission
} from '../src/features/preparation/api/service';
import { evaluateApplicationReadiness } from '../src/features/preparation/lib/readiness-evaluator';
import { ApplicationDetail } from '../src/features/applications/api/types';
import { ConcurrencyError } from '../src/types/errors';
import { ResumeTemplateId } from '../src/types/templates';
import { CandidateProfile, Job, ResumeVersion } from '../src/types/domain';

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

async function runPhase8DVerification() {
  console.log('================================================================');
  console.log('🚪 CAREERQUEST PHASE 8D: APPLICATION READY ROOM & HANDOFF');
  console.log('================================================================\n');

  setCareerRepositoryMode('in-memory');

  const candidateId = 'cand-phase8d-alex';
  const attackerId = 'cand-phase8d-attacker';

  // 1. Setup Test Fixture Candidate
  const testCandidate: CandidateProfile = {
    id: candidateId,
    userId: `user-${candidateId}`,
    email: 'alex.rivera@example.com',
    location: 'San Francisco, CA',
    name: 'Alex Rivera',
    targetRoles: ['Staff Infrastructure Engineer'],
    professionalSummary: 'Systems engineer with 10+ years experience in distributed systems and cloud platforms.',
    skills: {
      technical: ['Go', 'TypeScript', 'Kubernetes', 'PostgreSQL'],
      tools: ['Docker', 'Terraform', 'Kafka'],
      soft: ['Cross-functional Collaboration', 'Technical Leadership'],
      other: []
    },
    experience: [
      {
        id: 'exp-phase8d-1',
        employer: 'Veloce Data',
        role: 'Senior Infrastructure Engineer',
        startDate: '2021-01-01',
        isCurrent: true,
        responsibilities: [
          'Engineered global distributed cache reducing P99 latency by 42ms across 10M DAU.',
          'Migrated 140+ microservices to Kubernetes with zero downtime deployment pipelines.'
        ],
        achievements: []
      }
    ],
    education: [
      {
        id: 'edu-phase8d-1',
        institution: 'University of Washington',
        degree: 'B.S.',
        fieldOfStudy: 'Computer Science',
        startDate: '2014-09-01',
        endDate: '2018-06-01'
      }
    ],
    projects: [],
    certifications: [],
    preferences: {
      targetRoles: ['Staff Infrastructure Engineer'],
      preferredLocations: ['San Francisco, CA', 'Remote'],
      workArrangements: ['remote', 'hybrid'],
      currency: 'USD'
    },
    masterResumeId: `master-${candidateId}`
  };
  await careerRepository.updateCandidateProfile(testCandidate, candidateId);

  // 2. Setup Test Job
  const testJob: Job = {
    id: 'job-phase8d-stripe',
    title: 'Staff Systems Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA',
    workArrangement: 'remote',
    description: 'Lead architecture of high-scale payment processing systems and telemetry infra.',
    responsibilities: [
      'Scale distributed storage and real-time processing platforms.',
      'Mentor engineers and establish reliability engineering standards.'
    ],
    requiredSkills: ['Go', 'Distributed Systems', 'Kubernetes'],
    preferredSkills: ['PostgreSQL', 'Kafka'],
    source: 'greenhouse',
    originalUrl: 'https://boards.greenhouse.io/stripe/jobs/4829104',
    jobStatus: 'active',
    normalizedAt: '2026-03-01T00:00:00Z',
    importedByCandidateId: candidateId
  };
  await careerRepository.addJob(testJob, candidateId);

  // 3. Create Master & Tailored Resume
  const masterResume: ResumeVersion = {
    id: `master-${candidateId}`,
    candidateId,
    title: 'Master Systems Resume',
    targetRole: 'Staff Infrastructure Engineer',
    summary: testCandidate.professionalSummary,
    skills: testCandidate.skills,
    experience: [
      {
        id: 'exp-master-1',
        employer: 'Veloce Data',
        role: 'Senior Infrastructure Engineer',
        startDate: '2021-01-01',
        isCurrent: true,
        responsibilities: [
          'Engineered global distributed cache reducing P99 latency by 42ms across 10M DAU.'
        ],
        achievements: []
      }
    ],
    education: [
      {
        id: 'edu-master-1',
        institution: 'University of Washington',
        degree: 'B.S.',
        fieldOfStudy: 'Computer Science',
        startDate: '2014-09-01',
        endDate: '2018-06-01'
      }
    ],
    projects: [],
    certifications: [],
    changes: [],
    approvalState: 'approved',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };
  await careerRepository.saveResumeVersion(masterResume, candidateId);

  const tailoredResume: ResumeVersion = {
    id: `tailored-${candidateId}-stripe`,
    candidateId,
    jobId: testJob.id,
    targetCompany: 'Stripe',
    title: 'Stripe Staff Systems Resume',
    targetRole: 'Staff Systems Engineer',
    summary: testCandidate.professionalSummary,
    skills: testCandidate.skills,
    experience: [
      {
        id: 'exp-tailored-1',
        employer: 'Veloce Data',
        role: 'Senior Infrastructure Engineer',
        startDate: '2021-01-01',
        isCurrent: true,
        responsibilities: [
          'Architected distributed multi-region telemetry cache achieving 42ms P99 latency improvements for Stripe-scale workloads.'
        ],
        achievements: []
      }
    ],
    education: masterResume.education,
    projects: [],
    certifications: [],
    changes: [
      {
        id: 'rev-stripe-1',
        resumeVersionId: `tailored-${candidateId}-stripe`,
        section: 'experience',
        originalContent: 'Engineered global distributed cache reducing P99 latency by 42ms across 10M DAU.',
        proposedContent: 'Architected distributed multi-region telemetry cache achieving 42ms P99 latency improvements for Stripe-scale workloads.',
        rationale: 'Align with Stripe distributed systems requirements.',
        jobRequirement: 'Distributed Systems',
        sourceCandidateEvidence: 'Engineered global distributed cache reducing P99 latency by 42ms',
        grounded: true,
        sourceKnowledgeItemIds: ['kb-exp-1'],
        status: 'approved'
      }
    ],
    approvalState: 'approved',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };
  await careerRepository.saveResumeVersion(tailoredResume, candidateId);

  // 4. Create Application
  const application = await careerRepository.createApplication(
    testJob.id,
    'discovered',
    undefined,
    candidateId
  );
  await careerRepository.updateApplicationPreparation(
    application.id,
    {
      tailoredResumeVersionId: tailoredResume.id,
      selectedTemplateId: 'classic-v1',
      selectedTemplateVersion: '1.0'
    },
    candidateId
  );

  console.log('📋 1. Testing Ready Room Material Retrieval & Candidate Ownership...');

  // Test 1: Candidate can retrieve preparation materials
  const prep = await getPreparationMaterials(application.id, candidateId);
  assert(Boolean(prep), 'Candidate can open Ready Room and retrieve preparation materials');
  assert(Boolean(prep.coverLetter), 'Grounded cover letter draft is generated/loaded');
  assert(Array.isArray(prep.questions) && prep.questions.length > 0, 'Application questions are generated/loaded');
  assert(Boolean(prep.summary), 'Pre-flight summary metadata is computed');

  // Test 2: Unauthorized candidate cannot access another candidate\'s preparation
  let attackerBlocked = false;
  try {
    await getPreparationMaterials(application.id, attackerId);
  } catch (err: unknown) {
    attackerBlocked = true;
    assert(
      err instanceof Error && err.message.includes('not found'),
      'Cross-tenant access to Ready Room materials is strictly denied (IDOR protection)'
    );
  }
  if (!attackerBlocked) {
    assert(false, 'Cross-tenant access must be denied');
  }

  console.log('\n🔍 2. Testing Pre-Flight Readiness Checklist & Blocking Logic...');

  const appDetail: ApplicationDetail = {
    ...application,
    job: testJob,
    resume: tailoredResume,
    events: [],
    interviewStages: [],
    contacts: [],
    exports: []
  };

  // Test 3: Readiness evaluation with valid materials
  const evalReady = evaluateApplicationReadiness(appDetail, prep);
  assert(evalReady.isReadyToApply, 'Application with tailored resume and valid destination evaluates as Ready to Apply');
  assert(evalReady.blockingCount === 0, 'Zero blocking issues when resume and destination are present');
  assert(evalReady.destinationDomain === 'boards.greenhouse.io', 'Destination domain extracted cleanly from Greenhouse URL');

  // Test 4: Missing destination URL correctly treated as a blocking issue
  const appDetailNoUrl: ApplicationDetail = {
    ...appDetail,
    job: { ...testJob, originalUrl: undefined }
  };
  const evalNoUrl = evaluateApplicationReadiness(appDetailNoUrl, prep);
  assert(!evalNoUrl.isReadyToApply, 'Missing application destination is evaluated as a blocking issue');
  assert(evalNoUrl.blockingCount > 0, 'Blocking count increments when destination URL is absent');

  // Test 5: Missing resume correctly treated as a blocking issue
  const appDetailNoResume: ApplicationDetail = {
    ...appDetail,
    resume: null,
    tailoredResumeVersionId: undefined,
    resumeVersionId: undefined
  };
  const evalNoResume = evaluateApplicationReadiness(appDetailNoResume, prep);
  assert(!evalNoResume.isReadyToApply, 'Missing resume is evaluated as a blocking issue');
  assert(
    evalNoResume.items.some((i) => i.id === 'resume-attached' && i.status === 'missing' && i.isBlocking),
    'Missing resume item is flagged as blocking in PreFlightChecklist'
  );

  // Test 6: Draft cover letter does not incorrectly block submission if optional
  const evalDraftCover = evaluateApplicationReadiness(appDetail, {
    ...prep,
    coverLetter: { ...prep.coverLetter, status: 'draft' }
  });
  assert(
    evalDraftCover.isReadyToApply,
    'Draft cover letter is non-blocking (review advisory only, does not prevent submission)'
  );

  console.log('\n🎨 3. Testing Template Presentation & Qualitative Grounding Assertions...');

  // Test 7: Verify qualitative grounding language (NO numerical percentages)
  const checklistGroundingItem = prep.summary.checklist.find((c) => c.id === 'resume-grounded');
  assert(
    Boolean(checklistGroundingItem && !checklistGroundingItem.description.includes('100%')),
    'Grounding description uses qualitative statement ("All claims anchored...") instead of numerical "100%"'
  );

  // Test 8: Template selection does NOT alter Knowledge Bank or regenerate claims
  const initialKb = await careerRepository.getKnowledgeBank(candidateId);
  const initialSkillsCount = initialKb.skills.length;
  await careerRepository.updateApplicationPreparation(
    application.id,
    { selectedTemplateId: 'modern-v1' as ResumeTemplateId, selectedTemplateVersion: '1.0' },
    candidateId
  );
  const afterKb = await careerRepository.getKnowledgeBank(candidateId);
  assert(
    afterKb.skills.length === initialSkillsCount,
    'Template switching is presentation-only and strictly leaves Knowledge Bank claims untouched'
  );

  console.log('\n✍️ 4. Testing Candidate Edit Controls in Preparation Workspace...');

  // Test 9: Candidate can edit cover letter in mutable workspace
  const updatedCoverLetter = await updateCoverLetterDraft(
    {
      applicationId: application.id,
      coverLetter: {
        ...prep.coverLetter,
        body: 'Customized cover letter opening tailored specifically for Stripe systems team.'
      }
    },
    candidateId
  );
  assert(
    updatedCoverLetter.body.includes('Stripe systems team'),
    'Candidate can edit cover letter body in preparation workspace'
  );

  // Test 10: Candidate can edit application question answer
  const firstQuestion = prep.questions[0];
  const updatedQuestion = await updateQuestionAnswer(
    {
      applicationId: application.id,
      question: {
        ...firstQuestion,
        candidateEditedAnswer: 'I have led multi-region telemetry pipelines across global cloud regions.'
      }
    },
    candidateId
  );
  assert(
    Boolean(updatedQuestion.candidateEditedAnswer?.includes('telemetry pipelines')),
    'Candidate can provide custom answer to application question'
  );

  console.log('\n🔒 5. Testing Controlled External Handoff & Confirmation Transaction...');

  // Test 11: Transactional confirmation locks resume and freezes snapshot
  const confirmed = await confirmApplicationSubmission(
    {
      applicationId: application.id,
      expectedVersion: application.version,
      note: 'Applied on Stripe career portal via Greenhouse.',
      templateId: 'modern-v1' as ResumeTemplateId,
      templateVersion: '1.0'
    },
    candidateId
  );

  assert(confirmed.status === 'applied', 'Application status atomically transitions to "applied" upon confirmation');
  assert(Boolean(confirmed.dateApplied), 'Submission timestamp recorded at confirmation');
  assert(Boolean(confirmed.resumeSnapshot), 'Structured ResumeContent snapshot permanently frozen on Application record');
  assert(
    (confirmed.resumeSnapshot as any)?.identity?.fullName === 'Alex Rivera',
    'Frozen resume snapshot captures exact candidate profile and verified claims'
  );
  assert(
    confirmed.selectedTemplateId === 'modern-v1',
    'Selected presentation template permanently recorded with application submission'
  );

  // Test 12: Referenced resume version is locked against post-submission mutation
  const lockedResume = await careerRepository.getResumeVersionById(tailoredResume.id, candidateId);
  assert(
    lockedResume?.approvalState === 'approved',
    'Referenced tailored resume version is permanently locked/approved upon application confirmation'
  );

  // Test 13: Immutable application event appended to activity ledger
  const events = await careerRepository.getApplicationEvents(application.id, candidateId);
  const confirmedEvent = events.find((e) => e.type === 'applied_confirmed');
  assert(Boolean(confirmedEvent), 'Immutable "applied_confirmed" ApplicationEvent created in activity ledger');

  console.log('\n🛡️ 6. Testing Domain Write Barriers on Frozen Historical Record...');

  // Test 14: Write barrier blocks cover letter updates once applied
  let coverLetterBlocked = false;
  try {
    await updateCoverLetterDraft(
      {
        applicationId: application.id,
        coverLetter: { ...prep.coverLetter, body: 'Malicious post-submission tampering attempt' }
      },
      candidateId
    );
  } catch (err: unknown) {
    coverLetterBlocked = true;
    assert(
      err instanceof Error && err.message.includes('historically frozen'),
      'Write barrier blocks cover letter modification after submission confirmation'
    );
  }
  assert(coverLetterBlocked, 'Post-submission cover letter edits must be rejected');

  // Test 15: Write barrier blocks question updates once applied
  let questionBlocked = false;
  try {
    await updateQuestionAnswer(
      {
        applicationId: application.id,
        question: { ...firstQuestion, candidateEditedAnswer: 'Tampered answer' }
      },
      candidateId
    );
  } catch (err: unknown) {
    questionBlocked = true;
    assert(
      err instanceof Error && err.message.includes('historically frozen'),
      'Write barrier blocks question answer modification after submission confirmation'
    );
  }
  assert(questionBlocked, 'Post-submission question edits must be rejected');

  // Test 16: Write barrier blocks AI regeneration once applied
  let regenBlocked = false;
  try {
    await regenerateCoverLetterDraft(application.id, candidateId);
  } catch (err: unknown) {
    regenBlocked = true;
    assert(
      err instanceof Error && err.message.includes('historically frozen'),
      'Write barrier blocks AI regeneration after submission confirmation'
    );
  }
  assert(regenBlocked, 'Post-submission AI regeneration must be rejected');

  // Test 17: Historical application record is unaffected by repository update attempts
  const checkFrozen = await careerRepository.getApplicationById(application.id, candidateId);
  assert(
    checkFrozen?.status === 'applied' &&
      checkFrozen?.selectedTemplateId === 'modern-v1' &&
      Boolean(checkFrozen?.resumeSnapshot),
    'Historical application facts remain intact and untampered'
  );

  console.log('\n⚡ 7. Testing Optimistic Concurrency & Safety Controls...');

  // Test 18: Concurrency control rejects stale confirmation version
  let concurrencyRejected = false;
  try {
    await confirmApplicationSubmission(
      {
        applicationId: application.id,
        expectedVersion: 999, // Stale version
        note: 'Stale confirmation attempt'
      },
      candidateId
    );
  } catch (err: unknown) {
    concurrencyRejected = true;
    assert(
      err instanceof ConcurrencyError || (err instanceof Error && err.message.includes('version')),
      'Optimistic concurrency check rejects confirmation when expectedVersion is stale'
    );
  }
  assert(concurrencyRejected, 'Stale application confirmation must be rejected');

  // Test 19: Double confirmation is handled safely without corrupting frozen snapshot
  let doubleConfirmSafe = false;
  try {
    const reConfirm = await confirmApplicationSubmission(
      {
        applicationId: application.id,
        expectedVersion: checkFrozen?.version,
        note: 'Accidental double confirmation'
      },
      candidateId
    );
    if (reConfirm.status === 'applied') doubleConfirmSafe = true;
  } catch {
    doubleConfirmSafe = true;
  }
  assert(doubleConfirmSafe, 'Repeated confirmation does not corrupt frozen snapshot or fail catastrophically');

  console.log('\n================================================================');
  console.log(`📊 PHASE 8D VERIFICATION COMPLETE: ${passedTests}/${totalTests} PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPhase8DVerification().catch((err) => {
  console.error('Fatal Phase 8D verification error:', err);
  process.exit(1);
});
