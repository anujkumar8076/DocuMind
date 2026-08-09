import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { processDocument } from '@/lib/rag/pipeline';
import { checkRateLimit } from '@/lib/rateLimit';
import { requireAuthSession, apiError } from '@/lib/api/response';
import { z } from 'zod';
import { DocumentStatus } from '@prisma/client';

const ProcessSchema = z.object({
  documentId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthSession();
    if (auth.errorResponse || !auth.userId) {
      return auth.errorResponse!;
    }
    const userId = auth.userId;

    // Rate limit ingestion triggers (max 15 requests per minute per user)
    const rateCheck = await checkRateLimit(`process:${userId}`, 15, 60);
    if (!rateCheck.success) {
      return apiError(
        'Too many document processing requests. Please wait a moment before trying again.',
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('Malformed JSON payload', 'INVALID_JSON', 400);
    }

    const validated = ProcessSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Invalid document ID', 'VALIDATION_FAILED', 400);
    }

    const { documentId } = validated.data;

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return apiError('Document not found', 'DOCUMENT_NOT_FOUND', 404);
    }

    // Strict ownership verification
    if (doc.userId !== userId) {
      return apiError('Forbidden: You do not own this document.', 'FORBIDDEN', 403);
    }

    // Set status to PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.PROCESSING, errorMessage: null },
    });

    // Trigger async processing in background
    processDocument(documentId).catch((err: unknown) => {
      const errorMsg = err instanceof Error ? err.message : 'Unknown ingestion error';
      console.error(`Background ingestion failure for document ${documentId}:`, errorMsg);
    });

    return NextResponse.json(
      {
        message: 'Document processing initiated successfully.',
        documentId,
        status: DocumentStatus.PROCESSING,
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}
