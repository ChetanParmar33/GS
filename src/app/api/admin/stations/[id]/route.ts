import { NextRequest } from 'next/server';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk, requireAdmin } from '@/lib/api-utils';
import type { StationStatus } from '@/types/booking';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = (await req.json()) as { status?: StationStatus; note?: string; name?: string };
    const station = await getRepository().updateStation(Number(id), body);
    return jsonOk({ station });
  } catch (err) {
    return jsonError(err, 400);
  }
}

