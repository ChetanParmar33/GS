import type {
  AdminSettings,
  BookingRecord,
  BookingType,
  SlotTier,
  Station,
  StationBlock,
  StationSlotView
} from '@/types/booking';

export const LAUNCH_DATE = '2026-11-19';
export const TIMEZONE = 'Asia/Kolkata';

export const DEFAULT_SLOT_PRICES: Record<string, number> = {
  '1': 149,
  '2': 249,
  '3': 299,
  '4': 399
};

export const DEFAULT_RENTAL_PRICES: Record<string, number> = {
  '1': 1499,
  '2': 2499,
  '3': 2999,
  '4': 3699,
  '5': 4499,
  '6': 5499,
  '7': 6999
};

export const DEFAULT_SETTINGS: AdminSettings = {
  shopName: 'GAMING STATION',
  address: 'V.V. Nagar, Iskcon Road, Anand, Gujarat, India',
  contactNumber: '',
  whatsappNumber: '9016615442',
  instagramHandle: '@gamingstation50',
  instagramUrl: 'https://www.instagram.com/gamingstation50/',
  googleMapsUrl: '',
  openingHour: 11,
  closingHour: 23,
  hourlyPrice: 69,
  regularHourlyPrice: 69,
  g29HourlyPrice: 149,
  slotPrices: { ...DEFAULT_SLOT_PRICES },
  rentalPrices: { ...DEFAULT_RENTAL_PRICES },
  rentalCodFee: 99,
  stationCount: 4,
  minBookingDate: '',
  maxBookingDate: '2026-12-31',
  closedDates: [],
  holdPendingSlots: true,
  pendingHoldMinutes: 15,
  upiEnabled: false,
  upiId: '',
  upiAccountName: '',
  upiInstructions:
    'Complete UPI transfer via your UPI app and enter the 12-digit UTR/reference. Booking stays Pending until shop verification.',
  cancellationRules:
    'Cancellations must be requested at least 2 hours before the booked start time. Confirmed slots cancelled in time are immediately released.'
};

export interface KolkataParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateStr: string;
}

export function getKolkataNowParts(dateObj: Date = new Date()): KolkataParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const map = Object.fromEntries(fmt.formatToParts(dateObj).map((p) => [p.type, p.value]));
  const hour = Number(map.hour === '24' ? '00' : map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
    dateStr: `${map.year}-${map.month}-${map.day}`
  };
}

export function formatHourLabel(hour24: number): string {
  const h = Number(hour24);
  const period = h >= 12 && h < 24 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

export function formatHourShort(hour24: number): string {
  const h = Number(hour24);
  const period = h >= 12 && h < 24 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

export function formatSlotRange(startHour: number, duration: number): string {
  return `${formatHourShort(startHour)} – ${formatHourShort(startHour + duration)}`;
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(dt);
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getRentalEndDate(startDateStr: string, days: number): string {
  return addDaysToDateStr(startDateStr, Math.max(1, days) - 1);
}

export function normalizeSlotTier(raw: unknown): SlotTier {
  return raw === 'g29' ? 'g29' : 'regular';
}

export function getSlotTierLabel(slotTier?: SlotTier): string {
  return slotTier === 'g29' ? 'Logitech G29 Racing Sim' : 'Regular PS5 Games';
}

export function getSlotPriceForTier(
  hours: number,
  slotTier: SlotTier,
  settings: Partial<Pick<AdminSettings, 'regularHourlyPrice' | 'g29HourlyPrice' | 'hourlyPrice'>>
): number {
  const rate =
    slotTier === 'g29'
      ? Math.max(1, Math.round(Number(settings.g29HourlyPrice) || 149))
      : Math.max(1, Math.round(Number(settings.regularHourlyPrice ?? settings.hourlyPrice) || 69));
  return rate * Math.max(1, Math.round(hours));
}

export function getSlotPackagePrice(
  hours: number,
  settings: Pick<AdminSettings, 'hourlyPrice'> & { slotPrices?: Record<string, number> }
): number {
  const custom = Number(settings.slotPrices?.[String(hours)] ?? 0);
  if (Number.isFinite(custom) && custom > 0) return Math.round(custom);
  return Math.max(1, Math.round(settings.hourlyPrice || 149)) * hours;
}

export function getRentalPackagePrice(
  days: number,
  settings: { rentalPrices?: Record<string, number> }
): number {
  const custom = Number(settings.rentalPrices?.[String(days)] ?? 0);
  if (Number.isFinite(custom) && custom > 0) return Math.round(custom);
  return DEFAULT_RENTAL_PRICES[String(days)] ?? 1499 * days;
}

export function formatDuration(count: number, bookingType: BookingType = 'slot'): string {
  if (bookingType === 'rental') {
    return count === 1 ? '1 Day' : `${count} Days`;
  }
  return count === 1 ? '1 Hour' : `${count} Hours`;
}

export function formatINR(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function normalizeIndianMobile(input: string): string | null {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return digits;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]\d{9}$/.test(digits.slice(1))) {
    return digits.slice(1);
  }
  return null;
}

export function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function isPendingHoldingSlot(
  booking: Pick<BookingRecord, 'status' | 'createdAt'>,
  settings: Pick<AdminSettings, 'holdPendingSlots' | 'pendingHoldMinutes'>,
  nowMs: number = Date.now()
): boolean {
  if (booking.status !== 'Pending') return false;
  if (!settings.holdPendingSlots) return false;
  const mins = Number(settings.pendingHoldMinutes || 0);
  if (mins <= 0) return true;
  const createdMs = new Date(booking.createdAt).getTime();
  if (Number.isNaN(createdMs)) return false;
  return nowMs - createdMs < mins * 60 * 1000;
}

export function isBookingBlocking(
  booking: Pick<BookingRecord, 'status' | 'createdAt'>,
  settings: Pick<AdminSettings, 'holdPendingSlots' | 'pendingHoldMinutes'>,
  nowMs: number = Date.now()
): boolean {
  if (booking.status === 'Confirmed' || booking.status === 'Completed') return true;
  return isPendingHoldingSlot(booking, settings, nowMs);
}

export function isDateBookable(
  dateStr: string,
  settings: Pick<AdminSettings, 'minBookingDate' | 'maxBookingDate' | 'closedDates'>,
  nowParts: KolkataParts = getKolkataNowParts()
): { ok: boolean; reason?: string } {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, reason: 'Invalid date format.' };
  }
  const today = nowParts.dateStr;
  const minDate = settings.minBookingDate && settings.minBookingDate > today ? settings.minBookingDate : today;
  if (dateStr < minDate) {
    return { ok: false, reason: 'Past or restricted dates cannot be booked.' };
  }
  if (settings.maxBookingDate && dateStr > settings.maxBookingDate) {
    return { ok: false, reason: `Bookings open through ${formatDateDisplay(settings.maxBookingDate)}.` };
  }
  if (settings.closedDates.includes(dateStr)) {
    return { ok: false, reason: 'Shop is closed on this date.' };
  }
  return { ok: true };
}

export function isSlotWithinHoursAndNotPast(
  dateStr: string,
  startHour: number,
  duration: number,
  settings: Pick<AdminSettings, 'openingHour' | 'closingHour'>,
  nowParts: KolkataParts = getKolkataNowParts()
): { ok: boolean; reason?: string } {
  const endHour = startHour + duration;
  if (startHour < settings.openingHour || endHour > settings.closingHour) {
    return { ok: false, reason: `Exceeds closing (${formatHourShort(settings.closingHour)})` };
  }
  if (dateStr === nowParts.dateStr && startHour <= nowParts.hour) {
    return { ok: false, reason: 'Slot passed' };
  }
  return { ok: true };
}

export function isRentalRangeBookable(
  startDateStr: string,
  days: number,
  settings: Pick<AdminSettings, 'minBookingDate' | 'maxBookingDate' | 'closedDates' | 'closingHour'>,
  nowParts: KolkataParts = getKolkataNowParts()
): { ok: boolean; reason?: string; endDate: string } {
  const endDate = getRentalEndDate(startDateStr, days);
  const startCheck = isDateBookable(startDateStr, settings, nowParts);
  if (!startCheck.ok) return { ...startCheck, endDate };

  if (settings.maxBookingDate && endDate > settings.maxBookingDate) {
    return {
      ok: false,
      endDate,
      reason: `Return date (${formatDateDisplay(endDate)}) exceeds active booking window.`
    };
  }
  if (startDateStr === nowParts.dateStr && nowParts.hour >= settings.closingHour) {
    return { ok: false, endDate, reason: 'Shop closed for today pickup — choose tomorrow.' };
  }
  return { ok: true, endDate };
}

function stationDisabledView(station: Station): StationSlotView | null {
  if (station.status === 'active') return null;
  return {
    station,
    available: false,
    reason: station.status === 'maintenance' ? 'Under maintenance' : 'Temporarily disabled',
    kind: station.status
  };
}

export function evaluateStationSlot(
  station: Station,
  dateStr: string,
  startHour: number,
  duration: number,
  blocks: StationBlock[],
  bookings: BookingRecord[],
  settings: AdminSettings,
  excludeBookingId?: string,
  nowMs: number = Date.now()
): StationSlotView {
  const inactive = stationDisabledView(station);
  if (inactive) return inactive;

  const endHour = startHour + duration;

  const block = blocks.find(
    (b) =>
      b.stationId === station.id &&
      b.date === dateStr &&
      intervalsOverlap(startHour, endHour, b.startHour, b.endHour)
  );
  if (block) {
    return {
      station,
      available: false,
      reason: block.reason || 'Admin reserved / blocked',
      kind: 'blocked'
    };
  }

  const conflict = bookings.find((b) => {
    if (b.id === excludeBookingId || b.stationId !== station.id) return false;
    if (!isBookingBlocking(b, settings, nowMs)) return false;
    if ((b.bookingType || 'slot') === 'rental') {
      const bEnd = b.endDate || b.date;
      return b.date <= dateStr && dateStr <= bEnd;
    }
    return b.date === dateStr && intervalsOverlap(startHour, endHour, b.startHour, b.endHour);
  });
  if (conflict) {
    return {
      station,
      available: false,
      reason:
        (conflict.bookingType || 'slot') === 'rental'
          ? 'Out on PS5 Home Rent'
          : conflict.status === 'Pending'
          ? 'Temporarily held (Pending)'
          : 'Already booked',
      kind: 'booked'
    };
  }

  return {
    station,
    available: true,
    reason: 'Available',
    kind: 'available'
  };
}

export function evaluateStationRental(
  station: Station,
  startDateStr: string,
  days: number,
  blocks: StationBlock[],
  bookings: BookingRecord[],
  settings: AdminSettings,
  excludeBookingId?: string,
  nowMs: number = Date.now()
): StationSlotView {
  const inactive = stationDisabledView(station);
  if (inactive) return inactive;

  const endDateStr = getRentalEndDate(startDateStr, days);

  const block = blocks.find(
    (b) => b.stationId === station.id && b.date >= startDateStr && b.date <= endDateStr
  );
  if (block) {
    return {
      station,
      available: false,
      reason: block.reason || 'Admin reserved / blocked',
      kind: 'blocked'
    };
  }

  const conflict = bookings.find((b) => {
    if (b.id === excludeBookingId || b.stationId !== station.id) return false;
    if (!isBookingBlocking(b, settings, nowMs)) return false;
    if ((b.bookingType || 'slot') === 'rental') {
      const bEnd = b.endDate || b.date;
      return b.date <= endDateStr && startDateStr <= bEnd;
    }
    return b.date >= startDateStr && b.date <= endDateStr;
  });
  if (conflict) {
    return {
      station,
      available: false,
      reason:
        (conflict.bookingType || 'slot') === 'rental'
          ? conflict.status === 'Pending'
            ? 'Rental held (Pending)'
            : 'Already rented'
          : 'Has Gamezone slot booking',
      kind: 'booked'
    };
  }

  return {
    station,
    available: true,
    reason: 'Available for rent',
    kind: 'available'
  };
}

type WhatsAppBookingInput = Pick<
  BookingRecord,
  | 'bookingCode'
  | 'customerName'
  | 'mobile'
  | 'date'
  | 'startHour'
  | 'endHour'
  | 'duration'
  | 'stationName'
  | 'paymentMethod'
  | 'totalAmount'
> & {
  bookingType?: BookingType;
  slotTier?: SlotTier;
  endDate?: string;
  upiRef?: string;
};

export interface RentalPaymentBreakdown {
  isCod: boolean;
  isFullOnline: boolean;
  payOnlineNow: number;
  payOnDelivery: number;
  label: string;
  defaultPaymentStatus: string;
}

export function normalizePaymentMethodForType(
  bookingType: BookingType,
  rawMethod: unknown,
  allowAnyForAdmin: boolean = false
): import('@/types/booking').PaymentMethod {
  const val = String(rawMethod || '').trim();
  if (allowAnyForAdmin) {
    if (val === 'COD' || val === 'Full Online' || val === 'UPI Advance' || val === 'Pay at Shop') {
      return val;
    }
  }
  if (bookingType === 'rental') {
    return val === 'Full Online' ? 'Full Online' : 'COD';
  }
  return 'Pay at Shop';
}

export function getRentalPaymentBreakdown(
  totalAmount: number,
  paymentMethod: string,
  rentalCodFee: number = DEFAULT_SETTINGS.rentalCodFee
): RentalPaymentBreakdown {
  const fee = Math.min(totalAmount, Math.max(1, Math.round(rentalCodFee || 99)));
  if (paymentMethod === 'COD') {
    return {
      isCod: true,
      isFullOnline: false,
      payOnlineNow: fee,
      payOnDelivery: Math.max(0, totalAmount - fee),
      label: 'COD (Cash on Delivery)',
      defaultPaymentStatus: `COD (₹${fee} Online Pending)`
    };
  }
  if (paymentMethod === 'Full Online') {
    return {
      isCod: false,
      isFullOnline: true,
      payOnlineNow: totalAmount,
      payOnDelivery: 0,
      label: 'Full Online Payment',
      defaultPaymentStatus: 'Full Online Verification Pending'
    };
  }
  return {
    isCod: false,
    isFullOnline: paymentMethod === 'UPI Advance',
    payOnlineNow: paymentMethod === 'UPI Advance' ? totalAmount : 0,
    payOnDelivery: paymentMethod === 'UPI Advance' ? 0 : totalAmount,
    label: paymentMethod || 'Pay at Shop',
    defaultPaymentStatus:
      paymentMethod === 'UPI Advance' ? 'Verification Pending' : 'Unpaid (Pay at Shop)'
  };
}

export function buildWhatsAppMessage(
  booking: WhatsAppBookingInput,
  settings: Pick<AdminSettings, 'shopName'> & { rentalCodFee?: number }
): string {
  const type: BookingType = booking.bookingType || 'slot';
  if (type === 'rental') {
    const endDate = booking.endDate || getRentalEndDate(booking.date, booking.duration);
    const pay = getRentalPaymentBreakdown(
      booking.totalAmount,
      booking.paymentMethod,
      settings.rentalCodFee ?? DEFAULT_SETTINGS.rentalCodFee
    );
    const lines = [
      `Hello ${settings.shopName || 'GAMING STATION'},`,
      '',
      'I want to rent a PlayStation 5 console!',
      '',
      'Type: PS5 Home Rental',
      `Booking ID: ${booking.bookingCode}`,
      `Name: ${booking.customerName}`,
      `Mobile: +91 ${booking.mobile}`,
      `Pickup Date: ${formatDateDisplay(booking.date)}`,
      `Last Rental Day: ${formatDateDisplay(endDate)}`,
      `Duration: ${formatDuration(booking.duration, 'rental')}`,
      `PS5 Console: ${booking.stationName}`,
      `Payment Option: ${pay.label}`,
      `Online Confirmation Pay: ₹${pay.payOnlineNow}`,
      `Balance on Delivery: ₹${pay.payOnDelivery}`,
      `Total Rental Amount: ₹${booking.totalAmount}`
    ];
    if (booking.upiRef?.trim()) {
      lines.push(`UPI Ref / UTR: ${booking.upiRef.trim()}`);
    }
    lines.push('', 'Please review and approve my PS5 rental.');
    return lines.join('\n');
  }

  const endHour = booking.endHour ?? booking.startHour + booking.duration;
  const tierLabel = getSlotTierLabel(booking.slotTier);
  return [
    `Hello ${settings.shopName || 'GAMING STATION'},`,
    '',
    'I have booked a gaming session!',
    '',
    `Type: GameZone Slot (${tierLabel})`,
    `Booking ID: ${booking.bookingCode}`,
    `Name: ${booking.customerName}`,
    `Mobile: +91 ${booking.mobile}`,
    `Date: ${formatDateDisplay(booking.date)}`,
    `Time: ${formatHourLabel(booking.startHour)} – ${formatHourLabel(endHour)}`,
    `Duration: ${formatDuration(booking.duration, 'slot')}`,
    `PS5 Station: ${booking.stationName}`,
    `Total Amount: ₹${booking.totalAmount}`,
    '',
    'Please confirm my booking.'
  ].join('\n');
}

export function buildUpiIntentUrl(params: {
  upiId: string;
  payeeName: string;
  amount: number;
  note: string;
}): string {
  const qs = new URLSearchParams({
    pa: params.upiId.trim(),
    pn: (params.payeeName || 'GAMING STATION').trim(),
    am: String(Math.max(1, Math.round(params.amount))),
    cu: 'INR',
    tn: params.note.trim()
  });
  return `upi://pay?${qs.toString()}`;
}

export function buildWhatsAppUrl(
  booking: WhatsAppBookingInput,
  settings: Pick<AdminSettings, 'shopName' | 'whatsappNumber'> & { rentalCodFee?: number }
): { url: string; hasConfiguredNumber: boolean; message: string } {
  const message = buildWhatsAppMessage(booking, settings);
  const encoded = encodeURIComponent(message);
  const digits = String(settings.whatsappNumber || '').replace(/\D/g, '');
  if (!digits) {
    return { url: `https://wa.me/?text=${encoded}`, hasConfiguredNumber: false, message };
  }
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return { url: `https://wa.me/${normalized}?text=${encoded}`, hasConfiguredNumber: true, message };
}

export function buildAvailabilityPayload(
  dateStr: string,
  duration: number,
  stations: Station[],
  blocks: StationBlock[],
  bookings: BookingRecord[],
  settings: AdminSettings,
  nowParts: KolkataParts = getKolkataNowParts(),
  mode: BookingType = 'slot'
): import('@/types/booking').AvailabilityPayload {
  const activeStations = stations.filter((s) => s.id <= settings.stationCount);

  if (mode === 'rental') {
    const rentalCheck = isRentalRangeBookable(dateStr, duration, settings, nowParts);
    const rentalStations: StationSlotView[] = activeStations.map((st) =>
      rentalCheck.ok
        ? evaluateStationRental(st, dateStr, duration, blocks, bookings, settings)
        : {
            station: st,
            available: false,
            reason: rentalCheck.reason || 'Unavailable',
            kind: st.status === 'active' ? 'booked' : st.status
          }
    );
    const rentalAvailableCount = rentalCheck.ok
      ? rentalStations.filter((sv) => sv.available).length
      : 0;

    return {
      mode: 'rental',
      date: dateStr,
      endDate: rentalCheck.endDate,
      duration,
      dateBookable: rentalCheck.ok,
      dateReason: rentalCheck.reason,
      slots: [],
      rentalAvailableCount,
      rentalStations
    };
  }

  const dateCheck = isDateBookable(dateStr, settings, nowParts);
  const slots: import('@/types/booking').TimeSlotAvailability[] = [];

  for (let h = settings.openingHour; h < settings.closingHour; h++) {
    const timeCheck = dateCheck.ok
      ? isSlotWithinHoursAndNotPast(dateStr, h, duration, settings, nowParts)
      : { ok: false, reason: dateCheck.reason || 'Unavailable' };

    const stationViews: StationSlotView[] = activeStations.map((st) =>
      timeCheck.ok
        ? evaluateStationSlot(st, dateStr, h, duration, blocks, bookings, settings)
        : {
            station: st,
            available: false,
            reason: timeCheck.reason || 'Unavailable',
            kind: st.status === 'active' ? 'booked' : st.status
          }
    );

    const availableCount = timeCheck.ok ? stationViews.filter((sv) => sv.available).length : 0;
    const bookable = dateCheck.ok && timeCheck.ok && availableCount > 0;

    let reason = 'Available';
    if (!dateCheck.ok) reason = dateCheck.reason || 'Closed';
    else if (!timeCheck.ok) reason = timeCheck.reason || 'Unavailable';
    else if (availableCount === 0) reason = 'All PS5 booked';
    else reason = `${availableCount} PS5 free`;

    slots.push({
      startHour: h,
      label: formatHourLabel(h),
      shortLabel: formatHourShort(h),
      bookable,
      reason,
      availableCount,
      stations: stationViews
    });
  }

  return {
    mode: 'slot',
    date: dateStr,
    endDate: dateStr,
    duration,
    dateBookable: dateCheck.ok,
    dateReason: dateCheck.reason,
    slots,
    rentalAvailableCount: 0,
    rentalStations: []
  };
}

export function computeDashboardStats(
  bookings: BookingRecord[],
  todayIst: string = getKolkataNowParts().dateStr
): import('@/types/booking').DashboardStats {
  let todayBookings = 0;
  let confirmedBookings = 0;
  let pendingBookings = 0;
  let cancelledBookings = 0;
  let completedBookings = 0;
  let todayRevenue = 0;
  let totalRevenue = 0;

  for (const b of bookings) {
    if (b.date === todayIst && b.status !== 'Cancelled') todayBookings++;
    if (b.status === 'Confirmed') confirmedBookings++;
    else if (b.status === 'Pending') pendingBookings++;
    else if (b.status === 'Cancelled') cancelledBookings++;
    else if (b.status === 'Completed') completedBookings++;

    if (b.status === 'Confirmed' || b.status === 'Completed') {
      totalRevenue += b.totalAmount;
      if (b.date === todayIst) todayRevenue += b.totalAmount;
    }
  }

  return {
    totalBookings: bookings.length,
    todayBookings,
    confirmedBookings,
    pendingBookings,
    cancelledBookings,
    completedBookings,
    todayRevenue,
    totalRevenue
  };
}

