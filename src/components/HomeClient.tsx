'use client';

import Link from 'next/link';
import { CalendarCheck, MessageCircle } from 'lucide-react';
import type { AdminSettings } from '@/types/booking';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { InfoSections, waLink } from '@/components/InfoSections';
import { SiteFooter } from '@/components/SiteFooter';

interface HomeClientProps {
  initialSettings: AdminSettings;
}

export function HomeClient({ initialSettings }: HomeClientProps) {
  const waHref = waLink(
    initialSettings,
    `Hi ${initialSettings.shopName}, I want to book a PS5 / G29 slot.`
  );

  return (
    <div className="min-h-screen flex flex-col bg-brand-base pb-20 sm:pb-24">
      <Navbar shopName={initialSettings.shopName} />
      <main className="flex-1">
        <HeroSection settings={initialSettings} />
        <InfoSections settings={initialSettings} />
      </main>
      <SiteFooter settings={initialSettings} />

      {/* Always-visible sticky bottom bar: Book Now + WhatsApp */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-brand-base/90 backdrop-blur-xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto grid grid-cols-2 gap-2.5">
          <Link
            href="/book"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary hover:bg-brand-hover text-white font-bold text-sm sm:text-base px-4 py-3 shadow-glow transition-colors tap-target"
          >
            <CalendarCheck className="w-4 h-4 shrink-0" />
            Book Now
          </Link>
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-[#062d16] font-bold text-sm sm:text-base px-4 py-3 transition-colors tap-target"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
