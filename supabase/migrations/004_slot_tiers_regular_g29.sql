-- Migration 004: GameZone Regular PS5 (Rs.69/hr) & Logitech G29 Racing Simulator (Rs.149/hr) tiers

alter table public.admin_settings
  add column if not exists regular_hourly_price integer not null default 69 check (regular_hourly_price > 0),
  add column if not exists g29_hourly_price integer not null default 149 check (g29_hourly_price > 0);

alter table public.bookings
  add column if not exists slot_tier text not null default 'regular' check (slot_tier in ('regular', 'g29'));

