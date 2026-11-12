-- GAMEZONE GTA VI PS5 Booking Database Schema (PostgreSQL / Supabase)
-- Run in Supabase SQL Editor or via `supabase db push`

create extension if not exists pgcrypto;

-- 1. Admin Settings (single row id = 1)
create table if not exists public.admin_settings (
  id integer primary key default 1 check (id = 1),
  shop_name text not null default 'GAMING STATION',
  address text not null default 'V.V. Nagar, Iskcon Road, Anand, Gujarat, India',
  contact_number text not null default '',
  whatsapp_number text not null default '9016615442',
  instagram_handle text not null default '@gamingstation50',
  instagram_url text not null default 'https://www.instagram.com/gamingstation50/',
  google_maps_url text not null default '',
  opening_hour integer not null default 11 check (opening_hour >= 0 and opening_hour <= 22),
  closing_hour integer not null default 23 check (closing_hour > opening_hour and closing_hour <= 24),
  hourly_price integer not null default 149 check (hourly_price > 0),
  station_count integer not null default 4 check (station_count >= 1 and station_count <= 12),
  min_booking_date text not null default '',
  max_booking_date text not null default '2026-12-31',
  closed_dates jsonb not null default '[]'::jsonb,
  hold_pending_slots boolean not null default true,
  pending_hold_minutes integer not null default 15 check (pending_hold_minutes >= 0),
  upi_enabled boolean not null default false,
  upi_id text not null default '',
  upi_account_name text not null default '',
  upi_instructions text not null default 'Complete UPI transfer and submit your UTR/reference. Booking remains Pending until shop verification.',
  cancellation_rules text not null default 'Cancellations must be requested at least 2 hours before the booked start time. Confirmed slots cancelled in time are immediately released.',
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (id) values (1) on conflict (id) do nothing;

-- 2. PS5 Stations
create table if not exists public.stations (
  id integer primary key,
  name text not null,
  status text not null default 'active' check (status in ('active', 'disabled', 'maintenance')),
  note text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.stations (id, name, status) values
  (1, 'PS5 Station 1', 'active'),
  (2, 'PS5 Station 2', 'active'),
  (3, 'PS5 Station 3', 'active'),
  (4, 'PS5 Station 4', 'active')
on conflict (id) do nothing;

-- 3. Station Manual Blocks / Maintenance Slots
create table if not exists public.station_blocks (
  id uuid primary key default gen_random_uuid(),
  station_id integer not null references public.stations(id) on delete cascade,
  block_date date not null,
  start_hour integer not null check (start_hour >= 0 and start_hour < 24),
  end_hour integer not null check (end_hour > start_hour and end_hour <= 24),
  reason text not null default 'Maintenance / Reserved',
  created_at timestamptz not null default now()
);

create index if not exists idx_station_blocks_lookup on public.station_blocks (block_date, station_id);

-- 4. Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Bookings
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_name text not null,
  mobile text not null,
  players integer not null check (players >= 1 and players <= 4),
  station_id integer not null references public.stations(id) on delete restrict,
  station_name text not null,
  booking_date date not null,
  start_hour integer not null check (start_hour >= 0 and start_hour < 24),
  end_hour integer not null check (end_hour > start_hour and end_hour <= 24),
  duration integer not null check (duration >= 1 and duration <= 4),
  hourly_price_snapshot integer not null check (hourly_price_snapshot > 0),
  total_amount integer not null check (total_amount > 0),
  payment_method text not null check (payment_method in ('Pay at Shop', 'UPI Advance')),
  payment_status text not null default 'Unpaid (Pay at Shop)',
  upi_ref text not null default '',
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Cancelled', 'Completed')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bookings_date_station on public.bookings (booking_date, station_id, status);
create index if not exists idx_bookings_mobile on public.bookings (mobile);

-- 6. Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  method text not null check (method in ('Pay at Shop', 'UPI Advance')),
  amount integer not null check (amount > 0),
  reference text not null default '',
  status text not null default 'Unpaid (Pay at Shop)',
  updated_at timestamptz not null default now()
);

-- 7. Admin Allowlist (maps Supabase Auth users to admin access)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.is_gamezone_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

-- Row Level Security
alter table public.admin_settings enable row level security;
alter table public.stations enable row level security;
alter table public.station_blocks enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.admin_users enable row level security;

-- Public read access ONLY to non-sensitive shop settings & station list
create policy "Public read settings" on public.admin_settings for select using (true);
create policy "Public read stations" on public.stations for select using (true);

-- Admin full access policies
create policy "Admin manage settings" on public.admin_settings for all using (public.is_gamezone_admin()) with check (public.is_gamezone_admin());
create policy "Admin manage stations" on public.stations for all using (public.is_gamezone_admin()) with check (public.is_gamezone_admin());
create policy "Admin manage blocks" on public.station_blocks for all using (public.is_gamezone_admin()) with check (public.is_gamezone_admin());
create policy "Admin manage customers" on public.customers for all using (public.is_gamezone_admin()) with check (public.is_gamezone_admin());
create policy "Admin manage bookings" on public.bookings for all using (public.is_gamezone_admin()) with check (public.is_gamezone_admin());
create policy "Admin manage payments" on public.payments for all using (public.is_gamezone_admin()) with check (public.is_gamezone_admin());
create policy "Admin read admin_users" on public.admin_users for select using (auth.uid() = user_id);

-- Atomic Concurrency-Safe Booking Function
create or replace function public.create_booking_atomic(
  p_customer_name text,
  p_mobile text,
  p_players integer,
  p_booking_date date,
  p_start_hour integer,
  p_duration integer,
  p_station_choice text, -- 'auto' or '1'..'4'
  p_payment_method text,
  p_upi_ref text default '',
  p_status text default 'Pending',
  p_payment_status text default 'Unpaid (Pay at Shop)',
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.admin_settings%rowtype;
  v_today_ist date := (now() at time zone 'Asia/Kolkata')::date;
  v_hour_ist integer := extract(hour from (now() at time zone 'Asia/Kolkata'))::integer;
  v_end_hour integer := p_start_hour + p_duration;
  v_station public.stations%rowtype;
  v_chosen_station_id integer;
  v_customer_id uuid;
  v_booking_id uuid;
  v_booking_code text;
  v_total_amount integer;
  v_conflict boolean;
begin
  -- Serialize bookings per date using transaction advisory lock
  perform pg_advisory_xact_lock(hashtext('gz_booking_' || p_booking_date::text));

  select * into v_settings from public.admin_settings where id = 1;

  if p_booking_date < v_today_ist then
    raise exception 'Past dates cannot be booked.';
  end if;

  if v_settings.min_booking_date <> '' and p_booking_date < v_settings.min_booking_date::date then
    raise exception 'Selected date is before the active booking window.';
  end if;

  if v_settings.max_booking_date <> '' and p_booking_date > v_settings.max_booking_date::date then
    raise exception 'Selected date is outside the active booking window.';
  end if;

  if v_settings.closed_dates ? (p_booking_date::text) then
    raise exception 'Shop is closed on the selected date.';
  end if;

  if p_start_hour < v_settings.opening_hour or v_end_hour > v_settings.closing_hour then
    raise exception 'Booking exceeds shop operating hours.';
  end if;

  if p_booking_date = v_today_ist and p_start_hour <= v_hour_ist then
    raise exception 'Selected time slot has already started or passed.';
  end if;

  if p_station_choice = 'auto' then
    select s.id into v_chosen_station_id
    from public.stations s
    where s.id <= v_settings.station_count
      and s.status = 'active'
      and not exists (
        select 1 from public.station_blocks sb
        where sb.station_id = s.id
          and sb.block_date = p_booking_date
          and sb.start_hour < v_end_hour
          and p_start_hour < sb.end_hour
      )
      and not exists (
        select 1 from public.bookings b
        where b.station_id = s.id
          and b.booking_date = p_booking_date
          and b.start_hour < v_end_hour
          and p_start_hour < b.end_hour
          and (
            b.status in ('Confirmed', 'Completed')
            or (
              b.status = 'Pending'
              and v_settings.hold_pending_slots = true
              and (v_settings.pending_hold_minutes = 0 or b.created_at > now() - make_interval(mins => v_settings.pending_hold_minutes))
            )
          )
      )
    order by s.id asc
    limit 1;

    if v_chosen_station_id is null then
      raise exception 'All PS5 stations are unavailable for this slot.';
    end if;
  else
    v_chosen_station_id := p_station_choice::integer;
    select * into v_station from public.stations where id = v_chosen_station_id;
    if not found or v_station.id > v_settings.station_count then
      raise exception 'Invalid PS5 station selected.';
    end if;
    if v_station.status <> 'active' then
      raise exception 'Selected PS5 station is currently unavailable.';
    end if;

    select exists (
      select 1 from public.station_blocks sb
      where sb.station_id = v_chosen_station_id
        and sb.block_date = p_booking_date
        and sb.start_hour < v_end_hour
        and p_start_hour < sb.end_hour
    ) or exists (
      select 1 from public.bookings b
      where b.station_id = v_chosen_station_id
        and b.booking_date = p_booking_date
        and b.start_hour < v_end_hour
        and p_start_hour < b.end_hour
        and (
          b.status in ('Confirmed', 'Completed')
          or (
            b.status = 'Pending'
            and v_settings.hold_pending_slots = true
            and (v_settings.pending_hold_minutes = 0 or b.created_at > now() - make_interval(mins => v_settings.pending_hold_minutes))
          )
        )
    ) into v_conflict;

    if v_conflict then
      raise exception 'Selected PS5 station was just booked or blocked.';
    end if;
  end if;

  select * into v_station from public.stations where id = v_chosen_station_id;

  insert into public.customers (full_name, mobile)
  values (p_customer_name, p_mobile)
  on conflict (mobile) do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_customer_id;

  v_booking_code := 'GZ-' || to_char(p_booking_date, 'YYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4));
  v_total_amount := v_settings.hourly_price * p_duration;

  insert into public.bookings (
    booking_code, customer_id, customer_name, mobile, players,
    station_id, station_name, booking_date, start_hour, end_hour, duration,
    hourly_price_snapshot, total_amount, payment_method, payment_status,
    upi_ref, status, notes
  ) values (
    v_booking_code, v_customer_id, p_customer_name, p_mobile, p_players,
    v_chosen_station_id, v_station.name, p_booking_date, p_start_hour, v_end_hour, p_duration,
    v_settings.hourly_price, v_total_amount, p_payment_method, p_payment_status,
    coalesce(p_upi_ref, ''), p_status, coalesce(p_notes, '')
  )
  returning id into v_booking_id;

  insert into public.payments (booking_id, method, amount, reference, status)
  values (v_booking_id, p_payment_method, v_total_amount, coalesce(p_upi_ref, ''), p_payment_status);

  return jsonb_build_object(
    'id', v_booking_id,
    'bookingCode', v_booking_code,
    'stationId', v_chosen_station_id,
    'stationName', v_station.name,
    'totalAmount', v_total_amount,
    'hourlyPriceSnapshot', v_settings.hourly_price,
    'status', p_status,
    'paymentStatus', p_payment_status
  );
end;
$$;

