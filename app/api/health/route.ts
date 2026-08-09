import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const status: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      database: 'unknown',
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    status.services.database = 'connected';
  } catch (error: any) {
    status.status = 'degraded';
    status.services.database = `disconnected: ${error.message}`;
  }

  return NextResponse.json(status, {
    status: status.status === 'ok' ? 200 : 503,
  });
}
