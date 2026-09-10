import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side use only (Server Components,
 * Route Handlers, Server Actions). Never import this from a "use client"
 * file — the key it holds bypasses Row Level Security entirely, same
 * security model dash_app already uses. See PROJECT_PLAN.md section 3.
 */
export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
