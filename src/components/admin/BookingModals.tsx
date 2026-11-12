'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import {
  formatDateDisplay,
  formatDuration,
  formatHourLabel,
  formatINR,
  getKolkataNowParts,
  getRentalEndDate,
  getRentalPackagePrice,
  getRentalPaymentBreakdown,
  getSlotPriceForTier,
  getSlotTierLabel,
  normalizeSlotTier
} from '@/lib/booking-rules';
import type {
  AdminSettings,
  BookingRecord,
  BookingStatus,
  BookingType,
  PaymentMethod,
  SlotTier,
  Station
} from '@/types/booking';

interface BookingFormModalProps {
  mode: 'create' | 'edit';
  booking?: BookingRecord;
  stations: Station[];
  settings: AdminSettings;
  onClose: () => void;
  onSaved: () => void;
}

export function BookingFormModal({
  mode,
  booking,
  stations,
  settings,
  onClose,
  onSaved
}: BookingFormModalProps) {
  const todayIst = getKolkataNowParts().dateStr;
  const [bookingType, setBookingType] = useState<BookingType>(booking?.bookingType || 'slot');
  const [slotTier, setSlotTier] = useState<SlotTier>(normalizeSlotTier(booking?.slotTier));
  const [customerName, setCustomerName] = useState(booking?.customerName || '');
  const [mobile, setMobile] = useState(booking?.mobile || '');
  const [players, setPlayers] = useState(booking?.players || 1);
  const [date, setDate] = useState(booking?.date || todayIst);
  const [startHour, setStartHour] = useState(booking?.startHour ?? settings.openingHour);
  const [duration, setDuration] = useState(booking?.duration || 1);
  const [stationChoice, setStationChoice] = useState<string>(
    booking ? String(booking.stationId) : 'auto'
  );
  const [status, setStatus] = useState<BookingStatus>(booking?.status || 'Confirmed');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    booking?.paymentMethod || 'Pay at Shop'
  );
  const [paymentStatus, setPaymentStatus] = useState(
    booking?.paymentStatus || 'Paid at Shop'
  );
  const [upiRef, setUpiRef] = useState(booking?.upiRef || '');
  const [notes, setNotes] = useState(booking?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hoursList: number[] = [];
  for (let h = settings.openingHour; h < settings.closingHour; h++) hoursList.push(h);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const url =
        mode === 'create' ? '/api/admin/bookings' : `/api/admin/bookings/${booking!.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const body =
        mode === 'create'
          ? {
              bookingType,
              slotTier,
              customerName,
              mobile,
              players,
              date,
              startHour: bookingType === 'rental' ? settings.openingHour : startHour,
              duration,
              stationChoice: stationChoice === 'auto' ? 'auto' : Number(stationChoice),
              status,
              paymentMethod,
              paymentStatus,
              upiRef,
              notes
            }
          : {
              bookingType,
              slotTier,
              customerName,
              mobile,
              players,
              date,
              startHour: bookingType === 'rental' ? settings.openingHour : startHour,
              duration,
              stationId: Number(stationChoice),
              status,
              paymentMethod,
              paymentStatus,
              upiRef,
              notes
            };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || 'Could not save booking.');
        return;
      }
      onSaved();
    } catch {
      setError('Network error saving booking.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-brand-surface rounded-2xl border border-brand-border max-w-lg w-full p-5 sm:p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-brand-glow">
            {mode === 'create' ? 'Create Manual Booking' : `Edit ${booking?.bookingCode}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-brand-border flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">Service Type *</label>
            <select
              value={bookingType}
              onChange={(e) => {
                const nextType = e.target.value as BookingType;
                setBookingType(nextType);
                if (nextType === 'slot' && duration > 4) setDuration(1);
                if (nextType === 'rental' && (paymentMethod === 'Pay at Shop' || paymentMethod === 'UPI Advance')) {
                  setPaymentMethod('COD');
                } else if (nextType === 'slot' && (paymentMethod === 'COD' || paymentMethod === 'Full Online')) {
                  setPaymentMethod('Pay at Shop');
                }
              }}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5 bg-brand-surface"
            >
              <option value="slot">GameZone Slot (Play at Shop • 1–4 Hrs)</option>
              <option value="rental">PS5 Home Rental (1–7 Days)</option>
            </select>
          </div>

          {bookingType === 'slot' && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Slot Setup</label>
              <select
                value={slotTier}
                onChange={(e) => setSlotTier(normalizeSlotTier(e.target.value))}
                className="w-full rounded-xl border border-brand-border px-3 py-2.5 bg-brand-surface"
              >
                <option value="regular">
                  Regular PS5 Games ({formatINR(settings.regularHourlyPrice || 69)}/hr)
                </option>
                <option value="g29">
                  Logitech G29 Racing Sim ({formatINR(settings.g29HourlyPrice || 149)}/hr)
                </option>
              </select>
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">Customer Name *</label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Mobile (India) *</label>
            <input
              type="tel"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Players (1–4)</label>
            <select
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value))}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5 bg-brand-surface"
            >
              {[1, 2, 3, 4].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              {bookingType === 'rental' ? 'Pickup Date' : 'Date'}
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5"
            />
          </div>

          {bookingType === 'slot' ? (
            <div>
              <label className="block text-xs font-semibold mb-1">Start Hour</label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="w-full rounded-xl border border-brand-border px-3 py-2.5 bg-brand-surface"
              >
                {hoursList.map((h) => (
                  <option key={h} value={h}>{formatHourLabel(h)}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold mb-1">Last Rental Day</label>
              <div className="rounded-xl border border-brand-border bg-brand-soft px-3 py-2.5 text-brand-dark font-medium">
                {formatDateDisplay(getRentalEndDate(date, duration))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1">
              {bookingType === 'rental' ? 'Rental Package (Days)' : 'Duration (Hours)'}
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5 bg-brand-surface"
            >
              {bookingType === 'rental'
                ? [1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>
                      {formatDuration(d, 'rental')} – {formatINR(getRentalPackagePrice(d, settings))}
                    </option>
                  ))
                : [1, 2, 3, 4].map((d) => (
                    <option key={d} value={d}>
                      {formatDuration(d, 'slot')} – {formatINR(getSlotPriceForTier(d, slotTier, settings))}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">PS5 Station</label>
            <select
              value={stationChoice}
              onChange={(e) => setStationChoice(e.target.value)}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5 bg-brand-surface"
            >
              {mode === 'create' && <option value="auto">Auto Assign</option>}
              {stations.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Booking Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BookingStatus)}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5 bg-brand-surface"
            >
              {(['Pending', 'Confirmed', 'Completed', 'Cancelled'] as BookingStatus[]).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5 bg-brand-surface"
            >
              <option value="Pay at Shop">Pay at Shop</option>
              <option value="UPI Advance">UPI Advance</option>
              <option value="COD">COD (Online Confirmation Fee ₹{settings.rentalCodFee})</option>
              <option value="Full Online">Full Online Payment</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full rounded-xl border border-brand-border px-3 py-2.5 bg-brand-surface"
            >
              <option value="Unpaid (Pay at Shop)">Unpaid (Pay at Shop)</option>
              <option value="Verification Pending">Verification Pending</option>
              <option value={`COD (₹${settings.rentalCodFee} Online Pending)`}>
                COD (₹{settings.rentalCodFee} Online Pending)
              </option>
              <option value={`COD ₹${settings.rentalCodFee} Paid (Balance on Delivery)`}>
                COD ₹{settings.rentalCodFee} Paid (Balance on Delivery)
              </option>
              <option value="Full Online Verification Pending">Full Online Verification Pending</option>
              <option value="Paid at Shop">Paid at Shop</option>
              <option value="Paid (UPI Verified)">Paid (UPI Verified)</option>
              <option value="Paid (COD Settled)">Paid (COD Settled)</option>
              <option value="Refunded / Cancelled">Refunded / Cancelled</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">UPI Reference / Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional shop notes"
              className="w-full rounded-xl border border-brand-border px-3 py-2.5"
            />
          </div>

          {booking && (
            <div className="sm:col-span-2 text-xs text-brand-muted bg-brand-soft rounded-xl p-3 border border-brand-border">
              Original Total: <strong>{formatINR(booking.totalAmount)}</strong> •{' '}
              Current Selection:{' '}
              <strong>
                {formatINR(
                  duration === booking.duration &&
                    bookingType === booking.bookingType &&
                    (bookingType === 'rental' || slotTier === normalizeSlotTier(booking.slotTier))
                    ? booking.totalAmount
                    : bookingType === 'rental'
                    ? getRentalPackagePrice(duration, settings)
                    : getSlotPriceForTier(duration, slotTier, settings)
                )}
              </strong>
            </div>
          )}

          {error && (
            <div className="sm:col-span-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3">
              {error}
            </div>
          )}

          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-brand-border px-4 py-2.5 font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-primary text-white px-5 py-2.5 font-bold disabled:opacity-60"
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Create Booking' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function BookingDetailsModal({
  booking,
  rentalCodFee = 99,
  onClose
}: {
  booking: BookingRecord;
  rentalCodFee?: number;
  onClose: () => void;
}) {
  const pay = getRentalPaymentBreakdown(booking.totalAmount, booking.paymentMethod, rentalCodFee);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-brand-surface rounded-2xl border border-brand-border max-w-md w-full p-5 sm:p-6 shadow-elevated space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-brand-glow">{booking.bookingCode}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-brand-border flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-muted">Service</span>
            <strong className="text-brand-glow">
              {booking.bookingType === 'rental'
                ? 'PS5 Home Rental'
                : `GameZone Slot (${getSlotTierLabel(booking.slotTier)})`}
            </strong>
          </div>
          <div className="flex justify-between"><span className="text-brand-muted">Customer</span><strong>{booking.customerName}</strong></div>
          <div className="flex justify-between"><span className="text-brand-muted">Mobile</span><strong>{booking.mobile}</strong></div>
          <div className="flex justify-between"><span className="text-brand-muted">Station</span><strong>{booking.stationName}</strong></div>
          {booking.bookingType === 'rental' ? (
            <>
              <div className="flex justify-between"><span className="text-brand-muted">Pickup Date</span><strong>{formatDateDisplay(booking.date)}</strong></div>
              <div className="flex justify-between"><span className="text-brand-muted">Last Rental Day</span><strong>{formatDateDisplay(booking.endDate || booking.date)}</strong></div>
              <div className="flex justify-between"><span className="text-brand-muted">Duration</span><strong>{formatDuration(booking.duration, 'rental')}</strong></div>
            </>
          ) : (
            <>
              <div className="flex justify-between"><span className="text-brand-muted">Date</span><strong>{formatDateDisplay(booking.date)}</strong></div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Time</span>
                <strong>{formatHourLabel(booking.startHour)} – {formatHourLabel(booking.endHour)} ({formatDuration(booking.duration, 'slot')})</strong>
              </div>
            </>
          )}
          <div className="flex justify-between"><span className="text-brand-muted">Total Amount</span><strong className="text-brand-glow">{formatINR(booking.totalAmount)}</strong></div>
          {booking.bookingType === 'rental' && (
            <>
              <div className="flex justify-between">
                <span className="text-brand-muted">Pay Online Now</span>
                <strong>{formatINR(pay.payOnlineNow)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Balance on Delivery</span>
                <strong>{formatINR(pay.payOnDelivery)}</strong>
              </div>
            </>
          )}
          <div className="flex justify-between"><span className="text-brand-muted">Booking Status</span><strong>{booking.status}</strong></div>
          <div className="flex justify-between"><span className="text-brand-muted">Payment Method</span><strong>{booking.paymentMethod}</strong></div>
          <div className="flex justify-between"><span className="text-brand-muted">Payment Status</span><strong>{booking.paymentStatus}</strong></div>
          {booking.upiRef && <div className="flex justify-between"><span className="text-brand-muted">UPI Ref</span><strong className="font-mono">{booking.upiRef}</strong></div>}
          {booking.notes && <div className="pt-2 border-t border-brand-border text-xs text-brand-muted">Notes: {booking.notes}</div>}
        </div>
      </div>
    </div>
  );
}

