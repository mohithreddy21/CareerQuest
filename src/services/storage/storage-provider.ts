import { IObjectStorage } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';

export class ProductionStorageConfigurationError extends Error {
  constructor(
    message = 'Production object storage is not configured. Local filesystem storage is prohibited in production.'
  ) {
    super(message);
    this.name = 'ProductionStorageConfigurationError';
  }
}

let testStorageAdapter: IObjectStorage | null = null;
let defaultStorageInstance: IObjectStorage | null = null;

/**
 * For testing purposes only: override the storage adapter.
 */
export function setStorageAdapterForTest(adapter: IObjectStorage | null): void {
  testStorageAdapter = adapter;
}

/**
 * Get the configured IObjectStorage instance.
 * Strictly enforces that LocalStorageAdapter is never used silently in production.
 */
export function getStorage(): IObjectStorage {
  if (testStorageAdapter) {
    return testStorageAdapter;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const storageProvider = process.env.STORAGE_PROVIDER; // e.g. 's3', 'r2', 'gcs'

  if (isProduction) {
    if (!storageProvider || storageProvider === 'local') {
      throw new ProductionStorageConfigurationError(
        'Production object storage is not configured. Set STORAGE_PROVIDER to a supported cloud provider and configure credentials.'
      );
    }
    // Future cloud providers (e.g. S3 / R2) will be instantiated here without altering domain logic.
    throw new ProductionStorageConfigurationError(
      `Production storage provider '${storageProvider}' is not yet initialized.`
    );
  }

  if (typeof window !== 'undefined') {
    throw new Error('Local filesystem storage adapter cannot be initialized in browser context.');
  }

  if (!defaultStorageInstance) {
    defaultStorageInstance = new LocalStorageAdapter();
  }

  return defaultStorageInstance;
}
