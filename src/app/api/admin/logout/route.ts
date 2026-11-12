import { logoutAdmin } from '@/lib/auth';
import { jsonError, jsonOk } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await logoutAdmin();
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}

