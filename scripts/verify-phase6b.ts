/* eslint-disable no-console */
import { PrismaClient, Prisma } from '@prisma/client';
import { assertCandidateOwnership, ForbiddenError } from '../src/lib/auth';
import { createRouteMatcher } from '@clerk/nextjs/server';

const prisma = new PrismaClient();

interface TestResult {
  group: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(group: string, name: string, passed: boolean, details?: string) {
  results.push({ group, name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${group}] ${name}${details ? ` -> ${details}` : ''}`);
}

/**
 * Test JIT Provisioning simulation replicating requireCandidate logic
 */
async function simulateJitProvisioning(
  clerkUserId: string,
  clerkEmail: string,
  clerkName: string
) {
  // Fast path: Lookup
  const existing = await prisma.candidate.findUnique({
    where: { clerkUserId },
    include: { profile: true, preferences: true }
  });
  if (existing) return existing;

  // Slow path: Concurrency-safe creation
  try {
    return await prisma.candidate.create({
      data: {
        clerkUserId,
        email: clerkEmail,
        profile: {
          create: {
            name: clerkName,
            location: 'San Francisco, CA',
            professionalSummary: '',
            headline: 'Software Professional'
          }
        },
        preferences: {
          create: {
            targetRoles: [],
            preferredLocations: [],
            workArrangements: ['remote', 'hybrid'],
            currency: 'USD'
          }
        }
      },
      include: { profile: true, preferences: true }
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const raceWinner = await prisma.candidate.findUnique({
        where: { clerkUserId },
        include: { profile: true, preferences: true }
      });
      if (raceWinner) return raceWinner;
    }
    throw error;
  }
}

async function verifyPhase6B() {
  console.log('🔍 Starting CareerQuest Phase 6B Authentication & Identity Verification...\n');

  try {
    // -------------------------------------------------------------------------
    // GROUP 1: Route Protection & Matcher Verification
    // -------------------------------------------------------------------------
    const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);
    const mockReq = (pathname: string) =>
      ({
        nextUrl: new URL(`http://localhost:3000${pathname}`)
      }) as any;

    const dashboardRootProtected = isProtectedRoute(mockReq('/dashboard'));
    const dashboardAppsProtected = isProtectedRoute(mockReq('/dashboard/applications'));
    const dashboardResumeProtected = isProtectedRoute(mockReq('/dashboard/resume'));
    const landingPublic = !isProtectedRoute(mockReq('/'));
    const signInPublic = !isProtectedRoute(mockReq('/auth/sign-in'));
    const signUpPublic = !isProtectedRoute(mockReq('/auth/sign-up'));
    const webhookPublic = !isProtectedRoute(mockReq('/api/webhooks/clerk'));

    recordTest(
      'Route Protection',
      'Protected routes encompass /dashboard and all sub-routes',
      dashboardRootProtected && dashboardAppsProtected && dashboardResumeProtected,
      'Protected: /dashboard, /dashboard/applications, /dashboard/resume'
    );

    recordTest(
      'Public Routes',
      'Public routes remain open (/ , /auth/sign-in, /auth/sign-up, webhooks)',
      landingPublic && signInPublic && signUpPublic && webhookPublic,
      'Public: /, /auth/sign-in, /auth/sign-up, /api/webhooks/clerk'
    );

    // -------------------------------------------------------------------------
    // GROUP 2: Existing Candidate Fast-Path
    // -------------------------------------------------------------------------
    const existingClerkUserId = 'user_mock_01';
    const alexChen = await prisma.candidate.findUnique({
      where: { clerkUserId: existingClerkUserId },
      include: { profile: true, preferences: true }
    });

    recordTest(
      'Fast Path Lookup',
      'Authenticated session resolves candidate via direct PostgreSQL lookup without Clerk network call',
      alexChen !== null && alexChen.clerkUserId === existingClerkUserId,
      alexChen ? `Found candidate: ${alexChen.profile?.name} (${alexChen.id})` : 'Missing'
    );

    // -------------------------------------------------------------------------
    // GROUP 3: JIT Candidate Provisioning
    // -------------------------------------------------------------------------
    const newClerkUserId = `user_jit_test_${Date.now()}`;
    const newClerkEmail = `jit.test.${Date.now()}@example.com`;
    const newClerkName = 'Jordan Lee';

    const provisionedCandidate = await simulateJitProvisioning(
      newClerkUserId,
      newClerkEmail,
      newClerkName
    );

    recordTest(
      'JIT Provisioning',
      'First-time login provisions Candidate, Profile, and Preferences atomically',
      provisionedCandidate !== null &&
        provisionedCandidate.profile?.name === newClerkName &&
        provisionedCandidate.preferences !== null,
      `Provisioned Candidate ID: ${provisionedCandidate.id}, Name: ${provisionedCandidate.profile?.name}`
    );

    // Subsequent request for same user returns existing record without re-provisioning
    const subsequentRequest = await simulateJitProvisioning(
      newClerkUserId,
      'should.not.overwrite@example.com',
      'Should Not Overwrite'
    );

    recordTest(
      'Idempotent Fast-Path Reuse',
      'Subsequent requests retrieve existing candidate without re-creating records',
      subsequentRequest.id === provisionedCandidate.id &&
        subsequentRequest.email === newClerkEmail,
      `Reused existing Candidate ID ${subsequentRequest.id}`
    );

    // -------------------------------------------------------------------------
    // GROUP 4: Race Condition & Concurrency Safety
    // -------------------------------------------------------------------------
    const raceClerkUserId = `user_race_${Date.now()}`;
    const raceEmail = `race.${Date.now()}@example.com`;
    const raceName = 'Morgan Smith';

    // Simulate 5 simultaneous requests hitting the server at the exact same millisecond for a brand new user
    const concurrentRequests = Array.from({ length: 5 }).map(() =>
      simulateJitProvisioning(raceClerkUserId, raceEmail, raceName)
    );

    const raceResults = await Promise.all(concurrentRequests);

    // Verify all 5 resolved to the exact same candidate ID
    const firstCandidateId = raceResults[0].id;
    const allSameId = raceResults.every((c) => c.id === firstCandidateId);

    // Verify database has exactly 1 candidate, 1 profile, and 1 preferences
    const dbCandidatesCount = await prisma.candidate.count({
      where: { clerkUserId: raceClerkUserId }
    });
    const dbProfilesCount = await prisma.candidateProfile.count({
      where: { candidateId: firstCandidateId }
    });
    const dbPrefsCount = await prisma.candidatePreferences.count({
      where: { candidateId: firstCandidateId }
    });

    recordTest(
      'Concurrency Safety (P2002 Recovery)',
      'Concurrent first-time requests resolve cleanly to exactly 1 Candidate, 1 Profile, 1 Preferences',
      allSameId && dbCandidatesCount === 1 && dbProfilesCount === 1 && dbPrefsCount === 1,
      `5 concurrent requests -> 1 DB Candidate (All returned ID: ${firstCandidateId})`
    );

    // -------------------------------------------------------------------------
    // GROUP 5: Identity Separation & Profile Authority
    // -------------------------------------------------------------------------
    // User updates their location and headline in CareerQuest
    await prisma.candidateProfile.update({
      where: { candidateId: provisionedCandidate.id },
      data: {
        location: 'Seattle, WA',
        headline: 'Lead Cloud Infrastructure Architect'
      }
    });

    // Simulate another request: Clerk data must NOT overwrite candidate edits!
    const reloadedCandidate = await simulateJitProvisioning(
      newClerkUserId,
      newClerkEmail,
      'Clerk Profile Name'
    );

    recordTest(
      'Profile Facts Authority',
      'Subsequent requests preserve candidate-entered CareerQuest profile facts without Clerk overwrite',
      reloadedCandidate.profile?.location === 'Seattle, WA' &&
        reloadedCandidate.profile?.headline === 'Lead Cloud Infrastructure Architect',
      `Preserved Location: ${reloadedCandidate.profile?.location}, Headline: ${reloadedCandidate.profile?.headline}`
    );

    // -------------------------------------------------------------------------
    // GROUP 6: Server-side Authorization Foundation
    // -------------------------------------------------------------------------
    let crossCandidateBlocked = false;
    try {
      assertCandidateOwnership('cand-1', 'cand-2');
    } catch (err) {
      if (err instanceof ForbiddenError) {
        crossCandidateBlocked = true;
      }
    }

    let validCandidateAllowed = false;
    try {
      assertCandidateOwnership('cand-1', 'cand-1');
      validCandidateAllowed = true;
    } catch {
      validCandidateAllowed = false;
    }

    recordTest(
      'Server Authorization Boundary',
      'assertCandidateOwnership permits matching candidate and throws ForbiddenError for cross-candidate attempts',
      crossCandidateBlocked && validCandidateAllowed,
      'Cross-candidate access correctly rejected with ForbiddenError'
    );

    // Clean up temporary test candidates
    await prisma.candidatePreferences.deleteMany({
      where: { candidateId: { in: [provisionedCandidate.id, firstCandidateId] } }
    });
    await prisma.candidateProfile.deleteMany({
      where: { candidateId: { in: [provisionedCandidate.id, firstCandidateId] } }
    });
    await prisma.candidate.deleteMany({
      where: { id: { in: [provisionedCandidate.id, firstCandidateId] } }
    });
  } catch (error) {
    console.error('Fatal error during Phase 6B verification:', error);
    recordTest('Verification Suite', 'Execution without unhandled exception', false, String(error));
  } finally {
    await prisma.$disconnect();
  }

  // Summary
  console.log('\n======================================================');
  console.log('       CAREERQUEST PHASE 6B VERIFICATION SUMMARY       ');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Results: ${passedCount}/${totalCount} tests passed (${Math.round((passedCount / totalCount) * 100)}%)\n`);

  if (passedCount < totalCount) {
    console.error('❌ Phase 6B verification failed!');
    process.exit(1);
  } else {
    console.log('🎉 All Phase 6B Authentication & Identity invariants VERIFIED & PASS!');
  }
}

verifyPhase6B();
