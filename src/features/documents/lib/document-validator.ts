import * as crypto from 'node:crypto';

export interface ValidatedDocumentFile {
  buffer: Buffer;
  filename: string;
  sanitizedFilename: string;
  mimeType: string;
  size: number;
  hash: string;
}

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

/**
 * Validate magic bytes / file signatures to prevent disguised executables or malicious files.
 */
export function validateFileSignature(buffer: Buffer, mimeType: string, filename: string): boolean {
  if (buffer.length < 4) return false;

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

  // PDF signature: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // DOCX signature: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  // Plain text: cannot contain null bytes (0x00)
  if (mimeType === 'text/plain' || ext === '.txt') {
    for (let i = 0; i < Math.min(buffer.length, 512); i++) {
      if (buffer[i] === 0x00) return false;
    }
    return true;
  }

  return false;
}

/**
 * Sanitize a user-provided filename to prevent path traversal and unsafe character execution.
 */
export function sanitizeFilename(rawFilename: string): string {
  // Extract basename without any directory paths
  const baseName = rawFilename.split(/[/\\]/).pop() || 'document';

  // Extract extension
  const dotIndex = baseName.lastIndexOf('.');
  const namePart = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
  const extPart = dotIndex > 0 ? baseName.slice(dotIndex).toLowerCase() : '';

  // Clean name part: allow only alphanumeric, underscores, hyphens
  const cleanName = namePart.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || 'document';
  const cleanExt = extPart.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);

  return `${cleanName}${cleanExt}`;
}

/**
 * Validate document upload against size, MIME, magic signature, and extension rules.
 */
export function validateDocumentUpload(
  buffer: Buffer,
  filename: string,
  claimedMimeType?: string
): ValidatedDocumentFile {
  if (!buffer || buffer.length === 0) {
    throw new Error('File content is empty');
  }

  if (buffer.length > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)}MB) exceeds the maximum allowed limit of 10MB`
    );
  }

  const sanitized = sanitizeFilename(filename);
  const ext = sanitized.slice(sanitized.lastIndexOf('.')).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file extension: ${ext || 'none'}. Allowed extensions: .pdf, .docx, .txt`
    );
  }

  // Determine canonical MIME type
  let canonicalMime = claimedMimeType || 'application/octet-stream';
  if (ext === '.pdf') canonicalMime = 'application/pdf';
  else if (ext === '.docx')
    canonicalMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else if (ext === '.txt') canonicalMime = 'text/plain';

  if (!ALLOWED_MIME_TYPES.has(canonicalMime)) {
    throw new Error(`Unsupported file MIME type: ${canonicalMime}`);
  }

  // Validate magic bytes
  const isValidSignature = validateFileSignature(buffer, canonicalMime, sanitized);
  if (!isValidSignature) {
    throw new Error('File signature does not match the claimed file type');
  }

  // Calculate SHA-256 hash for integrity and deduplication
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    buffer,
    filename,
    sanitizedFilename: sanitized,
    mimeType: canonicalMime,
    size: buffer.length,
    hash
  };
}
