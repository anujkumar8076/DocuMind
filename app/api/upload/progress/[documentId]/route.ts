import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { documentId: string } }
) {
  const { documentId } = params;

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (data: any) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // Connection closed
    }
  };

  // Poll database status periodically
  const interval = setInterval(async () => {
    try {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          status: true,
          pageCount: true,
          chunkCount: true,
          tokenCount: true,
          errorMessage: true,
        },
      });

      if (!doc) {
        await sendEvent({ status: 'NOT_FOUND' });
        clearInterval(interval);
        await writer.close();
        return;
      }

      await sendEvent(doc);

      if (doc.status === 'READY' || doc.status === 'ERROR') {
        clearInterval(interval);
        await writer.close();
      }
    } catch {
      clearInterval(interval);
      try {
        await writer.close();
      } catch {
        // Ignore
      }
    }
  }, 1000);

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
