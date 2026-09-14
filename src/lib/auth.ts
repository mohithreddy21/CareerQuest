import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export type AuthenticatedCandidate = Prisma.CandidateGetPayload<{
  include: {
    profile: true;
    preferences: true;
  };
}>;

/**
 * Resolves the authenticated candidate workspace identity from Clerk session.
 *
 * Architecture Invariants:
 * 1. Fast path: Decodes userId directly from Clerk session token (0ms network calls)
 *    and looks up Candidate in local PostgreSQL.
 * 2. JIT provisioning: Only calls currentUser() if Candidate record does not exist in DB yet.
 * 3. Concurrency-safe: Safely handles simultaneous requests using DB uniqueness and P2002 recovery.
 * 4. Separation of concerns: Never overwrites candidate-entered career/profile facts with Clerk data.
 * 5. Client trust: Client never supplies candidateId; candidateId is always derived server-side.
 */
// Internal symbol / store strictly for test runners
const globalForAuth = globalThis as unknown as {
  careerquestTestCandidateId?: string | null;
};

/**
 * Sets test candidate override.
 * STRICT GUARDRAIL 1:
 * Only permitted in non-production environments (NODE_ENV !== 'production').
 * Any attempt to invoke this in production throws an error immediately.
 */
export function setTestCandidateId(candidateId: string | null | undefined): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SECURITY VIOLATION: setTestCandidateId is forbidden in production environments.'
    );
  }
  globalForAuth.careerquestTestCandidateId = candidateId;
}

export async function requireCandidate(options?: {
  redirectOnUnauthenticated?: boolean;
}): Promise<AuthenticatedCandidate> {
  // GUARDRAIL 1: Check test override (test runner only, never production)
  if (
    process.env.NODE_ENV !== 'production' &&
    globalForAuth.careerquestTestCandidateId !== undefined
  ) {
    const testId = globalForAuth.careerquestTestCandidateId;
    if (!testId) {
      if (options?.redirectOnUnauthenticated ?? true) {
        redirect('/auth/sign-in');
      }
      throw new UnauthorizedError(
        'Candidate must be authenticated to access this workspace resource.'
      );
    }
    // Lookup candidate by testId
    const candidate = await prisma.candidate.findUnique({
      where: { id: testId },
      include: { profile: true, preferences: true }
    });
    if (candidate) return candidate;

    // Synthetic fallback for in-memory test suites where candidate may not be in DB
    return {
      id: testId,
      clerkUserId: `clerk_${testId}`,
      email: `${testId}@example.com`,
      createdAt: new Date(),
      updatedAt: new Date(),
      profile: {
        id: `prof_${testId}`,
        candidateId: testId,
        name: 'Test Candidate',
        headline: 'Test Headline',
        professionalSummary: 'Test Summary',
        location: 'San Francisco, CA',
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      preferences: {
        id: `pref_${testId}`,
        candidateId: testId,
        targetRoles: ['Senior Full-Stack Engineer'],
        preferredLocations: ['Remote'],
        workArrangements: ['remote'],
        targetSalaryMin: 150000,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } as AuthenticatedCandidate;
  }

  const { userId } = await auth();

  if (!userId) {
    if (options?.redirectOnUnauthenticated ?? true) {
      redirect('/auth/sign-in');
    }
    throw new UnauthorizedError(
      'Candidate must be authenticated to access this workspace resource.'
    );
  }

  // Fast Path: Direct PostgreSQL lookup by clerkUserId (No external network overhead)
  const existingCandidate = await prisma.candidate.findUnique({
    where: { clerkUserId: userId },
    include: {
      profile: true,
      preferences: true
    }
  });

  if (existingCandidate) {
    return existingCandidate;
  }

  // JIT Provisioning (Slow path, first-time login only)
  return await provisionCandidateJIT(userId);
}

/**
 * Non-throwing check for optional session contexts
 */
export async function getCandidate(): Promise<AuthenticatedCandidate | null> {
  try {
    if (
      process.env.NODE_ENV !== 'production' &&
      globalForAuth.careerquestTestCandidateId !== undefined
    ) {
      const testId = globalForAuth.careerquestTestCandidateId;
      if (!testId) return null;
      return await prisma.candidate.findUnique({
        where: { id: testId },
        include: { profile: true, preferences: true }
      });
    }

    const { userId } = await auth();
    if (!userId) return null;

    const candidate = await prisma.candidate.findUnique({
      where: { clerkUserId: userId },
      include: {
        profile: true,
        preferences: true
      }
    });

    if (candidate) return candidate;
    return await provisionCandidateJIT(userId);
  } catch (error) {
    console.error('Error in getCandidate:', error);
    return null;
  }
}

/**
 * Returns candidateId directly for repository queries
 */
export async function requireCandidateId(options?: {
  redirectOnUnauthenticated?: boolean;
}): Promise<string> {
  const candidate = await requireCandidate(options);
  return candidate.id;
}

/**
 * Asserts that a candidate has access to a specific resource
 */
export function assertCandidateOwnership(
  resourceCandidateId: string,
  currentCandidateId: string
): void {
  if (resourceCandidateId !== currentCandidateId) {
    throw new ForbiddenError('Cross-candidate access is strictly forbidden.');
  }
}

/**
 * Internal JIT provisioning helper with race condition protection
 */
async function provisionCandidateJIT(clerkUserId: string): Promise<AuthenticatedCandidate> {
  // 1. Fetch user profile from Clerk once during first-time bootstrap
  const user = await currentUser();

  const email =
    user?.emailAddresses?.[0]?.emailAddress ||
    user?.primaryEmailAddress?.emailAddress ||
    `${clerkUserId}@clerk.user`;

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.fullName || 'Candidate';

  const phone = user?.phoneNumbers?.[0]?.phoneNumber || null;

  // 2. Concurrency-safe creation: Handle P2002 unique constraint race condition
  try {
    const newCandidate = await prisma.candidate.create({
      data: {
        clerkUserId,
        email,
        profile: {
          create: {
            name: fullName,
            phone,
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
      include: {
        profile: true,
        preferences: true
      }
    });

    return newCandidate;
  } catch (error: unknown) {
    // If another concurrent request already created the candidate in that exact millisecond,
    // recover safely by fetching the created candidate instead of surfacing P2002 to the user.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raceWinnerCandidate = await prisma.candidate.findUnique({
        where: { clerkUserId },
        include: {
          profile: true,
          preferences: true
        }
      });

      if (raceWinnerCandidate) {
        return raceWinnerCandidate;
      }
    }

    console.error('Fatal error during JIT candidate provisioning:', error);
    throw error;
  }
}
