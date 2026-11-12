import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_RENTAL_PRICES,
  DEFAULT_SETTINGS,
  DEFAULT_SLOT_PRICES,
  buildAvailabilityPayload,
  computeDashboardStats,
  evaluateStationRental,
  evaluateStationSlot,
  getKolkataNowParts,
  getRentalEndDate,
  getRentalPackagePrice,
  getRentalPaymentBreakdown,
  getSlotPriceForTier,
  isRentalRangeBookable,
  normalizeIndianMobile,
  normalizePaymentMethodForType,
  normalizeSlotTier
} from '@/lib/booking-rules';
import type {
  AdminSettings,
  AvailabilityPayload,
  BookingRecord,
  BookingStatus,
  BookingType,
  DashboardStats,
  PaymentMethod,
  SlotTier,
  Station,
  StationBlock,
  StationStatus
} from '@/types/booking';
import type {
  CreateBlockInput,
  CreateBookingInput,
  GameZoneRepository,
  UpdateBookingInput
} from '@/lib/db/types';

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase server environment variables are missing.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function parseSupabasePriceMap(raw: unknown, fallback: Record<string, number>): Record<string, number> {
  const out = { ...fallback };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(fallback)) {
    const val = Number((raw as Record<string, unknown>)[k]);
    if (Number.isFinite(val) && val > 0) out[k] = Math.round(val);
  }
  return out;
}

function mapSettingsRow(row: Record<string, unknown> | null): AdminSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  const slotPrices = parseSupabasePriceMap(row.slot_prices, DEFAULT_SLOT_PRICES);
  const hourlyPrice = Number(row.hourly_price ?? slotPrices['1'] ?? DEFAULT_SETTINGS.hourlyPrice);
  if (!row.slot_prices) slotPrices['1'] = hourlyPrice;
  return {
    shopName: String(row.shop_name ?? DEFAULT_SETTINGS.shopName),
    address: String(row.address ?? DEFAULT_SETTINGS.address),
    contactNumber: String(row.contact_number ?? ''),
    whatsappNumber: String(row.whatsapp_number ?? ''),
    instagramHandle: String(row.instagram_handle ?? DEFAULT_SETTINGS.instagramHandle),
    instagramUrl: String(row.instagram_url ?? DEFAULT_SETTINGS.instagramUrl),
    googleMapsUrl: String(row.google_maps_url ?? ''),
    openingHour: Number(row.opening_hour ?? DEFAULT_SETTINGS.openingHour),
    closingHour: Number(row.closing_hour ?? DEFAULT_SETTINGS.closingHour),
    hourlyPrice,
    regularHourlyPrice: Math.max(1, Number(row.regular_hourly_price ?? DEFAULT_SETTINGS.regularHourlyPrice)),
    g29HourlyPrice: Math.max(1, Number(row.g29_hourly_price ?? DEFAULT_SETTINGS.g29HourlyPrice)),
    slotPrices,
    rentalPrices: parseSupabasePriceMap(row.rental_prices, DEFAULT_RENTAL_PRICES),
    rentalCodFee: Math.max(1, Number(row.rental_cod_fee ?? DEFAULT_SETTINGS.rentalCodFee)),
    stationCount: Number(row.station_count ?? DEFAULT_SETTINGS.stationCount),
    minBookingDate: String(row.min_booking_date ?? ''),
    maxBookingDate: String(row.max_booking_date ?? DEFAULT_SETTINGS.maxBookingDate),
    closedDates: Array.isArray(row.closed_dates) ? row.closed_dates.map(String) : [],
    holdPendingSlots: Boolean(row.hold_pending_slots ?? true),
    pendingHoldMinutes: Number(row.pending_hold_minutes ?? 15),
    upiEnabled: Boolean(row.upi_enabled ?? false),
    upiId: String(row.upi_id ?? ''),
    upiAccountName: String(row.upi_account_name ?? ''),
    upiInstructions: String(row.upi_instructions ?? DEFAULT_SETTINGS.upiInstructions),
    cancellationRules: String(row.cancellation_rules ?? DEFAULT_SETTINGS.cancellationRules)
  };
}

function mapStationRow(row: Record<string, unknown>): Station {
  return {
    id: Number(row.id),
    name: String(row.name),
    status: String(row.status) as StationStatus,
    note: String(row.note ?? '')
  };
}

function mapBlockRow(row: Record<string, unknown>): StationBlock {
  return {
    id: String(row.id),
    stationId: Number(row.station_id),
    date: String(row.block_date),
    startHour: Number(row.start_hour),
    endHour: Number(row.end_hour),
    reason: String(row.reason ?? ''),
    createdAt: String(row.created_at)
  };
}

function mapBookingRow(row: Record<string, unknown>): BookingRecord {
  const date = String(row.booking_date);
  return {
    id: String(row.id),
    bookingCode: String(row.booking_code),
    bookingType: row.booking_type === 'rental' ? 'rental' : 'slot',
    slotTier: row.slot_tier === 'g29' ? 'g29' : 'regular',
    customerId: String(row.customer_id),
    customerName: String(row.customer_name),
    mobile: String(row.mobile),
    players: Number(row.players),
    stationId: Number(row.station_id),
    stationName: String(row.station_name),
    date,
    endDate: String(row.end_date || date),
    startHour: Number(row.start_hour),
    endHour: Number(row.end_hour),
    duration: Number(row.duration),
    hourlyPriceSnapshot: Number(row.hourly_price_snapshot),
    totalAmount: Number(row.total_amount),
    paymentMethod: String(row.payment_method) as PaymentMethod,
    paymentStatus: String(row.payment_status),
    upiRef: String(row.upi_ref ?? ''),
    status: String(row.status) as BookingStatus,
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export const supabaseRepository: GameZoneRepository = {
  mode: 'supabase',

  async getSettings(): Promise<AdminSettings> {
    const sb = getServiceClient();
    const { data, error } = await sb.from('admin_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw new Error(error.message);
    return mapSettingsRow(data);
  },

  async updateSettings(patch: Partial<AdminSettings>): Promise<AdminSettings> {
    const sb = getServiceClient();
    const cur = await this.getSettings();
    const next: AdminSettings = { ...cur, ...patch };
    if (next.closingHour <= next.openingHour) {
      throw new Error('Closing hour must be after opening hour.');
    }

    const { data, error } = await sb
      .from('admin_settings')
      .update({
        shop_name: next.shopName,
        address: next.address,
        contact_number: next.contactNumber,
        whatsapp_number: next.whatsappNumber,
        instagram_handle: next.instagramHandle,
        instagram_url: next.instagramUrl,
        google_maps_url: next.googleMapsUrl,
        opening_hour: next.openingHour,
        closing_hour: next.closingHour,
        hourly_price: next.hourlyPrice,
        regular_hourly_price: Math.max(1, Math.round(Number(next.regularHourlyPrice) || 69)),
        g29_hourly_price: Math.max(1, Math.round(Number(next.g29HourlyPrice) || 149)),
        slot_prices: next.slotPrices,
        rental_prices: next.rentalPrices,
        rental_cod_fee: Math.max(1, Math.round(Number(next.rentalCodFee) || 99)),
        station_count: next.stationCount,
        min_booking_date: next.minBookingDate,
        max_booking_date: next.maxBookingDate,
        closed_dates: next.closedDates,
        hold_pending_slots: next.holdPendingSlots,
        pending_hold_minutes: next.pendingHoldMinutes,
        upi_enabled: next.upiEnabled,
        upi_id: next.upiId,
        upi_account_name: next.upiAccountName,
        upi_instructions: next.upiInstructions,
        cancellation_rules: next.cancellationRules,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1)
      .select()
      .single();

    if (error) throw new Error(error.message);

    for (let i = 1; i <= next.stationCount; i++) {
      await sb
        .from('stations')
        .upsert({ id: i, name: `PS5 Station ${i}`, status: 'active' }, { onConflict: 'id', ignoreDuplicates: true });
    }

    return mapSettingsRow(data);
  },

  async getStations(): Promise<Station[]> {
    const sb = getServiceClient();
    const settings = await this.getSettings();
    const { data, error } = await sb
      .from('stations')
      .select('*')
      .lte('id', settings.stationCount)
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(mapStationRow);
  },

  async updateStation(
    id: number,
    patch: { status?: StationStatus; note?: string; name?: string }
  ): Promise<Station> {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('stations')
      .update({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapStationRow(data);
  },

  async getAvailability(
    dateStr: string,
    duration: number,
    mode: BookingType = 'slot'
  ): Promise<AvailabilityPayload> {
    const sb = getServiceClient();
    const settings = await this.getSettings();
    const endDateStr = mode === 'rental' ? getRentalEndDate(dateStr, duration) : dateStr;

    const [{ data: stationRows, error: sErr }, { data: blockRows, error: blErr }, { data: bookingRows, error: bkErr }] =
      await Promise.all([
        sb.from('stations').select('*').lte('id', settings.stationCount).order('id', { ascending: true }),
        sb.from('station_blocks').select('*').gte('block_date', dateStr).lte('block_date', endDateStr),
        sb
          .from('bookings')
          .select('*')
          .neq('status', 'Cancelled')
          .or(
            `and(booking_date.gte.${dateStr},booking_date.lte.${endDateStr}),and(booking_type.eq.rental,booking_date.lte.${endDateStr},end_date.gte.${dateStr})`
          )
      ]);

    if (sErr) throw new Error(sErr.message);
    if (blErr) throw new Error(blErr.message);
    if (bkErr) throw new Error(bkErr.message);

    return buildAvailabilityPayload(
      dateStr,
      duration,
      (stationRows || []).map(mapStationRow),
      (blockRows || []).map(mapBlockRow),
      (bookingRows || []).map(mapBookingRow),
      settings,
      getKolkataNowParts(),
      mode
    );
  },

  async createBooking(input: CreateBookingInput): Promise<BookingRecord> {
    const sb = getServiceClient();
    const bookingType: BookingType = input.bookingType === 'rental' ? 'rental' : 'slot';
    const mobile = normalizeIndianMobile(input.mobile);
    if (!mobile) throw new Error('Enter a valid 10-digit Indian mobile number.');
    const customerName = String(input.customerName || '').trim();
    if (customerName.length < 2) throw new Error('Enter customer full name.');

    const settings = await this.getSettings();
    const duration = Number(input.duration);
    if (bookingType === 'rental') {
      if (!Number.isInteger(duration) || duration < 1 || duration > 7) {
        throw new Error('Rental duration must be 1 to 7 days.');
      }
      const rCheck = isRentalRangeBookable(input.date, duration, settings);
      if (!rCheck.ok) throw new Error(rCheck.reason || 'Rental dates unavailable.');
    }

    const startHour = bookingType === 'rental' ? settings.openingHour : Number(input.startHour);
    const slotTier: SlotTier = bookingType === 'slot' ? normalizeSlotTier(input.slotTier) : 'regular';
    const totalAmount =
      bookingType === 'rental'
        ? getRentalPackagePrice(duration, settings)
        : getSlotPriceForTier(duration, slotTier, settings);

    const isAdminManual = Boolean(input.isAdminManual);
    const upiRef = String(input.upiRef || '').trim();
    const paymentMethod: PaymentMethod = normalizePaymentMethodForType(
      bookingType,
      input.paymentMethod,
      isAdminManual
    );
    if (!isAdminManual && bookingType === 'slot' && paymentMethod === 'UPI Advance') {
      if (!settings.upiEnabled || !settings.upiId) {
        throw new Error('UPI Advance payment is not enabled right now.');
      }
      if (upiRef.length < 6) {
        throw new Error('Enter a valid UPI UTR/transaction reference (min 6 characters).');
      }
    }
    if (!isAdminManual && bookingType === 'rental' && upiRef.length > 0 && upiRef.length < 6) {
      throw new Error(
        'Enter a valid UPI UTR/transaction reference (min 6 characters) or leave blank to send on WhatsApp.'
      );
    }
    const status: BookingStatus = isAdminManual && input.status ? input.status : 'Pending';
    const paymentBreakdown = getRentalPaymentBreakdown(
      totalAmount,
      paymentMethod,
      settings.rentalCodFee
    );
    const paymentStatus =
      isAdminManual && input.paymentStatus
        ? input.paymentStatus
        : paymentBreakdown.defaultPaymentStatus;

    const { data: rpcRes, error } = await sb.rpc('create_booking_atomic', {
      p_customer_name: customerName,
      p_mobile: mobile,
      p_players: Number(input.players),
      p_booking_date: input.date,
      p_start_hour: startHour,
      p_duration: duration,
      p_station_choice: String(input.stationChoice),
      p_payment_method: paymentMethod,
      p_upi_ref: String(input.upiRef || '').trim(),
      p_status: status,
      p_payment_status: paymentStatus,
      p_notes: String(input.notes || '').trim(),
      p_booking_type: bookingType,
      p_end_date: bookingType === 'rental' ? getRentalEndDate(input.date, duration) : input.date,
      p_total_amount: totalAmount
    });
    if (error) throw new Error(error.message);

    const createdId = String((rpcRes as { id: string }).id);
    if (bookingType === 'slot' && slotTier === 'g29') {
      await sb.from('bookings').update({ slot_tier: slotTier }).eq('id', createdId);
    }
    const { data: row, error: fetchErr } = await sb
      .from('bookings')
      .select('*')
      .eq('id', createdId)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);
    return mapBookingRow(row);
  },

  async getBookingByCode(bookingCode: string): Promise<BookingRecord | null> {
    const clean = bookingCode.trim().toUpperCase();
    if (!clean) return null;
    const sb = getServiceClient();
    const { data, error } = await sb
      .from('bookings')
      .select('*')
      .eq('booking_code', clean)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapBookingRow(data) : null;
  },

  async listBookings(filters?: { search?: string; date?: string; status?: string }): Promise<BookingRecord[]> {
    const sb = getServiceClient();
    let query = sb
      .from('bookings')
      .select('*')
      .order('booking_date', { ascending: false })
      .order('start_hour', { ascending: true });

    if (filters?.date) query = query.eq('booking_date', filters.date);
    if (filters?.status && filters.status !== 'All') query = query.eq('status', filters.status);
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      query = query.or(`customer_name.ilike.%${q}%,mobile.ilike.%${q}%,booking_code.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(mapBookingRow);
  },

  async updateBooking(id: string, patch: UpdateBookingInput): Promise<BookingRecord> {
    const sb = getServiceClient();
    const { data: curRow, error: curErr } = await sb.from('bookings').select('*').eq('id', id).single();
    if (curErr || !curRow) throw new Error('Booking not found.');
    const cur = mapBookingRow(curRow);
    const settings = await this.getSettings();

    const nextType: BookingType = patch.bookingType ?? cur.bookingType;
    const nextTier: SlotTier =
      nextType === 'slot' ? normalizeSlotTier(patch.slotTier ?? cur.slotTier) : 'regular';
    const nextDate = patch.date ?? cur.date;
    const nextDuration = patch.duration ?? cur.duration;
    const nextEndDate = nextType === 'rental' ? getRentalEndDate(nextDate, nextDuration) : nextDate;
    const nextStart = nextType === 'rental' ? settings.openingHour : (patch.startHour ?? cur.startHour);
    const nextEndHour = nextType === 'rental' ? settings.closingHour : nextStart + nextDuration;
    const nextStationId = patch.stationId ?? cur.stationId;
    const nextStatus = patch.status ?? cur.status;
    const nextMobile = patch.mobile !== undefined ? normalizeIndianMobile(patch.mobile) : cur.mobile;
    if (!nextMobile) throw new Error('Invalid Indian mobile number.');

    const { data: stationRow } = await sb.from('stations').select('*').eq('id', nextStationId).single();
    if (!stationRow) throw new Error('Target station not found.');
    const station = mapStationRow(stationRow);

    if (nextStatus === 'Confirmed' || nextStatus === 'Completed') {
      const [{ data: blocks }, { data: bookings }] = await Promise.all([
        sb.from('station_blocks').select('*').gte('block_date', nextDate).lte('block_date', nextEndDate),
        sb
          .from('bookings')
          .select('*')
          .neq('status', 'Cancelled')
          .or(
            `and(booking_date.gte.${nextDate},booking_date.lte.${nextEndDate}),and(booking_type.eq.rental,booking_date.lte.${nextEndDate},end_date.gte.${nextDate})`
          )
      ]);
      const check =
        nextType === 'rental'
          ? evaluateStationRental(
              station,
              nextDate,
              nextDuration,
              (blocks || []).map(mapBlockRow),
              (bookings || []).map(mapBookingRow),
              settings,
              cur.id
            )
          : evaluateStationSlot(
              station,
              nextDate,
              nextStart,
              nextDuration,
              (blocks || []).map(mapBlockRow),
              (bookings || []).map(mapBookingRow),
              settings,
              cur.id
            );
      if (!check.available) throw new Error(`Conflict on ${station.name}: ${check.reason}`);
    }

    const durationOrTypeChanged =
      patch.duration !== undefined ||
      patch.bookingType !== undefined ||
      patch.slotTier !== undefined;
    const nextTotal = durationOrTypeChanged
      ? nextType === 'rental'
        ? getRentalPackagePrice(nextDuration, settings)
        : getSlotPriceForTier(nextDuration, nextTier, settings)
      : cur.totalAmount;
    const nowIso = new Date().toISOString();

    const { data: updated, error: upErr } = await sb
      .from('bookings')
      .update({
        booking_type: nextType,
        slot_tier: nextTier,
        customer_name: patch.customerName ?? cur.customerName,
        mobile: nextMobile,
        players: patch.players ?? cur.players,
        station_id: nextStationId,
        station_name: station.name,
        booking_date: nextDate,
        end_date: nextEndDate,
        start_hour: nextStart,
        end_hour: nextEndHour,
        duration: nextDuration,
        total_amount: nextTotal,
        payment_method: patch.paymentMethod ?? cur.paymentMethod,
        payment_status: patch.paymentStatus ?? cur.paymentStatus,
        upi_ref: patch.upiRef ?? cur.upiRef,
        status: nextStatus,
        notes: patch.notes ?? cur.notes,
        updated_at: nowIso
      })
      .eq('id', id)
      .select()
      .single();
    if (upErr) throw new Error(upErr.message);

    await sb
      .from('payments')
      .update({
        method: patch.paymentMethod ?? cur.paymentMethod,
        amount: nextTotal,
        reference: patch.upiRef ?? cur.upiRef,
        status: patch.paymentStatus ?? cur.paymentStatus,
        updated_at: nowIso
      })
      .eq('booking_id', id);

    return mapBookingRow(updated);
  },

  async getStats(): Promise<DashboardStats> {
    const bookings = await this.listBookings();
    return computeDashboardStats(bookings, getKolkataNowParts().dateStr);
  },

  async listBlocks(dateStr?: string): Promise<StationBlock[]> {
    const sb = getServiceClient();
    let query = sb.from('station_blocks').select('*').order('start_hour', { ascending: true });
    if (dateStr) query = query.eq('block_date', dateStr);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(mapBlockRow);
  },

  async createBlock(input: CreateBlockInput): Promise<StationBlock> {
    const sb = getServiceClient();
    if (input.endHour <= input.startHour) throw new Error('End hour must be after start hour.');
    const { data, error } = await sb
      .from('station_blocks')
      .insert({
        station_id: input.stationId,
        block_date: input.date,
        start_hour: input.startHour,
        end_hour: input.endHour,
        reason: input.reason.trim() || 'Manual Block / Maintenance'
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapBlockRow(data);
  },

  async deleteBlock(id: string): Promise<void> {
    const sb = getServiceClient();
    const { error } = await sb.from('station_blocks').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
};

