import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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
  isDateBookable,
  isRentalRangeBookable,
  isSlotWithinHoursAndNotPast,
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

let dbSingleton: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbSingleton) return dbSingleton;

  const dataDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'gamezone.db');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shop_name TEXT NOT NULL,
      address TEXT NOT NULL,
      contact_number TEXT NOT NULL DEFAULT '',
      whatsapp_number TEXT NOT NULL DEFAULT '',
      instagram_handle TEXT NOT NULL,
      instagram_url TEXT NOT NULL,
      google_maps_url TEXT NOT NULL DEFAULT '',
      opening_hour INTEGER NOT NULL,
      closing_hour INTEGER NOT NULL,
      hourly_price INTEGER NOT NULL,
      station_count INTEGER NOT NULL,
      min_booking_date TEXT NOT NULL DEFAULT '',
      max_booking_date TEXT NOT NULL DEFAULT '2026-12-31',
      closed_dates TEXT NOT NULL DEFAULT '[]',
      hold_pending_slots INTEGER NOT NULL DEFAULT 1,
      pending_hold_minutes INTEGER NOT NULL DEFAULT 15,
      upi_enabled INTEGER NOT NULL DEFAULT 0,
      upi_id TEXT NOT NULL DEFAULT '',
      upi_account_name TEXT NOT NULL DEFAULT '',
      upi_instructions TEXT NOT NULL DEFAULT '',
      cancellation_rules TEXT NOT NULL DEFAULT '',
      slot_prices TEXT NOT NULL DEFAULT '',
      rental_prices TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS station_blocks (
      id TEXT PRIMARY KEY,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
      block_date TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_code TEXT NOT NULL UNIQUE,
      booking_type TEXT NOT NULL DEFAULT 'slot',
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      customer_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      players INTEGER NOT NULL,
      station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
      station_name TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      end_date TEXT NOT NULL DEFAULT '',
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      hourly_price_snapshot INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      upi_ref TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reference TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_lookup ON bookings (booking_date, station_id, status);
    CREATE INDEX IF NOT EXISTS idx_blocks_lookup ON station_blocks (block_date, station_id);
  `);

  const settingsCols = new Set(
    (db.prepare('PRAGMA table_info(admin_settings)').all() as Array<{ name: string }>).map(
      (c) => c.name
    )
  );
  if (!settingsCols.has('slot_prices')) {
    db.exec("ALTER TABLE admin_settings ADD COLUMN slot_prices TEXT NOT NULL DEFAULT '';");
  }
  if (!settingsCols.has('rental_prices')) {
    db.exec("ALTER TABLE admin_settings ADD COLUMN rental_prices TEXT NOT NULL DEFAULT '';");
  }
  if (!settingsCols.has('rental_cod_fee')) {
    db.exec('ALTER TABLE admin_settings ADD COLUMN rental_cod_fee INTEGER NOT NULL DEFAULT 99;');
  }
  if (!settingsCols.has('regular_hourly_price')) {
    db.exec('ALTER TABLE admin_settings ADD COLUMN regular_hourly_price INTEGER NOT NULL DEFAULT 69;');
  }
  if (!settingsCols.has('g29_hourly_price')) {
    db.exec('ALTER TABLE admin_settings ADD COLUMN g29_hourly_price INTEGER NOT NULL DEFAULT 149;');
  }

  const bookingCols = new Set(
    (db.prepare('PRAGMA table_info(bookings)').all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (!bookingCols.has('booking_type')) {
    db.exec("ALTER TABLE bookings ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'slot';");
  }
  if (!bookingCols.has('end_date')) {
    db.exec("ALTER TABLE bookings ADD COLUMN end_date TEXT NOT NULL DEFAULT '';");
  }
  if (!bookingCols.has('slot_tier')) {
    db.exec("ALTER TABLE bookings ADD COLUMN slot_tier TEXT NOT NULL DEFAULT 'regular';");
  }
  db.exec("UPDATE bookings SET end_date = booking_date WHERE end_date = '';");
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_bookings_type_dates ON bookings (booking_type, booking_date, end_date, status);'
  );

  const now = new Date().toISOString();
  const hasSettings = db.prepare('SELECT id FROM admin_settings WHERE id = 1').get();
  if (!hasSettings) {
    db.prepare(`
      INSERT INTO admin_settings (
        id, shop_name, address, contact_number, whatsapp_number, instagram_handle, instagram_url,
        google_maps_url, opening_hour, closing_hour, hourly_price, station_count,
        min_booking_date, max_booking_date, closed_dates, hold_pending_slots, pending_hold_minutes,
        upi_enabled, upi_id, upi_account_name, upi_instructions, cancellation_rules,
        slot_prices, rental_prices, rental_cod_fee, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      1,
      DEFAULT_SETTINGS.shopName,
      DEFAULT_SETTINGS.address,
      DEFAULT_SETTINGS.contactNumber,
      DEFAULT_SETTINGS.whatsappNumber,
      DEFAULT_SETTINGS.instagramHandle,
      DEFAULT_SETTINGS.instagramUrl,
      DEFAULT_SETTINGS.googleMapsUrl,
      DEFAULT_SETTINGS.openingHour,
      DEFAULT_SETTINGS.closingHour,
      DEFAULT_SETTINGS.hourlyPrice,
      DEFAULT_SETTINGS.stationCount,
      DEFAULT_SETTINGS.minBookingDate,
      DEFAULT_SETTINGS.maxBookingDate,
      JSON.stringify(DEFAULT_SETTINGS.closedDates),
      DEFAULT_SETTINGS.holdPendingSlots ? 1 : 0,
      DEFAULT_SETTINGS.pendingHoldMinutes,
      DEFAULT_SETTINGS.upiEnabled ? 1 : 0,
      DEFAULT_SETTINGS.upiId,
      DEFAULT_SETTINGS.upiAccountName,
      DEFAULT_SETTINGS.upiInstructions,
      DEFAULT_SETTINGS.cancellationRules,
      JSON.stringify(DEFAULT_SETTINGS.slotPrices),
      JSON.stringify(DEFAULT_SETTINGS.rentalPrices),
      DEFAULT_SETTINGS.rentalCodFee,
      now
    );
  }

  for (let i = 1; i <= DEFAULT_SETTINGS.stationCount; i++) {
    db.prepare(
      'INSERT OR IGNORE INTO stations (id, name, status, note, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(i, `PS5 Station ${i}`, 'active', '', now);
  }

  dbSingleton = db;
  return db;
}

function parsePriceTable(raw: unknown, fallback: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...fallback };
  if (!raw) return out;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object') {
      for (const k of Object.keys(fallback)) {
        const val = Number((parsed as Record<string, unknown>)[k]);
        if (Number.isFinite(val) && val > 0) out[k] = Math.round(val);
      }
    }
  } catch {
    return out;
  }
  return out;
}

function sanitizePriceTable(
  input: Record<string, unknown> | undefined,
  fallback: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = { ...fallback };
  if (!input) return out;
  for (const k of Object.keys(fallback)) {
    const val = Number(input[k]);
    if (Number.isFinite(val) && val > 0) out[k] = Math.round(val);
  }
  return out;
}

function mapSettings(row: Record<string, unknown>): AdminSettings {
  let closedDates: string[] = [];
  try {
    const parsed = JSON.parse(String(row.closed_dates || '[]'));
    if (Array.isArray(parsed)) closedDates = parsed.map(String);
  } catch {
    closedDates = [];
  }
  const slotPrices = parsePriceTable(row.slot_prices, DEFAULT_SLOT_PRICES);
  const hourlyPrice = Number(row.hourly_price || slotPrices['1'] || DEFAULT_SETTINGS.hourlyPrice);
  if (!row.slot_prices) slotPrices['1'] = hourlyPrice;
  const rentalPrices = parsePriceTable(row.rental_prices, DEFAULT_RENTAL_PRICES);

  return {
    shopName: String(row.shop_name),
    address: String(row.address),
    contactNumber: String(row.contact_number || ''),
    whatsappNumber: String(row.whatsapp_number || ''),
    instagramHandle: String(row.instagram_handle),
    instagramUrl: String(row.instagram_url),
    googleMapsUrl: String(row.google_maps_url || ''),
    openingHour: Number(row.opening_hour),
    closingHour: Number(row.closing_hour),
    hourlyPrice,
    regularHourlyPrice: Math.max(1, Number(row.regular_hourly_price || DEFAULT_SETTINGS.regularHourlyPrice)),
    g29HourlyPrice: Math.max(1, Number(row.g29_hourly_price || DEFAULT_SETTINGS.g29HourlyPrice)),
    slotPrices,
    rentalPrices,
    rentalCodFee: Math.max(1, Number(row.rental_cod_fee || DEFAULT_SETTINGS.rentalCodFee)),
    stationCount: Number(row.station_count),
    minBookingDate: String(row.min_booking_date || ''),
    maxBookingDate: String(row.max_booking_date || ''),
    closedDates,
    holdPendingSlots: Boolean(row.hold_pending_slots),
    pendingHoldMinutes: Number(row.pending_hold_minutes),
    upiEnabled: Boolean(row.upi_enabled),
    upiId: String(row.upi_id || ''),
    upiAccountName: String(row.upi_account_name || ''),
    upiInstructions: String(row.upi_instructions || ''),
    cancellationRules: String(row.cancellation_rules || '')
  };
}

function mapStation(row: Record<string, unknown>): Station {
  return {
    id: Number(row.id),
    name: String(row.name),
    status: String(row.status) as StationStatus,
    note: String(row.note || '')
  };
}

function mapBlock(row: Record<string, unknown>): StationBlock {
  return {
    id: String(row.id),
    stationId: Number(row.station_id),
    date: String(row.block_date),
    startHour: Number(row.start_hour),
    endHour: Number(row.end_hour),
    reason: String(row.reason || ''),
    createdAt: String(row.created_at)
  };
}

function mapBooking(row: Record<string, unknown>): BookingRecord {
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
    upiRef: String(row.upi_ref || ''),
    status: String(row.status) as BookingStatus,
    notes: String(row.notes || ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function queryOverlappingRecords(
  db: DatabaseSync,
  startDate: string,
  endDate: string
): { blocks: StationBlock[]; bookings: BookingRecord[] } {
  const blocks = db
    .prepare('SELECT * FROM station_blocks WHERE block_date >= ? AND block_date <= ?')
    .all(startDate, endDate)
    .map(mapBlock);

  const bookings = db
    .prepare(
      `SELECT * FROM bookings WHERE status != 'Cancelled' AND (
        (booking_type != 'rental' AND booking_date >= ? AND booking_date <= ?)
        OR (booking_type = 'rental' AND booking_date <= ? AND COALESCE(NULLIF(end_date, ''), booking_date) >= ?)
      )`
    )
    .all(startDate, endDate, endDate, startDate)
    .map(mapBooking);

  return { blocks, bookings };
}

function ensureStationsForCount(db: DatabaseSync, count: number): void {
  const now = new Date().toISOString();
  for (let i = 1; i <= count; i++) {
    db.prepare(
      'INSERT OR IGNORE INTO stations (id, name, status, note, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(i, `PS5 Station ${i}`, 'active', '', now);
  }
}

function readSettingsSync(db: DatabaseSync): AdminSettings {
  const row = db.prepare('SELECT * FROM admin_settings WHERE id = 1').get();
  if (!row) return { ...DEFAULT_SETTINGS };
  return mapSettings(row);
}

function generateBookingCode(dateStr: string, db: DatabaseSync, prefix: string = 'GZ'): string {
  const compact = dateStr.replace(/-/g, '').slice(2);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 25; attempt++) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += chars[crypto.randomInt(0, chars.length)];
    }
    const code = `${prefix}-${compact}-${suffix}`;
    const exists = db.prepare('SELECT 1 FROM bookings WHERE booking_code = ?').get(code);
    if (!exists) return code;
  }
  return `${prefix}-${compact}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export const sqliteRepository: GameZoneRepository = {
  mode: 'sqlite',

  async getSettings(): Promise<AdminSettings> {
    return readSettingsSync(getDb());
  },

  async updateSettings(patch: Partial<AdminSettings>): Promise<AdminSettings> {
    const db = getDb();
    const cur = readSettingsSync(db);
    const nextSlotPrices = patch.slotPrices
      ? sanitizePriceTable(patch.slotPrices, cur.slotPrices)
      : { ...cur.slotPrices };
    const nextRentalPrices = patch.rentalPrices
      ? sanitizePriceTable(patch.rentalPrices, cur.rentalPrices)
      : { ...cur.rentalPrices };

    let nextHourlyPrice = Math.max(1, Number(patch.hourlyPrice ?? cur.hourlyPrice));
    if (patch.slotPrices?.['1'] && patch.hourlyPrice === undefined) {
      nextHourlyPrice = nextSlotPrices['1'];
    } else if (patch.hourlyPrice !== undefined && !patch.slotPrices) {
      nextSlotPrices['1'] = nextHourlyPrice;
    }

    const next: AdminSettings = {
      ...cur,
      ...patch,
      openingHour: Math.max(0, Math.min(22, Number(patch.openingHour ?? cur.openingHour))),
      closingHour: Math.max(1, Math.min(24, Number(patch.closingHour ?? cur.closingHour))),
      hourlyPrice: nextHourlyPrice,
      regularHourlyPrice: Math.max(
        1,
        Math.round(Number(patch.regularHourlyPrice ?? cur.regularHourlyPrice) || 69)
      ),
      g29HourlyPrice: Math.max(
        1,
        Math.round(Number(patch.g29HourlyPrice ?? cur.g29HourlyPrice) || 149)
      ),
      slotPrices: nextSlotPrices,
      rentalPrices: nextRentalPrices,
      rentalCodFee: Math.max(1, Math.round(Number(patch.rentalCodFee ?? cur.rentalCodFee) || 99)),
      stationCount: Math.max(1, Math.min(12, Number(patch.stationCount ?? cur.stationCount))),
      pendingHoldMinutes: Math.max(0, Number(patch.pendingHoldMinutes ?? cur.pendingHoldMinutes)),
      closedDates: Array.isArray(patch.closedDates)
        ? patch.closedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        : cur.closedDates
    };
    if (next.closingHour <= next.openingHour) {
      throw new Error('Closing hour must be after opening hour.');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE admin_settings SET
        shop_name = ?, address = ?, contact_number = ?, whatsapp_number = ?,
        instagram_handle = ?, instagram_url = ?, google_maps_url = ?,
        opening_hour = ?, closing_hour = ?, hourly_price = ?, station_count = ?,
        min_booking_date = ?, max_booking_date = ?, closed_dates = ?,
        hold_pending_slots = ?, pending_hold_minutes = ?,
        upi_enabled = ?, upi_id = ?, upi_account_name = ?, upi_instructions = ?,
        cancellation_rules = ?, slot_prices = ?, rental_prices = ?, rental_cod_fee = ?,
        regular_hourly_price = ?, g29_hourly_price = ?, updated_at = ?
      WHERE id = 1
    `).run(
      next.shopName,
      next.address,
      next.contactNumber,
      next.whatsappNumber,
      next.instagramHandle,
      next.instagramUrl,
      next.googleMapsUrl,
      next.openingHour,
      next.closingHour,
      next.hourlyPrice,
      next.stationCount,
      next.minBookingDate,
      next.maxBookingDate,
      JSON.stringify(next.closedDates),
      next.holdPendingSlots ? 1 : 0,
      next.pendingHoldMinutes,
      next.upiEnabled ? 1 : 0,
      next.upiId,
      next.upiAccountName,
      next.upiInstructions,
      next.cancellationRules,
      JSON.stringify(next.slotPrices),
      JSON.stringify(next.rentalPrices),
      next.rentalCodFee,
      next.regularHourlyPrice,
      next.g29HourlyPrice,
      now
    );

    ensureStationsForCount(db, next.stationCount);
    return next;
  },

  async getStations(): Promise<Station[]> {
    const db = getDb();
    const settings = readSettingsSync(db);
    ensureStationsForCount(db, settings.stationCount);
    const rows = db
      .prepare('SELECT * FROM stations WHERE id <= ? ORDER BY id ASC')
      .all(settings.stationCount);
    return rows.map(mapStation);
  },

  async updateStation(
    id: number,
    patch: { status?: StationStatus; note?: string; name?: string }
  ): Promise<Station> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
    if (!row) throw new Error('Station not found.');
    const cur = mapStation(row);
    const nextStatus = patch.status ?? cur.status;
    if (!['active', 'disabled', 'maintenance'].includes(nextStatus)) {
      throw new Error('Invalid station status.');
    }
    const nextName = (patch.name ?? cur.name).trim() || cur.name;
    const nextNote = patch.note ?? cur.note;
    const now = new Date().toISOString();
    db.prepare('UPDATE stations SET name = ?, status = ?, note = ?, updated_at = ? WHERE id = ?').run(
      nextName,
      nextStatus,
      nextNote,
      now,
      id
    );
    return { id, name: nextName, status: nextStatus, note: nextNote };
  },

  async getAvailability(
    dateStr: string,
    duration: number,
    mode: BookingType = 'slot'
  ): Promise<AvailabilityPayload> {
    const db = getDb();
    const settings = readSettingsSync(db);
    const stations = db
      .prepare('SELECT * FROM stations WHERE id <= ? ORDER BY id ASC')
      .all(settings.stationCount)
      .map(mapStation);
    const endDateStr = mode === 'rental' ? getRentalEndDate(dateStr, duration) : dateStr;
    const { blocks, bookings } = queryOverlappingRecords(db, dateStr, endDateStr);

    return buildAvailabilityPayload(
      dateStr,
      duration,
      stations,
      blocks,
      bookings,
      settings,
      getKolkataNowParts(),
      mode
    );
  },

  async createBooking(input: CreateBookingInput): Promise<BookingRecord> {
    const db = getDb();
    const bookingType: BookingType = input.bookingType === 'rental' ? 'rental' : 'slot';
    const slotTier: SlotTier = bookingType === 'slot' ? normalizeSlotTier(input.slotTier) : 'regular';
    const customerName = String(input.customerName || '').trim();
    const mobile = normalizeIndianMobile(input.mobile);
    const players = Number(input.players);
    const duration = Number(input.duration);
    const rawStartHour = Number(input.startHour);
    const dateStr = String(input.date || '').trim();
    const isAdminManual = Boolean(input.isAdminManual);
    const paymentMethod: PaymentMethod = normalizePaymentMethodForType(
      bookingType,
      input.paymentMethod,
      isAdminManual
    );
    const upiRef = String(input.upiRef || '').trim();

    if (customerName.length < 2) throw new Error('Enter customer full name (min 2 characters).');
    if (!mobile) throw new Error('Enter a valid 10-digit Indian mobile number.');
    if (!Number.isInteger(players) || players < 1 || players > 4) {
      throw new Error('Number of players must be between 1 and 4.');
    }
    if (bookingType === 'rental') {
      if (!Number.isInteger(duration) || duration < 1 || duration > 7) {
        throw new Error('Rental duration must be 1 to 7 days.');
      }
    } else if (!Number.isInteger(duration) || duration < 1 || duration > 4) {
      throw new Error('Duration must be 1 to 4 hours.');
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      const settings = readSettingsSync(db);
      let startHour = rawStartHour;
      let endHour = rawStartHour + duration;
      let endDate = dateStr;

      if (bookingType === 'rental') {
        const rentalCheck = isRentalRangeBookable(dateStr, duration, settings);
        if (!rentalCheck.ok) throw new Error(rentalCheck.reason || 'Rental dates unavailable.');
        endDate = rentalCheck.endDate;
        startHour = settings.openingHour;
        endHour = settings.closingHour;
      } else {
        const dateCheck = isDateBookable(dateStr, settings);
        if (!dateCheck.ok) throw new Error(dateCheck.reason || 'Date cannot be booked.');

        const timeCheck = isSlotWithinHoursAndNotPast(dateStr, rawStartHour, duration, settings);
        if (!timeCheck.ok) throw new Error(timeCheck.reason || 'Invalid time slot.');
      }

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

      const stations = db
        .prepare('SELECT * FROM stations WHERE id <= ? ORDER BY id ASC')
        .all(settings.stationCount)
        .map(mapStation);
      const { blocks, bookings } = queryOverlappingRecords(db, dateStr, endDate);

      const evaluate = (st: Station) =>
        bookingType === 'rental'
          ? evaluateStationRental(st, dateStr, duration, blocks, bookings, settings)
          : evaluateStationSlot(st, dateStr, startHour, duration, blocks, bookings, settings);

      let chosenStation: Station | undefined;
      if (input.stationChoice === 'auto') {
        chosenStation = stations.find((st) => evaluate(st).available);
        if (!chosenStation) {
          throw new Error(
            bookingType === 'rental'
              ? 'All PS5 consoles are already booked for those rental dates.'
              : 'All PS5 stations for this slot just became unavailable.'
          );
        }
      } else {
        const stationId = Number(input.stationChoice);
        chosenStation = stations.find((st) => st.id === stationId);
        if (!chosenStation) throw new Error('Selected PS5 station does not exist.');
        const slotState = evaluate(chosenStation);
        if (!slotState.available) {
          throw new Error(`${chosenStation.name} is unavailable (${slotState.reason}).`);
        }
      }

      const nowIso = new Date().toISOString();
      const existingCustomer = db.prepare('SELECT id FROM customers WHERE mobile = ?').get(mobile);
      let customerId: string;
      if (existingCustomer) {
        customerId = String(existingCustomer.id);
        db.prepare('UPDATE customers SET full_name = ?, updated_at = ? WHERE id = ?').run(
          customerName,
          nowIso,
          customerId
        );
      } else {
        customerId = crypto.randomUUID();
        db.prepare(
          'INSERT INTO customers (id, full_name, mobile, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).run(customerId, customerName, mobile, nowIso, nowIso);
      }

      const bookingId = crypto.randomUUID();
      const bookingCode = generateBookingCode(
        dateStr,
        db,
        bookingType === 'rental' ? 'RN' : 'GZ'
      );
      const totalAmount =
        bookingType === 'rental'
          ? getRentalPackagePrice(duration, settings)
          : getSlotPriceForTier(duration, slotTier, settings);
      const priceSnapshot =
        bookingType === 'rental'
          ? Math.round(totalAmount / duration)
          : slotTier === 'g29'
            ? settings.g29HourlyPrice
            : settings.regularHourlyPrice;
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

      db.prepare(`
        INSERT INTO bookings (
          id, booking_code, booking_type, slot_tier, customer_id, customer_name, mobile, players,
          station_id, station_name, booking_date, end_date, start_hour, end_hour, duration,
          hourly_price_snapshot, total_amount, payment_method, payment_status,
          upi_ref, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bookingId,
        bookingCode,
        bookingType,
        slotTier,
        customerId,
        customerName,
        mobile,
        players,
        chosenStation.id,
        chosenStation.name,
        dateStr,
        endDate,
        startHour,
        endHour,
        duration,
        priceSnapshot,
        totalAmount,
        paymentMethod,
        paymentStatus,
        upiRef,
        status,
        String(input.notes || '').trim(),
        nowIso,
        nowIso
      );

      db.prepare(`
        INSERT INTO payments (id, booking_id, method, amount, reference, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        bookingId,
        paymentMethod,
        totalAmount,
        upiRef,
        paymentStatus,
        nowIso
      );

      db.exec('COMMIT');

      const inserted = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
      if (!inserted) throw new Error('Booking failed to persist.');
      return mapBooking(inserted);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  async getBookingByCode(bookingCode: string): Promise<BookingRecord | null> {
    const clean = bookingCode.trim().toUpperCase();
    if (!clean) return null;
    const row = getDb().prepare('SELECT * FROM bookings WHERE booking_code = ?').get(clean);
    return row ? mapBooking(row) : null;
  },

  async listBookings(filters?: { search?: string; date?: string; status?: string }): Promise<BookingRecord[]> {
    const db = getDb();
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters?.date) {
      clauses.push('booking_date = ?');
      params.push(filters.date);
    }
    if (filters?.status && filters.status !== 'All') {
      clauses.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      clauses.push('(LOWER(customer_name) LIKE ? OR mobile LIKE ? OR LOWER(booking_code) LIKE ?)');
      params.push(term, term, term);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM bookings ${whereSql} ORDER BY booking_date DESC, start_hour ASC, created_at DESC`)
      .all(...params);
    return rows.map(mapBooking);
  },

  async updateBooking(id: string, patch: UpdateBookingInput): Promise<BookingRecord> {
    const db = getDb();
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
      if (!row) throw new Error('Booking not found.');
      const cur = mapBooking(row);
      const settings = readSettingsSync(db);

      const nextName = patch.customerName !== undefined ? patch.customerName.trim() : cur.customerName;
      const nextMobile = patch.mobile !== undefined ? normalizeIndianMobile(patch.mobile) : cur.mobile;
      if (!nextMobile) throw new Error('Invalid Indian mobile number.');

      const nextType: BookingType = patch.bookingType ?? cur.bookingType;
      const nextTier: SlotTier =
        nextType === 'slot' ? normalizeSlotTier(patch.slotTier ?? cur.slotTier) : 'regular';
      const nextPlayers = patch.players !== undefined ? Number(patch.players) : cur.players;
      const nextDate = patch.date !== undefined ? patch.date : cur.date;
      const nextDuration = patch.duration !== undefined ? Number(patch.duration) : cur.duration;
      const nextEndDate = nextType === 'rental' ? getRentalEndDate(nextDate, nextDuration) : nextDate;
      const nextStart =
        nextType === 'rental'
          ? settings.openingHour
          : patch.startHour !== undefined
          ? Number(patch.startHour)
          : cur.startHour;
      const nextEndHour = nextType === 'rental' ? settings.closingHour : nextStart + nextDuration;
      const nextStationId = patch.stationId !== undefined ? Number(patch.stationId) : cur.stationId;
      const nextStatus = patch.status !== undefined ? patch.status : cur.status;
      const nextPaymentMethod = patch.paymentMethod !== undefined ? patch.paymentMethod : cur.paymentMethod;
      const nextPaymentStatus = patch.paymentStatus !== undefined ? patch.paymentStatus : cur.paymentStatus;
      const nextUpiRef = patch.upiRef !== undefined ? patch.upiRef : cur.upiRef;
      const nextNotes = patch.notes !== undefined ? patch.notes : cur.notes;

      const stationRow = db.prepare('SELECT * FROM stations WHERE id = ?').get(nextStationId);
      if (!stationRow) throw new Error('Target PS5 station not found.');
      const station = mapStation(stationRow);

      if (nextStatus === 'Confirmed' || nextStatus === 'Completed') {
        if (nextType === 'slot' && (nextStart < settings.openingHour || nextEndHour > settings.closingHour)) {
          throw new Error('Slot exceeds shop operating hours.');
        }
        const { blocks, bookings } = queryOverlappingRecords(db, nextDate, nextEndDate);
        const slotState =
          nextType === 'rental'
            ? evaluateStationRental(station, nextDate, nextDuration, blocks, bookings, settings, cur.id)
            : evaluateStationSlot(station, nextDate, nextStart, nextDuration, blocks, bookings, settings, cur.id);
        if (!slotState.available) {
          throw new Error(`Conflict on ${station.name}: ${slotState.reason}`);
        }
      }

      // Preserve existing booking total unless duration, type, or tier explicitly changed
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

      db.prepare(`
        UPDATE bookings SET
          booking_type = ?, slot_tier = ?, customer_name = ?, mobile = ?, players = ?, station_id = ?, station_name = ?,
          booking_date = ?, end_date = ?, start_hour = ?, end_hour = ?, duration = ?,
          total_amount = ?, payment_method = ?, payment_status = ?, upi_ref = ?,
          status = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        nextType,
        nextTier,
        nextName,
        nextMobile,
        nextPlayers,
        station.id,
        station.name,
        nextDate,
        nextEndDate,
        nextStart,
        nextEndHour,
        nextDuration,
        nextTotal,
        nextPaymentMethod,
        nextPaymentStatus,
        nextUpiRef,
        nextStatus,
        nextNotes,
        nowIso,
        cur.id
      );

      db.prepare(
        'UPDATE payments SET method = ?, amount = ?, reference = ?, status = ?, updated_at = ? WHERE booking_id = ?'
      ).run(nextPaymentMethod, nextTotal, nextUpiRef, nextPaymentStatus, nowIso, cur.id);

      db.exec('COMMIT');
      const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(cur.id);
      if (!updated) throw new Error('Updated booking missing.');
      return mapBooking(updated);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  async getStats(): Promise<DashboardStats> {
    const rows = getDb().prepare('SELECT * FROM bookings').all().map(mapBooking);
    return computeDashboardStats(rows, getKolkataNowParts().dateStr);
  },

  async listBlocks(dateStr?: string): Promise<StationBlock[]> {
    const db = getDb();
    const rows = dateStr
      ? db.prepare('SELECT * FROM station_blocks WHERE block_date = ? ORDER BY start_hour ASC').all(dateStr)
      : db.prepare('SELECT * FROM station_blocks ORDER BY block_date DESC, start_hour ASC').all();
    return rows.map(mapBlock);
  },

  async createBlock(input: CreateBlockInput): Promise<StationBlock> {
    const db = getDb();
    const stationId = Number(input.stationId);
    const startHour = Number(input.startHour);
    const endHour = Number(input.endHour);
    if (!Number.isInteger(startHour) || !Number.isInteger(endHour) || endHour <= startHour) {
      throw new Error('End hour must be after start hour.');
    }
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const reason = input.reason.trim() || 'Manual Block / Maintenance';
    db.prepare(
      'INSERT INTO station_blocks (id, station_id, block_date, start_hour, end_hour, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, stationId, input.date, startHour, endHour, reason, nowIso);
    return { id, stationId, date: input.date, startHour, endHour, reason, createdAt: nowIso };
  },

  async deleteBlock(id: string): Promise<void> {
    getDb().prepare('DELETE FROM station_blocks WHERE id = ?').run(id);
  }
};

