import { IObjectStorage, StorageGetResult, StoragePutResult } from './storage.interface';

// Safe runtime resolution for Node.js built-ins that prevents Next.js / Turbopack
// from attempting to trace and bundle node:fs/promises into browser client chunks.
function getNodeFs(): typeof import('node:fs/promises') {
  if (typeof window !== 'undefined') {
    throw new Error('LocalStorageAdapter is not supported in browser environment');
  }
  const proc = process as unknown as {
    getBuiltinModule: (id: string) => typeof import('node:fs/promises');
  };
  return proc.getBuiltinModule('node:fs/promises');
}

function getNodePath(): typeof import('node:path') {
  if (typeof window !== 'undefined') {
    throw new Error('LocalStorageAdapter is not supported in browser environment');
  }
  const proc = process as unknown as {
    getBuiltinModule: (id: string) => typeof import('node:path');
  };
  return proc.getBuiltinModule('node:path');
}

export class LocalStorageAdapter implements IObjectStorage {
  private readonly rootDir: string;
  private readonly fs = getNodeFs();
  private readonly path = getNodePath();

  constructor(rootDir?: string) {
    const p = this.path;
    this.rootDir = p.resolve(rootDir || p.join(process.cwd(), '.storage'));
  }

  private resolveSafePath(key: string): string {
    // Prevent path traversal
    const normalizedKey = this.path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = this.path.resolve(this.rootDir, normalizedKey);

    if (!fullPath.startsWith(this.rootDir)) {
      throw new Error('Access denied: Path traversal detected in storage key');
    }

    return fullPath;
  }

  async put(key: string, buffer: Buffer, mimeType: string): Promise<StoragePutResult> {
    const filePath = this.resolveSafePath(key);
    const dir = this.path.dirname(filePath);

    await this.fs.mkdir(dir, { recursive: true });
    await this.fs.writeFile(filePath, buffer);

    // Save lightweight metadata sidecar for MIME type preservation
    const metaPath = `${filePath}.meta.json`;
    await this.fs.writeFile(
      metaPath,
      JSON.stringify(
        { mimeType, size: buffer.length, updatedAt: new Date().toISOString() },
        null,
        2
      ),
      'utf-8'
    );

    return {
      key,
      size: buffer.length,
      mimeType
    };
  }

  async get(key: string): Promise<StorageGetResult> {
    const filePath = this.resolveSafePath(key);

    try {
      const buffer = await this.fs.readFile(filePath);
      let mimeType = 'application/octet-stream';

      try {
        const metaPath = `${filePath}.meta.json`;
        const metaContent = await this.fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent);
        if (meta.mimeType) {
          mimeType = meta.mimeType;
        }
      } catch {
        // If meta doesn't exist, fall back to octet-stream
      }

      return {
        key,
        buffer,
        mimeType,
        size: buffer.length
      };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Storage object not found: ${key}`, { cause: err });
      }

      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    try {
      await this.fs.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    try {
      await this.fs.unlink(`${filePath}.meta.json`);
    } catch {
      // Ignore missing meta file
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveSafePath(key);
    try {
      await this.fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
