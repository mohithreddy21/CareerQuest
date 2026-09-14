import { NextRequest, NextResponse } from 'next/server';
import { requireCandidateId } from '@/lib/auth';
import { DocumentService } from '@/features/documents/services/document.service';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
): Promise<NextResponse> {
  try {
    const candidateId = await requireCandidateId({ redirectOnUnauthenticated: false });
    const { documentId } = await context.params;

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const { buffer, mimeType, filename } = await DocumentService.getDocumentForDownload(
      candidateId,
      documentId
    );

    const safeFilename = filename.replace(/["\r\n]/g, '_');

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    if (message.includes('UNAUTHENTICATED') || message.includes('Candidate identity required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('not found') || message.includes('unauthorized')) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
