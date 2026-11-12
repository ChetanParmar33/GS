'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  evaluateStationSlot,
  formatHourLabel,
  formatHourShort
} from '@/lib/booking-rules';
import type {
  AdminSettings,
  BookingRecord,
  Station,
  StationBlock,
  StationStatus
} from '@/types/booking';

interface StationsPanelProps {
  scheduleDate: string;
  onChangeDate: (date: string) => void;
  stations: Station[];
  bookings: BookingRecord[];
  blocks: StationBlock[];
  settings: AdminSettings;
  onRefresh: () => void;
}

export function StationsPanel({
  scheduleDate,
  onChangeDate,
  stations,
  bookings,
  blocks,
  settings,
  onRefresh
}: StationsPanelProps) {
  const [blockStationId, setBlockStationId] = useState(stations[0]?.id || 1);
  const [blockStart, setBlockStart] = useState(settings.openingHour);
  const [blockEnd, setBlockEnd] = useState(Math.min(settings.closingHour, settings.openingHour + 1));
  const [blockReason, setBlockReason] = useState('Maintenance / Walk-in Hold');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const hours: number[] = [];
  for (let h = settings.openingHour; h < settings.closingHour; h++) hours.push(h);

  async function changeStationStatus(stationId: number, status: StationStatus) {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/stations/${stationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed updating station status.');
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error updating station.');
    } finally {
      setBusy(false);
    }
  }

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: blockStationId,
          date: scheduleDate,
          startHour: blockStart,
          endHour: blockEnd,
          reason: blockReason
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not block slot.');
      setMsg('Manual slot block added.');
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error blocking slot.');
    } finally {
      setBusy(false);
    }
  }

  async function removeBlock(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/blocks/${id}`, { method: 'DELETE' });
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Date selector + Manual block creator */}
      <div className="rounded-2xl bg-brand-surface border border-brand-border p-4 sm:p-6 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-brand-glow">
              PS5 Stations &amp; Daily Schedule
            </h2>
            <p className="text-xs text-brand-muted">
              Toggle maintenance/disabled state or block individual hours.
            </p>
          </div>
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => onChangeDate(e.target.value)}
            className="rounded-xl border border-brand-border px-3 py-2 text-sm bg-brand-surface"
          />
        </div>

        <form onSubmit={(e) => void addBlock(e)} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-2 border-t border-brand-border">
          <select
            value={blockStationId}
            onChange={(e) => setBlockStationId(Number(e.target.value))}
            className="rounded-xl border border-brand-border px-3 py-2.5 text-sm bg-brand-surface"
          >
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={blockStart}
            onChange={(e) => setBlockStart(Number(e.target.value))}
            className="rounded-xl border border-brand-border px-3 py-2.5 text-sm bg-brand-surface"
          >
            {hours.map((h) => (
              <option key={h} value={h}>From {formatHourLabel(h)}</option>
            ))}
          </select>

          <select
            value={blockEnd}
            onChange={(e) => setBlockEnd(Number(e.target.value))}
            className="rounded-xl border border-brand-border px-3 py-2.5 text-sm bg-brand-surface"
          >
            {hours.map((h) => (
              <option key={h + 1} value={h + 1}>To {formatHourLabel(h + 1)}</option>
            ))}
          </select>

          <input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Reason (Maintenance / Reserved)"
            className="rounded-xl border border-brand-border px-3 py-2.5 text-sm"
          />

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-brand-primary text-white font-bold text-sm px-4 py-2.5 disabled:opacity-60"
          >
            Reserve / Block
          </button>
        </form>

        {msg && <p className="text-xs font-semibold text-brand-accent">{msg}</p>}
      </div>

      {/* Station Cards & Hourly Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stations.map((st) => (
          <div key={st.id} className="rounded-2xl bg-brand-surface border border-brand-border p-4 sm:p-5 shadow-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-base text-brand-glow">{st.name}</h3>
                <span className="text-xs text-brand-muted capitalize">Current mode: {st.status}</span>
              </div>

              <select
                value={st.status}
                disabled={busy}
                onChange={(e) => void changeStationStatus(st.id, e.target.value as StationStatus)}
                className="rounded-xl border border-brand-border px-3 py-2 text-xs font-bold bg-brand-soft text-brand-glow"
              >
                <option value="active">Active (Bookable)</option>
                <option value="maintenance">Maintenance</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {hours.map((h) => {
                const state = evaluateStationSlot(st, scheduleDate, h, 1, blocks, bookings, settings);
                return (
                  <div
                    key={h}
                    title={state.reason}
                    className={`rounded-lg border px-1.5 py-2 text-center text-[11px] font-semibold ${
                      state.available
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                    }`}
                  >
                    <div>{formatHourShort(h)}</div>
                    <div className="text-[9.5px] opacity-80 truncate">
                      {state.available ? 'Free' : state.kind}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Active Blocks for Selected Date */}
      {blocks.length > 0 && (
        <div className="rounded-2xl bg-brand-surface border border-brand-border p-4 sm:p-5 shadow-card">
          <h3 className="font-display font-bold text-sm text-brand-glow mb-3">
            Manual Slot Blocks on {scheduleDate}
          </h3>
          <div className="space-y-2">
            {blocks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-brand-soft border border-brand-border px-3.5 py-2.5 text-xs sm:text-sm"
              >
                <div>
                  <strong>PS5 Station {b.stationId}</strong> • {formatHourLabel(b.startHour)} –{' '}
                  {formatHourLabel(b.endHour)} <span className="text-brand-muted">({b.reason})</span>
                </div>
                <button
                  type="button"
                  onClick={() => void removeBlock(b.id)}
                  className="text-red-600 hover:text-red-200 p-1.5"
                  aria-label="Remove block"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

