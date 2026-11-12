'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Instagram, MessageCircle, X } from 'lucide-react';
import { formatHourShort, formatINR, getRentalPackagePrice, getSlotPackagePrice } from '@/lib/booking-rules';
import type { AdminSettings } from '@/types/booking';
import { Logo } from '@/components/Logo';
import { waLink } from '@/components/InfoSections';

export function SiteFooter({ settings }: { settings: AdminSettings }) {
  const [termsOpen, setTermsOpen] = useState(false);
  const hours = `${formatHourShort(settings.openingHour)} – ${formatHourShort(settings.closingHour)}`;
  const wa = waLink(settings);

  return (
    <footer className="border-t border-white/5 bg-black/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-4">
          <Logo name={settings.shopName} />
          <p className="text-sm text-brand-muted leading-relaxed max-w-sm">
            Independent PlayStation 5 gaming lounge in V.V. Nagar, Anand. Not affiliated with or endorsed by Rockstar Games or Sony.
          </p>
          <div className="flex gap-2">
            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram ${settings.instagramHandle}`}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-brand-muted hover:text-white hover:border-brand-accent/50 transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-brand-muted hover:text-white hover:border-brand-accent/50 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-white mb-4">Explore</h4>
          <ul className="space-y-2.5 text-sm text-brand-muted">
            <li><Link href="/#pricing" className="hover:text-white">Pricing</Link></li>
            <li><Link href="/#how-it-works" className="hover:text-white">How it works</Link></li>
            <li><Link href="/#faq" className="hover:text-white">FAQ</Link></li>
            <li><Link href="/#visit" className="hover:text-white">Visit us</Link></li>
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-white mb-4">Book</h4>
          <ul className="space-y-2.5 text-sm text-brand-muted">
            <li><Link href="/book" className="hover:text-white">Station slot · {formatINR(getSlotPackagePrice(1, settings))}/hr</Link></li>
            <li><Link href="/book?mode=rent" className="hover:text-white">PS5 rental · {formatINR(getRentalPackagePrice(1, settings))}/day</Link></li>
            <li>
              <button type="button" onClick={() => setTermsOpen(true)} className="hover:text-white text-left">
                Booking terms
              </button>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-white mb-4">Find us</h4>
          <ul className="space-y-2.5 text-sm text-brand-muted">
            <li>{settings.address}</li>
            <li>Open daily · {hours}</li>
            {settings.whatsappNumber && <li>WhatsApp · +91 {settings.whatsappNumber}</li>}
            {settings.contactNumber && <li>Phone · {settings.contactNumber}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-brand-muted">
          <span>© {new Date().getFullYear()} {settings.shopName}. All rights reserved.</span>
          <span>All times in IST · prices per PS5 station</span>
        </div>
      </div>

      {termsOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="termsTitle"
          onClick={(e) => e.target === e.currentTarget && setTermsOpen(false)}
        >
          <div className="bg-brand-surface rounded-3xl border border-brand-border max-w-lg w-full p-6 shadow-elevated max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h3 id="termsTitle" className="font-display text-lg font-bold text-white">
                Booking terms
              </h3>
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-brand-muted hover:text-white"
                aria-label="Close terms"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-4 text-sm text-brand-muted leading-relaxed list-decimal pl-5 marker:text-brand-accent marker:font-bold">
              <li>
                <strong className="text-white">Rates.</strong> Station slots cost {formatINR(getSlotPackagePrice(1, settings))} (1 hour) to{' '}
                {formatINR(getSlotPackagePrice(4, settings))} (4 hours). PS5 rentals cost {formatINR(getRentalPackagePrice(1, settings))} (1 day) to{' '}
                {formatINR(getRentalPackagePrice(7, settings))} (7 days).
              </li>
              <li>
                <strong className="text-white">Hours.</strong> Slots run strictly within {hours} IST.
              </li>
              <li>
                <strong className="text-white">Cancellations.</strong> {settings.cancellationRules}
              </li>
              <li>
                <strong className="text-white">Pending requests.</strong>{' '}
                {settings.holdPendingSlots
                  ? `A pending request holds the station for ${settings.pendingHoldMinutes || 'unlimited'} minutes until the shop confirms it.`
                  : `Pending requests do not hold a station until ${settings.shopName} confirms them.`}
              </li>
            </ol>
          </div>
        </div>
      )}
    </footer>
  );
}
