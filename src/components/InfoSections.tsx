'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  Car,
  Clock,
  Flame,
  Gamepad2,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Swords,
  Trophy,
  Wallet
} from 'lucide-react';
import {
  formatHourShort,
  formatINR,
  getKolkataNowParts,
  getRentalPackagePrice,
  getSlotPriceForTier
} from '@/lib/booking-rules';
import type { AdminSettings } from '@/types/booking';

interface InfoSectionsProps {
  settings: AdminSettings;
}

const wrap = 'max-w-6xl mx-auto px-4 sm:px-6';
const eyebrow = 'inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent';
const h2 = 'font-display font-extrabold uppercase text-3xl sm:text-[44px] leading-[1.05] tracking-[-0.02em] text-white mt-4';

export function waLink(settings: AdminSettings, text = '') {
  const digits = String(settings.whatsappNumber || '').replace(/\D/g, '');
  if (!digits) return '';
  const n = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

function SectionHead({ id, kicker, title, children }: { id?: string; kicker: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <span id={id} className={eyebrow}>
        <span className="w-6 h-px bg-brand-accent" />
        {kicker}
      </span>
      <h2 className={h2}>{title}</h2>
      {children && <p className="mt-4 text-base sm:text-lg text-brand-muted leading-relaxed">{children}</p>}
    </div>
  );
}

export function InfoSections({ settings }: InfoSectionsProps) {
  const hours = `${formatHourShort(settings.openingHour)} – ${formatHourShort(settings.closingHour)}`;
  const regularHour = getSlotPriceForTier(1, 'regular', settings);
  const g29Hour = getSlotPriceForTier(1, 'g29', settings);
  const dayOne = getRentalPackagePrice(1, settings);
  const wa = waLink(settings, `Hi ${settings.shopName}, I'd like to know about PS5 slots.`);
  const mapsUrl =
    settings.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${settings.shopName} ${settings.address}`)}`;

  const regularSlots = [1, 2, 3, 4].map((h) => ({
    h,
    price: getSlotPriceForTier(h, 'regular', settings)
  }));
  const g29Slots = [1, 2, 3, 4].map((h) => ({
    h,
    price: getSlotPriceForTier(h, 'g29', settings)
  }));
  const rentals = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const price = getRentalPackagePrice(d, settings);
    return { d, price, perDay: Math.round(price / d), save: Math.round((1 - price / (dayOne * d)) * 100) };
  });
  const bestRental = rentals.reduce((a, b) => (b.save > a.save ? b : a));

  const gameZones = [
    {
      icon: Car,
      tag: `${formatINR(g29Hour)}/hr · Logitech G29`,
      title: 'G29 Racing Simulator',
      body: 'Force-feedback steering wheel, 3-pedal setup & racing titles built for speed fans.',
      titles: ['Gran Turismo 7', 'F1 24', 'Need for Speed Unbound', 'Dirt Rally 2.0'],
      href: '/book?tier=g29',
      cta: 'Book G29 Sim',
      highlight: true
    },
    {
      icon: Swords,
      tag: `${formatINR(regularHour)}/hr · Fighting`,
      title: 'Fighting & Arena',
      body: 'Head-to-head 1v1 and tournament matches with crisp DualSense response.',
      titles: ['Tekken 8', 'Mortal Kombat 1', 'WWE 2K25', 'UFC 5'],
      href: '/book',
      cta: 'Book Slot',
      highlight: false
    },
    {
      icon: Flame,
      tag: `${formatINR(regularHour)}/hr · Action`,
      title: 'Action & Open World',
      body: 'Blockbuster single-player worlds and story campaigns on PS5.',
      titles: ['GTA V', 'Red Dead Redemption 2', 'Spider-Man 2', 'God of War Ragnarök'],
      href: '/book',
      cta: 'Book Slot',
      highlight: false
    },
    {
      icon: Trophy,
      tag: `${formatINR(regularHour)}/hr · Sports & Co-op`,
      title: 'Sports, Racing & Squad',
      body: 'Bring your friends for football, cricket, co-op missions, and racing battles.',
      titles: ['EA Sports FC 25', 'Cricket 24', 'It Takes Two', 'Call of Duty'],
      href: '/book',
      cta: 'Book Slot',
      highlight: false
    }
  ];

  const features = [
    {
      icon: Gamepad2,
      title: 'PS5 + Logitech G29 Setups',
      body: 'DualSense PS5 stations for squad play plus a dedicated Logitech G29 wheel rig for racing lovers.'
    },
    {
      icon: CalendarCheck,
      title: 'Live slot availability',
      body: 'See open hours across our shop timings and reserve your slot in under a minute from your phone.'
    },
    {
      icon: MessageCircle,
      title: 'Confirmed on WhatsApp',
      body: 'Send your booking on WhatsApp and the shop confirms it. No accounts, no app to install.'
    },
    {
      icon: Wallet,
      title: 'Play here or rent home',
      body: `Regular lounge slots start at ${formatINR(regularHour)}/hr, G29 Racing at ${formatINR(g29Hour)}/hr, or take a PS5 home.`
    }
  ];

  const steps = [
    { title: 'Pick setup, date & hours', body: `Choose Regular PS5 (${formatINR(regularHour)}/hr), G29 Sim (${formatINR(g29Hour)}/hr), or 1–7 day home rental between ${hours}.` },
    { title: 'Add your name and mobile', body: 'Just a name and a 10-digit Indian mobile number. Nothing else to fill.' },
    { title: 'Send it on WhatsApp', body: 'Your request goes straight to our WhatsApp counter. Admin reviews and approves fast.' }
  ];

  const ticker = [
    settings.shopName,
    `PS5 From ${formatINR(regularHour)}/hr`,
    `G29 Racing ${formatINR(g29Hour)}/hr`,
    'Fighting · Tekken · Mortal Kombat',
    'Sports · EA FC · Cricket',
    'PS5 Home Rentals',
    'V.V. Nagar, Anand'
  ];

  return (
    <>
      {/* Ticker */}
      <div className="relative border-y border-white/5 bg-brand-surface/60 py-4 overflow-hidden" aria-hidden="true">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center">
              {[...ticker, ...ticker].map((t, i) => (
                <span key={`${k}-${i}`} className="flex items-center font-display font-bold uppercase text-lg sm:text-2xl tracking-tight">
                  <span className={i % 3 === 1 ? 'text-transparent [-webkit-text-stroke:1px_#B48CFF]' : 'text-white'}>{t}</span>
                  <span className="mx-6 text-brand-pink">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Games & G29 Racing Sim */}
      <section className="py-20 sm:py-24" aria-labelledby="games-title">
        <div className={wrap}>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <SectionHead id="games" kicker="Games &amp; Simulators" title={<span id="games-title">Built for every <span className="text-sunset">genre.</span></span>}>
              From fighting tournaments and open-world action to force-feedback racing on our Logitech G29 rig.
            </SectionHead>
            <Link href="/book" className="inline-flex items-center gap-2 font-bold text-brand-accent hover:text-white transition-colors">
              Reserve your setup <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
            {gameZones.map((zone) => {
              const Icon = zone.icon;
              return (
                <article
                  key={zone.title}
                  className={`rounded-[28px] border p-6 sm:p-7 flex flex-col justify-between transition-colors ${
                    zone.highlight
                      ? 'border-brand-accent/60 bg-gradient-to-br from-brand-lavender/70 via-brand-surface to-brand-surface shadow-glow'
                      : 'border-white/[0.07] bg-brand-surface hover:border-brand-accent/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-pink text-white flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border ${
                          zone.highlight
                            ? 'bg-brand-primary/25 text-brand-glow border-brand-accent/50'
                            : 'bg-white/5 text-brand-glow border-white/10'
                        }`}
                      >
                        {zone.tag}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-xl sm:text-2xl text-white mt-5">{zone.title}</h3>
                    <p className="text-sm text-brand-muted mt-2 leading-relaxed">{zone.body}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {zone.titles.map((gameTitle) => (
                        <span
                          key={gameTitle}
                          className="rounded-lg border border-white/10 bg-brand-base/70 px-2.5 py-1 text-xs font-semibold text-brand-dark"
                        >
                          {gameTitle}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-muted">Instant WhatsApp slot request</span>
                    <Link
                      href={zone.href}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-accent hover:text-white transition-colors"
                    >
                      {zone.cta} <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 sm:py-28 border-t border-white/5" aria-labelledby="pricing-title">
        <div className={wrap}>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <SectionHead id="pricing" kicker="Pricing" title={<span id="pricing-title">Simple, transparent <span className="text-sunset">rates.</span></span>}>
              Pick Regular PS5 games, book the Logitech G29 Racing Simulator, or rent a PS5 console home.
            </SectionHead>
            <p className="text-sm text-brand-muted lg:text-right">
              No per-player extra fee on slots
              <br />
              No membership or hidden charges
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Regular PS5 */}
            <article className="group relative rounded-[28px] border border-brand-border bg-brand-surface p-6 sm:p-7 flex flex-col overflow-hidden transition-colors hover:border-brand-accent/50">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-primary/15 text-brand-glow border border-brand-primary/30 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  Lounge Slots
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-muted">
                  <Clock className="w-3.5 h-3.5" /> {hours}
                </span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white mt-5">Regular PS5 Games</h3>
              <p className="text-sm text-brand-muted mt-1">
                Flat <strong className="text-white">{formatINR(regularHour)}</strong> / hour · Fighting, Action, Sports &amp; Co-op
              </p>

              <ul className="mt-6 space-y-2.5 flex-1">
                {regularSlots.map((s) => (
                  <li key={s.h} className="flex items-center justify-between rounded-2xl px-4 py-3 border border-white/5 bg-white/[0.03]">
                    <span className="font-display font-bold text-white text-sm">{s.h === 1 ? '1 hour' : `${s.h} hours`}</span>
                    <strong className="font-display font-bold text-lg text-white tabular-nums">{formatINR(s.price)}</strong>
                  </li>
                ))}
              </ul>

              <Link
                href="/book"
                className="group/btn mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary hover:bg-brand-hover text-white font-bold px-6 py-4 shadow-glow transition-colors tap-target"
              >
                Book Regular Slot
                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
              </Link>
            </article>

            {/* G29 Racing Sim */}
            <article className="group relative rounded-[28px] border border-brand-accent/60 bg-brand-surface p-6 sm:p-7 flex flex-col overflow-hidden transition-colors hover:border-brand-accent">
              <div className="pointer-events-none absolute -top-28 -right-28 w-64 h-64 rounded-full bg-brand-primary/25 blur-3xl" />
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-lavender text-brand-glow border border-brand-accent/40 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  Racing Cockpit
                </span>
                <span className="text-xs font-semibold text-brand-accent">Logitech G29</span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white mt-5">G29 Racing Simulator</h3>
              <p className="text-sm text-brand-muted mt-1">
                Flat <strong className="text-white">{formatINR(g29Hour)}</strong> / hour · Wheel + 3 Pedals
              </p>

              <ul className="mt-6 space-y-2.5 flex-1">
                {g29Slots.map((s) => (
                  <li key={s.h} className="flex items-center justify-between rounded-2xl px-4 py-3 border border-brand-accent/20 bg-brand-primary/10">
                    <span className="font-display font-bold text-white text-sm">{s.h === 1 ? '1 hour' : `${s.h} hours`}</span>
                    <strong className="font-display font-bold text-lg text-white tabular-nums">{formatINR(s.price)}</strong>
                  </li>
                ))}
              </ul>

              <Link
                href="/book?tier=g29"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-white hover:bg-brand-glow text-brand-base font-bold px-6 py-4 transition-colors tap-target"
              >
                Book G29 Sim
                <ArrowRight className="w-4 h-4" />
              </Link>
            </article>

            {/* Home rental */}
            <article className="group relative rounded-[28px] border border-brand-border bg-brand-surface p-6 sm:p-7 flex flex-col overflow-hidden transition-colors hover:border-brand-pink/40">
              <div className="pointer-events-none absolute -top-28 -right-28 w-64 h-64 rounded-full bg-brand-pink/10 blur-3xl" />
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-pink/10 text-brand-pink border border-brand-pink/30 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                  Take it home
                </span>
                <span className="text-xs font-semibold text-brand-muted">COD or Online</span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white mt-5">PS5 Home Rental</h3>
              <p className="text-sm text-brand-muted mt-1">
                From <strong className="text-white">{formatINR(dayOne)}</strong> / day · 1 to 7 days
              </p>

              <ul className="mt-6 grid grid-cols-2 gap-2 flex-1 content-start">
                {rentals.map((r) => (
                  <li
                    key={r.d}
                    className={`rounded-2xl px-3.5 py-2.5 border ${
                      r === bestRental && r.save > 0 ? 'border-brand-pink/40 bg-brand-pink/10' : 'border-white/5 bg-white/[0.03]'
                    }`}
                  >
                    <span className="block text-[11px] font-semibold text-brand-muted">{r.d === 1 ? '1 day' : `${r.d} days`}</span>
                    <strong className="block font-display font-bold text-base text-white tabular-nums mt-0.5">{formatINR(r.price)}</strong>
                  </li>
                ))}
              </ul>

              <Link
                href="/book?mode=rent"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold px-6 py-4 transition-colors tap-target"
              >
                Rent a PS5
                <ArrowRight className="w-4 h-4" />
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* The lounge */}
      <section className="relative py-20 sm:py-28 border-y border-white/5 bg-brand-surface/40 overflow-hidden" aria-labelledby="why-title">
        <div className="absolute inset-0 bg-hud opacity-40 mask-fade-b" aria-hidden="true" />
        <div className={`${wrap} relative grid grid-cols-1 lg:grid-cols-12 gap-10`}>
          <div className="lg:col-span-5">
            <SectionHead id="why" kicker="The lounge" title={<span id="why-title">Built for long <span className="text-sunset">sessions.</span></span>}>
              A clean PS5 setup in V.V. Nagar with DualSense controllers and comfortable seating. Bring your college squad or come
              solo for the weekend grind.
            </SectionHead>
            <div className="mt-8 relative rounded-[28px] overflow-hidden border border-white/10 aspect-[16/10]">
              <img src="/assets/hero-vice.jpg" alt="GAMING STATION PS5 lounge atmosphere" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-base/90 via-transparent to-transparent" />
              <p className="absolute bottom-4 left-5 right-5 font-display font-bold text-white text-lg">
                {settings.shopName} · V.V. Nagar, Anand
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 content-center">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <article
                  key={f.title}
                  className="group rounded-[24px] border border-white/[0.07] bg-brand-base/60 backdrop-blur p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 hover:border-brand-accent/40 hover:shadow-glow"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-pink text-white flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="font-display font-bold text-sm text-white/15">0{i + 1}</span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-white mt-6">{f.title}</h3>
                  <p className="text-sm text-brand-muted leading-relaxed mt-2">{f.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-28" aria-labelledby="how-title">
        <div className={wrap}>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <SectionHead id="how-it-works" kicker="How it works" title={<span id="how-title">Booked in three steps.</span>} />
            <Link href="/book" className="inline-flex items-center gap-2 font-bold text-brand-accent hover:text-white transition-colors">
              Start booking <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-[24px] border border-white/[0.07] bg-brand-surface p-6 sm:p-7">
                <span className="font-display font-extrabold text-6xl leading-none text-transparent [-webkit-text-stroke:1.5px_#7A35F0]">
                  {i + 1}
                </span>
                <h3 className="font-display font-bold text-lg text-white mt-6">{s.title}</h3>
                <p className="text-sm text-brand-muted leading-relaxed mt-2">{s.body}</p>
                {i < steps.length - 1 && (
                  <span className="hidden md:block absolute top-1/2 -right-[13px] z-10 w-6 h-6 rounded-full border border-brand-border bg-brand-base text-brand-accent text-xs leading-[22px] text-center">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Visit settings={settings} hours={hours} wa={wa} mapsUrl={mapsUrl} />

      {/* CTA band */}
      <section className="pb-20 sm:pb-28">
        <div className={wrap}>
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-primary via-[#9b3fd6] to-brand-pink px-6 py-14 sm:px-14 sm:py-20 text-center">
            <div className="absolute inset-0 bg-hud opacity-30" aria-hidden="true" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/80">Ready player one?</p>
              <h2 className="font-display font-extrabold uppercase text-3xl sm:text-5xl lg:text-6xl tracking-[-0.02em] text-white mt-4">
                Your session is waiting.
              </h2>
              <p className="text-white/85 mt-4 max-w-lg mx-auto">
                Evening and weekend slots fill fast. Lock your PS5, G29 Racing Sim, or home rental in seconds.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white hover:bg-brand-glow text-brand-base font-bold px-7 py-4 transition-colors tap-target"
                >
                  Book a Slot <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/book?mode=rent"
                  className="inline-flex items-center justify-center rounded-full border border-white/40 hover:bg-white/10 text-white font-bold px-7 py-4 transition-colors tap-target"
                >
                  Rent a PS5
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function Visit({ settings, hours, wa, mapsUrl }: { settings: AdminSettings; hours: string; wa: string; mapsUrl: string }) {
  // highlight today's row (IST) after mount
  const [today, setToday] = useState<number | null>(null);
  const [closedToday, setClosedToday] = useState(false);
  useEffect(() => {
    const p = getKolkataNowParts();
    setToday((new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7);
    setClosedToday(settings.closedDates.includes(p.dateStr));
  }, [settings.closedDates]);

  const contacts = [
    { icon: MapPin, label: 'Address', value: settings.address, href: mapsUrl, cta: 'Get directions' },
    settings.whatsappNumber && { icon: MessageCircle, label: 'WhatsApp', value: `+91 ${settings.whatsappNumber}`, href: wa, cta: 'Chat now' },
    settings.contactNumber && { icon: Phone, label: 'Phone', value: settings.contactNumber, href: `tel:${settings.contactNumber.replace(/\s/g, '')}`, cta: 'Call' },
    settings.instagramUrl && { icon: Instagram, label: 'Instagram', value: settings.instagramHandle, href: settings.instagramUrl, cta: 'Follow' }
  ].filter(Boolean) as { icon: typeof MapPin; label: string; value: string; href: string; cta: string }[];

  return (
    <section className="py-20 sm:py-28 border-t border-white/5 bg-brand-surface/40" aria-labelledby="visit-title">
      <div className={`${wrap} grid grid-cols-1 lg:grid-cols-12 gap-10`}>
        <div className="lg:col-span-6">
          <SectionHead id="visit" kicker="Visit" title={<span id="visit-title">Come play in <span className="text-sunset">Anand.</span></span>}>
            On Iskcon Road in V.V. Nagar, an easy ride from the college campuses.
          </SectionHead>
          <ul className="mt-8 space-y-3">
            {contacts.map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.label}>
                  <a
                    href={c.href}
                    target={c.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-brand-base/60 px-5 py-4 hover:border-brand-accent/40 transition-colors"
                  >
                    <span className="w-11 h-11 shrink-0 rounded-xl bg-brand-primary/15 text-brand-accent flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.15em] text-brand-muted">{c.label}</span>
                      <span className="block text-sm sm:text-[15px] font-semibold text-white mt-0.5 break-words">{c.value}</span>
                    </span>
                    <span className="hidden sm:inline text-sm font-bold text-brand-accent group-hover:text-white transition-colors shrink-0">
                      {c.cta} →
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="lg:col-span-6">
          <div className="rounded-[28px] border border-white/[0.07] bg-brand-base/60 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display font-bold text-lg text-white">Opening hours</h3>
              <span className="text-xs font-semibold text-brand-muted">IST</span>
            </div>
            <ul className="mt-5 divide-y divide-white/5">
              {DAYS.map((d, i) => {
                const isToday = i === today;
                return (
                  <li key={d} className={`flex items-center justify-between py-3.5 text-sm ${isToday ? 'text-white font-bold' : 'text-brand-muted'}`}>
                    <span className="flex items-center gap-2">
                      {d}
                      {isToday && (
                        <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Today</span>
                      )}
                    </span>
                    <span className="tabular-nums">{isToday && closedToday ? 'Closed today' : hours}</span>
                  </li>
                );
              })}
            </ul>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-full bg-white hover:bg-brand-glow text-brand-base font-bold px-6 py-3.5 transition-colors tap-target"
            >
              <MapPin className="w-4 h-4" /> Open in Google Maps
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
