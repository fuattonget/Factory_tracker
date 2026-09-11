import { createBrowserClient } from "@supabase/ssr";

// Browser-side client, uses the anon/public key only -- never the service
// role key. Only used for Supabase Auth (login, set-password); data
// queries always go through the server (see lib/supabase/server.ts).
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
