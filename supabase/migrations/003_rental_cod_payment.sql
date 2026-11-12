-- Migration 003: Rental COD (Rs.99 online confirmation fee) & Full Online payment methods

alter table public.admin_settings
  add column if not exists rental_cod_fee integer not null default 99 check (rental_cod_fee > 0);

alter table public.bookings
  drop constraint if exists bookings_payment_method_check,
  add constraint bookings_payment_method_check check (
    payment_method in ('Pay at Shop', 'UPI Advance', 'COD', 'Full Online')
  );

alter table public.payments
  drop constraint if exists payments_method_check,
  add constraint payments_method_check check (
    method in ('Pay at Shop', 'UPI Advance', 'COD', 'Full Online')
  );

