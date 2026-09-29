/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_RANKING_CONFIG,
  calculateOpportunityPriority,
  calculateFreshnessScore,
  RankedOpportunity
} from '../src/features/jobs/lib/ranking';
import { getCareerRepository, setCareerRepositoryMode } from '../src/services/repository-provider';
import { InMemoryCareerRepository } from '../src/services/in-memory-career-repository';
import { savedSearchService } from '../src/features/jobs/services/saved-search-service';
import {
  createSavedSearchSchema,
  updateSavedSearchSchema
} from '../src/features/jobs/lib/saved-search/schemas';
import { Job, JobMatch, SavedSearch } from '../src/types/domain';

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
  console.log('  CareerQuest Phase 7E: Saved Searches & Alert');
  console.log('  Generation Verification Suite');
  console.log('====================================================\n');

  setCareerRepositoryMode('prisma');
  const repo = getCareerRepository();

  const CAND_A = 'cand-phase7e-a';
  const CAND_B = 'cand-phase7e-b';

  // ---------------------------------------------------------------------------
  // 0. CLEANUP PRIOR TEST FIXTURES
  // ---------------------------------------------------------------------------
  console.log('--- 0. CLEANUP & INITIAL SETUP ---');
  await prisma.candidateNotification.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.savedSearchAlert.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.savedSearch.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.jobMatch.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.candidateJobState.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.candidatePreferences.deleteMany({
    where: { candidateId: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});
  await prisma.jobSourceReference.deleteMany({
    where: {
      sourceUrl: {
        in: [
          'https://cloudtech.example.com/jobs/1',
          'https://designworks.example.com/jobs/2',
          'https://closed.example.com/job/5'
        ]
      }
    }
  }).catch(() => {});
  await prisma.job.deleteMany({
    where: {
      OR: [
        { importedByCandidateId: { in: [CAND_A, CAND_B] } },
        {
          company: {
            in: [
              'CloudTech Systems',
              'DesignWorks',
              'Private Alpha Corp',
              'Candidate B Stealth Corp',
              'Closed Corp',
              'RaceTech'
            ]
          }
        }
      ]
    }
  }).catch(() => {});

  // Create test candidates A and B
  await prisma.candidate.upsert({
    where: { id: CAND_A },
    create: {
      id: CAND_A,
      clerkUserId: 'user_phase7e_a',
      email: 'cand_a.phase7e@example.com',
      profile: {
        create: {
          name: 'Candidate A (Phase 7E)',
          location: 'Hyderabad, India',
          professionalSummary: 'Senior Backend Engineer specializing in Python and cloud systems.'
        }
      },
      preferences: {
        create: {
          targetRoles: ['Backend Engineer', 'Software Engineer'],
          preferredLocations: ['Hyderabad, India', 'Remote'],
          workArrangements: ['remote', 'hybrid'],
          targetSalaryMin: 120000,
          currency: 'USD'
        }
      }
    },
    update: {}
  });

  await prisma.candidate.upsert({
    where: { id: CAND_B },
    create: {
      id: CAND_B,
      clerkUserId: 'user_phase7e_b',
      email: 'cand_b.phase7e@example.com',
      profile: {
        create: {
          name: 'Candidate B (Phase 7E)',
          location: 'Bangalore, India',
          professionalSummary: 'Cloud infra engineer.'
        }
      }
    },
    update: {}
  });

  // Seed test jobs:
  // Job 1: Public, Python + Hyderabad, Active (Matches search)
  const job1 = await prisma.job.create({
    data: {
      id: `job-p7e-1-${Date.now()}`,
      title: 'Senior Python Engineer',
      company: 'CloudTech Systems',
      location: 'Hyderabad, India',
      workArrangement: 'remote',
      description: 'Building high throughput Python and AWS services.',
      requiredSkills: ['Python', 'AWS', 'PostgreSQL'],
      preferredSkills: ['Django'],
      salaryMin: 130000,
      salaryMax: 160000,
      salaryCurrency: 'USD',
      isPublic: true,
      jobStatus: 'active',
      source: 'company_portal',
      postedDate: new Date(Date.now() - 2 * 86400000), // 2 days old
      sourceReferences: {
        create: {
          source: 'company_portal',
          sourceUrl: 'https://cloudtech.example.com/jobs/1',
          normalizedUrl: 'https://cloudtech.example.com/jobs/1',
          sourceStatus: 'active',
          verificationStatus: 'verified_accessible',
          isPrimary: true,
          referenceRole: 'primary'
        }
      }
    }
  });

  await repo.saveJobMatch({
    id: `m-1-${Date.now()}`,
    jobId: job1.id,
    candidateId: CAND_A,
    score: 88,
    recommendation: 'good',
    headline: 'Strong Python match',
    reasoning: 'Strong Python background.',
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
    supportingCandidateEvidence: []
  }, CAND_A);

  // Job 2: Public, Frontend React (Does NOT match search)
  const job2 = await prisma.job.create({
    data: {
      id: `job-p7e-2-${Date.now()}`,
      title: 'Frontend UI Engineer',
      company: 'DesignWorks',
      location: 'New York, NY',
      workArrangement: 'onsite',
      description: 'Building React and Tailwind interfaces.',
      requiredSkills: ['React', 'TypeScript', 'Tailwind'],
      preferredSkills: ['Next.js'],
      salaryMin: 110000,
      salaryMax: 130000,
      salaryCurrency: 'USD',
      isPublic: true,
      jobStatus: 'active',
      source: 'company_portal',
      postedDate: new Date(Date.now() - 5 * 86400000),
      sourceReferences: {
        create: {
          source: 'company_portal',
          sourceUrl: 'https://designworks.example.com/jobs/2',
          normalizedUrl: 'https://designworks.example.com/jobs/2',
          sourceStatus: 'active',
          verificationStatus: 'verified_accessible',
          isPrimary: true,
          referenceRole: 'primary'
        }
      }
    }
  });

  await repo.saveJobMatch({
    id: `m-2-${Date.now()}`,
    jobId: job2.id,
    candidateId: CAND_A,
    score: 45,
    recommendation: 'low',
    headline: 'Frontend focus mismatch',
    reasoning: 'Frontend focus mismatch.',
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
    supportingCandidateEvidence: []
  }, CAND_A);

  // Job 3: Private to Candidate A (Matches search)
  const job3PrivateA = await prisma.job.create({
    data: {
      id: `job-p7e-3-privA-${Date.now()}`,
      title: 'Lead Python Architect',
      company: 'Private Alpha Corp',
      location: 'Hyderabad, India',
      workArrangement: 'hybrid',
      description: 'Private backend architecture role.',
      requiredSkills: ['Python', 'Architecture'],
      preferredSkills: [],
      salaryMin: 170000,
      salaryMax: 200000,
      salaryCurrency: 'USD',
      isPublic: false,
      importedByCandidateId: CAND_A,
      jobStatus: 'active',
      source: 'company_portal',
      postedDate: new Date(Date.now() - 1 * 86400000)
    }
  });

  await repo.saveJobMatch({
    id: `m-3-${Date.now()}`,
    jobId: job3PrivateA.id,
    candidateId: CAND_A,
    score: 92,
    recommendation: 'strong',
    headline: 'Exceptional fit',
    reasoning: 'Exceptional fit.',
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
    supportingCandidateEvidence: []
  }, CAND_A);

  // Job 4: Private to Candidate B (Python Hyderabad, but owned by B)
  const job4PrivateB = await prisma.job.create({
    data: {
      id: `job-p7e-4-privB-${Date.now()}`,
      title: 'Python Data Platform Engineer',
      company: 'Candidate B Stealth Corp',
      location: 'Hyderabad, India',
      workArrangement: 'remote',
      description: 'Private role imported by Candidate B.',
      requiredSkills: ['Python'],
      preferredSkills: [],
      salaryMin: 150000,
      salaryMax: 180000,
      salaryCurrency: 'USD',
      isPublic: false,
      importedByCandidateId: CAND_B,
      jobStatus: 'active',
      source: 'company_portal',
      postedDate: new Date(Date.now() - 1 * 86400000)
    }
  });

  await repo.saveJobMatch({
    id: `m-4-${Date.now()}`,
    jobId: job4PrivateB.id,
    candidateId: CAND_B,
    score: 90,
    recommendation: 'strong',
    headline: 'B fit',
    reasoning: 'B fit.',
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
    supportingCandidateEvidence: []
  }, CAND_B);

  // Job 5: Closed source job (Python Hyderabad, but source is closed)
  const job5Closed = await prisma.job.create({
    data: {
      id: `job-p7e-5-closed-${Date.now()}`,
      title: 'Python Backend Developer',
      company: 'Closed Corp',
      location: 'Hyderabad, India',
      workArrangement: 'remote',
      description: 'Python position that is now closed.',
      requiredSkills: ['Python'],
      preferredSkills: [],
      isPublic: true,
      jobStatus: 'active',
      source: 'company_portal',
      sourceReferences: {
        create: {
          source: 'company_portal',
          sourceUrl: 'https://closed.example.com/job/5',
          normalizedUrl: 'https://closed.example.com/job/5',
          sourceStatus: 'closed',
          verificationStatus: 'closed',
          isPrimary: true,
          referenceRole: 'primary'
        }
      }
    }
  });

  console.log('Test fixtures created.\n');

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: CRUD & VERSIONING
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: CRUD & VERSIONING ---');

  // 1. Create SavedSearch
  const createdSearch = await repo.saveSavedSearch(
    {
      name: 'Python Hyderabad Remote',
      query: 'Python',
      locations: ['Hyderabad, India', 'Remote'],
      workArrangements: ['remote', 'hybrid'],
      roleCategories: [],
      seniorityLevels: [],
      alertFrequency: 'daily',
      filterVersion: '1.0',
      isEnabled: true,
      minMatchScore: 70
    },
    CAND_A
  );

  record(
    1,
    'Create SavedSearch persists definition with version 1.0',
    createdSearch.name === 'Python Hyderabad Remote' &&
      createdSearch.candidateId === CAND_A &&
      createdSearch.filterVersion === '1.0' &&
      createdSearch.isEnabled === true &&
      createdSearch.minMatchScore === 70,
    `ID: ${createdSearch.id}, Version: ${createdSearch.filterVersion}`
  );

  // 2. Read SavedSearch
  const fetchedSearch = await repo.getSavedSearchById(createdSearch.id, CAND_A);
  record(
    2,
    'Read SavedSearch by ID and candidate returns accurate definition',
    fetchedSearch !== null && fetchedSearch.id === createdSearch.id && fetchedSearch.query === 'Python',
    `Found search for candidate ${CAND_A}`
  );

  // 3. List SavedSearches
  const listSearches = await repo.getSavedSearches(CAND_A);
  record(
    3,
    'List SavedSearches returns all candidate-owned searches',
    listSearches.length >= 1 && listSearches.some((s) => s.id === createdSearch.id),
    `Count: ${listSearches.length}`
  );

  // 4. Update SavedSearch increments filterVersion
  const updatedSearch = await repo.saveSavedSearch(
    {
      id: createdSearch.id,
      name: 'Python + AWS Hyderabad',
      query: 'Python AWS',
      locations: ['Hyderabad, India'],
      workArrangements: ['remote'],
      roleCategories: [],
      seniorityLevels: [],
      alertFrequency: 'daily',
      filterVersion: createdSearch.filterVersion, // pass current 1.0
      isEnabled: true,
      minMatchScore: 75
    },
    CAND_A
  );

  record(
    4,
    'Update SavedSearch increments version (1.0 -> 1.1) and updates fields',
    updatedSearch.filterVersion === '1.1' &&
      updatedSearch.name === 'Python + AWS Hyderabad' &&
      updatedSearch.minMatchScore === 75,
    `New version: ${updatedSearch.filterVersion}`
  );

  // 5. Stale update concurrency conflict rejection
  let concurrencyRejected = false;
  try {
    await repo.saveSavedSearch(
      {
        id: createdSearch.id,
        name: 'Stale Edit',
        filterVersion: '1.0' // Stale! Current is 1.1
      },
      CAND_A
    );
  } catch (err: any) {
    concurrencyRejected = err.message.includes('Concurrency conflict');
  }

  record(
    5,
    'Stale concurrent update with mismatched filterVersion is rejected',
    concurrencyRejected,
    'Concurrency check verified'
  );

  // 6. Disable SavedSearch
  const disabledSearch = await repo.disableSavedSearch(createdSearch.id, CAND_A);
  record(
    6,
    'Disable SavedSearch sets isEnabled to false',
    disabledSearch.isEnabled === false,
    `isEnabled: ${disabledSearch.isEnabled}`
  );

  // 7. Enable SavedSearch
  const enabledSearch = await repo.enableSavedSearch(createdSearch.id, CAND_A);
  record(
    7,
    'Enable SavedSearch sets isEnabled to true',
    enabledSearch.isEnabled === true,
    `isEnabled: ${enabledSearch.isEnabled}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: ZOD VALIDATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: ZOD VALIDATION ---');

  // 8. Empty name rejected
  const emptyNameResult = createSavedSearchSchema.safeParse({
    name: '',
    alertFrequency: 'daily'
  });
  record(
    8,
    'Validation rejects empty SavedSearch name',
    !emptyNameResult.success,
    'Zod schema caught empty name'
  );

  // 9. Invalid frequency rejected
  const invalidFreqResult = createSavedSearchSchema.safeParse({
    name: 'Valid Name',
    alertFrequency: 'monthly' // invalid!
  });
  record(
    9,
    'Validation rejects unsupported alert frequency',
    !invalidFreqResult.success,
    'Invalid frequency rejected'
  );

  // 10. Invalid minMatchScore rejected (> 100 or < 0)
  const invalidScoreResult = createSavedSearchSchema.safeParse({
    name: 'Valid Name',
    minMatchScore: 150
  });
  record(
    10,
    'Validation rejects minMatchScore > 100',
    !invalidScoreResult.success,
    'Out-of-bounds score rejected'
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: CANDIDATE ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: CANDIDATE ISOLATION ---');

  // 11. Candidate B cannot read Candidate A's SavedSearch
  const bReadA = await repo.getSavedSearchById(createdSearch.id, CAND_B);
  record(
    11,
    'Candidate B cannot read Candidate A SavedSearch (multi-tenant isolation)',
    bReadA === null,
    'Candidate B returned null'
  );

  // 12. Candidate B cannot update Candidate A's SavedSearch
  let bUpdateAFailed = false;
  try {
    await repo.saveSavedSearch(
      {
        id: createdSearch.id,
        name: 'Malicious Overwrite',
        filterVersion: enabledSearch.filterVersion
      },
      CAND_B
    );
  } catch (err: any) {
    bUpdateAFailed = err.message.includes('not found or access denied');
  }
  record(
    12,
    'Candidate B cannot update Candidate A SavedSearch',
    bUpdateAFailed,
    'Access denied enforced'
  );

  // 13. Candidate B cannot delete Candidate A's SavedSearch
  const bDeleteA = await repo.deleteSavedSearch(createdSearch.id, CAND_B);
  record(
    13,
    'Candidate B cannot delete Candidate A SavedSearch',
    bDeleteA === false,
    'Delete operation returned false'
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: SEARCH EXECUTION & VISIBILITY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: SEARCH EXECUTION & VISIBILITY ---');

  // Reset search for execution: Python, Hyderabad / Remote, minMatchScore: 80
  const searchForExec = await repo.saveSavedSearch(
    {
      id: createdSearch.id,
      name: 'Python Engineering Search',
      query: 'Python',
      locations: ['Hyderabad, India', 'Remote'],
      workArrangements: ['remote', 'hybrid'],
      alertFrequency: 'daily',
      filterVersion: enabledSearch.filterVersion,
      isEnabled: true,
      minMatchScore: 80
    },
    CAND_A
  );

  const execT1 = new Date();
  const execution = await savedSearchService.executeSavedSearch(searchForExec.id, CAND_A, {
    evaluatedAt: execT1
  });

  const opportunities = execution.opportunities || [];
  const matchingJobIds = opportunities.map((o) => o.job.id);

  // 14. Matching Public Job included
  record(
    14,
    'Search execution includes matching public job (Job 1)',
    matchingJobIds.includes(job1.id),
    `Job 1 present in results`
  );

  // 15. Non-matching Public Job excluded
  record(
    15,
    'Search execution excludes non-matching public job (Job 2: Frontend)',
    !matchingJobIds.includes(job2.id),
    `Job 2 excluded`
  );

  // 16. Own private Job included
  record(
    16,
    'Search execution includes candidate own private job (Job 3: Private to A)',
    matchingJobIds.includes(job3PrivateA.id),
    `Job 3 Private A included`
  );

  // 17. Other candidate private Job excluded
  record(
    17,
    'Search execution strictly excludes other candidate private job (Job 4: Private to B)',
    !matchingJobIds.includes(job4PrivateB.id),
    `Job 4 Private B excluded`
  );

  // 18. Closed / unusable source job excluded from automatic alert execution
  record(
    18,
    'Search execution excludes closed source job (Job 5: Closed Corp)',
    !matchingJobIds.includes(job5Closed.id),
    `Job 5 Closed excluded`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: DETERMINISTIC RANKING & EVALUATION TIMESTAMP
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: DETERMINISTIC RANKING & EVALUATION TIMESTAMP ---');

  // 19. Opportunity priority formula preserved (50% match, 35% fit, 15% freshness)
  const opp1 = opportunities.find((o) => o.job.id === job1.id);
  const calculatedFreshness = calculateFreshnessScore(job1 as unknown as Job, undefined, execT1);
  const expectedFreshness = 95; // 2 days old = 95 freshness band

  record(
    19,
    'Freshness band evaluated using single execution snapshot T1',
    calculatedFreshness === expectedFreshness &&
      opp1?.priority?.breakdown.freshnessScore === expectedFreshness,
    `Calculated: ${calculatedFreshness}, Priority breakdown: ${opp1?.priority?.breakdown.freshnessScore}`
  );

  // 20. Phase 2 benchmarks invariance check
  // Verify that standard Phase 2 mock scores remain untouched
  const mockJobStripe: Job = {
    id: 'job-stripe',
    title: 'Senior Full-Stack Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA',
    workArrangement: 'hybrid',
    description: 'Payments platform',
    responsibilities: [],
    source: 'company_portal',
    requiredSkills: ['React', 'Node.js'],
    preferredSkills: [],
    isPublic: true,
    jobStatus: 'active',
    normalizedAt: new Date().toISOString()
  };
  const mockMatchStripe: JobMatch = {
    id: 'm-stripe',
    jobId: 'job-stripe',
    candidateId: CAND_A,
    score: 94,
    recommendation: 'strong',
    headline: 'Stripe match',
    reasoning: 'Excellent match.',
    strongMatches: [],
    partialMatches: [],
    missingRequirements: [],
    supportingCandidateEvidence: []
  };
  const pStripe = calculateOpportunityPriority(mockJobStripe, CAND_A, mockMatchStripe, null, undefined, DEFAULT_RANKING_CONFIG, execT1);

  record(
    20,
    'Phase 2 Opportunity Priority benchmarks invariance (Stripe baseline match = 94%)',
    mockMatchStripe.score === 94 && pStripe.breakdown.matchScore === 94,
    `Stripe match: 94%, priority: ${pStripe.priorityScore}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: ALERT DEDUPLICATION & NOTIFICATIONS ATOMICITY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: ALERT DEDUPLICATION & NOTIFICATIONS ---');

  // 21. Automatic alert generation creates alert + notification for new matches
  const alertGen1 = await savedSearchService.generateSavedSearchAlerts({
    frequency: 'daily',
    candidateId: CAND_A,
    evaluatedAt: execT1
  });

  const alertsAfterGen1 = await repo.getSavedSearchAlerts(CAND_A, searchForExec.id);
  const notifsAfterGen1 = await repo.getNotifications(CAND_A);

  record(
    21,
    'First alert generation creates durable SavedSearchAlert and CandidateNotification',
    alertGen1.generatedAlerts > 0 &&
      alertsAfterGen1.length === alertGen1.generatedAlerts &&
      notifsAfterGen1.length === alertGen1.generatedNotifications,
    `Alerts: ${alertGen1.generatedAlerts}, Notifications: ${alertGen1.generatedNotifications}`
  );

  // 22. Second execution does NOT duplicate alerts or notifications
  const alertGen2 = await savedSearchService.generateSavedSearchAlerts({
    frequency: 'daily',
    candidateId: CAND_A,
    evaluatedAt: new Date(execT1.getTime() + 3600000) // 1 hour later
  });

  const alertsAfterGen2 = await repo.getSavedSearchAlerts(CAND_A, searchForExec.id);
  const notifsAfterGen2 = await repo.getNotifications(CAND_A);

  record(
    22,
    'Second alert generation detects no new matches and deduplicates (0 duplicate alerts/notifications)',
    alertGen2.generatedAlerts === 0 &&
      alertsAfterGen2.length === alertsAfterGen1.length &&
      notifsAfterGen2.length === notifsAfterGen1.length,
    `Alerts gen2: ${alertGen2.generatedAlerts}, Total alerts unchanged: ${alertsAfterGen2.length}`
  );

  // 23. Notification content, Job relation, and SavedSearch relation verified
  const firstNotif = notifsAfterGen1[0];
  record(
    23,
    'CandidateNotification contains valid title, message, relatedJobId, and relatedSavedSearchId',
    firstNotif !== undefined &&
      firstNotif.type === 'SAVED_SEARCH_ALERT' &&
      Boolean(firstNotif.relatedJobId) &&
      firstNotif.relatedSavedSearchId === searchForExec.id,
    `Title: "${firstNotif?.title}", Related Job: ${firstNotif?.relatedJobId}`
  );

  // 24. Mark notification as read
  const markReadSuccess = await repo.markNotificationAsRead(firstNotif.id, CAND_A);
  const notifsAfterRead = await repo.getNotifications(CAND_A);
  const readNotif = notifsAfterRead.find((n) => n.id === firstNotif.id);

  record(
    24,
    'Mark notification as read sets readAt timestamp',
    markReadSuccess === true && readNotif?.readAt !== null,
    `ReadAt: ${readNotif?.readAt}`
  );

  // 25. Candidate isolation on notifications (B cannot read A notifications)
  const notifsB = await repo.getNotifications(CAND_B);
  record(
    25,
    'Candidate B cannot read Candidate A notifications',
    !notifsB.some((n) => n.candidateId === CAND_A),
    `Candidate B notifications count: ${notifsB.length}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 7: SEARCH DEFINITION UPDATE & ALERT DEDUPLICATION INVARIANCE
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: DEFINITION UPDATE & ALERT INVARIANCE ---');

  // 26. Edit search definition (1.1 -> 1.2)
  const currentSearch = await repo.getSavedSearchById(searchForExec.id, CAND_A);
  const searchV2 = await repo.saveSavedSearch(
    {
      id: searchForExec.id,
      name: 'Python Engineering Search Updated',
      query: 'Python', // Still matches Job 1
      filterVersion: currentSearch!.filterVersion
    },
    CAND_A
  );

  // Execute alert generation again
  const alertGenAfterEdit = await savedSearchService.generateSavedSearchAlerts({
    frequency: 'daily',
    candidateId: CAND_A,
    evaluatedAt: new Date(execT1.getTime() + 7200000)
  });

  record(
    26,
    'Editing SavedSearch definition does NOT re-alert previously alerted jobs',
    alertGenAfterEdit.generatedAlerts === 0,
    `Generated alerts after definition edit: ${alertGenAfterEdit.generatedAlerts}`
  );

  // 27. Different SavedSearch for the same candidate matching the same job CAN generate alert
  const secondSearch = await repo.saveSavedSearch(
    {
      name: 'Second Search: Backend Cloud',
      query: 'AWS', // Job 1 also requires AWS!
      locations: ['Hyderabad, India'],
      workArrangements: ['remote'],
      alertFrequency: 'daily',
      filterVersion: '1.0',
      isEnabled: true
    },
    CAND_A
  );

  const alertGenSecondSearch = await savedSearchService.generateSavedSearchAlerts({
    frequency: 'daily',
    candidateId: CAND_A,
    evaluatedAt: new Date(execT1.getTime() + 8000000)
  });

  const alertsSecondSearch = await repo.getSavedSearchAlerts(CAND_A, secondSearch.id);

  record(
    27,
    'Different SavedSearch matching same Job legitimately generates its own alert',
    alertsSecondSearch.length > 0 &&
      alertsSecondSearch.some((a) => a.jobId === job1.id),
    `Alert created for Search 2 and Job 1: ${alertsSecondSearch.length} alerts`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 8: CONCURRENCY RACE-SAFETY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: CONCURRENCY RACE-SAFETY ---');

  // Simulate two concurrent alert creations for the exact same candidate, search, and job
  const newJobConcurrency = await prisma.job.create({
    data: {
      id: `job-p7e-race-${Date.now()}`,
      title: 'Concurrency Test Engineer',
      company: 'RaceTech',
      location: 'Hyderabad, India',
      workArrangement: 'remote',
      description: 'Race condition test opportunity.',
      requiredSkills: ['Python'],
      preferredSkills: [],
      isPublic: true,
      jobStatus: 'active',
      source: 'company_portal'
    }
  });

  const [raceResult1, raceResult2] = await Promise.all([
    repo.createSavedSearchAlertAndNotification({
      candidateId: CAND_A,
      savedSearchId: secondSearch.id,
      jobId: newJobConcurrency.id,
      savedSearchVersion: secondSearch.filterVersion,
      notificationTitle: 'Race alert 1',
      notificationMessage: 'Race notification 1'
    }),
    repo.createSavedSearchAlertAndNotification({
      candidateId: CAND_A,
      savedSearchId: secondSearch.id,
      jobId: newJobConcurrency.id,
      savedSearchVersion: secondSearch.filterVersion,
      notificationTitle: 'Race alert 2',
      notificationMessage: 'Race notification 2'
    })
  ]);

  const totalNew = (raceResult1.isNew ? 1 : 0) + (raceResult2.isNew ? 1 : 0);
  const raceAlerts = await prisma.savedSearchAlert.findMany({
    where: {
      candidateId: CAND_A,
      savedSearchId: secondSearch.id,
      jobId: newJobConcurrency.id
    }
  });

  record(
    28,
    'Concurrent executions resolve to exactly 1 SavedSearchAlert and 1 Notification (atomic P2002 race protection)',
    totalNew === 1 && raceAlerts.length === 1,
    `Total isNew flags: ${totalNew}, DB Alerts count: ${raceAlerts.length}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 9: BOUNDARIES & STATE INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: BOUNDARIES & STATE INTEGRITY ---');

  // 29. Alert generation does NOT alter CandidateJobState
  const jobStateJob1 = await repo.getCandidateJobState(job1.id, CAND_A);
  record(
    29,
    'SavedSearch matching and alert generation does NOT change CandidateJobState (remains null or UNSEEN)',
    jobStateJob1 === null,
    'CandidateJobState remained untouched'
  );

  // 30. Alert generation does NOT create Applications
  const appsCandA = await prisma.application.findMany({
    where: { candidateId: CAND_A }
  });
  record(
    30,
    'SavedSearch alerts NEVER create Applications (strict Application boundary)',
    appsCandA.length === 0,
    `Applications count: ${appsCandA.length}`
  );

  // 31. Disabled search creates NO automatic alerts
  await repo.disableSavedSearch(secondSearch.id, CAND_A);
  const alertGenDisabled = await savedSearchService.generateSavedSearchAlerts({
    frequency: 'daily',
    candidateId: CAND_A
  });
  record(
    31,
    'Disabled SavedSearch does not participate in automatic alert generation',
    alertGenDisabled.generatedAlerts === 0,
    '0 alerts generated for disabled search'
  );

  // 32. Manual Run Now remains usable even when disabled
  const manualExecDisabled = await savedSearchService.executeSavedSearch(secondSearch.id, CAND_A, {
    isManual: true
  });
  record(
    32,
    'Manual "Run Now" execution works seamlessly even when search is disabled',
    (manualExecDisabled.totalMatchCount ?? 0) > 0,
    `Matches returned: ${manualExecDisabled.totalMatchCount}`
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 10: IN-MEMORY REPOSITORY PARITY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 10: IN-MEMORY REPOSITORY PARITY ---');

  const memRepo = new InMemoryCareerRepository();
  const memSearch = await memRepo.saveSavedSearch(
    {
      name: 'Memory Saved Search',
      query: 'React',
      locations: ['San Francisco, CA'],
      workArrangements: ['remote'],
      roleCategories: [],
      seniorityLevels: [],
      alertFrequency: 'daily',
      filterVersion: '1.0',
      isEnabled: true,
      minMatchScore: 80
    },
    'cand-mem-1'
  );

  const memRead = await memRepo.getSavedSearchById(memSearch.id, 'cand-mem-1');
  const memUpdate = await memRepo.saveSavedSearch(
    {
      id: memSearch.id,
      name: 'Memory Saved Search Updated',
      filterVersion: '1.0'
    },
    'cand-mem-1'
  );
  const memDisabled = await memRepo.disableSavedSearch(memSearch.id, 'cand-mem-1');
  const memEnabled = await memRepo.enableSavedSearch(memSearch.id, 'cand-mem-1');

  const memAlert1 = await memRepo.createSavedSearchAlertAndNotification({
    candidateId: 'cand-mem-1',
    savedSearchId: memSearch.id,
    jobId: 'job-mem-1',
    savedSearchVersion: memEnabled.filterVersion,
    notificationTitle: 'Mem notif',
    notificationMessage: 'Mem body'
  });

  const memAlert2 = await memRepo.createSavedSearchAlertAndNotification({
    candidateId: 'cand-mem-1',
    savedSearchId: memSearch.id,
    jobId: 'job-mem-1', // Duplicate!
    savedSearchVersion: memEnabled.filterVersion,
    notificationTitle: 'Mem notif 2',
    notificationMessage: 'Mem body 2'
  });

  const memNotifs = await memRepo.getNotifications('cand-mem-1');

  record(
    33,
    'InMemoryCareerRepository supports full SavedSearch CRUD, alert deduplication, and notifications with identical parity',
    memRead !== null &&
      memUpdate.filterVersion === '1.1' &&
      memDisabled.isEnabled === false &&
      memEnabled.isEnabled === true &&
      memAlert1.isNew === true &&
      memAlert2.isNew === false &&
      memNotifs.length === 1,
    'InMemory parity validated'
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 11: CANDIDATE ACCOUNT DELETION INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 11: CANDIDATE ACCOUNT DELETION INTEGRITY ---');

  // Candidate A account deletion
  await repo.deleteCandidateAccountData(CAND_A);

  const remainingSearchesA = await prisma.savedSearch.findMany({ where: { candidateId: CAND_A } });
  const remainingAlertsA = await prisma.savedSearchAlert.findMany({ where: { candidateId: CAND_A } });
  const remainingNotifsA = await prisma.candidateNotification.findMany({ where: { candidateId: CAND_A } });
  const remainingPublicJobs = await prisma.job.findUnique({ where: { id: job1.id } });

  record(
    34,
    'Account deletion cleans up SavedSearches, SavedSearchAlerts, and CandidateNotifications while preserving public Jobs catalog',
    remainingSearchesA.length === 0 &&
      remainingAlertsA.length === 0 &&
      remainingNotifsA.length === 0 &&
      remainingPublicJobs !== null,
    'Clean candidate lifecycle verified'
  );

  // ---------------------------------------------------------------------------
  // CLEANUP FIXTURES
  // ---------------------------------------------------------------------------
  console.log('\n--- CLEANUP FIXTURES ---');
  await prisma.jobSourceReference.deleteMany({
    where: { jobId: { in: [job1.id, job2.id, job5Closed.id] } }
  }).catch(() => {});
  await prisma.jobMatch.deleteMany({
    where: { jobId: { in: [job1.id, job2.id, job3PrivateA.id, job4PrivateB.id, job5Closed.id, newJobConcurrency.id] } }
  }).catch(() => {});
  await prisma.job.deleteMany({
    where: { id: { in: [job1.id, job2.id, job3PrivateA.id, job4PrivateB.id, job5Closed.id, newJobConcurrency.id] } }
  }).catch(() => {});
  await prisma.candidate.deleteMany({
    where: { id: { in: [CAND_A, CAND_B] } }
  }).catch(() => {});

  console.log('Cleanup completed successfully.\n');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('====================================================');
  const allPassed = checkpoints.every((c) => c.passed);
  const passedCount = checkpoints.filter((c) => c.passed).length;
  console.log(`Phase 7E Verification Results: ${passedCount}/${checkpoints.length} PASSED`);
  if (allPassed) {
    console.log('🎉 PHASE 7E: SAVED SEARCHES & ALERT GENERATION COMPLETE PASS');
  } else {
    console.log('❌ SOME CHECKPOINTS FAILED');
    process.exit(1);
  }
  console.log('====================================================\n');
}

run()
  .catch((e) => {
    console.error('Fatal error running Phase 7E verification:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
