import { NextRequest } from 'next/server';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/api-utils';
import { normalizePaymentMethodForType, normalizeSlotTier } from '@/lib/booking-rules';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const stationRaw = body.stationChoice;
    const stationChoice: 'auto' | number =
      stationRaw === 'auto' ? 'auto' : Number(stationRaw);

    if (stationChoice !== 'auto' && (!Number.isInteger(stationChoice) || stationChoice < 1)) {
      return jsonError(new Error('Select a valid PS5 station or Auto Assign.'), 400);
    }

    const repo = getRepository();
    const bookingType = body.bookingType === 'rental' ? 'rental' : 'slot';
    const playersRaw = body.players !== undefined ? Number(body.players) : 1;
    const booking = await repo.createBooking({
      bookingType,
      slotTier: bookingType === 'slot' ? normalizeSlotTier(body.slotTier) : 'regular',
      customerName: String(body.customerName || ''),
      mobile: String(body.mobile || ''),
      players: Number.isInteger(playersRaw) && playersRaw >= 1 && playersRaw <= 4 ? playersRaw : 1,
      date: String(body.date || ''),
      startHour: Number(body.startHour),
      duration: Number(body.duration),
      stationChoice,
      paymentMethod: normalizePaymentMethodForType(bookingType, body.paymentMethod, false),
      upiRef: String(body.upiRef || ''),
      isAdminManual: false
    });

    const settings = await repo.getSettings();
    return jsonOk({ booking, settings }, 201);
  } catch (err) {
    return jsonError(err, 400);
  }
}

