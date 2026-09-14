import { ICareerRepository } from './career-repository.interface';
import {
  getCareerRepository,
  setCareerRepositoryMode,
  resetInMemoryRepository,
  PrismaCareerRepository,
  InMemoryCareerRepository
} from './repository-provider';

/**
 * Dynamic careerRepository instance
 *
 * Proxies all method invocations to the active repository resolved by getCareerRepository().
 * In production/runtime server environments, this dispatches directly to PrismaCareerRepository.
 * In offline/unit tests, setting CAREERQUEST_REPOSITORY_MODE='in-memory' or setCareerRepositoryMode('in-memory')
 * dispatches seamlessly to InMemoryCareerRepository.
 */
export const careerRepository: ICareerRepository = new Proxy({} as ICareerRepository, {
  get(_target, prop: string | symbol) {
    const repo = getCareerRepository();
    const value = (repo as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(repo);
    }
    return value;
  }
});

export {
  getCareerRepository,
  setCareerRepositoryMode,
  resetInMemoryRepository,
  PrismaCareerRepository,
  InMemoryCareerRepository
};
export type { ICareerRepository };
