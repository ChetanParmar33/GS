import { NextRequest } from 'next/server';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk, requireAdmin } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const date = req.nextUrl.searchParams.get('date') || undefined;
    const blocks = await getRepository().listBlocks(date);
    return jsonOk({ blocks });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const block = await getRepository().createBlock({
      stationId: Number(body.stationId),
      date: String(body.date || ''),
      startHour: Number(body.startHour),
      endHour: Number(body.endHour),
      reason: String(body.reason || 'Manual Block / Maintenance')
    });
    return jsonOk({ block }, 201);
  } catch (err) {
    return jsonError(err, 400);
  }
}

