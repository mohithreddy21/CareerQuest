import { NextResponse } from 'next/server';
import { requireCandidateId } from '@/lib/auth';
import { knowledgeBankService } from '@/features/knowledge/services/knowledge-bank-service';

export async function GET(): Promise<NextResponse> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const bank = await knowledgeBankService.getKnowledgeBank(candidateId);
    return NextResponse.json(bank, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
