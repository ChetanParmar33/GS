import { NextRequest } from 'next/server';
import { getKolkataNowParts } from '@/lib/booking-rules';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk, requireAdmin } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const dateParam = req.nextUrl.searchParams.get('date') || getKolkataNowParts().dateStr;
    const repo = getRepository();
    const [stats, settings, stations, bookings, blocks] = await Promise.all([
      repo.getStats(),
      repo.getSettings(),
      repo.getStations(),
      repo.listBookings(),
      repo.listBlocks(dateParam)
    ]);
    return jsonOk({ stats, settings, stations, bookings, blocks, scheduleDate: dateParam, dbMode: repo.mode });
  } catch (err) {
    return jsonError(err, 500);
  }
}

