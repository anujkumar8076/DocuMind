import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthSession, apiError } from '@/lib/api/response';

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireAuthSession();
    if (auth.errorResponse || !auth.userId) {
      return auth.errorResponse!;
    }
    const userId = auth.userId;

    const documents = await prisma.document.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            chunks: true,
            conversations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}
