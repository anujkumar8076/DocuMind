import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { deleteDocumentVectors } from '@/lib/pinecone/client';
import { deleteDocumentFromS3 } from '@/lib/storage/s3';
import { requireAuthSession, apiError } from '@/lib/api/response';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuthSession();
    if (auth.errorResponse || !auth.userId) {
      return auth.errorResponse!;
    }
    const userId = auth.userId;

    const document = await prisma.document.findUnique({
      where: { id: params.id },
      include: {
        chunks: {
          take: 50,
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!document) {
      return apiError('Document not found', 'DOCUMENT_NOT_FOUND', 404);
    }

    if (document.userId !== userId) {
      return apiError('Forbidden: Access denied to document', 'FORBIDDEN', 403);
    }

    return NextResponse.json({ document });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuthSession();
    if (auth.errorResponse || !auth.userId) {
      return auth.errorResponse!;
    }
    const userId = auth.userId;

    const document = await prisma.document.findUnique({
      where: { id: params.id },
    });

    if (!document) {
      return apiError('Document not found', 'DOCUMENT_NOT_FOUND', 404);
    }

    if (document.userId !== userId) {
      return apiError('Forbidden: Access denied', 'FORBIDDEN', 403);
    }

    // 1. Delete vectors from Pinecone
    try {
      await deleteDocumentVectors(document.id, userId);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Pinecone deletion error';
      console.warn('Pinecone vector deletion warning:', errorMsg);
    }

    // 2. Delete file from S3
    try {
      await deleteDocumentFromS3(document.s3Key);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'S3 deletion error';
      console.warn('S3 deletion warning:', errorMsg);
    }

    // 3. Delete Document record in DB (cascades to chunks)
    await prisma.document.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Document and vectors deleted successfully.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}
