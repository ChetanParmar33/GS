'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Clock,
  MessageCircle,
  RefreshCw,
  XCircle
} from 'lucide-react';
import {
  addDaysToDateStr,
  buildUpiIntentUrl,
  buildWhatsAppUrl,
  formatDateDisplay,
  formatDuration,
  formatHourLabel,
  formatINR,
  formatSlotRange,
  getKolkataNowParts,
  getRentalEndDate,
  getRentalPackagePrice,
  getRentalPaymentBreakdown,
  getSlotPriceForTier,
  getSlotTierLabel,
  isDateBookable,
  normalizeIndianMobile
} from '@/lib/booking-rules';
import type {
  AdminSettings,
  AvailabilityPayload,
  BookingRecord,
  BookingType,
  PaymentMethod,
  SlotTier
} from '@/types/booking';

interface BookingFlowProps {
  settings: AdminSettings;
  initialMode?: BookingType;
  initialTier?: SlotTier;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getInitialDate(settings: AdminSettings): string {
  const nowParts = getKolkataNowParts();
  if (
    isDateBookable(nowParts.dateStr, settings, nowParts).ok &&
    nowParts.hour < settings.closingHour - 1
  ) {
    return nowParts.dateStr;
  }
  const tomorrow = addDaysToDateStr(nowParts.dateStr, 1);
  if (isDateBookable(tomorrow, settings, nowParts).ok) return tomorrow;
  return nowParts.dateStr;
}

export function BookingFlow({
  settings,
  initialMode = 'slot',
  initialTier = 'regular'
}: BookingFlowProps) {
  const topRef = useRef<HTMLDivElement | null>(null);
  const initialDate = useMemo(() => getInitialDate(settings), [settings]);

  const [bookingMode, setBookingMode] = useState<BookingType>(initialMode);
  const [slotTier, setSlotTier] = useState<SlotTier>(initialTier);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [calView, setCalView] = useState<{ year: number; month: number }>(() => {
    const [y, m] = initialDate.split('-').map(Number);
    return { year: y, month: m - 1 };
  });

  const [duration, setDuration] = useState<number>(1);
  const [startHour, setStartHour] = useState<number | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialMode === 'rental' ? 'COD' : 'Pay at Shop'
  );
  const [upiRef, setUpiRef] = useState('');

  const [availability, setAvailability] = useState<AvailabilityPayload | null>(null);
  const [loadingAvail, setLoadingAvail] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [stepError, setStepError] = useState<string>('');
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const refreshReceiptStatus = useCallback(async (bookingCode: string) => {
    if (!bookingCode) return;
    setCheckingStatus(true);
    try {
      const res = await fetch(
        `/api/bookings/status?code=${encodeURIComponent(bookingCode)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const data = (await res.json()) as Partial<BookingRecord>;
      setConfirmedBooking((prev) => {
        if (!prev || prev.bookingCode !== bookingCode) return prev;
        const next: BookingRecord = {
          ...prev,
          bookingType: data.bookingType ?? prev.bookingType,
          slotTier: data.slotTier ?? prev.slotTier,
          status: data.status ?? prev.status,
          paymentStatus: data.paymentStatus ?? prev.paymentStatus,
          stationName: data.stationName ?? prev.stationName,
          date: data.date ?? prev.date,
          endDate: data.endDate ?? prev.endDate,
          startHour: data.startHour ?? prev.startHour,
          endHour: data.endHour ?? prev.endHour,
          duration: data.duration ?? prev.duration,
          totalAmount: data.totalAmount ?? prev.totalAmount
        };
        try {
          window.sessionStorage.setItem('gs_last_booking', JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
    } catch {
      // Ignore transient network errors during background status check
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem('gs_last_booking');
      if (saved) {
        const parsed = JSON.parse(saved) as BookingRecord;
        setConfirmedBooking(parsed);
        if (parsed.bookingCode) {
          void refreshReceiptStatus(parsed.bookingCode);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [refreshReceiptStatus]);

  useEffect(() => {
    if (!confirmedBooking?.bookingCode || confirmedBooking.status !== 'Pending') return;
    const code = confirmedBooking.bookingCode;
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshReceiptStatus(code);
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [confirmedBooking?.bookingCode, confirmedBooking?.status, refreshReceiptStatus]);

  const nowParts = getKolkataNowParts();
  const totalAmount =
    bookingMode === 'rental'
      ? getRentalPackagePrice(duration, settings)
      : getSlotPriceForTier(duration, slotTier, settings);
  const rentalEndDate = getRentalEndDate(selectedDate, duration);
  const codBreakdown = getRentalPaymentBreakdown(totalAmount, 'COD', settings.rentalCodFee);
  const rentalBreakdown = getRentalPaymentBreakdown(
    totalAmount,
    paymentMethod,
    settings.rentalCodFee
  );
  const confirmedBreakdown = confirmedBooking
    ? getRentalPaymentBreakdown(
        confirmedBooking.totalAmount,
        confirmedBooking.paymentMethod,
        settings.rentalCodFee
      )
    : null;

  const fetchAvailability = useCallback(
    async (dateStr: string, dur: number, mode: BookingType) => {
      setLoadingAvail(true);
      try {
        const res = await fetch(
          `/api/availability?mode=${mode}&date=${encodeURIComponent(dateStr)}&duration=${dur}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error('Failed to load live availability.');
        const data = (await res.json()) as AvailabilityPayload;
        setAvailability(data);
      } catch (err) {
        setStepError(err instanceof Error ? err.message : 'Unable to fetch availability.');
      } finally {
        setLoadingAvail(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchAvailability(selectedDate, duration, bookingMode);
  }, [selectedDate, duration, bookingMode, fetchAvailability]);

  useEffect(() => {
    if (!availability || bookingMode === 'rental' || startHour === null) return;
    const slot = availability.slots.find((s) => s.startHour === startHour);
    if (!slot || !slot.bookable) {
      setStartHour(null);
    }
  }, [availability, startHour, bookingMode]);

  useEffect(() => {
    if (bookingMode === 'rental') {
      if (paymentMethod !== 'COD' && paymentMethod !== 'Full Online') {
        setPaymentMethod('COD');
      }
      return;
    }
    if (paymentMethod !== 'Pay at Shop') {
      setPaymentMethod('Pay at Shop');
    }
  }, [bookingMode, paymentMethod]);

  const calendarDays = useMemo(() => {
    const { year, month } = calView;
    const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells: Array<{
      dateStr: string;
      day: number;
      bookable: boolean;
      isSelected: boolean;
    } | null> = [];

    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      const check = isDateBookable(dateStr, settings, nowParts);
      cells.push({
        dateStr,
        day: d,
        bookable: check.ok,
        isSelected: dateStr === selectedDate
      });
    }
    return cells;
  }, [calView, settings, nowParts, selectedDate]);

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function shiftMonth(delta: number) {
    setCalView((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  function switchMode(nextMode: BookingType) {
    if (nextMode === bookingMode) return;
    setBookingMode(nextMode);
    setStep(1);
    setDuration(1);
    setStartHour(null);
    setPaymentMethod(nextMode === 'rental' ? 'COD' : 'Pay at Shop');
    setUpiRef('');
    setStepError('');
  }

  function goToStep2() {
    setStepError('');
    if (!availability?.dateBookable) {
      setStepError(availability?.dateReason || 'Please choose an open booking date.');
      return;
    }
    if (bookingMode === 'rental') {
      if ((availability?.rentalAvailableCount || 0) <= 0) {
        setStepError('All PS5 consoles are unavailable for the selected rental dates.');
        return;
      }
    } else {
      const selectedSlot = availability?.slots.find((s) => s.startHour === startHour);
      if (startHour === null || !selectedSlot?.bookable) {
        setStepError('Please select a time slot first.');
        return;
      }
    }
    setStep(2);
    scrollTop();
  }

  function goToStep3() {
    setStepError('');
    if (customerName.trim().length < 2) {
      setStepError('Please enter your full name (minimum 2 characters).');
      return;
    }
    if (!normalizeIndianMobile(mobile)) {
      setStepError('Please enter a valid 10-digit Indian mobile number starting with 6–9.');
      return;
    }
    setStep(3);
    scrollTop();
  }

  async function handleConfirmBooking() {
    if (submitting) return;
    setStepError('');

    if (bookingMode === 'rental' && upiRef.trim().length > 0 && upiRef.trim().length < 6) {
      setStepError(
        'Enter a valid UPI UTR / transaction reference (minimum 6 characters) or leave blank to share on WhatsApp.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingType: bookingMode,
          slotTier: bookingMode === 'slot' ? slotTier : 'regular',
          customerName: customerName.trim(),
          mobile: mobile.trim(),
          date: selectedDate,
          startHour: bookingMode === 'rental' ? settings.openingHour : startHour,
          duration,
          stationChoice: 'auto',
          paymentMethod: bookingMode === 'rental' ? paymentMethod : 'Pay at Shop',
          upiRef: bookingMode === 'rental' ? upiRef.trim() : ''
        })
      });
      const json = (await res.json()) as {
        booking?: BookingRecord;
        settings?: AdminSettings;
        error?: string;
      };
      if (!res.ok || !json.booking) {
        setStepError(json.error || 'Could not submit booking. Refreshing live availability...');
        await fetchAvailability(selectedDate, duration, bookingMode);
        return;
      }

      try {
        window.sessionStorage.setItem('gs_last_booking', JSON.stringify(json.booking));
      } catch {
        // Ignore storage errors
      }

      setConfirmedBooking(json.booking);
      setStartHour(null);
      setUpiRef('');
      await fetchAvailability(selectedDate, duration, bookingMode);

      const wa = buildWhatsAppUrl(json.booking, json.settings || settings);
      window.location.assign(wa.url);
    } catch {
      setStepError('Network error while submitting booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const whatsappPayload = useMemo(() => {
    if (!confirmedBooking) return null;
    return buildWhatsAppUrl(confirmedBooking, settings);
  }, [confirmedBooking, settings]);

  async function handleCopyWhatsApp() {
    if (!whatsappPayload) return;
    try {
      await navigator.clipboard.writeText(whatsappPayload.message);
      setCopiedMsg(true);
      window.setTimeout(() => setCopiedMsg(false), 2200);
    } catch {
      setCopiedMsg(false);
    }
  }

  function resetWizard() {
    try {
      window.sessionStorage.removeItem('gs_last_booking');
    } catch {
      // Ignore storage errors
    }
    setConfirmedBooking(null);
    setStep(1);
    setStepError('');
    void fetchAvailability(selectedDate, duration, bookingMode);
  }

  const selectedSetupLabel =
    bookingMode === 'rental' ? 'PS5 Home Console' : getSlotTierLabel(slotTier);

  const stepsMeta = [
    { num: 1 as const, title: bookingMode === 'rental' ? 'Date & Days' : 'Setup & Slot' },
    { num: 2 as const, title: 'Your Details' },
    { num: 3 as const, title: 'Review & Submit' }
  ];

  return (
    <div ref={topRef} className="max-w-2xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-5">
        <span className="text-xs font-semibold uppercase tracking-widest text-brand-accent">
          {settings.shopName} • Anand
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-glow tracking-[-0.015em] mt-1">
          {bookingMode === 'rental' ? 'Rent a PS5 Console' : 'Book Your Gaming Slot'}
        </h1>
        <p className="text-xs sm:text-sm text-brand-muted mt-1.5">
          {bookingMode === 'rental'
            ? `Home PS5 rental packages from ${formatINR(getRentalPackagePrice(1, settings))} (1–7 Days)`
            : `Regular PS5 ${formatINR(getSlotPriceForTier(1, 'regular', settings))}/hr • G29 Racing Sim ${formatINR(getSlotPriceForTier(1, 'g29', settings))}/hr • Open ${formatHourLabel(settings.openingHour)} – ${formatHourLabel(settings.closingHour)}`}
        </p>
      </div>

      {/* Mode Switcher */}
      {!confirmedBooking && (
        <div
          role="tablist"
          aria-label="Booking service type"
          className="grid grid-cols-2 gap-2 rounded-2xl bg-brand-surface border border-brand-border p-1.5 mb-5 shadow-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={bookingMode === 'slot'}
            onClick={() => switchMode('slot')}
            className={[
              'rounded-xl px-3 py-2.5 text-left transition-all tap-target',
              bookingMode === 'slot'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-brand-dark hover:bg-brand-soft'
            ].join(' ')}
          >
            <span className="block font-display text-xs sm:text-sm font-semibold">
              Gamezone Slot
            </span>
            <span
              className={`block text-[11px] mt-0.5 ${
                bookingMode === 'slot' ? 'text-purple-200' : 'text-brand-muted'
              }`}
            >
              PS5 {formatINR(getSlotPriceForTier(1, 'regular', settings))}/hr • G29 {formatINR(getSlotPriceForTier(1, 'g29', settings))}/hr
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={bookingMode === 'rental'}
            onClick={() => switchMode('rental')}
            className={[
              'rounded-xl px-3 py-2.5 text-left transition-all tap-target',
              bookingMode === 'rental'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-brand-dark hover:bg-brand-soft'
            ].join(' ')}
          >
            <span className="block font-display text-xs sm:text-sm font-semibold">
              Rent PS5 Console
            </span>
            <span
              className={`block text-[11px] mt-0.5 ${
                bookingMode === 'rental' ? 'text-purple-200' : 'text-brand-muted'
              }`}
            >
              Take home • {formatINR(getRentalPackagePrice(1, settings))}–{formatINR(getRentalPackagePrice(7, settings))}
            </span>
          </button>
        </div>
      )}

      {/* 3-Step Progress Header */}
      {!confirmedBooking && (
        <nav aria-label="Booking progress" className="mb-5">
          <ol className="grid grid-cols-3 gap-2">
            {stepsMeta.map((s) => {
              const isActive = step === s.num;
              const isDone = step > s.num;
              const canClick = s.num < step;
              return (
                <li key={s.num}>
                  <button
                    type="button"
                    disabled={!canClick}
                    onClick={() => {
                      if (canClick) {
                        setStepError('');
                        setStep(s.num);
                      }
                    }}
                    className={[
                      'w-full rounded-2xl border px-2 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-center transition-all',
                      isActive
                        ? 'bg-brand-primary border-brand-primary text-white shadow-card'
                        : isDone
                        ? 'bg-brand-surface border-brand-accent/50 text-brand-glow cursor-pointer hover:bg-brand-lavender'
                        : 'bg-brand-surface/70 border-brand-border text-brand-muted cursor-default'
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                        isActive
                          ? 'bg-brand-surface text-brand-glow'
                          : isDone
                          ? 'bg-brand-accent text-white'
                          : 'bg-brand-soft border border-brand-border text-brand-muted'
                      ].join(' ')}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                    </span>
                    <span className="text-[11px] sm:text-xs font-semibold leading-tight">
                      {s.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* BOOKING RECEIPT & LIVE APPROVAL STATUS */}
      {confirmedBooking ? (
        <div
          className={`rounded-3xl bg-brand-surface p-5 sm:p-7 shadow-elevated space-y-5 border ${
            confirmedBooking.status === 'Confirmed' || confirmedBooking.status === 'Completed'
              ? 'border-emerald-500/40'
              : confirmedBooking.status === 'Cancelled'
                ? 'border-red-500/40'
                : 'border-amber-500/40'
          }`}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {confirmedBooking.status === 'Pending' && (
                <>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/30 px-3 py-1 text-xs font-semibold mb-2">
                    <Clock className="w-3.5 h-3.5" /> Awaiting Admin Approval
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-dark">
                    Booking Pending WhatsApp Verification
                  </h2>
                </>
              )}
              {confirmedBooking.status === 'Confirmed' && (
                <>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-xs font-semibold mb-2">
                    <Check className="w-3.5 h-3.5" /> Approved by Admin
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-dark">
                    {confirmedBooking.bookingType === 'rental'
                      ? 'Your PS5 Rental is Confirmed!'
                      : 'Your Slot is Confirmed!'}
                  </h2>
                </>
              )}
              {confirmedBooking.status === 'Completed' && (
                <>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-lavender text-brand-glow border border-brand-border px-3 py-1 text-xs font-semibold mb-2">
                    <Check className="w-3.5 h-3.5" /> Session Completed
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-dark">
                    Thanks for Playing at {settings.shopName}!
                  </h2>
                </>
              )}
              {confirmedBooking.status === 'Cancelled' && (
                <>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30 px-3 py-1 text-xs font-semibold mb-2">
                    <XCircle className="w-3.5 h-3.5" /> Booking Cancelled
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-dark">
                    Booking Request Not Confirmed
                  </h2>
                </>
              )}
            </div>
            <span
              className={`rounded-full px-3.5 py-1 text-xs font-semibold border ${
                confirmedBooking.status === 'Confirmed'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : confirmedBooking.status === 'Completed'
                    ? 'bg-brand-lavender text-brand-glow border-brand-border'
                    : confirmedBooking.status === 'Cancelled'
                      ? 'bg-red-500/10 text-red-300 border-red-500/30'
                      : 'bg-amber-500/10 text-amber-200 border-amber-500/30'
              }`}
            >
              {confirmedBooking.status}
            </span>
          </div>

          {confirmedBooking.status === 'Pending' && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs sm:text-sm text-amber-100">
              Send your pre-filled order message on WhatsApp. Your booking is only{' '}
              <strong className="font-semibold">Confirmed</strong> once admin reviews the WhatsApp
              message and approves your order.
            </div>
          )}

          {confirmedBooking.status === 'Confirmed' && (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs sm:text-sm text-emerald-100">
              Admin verified and approved your order. Show Booking ID{' '}
              <strong className="font-semibold">{confirmedBooking.bookingCode}</strong> when you
              arrive at {settings.shopName}.
            </div>
          )}

          <div className="rounded-2xl bg-brand-lavender/80 border border-dashed border-brand-accent/60 p-4 flex items-center justify-between gap-3">
            <div>
              <span className="block text-[11px] uppercase tracking-wider font-semibold text-brand-muted">
                Booking ID
              </span>
              <strong className="font-display text-xl sm:text-2xl font-bold text-brand-glow tracking-wide tabular-nums">
                {confirmedBooking.bookingCode}
              </strong>
            </div>
            <span className="font-display text-xl font-bold text-brand-glow tabular-nums">
              {formatINR(confirmedBooking.totalAmount)}
            </span>
          </div>

          <div className="rounded-2xl bg-brand-soft border border-brand-border p-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-brand-muted">Service</span>
              <strong className="font-semibold text-brand-glow">
                {confirmedBooking.bookingType === 'rental'
                  ? 'PS5 Home Rental'
                  : `GameZone Slot · ${getSlotTierLabel(confirmedBooking.slotTier)}`}
              </strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-brand-muted">Customer</span>
              <strong className="font-semibold text-brand-dark">{confirmedBooking.customerName}</strong>
            </div>
            {confirmedBooking.bookingType === 'rental' ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Pickup Date</span>
                  <strong className="font-semibold text-brand-dark">
                    {formatDateDisplay(confirmedBooking.date)}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Last Rental Day</span>
                  <strong className="font-semibold text-brand-dark">
                    {formatDateDisplay(confirmedBooking.endDate || confirmedBooking.date)}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Rental Plan</span>
                  <strong className="font-semibold text-brand-dark">
                    {formatDuration(confirmedBooking.duration, 'rental')}
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Date</span>
                  <strong className="font-semibold text-brand-dark">
                    {formatDateDisplay(confirmedBooking.date)}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Time Slot</span>
                  <strong className="font-semibold text-brand-dark tabular-nums">
                    {formatHourLabel(confirmedBooking.startHour)} – {formatHourLabel(confirmedBooking.endHour)}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Duration</span>
                  <strong className="font-semibold text-brand-dark">
                    {formatDuration(confirmedBooking.duration, 'slot')}
                  </strong>
                </div>
              </>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-brand-muted">
                {confirmedBooking.bookingType === 'rental' ? 'PS5 Console' : 'PS5 Station'}
              </span>
              <strong className="font-semibold text-brand-glow">{confirmedBooking.stationName}</strong>
            </div>
            {confirmedBooking.bookingType === 'rental' && confirmedBreakdown && (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Payment Mode</span>
                  <strong className="font-semibold text-brand-glow">{confirmedBreakdown.label}</strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Pay Online Now</span>
                  <strong className="font-semibold text-brand-glow tabular-nums">
                    {formatINR(confirmedBreakdown.payOnlineNow)}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Balance Due on Delivery</span>
                  <strong className="font-semibold text-brand-dark tabular-nums">
                    {formatINR(confirmedBreakdown.payOnDelivery)}
                  </strong>
                </div>
              </>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-brand-muted">Payment Status</span>
              <strong className="font-semibold text-brand-dark">{confirmedBooking.paymentStatus}</strong>
            </div>
          </div>

          <div className="space-y-2.5">
            {whatsappPayload && (
              <a
                href={whatsappPayload.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm sm:text-base px-5 py-3.5 shadow-sm transition-colors tap-target"
              >
                <MessageCircle className="w-4 h-4" />
                <span>
                  {confirmedBooking.status === 'Pending'
                    ? 'Send Order Details on WhatsApp'
                    : `Message ${settings.shopName} on WhatsApp`}
                </span>
              </a>
            )}

            <button
              type="button"
              disabled={checkingStatus}
              onClick={() => void refreshReceiptStatus(confirmedBooking.bookingCode)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-lavender/60 hover:bg-brand-lavender disabled:opacity-60 text-brand-glow font-semibold text-sm px-4 py-3 tap-target"
            >
              <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
              <span>{checkingStatus ? 'Checking Approval Status...' : 'Refresh Approval Status'}</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void handleCopyWhatsApp()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-soft hover:bg-brand-lavender text-brand-glow font-semibold text-sm px-4 py-3 tap-target"
              >
                <Copy className="w-4 h-4" />
                <span>{copiedMsg ? 'Message Copied!' : 'Copy Message'}</span>
              </button>
                <button
                  type="button"
                  onClick={resetWizard}
                  className="rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-soft text-brand-dark font-semibold text-sm px-4 py-3 tap-target"
                >
                  Book Another Session
                </button>
            </div>
          </div>

          <div className="text-center">
            <Link href="/" className="text-xs font-semibold text-brand-accent hover:underline">
              &larr; Return to {settings.shopName} Home
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-brand-surface border border-brand-border p-4 sm:p-6 shadow-elevated">
          {/* STEP 1: Date, Duration & Start-End Slot */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Date */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-semibold text-brand-dark">
                      {bookingMode === 'rental' ? '1. Select Pickup Date' : '1. Select Date'}
                    </h2>
                    <p className="text-xs text-brand-muted">19 Nov 2026 Launch Day highlighted</p>
                  </div>
                  <span className="rounded-full bg-brand-lavender text-brand-glow px-3 py-1 text-xs font-semibold">
                    {bookingMode === 'rental' && duration > 1
                      ? `${formatDateDisplay(selectedDate)} → ${formatDateDisplay(rentalEndDate)}`
                      : formatDateDisplay(selectedDate)}
                  </span>
                </div>

                <div className="rounded-2xl bg-brand-soft border border-brand-border p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => shiftMonth(-1)}
                      className="w-10 h-10 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center text-brand-glow hover:bg-brand-lavender"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="font-display font-semibold text-sm sm:text-base text-brand-glow">
                      {MONTH_NAMES[calView.month]} {calView.year}
                    </div>
                    <button
                      type="button"
                      onClick={() => shiftMonth(1)}
                      className="w-10 h-10 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center text-brand-glow hover:bg-brand-lavender"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-brand-muted mb-1.5">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label="Booking calendar">
                    {calendarDays.map((cell, idx) =>
                      !cell ? (
                        <div key={`empty-${idx}`} />
                      ) : (
                        <button
                          key={cell.dateStr}
                          type="button"
                          disabled={!cell.bookable}
                          onClick={() => {
                            setSelectedDate(cell.dateStr);
                            setStepError('');
                          }}
                          className={[
                            'min-h-[42px] rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center border transition-all tabular-nums',
                            cell.isSelected
                              ? 'bg-brand-primary text-white border-brand-primary shadow-sm font-semibold'
                              : cell.bookable
                              ? 'bg-brand-surface text-brand-dark border-transparent hover:border-brand-accent/50 hover:bg-brand-lavender/50'
                              : 'bg-transparent text-brand-muted/35 border-transparent cursor-not-allowed'
                          ].join(' ')}
                        >
                          <span>{cell.day}</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {availability && !availability.dateBookable && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm p-3">
                    {availability.dateReason}
                  </div>
                )}
              </div>

              {/* Setup Tier + Duration */}
              {bookingMode === 'slot' ? (
                <>
                  <div className="pt-5 border-t border-brand-border/70 space-y-3">
                    <div>
                      <h2 className="font-display text-base sm:text-lg font-semibold text-brand-dark">
                        2. Choose Setup
                      </h2>
                      <p className="text-xs text-brand-muted">
                        Pick regular PS5 lounge games or the Logitech G29 Racing Simulator
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Gaming setup tier">
                      {(
                        [
                          {
                            id: 'regular' as SlotTier,
                            title: 'Regular PS5 Games',
                            sub: 'Fighting, Action, Sports & Co-op',
                            rate: getSlotPriceForTier(1, 'regular', settings)
                          },
                          {
                            id: 'g29' as SlotTier,
                            title: 'G29 Racing Simulator',
                            sub: 'Logitech wheel + pedals racing rig',
                            rate: getSlotPriceForTier(1, 'g29', settings)
                          }
                        ] as const
                      ).map((opt) => {
                        const selected = slotTier === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setSlotTier(opt.id);
                              setStepError('');
                            }}
                            className={[
                              'rounded-xl border p-3.5 text-left transition-all tap-target',
                              selected
                                ? 'bg-brand-primary border-brand-primary text-white shadow-card'
                                : 'bg-brand-soft/60 border-brand-border hover:border-brand-accent hover:bg-brand-lavender/50'
                            ].join(' ')}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <strong className="font-display text-sm font-semibold">
                                {opt.title}
                              </strong>
                              <span
                                className={`font-display text-xs font-bold tabular-nums ${
                                  selected ? 'text-purple-200' : 'text-brand-accent'
                                }`}
                              >
                                {formatINR(opt.rate)}/hr
                              </span>
                            </div>
                            <span
                              className={`block text-[11px] mt-1 ${
                                selected ? 'text-purple-100/90' : 'text-brand-muted'
                              }`}
                            >
                              {opt.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-5 border-t border-brand-border/70 space-y-3">
                    <div>
                      <h2 className="font-display text-base sm:text-lg font-semibold text-brand-dark">
                        3. Select Hours
                      </h2>
                      <p className="text-xs text-brand-muted">
                        {getSlotTierLabel(slotTier)} • updates available slot timings below
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" role="radiogroup" aria-label="Session duration">
                      {[1, 2, 3, 4].map((hrs) => {
                        const selected = duration === hrs;
                        const price = getSlotPriceForTier(hrs, slotTier, settings);
                        return (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => {
                              setDuration(hrs);
                              setStepError('');
                            }}
                            className={[
                              'rounded-xl border p-3 text-left transition-all tap-target',
                              selected
                                ? 'bg-brand-primary border-brand-primary text-white shadow-card'
                                : 'bg-brand-soft/60 border-brand-border hover:border-brand-accent hover:bg-brand-lavender/50'
                            ].join(' ')}
                          >
                            <span className="block font-display font-semibold text-sm">
                              {formatDuration(hrs, 'slot')}
                            </span>
                            <span
                              className={`block text-xs font-semibold mt-0.5 tabular-nums ${
                                selected ? 'text-purple-200' : 'text-brand-accent'
                              }`}
                            >
                              {formatINR(price)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="pt-5 border-t border-brand-border/70 space-y-3">
                  <div>
                    <h2 className="font-display text-base sm:text-lg font-semibold text-brand-dark">
                      2. Select Rental Package (1–7 Days)
                    </h2>
                    <p className="text-xs text-brand-muted">
                      Take a PlayStation 5 console home • pickup at {settings.shopName}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" role="radiogroup" aria-label="Rental duration">
                    {[1, 2, 3, 4, 5, 6, 7].map((days) => {
                      const selected = duration === days;
                      const price = getRentalPackagePrice(days, settings);
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={() => {
                            setDuration(days);
                            setStepError('');
                          }}
                          className={[
                            'rounded-xl border p-3 text-left transition-all tap-target',
                            selected
                              ? 'bg-brand-primary border-brand-primary text-white shadow-card'
                              : 'bg-brand-soft/60 border-brand-border hover:border-brand-accent hover:bg-brand-lavender/50'
                          ].join(' ')}
                        >
                          <span className="block font-display font-semibold text-sm">
                            {formatDuration(days, 'rental')}
                          </span>
                          <span
                            className={`block text-xs font-semibold mt-0.5 tabular-nums ${
                              selected ? 'text-purple-200' : 'text-brand-accent'
                            }`}
                          >
                            {formatINR(price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Start & End Time Slot (Slot) OR Console Availability (Rental) */}
              {bookingMode === 'slot' ? (
                <div className="pt-5 border-t border-brand-border/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base sm:text-lg font-semibold text-brand-dark">
                        4. Select Time Slot
                      </h2>
                      <p className="text-xs text-brand-muted">
                        Showing start &amp; end time for {formatDuration(duration, 'slot')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void fetchAvailability(selectedDate, duration, bookingMode)}
                      disabled={loadingAvail}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-soft hover:bg-brand-lavender px-3 py-2 text-xs font-semibold text-brand-glow"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingAvail ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Time slots">
                    {(availability?.slots || []).map((slot) => {
                      const selected = startHour === slot.startHour;
                      const rangeLabel = formatSlotRange(slot.startHour, duration);
                      return (
                        <button
                          key={slot.startHour}
                          type="button"
                          disabled={!slot.bookable || loadingAvail}
                          onClick={() => {
                            setStartHour(slot.startHour);
                            setStepError('');
                          }}
                          className={[
                            'rounded-xl border px-3 py-3 text-left transition-all min-h-[58px]',
                            selected
                              ? 'bg-brand-primary border-brand-primary text-white shadow-sm'
                              : slot.bookable
                              ? 'bg-brand-surface border-brand-border hover:border-brand-accent hover:bg-brand-soft text-brand-dark'
                              : 'bg-brand-soft border-brand-border text-brand-muted cursor-not-allowed'
                          ].join(' ')}
                        >
                          <span className="block font-display font-semibold text-xs sm:text-sm tabular-nums">
                            {rangeLabel}
                          </span>
                          <span
                            className={`block text-[11px] font-medium mt-0.5 ${
                              selected
                                ? 'text-purple-200'
                                : slot.bookable
                                ? 'text-emerald-300'
                                : 'text-red-300/80'
                            }`}
                          >
                            {slot.bookable ? 'Available' : slot.reason}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="pt-5 border-t border-brand-border/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base sm:text-lg font-semibold text-brand-dark">
                        3. PS5 Console Availability
                      </h2>
                      <p className="text-xs text-brand-muted">
                        {formatDateDisplay(selectedDate)} → {formatDateDisplay(rentalEndDate)} (
                        {formatDuration(duration, 'rental')})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void fetchAvailability(selectedDate, duration, bookingMode)}
                      disabled={loadingAvail}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-soft hover:bg-brand-lavender px-3 py-2 text-xs font-semibold text-brand-glow"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingAvail ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div
                    className={`rounded-2xl border p-4 text-xs sm:text-sm ${
                      (availability?.rentalAvailableCount || 0) > 0
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100'
                        : 'bg-red-500/10 border-red-500/30 text-red-200'
                    }`}
                  >
                    {loadingAvail ? (
                      <span>Checking live PS5 inventory...</span>
                    ) : (availability?.rentalAvailableCount || 0) > 0 ? (
                      <span>
                        <strong className="font-semibold">
                          PS5 Console Available
                        </strong>{' '}
                        for your {formatDuration(duration, 'rental')} rental.
                      </span>
                    ) : (
                      <span>
                        PS5 consoles are currently reserved during these dates. Try another pickup date or shorter duration.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {stepError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm p-3">
                  {stepError}
                </div>
              )}

              <div className="pt-4 border-t border-brand-border flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs text-brand-muted">
                    {bookingMode === 'rental' ? 'Rental Total' : 'Session Total'}
                  </span>
                  <strong className="font-display text-2xl font-bold text-brand-glow tabular-nums">
                    {formatINR(totalAmount)}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={goToStep2}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-hover text-white font-semibold text-sm sm:text-base px-6 py-3.5 shadow-card transition-all tap-target"
                >
                  <span>Next: Your Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Personal Details (Name & Mobile only) */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-brand-lavender/75 border border-brand-border p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                <div className="font-medium text-brand-dark">
                  {bookingMode === 'rental' ? (
                    <>
                      PS5 Rent: <strong className="font-semibold text-brand-glow">{formatDateDisplay(selectedDate)}</strong>
                      {duration > 1 ? ` → ${formatDateDisplay(rentalEndDate)}` : ''} ({formatDuration(duration, 'rental')})
                    </>
                  ) : (
                    <>
                      {formatDateDisplay(selectedDate)} •{' '}
                      <strong className="font-semibold text-brand-glow tabular-nums">
                        {startHour !== null ? formatSlotRange(startHour, duration) : ''}
                      </strong>{' '}
                      ({formatDuration(duration, 'slot')})
                    </>
                  )}
                </div>
                <strong className="font-display font-bold text-brand-glow tabular-nums">
                  {formatINR(totalAmount)}
                </strong>
              </div>

              <div>
                <h2 className="font-display text-lg font-semibold text-brand-dark">
                  Enter Your Details
                </h2>
                <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                  We use these details to issue your Booking ID and WhatsApp confirmation.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="custName" className="block text-xs sm:text-sm font-semibold text-brand-dark mb-1.5">
                    Full Name *
                  </label>
                  <input
                    id="custName"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    className="w-full rounded-xl border border-brand-border px-4 py-3 text-sm sm:text-base focus:outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/15"
                  />
                </div>

                <div>
                  <label htmlFor="custMobile" className="block text-xs sm:text-sm font-semibold text-brand-dark mb-1.5">
                    Mobile Number (India) *
                  </label>
                  <div className="flex items-stretch rounded-xl border border-brand-border overflow-hidden focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-accent/15">
                    <span className="px-3.5 bg-brand-soft border-r border-brand-border text-sm font-semibold text-brand-muted flex items-center">
                      +91
                    </span>
                    <input
                      id="custMobile"
                      type="tel"
                      inputMode="numeric"
                      maxLength={14}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="10-digit mobile number"
                      autoComplete="tel"
                      className="w-full px-3.5 py-3 text-sm sm:text-base focus:outline-none tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {stepError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm p-3">
                  {stepError}
                </div>
              )}

              <div className="pt-4 border-t border-brand-border flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStepError('');
                    setStep(1);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-soft text-brand-dark font-semibold text-sm px-5 py-3.5 tap-target"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={goToStep3}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-hover text-white font-semibold text-sm sm:text-base px-6 py-3.5 shadow-card transition-all tap-target"
                >
                  <span>Review &amp; Submit</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Submit */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-lg font-semibold text-brand-dark">
                  Review &amp; Confirm Booking
                </h2>
                <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
                  Verify your slot timing and contact details before confirming.
                </p>
              </div>

              <div className="rounded-2xl bg-brand-soft border border-brand-border p-4 sm:p-5 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Booking Type</span>
                  <strong className="font-semibold text-brand-glow">
                    {bookingMode === 'rental' ? 'PS5 Home Rental' : 'Gamezone Slot (Play at Shop)'}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Name</span>
                  <strong className="font-semibold text-brand-dark text-right">{customerName.trim()}</strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">Mobile</span>
                  <strong className="font-semibold text-brand-dark tabular-nums">
                    +91 {normalizeIndianMobile(mobile)}
                  </strong>
                </div>
                <div className="my-2 border-t border-dashed border-brand-border" />
                {bookingMode === 'rental' ? (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-brand-muted">Pickup Date</span>
                      <strong className="font-semibold text-brand-dark">{formatDateDisplay(selectedDate)}</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-brand-muted">Last Rental Day</span>
                      <strong className="font-semibold text-brand-dark">{formatDateDisplay(rentalEndDate)}</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-brand-muted">Rental Plan</span>
                      <strong className="font-semibold text-brand-dark">{formatDuration(duration, 'rental')}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-brand-muted">Date</span>
                      <strong className="font-semibold text-brand-dark">{formatDateDisplay(selectedDate)}</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-brand-muted">Time Slot</span>
                      <strong className="font-semibold text-brand-dark tabular-nums">
                        {startHour !== null
                          ? `${formatHourLabel(startHour)} – ${formatHourLabel(startHour + duration)}`
                          : '-'}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-brand-muted">Duration</span>
                      <strong className="font-semibold text-brand-dark">{formatDuration(duration, 'slot')}</strong>
                    </div>
                  </>
                )}
                <div className="flex justify-between gap-3">
                  <span className="text-brand-muted">
                    {bookingMode === 'rental' ? 'Console' : 'Setup'}
                  </span>
                  <strong className="font-semibold text-brand-glow">{selectedSetupLabel}</strong>
                </div>
                <div className="pt-2 border-t border-brand-border flex items-baseline justify-between">
                  <span className="font-semibold text-brand-dark">Total Payable</span>
                  <strong className="font-display text-2xl font-bold text-brand-glow tabular-nums">
                    {formatINR(totalAmount)}
                  </strong>
                </div>
                {bookingMode === 'rental' && (
                  <div className="pt-2 border-t border-dashed border-brand-border space-y-1.5 text-xs sm:text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-brand-muted">
                        {rentalBreakdown.isCod ? 'Pay Online Now (Confirmation Fee)' : 'Pay Online Now'}
                      </span>
                      <strong className="font-semibold text-brand-glow tabular-nums">
                        {formatINR(rentalBreakdown.payOnlineNow)}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-brand-muted">Balance on Delivery</span>
                      <strong className="font-semibold text-brand-dark tabular-nums">
                        {formatINR(rentalBreakdown.payOnDelivery)}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {bookingMode === 'rental' && (
                <div className="space-y-3">
                  <span className="block text-xs sm:text-sm font-semibold text-brand-dark">
                    Select Rental Payment Option
                  </span>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'COD'
                        ? 'border-brand-accent bg-brand-lavender/50'
                        : 'border-brand-border bg-brand-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rentalPaymentMethod"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="mt-1 accent-brand-primary"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm font-semibold text-brand-dark">
                          COD (Cash on Delivery)
                        </strong>
                        <span className="rounded-full bg-brand-primary/20 border border-brand-accent/40 text-brand-glow px-2.5 py-0.5 text-[11px] font-semibold">
                          Pay {formatINR(codBreakdown.payOnlineNow)} Online
                        </span>
                      </div>
                      <span className="block text-xs text-brand-muted mt-1">
                        Pay {formatINR(codBreakdown.payOnlineNow)} confirmation fee online now • Pay remaining{' '}
                        {formatINR(codBreakdown.payOnDelivery)} on delivery.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === 'Full Online'
                        ? 'border-brand-accent bg-brand-lavender/50'
                        : 'border-brand-border bg-brand-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rentalPaymentMethod"
                      checked={paymentMethod === 'Full Online'}
                      onChange={() => setPaymentMethod('Full Online')}
                      className="mt-1 accent-brand-primary"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm font-semibold text-brand-dark">
                          Full Online Payment
                        </strong>
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 px-2.5 py-0.5 text-[11px] font-semibold">
                          ₹0 on Delivery
                        </span>
                      </div>
                      <span className="block text-xs text-brand-muted mt-1">
                        Pay full {formatINR(totalAmount)} online now • No balance due on delivery.
                      </span>
                    </div>
                  </label>

                  <div className="rounded-xl bg-brand-lavender border border-brand-border p-3.5 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-brand-glow text-sm">
                        Online Pay Now: {formatINR(rentalBreakdown.payOnlineNow)}
                      </strong>
                      <span className="text-brand-muted">
                        Delivery Balance: {formatINR(rentalBreakdown.payOnDelivery)}
                      </span>
                    </div>

                    {settings.upiId.trim() ? (
                      <div className="space-y-2">
                        <div>
                          <strong>UPI ID:</strong>{' '}
                          <span className="font-mono text-brand-glow">{settings.upiId}</span>
                        </div>
                        {settings.upiAccountName && (
                          <div>
                            <strong>Account:</strong> {settings.upiAccountName}
                          </div>
                        )}
                        <p className="text-brand-muted">{settings.upiInstructions}</p>
                        <a
                          href={buildUpiIntentUrl({
                            upiId: settings.upiId,
                            payeeName: settings.upiAccountName || settings.shopName,
                            amount: rentalBreakdown.payOnlineNow,
                            note: `${settings.shopName} PS5 Rental`
                          })}
                          className="inline-flex items-center justify-center rounded-lg bg-brand-primary hover:bg-brand-hover text-white font-semibold text-xs px-3.5 py-2"
                        >
                          Pay {formatINR(rentalBreakdown.payOnlineNow)} via UPI App
                        </a>
                      </div>
                    ) : (
                      <p className="text-brand-muted">
                        Admin shares official UPI / QR on WhatsApp to collect{' '}
                        <strong className="text-brand-dark">
                          {formatINR(rentalBreakdown.payOnlineNow)}
                        </strong>
                        . Booking stays Pending until payment is verified.
                      </p>
                    )}

                    <input
                      type="text"
                      value={upiRef}
                      onChange={(e) => setUpiRef(e.target.value)}
                      placeholder="UPI UTR / Transaction Ref (optional if paying on WhatsApp)"
                      className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 text-sm mt-1 focus:outline-none focus:border-brand-accent"
                    />
                  </div>
                </div>
              )}

              {stepError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm p-3">
                  {stepError}
                </div>
              )}

              <div className="pt-4 border-t border-brand-border flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setStepError('');
                    setStep(2);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-soft text-brand-dark font-semibold text-sm px-5 py-3.5 tap-target"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleConfirmBooking()}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl bg-brand-primary hover:bg-brand-hover disabled:opacity-60 text-white font-semibold text-sm sm:text-base px-8 py-3.5 shadow-card transition-all tap-target"
                >
                  {submitting ? 'Opening WhatsApp...' : 'REQUEST BOOKING & OPEN WHATSAPP'}
                </button>
              </div>
              <p className="text-[11px] text-brand-muted text-center">
                Saves as Pending and opens WhatsApp. Booking confirms once admin verifies your WhatsApp message and approves it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
