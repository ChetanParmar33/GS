import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_RENTAL_PRICES,
  DEFAULT_SETTINGS,
  DEFAULT_SLOT_PRICES,
  LAUNCH_DATE,
  buildAvailabilityPayload,
  buildUpiIntentUrl,
  buildWhatsAppMessage,
  computeDashboardStats,
  evaluateStationRental,
  evaluateStationSlot,
  formatSlotRange,
  getRentalEndDate,
  getRentalPackagePrice,
  getRentalPaymentBreakdown,
  getSlotPackagePrice,
  getSlotPriceForTier,
  intervalsOverlap,
  isBookingBlocking,
  isDateBookable,
  isSlotWithinHoursAndNotPast,
  normalizeIndianMobile,
  normalizePaymentMethodForType,
  normalizeSlotTier
} from '../src/lib/booking-rules.ts';
import type { BookingRecord, Station } from '../src/types/booking.ts';

test('normalizeIndianMobile validates 10-digit, 0-prefix, and +91 numbers', () => {
  assert.equal(normalizeIndianMobile('9876543210'), '9876543210');
  assert.equal(normalizeIndianMobile('+91 98765 43210'), '9876543210');
  assert.equal(normalizeIndianMobile('09876543210'), '9876543210');
  assert.equal(normalizeIndianMobile('5876543210'), null);
  assert.equal(normalizeIndianMobile('98765'), null);
});

test('intervalsOverlap handles adjacent vs overlapping slots accurately', () => {
  assert.equal(intervalsOverlap(11, 13, 13, 15), false);
  assert.equal(intervalsOverlap(11, 13, 12, 14), true);
  assert.equal(intervalsOverlap(14, 16, 13, 17), true);
});

test('operating hours disallow sessions extending past closingHour (11 PM)', () => {
  const nowParts = { year: 2026, month: 11, day: 12, hour: 10, minute: 0, second: 0, dateStr: '2026-11-12' };
  assert.equal(isSlotWithinHoursAndNotPast(LAUNCH_DATE, 22, 1, DEFAULT_SETTINGS, nowParts).ok, true);
  assert.equal(isSlotWithinHoursAndNotPast(LAUNCH_DATE, 21, 3, DEFAULT_SETTINGS, nowParts).ok, false);
  assert.equal(isSlotWithinHoursAndNotPast('2026-11-12', 10, 1, DEFAULT_SETTINGS, nowParts).ok, false);
  assert.equal(isSlotWithinHoursAndNotPast('2026-11-12', 11, 1, DEFAULT_SETTINGS, nowParts).ok, true);
});

test('past and closed dates are blocked in Asia/Kolkata', () => {
  const nowParts = { year: 2026, month: 11, day: 12, hour: 10, minute: 0, second: 0, dateStr: '2026-11-12' };
  const settings = { ...DEFAULT_SETTINGS, closedDates: ['2026-11-25'] };
  assert.equal(isDateBookable('2026-11-11', settings, nowParts).ok, false);
  assert.equal(isDateBookable('2026-11-25', settings, nowParts).ok, false);
  assert.equal(isDateBookable(LAUNCH_DATE, settings, nowParts).ok, true);
});

test('pending hold rule respects holdPendingSlots and expiry minutes', () => {
  const now = Date.now();
  const recentPending = { status: 'Pending' as const, createdAt: new Date(now - 5 * 60000).toISOString() };
  const oldPending = { status: 'Pending' as const, createdAt: new Date(now - 25 * 60000).toISOString() };

  assert.equal(isBookingBlocking(recentPending, { holdPendingSlots: true, pendingHoldMinutes: 15 }, now), true);
  assert.equal(isBookingBlocking(oldPending, { holdPendingSlots: true, pendingHoldMinutes: 15 }, now), false);
  assert.equal(isBookingBlocking(recentPending, { holdPendingSlots: false, pendingHoldMinutes: 15 }, now), false);
  assert.equal(isBookingBlocking({ status: 'Cancelled', createdAt: new Date().toISOString() }, DEFAULT_SETTINGS, now), false);
});

test('all 4 PS5 stations allow concurrent bookings on same slot and block when full', () => {
  const nowParts = { year: 2026, month: 11, day: 12, hour: 10, minute: 0, second: 0, dateStr: '2026-11-12' };
  const stations: Station[] = [1, 2, 3, 4].map((id) => ({
    id,
    name: `PS5 Station ${id}`,
    status: 'active',
    note: ''
  }));
  const bookings: BookingRecord[] = [1, 2, 3, 4].map((id) => ({
    id: `b-${id}`,
    bookingCode: `GZ-261119-000${id}`,
    bookingType: 'slot',
    slotTier: 'regular',
    customerId: `c-${id}`,
    customerName: `Player ${id}`,
    mobile: '9876543210',
    players: 2,
    stationId: id,
    stationName: `PS5 Station ${id}`,
    date: LAUNCH_DATE,
    endDate: LAUNCH_DATE,
    startHour: 15,
    endHour: 17,
    duration: 2,
    hourlyPriceSnapshot: 149,
    totalAmount: 249,
    paymentMethod: 'Pay at Shop',
    paymentStatus: 'Unpaid (Pay at Shop)',
    upiRef: '',
    status: 'Confirmed',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  const avail = buildAvailabilityPayload(LAUNCH_DATE, 1, stations, [], bookings, DEFAULT_SETTINGS, nowParts);
  const slot15 = avail.slots.find((s) => s.startHour === 15)!;
  const slot14 = avail.slots.find((s) => s.startHour === 14)!;
  assert.equal(slot15.bookable, false);
  assert.equal(slot15.availableCount, 0);
  assert.equal(slot14.bookable, true);
  assert.equal(slot14.availableCount, 4);
});

test('slot tier and rental package pricing match configured rates', () => {
  assert.equal(normalizeSlotTier('g29'), 'g29');
  assert.equal(normalizeSlotTier('anything-else'), 'regular');
  assert.deepEqual(
    [1, 2, 3, 4].map((h) => getSlotPriceForTier(h, 'regular', DEFAULT_SETTINGS)),
    [69, 138, 207, 276]
  );
  assert.deepEqual(
    [1, 2, 3, 4].map((h) => getSlotPriceForTier(h, 'g29', DEFAULT_SETTINGS)),
    [149, 298, 447, 596]
  );
  assert.deepEqual(
    [1, 2, 3, 4].map((h) => getSlotPackagePrice(h, DEFAULT_SETTINGS)),
    [149, 249, 299, 399]
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((d) => getRentalPackagePrice(d, DEFAULT_SETTINGS)),
    [1499, 2499, 2999, 3699, 4499, 5499, 6999]
  );
  assert.deepEqual(DEFAULT_SLOT_PRICES, { '1': 149, '2': 249, '3': 299, '4': 399 });
  assert.deepEqual(DEFAULT_RENTAL_PRICES, {
    '1': 1499,
    '2': 2499,
    '3': 2999,
    '4': 3699,
    '5': 4499,
    '6': 5499,
    '7': 6999
  });
  assert.equal(getRentalEndDate('2026-11-19', 1), '2026-11-19');
  assert.equal(getRentalEndDate('2026-11-19', 3), '2026-11-21');
});

test('multi-day PS5 rental and GameZone slots mutually block overlapping stations', () => {
  const nowParts = { year: 2026, month: 11, day: 12, hour: 10, minute: 0, second: 0, dateStr: '2026-11-12' };
  const stations: Station[] = [1, 2, 3, 4].map((id) => ({
    id,
    name: `PS5 Station ${id}`,
    status: 'active',
    note: ''
  }));
  const bookings: BookingRecord[] = [
    {
      id: 'r-1',
      bookingCode: 'RN-261119-AAA1',
      bookingType: 'rental',
      slotTier: 'regular',
      customerId: 'c-1',
      customerName: 'Renter',
      mobile: '9876543210',
      players: 1,
      stationId: 1,
      stationName: 'PS5 Station 1',
      date: '2026-11-19',
      endDate: '2026-11-21',
      startHour: 11,
      endHour: 23,
      duration: 3,
      hourlyPriceSnapshot: 1000,
      totalAmount: 2999,
      paymentMethod: 'Pay at Shop',
      paymentStatus: 'Unpaid (Pay at Shop)',
      upiRef: '',
      status: 'Confirmed',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 's-2',
      bookingCode: 'GZ-261123-BBB2',
      bookingType: 'slot',
      slotTier: 'regular',
      customerId: 'c-2',
      customerName: 'Gamer',
      mobile: '9876543211',
      players: 1,
      stationId: 2,
      stationName: 'PS5 Station 2',
      date: '2026-11-23',
      endDate: '2026-11-23',
      startHour: 14,
      endHour: 16,
      duration: 2,
      hourlyPriceSnapshot: 149,
      totalAmount: 249,
      paymentMethod: 'Pay at Shop',
      paymentStatus: 'Unpaid (Pay at Shop)',
      upiRef: '',
      status: 'Confirmed',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  // Station 1 rented Nov 19..21 must block hourly slots on Nov 20, but be free Nov 22
  assert.equal(evaluateStationSlot(stations[0], '2026-11-20', 14, 1, [], bookings, DEFAULT_SETTINGS).available, false);
  assert.equal(evaluateStationSlot(stations[0], '2026-11-22', 14, 1, [], bookings, DEFAULT_SETTINGS).available, true);

  // Station 2 has a slot on Nov 23, so a rental spanning Nov 22..24 must block Station 2
  assert.equal(evaluateStationRental(stations[1], '2026-11-22', 3, [], bookings, DEFAULT_SETTINGS).available, false);

  const rentalAvail = buildAvailabilityPayload(
    '2026-11-20',
    2,
    stations,
    [],
    bookings,
    DEFAULT_SETTINGS,
    nowParts,
    'rental'
  );
  assert.equal(rentalAvail.mode, 'rental');
  assert.equal(rentalAvail.rentalAvailableCount, 3);
});

test('buildWhatsAppMessage formats both Gamezone slot and PS5 rental orders', () => {
  const slotMsg = buildWhatsAppMessage(
    {
      bookingCode: 'GZ-261119-ABCD',
      bookingType: 'slot',
      slotTier: 'regular',
      customerName: 'Aarav Patel',
      mobile: '9876543210',
      date: '2026-11-19',
      endDate: '2026-11-19',
      startHour: 18,
      endHour: 20,
      duration: 2,
      stationName: 'PS5 Station 2',
      paymentMethod: 'Pay at Shop',
      totalAmount: 138
    },
    DEFAULT_SETTINGS
  );
  assert.equal(DEFAULT_SETTINGS.whatsappNumber, '9016615442');
  assert.match(slotMsg, /Hello GAMING STATION,/);
  assert.match(slotMsg, /Type: GameZone Slot \(Regular PS5 Games\)/);
  assert.match(slotMsg, /Booking ID: GZ-261119-ABCD/);
  assert.match(slotMsg, /Time: 6:00 PM – 8:00 PM/);
  assert.match(slotMsg, /Total Amount: ₹138/);
  assert.doesNotMatch(slotMsg, /GTA VI/);

  const g29Msg = buildWhatsAppMessage(
    {
      bookingCode: 'GZ-261119-G29X',
      bookingType: 'slot',
      slotTier: 'g29',
      customerName: 'Dev Patel',
      mobile: '9876543219',
      date: '2026-11-19',
      endDate: '2026-11-19',
      startHour: 16,
      endHour: 18,
      duration: 2,
      stationName: 'PS5 Station 1',
      paymentMethod: 'Pay at Shop',
      totalAmount: 298
    },
    DEFAULT_SETTINGS
  );
  assert.match(g29Msg, /Type: GameZone Slot \(Logitech G29 Racing Sim\)/);
  assert.match(g29Msg, /Total Amount: ₹298/);

  const rentCodMsg = buildWhatsAppMessage(
    {
      bookingCode: 'RN-261119-XYZ1',
      bookingType: 'rental',
      customerName: 'Karan Shah',
      mobile: '9876543212',
      date: '2026-11-19',
      endDate: '2026-11-21',
      startHour: 11,
      endHour: 23,
      duration: 3,
      stationName: 'PS5 Station 1',
      paymentMethod: 'COD',
      totalAmount: 2999
    },
    DEFAULT_SETTINGS
  );
  assert.match(rentCodMsg, /Type: PS5 Home Rental/);
  assert.match(rentCodMsg, /Booking ID: RN-261119-XYZ1/);
  assert.match(rentCodMsg, /Duration: 3 Days/);
  assert.match(rentCodMsg, /Payment Option: COD \(Cash on Delivery\)/);
  assert.match(rentCodMsg, /Online Confirmation Pay: ₹99/);
  assert.match(rentCodMsg, /Balance on Delivery: ₹2900/);
  assert.match(rentCodMsg, /Total Rental Amount: ₹2999/);

  const rentFullMsg = buildWhatsAppMessage(
    {
      bookingCode: 'RN-261119-FULL',
      bookingType: 'rental',
      customerName: 'Rohan Mehta',
      mobile: '9876543213',
      date: '2026-11-19',
      endDate: '2026-11-19',
      startHour: 11,
      endHour: 23,
      duration: 1,
      stationName: 'PS5 Station 2',
      paymentMethod: 'Full Online',
      totalAmount: 1499,
      upiRef: '432198765432'
    },
    DEFAULT_SETTINGS
  );
  assert.match(rentFullMsg, /Payment Option: Full Online Payment/);
  assert.match(rentFullMsg, /Online Confirmation Pay: ₹1499/);
  assert.match(rentFullMsg, /Balance on Delivery: ₹0/);
  assert.match(rentFullMsg, /UPI Ref \/ UTR: 432198765432/);
  assert.equal(formatSlotRange(11, 2), '11 AM – 1 PM');
});

test('rental payment helpers compute ₹99 COD online confirmation fee and Full Online cleanly', () => {
  assert.equal(normalizePaymentMethodForType('rental', 'Pay at Shop', false), 'COD');
  assert.equal(normalizePaymentMethodForType('rental', 'Full Online', false), 'Full Online');
  assert.equal(normalizePaymentMethodForType('slot', 'COD', false), 'Pay at Shop');
  assert.equal(normalizePaymentMethodForType('slot', 'UPI Advance', false), 'Pay at Shop');

  const cod = getRentalPaymentBreakdown(1499, 'COD', 99);
  assert.equal(cod.isCod, true);
  assert.equal(cod.payOnlineNow, 99);
  assert.equal(cod.payOnDelivery, 1400);
  assert.equal(cod.defaultPaymentStatus, 'COD (₹99 Online Pending)');

  const full = getRentalPaymentBreakdown(2499, 'Full Online', 99);
  assert.equal(full.isFullOnline, true);
  assert.equal(full.payOnlineNow, 2499);
  assert.equal(full.payOnDelivery, 0);
  assert.equal(full.defaultPaymentStatus, 'Full Online Verification Pending');

  const upiUrl = buildUpiIntentUrl({
    upiId: 'shop@upi',
    payeeName: 'GAMING STATION',
    amount: 99,
    note: 'PS5 Rental COD'
  });
  assert.match(upiUrl, /^upi:\/\/pay\?.*pa=shop%40upi.*am=99.*cu=INR/);
});

test('computeDashboardStats excludes Pending and Cancelled from earned revenue', () => {
  const stats = computeDashboardStats(
    [
      { status: 'Confirmed', date: '2026-11-12', totalAmount: 298 },
      { status: 'Completed', date: '2026-11-11', totalAmount: 149 },
      { status: 'Pending', date: '2026-11-12', totalAmount: 596 },
      { status: 'Cancelled', date: '2026-11-12', totalAmount: 149 }
    ] as BookingRecord[],
    '2026-11-12'
  );
  assert.equal(stats.totalBookings, 4);
  assert.equal(stats.todayBookings, 2);
  assert.equal(stats.todayRevenue, 298);
  assert.equal(stats.totalRevenue, 447);
});

