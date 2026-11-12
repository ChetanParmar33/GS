import { NextRequest } from 'next/server';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const code = String(req.nextUrl.searchParams.get('code') || '').trim();
    if (!code) return jsonError(new Error('Booking code is required.'), 400);

    const booking = await getRepository().getBookingByCode(code);
    if (!booking) return jsonError(new Error('Booking not found.'), 404);

    // Return non-PII status fields only
    return jsonOk({
      bookingCode: booking.bookingCode,
      bookingType: booking.bookingType,
      slotTier: booking.slotTier,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      stationName: booking.stationName,
      date: booking.date,
      endDate: booking.endDate,
      startHour: booking.startHour,
      endHour: booking.endHour,
      duration: booking.duration,
      totalAmount: booking.totalAmount
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

