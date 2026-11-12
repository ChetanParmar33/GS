import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const manrope = localFont({
  src: './fonts/manrope-latin.woff2',
  weight: '400 800',
  variable: '--font-manrope',
  display: 'swap'
});

const unbounded = localFont({
  src: './fonts/unbounded-latin.woff2',
  weight: '500 800',
  variable: '--font-unbounded',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'GAMING STATION | PS5 Gaming Lounge, G29 Racing Sim & PS5 Rentals in Anand',
  description:
    'Play PlayStation 5 games from ₹69/hr, race on our Logitech G29 Simulator at ₹149/hr, or rent a PS5 console for home at GAMING STATION in V.V. Nagar, Iskcon Road, Anand, Gujarat.',
  openGraph: {
    title: 'GAMING STATION – PS5 Gaming Lounge & G29 Racing Sim | Anand, Gujarat',
    description:
      'Reserve PS5 gaming slots from ₹69/hr, Logitech G29 Racing Simulator at ₹149/hr, or PS5 home rentals at GAMING STATION, Anand. Open 11:00 AM to 11:00 PM.',
    type: 'website'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0612'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${unbounded.variable}`}>
      <body className="font-sans antialiased bg-brand-base text-brand-dark">{children}</body>
    </html>
  );
}
