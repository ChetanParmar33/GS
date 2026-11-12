# GAMEZONE – GTA VI Exclusive Booking Platform

Mobile-first PlayStation 5 slot booking web application for **GAMEZONE** (V.V. Nagar, Iskcon Road, Anand, Gujarat, India) built with **Next.js, React, TypeScript, Tailwind CSS**, and **Supabase PostgreSQL / Auth** (with an automatic server-side SQLite transaction adapter when Supabase env vars are not yet set).

## Architecture Overview

- **Frontend (`src/components/`, `src/app/`)**: Bright white & purple (`#31007F`, `#FFFFFF`, `#F5F0FF`, `#201735`, `#6D35C8`) mobile-first UI with live `Asia/Kolkata` countdown to `19 November 2026`, 3-step PS5 slot booking wizard (`Date & Slot`, `Your Details`, `Review & Book`), per-station pricing (`₹149/hr`), and `/admin` dashboard.
- **API Routes (`src/app/api/`)**: Server-validated endpoints for availability, atomic booking creation, and admin operations. Zero secrets or credentials in client code.
- **Database Adapters (`src/lib/db/`)**:
  - **Local Server SQLite (`data/gamezone.db`)**: Active automatically when Supabase env vars are blank. Uses Node's built-in `node:sqlite` with `BEGIN IMMEDIATE` transactions to prevent double bookings across simultaneous devices.
  - **Supabase PostgreSQL (`supabase/migrations/001_init.sql`)**: Active automatically when `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are configured in `.env.local`. Includes RLS policies and the `create_booking_atomic` advisory-locked RPC function.

## Local Development & Mobile Access

Start server on `0.0.0.0:3000`:

```bash
npm run dev
```

Open on the same machine at `http://localhost:3000` or on a phone connected to the same Wi-Fi/LAN using your host LAN IP (port `3000`).

Admin panel: `/admin` (credentials configured in `.env.local` via `ADMIN_EMAIL` and `ADMIN_PASSWORD`).

## Connecting Supabase for Production

1. Create a Supabase project and run [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) in the Supabase SQL Editor.
2. Create an admin user in **Supabase Authentication → Users**, then insert their `id` and `email` into `public.admin_users`:
   ```sql
   insert into public.admin_users (user_id, email) values ('<AUTH_USER_UUID>', 'admin@yourdomain.com');
   ```
3. Populate `.env.local` with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Restart the Next.js server.

