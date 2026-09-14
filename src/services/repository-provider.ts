import { ICareerRepository } from './career-repository.interface';
import { PrismaCareerRepository } from './prisma-career-repository';
import { InMemoryCareerRepository } from './in-memory-career-repository';

// Global singleton caching across HMR development cycles
const globalForRepo = globalThis as unknown as {
  prismaCareerRepository: PrismaCareerRepository | undefined;
  inMemoryCareerRepository: InMemoryCareerRepository | undefined;
  forcedRepositoryMode?: 'prisma' | 'in-memory';
};

/**
 * Server-side repository factory
 *
 * Invariants:
 * 1. Resolves to PrismaCareerRepository by default in production/runtime server execution.
 * 2. Does NOT silently fall back to mock data if database fails.
 * 3. Allows deterministic offline test suites and regression scripts to explicitly select InMemoryCareerRepository.
 */
export function getCareerRepository(mode?: 'prisma' | 'in-memory'): ICareerRepository {
  const selectedMode =
    mode ||
    globalForRepo.forcedRepositoryMode ||
    (process.env.CAREERQUEST_REPOSITORY_MODE as 'prisma' | 'in-memory') ||
    'prisma';

  if (selectedMode === 'in-memory') {
    if (!globalForRepo.inMemoryCareerRepository) {
      globalForRepo.inMemoryCareerRepository = new InMemoryCareerRepository();
    }
    return globalForRepo.inMemoryCareerRepository;
  }

  // Production / PostgreSQL default
  if (!globalForRepo.prismaCareerRepository) {
    globalForRepo.prismaCareerRepository = new PrismaCareerRepository();
  }
  return globalForRepo.prismaCareerRepository;
}

/**
 * Sets repository mode programmatically for test execution
 */
export function setCareerRepositoryMode(mode: 'prisma' | 'in-memory'): void {
  globalForRepo.forcedRepositoryMode = mode;
}

/**
 * Resets in-memory database instance for isolated test runs
 */
export function resetInMemoryRepository(): InMemoryCareerRepository {
  globalForRepo.inMemoryCareerRepository = new InMemoryCareerRepository();
  return globalForRepo.inMemoryCareerRepository;
}

export { PrismaCareerRepository, InMemoryCareerRepository };
export type { ICareerRepository };
