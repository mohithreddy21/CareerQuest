import { IObjectStorage, StorageGetResult, StoragePutResult } from './storage.interface';

interface MemoryObject {
  buffer: Buffer;
  mimeType: string;
  size: number;
  updatedAt: Date;
}

export class MemoryStorageAdapter implements IObjectStorage {
  private storage = new Map<string, MemoryObject>();

  async put(key: string, buffer: Buffer, mimeType: string): Promise<StoragePutResult> {
    this.storage.set(key, {
      buffer: Buffer.from(buffer),
      mimeType,
      size: buffer.length,
      updatedAt: new Date()
    });

    return {
      key,
      size: buffer.length,
      mimeType
    };
  }

  async get(key: string): Promise<StorageGetResult> {
    const item = this.storage.get(key);
    if (!item) {
      throw new Error(`Storage object not found: ${key}`);
    }

    return {
      key,
      buffer: Buffer.from(item.buffer),
      mimeType: item.mimeType,
      size: item.size
    };
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  clear(): void {
    this.storage.clear();
  }

  get keys(): string[] {
    return Array.from(this.storage.keys());
  }
}
