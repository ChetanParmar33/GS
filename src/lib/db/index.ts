import { sqliteRepository } from '@/lib/db/sqlite-adapter';
import { supabaseRepository } from '@/lib/db/supabase-adapter';
import type { GameZoneRepository } from '@/lib/db/types';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getRepository(): GameZoneRepository {
  return isSupabaseConfigured() ? supabaseRepository : sqliteRepository;
}

