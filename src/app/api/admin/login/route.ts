import { NextRequest } from 'next/server';
import { loginAdmin } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const res = await loginAdmin(String(body.email || ''), String(body.password || ''));
    if (!res.ok) return jsonError(new Error(res.error || 'Authentication failed.'), 401);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}

