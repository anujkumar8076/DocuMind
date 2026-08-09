import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export function apiError(
  message: string,
  code: string,
  status = 400,
  details?: unknown,
  headers?: Record<string, string>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: message, code, details },
    { status, headers }
  );
}

export async function requireAuthSession(): Promise<{
  session: Session | null;
  userId: string | null;
  errorResponse: NextResponse<ApiErrorResponse> | null;
}> {
  const session = await getServerSession(authOptions);

  // In development, if no session, allow test demo user; in production, strictly enforce 401
  if (!session?.user?.id) {
    if (process.env.NODE_ENV === 'development') {
      return {
        session: null,
        userId: 'usr_test_demo_01',
        errorResponse: null,
      };
    }

    return {
      session: null,
      userId: null,
      errorResponse: apiError(
        'Authentication required to perform this action.',
        'UNAUTHORIZED',
        401
      ),
    };
  }

  return {
    session,
    userId: session.user.id,
    errorResponse: null,
  };
}
