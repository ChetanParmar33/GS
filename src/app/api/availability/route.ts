import { NextRequest } from 'next/server';
import { getKolkataNowParts } from '@/lib/booking-rules';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const mode = req.nextUrl.searchParams.get('mode') === 'rental' ? 'rental' : 'slot';
    const dateParam = req.nextUrl.searchParams.get('date') || getKolkataNowParts().dateStr;
    const durationRaw = Number(req.nextUrl.searchParams.get('duration') || '1');
    const maxDur = mode === 'rental' ? 7 : 4;
    const duration =
      Number.isInteger(durationRaw) && durationRaw >= 1 && durationRaw <= maxDur ? durationRaw : 1;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return jsonError(new Error('Invalid date format. Expected YYYY-MM-DD.'), 400);
    }

    const repo = getRepository();
    const payload = await repo.getAvailability(dateParam, duration, mode);
    return jsonOk(payload);
  } catch (err) {
    return jsonError(err, 400);
  }
}

