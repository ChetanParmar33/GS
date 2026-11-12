import { getRepository } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repo = getRepository();
    const settings = await repo.getSettings();
    return jsonOk({ settings, dbMode: repo.mode });
  } catch (err) {
    return jsonError(err, 500);
  }
}

