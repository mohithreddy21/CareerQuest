import { CandidatePreferences } from '@/types/domain';
import { DiscoveryRankingCursorPayload } from './types';

/**
 * Builds a deterministic ranking context key from candidate ID, preference dimensions, and ranking version.
 * If ranking inputs change, the context key changes, safely triggering cursor invalidation.
 */
export function buildRankingContextKey(
  candidateId: string,
  preferences: CandidatePreferences | null | undefined,
  configVersion: string,
  filterContext?: string
): string {
  const parts = [
    candidateId,
    configVersion,
    (preferences?.targetRoles || []).join(','),
    (preferences?.preferredLocations || []).join(','),
    (preferences?.workArrangements || []).join(','),
    preferences?.targetSalaryMin ? String(preferences.targetSalaryMin) : 'none'
  ];

  if (filterContext) {
    parts.push(filterContext);
  }

  // Simple, deterministic base64 context key
  return Buffer.from(parts.join('|')).toString('base64');
}

/**
 * Encodes keyset cursor into a compact, URL-safe base64 string.
 */
export function encodeCursor(payload: DiscoveryRankingCursorPayload): string {
  const jsonStr = JSON.stringify({
    p: payload.p,
    d: payload.d,
    i: payload.i,
    ctx: payload.ctx,
    e: payload.e
  });
  return Buffer.from(jsonStr).toString('base64url');
}

/**
 * Decodes and validates a keyset cursor string.
 * Detects context mismatch or tampering safely without crashing.
 */
export function decodeCursor(
  cursorStr: string,
  expectedContextKey: string
): {
  payload: DiscoveryRankingCursorPayload | null;
  isContextMismatch: boolean;
  error?: string;
} {
  if (!cursorStr || typeof cursorStr !== 'string') {
    return { payload: null, isContextMismatch: false, error: 'Empty cursor' };
  }

  try {
    const jsonStr = Buffer.from(cursorStr, 'base64url').toString('utf-8');
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    if (
      typeof parsed.p !== 'number' ||
      !Number.isFinite(parsed.p) ||
      typeof parsed.i !== 'string' ||
      !parsed.i ||
      (parsed.d !== null && typeof parsed.d !== 'string') ||
      typeof parsed.ctx !== 'string'
    ) {
      return { payload: null, isContextMismatch: false, error: 'Malformed cursor payload' };
    }

    // Validate evaluatedAt timestamp (e or evaluatedAt)
    const rawEval = parsed.e ?? parsed.evaluatedAt;
    if (typeof rawEval !== 'string' || !rawEval.trim()) {
      return {
        payload: null,
        isContextMismatch: false,
        error: 'Missing evaluatedAt timestamp in cursor'
      };
    }

    const evalTime = new Date(rawEval).getTime();
    if (Number.isNaN(evalTime)) {
      return {
        payload: null,
        isContextMismatch: false,
        error: 'Malformed evaluatedAt timestamp in cursor'
      };
    }

    const payload: DiscoveryRankingCursorPayload = {
      p: parsed.p,
      d: parsed.d as string | null,
      i: parsed.i,
      ctx: parsed.ctx,
      e: new Date(evalTime).toISOString()
    };

    if (payload.ctx !== expectedContextKey) {
      return { payload, isContextMismatch: true };
    }

    return { payload, isContextMismatch: false };
  } catch {
    return { payload: null, isContextMismatch: false, error: 'Invalid cursor encoding' };
  }
}

/**
 * Canonical deterministic ordering comparator:
 * 1. Priority DESC
 * 2. postedDate DESC NULLS LAST
 * 3. id ASC (tie-breaker)
 */
export function compareDiscoveryOrder(
  a: { priorityScore: number; postedDate?: Date | string | null; id: string },
  b: { priorityScore: number; postedDate?: Date | string | null; id: string }
): number {
  // 1. Priority DESC
  if (b.priorityScore !== a.priorityScore) {
    return b.priorityScore - a.priorityScore;
  }

  // 2. postedDate DESC NULLS LAST
  const aDate = a.postedDate ? new Date(a.postedDate).getTime() : null;
  const bDate = b.postedDate ? new Date(b.postedDate).getTime() : null;

  if (aDate !== null && bDate !== null) {
    if (bDate !== aDate) {
      return bDate - aDate; // Newest first
    }
  } else if (aDate !== null && bDate === null) {
    return -1; // non-null date before null date
  } else if (aDate === null && bDate !== null) {
    return 1; // null date after non-null date
  }

  // 3. id ASC (mandatory tie-breaker)
  return a.id.localeCompare(b.id);
}

/**
 * Checks if a candidate row is strictly after the keyset cursor in canonical order.
 */
export function isRowAfterCursor(
  row: { priorityScore: number; postedDate?: Date | string | null; id: string },
  cursor: DiscoveryRankingCursorPayload
): boolean {
  // 1. If priority is strictly lower, it comes after cursor
  if (row.priorityScore < cursor.p) {
    return true;
  }
  if (row.priorityScore > cursor.p) {
    return false;
  }

  // Equal priority: check postedDate DESC NULLS LAST
  const rowDate = row.postedDate ? new Date(row.postedDate).getTime() : null;
  const cursorDate = cursor.d ? new Date(cursor.d).getTime() : null;

  if (cursorDate !== null) {
    if (rowDate !== null) {
      if (rowDate < cursorDate) return true;
      if (rowDate > cursorDate) return false;
      // Equal dates: check id ASC
      return row.id > cursor.i;
    }
    // rowDate is null, cursorDate is non-null: row comes after cursor in NULLS LAST
    return true;
  }

  // cursorDate is null (we are in the NULLS portion)
  if (rowDate !== null) {
    // Non-null row comes before null cursor
    return false;
  }

  // Both dates are null: check id ASC
  return row.id > cursor.i;
}
