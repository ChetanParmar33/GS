'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import {
  CheckCircle2,
  Eye,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  XCircle
} from 'lucide-react';
import {
  formatDateDisplay,
  formatDuration,
  formatHourLabel,
  formatINR,
  getKolkataNowParts,
  getRentalPaymentBreakdown
} from '@/lib/booking-rules';
import type {
  AdminSettings,
  BookingRecord,
  BookingStatus,
  DashboardStats,
  Station,
  StationBlock
} from '@/types/booking';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { BookingDetailsModal, BookingFormModal } from '@/components/admin/BookingModals';
import { StationsPanel } from '@/components/admin/StationsPanel';
import { SettingsPanel } from '@/components/admin/SettingsPanel';

interface AdminDashboardProps {
  initialAuthenticated: boolean;
  initialEmail?: string;
  authMode: 'supabase' | 'local';
}

interface OverviewResponse {
  stats: DashboardStats;
  settings: AdminSettings;
  stations: Station[];
  bookings: BookingRecord[];
  blocks: StationBlock[];
  scheduleDate: string;
  dbMode: 'sqlite' | 'supabase';
}

const STATUS_BADGE: Record<BookingStatus, string> = {
  Pending: 'bg-amber-500/10 text-amber-200 border-amber-500/30',
  Confirmed: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30',
  Completed: 'bg-brand-lavender text-brand-glow border-brand-border',
  Cancelled: 'bg-red-500/10 text-red-300 border-red-500/30'
};

export function AdminDashboard({
  initialAuthenticated,
  authMode
}: AdminDashboardProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [tab, setTab] = useState<'bookings' | 'stations' | 'settings'>('bookings');
  const [scheduleDate, setScheduleDate] = useState(() => getKolkataNowParts().dateStr);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Booking Filters
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState<'All' | 'slot' | 'rental'>('All');

  // Modals
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingBooking, setEditingBooking] = useState<BookingRecord | undefined>(undefined);
  const [viewingBooking, setViewingBooking] = useState<BookingRecord | null>(null);

  const loadOverview = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    setActionError('');
    try {
      const res = await fetch(`/api/admin/overview?date=${encodeURIComponent(scheduleDate)}`, {
        cache: 'no-store'
      });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!res.ok) throw new Error('Failed loading dashboard data.');
      const json = (await res.json()) as OverviewResponse;
      setData(json);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [authenticated, scheduleDate]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function patchBooking(id: string, patch: Record<string, unknown>) {
    setActionError('');
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed updating booking.');
      await loadOverview();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
    setData(null);
  }

  const filteredBookings = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.bookings.filter((b) => {
      if (filterType !== 'All' && (b.bookingType || 'slot') !== filterType) return false;
      if (filterDate) {
        if ((b.bookingType || 'slot') === 'rental') {
          if (filterDate < b.date || filterDate > (b.endDate || b.date)) return false;
        } else if (b.date !== filterDate) {
          return false;
        }
      }
      if (filterStatus !== 'All' && b.status !== filterStatus) return false;
      if (
        q &&
        !b.customerName.toLowerCase().includes(q) &&
        !b.mobile.includes(q) &&
        !b.bookingCode.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data, search, filterDate, filterStatus, filterType]);

  if (!authenticated) {
    return <AdminLogin authMode={authMode} onSuccess={() => setAuthenticated(true)} />;
  }

  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-brand-base pb-12">
      <header className="sticky top-0 z-40 bg-brand-base/85 backdrop-blur-xl border-b border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo className="shrink-0" />
            <span className="hidden sm:inline-block rounded-full bg-brand-lavender text-brand-glow px-2.5 py-0.5 text-[11px] font-bold">
              Admin • {data?.dbMode === 'supabase' ? 'Supabase DB' : 'Local SQLite DB'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-glow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/"
              className="rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-dark"
            >
              Storefront
            </Link>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary text-white px-3 py-2 text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* KPI Cards */}
        {stats && (
          <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total Bookings', val: String(stats.totalBookings) },
              { label: "Today's Bookings", val: String(stats.todayBookings) },
              { label: 'Confirmed', val: String(stats.confirmedBookings) },
              { label: 'Pending', val: String(stats.pendingBookings) },
              { label: 'Cancelled', val: String(stats.cancelledBookings) },
              { label: "Today's Revenue", val: formatINR(stats.todayRevenue) },
              { label: 'Total Revenue', val: formatINR(stats.totalRevenue) }
            ].map((k) => (
              <div
                key={k.label}
                className="rounded-2xl bg-brand-surface border border-brand-border p-3.5 sm:p-4 shadow-card"
              >
                <span className="block text-[11px] font-medium text-brand-muted">{k.label}</span>
                <strong className="block font-display text-xl sm:text-2xl font-bold text-brand-glow mt-1 tabular-nums">
                  {k.val}
                </strong>
              </div>
            ))}
          </section>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'bookings', label: 'Bookings' },
              { id: 'stations', label: 'PS5 Stations' },
              { id: 'settings', label: 'Website Settings' }
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold border transition-all tap-target ${
                tab === t.id
                  ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                  : 'bg-brand-surface text-brand-muted border-brand-border hover:text-brand-glow'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {actionError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-3.5">
            {actionError}
          </div>
        )}

        {/* Bookings Tab */}
        {tab === 'bookings' && data && (
          <section className="rounded-2xl bg-brand-surface border border-brand-border p-4 sm:p-6 shadow-card space-y-4">
            {stats && stats.pendingBookings > 0 && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-amber-100">
                  <strong className="font-semibold">
                    Pending WhatsApp Approval ({stats.pendingBookings})
                  </strong>{' '}
                  — Verify WhatsApp order details, then click{' '}
                  <span className="font-semibold">Approve</span> to confirm slot.
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFilterStatus(filterStatus === 'Pending' ? 'All' : 'Pending')
                  }
                  className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-semibold tap-target"
                >
                  {filterStatus === 'Pending' ? 'Show All Bookings' : 'Filter Pending Only'}
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 flex-1">
                <div className="relative">
                  <Search className="w-4 h-4 text-brand-muted absolute left-3 top-3" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, mobile, ID..."
                    className="w-full rounded-xl border border-brand-border pl-9 pr-3 py-2 text-sm"
                  />
                </div>

                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="rounded-xl border border-brand-border px-3 py-2 text-sm bg-brand-surface"
                />

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-xl border border-brand-border px-3 py-2 text-sm bg-brand-surface"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'All' | 'slot' | 'rental')}
                  className="rounded-xl border border-brand-border px-3 py-2 text-sm bg-brand-surface"
                >
                  <option value="All">All Services</option>
                  <option value="slot">GameZone Slots</option>
                  <option value="rental">PS5 Rentals</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingBooking(undefined);
                  setModalMode('create');
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary text-white font-bold text-sm px-4 py-2.5 shrink-0 tap-target"
              >
                <Plus className="w-4 h-4" />
                <span>Manual Booking</span>
              </button>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="rounded-xl bg-brand-soft border border-dashed border-brand-border p-8 text-center text-sm text-brand-muted">
                No bookings match the current filter. Real customer bookings will appear here automatically.
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredBookings.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-xl border border-brand-border p-4 bg-brand-soft/50 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <strong className="font-display text-sm text-brand-glow">
                            {b.bookingCode}
                          </strong>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              b.bookingType === 'rental'
                                ? 'bg-brand-lavender text-brand-glow'
                                : b.slotTier === 'g29'
                                ? 'bg-brand-accent/20 text-brand-gold'
                                : 'bg-brand-surface border border-brand-border text-brand-muted'
                            }`}
                          >
                            {b.bookingType === 'rental'
                              ? 'PS5 Rent'
                              : b.slotTier === 'g29'
                              ? 'G29 Sim'
                              : 'Regular PS5'}
                          </span>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                            STATUS_BADGE[b.status]
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-brand-dark">
                        {b.customerName} • <span className="font-normal text-brand-muted">{b.mobile}</span>
                      </div>
                      <div className="text-xs text-brand-muted">
                        {b.bookingType === 'rental'
                          ? `${formatDateDisplay(b.date)} → ${formatDateDisplay(b.endDate || b.date)} (${formatDuration(b.duration, 'rental')})`
                          : `${formatDateDisplay(b.date)} • ${formatHourLabel(b.startHour)} (${formatDuration(b.duration, 'slot')})`}{' '}
                        • <strong className="text-brand-dark">{b.stationName}</strong>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <div>
                          <div>{b.paymentStatus}</div>
                          {b.bookingType === 'rental' && b.paymentMethod === 'COD' && (
                            <div className="text-[11px] text-brand-glow">
                              {(() => {
                                const pay = getRentalPaymentBreakdown(
                                  b.totalAmount,
                                  b.paymentMethod,
                                  data?.settings.rentalCodFee
                                );
                                return `Online ${formatINR(pay.payOnlineNow)} • COD ${formatINR(pay.payOnDelivery)}`;
                              })()}
                            </div>
                          )}
                        </div>
                        <strong className="text-sm text-brand-glow">{formatINR(b.totalAmount)}</strong>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setViewingBooking(b)}
                          className="rounded-lg border border-brand-border bg-brand-surface px-2.5 py-1.5 text-xs font-semibold"
                        >
                          View
                        </button>
                        {b.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={() => void patchBooking(b.id, { status: 'Confirmed' })}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold"
                          >
                            Approve &amp; Confirm
                          </button>
                        )}
                        {b.status === 'Confirmed' && (
                          <button
                            type="button"
                            onClick={() =>
                              void patchBooking(b.id, {
                                status: 'Completed',
                                paymentStatus:
                                  b.paymentMethod === 'Full Online' || b.paymentMethod === 'UPI Advance'
                                    ? 'Paid (UPI Verified)'
                                    : b.paymentMethod === 'COD'
                                      ? 'Paid (COD Settled)'
                                      : 'Paid at Shop'
                              })
                            }
                            className="rounded-lg bg-brand-accent text-white px-2.5 py-1.5 text-xs font-semibold"
                          >
                            Complete
                          </button>
                        )}
                        {b.status !== 'Cancelled' && b.status !== 'Completed' && (
                          <button
                            type="button"
                            onClick={() =>
                              void patchBooking(b.id, {
                                status: 'Cancelled',
                                paymentStatus: 'Refunded / Cancelled'
                              })
                            }
                            className="rounded-lg border border-red-500/30 bg-brand-surface text-red-300 px-2.5 py-1.5 text-xs font-semibold"
                          >
                            {b.status === 'Pending' ? 'Reject' : 'Cancel'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBooking(b);
                            setModalMode('edit');
                          }}
                          className="rounded-lg border border-brand-border bg-brand-surface px-2.5 py-1.5 text-xs font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-brand-soft text-brand-glow border-b border-brand-border">
                        <th className="p-3 font-bold">Booking ID</th>
                        <th className="p-3 font-bold">Customer</th>
                        <th className="p-3 font-bold">Date &amp; Time</th>
                        <th className="p-3 font-bold">Station</th>
                        <th className="p-3 font-bold">Amount</th>
                        <th className="p-3 font-bold">Payment</th>
                        <th className="p-3 font-bold">Status</th>
                        <th className="p-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.map((b) => (
                        <tr key={b.id} className="border-b border-brand-border/70 hover:bg-brand-soft/40">
                          <td className="p-3 font-mono text-xs font-bold text-brand-glow">
                            <div>{b.bookingCode}</div>
                            <span
                              className={`inline-block mt-1 rounded-md px-1.5 py-0.5 font-sans text-[10px] font-bold ${
                                b.bookingType === 'rental'
                                  ? 'bg-brand-lavender text-brand-glow'
                                  : b.slotTier === 'g29'
                                  ? 'bg-brand-accent/20 text-brand-gold'
                                  : 'bg-brand-soft text-brand-muted'
                              }`}
                            >
                              {b.bookingType === 'rental'
                                ? 'PS5 Rent'
                                : b.slotTier === 'g29'
                                ? 'G29 Sim'
                                : 'Regular PS5'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-brand-dark">{b.customerName}</div>
                            <div className="text-xs text-brand-muted">{b.mobile}</div>
                          </td>
                          <td className="p-3 text-xs">
                            {b.bookingType === 'rental' ? (
                              <>
                                <div className="font-semibold">
                                  {formatDateDisplay(b.date)} → {formatDateDisplay(b.endDate || b.date)}
                                </div>
                                <div className="text-brand-muted">
                                  {formatDuration(b.duration, 'rental')} Rental
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="font-semibold">{formatDateDisplay(b.date)}</div>
                                <div className="text-brand-muted">
                                  {formatHourLabel(b.startHour)} – {formatHourLabel(b.endHour)} (
                                  {formatDuration(b.duration, 'slot')})
                                </div>
                              </>
                            )}
                          </td>
                          <td className="p-3 font-semibold text-xs">{b.stationName}</td>
                          <td className="p-3 font-bold text-brand-glow">{formatINR(b.totalAmount)}</td>
                          <td className="p-3 text-xs">
                            <div className="font-medium">{b.paymentMethod}</div>
                            <div className="text-brand-muted">{b.paymentStatus}</div>
                            {b.bookingType === 'rental' && b.paymentMethod === 'COD' && (
                              <div className="text-[11px] text-brand-glow mt-0.5">
                                {(() => {
                                  const pay = getRentalPaymentBreakdown(
                                    b.totalAmount,
                                    b.paymentMethod,
                                    data?.settings.rentalCodFee
                                  );
                                  return `Online ${formatINR(pay.payOnlineNow)} • COD ${formatINR(pay.payOnDelivery)}`;
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                                STATUS_BADGE[b.status]
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                title="View Details"
                                onClick={() => setViewingBooking(b)}
                                className="p-1.5 rounded-lg border border-brand-border hover:bg-brand-soft"
                              >
                                <Eye className="w-4 h-4 text-brand-muted" />
                              </button>
                              {b.status === 'Pending' && (
                                <button
                                  type="button"
                                  title="Approve & Confirm Booking"
                                  onClick={() => void patchBooking(b.id, { status: 'Confirmed' })}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                              )}
                              {b.status === 'Confirmed' && (
                                <button
                                  type="button"
                                  title="Mark Completed"
                                  onClick={() =>
                                    void patchBooking(b.id, {
                                      status: 'Completed',
                                      paymentStatus:
                                        b.paymentMethod === 'Full Online' || b.paymentMethod === 'UPI Advance'
                                          ? 'Paid (UPI Verified)'
                                          : b.paymentMethod === 'COD'
                                            ? 'Paid (COD Settled)'
                                            : 'Paid at Shop'
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-brand-lavender text-brand-glow text-xs font-bold"
                                >
                                  Done
                                </button>
                              )}
                              {b.status !== 'Cancelled' && b.status !== 'Completed' && (
                                <button
                                  type="button"
                                  title={b.status === 'Pending' ? 'Reject Booking' : 'Cancel Booking'}
                                  onClick={() =>
                                    void patchBooking(b.id, {
                                      status: 'Cancelled',
                                      paymentStatus: 'Refunded / Cancelled'
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-semibold"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  {b.status === 'Pending' && <span>Reject</span>}
                                </button>
                              )}
                              <button
                                type="button"
                                title="Edit Booking"
                                onClick={() => {
                                  setEditingBooking(b);
                                  setModalMode('edit');
                                }}
                                className="p-1.5 rounded-lg border border-brand-border hover:bg-brand-soft"
                              >
                                <Pencil className="w-4 h-4 text-brand-glow" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {tab === 'stations' && data && (
          <StationsPanel
            scheduleDate={scheduleDate}
            onChangeDate={setScheduleDate}
            stations={data.stations}
            bookings={data.bookings}
            blocks={data.blocks}
            settings={data.settings}
            onRefresh={() => void loadOverview()}
          />
        )}

        {tab === 'settings' && data && (
          <SettingsPanel
            settings={data.settings}
            onSaved={() => void loadOverview()}
          />
        )}
      </main>

      {modalMode && data && (
        <BookingFormModal
          mode={modalMode}
          booking={editingBooking}
          stations={data.stations}
          settings={data.settings}
          onClose={() => setModalMode(null)}
          onSaved={() => {
            setModalMode(null);
            void loadOverview();
          }}
        />
      )}

      {viewingBooking && (
        <BookingDetailsModal
          booking={viewingBooking}
          rentalCodFee={data?.settings.rentalCodFee}
          onClose={() => setViewingBooking(null)}
        />
      )}
    </div>
  );
}

