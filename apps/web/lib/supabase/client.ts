import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | undefined;

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // The web app runs Supabase from the browser, so only NEXT_PUBLIC values are used here.
  // Laziness keeps Next prerendering from failing before the client-side feature actually runs.
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  // The anon key is safe to ship when table access is constrained by RLS policies.
  supabaseClient ??= createClient(supabaseUrl, supabaseAnonKey);

  return supabaseClient;
}
