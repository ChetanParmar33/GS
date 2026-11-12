'use client';

import type { AdminSettings } from '@/types/booking';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { InfoSections } from '@/components/InfoSections';
import { SiteFooter } from '@/components/SiteFooter';

interface HomeClientProps {
  initialSettings: AdminSettings;
}

export function HomeClient({ initialSettings }: HomeClientProps) {
  return (
    <div className="min-h-screen flex flex-col bg-brand-base">
      <Navbar shopName={initialSettings.shopName} />
      <main className="flex-1">
        <HeroSection settings={initialSettings} />
        <InfoSections settings={initialSettings} />
      </main>
      <SiteFooter settings={initialSettings} />
    </div>
  );
}
