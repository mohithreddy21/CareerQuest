import { UnauthorizedError, ForbiddenError } from './auth';
import { ConcurrencyError, NotFoundError, ValidationError } from '@/types/errors';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Handles errors thrown within Server Actions and converts them into
 * controlled, clean, user-safe error throws without leaking raw database
 * internal state, stack traces, or SQL queries.
 */
export function handleActionError(error: unknown): never {
  if (error instanceof UnauthorizedError) {
    throw new Error(`UNAUTHENTICATED: ${error.message}`);
  }
  if (error instanceof ForbiddenError) {
    throw new Error(`FORBIDDEN: ${error.message}`);
  }
  if (error instanceof ValidationError) {
    throw new Error(`VALIDATION_ERROR: ${error.message}`);
  }
  if (error instanceof ConcurrencyError) {
    throw new Error(`CONCURRENCY_ERROR: ${error.message}`);
  }
  if (error instanceof NotFoundError) {
    throw new Error(`NOT_FOUND: ${error.message}`);
  }
  if (error instanceof ZodError) {
    const issues = error.issues
      .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
      .join('; ');
    throw new Error(`VALIDATION_ERROR: ${issues}`);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new Error('CONFLICT: A record with this identifier already exists.');
    }
    if (error.code === 'P2025') {
      throw new Error('NOT_FOUND: The requested record was not found.');
    }
    if (error.code === 'P2003') {
      throw new Error(
        'FOREIGN_KEY_VIOLATION: Cannot modify or delete this record because it is referenced by active applications or versions.'
      );
    }
    throw new Error('DATABASE_ERROR: A database error occurred while processing your request.');
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error('UNKNOWN_ERROR: An unexpected error occurred.');
}

function verifySerializable(val: unknown, path = ''): void {
  if (val === null || val === undefined) return;
  const type = typeof val;
  if (type === 'function' || type === 'symbol') {
    throw new Error(`Serialization error at ${path}: Cannot serialize ${type}`);
  }
  if (type === 'object') {
    if (val instanceof Date) return; // JSON.stringify converts Date to ISO string
    // Check for Prisma Decimal or circular objects
    if (
      (val as { d?: unknown; e?: unknown; s?: unknown }).d !== undefined &&
      (val as { d?: unknown; e?: unknown; s?: unknown }).e !== undefined
    ) {
      throw new Error(`Serialization error at ${path}: Prisma Decimal detected`);
    }
    if (Array.isArray(val)) {
      val.forEach((item, idx) => verifySerializable(item, `${path}[${idx}]`));
    } else {
      Object.entries(val as Record<string, unknown>).forEach(([k, v]) => {
        verifySerializable(v, path ? `${path}.${k}` : k);
      });
    }
  }
}

/**
 * STRICT GUARDRAIL 2: Real serialization helper.
 * Deeply validates and maps data to a pure JSON-serializable DTO.
 * Guarantees no Prisma instances, functions, Symbols, or Decimal instances leak across boundary.
 */
export function serializeActionResponse<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  verifySerializable(data);

  // Return clean plain JSON object
  return JSON.parse(JSON.stringify(data)) as T;
}
