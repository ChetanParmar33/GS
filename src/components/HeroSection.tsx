'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Car, Gamepad2, Home, MapPin } from 'lucide-react';
import {
  formatHourShort,
  formatINR,
  getKolkataNowParts,
  getRentalPackagePrice,
  getSlotPriceForTier
} from '@/lib/booking-rules';
import type { AdminSettings } from '@/types/booking';

interface HeroSectionProps {
  settings: AdminSettings;
}

// "Open now · till 11 PM" / "Opens 11 AM", from the shop hours in IST. Computed after mount so server and phone clocks never disagree.
function useOpenStatus(open: number, close: number) {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = getKolkataNowParts();
      setIsOpen(now.hour >= open && now.hour < close);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [open, close]);
  return isOpen;
}

export function HeroSection({ settings }: HeroSectionProps) {
  const isOpen = useOpenStatus(settings.openingHour, settings.closingHour);
  const hours = `${formatHourShort(settings.openingHour)} – ${formatHourShort(settings.closingHour)}`;
  const regularRate = getSlotPriceForTier(1, 'regular', settings);
  const g29Rate = getSlotPriceForTier(1, 'g29', settings);
  const rentalDayRate = getRentalPackagePrice(1, settings);

  const stats = [
    { value: formatINR(regularRate), label: 'regular PS5 games / hr' },
    { value: formatINR(g29Rate), label: 'G29 racing simulator / hr' },
    { value: hours.replace(/ /g, ''), label: 'open every day (IST)' },
    { value: formatINR(rentalDayRate), label: 'PS5 home rental / day' }
  ];

  const quickZones = [
    {
      icon: Gamepad2,
      title: 'Regular PS5 Games',
      sub: 'Fighting, Action, Sports & Squad Co-op',
      price: `${formatINR(regularRate)}/hr`,
      href: '/book',
      badge: 'Popular'
    },
    {
      icon: Car,
      title: 'Logitech G29 Racing Sim',
      sub: 'Force-feedback wheel, pedals & racing titles',
      price: `${formatINR(g29Rate)}/hr`,
      href: '/book?tier=g29',
      badge: 'Pro Rig'
    },
    {
      icon: Home,
      title: 'PS5 Home Rental',
      sub: '1 to 7 days · COD or Full Online',
      price: `From ${formatINR(rentalDayRate)}`,
      href: '/book?mode=rent',
      badge: 'Take Home'
    }
  ];

  return (
    <section id="home" className="relative isolate overflow-hidden pt-28 sm:pt-36 pb-14 sm:pb-20">
      {/* backdrop: Vice sunset lounge art, darkened toward copy + violet glow */}
      <div className="absolute inset-0 -z-10">
        <img
          src="/assets/hero-vice.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[70%_center] opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-base via-brand-base/85 to-brand-base/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-base via-transparent to-brand-base/60" />
        <div className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full bg-brand-primary/25 blur-[120px] animate-drift" />
        <div className="absolute inset-0 bg-hud mask-fade-b opacity-60" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
        <div className="lg:col-span-7">
          <div className="animate-fade-up inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-white/10 bg-white/5 backdrop-blur px-3.5 py-1.5 text-xs sm:text-[13px] font-semibold">
            {isOpen !== null && (
              <span className={`inline-flex items-center gap-1.5 ${isOpen ? 'text-emerald-300' : 'text-brand-sun'}`}>
                <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400 animate-pulse-dot' : 'bg-brand-sun'}`} />
                {isOpen ? `Open now · till ${formatHourShort(settings.closingHour)}` : `Opens ${formatHourShort(settings.openingHour)}`}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-brand-muted">
              <MapPin className="w-3.5 h-3.5 text-brand-accent" />
              V.V. Nagar, Anand
            </span>
          </div>

          <h1 className="animate-fade-up delay-1 font-display font-extrabold uppercase text-[38px] leading-[1.03] sm:text-6xl lg:text-[72px] tracking-[-0.03em] text-white mt-6">
            Anand&apos;s PS5 &amp;
            <br />
            G29 <span className="text-sunset">Gaming Zone.</span>
          </h1>

          <p className="animate-fade-up delay-2 mt-6 max-w-xl text-base sm:text-lg text-brand-muted leading-relaxed">
            Play Fighting, Racing, Action &amp; Sports titles at {settings.shopName} starting at{' '}
            <strong className="text-white">{formatINR(regularRate)}/hr</strong>, drive our{' '}
            <strong className="text-white">Logitech G29 Racing Simulator</strong> at{' '}
            <strong className="text-white">{formatINR(g29Rate)}/hr</strong>, or rent a PS5 console home.
          </p>

          <div className="animate-fade-up delay-3 mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/book"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary hover:bg-brand-hover text-white font-bold px-7 py-4 shadow-glow transition-colors tap-target"
            >
              Book a Slot
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/book?tier=g29"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-accent/40 bg-brand-primary/15 hover:bg-brand-primary/25 backdrop-blur text-white font-bold px-7 py-4 transition-colors tap-target"
            >
              Book G29 Sim ({formatINR(g29Rate)}/hr)
            </Link>
            <Link
              href="/book?mode=rent"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur text-white font-bold px-6 py-4 transition-colors tap-target"
            >
              Rent PS5
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 animate-fade-up delay-4">
          <div className="rounded-3xl border border-white/10 bg-brand-base/75 backdrop-blur-xl p-5 sm:p-6 shadow-elevated space-y-3">
            <div className="flex items-center justify-between gap-2 pb-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                Quick Reserve
              </span>
              <span className="text-xs font-semibold text-brand-muted">Instant WhatsApp Request</span>
            </div>

            {quickZones.map((zone) => {
              const Icon = zone.icon;
              return (
                <Link
                  key={zone.title}
                  href={zone.href}
                  className="group flex items-center gap-3.5 rounded-2xl border border-white/10 bg-brand-surface/80 hover:border-brand-accent/50 hover:bg-brand-lavender/40 p-3.5 transition-all"
                >
                  <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-primary to-brand-pink text-white flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-white truncate">{zone.title}</strong>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-brand-glow shrink-0">
                        {zone.badge}
                      </span>
                    </div>
                    <span className="block text-xs text-brand-muted truncate mt-0.5">{zone.sub}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <strong className="block font-display text-sm font-bold text-brand-glow tabular-nums">
                      {zone.price}
                    </strong>
                    <span className="text-[11px] font-semibold text-brand-accent group-hover:text-white">
                      Book &rarr;
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-3xl overflow-hidden bg-white/10 border border-white/10">
          {stats.map((s) => (
            <div key={s.label} className="bg-brand-base/80 backdrop-blur px-5 py-5 sm:py-6">
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display font-bold text-xl sm:text-2xl text-white tabular-nums">{s.value}</dd>
              <dd className="text-xs sm:text-sm text-brand-muted mt-1">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
