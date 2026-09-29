import { NextResponse } from 'next/server';
import { requireCandidateId } from '@/lib/auth';
import { getUserSettings } from '@/features/settings/api/service';

export async function GET(): Promise<NextResponse> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const settings = await getUserSettings(candidateId);
    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
