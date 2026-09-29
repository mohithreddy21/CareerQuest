/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_RANKING_CONFIG,
  calculateOpportunityPriority,
  RankedOpportunity,
  DiscoveryRankingParams
} from '../src/features/jobs/lib/ranking';
import { getCareerRepository, setCareerRepositoryMode } from '../src/services/repository-provider';
import { InMemoryCareerRepository } from '../src/services/in-memory-career-repository';
import { opportunityPriorityService } from '../src/features/jobs/services/opportunity-priority-service';
import { Job, JobMatch, JobSourceReference } from '../src/types/domain';

const prisma = new PrismaClient();

interface Checkpoint {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const checkpoints: Checkpoint[] = [];

function record(num: number, name: string, passed: boolean, details?: string) {
  checkpoints.push({ num, name, passed, details });
  const numStr = String(num).padStart(2, '0');
  const status = passed ? `PASS ${numStr}` : `FAIL ${numStr}`;
  console.log(`${status}: ${name}${details ? ` -> ${details}` : ''}`);
}

async function run() {
  console.log('====================================================');
  console.log('  CareerQuest Phase 7F: Discovery Experience');
  console.log('  Verification Suite');
  console.log('====================================================\n');

  setCareerRepositoryMode('prisma');
  const repo = getCareerRepository();
  const inMemoryRepo = new InMemoryCareerRepository();

  const CAND_A = 'cand-phase7f-a';
  const CAND_B = 'cand-phase7f-b';

  // ---------------------------------------------------------------------------
  // 0. SETUP & CLEANUP
  // ---------------------------------------------------------------------------
  console.log('--- 0. SETUP & CLEANUP ---');
  await prisma.candidateJobState.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.jobMatch.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.application.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.candidatePreferences.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.jobSourceReference.deleteMany({
    where: {
      sourceUrl: {
        in: [
          'https://test-stripe.example.com/job/1',
          'https://test-datadog.example.com/job/2',
          'https://test-linear.example.com/job/3',
          'https://test-private-a.example.com/job/4',
          'https://test-closed.example.com/job/5'
        ]
      }
    }
  }).catch(() => {});
  await prisma.job.deleteMany({
    where: {
      title: {
        in: [
          'Phase 7F Lead Stripe Architect',
          'Phase 7F Senior Datadog Engineer',
          'Phase 7F Fullstack Linear Developer',
          'Phase 7F Candidate A Confidential Job',
          'Phase 7F Deprecated Closed Job'
        ]
      }
    }
  }).catch(() => {});
  await prisma.candidate.deleteMany({
    where: { id: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});

  // Create Candidates
  await prisma.candidate.create({
    data: {
      id: CAND_A,
      clerkUserId: 'clerk-user-7f-a',
      email: 'cand7f-a@example.com',
      profile: {
        create: {
          name: 'Phase 7F Candidate A',
          location: 'San Francisco, CA',
          professionalSummary: 'Senior Staff Architect with distributed systems expertise.'
        }
      },
      preferences: {
        create: {
          targetRoles: ['Staff Software Engineer', 'Lead Architect'],
          preferredLocations: ['San Francisco, CA', 'Remote'],
          workArrangements: ['remote', 'hybrid'],
          targetSalaryMin: 180000,
          currency: 'USD'
        }
      }
    }
  });

  await prisma.candidate.create({
    data: {
      id: CAND_B,
      clerkUserId: 'clerk-user-7f-b',
      email: 'cand7f-b@example.com',
      profile: {
        create: {
          name: 'Phase 7F Candidate B',
          location: 'New York, NY',
          professionalSummary: 'Candidate B profile.'
        }
      }
    }
  });

  // Create Benchmark Jobs & Sources
  const stripeJob = await prisma.job.create({
    data: {
      title: 'Phase 7F Lead Stripe Architect',
      company: 'Stripe',
      location: 'San Francisco, CA',
      workArrangement: 'remote',
      description: 'Distributed payment systems and billing architecture with Go and TypeScript.',
      requiredSkills: ['Go', 'TypeScript', 'Distributed Systems'],
      preferredSkills: ['PostgreSQL', 'Payments'],
      jobStatus: 'active',
      isPublic: true,
      postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      source: 'greenhouse'
    }
  });

  await prisma.jobSourceReference.create({
    data: {
      jobId: stripeJob.id,
      source: 'greenhouse',
      sourceUrl: 'https://test-stripe.example.com/job/1',
      normalizedUrl: 'https://test-stripe.example.com/job/1',
      sourceStatus: 'active',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary'
    }
  });

  const datadogJob = await prisma.job.create({
    data: {
      title: 'Phase 7F Senior Datadog Engineer',
      company: 'Datadog',
      location: 'San Francisco, CA',
      workArrangement: 'hybrid',
      description: 'Cloud monitoring and observability infrastructure.',
      requiredSkills: ['Go', 'Kubernetes'],
      preferredSkills: ['Metrics', 'Tracing'],
      jobStatus: 'active',
      isPublic: true,
      postedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      source: 'lever'
    }
  });

  await prisma.jobSourceReference.create({
    data: {
      jobId: datadogJob.id,
      source: 'lever',
      sourceUrl: 'https://test-datadog.example.com/job/2',
      normalizedUrl: 'https://test-datadog.example.com/job/2',
      sourceStatus: 'active',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary'
    }
  });

  const linearJob = await prisma.job.create({
    data: {
      title: 'Phase 7F Fullstack Linear Developer',
      company: 'Linear',
      location: 'Remote',
      workArrangement: 'remote',
      description: 'High-performance issue tracking and workflow sync.',
      requiredSkills: ['React', 'Node.js'],
      preferredSkills: ['GraphQL'],
      jobStatus: 'active',
      isPublic: true,
      postedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      source: 'company_portal'
    }
  });

  await prisma.jobSourceReference.create({
    data: {
      jobId: linearJob.id,
      source: 'company_portal',
      sourceUrl: 'https://test-linear.example.com/job/3',
      normalizedUrl: 'https://test-linear.example.com/job/3',
      sourceStatus: 'active',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary'
    }
  });

  // Private Job for Candidate A
  const privateJobA = await prisma.job.create({
    data: {
      title: 'Phase 7F Candidate A Confidential Job',
      company: 'Private Corp',
      location: 'Remote',
      workArrangement: 'remote',
      description: 'Confidential role imported privately by Candidate A.',
      requiredSkills: ['Rust'],
      jobStatus: 'active',
      isPublic: false,
      importedByCandidateId: CAND_A,
      source: 'url_import'
    }
  });

  await prisma.jobSourceReference.create({
    data: {
      jobId: privateJobA.id,
      source: 'url_import',
      sourceUrl: 'https://test-private-a.example.com/job/4',
      normalizedUrl: 'https://test-private-a.example.com/job/4',
      sourceStatus: 'active',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary'
    }
  });

  // Closed / Unusable Job
  const closedJob = await prisma.job.create({
    data: {
      title: 'Phase 7F Deprecated Closed Job',
      company: 'Closed Corp',
      location: 'Onsite',
      workArrangement: 'onsite',
      description: 'This job has only an authoritative closed source reference.',
      requiredSkills: ['Legacy'],
      jobStatus: 'active',
      isPublic: true,
      source: 'greenhouse'
    }
  });

  await prisma.jobSourceReference.create({
    data: {
      jobId: closedJob.id,
      source: 'greenhouse',
      sourceUrl: 'https://test-closed.example.com/job/5',
      normalizedUrl: 'https://test-closed.example.com/job/5',
      sourceStatus: 'closed',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary'
    }
  });

  // Create JobMatches with authoritative benchmark scores:
  // Stripe = 94%, Datadog = 82%, Linear = 76%
  await prisma.jobMatch.create({
    data: {
      jobId: stripeJob.id,
      candidateId: CAND_A,
      score: 94,
      recommendation: 'strong',
      headline: 'Outstanding architectural alignment',
      reasoning: 'Expert match for distributed payment systems',
      strongMatches: [],
      partialMatches: [],
      missingRequirements: [],
      supportingCandidateEvidence: []
    }
  });

  await prisma.jobMatch.create({
    data: {
      jobId: datadogJob.id,
      candidateId: CAND_A,
      score: 82,
      recommendation: 'good',
      headline: 'Strong observability alignment',
      reasoning: 'Solid fit for metrics and Kubernetes monitoring',
      strongMatches: [],
      partialMatches: [],
      missingRequirements: [],
      supportingCandidateEvidence: []
    }
  });

  await prisma.jobMatch.create({
    data: {
      jobId: linearJob.id,
      candidateId: CAND_A,
      score: 76,
      recommendation: 'good',
      headline: 'Good fullstack fit',
      reasoning: 'Matches React and frontend architecture',
      strongMatches: [],
      partialMatches: [],
      missingRequirements: [],
      supportingCandidateEvidence: []
    }
  });

  // Also setup in-memory repo with equivalent data for parity verification
  (inMemoryRepo as any).db.jobs.push(
    { ...stripeJob, postedDate: stripeJob.postedDate?.toISOString() },
    { ...datadogJob, postedDate: datadogJob.postedDate?.toISOString() },
    { ...linearJob, postedDate: linearJob.postedDate?.toISOString() },
    { ...privateJobA, postedDate: undefined },
    { ...closedJob, postedDate: undefined }
  );

  (inMemoryRepo as any).jobSourceReferences.push(
    {
      id: 'src-stripe-1',
      jobId: stripeJob.id,
      source: 'greenhouse',
      sourceUrl: 'https://test-stripe.example.com/job/1',
      normalizedUrl: 'https://test-stripe.example.com/job/1',
      sourceStatus: 'active',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'src-datadog-2',
      jobId: datadogJob.id,
      source: 'lever',
      sourceUrl: 'https://test-datadog.example.com/job/2',
      normalizedUrl: 'https://test-datadog.example.com/job/2',
      sourceStatus: 'active',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'src-linear-3',
      jobId: linearJob.id,
      source: 'company_portal',
      sourceUrl: 'https://test-linear.example.com/job/3',
      normalizedUrl: 'https://test-linear.example.com/job/3',
      sourceStatus: 'active',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'src-private-4',
      jobId: privateJobA.id,
      source: 'url_import',
      sourceUrl: 'https://test-private-a.example.com/job/4',
      normalizedUrl: 'https://test-private-a.example.com/job/4',
      sourceStatus: 'active',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'src-closed-5',
      jobId: closedJob.id,
      source: 'greenhouse',
      sourceUrl: 'https://test-closed.example.com/job/5',
      normalizedUrl: 'https://test-closed.example.com/job/5',
      sourceStatus: 'closed',
      verificationStatus: 'verified_accessible',
      isPrimary: true,
      referenceRole: 'primary',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  );

  (inMemoryRepo as any).db.matches.push(
    { jobId: stripeJob.id, candidateId: CAND_A, score: 94 },
    { jobId: datadogJob.id, candidateId: CAND_A, score: 82 },
    { jobId: linearJob.id, candidateId: CAND_A, score: 76 }
  );

  (inMemoryRepo as any).db.preferences[CAND_A] = {
    targetRoles: ['Staff Software Engineer', 'Lead Architect'],
    preferredLocations: ['San Francisco, CA', 'Remote'],
    workArrangements: ['remote', 'hybrid'],
    targetSalaryMin: 180000,
    currency: 'USD'
  };

  // ---------------------------------------------------------------------------
  // 1. DISCOVERY TABS & BASIC RETRIEVAL
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. PRIMARY DISCOVERY TABS ---');

  const recResult = await repo.getDiscoveryRanking({ tab: 'recommended' }, CAND_A);
  record(
    1,
    'Recommended tab loads successfully',
    recResult.items.length > 0,
    `Loaded ${recResult.items.length} opportunities`
  );

  const allResult = await repo.getDiscoveryRanking({ tab: 'all' }, CAND_A);
  record(
    2,
    'All Jobs tab loads successfully',
    allResult.items.length >= recResult.items.length,
    `Loaded ${allResult.items.length} opportunities`
  );

  const initialSaved = await repo.getDiscoveryRanking({ tab: 'saved' }, CAND_A);
  record(
    3,
    'Saved tab contains 0 items when no jobs have been saved',
    initialSaved.items.length === 0,
    `Initial saved count: ${initialSaved.items.length}`
  );

  // ---------------------------------------------------------------------------
  // 2. OPPORTUNITY PRIORITY & BENCHMARK RANKING
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. OPPORTUNITY PRIORITY & BENCHMARK RANKING ---');

  const stripeItem = recResult.items.find((i) => i.job.id === stripeJob.id);
  const datadogItem = recResult.items.find((i) => i.job.id === datadogJob.id);
  const linearItem = recResult.items.find((i) => i.job.id === linearJob.id);

  record(
    4,
    'Authoritative Stripe Profile alignment = 94%',
    stripeItem?.match?.score === 94,
    `Stripe match: ${stripeItem?.match?.score}%`
  );

  record(
    5,
    'Authoritative Datadog Profile alignment = 82%',
    datadogItem?.match?.score === 82,
    `Datadog match: ${datadogItem?.match?.score}%`
  );

  record(
    6,
    'Authoritative Linear Profile alignment = 76%',
    linearItem?.match?.score === 76,
    `Linear match: ${linearItem?.match?.score}%`
  );

  // Recommended ordering is Opportunity Priority DESC
  let isMonotonic = true;
  for (let i = 1; i < recResult.items.length; i++) {
    if (recResult.items[i].priority.priorityScore > recResult.items[i - 1].priority.priorityScore) {
      isMonotonic = false;
      break;
    }
  }
  record(
    7,
    'Recommended tab strictly preserves Opportunity Priority DESC ordering',
    isMonotonic && recResult.items.length >= 3,
    `Top priority: ${recResult.items[0]?.priority.priorityScore.toFixed(1)}`
  );

  // ---------------------------------------------------------------------------
  // 3. CANDIDATEJOBSTATE: SAVE, DISMISS, AND SAFE UNDO
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. CANDIDATE JOB STATE & DETERMINISTIC UNDO ---');

  // Save Job
  const savedState = await repo.setCandidateJobState(stripeJob.id, 'SAVED', CAND_A);
  record(
    8,
    'Save produces CandidateJobState = SAVED with savedAt timestamp',
    savedState.status === 'SAVED' && Boolean(savedState.savedAt),
    `Status: ${savedState.status}, savedAt: ${savedState.savedAt}`
  );

  const postSaveResults = await repo.getDiscoveryRanking({ tab: 'saved' }, CAND_A);
  record(
    9,
    'Saved tab now includes explicitly saved job',
    postSaveResults.items.some((i) => i.job.id === stripeJob.id),
    `Saved count: ${postSaveResults.items.length}`
  );

  // Dismiss Job
  const dismissedState = await repo.setCandidateJobState(
    datadogJob.id,
    'DISMISSED',
    CAND_A,
    'compensation'
  );
  record(
    10,
    'Dismiss produces CandidateJobState = DISMISSED with reason',
    dismissedState.status === 'DISMISSED' && dismissedState.dismissedReason === 'compensation',
    `Status: ${dismissedState.status}, reason: ${dismissedState.dismissedReason}`
  );

  const recAfterDismiss = await repo.getDiscoveryRanking({ tab: 'recommended' }, CAND_A);
  record(
    11,
    'Dismissed job is excluded from Recommended tab by default',
    !recAfterDismiss.items.some((i) => i.job.id === datadogJob.id),
    `Datadog excluded: ${!recAfterDismiss.items.some((i) => i.job.id === datadogJob.id)}`
  );

  // Undo from UNSEEN -> DISMISSED -> UNSEEN
  const undoneDatadog = await repo.undoCandidateJobState(datadogJob.id, CAND_A);
  record(
    12,
    'Undo dismissal for originally UNSEEN job restores UNSEEN (null) state',
    undoneDatadog === null,
    `State after undo: ${undoneDatadog === null ? 'null (UNSEEN)' : undoneDatadog?.status}`
  );

  const recAfterUndoneDismiss = await repo.getDiscoveryRanking({ tab: 'recommended' }, CAND_A);
  record(
    13,
    'Restored job immediately reappears in Recommended tab',
    recAfterUndoneDismiss.items.some((i) => i.job.id === datadogJob.id),
    `Datadog reappeared: ${recAfterUndoneDismiss.items.some((i) => i.job.id === datadogJob.id)}`
  );

  // Undo from SAVED -> DISMISSED -> SAVED
  await repo.setCandidateJobState(stripeJob.id, 'DISMISSED', CAND_A);
  const undoneStripe = await repo.undoCandidateJobState(stripeJob.id, CAND_A);
  record(
    14,
    'Undo dismissal for previously SAVED job restores SAVED state',
    undoneStripe !== null && undoneStripe.status === 'SAVED' && Boolean(undoneStripe.savedAt),
    `Restored state: ${undoneStripe?.status}`
  );

  // Verification that Discovery does NOT automatically create Applications
  const appCount = await prisma.application.count({ where: { candidateId: CAND_A } });
  record(
    15,
    'Discovery ranking, saving, and dismissing NEVER automatically creates Applications',
    appCount === 0,
    `Application count: ${appCount}`
  );

  // ---------------------------------------------------------------------------
  // 4. SERVER-SIDE SEARCH & FILTERS
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. SERVER-SIDE SEARCH & PRACTICAL FILTERS ---');

  // Search by title/skills
  const searchResult = await repo.getDiscoveryRanking(
    { tab: 'all', search: 'Distributed payment' },
    CAND_A
  );
  record(
    16,
    'Search by keyword/skill matches Stripe and filters out non-matching jobs',
    searchResult.items.some((i) => i.job.id === stripeJob.id) &&
      !searchResult.items.some((i) => i.job.id === linearJob.id),
    `Matches: ${searchResult.items.map((i) => i.job.company).join(', ')}`
  );

  // Filter by work arrangement (remote)
  const remoteResult = await repo.getDiscoveryRanking(
    { tab: 'all', workArrangement: 'remote' },
    CAND_A
  );
  record(
    17,
    'Work arrangement filter (remote) includes Stripe & Linear, excludes Datadog (hybrid)',
    remoteResult.items.some((i) => i.job.id === stripeJob.id) &&
      !remoteResult.items.some((i) => i.job.id === datadogJob.id),
    `Remote jobs count: ${remoteResult.items.length}`
  );

  // Filter by minimum match score (85%+)
  const minMatchResult = await repo.getDiscoveryRanking(
    { tab: 'all', minMatch: 85 },
    CAND_A
  );
  record(
    18,
    'Minimum Match filter (85%+) filters strictly by JobMatch.score (includes Stripe 94%, excludes Datadog 82%)',
    minMatchResult.items.some((i) => i.job.id === stripeJob.id) &&
      !minMatchResult.items.some((i) => i.job.id === datadogJob.id),
    `MinMatch 85+ count: ${minMatchResult.items.length}`
  );

  // Filter by source
  const sourceResult = await repo.getDiscoveryRanking(
    { tab: 'all', source: 'greenhouse' },
    CAND_A
  );
  record(
    19,
    'Source filter (greenhouse) includes Stripe and excludes Lever/Portal jobs',
    sourceResult.items.some((i) => i.job.id === stripeJob.id) &&
      !sourceResult.items.some((i) => i.job.id === datadogJob.id),
    `Source greenhouse count: ${sourceResult.items.length}`
  );

  // ---------------------------------------------------------------------------
  // 5. KEYSET PAGINATION & EVALUATEDAT STABILITY
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. KEYSET PAGINATION & EVALUATEDAT STABILITY ---');

  const page1 = await repo.getDiscoveryRanking({ tab: 'recommended', pageSize: 1 }, CAND_A);
  record(
    20,
    'Page 1 returns pageSize=1 and valid nextCursor',
    page1.items.length === 1 && Boolean(page1.nextCursor) && page1.hasMore === true,
    `Page 1 nextCursor: ${page1.nextCursor ? 'present' : 'none'}`
  );

  const page2 = await repo.getDiscoveryRanking(
    { tab: 'recommended', pageSize: 1, cursor: page1.nextCursor! },
    CAND_A
  );
  record(
    21,
    'Page 2 returns distinct job ID (no duplicate IDs across pages)',
    page2.items.length === 1 && page2.items[0].job.id !== page1.items[0].job.id,
    `Page 1 ID: ${page1.items[0]?.job.id}, Page 2 ID: ${page2.items[0]?.job.id}`
  );

  record(
    22,
    'evaluatedAt remains identical across paginated pages',
    page1.evaluatedAt === page2.evaluatedAt,
    `Page 1: ${page1.evaluatedAt}, Page 2: ${page2.evaluatedAt}`
  );

  // Filter change context mismatch test
  const mismatchedPage = await repo.getDiscoveryRanking(
    { tab: 'recommended', search: 'Stripe', cursor: page1.nextCursor! },
    CAND_A
  );
  record(
    23,
    'Filter change triggers cursor context reset (cursorReset = true)',
    mismatchedPage.cursorReset === true,
    `cursorReset: ${mismatchedPage.cursorReset}`
  );

  // ---------------------------------------------------------------------------
  // 6. SOURCE LIFECYCLE & USABILITY GATING
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. SOURCE USABILITY & LIFECYCLE ---');

  record(
    24,
    'Opportunity returns primary source reference with domain metadata',
    Boolean(stripeItem?.primarySource && stripeItem.primarySource.source === 'greenhouse'),
    `Primary source: ${stripeItem?.primarySource?.source}`
  );

  record(
    25,
    'Closed/unusable job is strictly excluded from Recommended tab',
    !recResult.items.some((i) => i.job.id === closedJob.id),
    `Closed job excluded from Recommended: ${!recResult.items.some((i) => i.job.id === closedJob.id)}`
  );

  // ---------------------------------------------------------------------------
  // 7. MULTI-TENANT CANDIDATE ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. MULTI-TENANT CANDIDATE ISOLATION ---');

  const recResultB = await repo.getDiscoveryRanking({ tab: 'all' }, CAND_B);
  record(
    26,
    'Candidate B cannot see Candidate A private imported job',
    !recResultB.items.some((i) => i.job.id === privateJobA.id),
    `Candidate B visible count: ${recResultB.items.length}`
  );

  record(
    27,
    'Candidate A sees their own private imported job',
    allResult.items.some((i) => i.job.id === privateJobA.id),
    `Candidate A sees private job: true`
  );

  // Candidate B cannot mutate Candidate A state
  let isolationEnforced = false;
  try {
    await repo.setCandidateJobState(stripeJob.id, 'SAVED', '');
  } catch {
    isolationEnforced = true;
  }
  record(
    28,
    'Mutating state without explicit candidateId is rejected at repository boundary',
    isolationEnforced,
    `Error thrown as required`
  );

  // ---------------------------------------------------------------------------
  // 8. REPOSITORY PARITY (PRISMA VS IN-MEMORY)
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. REPOSITORY PARITY (PRISMA VS IN-MEMORY) ---');

  const inMemRec = await inMemoryRepo.getDiscoveryRanking({ tab: 'recommended' }, CAND_A);
  const inMemStripe = inMemRec.items.find((i) => i.job.id === stripeJob.id);

  record(
    29,
    'InMemory repository produces exact ranking parity for Stripe (Match = 94%)',
    inMemStripe?.match?.score === 94,
    `InMemory match: ${inMemStripe?.match?.score}%`
  );

  // Test InMemory undo semantics
  await inMemoryRepo.setCandidateJobState(stripeJob.id, 'SAVED', CAND_A);
  await inMemoryRepo.setCandidateJobState(stripeJob.id, 'DISMISSED', CAND_A);
  const inMemUndo = await inMemoryRepo.undoCandidateJobState(stripeJob.id, CAND_A);
  record(
    30,
    'InMemory repository preserves exact SAVED -> DISMISSED -> SAVED undo parity',
    inMemUndo?.status === 'SAVED',
    `Restored InMemory status: ${inMemUndo?.status}`
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n====================================================');
  const allPassed = checkpoints.every((c) => c.passed);
  console.log(`  PHASE 7F TOTAL: ${checkpoints.length} CHECKPOINTS`);
  console.log(`  PASSED: ${checkpoints.filter((c) => c.passed).length}`);
  console.log(`  FAILED: ${checkpoints.filter((c) => !c.passed).length}`);
  console.log(`  OVERALL: ${allPassed ? 'ALL PASS' : 'FAILURES DETECTED'}`);
  console.log('====================================================\n');

  // Cleanup fixtures
  await prisma.candidateJobState.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.jobMatch.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.jobSourceReference.deleteMany({
    where: {
      sourceUrl: {
        in: [
          'https://test-stripe.example.com/job/1',
          'https://test-datadog.example.com/job/2',
          'https://test-linear.example.com/job/3',
          'https://test-private-a.example.com/job/4',
          'https://test-closed.example.com/job/5'
        ]
      }
    }
  }).catch(() => {});
  await prisma.job.deleteMany({
    where: {
      title: {
        in: [
          'Phase 7F Lead Stripe Architect',
          'Phase 7F Senior Datadog Engineer',
          'Phase 7F Fullstack Linear Developer',
          'Phase 7F Candidate A Confidential Job',
          'Phase 7F Deprecated Closed Job'
        ]
      }
    }
  }).catch(() => {});
  await prisma.candidate.deleteMany({
    where: { id: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});

  if (!allPassed) {
    process.exit(1);
  }
}

run()
  .catch((err) => {
    console.error('Fatal error running verify:phase7f:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
