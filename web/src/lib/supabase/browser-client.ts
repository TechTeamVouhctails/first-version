import { createClient } from "@supabase/supabase-js";
import { requireSupabase } from "@/lib/public-env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = requireSupabase();
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
}
