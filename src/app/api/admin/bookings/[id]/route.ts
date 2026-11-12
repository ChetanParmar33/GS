import { NextRequest } from 'next/server';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk, requireAdmin } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const patch = (await req.json()) as Record<string, unknown>;
    const booking = await getRepository().updateBooking(id, patch);
    return jsonOk({ booking });
  } catch (err) {
    return jsonError(err, 400);
  }
}

