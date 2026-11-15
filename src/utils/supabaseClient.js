import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://irqspxluxuhktblzabez.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_3YL2mPK14wuJXI5Bc6Qedg_iPpguzdQ';

/**
 * Checks whether valid Supabase environment variables are present.
 * Allows NullPin to operate in offline local RAM mode when not configured.
 */
export const isSupabaseConfigured = () => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== '[PASTE_YOUR_SUPABASE_URL_HERE]' &&
    supabaseAnonKey !== '[PASTE_YOUR_SUPABASE_ANON_KEY_HERE]' &&
    supabaseUrl.startsWith('https://')
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

