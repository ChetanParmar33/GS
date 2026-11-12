import { NextRequest } from 'next/server';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk, requireAdmin } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await getRepository().deleteBlock(id);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}

