import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getRepository } from '@/lib/db';
import { BookingFlow } from '@/components/BookingFlow';
import { Logo } from '@/components/Logo';
import { SiteFooter } from '@/components/SiteFooter';

export const dynamic = 'force-dynamic';

export default async function BookPage({
  searchParams
}: {
  searchParams?: Promise<{ mode?: string; tier?: string }>;
}) {
  const settings = await getRepository().getSettings();
  const params = searchParams ? await searchParams : {};
  const initialMode = params?.mode === 'rent' || params?.mode === 'rental' ? 'rental' : 'slot';
  const initialTier = params?.tier === 'g29' ? 'g29' : 'regular';

  return (
    <div className="min-h-screen flex flex-col bg-brand-base">
      <header className="sticky top-0 z-50 bg-brand-base/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-muted hover:text-white transition-colors tap-target"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Home</span>
          </Link>

          <Link href="/" aria-label={`${settings.shopName} home`}>
            <Logo name={settings.shopName} />
          </Link>
        </div>
      </header>

      <main className="relative flex-1 py-6 sm:py-10 overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-brand-primary/20 blur-[120px]" aria-hidden="true" />
        <div className="relative">
          <BookingFlow settings={settings} initialMode={initialMode} initialTier={initialTier} />
        </div>
      </main>

      <SiteFooter settings={settings} />
    </div>
  );
}
