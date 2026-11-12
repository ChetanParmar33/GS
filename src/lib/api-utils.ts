import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export function jsonOk<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

export function jsonError(err: unknown, status: number = 400): NextResponse {
  const message = err instanceof Error ? err.message : 'Unexpected server error.';
  return NextResponse.json({ error: message }, { status });
}

export async function requireAdmin(): Promise<
  | { ok: true; email?: string; mode: 'supabase' | 'local' }
  | { ok: false; response: NextResponse }
> {
  const session = await getAdminSession();
  if (!session.authenticated) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized. Admin login required.' }, { status: 401 })
    };
  }
  return { ok: true, email: session.email, mode: session.mode };
}

