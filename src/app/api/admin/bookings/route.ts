import { NextRequest } from 'next/server';
import { getRepository } from '@/lib/db';
import { jsonError, jsonOk, requireAdmin } from '@/lib/api-utils';
import { normalizePaymentMethodForType, normalizeSlotTier } from '@/lib/booking-rules';
import type { BookingStatus } from '@/types/booking';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const search = req.nextUrl.searchParams.get('search') || undefined;
    const date = req.nextUrl.searchParams.get('date') || undefined;
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const bookings = await getRepository().listBookings({ search, date, status });
    return jsonOk({ bookings });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const stationChoice = body.stationChoice === 'auto' ? 'auto' : Number(body.stationChoice);
    const bookingType = body.bookingType === 'rental' ? 'rental' : 'slot';
    const booking = await getRepository().createBooking({
      bookingType,
      slotTier: bookingType === 'slot' ? normalizeSlotTier(body.slotTier) : 'regular',
      customerName: String(body.customerName || ''),
      mobile: String(body.mobile || ''),
      players: Number(body.players || 1),
      date: String(body.date || ''),
      startHour: Number(body.startHour),
      duration: Number(body.duration),
      stationChoice,
      paymentMethod: normalizePaymentMethodForType(bookingType, body.paymentMethod, true),
      upiRef: String(body.upiRef || ''),
      status: (String(body.status || 'Confirmed') as BookingStatus),
      paymentStatus: String(body.paymentStatus || 'Paid at Shop'),
      notes: String(body.notes || ''),
      isAdminManual: true
    });
    return jsonOk({ booking }, 201);
  } catch (err) {
    return jsonError(err, 400);
  }
}

