import { NextRequest } from 'next/server';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk, requireAdmin } from '@/lib/api-utils';
import type { AdminSettings } from '@/types/booking';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const patch = (await req.json()) as Partial<AdminSettings>;
    const settings = await getRepository().updateSettings(patch);
    return jsonOk({ settings });
  } catch (err) {
    return jsonError(err, 400);
  }
}

