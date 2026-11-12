import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { isSupabaseConfigured } from '@/lib/db';

const COOKIE_NAME = 'gz_admin_session';

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || 'local-dev-fallback-secret-set-env-local';
}

function signToken(payload: string): string {
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token: string | undefined): { email: string; exp: number } | null {
  if (!token || !token.includes('.')) return null;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > Number(parsed.exp)) return null;
    return { email: String(parsed.email), exp: Number(parsed.exp) };
  } catch {
    return null;
  }
}

async function createSupabaseAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(items: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Read-only during Server Component render
          }
        }
      }
    }
  );
}

export async function getAdminSession(): Promise<{
  authenticated: boolean;
  email?: string;
  mode: 'supabase' | 'local';
}> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseAuthClient();
    const {
      data: { user }
    } = await sb.auth.getUser();
    if (!user) return { authenticated: false, mode: 'supabase' };
    const { data: adminRow } = await sb
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!adminRow) return { authenticated: false, mode: 'supabase' };
    return { authenticated: true, email: user.email || undefined, mode: 'supabase' };
  }

  const cookieStore = await cookies();
  const parsed = verifyToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!parsed) return { authenticated: false, mode: 'local' };
  return { authenticated: true, email: parsed.email, mode: 'local' };
}

export async function loginAdmin(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const sb = await createSupabaseAuthClient();
    const { data, error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
    if (error || !data.user) return { ok: false, error: error?.message || 'Invalid credentials.' };
    const { data: adminRow } = await sb
      .from('admin_users')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle();
    if (!adminRow) {
      await sb.auth.signOut();
      return { ok: false, error: 'Account is not authorized as a GAMEZONE admin.' };
    }
    return { ok: true };
  }

  const expectedEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const expectedPass = process.env.ADMIN_PASSWORD || '';
  if (!expectedEmail || !expectedPass) {
    return { ok: false, error: 'ADMIN_EMAIL / ADMIN_PASSWORD not configured in .env.local.' };
  }

  const eBuf = Buffer.from(cleanEmail);
  const expEBuf = Buffer.from(expectedEmail);
  const pBuf = Buffer.from(password);
  const expPBuf = Buffer.from(expectedPass);

  const emailMatch = eBuf.length === expEBuf.length && crypto.timingSafeEqual(eBuf, expEBuf);
  const passMatch = pBuf.length === expPBuf.length && crypto.timingSafeEqual(pBuf, expPBuf);
  if (!emailMatch || !passMatch) {
    return { ok: false, error: 'Invalid admin email or password.' };
  }

  const payload = Buffer.from(
    JSON.stringify({ email: expectedEmail, exp: Date.now() + 12 * 60 * 60 * 1000 }),
    'utf8'
  ).toString('base64url');
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, signToken(payload), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60
  });
  return { ok: true };
}

export async function logoutAdmin(): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = await createSupabaseAuthClient();
    await sb.auth.signOut();
    return;
  }

  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
