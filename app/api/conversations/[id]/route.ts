import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
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

    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        document: true,
      },
    });

    if (!conversation) {
      return apiError('Conversation not found', 'CONVERSATION_NOT_FOUND', 404);
    }

    if (conversation.userId !== userId) {
      return apiError('Forbidden: Access denied', 'FORBIDDEN', 403);
    }

    return NextResponse.json({ conversation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}
