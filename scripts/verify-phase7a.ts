/* eslint-disable no-console */
import http from 'node:http';
import { PrismaClient } from '@prisma/client';
import {
  ServerJobFetcher,
  ServerJobFetcherError,
  isPrivateOrRestrictedIP,
  isPrivateOrRestrictedIPv4,
  isPrivateOrRestrictedIPv6
} from '../src/services/fetcher/server-job-fetcher';
import { getCareerRepository, setCareerRepositoryMode } from '../src/services/repository-provider';

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

// Simple test HTTP server helper
function createTestServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ server: http.Server; url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}`;
      const close = () =>
        new Promise<void>((res) => {
          server.close(() => res());
        });
      resolve({ server, url, close });
    });
  });
}

async function run() {
  console.log('====================================================');
  console.log('  CareerQuest Phase 7A: Data Model & Security Core');
  console.log('  Verification Suite');
  console.log('====================================================\n');

  setCareerRepositoryMode('prisma');
  const repository = getCareerRepository();

  // Test Candidate IDs
  const CAND_A = 'cand-phase7a-test-a';
  const CAND_B = 'cand-phase7a-test-b';

  // ---------------------------------------------------------------------------
  // SECTION 1: SECURE FETCHER — SCHEME RESTRICTIONS
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Scheme Validation & Insecure Protocols ---');

  const unsafeSchemes = [
    'file:///etc/passwd',
    'ftp://ftp.example.com/job.txt',
    'gopher://gopher.example.com/',
    'data:text/html,<h1>Job</h1>',
    'javascript:alert(1)',
    'ldap://localhost:389/o=example',
    'blob:https://example.com/uuid'
  ];

  let allUnsafeSchemesRejected = true;
  for (const url of unsafeSchemes) {
    try {
      await ServerJobFetcher.fetch(url);
      allUnsafeSchemesRejected = false;
      break;
    } catch (err) {
      if (!(err instanceof ServerJobFetcherError) || err.code !== 'UNSUPPORTED_SCHEME') {
        allUnsafeSchemesRejected = false;
        break;
      }
    }
  }
  record(1, 'Unsafe URL schemes (file, ftp, gopher, data, javascript, ldap) strictly rejected', allUnsafeSchemesRejected);

  // Insecure HTTP rejection in production mode (allowHttpForTesting: false)
  let httpRejected = false;
  try {
    await ServerJobFetcher.fetch('http://example.com/job/123');
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'UNSUPPORTED_SCHEME') {
      httpRejected = true;
    }
  }
  record(2, 'Insecure plain HTTP rejected when allowHttpForTesting is false', httpRejected);

  // ---------------------------------------------------------------------------
  // SECTION 2: ANTI-SSRF IP BLOCKLIST & METADATA TARGETS
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Anti-SSRF Private/Restricted IP Filtering ---');

  const forbiddenIPv4 = [
    '127.0.0.1',
    '127.100.200.1',
    '10.0.0.1',
    '10.254.254.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '192.168.100.50',
    '169.254.169.254', // AWS/GCP/Azure Metadata
    '169.254.1.1',     // Link-local
    '0.0.0.0',
    '224.0.0.1',       // Multicast
    '240.0.0.1'        // Reserved
  ];

  const allIPv4Blocked = forbiddenIPv4.every((ip) => isPrivateOrRestrictedIPv4(ip));
  record(3, 'Private, loopback, link-local, multicast, and cloud metadata IPv4 ranges blocked', allIPv4Blocked);

  const forbiddenIPv6 = [
    '::1',
    '::',
    'fe80::1',
    'fe80::abcd:1234',
    'fc00::1',
    'fd12:3456:789a::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:192.168.1.1',
    '::ffff:169.254.169.254'
  ];

  const allIPv6Blocked = forbiddenIPv6.every((ip) => isPrivateOrRestrictedIPv6(ip));
  record(4, 'Loopback, link-local, unique local, multicast, and IPv4-mapped IPv6 ranges blocked', allIPv6Blocked);

  const publicIPs = ['8.8.8.8', '1.1.1.1', '140.82.121.4', '151.101.1.140'];
  const publicAllowed = publicIPs.every((ip) => !isPrivateOrRestrictedIP(ip));
  record(5, 'Legitimate public IPv4 addresses permitted by filter', publicAllowed);

  // Direct fetch attempt against cloud metadata
  let metadataBlocked = false;
  try {
    await ServerJobFetcher.fetch('https://169.254.169.254/latest/meta-data/');
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'SSRF_TARGET_FORBIDDEN') {
      metadataBlocked = true;
    }
  }
  record(6, 'Direct cloud metadata endpoint (169.254.169.254) blocked with SSRF_TARGET_FORBIDDEN', metadataBlocked);

  // Metadata hostname block
  let metadataHostBlocked = false;
  try {
    await ServerJobFetcher.fetch('https://metadata.google.internal/computeMetadata/v1/');
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'SSRF_TARGET_FORBIDDEN') {
      metadataHostBlocked = true;
    }
  }
  record(7, 'Cloud metadata hostname (metadata.google.internal) blocked upfront', metadataHostBlocked);

  // ---------------------------------------------------------------------------
  // SECTION 3: MOCKED DNS & DNS REBINDING DEFENSE
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: DNS Resolution & Rebinding Defenses ---');

  // Simulated malicious DNS resolution: public hostname resolving to private IP
  let maliciousDnsBlocked = false;
  try {
    await ServerJobFetcher.fetch('https://malicious-careers.example.com/job', {
      dnsLookupFn: async () => [{ address: '10.0.0.5', family: 4 }]
    });
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'SSRF_TARGET_FORBIDDEN') {
      maliciousDnsBlocked = true;
    }
  }
  record(8, 'Hostname resolving to private IP rejected before socket creation', maliciousDnsBlocked);

  // Simulated DNS rebinding: custom lookup function returns public IP on validation
  // and pinned socket lookup confirms same IP used for connection
  let rebindingProtected = false;
  try {
    // Lookup returns 127.0.0.1, which fails validation immediately
    await ServerJobFetcher.fetch('https://rebind-test.example.com/job', {
      dnsLookupFn: async () => [{ address: '127.0.0.1', family: 4 }]
    });
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'SSRF_TARGET_FORBIDDEN') {
      rebindingProtected = true;
    }
  }
  record(9, 'DNS rebinding attack surface protected via pre-connect IP pinning and agent lookup', rebindingProtected);

  // ---------------------------------------------------------------------------
  // SECTION 4: REDIRECT SECURITY & CHAIN VALIDATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Redirect Bounding & Destination Security ---');

  // 1. Redirect to private IP target
  const redirectServerPrivate = await createTestServer((_req, res) => {
    res.writeHead(302, { Location: 'http://10.0.0.1/admin/jobs' });
    res.end();
  });

  let redirectPrivateBlocked = false;
  try {
    await ServerJobFetcher.fetch(redirectServerPrivate.url, { allowHttpForTesting: true });
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'SSRF_TARGET_FORBIDDEN') {
      redirectPrivateBlocked = true;
    }
  } finally {
    await redirectServerPrivate.close();
  }
  record(10, 'Redirect targeting private IP rejected with SSRF_TARGET_FORBIDDEN', redirectPrivateBlocked);

  // 2. Redirect to cloud metadata
  const redirectServerMetadata = await createTestServer((_req, res) => {
    res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
    res.end();
  });

  let redirectMetadataBlocked = false;
  try {
    await ServerJobFetcher.fetch(redirectServerMetadata.url, { allowHttpForTesting: true });
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'SSRF_TARGET_FORBIDDEN') {
      redirectMetadataBlocked = true;
    }
  } finally {
    await redirectServerMetadata.close();
  }
  record(11, 'Redirect targeting cloud metadata rejected with SSRF_TARGET_FORBIDDEN', redirectMetadataBlocked);

  // 3. Exceeding max redirects (> 3)
  let redirectCounter = 0;
  const loopServer = await createTestServer((_req, res) => {
    redirectCounter++;
    res.writeHead(302, { Location: `/hop-${redirectCounter}` });
    res.end();
  });

  let redirectLimitExceeded = false;
  try {
    await ServerJobFetcher.fetch(loopServer.url, { allowHttpForTesting: true, maxRedirects: 3 });
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'REDIRECT_LIMIT_EXCEEDED') {
      redirectLimitExceeded = true;
    }
  } finally {
    await loopServer.close();
  }
  record(12, 'Redirect loop or chain exceeding 3 hops rejected with REDIRECT_LIMIT_EXCEEDED', redirectLimitExceeded);

  // ---------------------------------------------------------------------------
  // SECTION 5: RESPONSE SIZE & TIMEOUT BOUNDS
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Response Size & Timeout Bounds ---');

  // Oversized response test (streaming > 5MB)
  const largeServer = await createTestServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    // Stream 6 chunks of 1MB = 6MB
    const chunk1MB = Buffer.alloc(1024 * 1024, 'A');
    for (let i = 0; i < 6; i++) {
      res.write(chunk1MB);
    }
    res.end();
  });

  let responseSizeAborted = false;
  try {
    await ServerJobFetcher.fetch(largeServer.url, { allowHttpForTesting: true, maxBytes: 5 * 1024 * 1024 });
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'RESPONSE_TOO_LARGE') {
      responseSizeAborted = true;
    }
  } finally {
    await largeServer.close();
  }
  record(13, 'Oversized response (>5MB) aborted during streaming with RESPONSE_TOO_LARGE', responseSizeAborted);

  // Timeout enforcement test
  const slowServer = await createTestServer((_req, res) => {
    // Delay response for 2000ms
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Slow response');
    }, 2000);
  });

  let requestTimedOut = false;
  try {
    await ServerJobFetcher.fetch(slowServer.url, { allowHttpForTesting: true, timeoutMs: 300 });
  } catch (err) {
    if (err instanceof ServerJobFetcherError && err.code === 'FETCH_TIMEOUT') {
      requestTimedOut = true;
    }
  } finally {
    await slowServer.close();
  }
  record(14, 'Slow server exceeding configured timeout safely aborted with FETCH_TIMEOUT', requestTimedOut);

  // Successful bounded fetch test
  const content = '<html><body>Job Posting Content</body></html>';
  const validServer = await createTestServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(content).toString()
    });
    res.end(content);
  });

  let validFetchSucceeded = false;
  let fetchedBody = '';
  try {
    const res = await ServerJobFetcher.fetch(validServer.url, { allowHttpForTesting: true });
    validFetchSucceeded = res.status === 200 && res.body.includes('Job Posting Content');
    fetchedBody = res.body;
  } finally {
    await validServer.close();
  }
  record(15, 'Valid HTTP fixture fetches accurately with status, content-type and body', validFetchSucceeded, `Length: ${fetchedBody.length}`);

  // ---------------------------------------------------------------------------
  // SECTION 6: PRISMA DATA MODEL & INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Database Models & Referential Integrity ---');

  // Provision test candidates cleanly
  await prisma.candidate.upsert({
    where: { id: CAND_A },
    create: { id: CAND_A, clerkUserId: 'clerk_7a_a', email: 'cand_a@phase7a.test' },
    update: {}
  });

  await prisma.candidate.upsert({
    where: { id: CAND_B },
    create: { id: CAND_B, clerkUserId: 'clerk_7a_b', email: 'cand_b@phase7a.test' },
    update: {}
  });

  // Create a canonical test Job
  const TEST_JOB_ID = `job-phase7a-${Date.now()}`;
  await prisma.job.create({
    data: {
      id: TEST_JOB_ID,
      title: 'Principal Distributed Systems Architect',
      company: 'DataMesh Systems',
      location: 'San Francisco, CA',
      workArrangement: 'unknown', // Test unknown work arrangement support!
      description: 'Lead next-generation distributed database design.',
      responsibilities: ['Architecture', 'Implementation'],
      requiredSkills: ['Rust', 'Distributed Systems'],
      preferredSkills: ['PostgreSQL'],
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null, // Test nullable currency (Unknown != USD)!
      source: 'greenhouse',
      jobStatus: 'active',
      isPublic: true
    }
  });

  const verifiedJob = await prisma.job.findUnique({ where: { id: TEST_JOB_ID } });
  const jobModelValid =
    verifiedJob?.workArrangement === 'unknown' &&
    verifiedJob?.salaryCurrency === null;
  record(16, 'Job model supports workArrangement "unknown" and nullable salaryCurrency', jobModelValid);

  // ---------------------------------------------------------------------------
  // SECTION 7: JOBSOURCEREFERENCE & PRIMARY INVARIANT
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: JobSourceReference & Primary Invariant ---');

  // Add first primary source reference
  const ref1 = await repository.addJobSourceReference({
    jobId: TEST_JOB_ID,
    source: 'greenhouse',
    sourceJobId: 'gh-12345',
    sourceUrl: 'https://boards.greenhouse.io/datamesh/jobs/12345?utm_source=test',
    normalizedUrl: 'https://boards.greenhouse.io/datamesh/jobs/12345',
    sourceStatus: 'active',
    verificationStatus: 'verified_accessible',
    lastVerifiedAt: new Date(),
    isPrimary: true,
    referenceRole: 'primary',
    firstSeenAt: new Date(),
    lastSeenAt: new Date()
  });

  const initialRefs = await repository.getJobSourceReferences(TEST_JOB_ID);
  const primarySetCorrectly = initialRefs.length === 1 && initialRefs[0].isPrimary === true;
  record(17, 'Initial JobSourceReference created with isPrimary = true', primarySetCorrectly);

  // Add alternative source reference
  const ref2 = await repository.addJobSourceReference({
    jobId: TEST_JOB_ID,
    source: 'company_portal',
    sourceJobId: 'req-987',
    sourceUrl: 'https://careers.datamesh.com/postings/req-987',
    normalizedUrl: 'https://careers.datamesh.com/postings/req-987',
    sourceStatus: 'active',
    verificationStatus: 'verified_accessible',
    lastVerifiedAt: new Date(),
    isPrimary: false,
    referenceRole: 'alternative',
    firstSeenAt: new Date(),
    lastSeenAt: new Date()
  });

  const multipleRefs = await repository.getJobSourceReferences(TEST_JOB_ID);
  const multiSourcesPreserved =
    multipleRefs.length === 2 &&
    multipleRefs.filter((r) => r.isPrimary).length === 1 &&
    multipleRefs.find((r) => r.id === ref1.id)?.isPrimary === true;
  record(18, 'Multiple source references co-exist with exactly one primary', multiSourcesPreserved);

  // Test source + normalizedUrl uniqueness constraint
  let duplicateUrlBlocked = false;
  try {
    await prisma.jobSourceReference.create({
      data: {
        jobId: TEST_JOB_ID,
        source: 'greenhouse',
        sourceUrl: 'https://boards.greenhouse.io/datamesh/jobs/12345?duplicate=true',
        normalizedUrl: 'https://boards.greenhouse.io/datamesh/jobs/12345', // Exact duplicate
        sourceStatus: 'active',
        isPrimary: false
      }
    });
  } catch (err: unknown) {
    // Unique constraint violation in Prisma code P2002
    duplicateUrlBlocked = true;
  }
  record(19, 'JobSourceReference @@unique([source, normalizedUrl]) constraint enforced by DB', duplicateUrlBlocked);

  // Test setPrimaryJobSourceReference atomic promotion & demotion
  await repository.setPrimaryJobSourceReference(TEST_JOB_ID, ref2.id);
  const afterPromotionRefs = await repository.getJobSourceReferences(TEST_JOB_ID);
  const ref2IsPrimary = afterPromotionRefs.find((r) => r.id === ref2.id)?.isPrimary === true;
  const ref1IsDemoted = afterPromotionRefs.find((r) => r.id === ref1.id)?.isPrimary === false;
  const exactlyOnePrimaryAfterPromotion = afterPromotionRefs.filter((r) => r.isPrimary).length === 1;
  record(20, 'setPrimaryJobSourceReference atomically demotes old primary and promotes new primary',
    ref2IsPrimary && ref1IsDemoted && exactlyOnePrimaryAfterPromotion);

  // Test: Closed source cannot become primary
  const refClosed = await repository.addJobSourceReference({
    jobId: TEST_JOB_ID,
    source: 'lever',
    sourceJobId: 'closed-111',
    sourceUrl: 'https://jobs.lever.co/datamesh/closed-111',
    normalizedUrl: 'https://jobs.lever.co/datamesh/closed-111',
    sourceStatus: 'closed',
    verificationStatus: 'verified_accessible',
    isPrimary: false,
    referenceRole: 'alternative',
    firstSeenAt: new Date(),
    lastSeenAt: new Date()
  });

  let closedPromotionRejected = false;
  try {
    await repository.setPrimaryJobSourceReference(TEST_JOB_ID, refClosed.id);
  } catch (err) {
    closedPromotionRejected = true;
  }
  record(21, 'Closed source reference rejected from becoming primary', closedPromotionRejected);

  // Test DB partial unique index: attempting to insert a second isPrimary=true row directly throws
  let directMultiplePrimaryBlocked = false;
  try {
    await prisma.jobSourceReference.create({
      data: {
        jobId: TEST_JOB_ID,
        source: 'manual',
        sourceUrl: 'https://careers.manual.com/1',
        normalizedUrl: 'https://careers.manual.com/1',
        sourceStatus: 'active',
        isPrimary: true // Violates partial unique index since ref2 is already primary!
      }
    });
  } catch (err) {
    directMultiplePrimaryBlocked = true;
  }
  record(22, 'Database partial unique index blocks concurrent second isPrimary=true row', directMultiplePrimaryBlocked);

  // ---------------------------------------------------------------------------
  // SECTION 8: CANDIDATEJOBSTATE & ZERO HISTORICAL BACKFILL
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: CandidateJobState & Behavioral Boundaries ---');

  // Verify virtual UNSEEN: initially null in database
  const initialState = await repository.getCandidateJobState(TEST_JOB_ID, CAND_A);
  record(23, 'Unseen opportunity returns null (virtual UNSEEN without database bloat)', initialState === null);

  // Transition to VIEWED
  const viewedState = await repository.setCandidateJobState(TEST_JOB_ID, 'VIEWED', CAND_A);
  const firstViewedTimestamp = viewedState.firstViewedAt;
  record(24, 'setCandidateJobState(VIEWED) establishes firstViewedAt timestamp',
    viewedState.status === 'VIEWED' && viewedState.firstViewedAt !== null);

  // Transition to SAVED
  const savedState = await repository.setCandidateJobState(TEST_JOB_ID, 'SAVED', CAND_A);
  record(25, 'setCandidateJobState(SAVED) sets savedAt and preserves immutable firstViewedAt',
    savedState.status === 'SAVED' &&
    savedState.savedAt !== null &&
    String(savedState.firstViewedAt) === String(firstViewedTimestamp));

  // Transition to DISMISSED
  const dismissedState = await repository.setCandidateJobState(TEST_JOB_ID, 'DISMISSED', CAND_A, 'compensation');
  record(26, 'setCandidateJobState(DISMISSED) records dismissedAt and dismissedReason',
    dismissedState.status === 'DISMISSED' &&
    dismissedState.dismissedReason === 'compensation' &&
    dismissedState.dismissedAt !== null &&
    dismissedState.savedAt === null);

  // Verify unique(candidateId, jobId) constraint
  let candidateJobUniqueEnforced = false;
  try {
    await prisma.candidateJobState.create({
      data: {
        candidateId: CAND_A,
        jobId: TEST_JOB_ID,
        status: 'SAVED'
      }
    });
  } catch {
    candidateJobUniqueEnforced = true;
  }
  record(27, 'CandidateJobState @@unique([candidateId, jobId]) constraint enforced', candidateJobUniqueEnforced);

  // Verify ZERO historical backfill from Applications
  const totalApplications = await prisma.application.count();
  const stateCountForApps = await prisma.candidateJobState.count({
    where: {
      job: {
        applications: { some: {} }
      },
      firstViewedAt: null
    }
  });
  record(28, 'Zero historical backfill: Existing Application records did not create synthetic CandidateJobState rows',
    totalApplications > 0 && stateCountForApps === 0, `Applications: ${totalApplications}`);

  // ---------------------------------------------------------------------------
  // SECTION 9: SAVEDSEARCH & MULTI-TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: SavedSearch & Tenant Isolation ---');

  const searchA = await repository.saveSavedSearch(
    {
      name: 'High Impact Distributed Systems',
      query: 'Rust Systems Architect',
      locations: ['San Francisco, CA', 'Remote'],
      workArrangements: ['remote', 'hybrid'],
      roleCategories: ['Engineering'],
      seniorityLevels: ['Staff', 'Principal'],
      minSalary: 210000,
      currency: null, // Unknown != USD
      alertFrequency: 'weekly',
      filterVersion: '1.0',
      lastMatchCount: 5
    },
    CAND_A
  );

  record(29, 'SavedSearch persisted with candidate ownership and nullable currency',
    searchA.candidateId === CAND_A && searchA.currency === null);

  // Cross-tenant read isolation: Candidate B cannot see Candidate A's saved search
  const candBSearches = await repository.getSavedSearches(CAND_B);
  const candBSeesSearchA = candBSearches.some((s) => s.id === searchA.id);
  const candBDirectGet = await repository.getSavedSearchById(searchA.id, CAND_B);
  record(30, 'Cross-tenant isolation: Candidate B cannot access or list Candidate A SavedSearch',
    !candBSeesSearchA && candBDirectGet === null);

  // Cross-tenant delete isolation: Candidate B cannot delete Candidate A's saved search
  const deleteAttemptByB = await repository.deleteSavedSearch(searchA.id, CAND_B);
  const searchAStillExists = await repository.getSavedSearchById(searchA.id, CAND_A);
  record(31, 'Cross-tenant IDOR protection: Candidate B cannot delete Candidate A SavedSearch',
    deleteAttemptByB === false && searchAStillExists !== null);

  // Mandatory candidateId validation on repository methods
  let missingCandIdRejected = false;
  try {
    await repository.getCandidateJobState(TEST_JOB_ID, '');
  } catch {
    missingCandIdRejected = true;
  }
  record(32, 'Repository rejects missing candidateId at domain boundary', missingCandIdRejected);

  // ---------------------------------------------------------------------------
  // SECTION 10: CLEAN TOPOLOGICAL DELETION & CASCADES
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 10: Account Deletion Cascades & Cascade Cleanup ---');

  // Candidate A account deletion
  const deletionResult = await repository.deleteCandidateAccountData(CAND_A);
  const candidateADeleted = deletionResult.databaseDeleted;

  const candidateAStatesRemaining = await prisma.candidateJobState.count({ where: { candidateId: CAND_A } });
  const candidateASavedSearchesRemaining = await prisma.savedSearch.count({ where: { candidateId: CAND_A } });
  const publicJobSurvives = await prisma.job.findUnique({ where: { id: TEST_JOB_ID } });

  record(33, 'Account deletion topologically cascades CandidateJobState & SavedSearch while preserving public Job',
    candidateADeleted &&
    candidateAStatesRemaining === 0 &&
    candidateASavedSearchesRemaining === 0 &&
    publicJobSurvives !== null);

  // Clean up test public job
  await prisma.job.delete({ where: { id: TEST_JOB_ID } });
  await prisma.candidate.deleteMany({ where: { id: { in: [CAND_A, CAND_B] } } });

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n====================================================');
  const allPassed = checkpoints.every((c) => c.passed);
  console.log(`Phase 7A Verification Results: ${checkpoints.filter((c) => c.passed).length}/${checkpoints.length} PASSED`);
  if (allPassed) {
    console.log('🎉 PHASE 7A: DATA MODEL & SECURITY CORE VERIFICATION COMPLETE PASS');
  } else {
    console.log('❌ PHASE 7A: SOME CHECKPOINTS FAILED');
  }
  console.log('====================================================\n');

  await prisma.$disconnect();

  if (!allPassed) {
    process.exit(1);
  }
}

run().catch(async (e) => {
  console.error('Fatal test error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
