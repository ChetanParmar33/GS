import { getAdminSession } from '@/lib/auth';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAdminSession();
    const repo = getRepository();
    return jsonOk({
      authenticated: session.authenticated,
      email: session.email || null,
      authMode: session.mode,
      dbMode: repo.mode
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

