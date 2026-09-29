/**
 * CareerQuest — Settings Security & Candidate-ID Boundary Verification Suite
 *
 * Verifies:
 * 1. Server-derived identity enforcement (no client candidate ID trusted)
 * 2. Candidate A vs Candidate B strict tenant isolation (no cross-tenant leakage)
 * 3. Empty account behavior: newly provisioned candidates with empty preferences render cleanly without fake demo data
 * 4. Unauthenticated requests are rejected with 401 / UnauthorizedError
 * 5. Mutations use requireCandidateId() and update only the authenticated candidate's record
 */

import { PrismaClient } from '@prisma/client';
import { setTestCandidateId } from '../src/lib/auth';
import { getUserSettings, updateUserSettings } from '../src/features/settings/api/service';
import { updateUserSettingsAction } from '../src/features/settings/api/actions';
import { GET as getSettingsRoute } from '../src/app/api/settings/route';
import { userSettingsQueryOptions } from '../src/features/settings/api/queries';

const prisma = new PrismaClient();

async function runSettingsSecurityVerification() {
  console.log('================================================================');
  console.log('  CareerQuest: Settings Candidate-ID Security & Isolation Audit');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`[FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  const CAND_A = 'cand-settings-sec-a';
  const CAND_B = 'cand-settings-sec-b';
  const CAND_EMPTY = 'cand-settings-sec-empty';

  try {
    // Teardown prior test artifacts
    await prisma.candidatePreferences.deleteMany({
      where: { candidateId: { in: [CAND_A, CAND_B, CAND_EMPTY] } }
    });
    await prisma.candidateProfile.deleteMany({
      where: { candidateId: { in: [CAND_A, CAND_B, CAND_EMPTY] } }
    });
    await prisma.candidate.deleteMany({
      where: { id: { in: [CAND_A, CAND_B, CAND_EMPTY] } }
    });

    // 1. Provision Candidate A
    await prisma.candidate.create({
      data: {
        id: CAND_A,
        clerkUserId: 'user_settings_a',
        email: 'cand_a@careerquest.internal',
        profile: {
          create: {
            name: 'Candidate Alpha',
            headline: 'Senior Cloud Engineer',
            location: 'Seattle, WA',
            professionalSummary: 'Cloud specialist.'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Cloud Architect', 'DevOps Lead'],
            preferredLocations: ['Seattle, WA', 'Remote'],
            workArrangements: ['remote'],
            targetSalaryMin: 180000,
            currency: 'USD'
          }
        }
      }
    });

    // 2. Provision Candidate B
    await prisma.candidate.create({
      data: {
        id: CAND_B,
        clerkUserId: 'user_settings_b',
        email: 'cand_b@careerquest.internal',
        profile: {
          create: {
            name: 'Candidate Beta',
            headline: 'Frontend Engineer',
            location: 'New York, NY',
            professionalSummary: 'UI specialist.'
          }
        },
        preferences: {
          create: {
            targetRoles: ['Staff UI Engineer'],
            preferredLocations: ['New York, NY'],
            workArrangements: ['hybrid'],
            targetSalaryMin: 195000,
            currency: 'USD'
          }
        }
      }
    });

    // 3. Provision Brand-New Candidate with EMPTY preferences (JIT equivalent)
    await prisma.candidate.create({
      data: {
        id: CAND_EMPTY,
        clerkUserId: 'user_settings_empty',
        email: 'cand_empty@careerquest.internal',
        profile: {
          create: {
            name: 'Fresh Candidate',
            headline: 'Software Engineer',
            location: 'San Francisco, CA',
            professionalSummary: ''
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
      }
    });

    console.log('--- 1. Candidate Isolation: Distinct Settings Per Candidate ---');
    // Test Candidate A
    setTestCandidateId(CAND_A);
    const settingsA = await getUserSettings();
    assert(settingsA.targetRoles.includes('Cloud Architect'), 'Candidate A sees own targetRoles');
    assert(settingsA.targetSalaryMin === 180000, 'Candidate A sees own targetSalaryMin');
    assert(!settingsA.targetRoles.includes('Staff UI Engineer'), 'Candidate A does NOT see Candidate B data');

    // Test Candidate B
    setTestCandidateId(CAND_B);
    const settingsB = await getUserSettings();
    assert(settingsB.targetRoles.includes('Staff UI Engineer'), 'Candidate B sees own targetRoles');
    assert(settingsB.targetSalaryMin === 195000, 'Candidate B sees own targetSalaryMin');
    assert(!settingsB.targetRoles.includes('Cloud Architect'), 'Candidate B does NOT see Candidate A data');

    console.log('\n--- 2. HTTP Route Handler Boundary (/api/settings) ---');
    // Test GET /api/settings as Candidate A
    setTestCandidateId(CAND_A);
    const resA = await getSettingsRoute();
    assert(resA.status === 200, 'Route handler returns 200 for authenticated Candidate A');
    const jsonA = await resA.json();
    assert(jsonA.targetRoles.includes('Cloud Architect'), 'Route handler returns Candidate A data');

    // Test GET /api/settings as Candidate B
    setTestCandidateId(CAND_B);
    const resB = await getSettingsRoute();
    assert(resB.status === 200, 'Route handler returns 200 for authenticated Candidate B');
    const jsonB = await resB.json();
    assert(jsonB.targetRoles.includes('Staff UI Engineer'), 'Route handler returns Candidate B data');

    console.log('\n--- 3. Unauthenticated Access Protection ---');
    setTestCandidateId(null as unknown as string);

    // Test Service Level
    let unauthServiceError: unknown = null;
    try {
      await getUserSettings();
    } catch (e) {
      unauthServiceError = e;
    }
    assert(unauthServiceError !== null, 'Service rejects unauthenticated access');
    assert(
      (unauthServiceError as Error).message.includes('Candidate must be authenticated'),
      'Service throws clear UnauthorizedError'
    );

    // Test Route Handler Level
    const unauthRes = await getSettingsRoute();
    assert(unauthRes.status === 401, 'Route handler returns HTTP 401 for unauthenticated request');
    const unauthJson = await unauthRes.json();
    assert(unauthJson.error.includes('Candidate must be authenticated'), 'Route handler returns 401 error message');

    console.log('\n--- 4. Empty Account Behavior (Brand New User) ---');
    setTestCandidateId(CAND_EMPTY);
    const settingsEmpty = await getUserSettings();
    assert(Array.isArray(settingsEmpty.targetRoles), 'Empty account targetRoles is an array');
    assert(settingsEmpty.targetRoles.length === 0, 'Empty account targetRoles is empty array (no demo substitution)');
    assert(settingsEmpty.preferredLocations.length === 0, 'Empty account preferredLocations is empty array');
    assert(settingsEmpty.targetSalaryMin === 0, 'Empty account targetSalaryMin is 0 (truthful)');

    // Test server prefetch queryOptions for empty candidate
    const optionsEmpty = userSettingsQueryOptions(CAND_EMPTY);
    assert(optionsEmpty.queryKey[0] === 'settings', 'Query key starts with settings');
    assert(optionsEmpty.queryKey[1] === 'user', 'Query key second element is user');
    const prefetchedEmpty = await optionsEmpty.queryFn!({} as never);
    assert(prefetchedEmpty.targetRoles.length === 0, 'Prefetch queryFn resolves empty targetRoles without error');

    console.log('\n--- 5. Mutation Security: Updates Only Authenticated Candidate ---');
    // Candidate A updates their settings
    setTestCandidateId(CAND_A);
    await updateUserSettingsAction({
      updates: {
        targetRoles: ['VP of Infrastructure'],
        targetSalaryMin: 220000
      }
    });

    // Verify DB state for Candidate A
    const updatedA = await prisma.candidatePreferences.findUnique({
      where: { candidateId: CAND_A }
    });
    assert(updatedA?.targetRoles[0] === 'VP of Infrastructure', 'Candidate A preferences updated in PostgreSQL');
    assert(updatedA?.targetSalaryMin === 220000, 'Candidate A salary updated in PostgreSQL');

    // Verify Candidate B was NOT modified
    const untouchedB = await prisma.candidatePreferences.findUnique({
      where: { candidateId: CAND_B }
    });
    assert(untouchedB?.targetRoles[0] === 'Staff UI Engineer', 'Candidate B preferences strictly untouched by Candidate A mutation');
    assert(untouchedB?.targetSalaryMin === 195000, 'Candidate B salary strictly untouched');

    // Cleanup test artifacts
    await prisma.candidatePreferences.deleteMany({
      where: { candidateId: { in: [CAND_A, CAND_B, CAND_EMPTY] } }
    });
    await prisma.candidateProfile.deleteMany({
      where: { candidateId: { in: [CAND_A, CAND_B, CAND_EMPTY] } }
    });
    await prisma.candidate.deleteMany({
      where: { id: { in: [CAND_A, CAND_B, CAND_EMPTY] } }
    });
  } finally {
    setTestCandidateId(null as unknown as string);
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} SETTINGS SECURITY AUDIT CHECKS PASSED!`);
  console.log('================================================================\n');
}

runSettingsSecurityVerification().catch((err) => {
  console.error('Fatal settings security audit failure:', err);
  process.exit(1);
});
