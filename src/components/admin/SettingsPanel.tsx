'use client';

import { useState } from 'react';
import type { AdminSettings } from '@/types/booking';

interface SettingsPanelProps {
  settings: AdminSettings;
  onSaved: (next: AdminSettings) => void;
}

export function SettingsPanel({ settings, onSaved }: SettingsPanelProps) {
  const [form, setForm] = useState<AdminSettings>(settings);
  const [closedDatesText, setClosedDatesText] = useState(settings.closedDates.join(', '));
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  function updateField<K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    setError('');
    try {
      const closedDates = closedDatesText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, closedDates })
      });
      const json = (await res.json()) as { settings?: AdminSettings; error?: string };
      if (!res.ok || !json.settings) throw new Error(json.error || 'Could not update settings.');
      setForm(json.settings);
      setClosedDatesText(json.settings.closedDates.join(', '));
      onSaved(json.settings);
      setStatusMsg('Settings saved. Hourly price changes apply only to future bookings.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className="rounded-2xl bg-brand-surface border border-brand-border p-4 sm:p-6 shadow-card space-y-5"
    >
      <div>
        <h2 className="font-display text-lg font-bold text-brand-glow">Website &amp; Shop Settings</h2>
        <p className="text-xs text-brand-muted">
          Configure contact info, pricing, stations, dates, UPI advance payment, and cancellation rules.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <label className="block text-xs font-semibold mb-1">Shop Name</label>
          <input
            type="text"
            value={form.shopName}
            onChange={(e) => updateField('shopName', e.target.value)}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        {/* GameZone Slot Hourly Prices */}
        <div className="sm:col-span-2 rounded-xl bg-brand-soft border border-brand-border p-4 space-y-3">
          <div>
            <strong className="block text-xs font-semibold text-brand-glow">
              GameZone Slot Hourly Rates (Play at Shop • ₹)
            </strong>
            <span className="text-[11px] text-brand-muted">
              Existing bookings preserve their booked price.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Regular PS5 Games (₹ / hour)
              </label>
              <input
                type="number"
                min={1}
                value={form.regularHourlyPrice}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    hourlyPrice: val,
                    regularHourlyPrice: val
                  }));
                }}
                className="w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Logitech G29 Racing Sim (₹ / hour)
              </label>
              <input
                type="number"
                min={1}
                value={form.g29HourlyPrice}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    g29HourlyPrice: val
                  }));
                }}
                className="w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* PS5 Rental Package Prices */}
        <div className="sm:col-span-2 rounded-xl bg-brand-soft border border-brand-border p-4 space-y-3">
          <div>
            <strong className="block text-xs font-semibold text-brand-glow">
              PS5 Home Rental Packages (1 to 7 Days • ₹)
            </strong>
            <span className="text-[11px] text-brand-muted">
              Configure exact package price for 1 to 7 day home rentals.
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {[1, 2, 3, 4, 5, 6, 7].map((days) => (
              <div key={days}>
                <label className="block text-xs font-semibold mb-1">
                  {days} {days === 1 ? 'Day' : 'Days'} (₹)
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.rentalPrices[String(days)] ?? ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      rentalPrices: { ...prev.rentalPrices, [String(days)]: val }
                    }));
                  }}
                  className="w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2"
                />
              </div>
            ))}
          </div>
          <div className="max-w-xs pt-1">
            <label className="block text-xs font-semibold mb-1">
              Rental COD Confirmation Fee (Online • ₹)
            </label>
            <input
              type="number"
              min={1}
              value={form.rentalCodFee}
              onChange={(e) => updateField('rentalCodFee', Number(e.target.value))}
              className="w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Contact Number</label>
          <input
            type="text"
            value={form.contactNumber}
            onChange={(e) => updateField('contactNumber', e.target.value)}
            placeholder="Not configured yet"
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">WhatsApp Number (with 91 or 10 digits)</label>
          <input
            type="text"
            value={form.whatsappNumber}
            onChange={(e) => updateField('whatsappNumber', e.target.value)}
            placeholder="Used by customer WhatsApp button"
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Instagram Handle</label>
          <input
            type="text"
            value={form.instagramHandle}
            onChange={(e) => updateField('instagramHandle', e.target.value)}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Instagram URL</label>
          <input
            type="url"
            value={form.instagramUrl}
            onChange={(e) => updateField('instagramUrl', e.target.value)}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold mb-1">Shop Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold mb-1">Google Maps Link (Verified URL)</label>
          <input
            type="url"
            value={form.googleMapsUrl}
            onChange={(e) => updateField('googleMapsUrl', e.target.value)}
            placeholder="https://maps.google.com/..."
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Opening Hour (24h, e.g. 11)</label>
          <input
            type="number"
            min={0}
            max={22}
            value={form.openingHour}
            onChange={(e) => updateField('openingHour', Number(e.target.value))}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Closing Hour (24h, e.g. 23)</label>
          <input
            type="number"
            min={1}
            max={24}
            value={form.closingHour}
            onChange={(e) => updateField('closingHour', Number(e.target.value))}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Number of PS5 Stations</label>
          <input
            type="number"
            min={1}
            max={12}
            value={form.stationCount}
            onChange={(e) => updateField('stationCount', Number(e.target.value))}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Max Booking Date</label>
          <input
            type="date"
            value={form.maxBookingDate}
            onChange={(e) => updateField('maxBookingDate', e.target.value)}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Min Booking Date (Optional)</label>
          <input
            type="date"
            value={form.minBookingDate}
            onChange={(e) => updateField('minBookingDate', e.target.value)}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Closed Dates (comma YYYY-MM-DD)</label>
          <input
            type="text"
            value={closedDatesText}
            onChange={(e) => setClosedDatesText(e.target.value)}
            placeholder="2026-11-25, 2026-12-25"
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>

        {/* Pending policy */}
        <div className="sm:col-span-2 rounded-xl bg-brand-soft border border-brand-border p-4 space-y-3">
          <label className="flex items-center gap-2.5 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={form.holdPendingSlots}
              onChange={(e) => updateField('holdPendingSlots', e.target.checked)}
              className="accent-brand-primary w-4 h-4"
            />
            <span>Temporarily hold station for Pending bookings</span>
          </label>
          <div className="max-w-xs">
            <label className="block text-xs font-semibold mb-1">Hold Duration (minutes, 0 = manual)</label>
            <input
              type="number"
              min={0}
              value={form.pendingHoldMinutes}
              onChange={(e) => updateField('pendingHoldMinutes', Number(e.target.value))}
              className="w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2"
            />
          </div>
        </div>

        {/* UPI Settings */}
        <div className="sm:col-span-2 rounded-xl bg-brand-soft border border-brand-border p-4 space-y-3">
          <label className="flex items-center gap-2.5 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={form.upiEnabled}
              onChange={(e) => updateField('upiEnabled', e.target.checked)}
              className="accent-brand-primary w-4 h-4"
            />
            <span>Enable UPI Advance Payment Option</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={form.upiId}
              onChange={(e) => updateField('upiId', e.target.value)}
              placeholder="Shop UPI ID (e.g. name@bank)"
              className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2.5"
            />
            <input
              type="text"
              value={form.upiAccountName}
              onChange={(e) => updateField('upiAccountName', e.target.value)}
              placeholder="Account Holder / Business Name"
              className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2.5"
            />
          </div>
          <input
            type="text"
            value={form.upiInstructions}
            onChange={(e) => updateField('upiInstructions', e.target.value)}
            placeholder="Customer UPI instructions"
            className="w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2.5"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold mb-1">Cancellation Rules</label>
          <textarea
            rows={3}
            value={form.cancellationRules}
            onChange={(e) => updateField('cancellationRules', e.target.value)}
            className="w-full rounded-xl border border-brand-border px-3 py-2.5"
          />
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3">{error}</div>}
      {statusMsg && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3">{statusMsg}</div>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand-primary hover:bg-brand-hover text-white font-bold px-6 py-3 text-sm disabled:opacity-60 tap-target"
      >
        {saving ? 'Saving Settings...' : 'Save Website Settings'}
      </button>
    </form>
  );
}

