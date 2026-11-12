-- Migration 002: PS5 Home Rentals (1-7 days) & Package Pricing (Slot + Rental)

alter table public.admin_settings
  add column if not exists slot_prices jsonb not null default '{"1":149,"2":249,"3":299,"4":399}'::jsonb,
  add column if not exists rental_prices jsonb not null default '{"1":1499,"2":2499,"3":2999,"4":3699,"5":4499,"6":5499,"7":6999}'::jsonb;

alter table public.bookings
  add column if not exists booking_type text not null default 'slot' check (booking_type in ('slot', 'rental')),
  add column if not exists end_date date;

update public.bookings set end_date = booking_date where end_date is null;

alter table public.bookings
  alter column end_date set not null,
  drop constraint if exists bookings_duration_check,
  add constraint bookings_duration_check check (
    (booking_type = 'slot' and duration >= 1 and duration <= 4)
    or (booking_type = 'rental' and duration >= 1 and duration <= 7)
  );

create index if not exists idx_bookings_type_dates on public.bookings (booking_type, booking_date, end_date, status);

create or replace function public.create_booking_atomic(
  p_customer_name text,
  p_mobile text,
  p_players integer,
  p_booking_date date,
  p_start_hour integer,
  p_duration integer,
  p_station_choice text,
  p_payment_method text,
  p_upi_ref text default '',
  p_status text default 'Pending',
  p_payment_status text default 'Unpaid (Pay at Shop)',
  p_notes text default '',
  p_booking_type text default 'slot',
  p_end_date date default null,
  p_total_amount integer default null
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
  v_end_date date := coalesce(p_end_date, case when p_booking_type = 'rental' then (p_booking_date + (p_duration - 1)) else p_booking_date end);
  v_start_hour integer;
  v_end_hour integer;
  v_station public.stations%rowtype;
  v_chosen_station_id integer;
  v_customer_id uuid;
  v_booking_id uuid;
  v_booking_code text;
  v_total_amount integer;
  v_conflict boolean;
begin
  perform pg_advisory_xact_lock(hashtext('gz_booking_global'));

  select * into v_settings from public.admin_settings where id = 1;

  if p_booking_date < v_today_ist then
    raise exception 'Past dates cannot be booked.';
  end if;
  if v_settings.min_booking_date <> '' and p_booking_date < v_settings.min_booking_date::date then
    raise exception 'Selected date is before the active booking window.';
  end if;
  if v_settings.max_booking_date <> '' and v_end_date > v_settings.max_booking_date::date then
    raise exception 'Selected date range is outside the active booking window.';
  end if;
  if v_settings.closed_dates ? (p_booking_date::text) then
    raise exception 'Shop is closed on the selected date.';
  end if;

  if p_booking_type = 'rental' then
    v_start_hour := v_settings.opening_hour;
    v_end_hour := v_settings.closing_hour;
    if p_booking_date = v_today_ist and v_hour_ist >= v_settings.closing_hour then
      raise exception 'Shop closed for today pickup — choose tomorrow.';
    end if;
    v_total_amount := coalesce(
      (v_settings.rental_prices ->> (p_duration::text))::integer,
      p_total_amount,
      1499 * p_duration
    );
  else
    v_start_hour := p_start_hour;
    v_end_hour := p_start_hour + p_duration;
    if v_start_hour < v_settings.opening_hour or v_end_hour > v_settings.closing_hour then
      raise exception 'Booking exceeds shop operating hours.';
    end if;
    if p_booking_date = v_today_ist and v_start_hour <= v_hour_ist then
      raise exception 'Selected time slot has already started or passed.';
    end if;
    v_total_amount := coalesce(
      (v_settings.slot_prices ->> (p_duration::text))::integer,
      p_total_amount,
      v_settings.hourly_price * p_duration
    );
  end if;

  if p_station_choice = 'auto' then
    select s.id into v_chosen_station_id
    from public.stations s
    where s.id <= v_settings.station_count
      and s.status = 'active'
      and not exists (
        select 1 from public.station_blocks sb
        where sb.station_id = s.id
          and sb.block_date >= p_booking_date
          and sb.block_date <= v_end_date
          and (p_booking_type = 'rental' or (sb.start_hour < v_end_hour and v_start_hour < sb.end_hour))
      )
      and not exists (
        select 1 from public.bookings b
        where b.station_id = s.id
          and (
            b.status in ('Confirmed', 'Completed')
            or (
              b.status = 'Pending'
              and v_settings.hold_pending_slots = true
              and (v_settings.pending_hold_minutes = 0 or b.created_at > now() - make_interval(mins => v_settings.pending_hold_minutes))
            )
          )
          and (
            (b.booking_type = 'rental' and b.booking_date <= v_end_date and b.end_date >= p_booking_date)
            or (
              b.booking_type <> 'rental'
              and b.booking_date >= p_booking_date
              and b.booking_date <= v_end_date
              and (p_booking_type = 'rental' or (b.start_hour < v_end_hour and v_start_hour < b.end_hour))
            )
          )
      )
    order by s.id asc
    limit 1;

    if v_chosen_station_id is null then
      raise exception 'All PS5 stations are unavailable for this selection.';
    end if;
  else
    v_chosen_station_id := p_station_choice::integer;
    select * into v_station from public.stations where id = v_chosen_station_id;
    if not found or v_station.id > v_settings.station_count or v_station.status <> 'active' then
      raise exception 'Selected PS5 station is currently unavailable.';
    end if;

    select exists (
      select 1 from public.station_blocks sb
      where sb.station_id = v_chosen_station_id
        and sb.block_date >= p_booking_date
        and sb.block_date <= v_end_date
        and (p_booking_type = 'rental' or (sb.start_hour < v_end_hour and v_start_hour < sb.end_hour))
    ) or exists (
      select 1 from public.bookings b
      where b.station_id = v_chosen_station_id
        and (
          b.status in ('Confirmed', 'Completed')
          or (
            b.status = 'Pending'
            and v_settings.hold_pending_slots = true
            and (v_settings.pending_hold_minutes = 0 or b.created_at > now() - make_interval(mins => v_settings.pending_hold_minutes))
          )
        )
        and (
          (b.booking_type = 'rental' and b.booking_date <= v_end_date and b.end_date >= p_booking_date)
          or (
            b.booking_type <> 'rental'
            and b.booking_date >= p_booking_date
            and b.booking_date <= v_end_date
            and (p_booking_type = 'rental' or (b.start_hour < v_end_hour and v_start_hour < b.end_hour))
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

  v_booking_code := (case when p_booking_type = 'rental' then 'RN-' else 'GZ-' end)
    || to_char(p_booking_date, 'YYMMDD') || '-'
    || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4));

  insert into public.bookings (
    booking_code, booking_type, customer_id, customer_name, mobile, players,
    station_id, station_name, booking_date, end_date, start_hour, end_hour, duration,
    hourly_price_snapshot, total_amount, payment_method, payment_status,
    upi_ref, status, notes
  ) values (
    v_booking_code, p_booking_type, v_customer_id, p_customer_name, p_mobile, p_players,
    v_chosen_station_id, v_station.name, p_booking_date, v_end_date, v_start_hour, v_end_hour, p_duration,
    v_settings.hourly_price, v_total_amount, p_payment_method, p_payment_status,
    coalesce(p_upi_ref, ''), p_status, coalesce(p_notes, '')
  )
  returning id into v_booking_id;

  insert into public.payments (booking_id, method, amount, reference, status)
  values (v_booking_id, p_payment_method, v_total_amount, coalesce(p_upi_ref, ''), p_payment_status);

  return jsonb_build_object(
    'id', v_booking_id,
    'bookingCode', v_booking_code,
    'bookingType', p_booking_type,
    'stationId', v_chosen_station_id,
    'stationName', v_station.name,
    'totalAmount', v_total_amount,
    'status', p_status,
    'paymentStatus', p_payment_status
  );
end;
$$;

