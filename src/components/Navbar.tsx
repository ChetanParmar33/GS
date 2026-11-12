'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';

interface NavbarProps {
  shopName?: string;
}

const navItems = [
  { href: '/#games', label: 'Games & Sim' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#why', label: 'The Lounge' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#visit', label: 'Visit' }
];

export function Navbar({ shopName = 'GAMING STATION' }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid ? 'bg-brand-base/85 backdrop-blur-xl border-b border-white/5' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-3">
        <Link href="/" className="shrink-0" aria-label={`${shopName} home`}>
          <Logo name={shopName} />
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3.5 py-2 rounded-full text-sm font-semibold text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/book"
            className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-primary hover:bg-brand-hover text-white font-bold text-sm px-4 sm:px-5 py-2.5 shadow-glow transition-colors"
          >
            Book<span className="hidden sm:inline"> a Slot</span>
            <ArrowRight className="hidden sm:block w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full border border-white/10 text-white hover:bg-white/5 transition-colors"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-white/5 px-4 pb-5 pt-2 flex flex-col gap-1" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="px-3 py-3 rounded-xl text-base font-semibold text-brand-dark hover:bg-white/5 tap-target flex items-center"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/book?mode=rent"
            onClick={() => setOpen(false)}
            className="mt-2 px-4 py-3 rounded-xl text-base font-semibold text-brand-glow border border-brand-border tap-target flex items-center justify-between"
          >
            Rent a PS5 for home <ArrowRight className="w-4 h-4" />
          </Link>
        </nav>
      )}
    </header>
  );
}
