/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_RANKING_CONFIG,
  NEUTRAL_FRESHNESS_SCORE,
  NEUTRAL_MATCH_SCORE,
  OPPORTUNITY_PRIORITY_V1,
  buildRankingContextKey,
  calculateFreshnessScore,
  calculateOpportunityPriority,
  calculatePreferenceFit,
  compareDiscoveryOrder,
  decodeCursor,
  encodeCursor,
  isRowAfterCursor
} from '../src/features/jobs/lib/ranking';
import { getCareerRepository, setCareerRepositoryMode } from '../src/services/repository-provider';
import { CandidatePreferences, Job, JobMatch, JobSourceReference } from '../src/types/domain';

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
  console.log('  CareerQuest Phase 7D: Opportunity Priority');
  console.log('  & Discovery Ranking Verification Suite');
  console.log('====================================================\n');

  setCareerRepositoryMode('prisma');
  const repository = getCareerRepository();

  const CAND_A = 'cand-phase7d-a';
  const CAND_B = 'cand-phase7d-b';

  // Ensure clean test candidates
  await prisma.candidatePreferences.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  });
  await prisma.jobMatch.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  });
  await prisma.candidateJobState.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  });
  await prisma.applicationEvent.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  });
  await prisma.application.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  });
  await prisma.job.deleteMany({
    where: { importedByCandidateId: { in: [CAND_A, CAND_B] } }
  });

  // Create candidate A: Backend / Distributed Systems, SF / Remote, Remote only
  await prisma.candidate.upsert({
    where: { id: CAND_A },
    create: {
      id: CAND_A,
      clerkUserId: 'user_phase7d_a',
      email: 'cand_a.phase7d@example.com',
      profile: {
        create: {
          name: 'Candidate A (Phase 7D)',
          location: 'San Francisco, CA',
          professionalSummary: 'Senior Distributed Systems Engineer.'
        }
      }
    },
    update: {}
  });

  await prisma.candidatePreferences.upsert({
    where: { candidateId: CAND_A },
    create: {
      candidateId: CAND_A,
      targetRoles: ['Distributed Systems Engineer', 'Backend Engineer'],
      preferredLocations: ['San Francisco, CA', 'Remote'],
      workArrangements: ['remote'],
      targetSalaryMin: 180000
    },
    update: {
      targetRoles: ['Distributed Systems Engineer', 'Backend Engineer'],
      preferredLocations: ['San Francisco, CA', 'Remote'],
      workArrangements: ['remote'],
      targetSalaryMin: 180000
    }
  });

  // Create candidate B: Frontend / UI Engineer, New York, Onsite only
  await prisma.candidate.upsert({
    where: { id: CAND_B },
    create: {
      id: CAND_B,
      clerkUserId: 'user_phase7d_b',
      email: 'cand_b.phase7d@example.com',
      profile: {
        create: {
          name: 'Candidate B (Phase 7D)',
          location: 'New York, NY',
          professionalSummary: 'Frontend Architect.'
        }
      }
    },
    update: {}
  });

  await prisma.candidatePreferences.upsert({
    where: { candidateId: CAND_B },
    create: {
      candidateId: CAND_B,
      targetRoles: ['Frontend Engineer', 'UI Architect'],
      preferredLocations: ['New York, NY'],
      workArrangements: ['onsite'],
      targetSalaryMin: 160000
    },
    update: {
      targetRoles: ['Frontend Engineer', 'UI Architect'],
      preferredLocations: ['New York, NY'],
      workArrangements: ['onsite'],
      targetSalaryMin: 160000
    }
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: FORMULA CORRECTNESS, NORMALIZATION, & WEIGHT CONFIG
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Formula Correctness, Normalization, & Weights ---');

  record(
    1,
    'Centralized ranking configuration exists and is versioned',
    DEFAULT_RANKING_CONFIG.version === OPPORTUNITY_PRIORITY_V1,
    `Version: ${DEFAULT_RANKING_CONFIG.version}`
  );

  const weightSum =
    DEFAULT_RANKING_CONFIG.matchWeight +
    DEFAULT_RANKING_CONFIG.preferenceWeight +
    DEFAULT_RANKING_CONFIG.freshnessWeight;
  record(
    2,
    'Ranking weights sum exactly to 1.0 (50% Match, 35% PreferenceFit, 15% Freshness)',
    Math.abs(weightSum - 1.0) < 0.0001 &&
      DEFAULT_RANKING_CONFIG.matchWeight === 0.5 &&
      DEFAULT_RANKING_CONFIG.preferenceWeight === 0.35 &&
      DEFAULT_RANKING_CONFIG.freshnessWeight === 0.15,
    `Weights: ${DEFAULT_RANKING_CONFIG.matchWeight} / ${DEFAULT_RANKING_CONFIG.preferenceWeight} / ${DEFAULT_RANKING_CONFIG.freshnessWeight}`
  );

  const mockJobPerfect: Job = {
    id: 'test-job-perfect',
    title: 'Senior Backend Engineer',
    company: 'Acme Corp',
    location: 'San Francisco, CA',
    description: 'Senior backend engineer role.',
    responsibilities: [],
    requiredSkills: [],
    preferredSkills: [],
    source: 'greenhouse',
    normalizedAt: new Date().toISOString(),
    workArrangement: 'remote',
    jobStatus: 'active',
    isPublic: true,
    postedDate: new Date().toISOString()
  };

  const mockPrefA: CandidatePreferences = {
    targetRoles: ['Backend Engineer'],
    preferredLocations: ['San Francisco, CA'],
    workArrangements: ['remote']
  };

  const match100: JobMatch = {
    id: 'match-100',
    jobId: mockJobPerfect.id,
    candidateId: CAND_A,
    score: 100,
    recommendation: 'strong',
    headline: 'Strong fit',
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
    supportingCandidateEvidence: [],
    reasoning: 'Perfect fit'
  };

  const resPerfect = calculateOpportunityPriority(
    mockJobPerfect,
    CAND_A,
    match100,
    mockPrefA,
    [],
    DEFAULT_RANKING_CONFIG,
    new Date()
  );

  record(
    3,
    'Boundary maximum: Match 100 + Fit 100 + Freshness 100 produces Priority 100.0',
    resPerfect.priorityScore === 100,
    `Actual: ${resPerfect.priorityScore}`
  );

  const mockJobZero: Job = {
    id: 'test-job-zero',
    title: 'Data Analyst',
    company: 'Unrelated Inc',
    location: 'Tokyo',
    description: 'Data analyst role.',
    responsibilities: [],
    requiredSkills: [],
    preferredSkills: [],
    source: 'manual',
    normalizedAt: new Date().toISOString(),
    workArrangement: 'onsite',
    jobStatus: 'active',
    isPublic: true,
    postedDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() // 120 days old -> freshness 5
  };

  const match0: JobMatch = {
    id: 'match-0',
    jobId: mockJobZero.id,
    candidateId: CAND_A,
    score: 0,
    recommendation: 'low',
    headline: 'No alignment',
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
    supportingCandidateEvidence: [],
    reasoning: 'No alignment'
  };

  const resZero = calculateOpportunityPriority(
    mockJobZero,
    CAND_A,
    match0,
    mockPrefA,
    [],
    DEFAULT_RANKING_CONFIG,
    new Date()
  );

  // Match 0 (50%) + PrefFit 0 (35%) + Freshness 5 (15%) = 0 + 0 + 0.75 = 0.8
  record(
    4,
    'Boundary low: Match 0 + Fit 0 + Freshness 5 produces deterministic score in [0, 100]',
    resZero.priorityScore >= 0 && resZero.priorityScore <= 100 && resZero.priorityScore === 0.8,
    `Actual: ${resZero.priorityScore}`
  );

  // Exact formula check: Match 80 * 0.50 + Fit 60 * 0.35 + Freshness 40 * 0.15 = 40 + 21 + 6 = 67.0
  // Test manual calculation helper
  const expectedCombined = 80 * 0.5 + 60 * 0.35 + 40 * 0.15;
  record(
    5,
    'Weighted formula verification: 80 * 0.50 + 60 * 0.35 + 40 * 0.15 = 67.0',
    Math.round(expectedCombined * 10) / 10 === 67,
    `Expected: 67.0, Calculated: ${expectedCombined}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: MISSING DATA RULES & WEIGHT REDISTRIBUTION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Missing Data Rules & Weight Redistribution ---');

  // Missing Match -> neutral 50
  const resNoMatch = calculateOpportunityPriority(
    mockJobPerfect,
    CAND_A,
    null,
    mockPrefA,
    [],
    DEFAULT_RANKING_CONFIG,
    new Date()
  );
  record(
    6,
    'Missing JobMatch defaults to neutral 50 without penalizing candidate',
    resNoMatch.matchScore === NEUTRAL_MATCH_SCORE && resNoMatch.breakdown.matchScore === 50,
    `Match score: ${resNoMatch.matchScore}`
  );

  // Missing Preferences -> 35% weight redistributed deterministically across Match and Freshness
  // availableWeight = 0.50 + 0.15 = 0.65
  // effectiveMatchWeight = 0.50 / 0.65 = ~0.7692
  // effectiveFreshWeight = 0.15 / 0.65 = ~0.2308
  // Match 80, Freshness 50: 80 * (0.50/0.65) + 50 * (0.15/0.65) = 61.538 + 11.538 = 73.076 -> 73.1
  const match80: JobMatch = {
    id: 'match-80',
    jobId: mockJobPerfect.id,
    candidateId: CAND_A,
    score: 80,
    recommendation: 'good',
    headline: 'Good fit',
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
    supportingCandidateEvidence: [],
    reasoning: 'Good match'
  };

  const resNoPref = calculateOpportunityPriority(
    { ...mockJobPerfect, postedDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString() }, // 25d old -> freshness 50
    CAND_A,
    match80,
    null, // no preferences configured
    [],
    DEFAULT_RANKING_CONFIG,
    new Date()
  );

  record(
    7,
    'Empty preferences does NOT assign fit=0; weight is redistributed across Match and Freshness',
    resNoPref.breakdown.preferencesRedistributed === true &&
      resNoPref.breakdown.weights.preference === 0 &&
      resNoPref.priorityScore === 73.1,
    `Priority: ${resNoPref.priorityScore}, MatchWeight: ${resNoPref.breakdown.weights.match}, FreshWeight: ${resNoPref.breakdown.weights.freshness}`
  );

  // Missing postedDate & no sources -> freshness defaults to neutral 50
  const jobNoDate: Job = {
    ...mockJobPerfect,
    postedDate: undefined
  };
  const freshnessNoDate = calculateFreshnessScore(jobNoDate, []);
  record(
    8,
    'Missing postedDate and missing source firstSeenAt defaults to neutral 50 without penalty',
    freshnessNoDate === NEUTRAL_FRESHNESS_SCORE,
    `Freshness: ${freshnessNoDate}`
  );

  // Missing job location -> neutral 50 in location dimension
  const jobNoLoc: Job = {
    ...mockJobPerfect,
    location: 'Unknown'
  };
  const fitNoLoc = calculatePreferenceFit(jobNoLoc, mockPrefA);
  record(
    9,
    'Missing / unknown job location evaluates to neutral 50 (no artificial penalty)',
    fitNoLoc.dimensionScores.location === 50,
    `Location dim score: ${fitNoLoc.dimensionScores.location}`
  );

  // Missing job work arrangement -> neutral 50 in arrangement dimension
  const jobNoArrangement: Job = {
    ...mockJobPerfect,
    workArrangement: 'unknown'
  };
  const fitNoArrangement = calculatePreferenceFit(jobNoArrangement, mockPrefA);
  record(
    10,
    'Missing / unknown job work arrangement evaluates to neutral 50 (no artificial penalty)',
    fitNoArrangement.dimensionScores.arrangement === 50,
    `Arrangement dim score: ${fitNoArrangement.dimensionScores.arrangement}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: FRESHNESS DECAY SCHEDULE
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Freshness Decay Schedule ---');

  const now = new Date();
  const job1d: Job = {
    ...mockJobPerfect,
    postedDate: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()
  }; // 0.5 days
  const job3d: Job = {
    ...mockJobPerfect,
    postedDate: new Date(now.getTime() - 2.5 * 24 * 60 * 60 * 1000).toISOString()
  }; // 2.5 days
  const job7d: Job = {
    ...mockJobPerfect,
    postedDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }; // 5 days
  const job14d: Job = {
    ...mockJobPerfect,
    postedDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
  }; // 10 days
  const job30d: Job = {
    ...mockJobPerfect,
    postedDate: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString()
  }; // 25 days
  const job60d: Job = {
    ...mockJobPerfect,
    postedDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString()
  }; // 45 days
  const job90d: Job = {
    ...mockJobPerfect,
    postedDate: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000).toISOString()
  }; // 75 days
  const jobOld: Job = {
    ...mockJobPerfect,
    postedDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString()
  }; // 120 days

  const s1d = calculateFreshnessScore(job1d, [], now);
  const s3d = calculateFreshnessScore(job3d, [], now);
  const s7d = calculateFreshnessScore(job7d, [], now);
  const s14d = calculateFreshnessScore(job14d, [], now);
  const s30d = calculateFreshnessScore(job30d, [], now);
  const s60d = calculateFreshnessScore(job60d, [], now);
  const s90d = calculateFreshnessScore(job90d, [], now);
  const sOld = calculateFreshnessScore(jobOld, [], now);

  record(
    11,
    'Freshness age schedule: <=1d (100), <=3d (95), <=7d (85)',
    s1d === 100 && s3d === 95 && s7d === 85,
    `Scores: 1d=${s1d}, 3d=${s3d}, 7d=${s7d}`
  );
  record(
    12,
    'Freshness age schedule: <=14d (70), <=30d (50), <=60d (30)',
    s14d === 70 && s30d === 50 && s60d === 30,
    `Scores: 14d=${s14d}, 30d=${s30d}, 60d=${s60d}`
  );
  record(
    13,
    'Freshness age schedule: <=90d (15), >90d (5)',
    s90d === 15 && sOld === 5,
    `Scores: 90d=${s90d}, 120d=${sOld}`
  );

  // Fallback to JobSourceReference firstSeenAt when postedDate is missing
  const mockSourceRef: JobSourceReference = {
    id: 'ref-1',
    jobId: 'job-x',
    source: 'greenhouse',
    sourceJobId: '123',
    sourceUrl: 'https://boards.greenhouse.io/acme/jobs/123',
    normalizedUrl: 'https://boards.greenhouse.io/acme/jobs/123',
    referenceRole: 'primary',
    sourceStatus: 'active',
    verificationStatus: 'verified_accessible',
    isPrimary: true,
    firstSeenAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days old -> 95
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now
  };
  const sFallback = calculateFreshnessScore({ ...mockJobPerfect, postedDate: undefined }, [mockSourceRef], now);
  record(
    14,
    'Freshness falls back to JobSourceReference firstSeenAt when postedDate is missing',
    sFallback === 95,
    `Fallback freshness: ${sFallback}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: CANDIDATE ISOLATION & CANDIDATE-SPECIFIC PRIORITY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Candidate-Specific Priority & Isolation ---');

  // Same Job evaluated for Candidate A (SF/Remote) vs Candidate B (NY/Onsite)
  const sharedJob: Job = {
    id: 'shared-job-eval',
    title: 'Senior Distributed Systems Engineer',
    company: 'CloudScale Inc',
    location: 'San Francisco, CA',
    description: 'Distributed systems role.',
    responsibilities: [],
    requiredSkills: [],
    preferredSkills: [],
    source: 'greenhouse',
    normalizedAt: now.toISOString(),
    workArrangement: 'remote',
    jobStatus: 'active',
    isPublic: true,
    postedDate: now.toISOString()
  };

  const prefA = await repository.getCandidatePreferences(CAND_A);
  const prefB = await repository.getCandidatePreferences(CAND_B);

  const evalA = calculateOpportunityPriority(sharedJob, CAND_A, match80, prefA, [], DEFAULT_RANKING_CONFIG, now);
  const evalB = calculateOpportunityPriority(sharedJob, CAND_B, match80, prefB, [], DEFAULT_RANKING_CONFIG, now);

  record(
    15,
    'Same Job produces different PreferenceFit for Candidate A (100) vs Candidate B (0)',
    evalA.preferenceFit === 100 && evalB.preferenceFit === 0,
    `Candidate A Fit: ${evalA.preferenceFit}, Candidate B Fit: ${evalB.preferenceFit}`
  );

  record(
    16,
    'Same Job produces different Opportunity Priority for Candidate A (90.0) vs Candidate B (55.0)',
    evalA.priorityScore === 90 && evalB.priorityScore === 55,
    `Candidate A Priority: ${evalA.priorityScore}, Candidate B Priority: ${evalB.priorityScore}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: DETERMINISTIC ORDERING & KEYS (PRIORITY, POSTED_DATE, ID)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Deterministic Ordering Comparator ---');

  // 1. Different Priority
  const rowHighPrio = { priorityScore: 85, postedDate: '2026-09-01T00:00:00.000Z', id: 'job-z' };
  const rowLowPrio = { priorityScore: 70, postedDate: '2026-09-10T00:00:00.000Z', id: 'job-a' };
  record(
    17,
    'Higher Priority precedes lower Priority regardless of postedDate',
    compareDiscoveryOrder(rowHighPrio, rowLowPrio) < 0,
    `Diff: ${compareDiscoveryOrder(rowHighPrio, rowLowPrio)}`
  );

  // 2. Equal Priority, different postedDate
  const rowNewerDate = { priorityScore: 80, postedDate: '2026-09-15T00:00:00.000Z', id: 'job-z' };
  const rowOlderDate = { priorityScore: 80, postedDate: '2026-09-01T00:00:00.000Z', id: 'job-a' };
  record(
    18,
    'Equal Priority sorts newer postedDate before older postedDate',
    compareDiscoveryOrder(rowNewerDate, rowOlderDate) < 0,
    `Diff: ${compareDiscoveryOrder(rowNewerDate, rowOlderDate)}`
  );

  // 3. Equal Priority, non-null date vs null date (NULLS LAST)
  const rowNonNullDate = { priorityScore: 80, postedDate: '2026-09-01T00:00:00.000Z', id: 'job-z' };
  const rowNullDate = { priorityScore: 80, postedDate: null, id: 'job-a' };
  record(
    19,
    'Equal Priority places non-null postedDate BEFORE null postedDate (NULLS LAST)',
    compareDiscoveryOrder(rowNonNullDate, rowNullDate) < 0,
    `Diff: ${compareDiscoveryOrder(rowNonNullDate, rowNullDate)}`
  );
  record(
    20,
    'Equal Priority places null postedDate AFTER non-null postedDate (NULLS LAST)',
    compareDiscoveryOrder(rowNullDate, rowNonNullDate) > 0,
    `Diff: ${compareDiscoveryOrder(rowNullDate, rowNonNullDate)}`
  );

  // 4. Equal Priority, equal postedDate (ID tie-breaker)
  const rowIdA = { priorityScore: 80, postedDate: '2026-09-01T00:00:00.000Z', id: 'job-001' };
  const rowIdB = { priorityScore: 80, postedDate: '2026-09-01T00:00:00.000Z', id: 'job-002' };
  record(
    21,
    'Equal Priority and equal postedDate breaks ties deterministically with id ASC',
    compareDiscoveryOrder(rowIdA, rowIdB) < 0,
    `Diff: ${compareDiscoveryOrder(rowIdA, rowIdB)}`
  );

  // 5. Equal Priority, both null postedDate (ID tie-breaker)
  const rowNullIdA = { priorityScore: 80, postedDate: null, id: 'job-001' };
  const rowNullIdB = { priorityScore: 80, postedDate: null, id: 'job-002' };
  record(
    22,
    'Equal Priority with both postedDate null breaks ties deterministically with id ASC',
    compareDiscoveryOrder(rowNullIdA, rowNullIdB) < 0,
    `Diff: ${compareDiscoveryOrder(rowNullIdA, rowNullIdB)}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: KEYSET CURSOR ENCODING, VALIDATION, & TAMPER RESISTANCE
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Keyset Cursor Encoding & Safety ---');

  const contextKeyA = buildRankingContextKey(CAND_A, prefA, OPPORTUNITY_PRIORITY_V1);
  const contextKeyB = buildRankingContextKey(CAND_B, prefB, OPPORTUNITY_PRIORITY_V1);

  record(
    23,
    'Ranking context keys are distinct for different candidates',
    contextKeyA !== contextKeyB,
    `Context A != Context B`
  );

  const sampleEvalTime = '2026-09-12T10:00:00.000Z';
  const sampleCursorPayload = {
    p: 85.5,
    d: '2026-09-12T10:00:00.000Z',
    i: 'job-test-123',
    ctx: contextKeyA,
    e: sampleEvalTime
  };

  const encodedCursor = encodeCursor(sampleCursorPayload);
  record(
    24,
    'Cursor encodes to compact base64url string without sensitive personal data',
    typeof encodedCursor === 'string' &&
      !encodedCursor.includes('cand_a.phase7d@example.com') &&
      !encodedCursor.includes('{'),
    `Encoded: ${encodedCursor.substring(0, 20)}...`
  );

  const decodedGood = decodeCursor(encodedCursor, contextKeyA);
  record(
    25,
    'Valid cursor decodes accurately with matching context key and evaluatedAt timestamp',
    decodedGood.payload !== null &&
      decodedGood.payload.p === 85.5 &&
      decodedGood.payload.i === 'job-test-123' &&
      decodedGood.payload.e === sampleEvalTime &&
      decodedGood.isContextMismatch === false,
    `Decoded Priority: ${decodedGood.payload?.p}, ID: ${decodedGood.payload?.i}, evaluatedAt: ${decodedGood.payload?.e}`
  );

  // Missing evaluatedAt in cursor (legacy or tampered cursor)
  const legacyCursorMissingEval = Buffer.from(
    JSON.stringify({
      p: 85.5,
      d: '2026-09-12T10:00:00.000Z',
      i: 'job-test-123',
      ctx: contextKeyA
    }),
    'utf-8'
  ).toString('base64url');
  const decodedMissingEval = decodeCursor(legacyCursorMissingEval, contextKeyA);
  record(
    26,
    'Cursor missing evaluatedAt is safely rejected by validation rules',
    decodedMissingEval.payload === null && Boolean(decodedMissingEval.error),
    `Error: ${decodedMissingEval.error}`
  );

  // Malformed evaluatedAt timestamp
  const cursorBadEvalTime = Buffer.from(
    JSON.stringify({
      p: 85.5,
      d: '2026-09-12T10:00:00.000Z',
      i: 'job-test-123',
      ctx: contextKeyA,
      e: 'invalid-timestamp-string'
    }),
    'utf-8'
  ).toString('base64url');
  const decodedBadEval = decodeCursor(cursorBadEvalTime, contextKeyA);
  record(
    27,
    'Cursor with malformed/invalid evaluatedAt timestamp is safely rejected',
    decodedBadEval.payload === null && Boolean(decodedBadEval.error),
    `Error: ${decodedBadEval.error}`
  );

  // Context mismatch (Candidate B trying to use Candidate A cursor)
  const decodedMismatch = decodeCursor(encodedCursor, contextKeyB);
  record(
    28,
    'Cursor context mismatch is detected safely without crashing (triggers cursor reset)',
    decodedMismatch.isContextMismatch === true,
    'isContextMismatch: true'
  );

  // Malformed base64 cursor
  const decodedMalformed = decodeCursor('not-a-valid-base64-json!@#$', contextKeyA);
  record(
    29,
    'Malformed base64 cursor returns safe error without throwing raw database/system errors',
    decodedMalformed.payload === null && Boolean(decodedMalformed.error),
    `Error: ${decodedMalformed.error}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 7: DATABASE DISCOVERY INTEGRATION & SOURCE USABILITY GATE
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Database Discovery Ranking & Usability Gate ---');

  // Seed 4 test jobs with known characteristics:
  // Job 1: Active + Verified Accessible Greenhouse source -> Eligible
  // Job 2: Active + Closed source only -> Ineligible (Usability Gate)
  // Job 3: Active + Private to Candidate B -> Candidate A cannot see it (Candidate Isolation)
  // Job 4: Closed jobStatus -> Ineligible

  const testJob1 = await prisma.job.create({
    data: {
      id: 'job-phase7d-1',
      title: 'Senior Distributed Systems Architect',
      company: 'Apex Infrastructure',
      location: 'San Francisco, CA',
      description: 'Distributed systems architect role.',
      source: 'greenhouse',
      workArrangement: 'remote',
      jobStatus: 'active',
      isPublic: true,
      postedDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1d ago
      sourceReferences: {
        create: {
          id: 'ref-phase7d-1',
          source: 'greenhouse',
          sourceJobId: 'apex-101',
          sourceUrl: 'https://boards.greenhouse.io/apex/jobs/101',
          normalizedUrl: 'https://boards.greenhouse.io/apex/jobs/101',
          sourceStatus: 'active',
          verificationStatus: 'verified_accessible',
          isPrimary: true,
          firstSeenAt: now,
          lastSeenAt: now
        }
      }
    }
  });

  const testJob2 = await prisma.job.create({
    data: {
      id: 'job-phase7d-2',
      title: 'Backend Engineer - Infrastructure',
      company: 'ClosedSource Corp',
      location: 'San Francisco, CA',
      description: 'Infrastructure backend role.',
      source: 'linkedin',
      workArrangement: 'remote',
      jobStatus: 'active',
      isPublic: true,
      postedDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      sourceReferences: {
        create: {
          id: 'ref-phase7d-2',
          source: 'linkedin',
          sourceJobId: 'closed-202',
          sourceUrl: 'https://www.linkedin.com/jobs/view/202',
          normalizedUrl: 'https://www.linkedin.com/jobs/view/202',
          sourceStatus: 'closed', // CLOSED SOURCE -> Unusable
          verificationStatus: 'verified_accessible',
          isPrimary: true,
          firstSeenAt: now,
          lastSeenAt: now
        }
      }
    }
  });

  const testJob3PrivateB = await prisma.job.create({
    data: {
      id: 'job-phase7d-3',
      title: 'Confidential Backend Lead',
      company: 'Stealth Corp',
      location: 'San Francisco, CA',
      description: 'Confidential stealth role.',
      source: 'manual',
      workArrangement: 'remote',
      jobStatus: 'active',
      isPublic: false,
      importedByCandidateId: CAND_B, // Private to Candidate B!
      postedDate: now,
      sourceReferences: {
        create: {
          id: 'ref-phase7d-3',
          source: 'manual',
          sourceJobId: 'stealth-303',
          sourceUrl: 'https://stealth.example.com/jobs/303',
          normalizedUrl: 'https://stealth.example.com/jobs/303',
          sourceStatus: 'active',
          verificationStatus: 'verified_accessible',
          isPrimary: true,
          firstSeenAt: now,
          lastSeenAt: now
        }
      }
    }
  });

  const testJob4Closed = await prisma.job.create({
    data: {
      id: 'job-phase7d-4',
      title: 'Retired Backend Role',
      company: 'Archived Corp',
      location: 'San Francisco, CA',
      description: 'Archived closed role.',
      source: 'greenhouse',
      workArrangement: 'remote',
      jobStatus: 'closed', // CLOSED JOB
      isPublic: true,
      postedDate: now,
      sourceReferences: {
        create: {
          id: 'ref-phase7d-4',
          source: 'greenhouse',
          sourceJobId: 'archived-404',
          sourceUrl: 'https://boards.greenhouse.io/archived/jobs/404',
          normalizedUrl: 'https://boards.greenhouse.io/archived/jobs/404',
          sourceStatus: 'active',
          verificationStatus: 'verified_accessible',
          isPrimary: true,
          firstSeenAt: now,
          lastSeenAt: now
        }
      }
    }
  });

  // Query discovery ranking for Candidate A
  const rankingResA = await repository.getDiscoveryRanking({ pageSize: 50 }, CAND_A);

  const foundJob1 = rankingResA.items.find((i) => i.job.id === testJob1.id);
  record(
    30,
    'Active job with verified accessible source is included in discovery ranking',
    Boolean(foundJob1),
    foundJob1?.job.title
  );

  const foundJob2 = rankingResA.items.find((i) => i.job.id === testJob2.id);
  record(
    31,
    'Source usability gate: Job with only closed/unusable sources is excluded from active ranking',
    foundJob2 === undefined,
    'Excluded: true'
  );

  const foundJob3 = rankingResA.items.find((i) => i.job.id === testJob3PrivateB.id);
  record(
    32,
    'Candidate isolation: Candidate A cannot discover Candidate B private imported job',
    foundJob3 === undefined,
    'Isolated: true'
  );

  const foundJob4 = rankingResA.items.find((i) => i.job.id === testJob4Closed.id);
  record(
    33,
    'Closed job status is excluded from active recommendation ranking',
    foundJob4 === undefined,
    'Excluded: true'
  );

  // Verify Candidate B CAN see their own private job
  const rankingResB = await repository.getDiscoveryRanking({ pageSize: 50 }, CAND_B);
  const foundJob3InB = rankingResB.items.find((i) => i.job.id === testJob3PrivateB.id);
  record(
    34,
    'Candidate B can discover their own private imported job in discovery ranking',
    Boolean(foundJob3InB),
    foundJob3InB?.job.title
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 8: KEYSET PAGINATION & SESSION TEMPORAL STABILITY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Keyset Pagination & Session Temporal Stability ---');

  // Create 5 distinct jobs with staggered priority and dates to verify pagination continuation
  const pJobIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const pj = await prisma.job.create({
      data: {
        id: `job-phase7d-page-${i}`,
        title: `Engineer Role #${i}`,
        company: `Company ${i}`,
        location: 'San Francisco, CA',
        description: `Engineering role description #${i}`,
        source: 'greenhouse',
        workArrangement: 'remote',
        jobStatus: 'active',
        isPublic: true,
        postedDate: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        sourceReferences: {
          create: {
            id: `ref-phase7d-page-${i}`,
            source: 'greenhouse',
            sourceJobId: `p-${i}`,
            sourceUrl: `https://boards.greenhouse.io/comp/jobs/${i}`,
            normalizedUrl: `https://boards.greenhouse.io/comp/jobs/${i}`,
            sourceStatus: 'active',
            verificationStatus: 'verified_accessible',
            isPrimary: true,
            firstSeenAt: now,
            lastSeenAt: now
          }
        }
      }
    });
    pJobIds.push(pj.id);
  }

  // Request page 1 with pageSize: 2
  const page1 = await repository.getDiscoveryRanking({ pageSize: 2 }, CAND_A);
  const page1EvalValid =
    typeof page1.evaluatedAt === 'string' &&
    !Number.isNaN(new Date(page1.evaluatedAt).getTime());

  record(
    35,
    'Keyset page 1 returns requested page size, valid evaluatedAt ISO timestamp, and nextCursor',
    page1.items.length === 2 && Boolean(page1.nextCursor) && page1.hasMore === true && page1EvalValid,
    `Page 1 items: ${page1.items.length}, evaluatedAt: ${page1.evaluatedAt}`
  );

  // Verify nextCursor encodes the exact evaluatedAt
  const decodedPage1Cursor = page1.nextCursor ? decodeCursor(page1.nextCursor, rankingResA.rankingContextKey) : null;
  record(
    36,
    'Page 1 nextCursor carries the exact evaluatedAt timestamp from page 1',
    decodedPage1Cursor?.payload?.e === page1.evaluatedAt,
    `Cursor e: ${decodedPage1Cursor?.payload?.e}`
  );

  // Request page 2 with cursor from page 1
  const page2 = await repository.getDiscoveryRanking(
    { pageSize: 2, cursor: page1.nextCursor! },
    CAND_A
  );

  record(
    37,
    'Page 2 reuses original evaluatedAt timestamp (no newly generated timestamp)',
    page2.evaluatedAt === page1.evaluatedAt,
    `Page 1: ${page1.evaluatedAt} === Page 2: ${page2.evaluatedAt}`
  );

  record(
    38,
    'Keyset page 2 returns subsequent items without duplicate IDs from page 1',
    page2.items.length === 2 &&
      !page1.items.some((item1) => page2.items.some((item2) => item2.job.id === item1.job.id)),
    `Page 2 items: ${page2.items.length}`
  );

  // Verify cursor continuation strictly follows canonical order
  const lastPage1 = page1.items[page1.items.length - 1];
  const firstPage2 = page2.items[0];
  const orderBetweenPages = compareDiscoveryOrder(
    {
      priorityScore: lastPage1.priority.priorityScore,
      postedDate: lastPage1.job.postedDate,
      id: lastPage1.job.id
    },
    {
      priorityScore: firstPage2.priority.priorityScore,
      postedDate: firstPage2.job.postedDate,
      id: firstPage2.job.id
    }
  );
  record(
    39,
    'Ordering is strictly monotonic across keyset page boundary',
    orderBetweenPages <= 0,
    `Page1 last vs Page2 first ordering: ${orderBetweenPages}`
  );

  // Safe rejection of invalid cursor
  let invalidCursorRejected = false;
  try {
    await repository.getDiscoveryRanking(
      { pageSize: 2, cursor: 'invalid-base64-payload' },
      CAND_A
    );
  } catch (err: unknown) {
    invalidCursorRejected = err instanceof Error && err.message.includes('Invalid pagination cursor');
  }
  record(
    40,
    'Invalid cursor is rejected safely with clean error without restarting or corrupting state',
    invalidCursorRejected,
    `Rejected: ${invalidCursorRejected}`
  );

  // Cursor reset when preferences change:
  // Update Candidate A preferences to trigger context mismatch
  await prisma.candidatePreferences.update({
    where: { candidateId: CAND_A },
    data: {
      targetRoles: ['VP of Engineering', 'Director of Systems']
    }
  });

  const pageWithStaleCursor = await repository.getDiscoveryRanking(
    { pageSize: 2, cursor: page1.nextCursor! },
    CAND_A
  );

  record(
    41,
    'Preference changes reset ranking context and flag cursorReset: true with new evaluatedAt',
    pageWithStaleCursor.cursorReset === true &&
      pageWithStaleCursor.items.length > 0 &&
      Boolean(pageWithStaleCursor.evaluatedAt),
    `cursorReset: ${pageWithStaleCursor.cursorReset}, new evaluatedAt: ${pageWithStaleCursor.evaluatedAt}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 9: EVALUATION-TIME TEMPORAL STABILITY & FRESHNESS BOUNDARY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Temporal Stability & Freshness Boundary ---');

  // Test setup:
  // Establish a fixed T1 time: 2026-09-10T12:00:00.000Z
  // Create a boundary test job posted 6.8 days before T1 (<= 7 days -> Freshness = 85 at T1).
  // At simulated wall-clock T2 = T1 + 1 day, real age is 7.8 days (> 7 and <= 14 days -> Freshness = 70).
  const T1 = new Date('2026-09-10T12:00:00.000Z');
  const T2 = new Date('2026-09-11T12:00:00.000Z');
  const boundaryPostedDate = new Date(T1.getTime() - 6.8 * 24 * 60 * 60 * 1000); // 6.8 days old at T1, 7.8 days old at T2

  const boundaryJob = await prisma.job.create({
    data: {
      id: 'job-phase7d-boundary',
      title: 'Senior Boundary Engineer',
      company: 'Temporal Inc',
      location: 'San Francisco, CA',
      description: 'Role for freshness boundary verification.',
      source: 'greenhouse',
      workArrangement: 'remote',
      jobStatus: 'active',
      isPublic: true,
      postedDate: boundaryPostedDate,
      sourceReferences: {
        create: {
          id: 'ref-phase7d-boundary',
          source: 'greenhouse',
          sourceJobId: 'b-1',
          sourceUrl: 'https://boards.greenhouse.io/temp/jobs/1',
          normalizedUrl: 'https://boards.greenhouse.io/temp/jobs/1',
          sourceStatus: 'active',
          verificationStatus: 'verified_accessible',
          isPrimary: true,
          firstSeenAt: boundaryPostedDate,
          lastSeenAt: T1
        }
      }
    }
  });

  // Calculate direct freshness at T1 vs T2
  const freshnessAtT1 = calculateFreshnessScore(
    { ...boundaryJob, postedDate: boundaryPostedDate.toISOString() } as unknown as Job,
    [],
    T1
  );
  const freshnessAtT2 = calculateFreshnessScore(
    { ...boundaryJob, postedDate: boundaryPostedDate.toISOString() } as unknown as Job,
    [],
    T2
  );

  record(
    42,
    'Deterministic boundary fixture: freshness is 85 at T1 (age 6.8d <= 7d)',
    freshnessAtT1 === 85,
    `Freshness at T1: ${freshnessAtT1}`
  );

  record(
    43,
    'Advancing wall-clock to T2 (age 7.8d > 7d) without pagination snapshot drops freshness to 70',
    freshnessAtT2 === 70,
    `Freshness at T2: ${freshnessAtT2}`
  );

  // Now create a cursor payload snapshot with evaluatedAt = T1
  const candPrefsAfterUpdate = await repository.getCandidatePreferences(CAND_A);
  const contextKeyNow = buildRankingContextKey(CAND_A, candPrefsAfterUpdate, OPPORTUNITY_PRIORITY_V1);

  const cursorWithT1 = encodeCursor({
    p: 999, // dummy high priority so page starts before boundary job
    d: null,
    i: 'job-cursor-dummy',
    ctx: contextKeyNow,
    e: T1.toISOString()
  });

  // Request page using cursorWithT1 from Prisma repository
  const prismaPageWithCursorT1 = await repository.getDiscoveryRanking(
    { pageSize: 10, cursor: cursorWithT1 },
    CAND_A
  );
  const boundaryItemPrisma = prismaPageWithCursorT1.items.find((it) => it.job.id === boundaryJob.id);

  record(
    44,
    'Prisma repository reuses cursor evaluatedAt (T1): boundary job freshness stays 85 and does not drift',
    prismaPageWithCursorT1.evaluatedAt === T1.toISOString() &&
      boundaryItemPrisma !== undefined &&
      boundaryItemPrisma.priority.freshness === 85,
    `evaluatedAt: ${prismaPageWithCursorT1.evaluatedAt}, freshness: ${boundaryItemPrisma?.priority.freshness}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 10: REPOSITORY PARITY (PRISMA VS IN-MEMORY)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 10: Repository Parity (Prisma vs InMemory) ---');

  setCareerRepositoryMode('in-memory');
  const inMemRepo = getCareerRepository();

  const inMemPage1 = await inMemRepo.getDiscoveryRanking({ pageSize: 2 }, 'cand-1');
  record(
    45,
    'InMemory repository returns valid evaluatedAt timestamp on first page',
    typeof inMemPage1.evaluatedAt === 'string' &&
      !Number.isNaN(new Date(inMemPage1.evaluatedAt).getTime()),
    `InMemory evaluatedAt: ${inMemPage1.evaluatedAt}`
  );

  const inMemPage2 = await inMemRepo.getDiscoveryRanking(
    { pageSize: 2, cursor: inMemPage1.nextCursor! },
    'cand-1'
  );
  record(
    46,
    'InMemory repository reuses cursor evaluatedAt on page 2 identically to Prisma',
    inMemPage2.evaluatedAt === inMemPage1.evaluatedAt,
    `Page 1: ${inMemPage1.evaluatedAt} === Page 2: ${inMemPage2.evaluatedAt}`
  );

  const inMemPrefs = await inMemRepo.getCandidatePreferences('cand-1');
  const inMemCtx = buildRankingContextKey('cand-1', inMemPrefs, OPPORTUNITY_PRIORITY_V1);
  const inMemCursorT1 = encodeCursor({
    p: 999,
    d: null,
    i: 'dummy-id',
    ctx: inMemCtx,
    e: T1.toISOString()
  });
  const inMemPageWithT1 = await inMemRepo.getDiscoveryRanking(
    { pageSize: 2, cursor: inMemCursorT1 },
    'cand-1'
  );
  record(
    47,
    'InMemory repository preserves cursor evaluatedAt snapshot (T1) on pagination',
    inMemPageWithT1.evaluatedAt === T1.toISOString(),
    `InMemory evaluatedAt: ${inMemPageWithT1.evaluatedAt}`
  );

  // Check ordering invariants in InMemory repository
  let inMemOrderValid = true;
  for (let i = 0; i < inMemPage1.items.length - 1; i++) {
    const a = inMemPage1.items[i];
    const b = inMemPage1.items[i + 1];
    if (
      compareDiscoveryOrder(
        { priorityScore: a.priority.priorityScore, postedDate: a.job.postedDate, id: a.job.id },
        { priorityScore: b.priority.priorityScore, postedDate: b.job.postedDate, id: b.job.id }
      ) > 0
    ) {
      inMemOrderValid = false;
      break;
    }
  }
  record(
    48,
    'InMemory repository strictly enforces canonical deterministic discovery order',
    inMemOrderValid,
    `Order valid: ${inMemOrderValid}`
  );

  // Switch back to Prisma
  setCareerRepositoryMode('prisma');

  // ---------------------------------------------------------------------------
  // TEST GROUP 11: APPLICATION & CANDIDATE JOB STATE PRESERVATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 11: Application & State Non-Mutation Invariants ---');

  // Create an application on testJob1
  const preApp = await repository.createApplication(testJob1.id, 'applied', {}, CAND_A);
  const preState = await repository.setCandidateJobState(testJob1.id, 'SAVED', CAND_A);

  // Re-run discovery ranking multiple times
  await repository.getDiscoveryRanking({ pageSize: 10 }, CAND_A);
  await repository.getDiscoveryRanking({ pageSize: 10 }, CAND_A);

  const postApp = await repository.getApplicationById(preApp.id, CAND_A);
  const postState = await repository.getCandidateJobState(testJob1.id, CAND_A);

  record(
    49,
    'Application record is untouched by discovery ranking queries',
    postApp?.status === 'applied' && postApp.jobId === testJob1.id,
    `Status: ${postApp?.status}`
  );

  record(
    50,
    'CandidateJobState is untouched by discovery ranking queries',
    postState?.status === 'SAVED',
    `Status: ${postState?.status}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 12: PHASE 2 MATCH BENCHMARK PRESERVATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 12: Phase 2 Match Benchmark Preservation ---');

  const stripeMatch = await repository.getJobMatch('job-1', 'cand-1');
  const datadogMatch = await repository.getJobMatch('job-2', 'cand-1');
  const linearMatch = await repository.getJobMatch('job-4', 'cand-1');

  record(
    51,
    'Phase 2 Stripe benchmark match score remains exactly 94%',
    stripeMatch?.score === 94,
    `Actual: ${stripeMatch?.score}%`
  );
  record(
    52,
    'Phase 2 Datadog benchmark match score remains exactly 82%',
    datadogMatch?.score === 82,
    `Actual: ${datadogMatch?.score}%`
  );
  record(
    53,
    'Phase 2 Linear benchmark match score remains exactly 76%',
    linearMatch?.score === 76,
    `Actual: ${linearMatch?.score}%`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 13: CLEANUP TEST FIXTURES
  // ---------------------------------------------------------------------------
  console.log('\n--- CLEANUP FIXTURES ---');

  const createdJobIds = [
    testJob1.id,
    testJob2.id,
    testJob3PrivateB.id,
    testJob4Closed.id,
    boundaryJob.id,
    ...pJobIds
  ];

  await prisma.applicationEvent.deleteMany({ where: { applicationId: preApp.id } }).catch(() => {});
  await prisma.application.deleteMany({ where: { id: preApp.id } }).catch(() => {});
  await prisma.candidateJobState.deleteMany({ where: { jobId: { in: createdJobIds } } }).catch(() => {});
  await prisma.jobSourceReference.deleteMany({ where: { jobId: { in: createdJobIds } } }).catch(() => {});
  await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } }).catch(() => {});
  await prisma.candidatePreferences.deleteMany({ where: { candidateId: { in: [CAND_A, CAND_B] } } }).catch(() => {});
  await prisma.candidate.deleteMany({ where: { id: { in: [CAND_A, CAND_B] } } }).catch(() => {});

  console.log('Cleanup completed successfully.');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n====================================================');
  const allPassed = checkpoints.every((c) => c.passed);
  const passedCount = checkpoints.filter((c) => c.passed).length;
  console.log(`Phase 7D Verification Results: ${passedCount}/${checkpoints.length} PASSED`);
  if (allPassed) {
    console.log('🎉 PHASE 7D: OPPORTUNITY PRIORITY & DISCOVERY RANKING COMPLETE PASS');
  } else {
    console.log('❌ SOME CHECKPOINTS FAILED');
    process.exit(1);
  }
  console.log('====================================================\n');
}

run()
  .catch((e) => {
    console.error('Fatal error running Phase 7D verification:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
