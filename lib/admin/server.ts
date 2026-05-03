// lib/admin/server.ts
//
// Server-only helpers for the /admin route. Two clients:
//   - getSessionUser():   reads the current Supabase session via cookies
//                          (uses NEXT_PUBLIC_SUPABASE_ANON_KEY, RLS applies)
//   - getAdminClient():   service_role client that bypasses RLS so we can
//                          read every signup. NEVER export this to the client.
//
// requireAdmin() is the gate: it returns the user row if the caller is in
// admin_users, otherwise throws. Use it in every /admin server component
// and /api/admin route handler.

import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  // Don't crash the whole app at import time in production builds — just at /admin call sites.
  console.warn("[admin] SUPABASE_SERVICE_ROLE_KEY is not set; /admin will fail.");
}

/** SSR client tied to the visitor's cookies. Honors RLS. */
function getServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // /admin only reads — no need to set/remove cookies here.
      set() {},
      remove() {},
    },
  });
}

/** Service-role client. Bypasses RLS. Server-only. */
export function getAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for /admin");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Returns the current logged-in Supabase user, or null. */
export async function getSessionUser() {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

/** Throws (or returns a 'reason') if the caller is not an admin. */
export async function requireAdmin(): Promise<
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; reason: "not_signed_in" | "not_admin" }
> {
  const user = await getSessionUser();
  if (!user || !user.email) return { ok: false, reason: "not_signed_in" };

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select("email")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[admin] admin_users lookup failed", error);
    return { ok: false, reason: "not_admin" };
  }
  if (!data) return { ok: false, reason: "not_admin" };

  return { ok: true, user: { id: user.id, email: user.email } };
}
